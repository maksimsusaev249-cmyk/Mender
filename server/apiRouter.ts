import {
  ServerEnv,
  ServiceAccountCredentials,
  FirestoreRestClient,
  SERVER_TIMESTAMP_SENTINEL,
  resolveServiceAccount,
  getFirebaseProjectTargets,
  getGoogleAccessToken,
  createFirebaseCustomToken,
  verifyFirebaseIdToken,
  deriveUidFromEmailServer,
  generateSaltHex,
  hashPasswordServer,
  verifyPasswordHashServer,
  hashPinServer,
  verifyPinHashServer,
  signRecoveryChallengeToken,
  verifyRecoveryChallengeToken,
  sha256Hex,
  constantTimeEqual,
} from './firebaseAdminRest';

export interface ApiRouterDeps {
  createFirestore?: (env: ServerEnv) => Promise<{
    db: FirestoreRestClient;
    sa: ServiceAccountCredentials;
    projectId: string;
  }>;
  mintCustomToken?: (sa: ServiceAccountCredentials, uid: string, claims?: Record<string, unknown>) => Promise<string>;
  verifyIdToken?: (token: string, projectId: string) => Promise<{ uid: string } | null>;
  fetchFn?: typeof fetch;
}

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function normalizeEmailFromIdentifier(rawIdentifier: string): {
  lowered: string;
  isEmailFormat: boolean;
  normalizedEmail: string;
} {
  const lowered = rawIdentifier.trim().toLowerCase();
  const isEmailFormat = lowered.includes('@') && !lowered.startsWith('@');
  const normalizedEmail = isEmailFormat
    ? lowered
    : `${lowered.replace(/^@/, '')}@mender.app`;
  return { lowered, isEmailFormat, normalizedEmail };
}

function validateStrongPasswordServer(password: string, username?: string): string | null {
  if (!password || password.length < 8) {
    return 'Пароль должен содержать минимум 8 символов';
  }
  if (!/[a-zA-Zа-яА-ЯёЁ]/.test(password) || !/\d/.test(password)) {
    return 'Пароль должен содержать хотя бы одну букву и одну цифру';
  }
  const cleanUname = (username || '').toLowerCase().trim();
  if (cleanUname && cleanUname.length >= 3 && password.toLowerCase().includes(cleanUname)) {
    return 'Пароль слишком простой и не должен содержать ваш @username';
  }
  const weakList = ['12345678', '123456789', 'qwerty123', 'password1', 'password123', 'admin123'];
  if (weakList.includes(password.toLowerCase())) {
    return 'Этот пароль слишком распространён и небезопасен! Выберите более сложную комбинацию.';
  }
  return null;
}

async function getAdminContext(env: ServerEnv, deps?: ApiRouterDeps) {
  if (deps?.createFirestore) {
    return deps.createFirestore(env);
  }
  const sa = resolveServiceAccount(env);
  const { projectId, databaseId } = getFirebaseProjectTargets(env, sa);
  const accessToken = await getGoogleAccessToken(sa);
  const db = new FirestoreRestClient(projectId, databaseId, accessToken);
  return { db, sa, projectId };
}

async function findAccountByIdentifierServer(
  db: FirestoreRestClient,
  rawIdentifier: string
): Promise<{
  uid: string;
  normalizedEmail: string;
  pubDoc: Record<string, any> | null;
  privDoc: Record<string, any> | null;
}> {
  const { lowered, normalizedEmail } = normalizeEmailFromIdentifier(rawIdentifier);
  let uid = await deriveUidFromEmailServer(normalizedEmail);

  let [pubDoc, privDoc] = await Promise.all([
    db.getDoc(`users/${uid}`),
    db.getDoc(`users_private/${uid}`),
  ]);

  if (!pubDoc) {
    const cleanUsernameQuery = lowered.replace(/^@/, '').trim();
    const byUsername = await db.runStructuredQuery('users', 'username', 'EQUAL', cleanUsernameQuery, 5);
    let matchedUser: Record<string, any> | null = byUsername[0] || null;

    if (!matchedUser) {
      const allUsers = await db.runStructuredQuery(
        'users',
        'status',
        'IN',
        ['online', 'offline', 'busy'],
        300
      );
      matchedUser =
        allUsers.find(u => u.username && String(u.username).toLowerCase() === cleanUsernameQuery) ||
        allUsers.find(u => u.displayName && String(u.displayName).trim().toLowerCase() === lowered) ||
        null;

      if (!matchedUser && cleanUsernameQuery.length >= 2) {
        matchedUser =
          allUsers.find(
            u =>
              String(u.username || '').toLowerCase() === cleanUsernameQuery ||
              String(u.displayName || '').trim().toLowerCase().split(/\s+/).includes(lowered) ||
              String(u.displayName || '').trim().toLowerCase().includes(lowered)
          ) || null;
      }
    }

    if (matchedUser?.uid) {
      uid = String(matchedUser.uid);
      [pubDoc, privDoc] = await Promise.all([
        db.getDoc(`users/${uid}`),
        db.getDoc(`users_private/${uid}`),
      ]);
    }
  }

  return { uid, normalizedEmail, pubDoc, privDoc };
}

function getRecoverySecret(env: ServerEnv, sa: ServiceAccountCredentials): string {
  return env.AUTH_CHALLENGE_SECRET || `${sa.private_key}:mender_recovery_hmac_v1`;
}

async function bytesHmacSha1Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  let binary = '';
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const DEFAULT_STUN_SERVERS: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export async function handleApiRequest(
  request: Request,
  env: ServerEnv,
  deps?: ApiRouterDeps
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const fetchImpl = deps?.fetchFn || fetch;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (pathname === '/api/health' && request.method === 'GET') {
    let customAuthConfigured = false;
    try {
      resolveServiceAccount(env);
      customAuthConfigured = true;
    } catch {
      customAuthConfigured = false;
    }
    const turnConfigured = Boolean(
      (env.CF_TURN_TOKEN_ID && env.CF_TURN_API_TOKEN) ||
        (env.TURN_URLS && (env.TURN_SECRET || (env.TURN_USERNAME && env.TURN_CREDENTIAL)))
    );
    return jsonResponse({
      ok: true,
      service: 'mender-api',
      version: '7.5.0',
      customAuthConfigured,
      turnConfigured,
    });
  }

  if (pathname === '/api/turn-credentials' && (request.method === 'GET' || request.method === 'POST')) {
    const projectId = env.FIREBASE_PROJECT_ID || getFirebaseProjectTargets(env).projectId;
    const authHeader = request.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!bearerToken) {
      return jsonResponse({ error: 'Требуется авторизация для получения TURN-ключей' }, 401);
    }

    const verifier = deps?.verifyIdToken || verifyFirebaseIdToken;
    const verifiedUser = await verifier(bearerToken, projectId);
    if (!verifiedUser) {
      return jsonResponse({ error: 'Недействительный токен авторизации' }, 401);
    }

    // 1. Cloudflare Calls Realtime TURN API (optimal for Kazakhstan without VPN)
    if (env.CF_TURN_TOKEN_ID && env.CF_TURN_API_TOKEN) {
      try {
        const cfRes = await fetchImpl(
          `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.CF_TURN_TOKEN_ID)}/credentials/generate-ice-servers`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.CF_TURN_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ttl: 86400 }),
          }
        );
        if (cfRes.ok) {
          const cfJson = (await cfRes.json()) as {
            iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
          };
          if (Array.isArray(cfJson.iceServers) && cfJson.iceServers.length > 0) {
            return jsonResponse({
              iceServers: [...DEFAULT_STUN_SERVERS, ...cfJson.iceServers],
              provider: 'cloudflare-turn',
              ttl: 86400,
            });
          }
        }
      } catch {
        // fallback below
      }
    }

    // 2. Coturn REST API ephemeral HMAC-SHA1 credentials
    if (env.TURN_URLS && env.TURN_SECRET) {
      const urls = env.TURN_URLS.split(',').map(s => s.trim()).filter(Boolean);
      const ttl = 86400;
      const expiry = Math.floor(Date.now() / 1000) + ttl;
      const username = `${expiry}:${verifiedUser.uid}`;
      const credential = await bytesHmacSha1Base64(env.TURN_SECRET, username);
      return jsonResponse({
        iceServers: [
          ...DEFAULT_STUN_SERVERS,
          { urls, username, credential },
        ],
        provider: 'coturn-hmac',
        ttl,
      });
    }

    // 3. Static configured TURN credentials from environment
    if (env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
      const urls = env.TURN_URLS.split(',').map(s => s.trim()).filter(Boolean);
      return jsonResponse({
        iceServers: [
          ...DEFAULT_STUN_SERVERS,
          { urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL },
        ],
        provider: 'turn-env',
        ttl: 3600,
      });
    }

    // Fallback to STUN servers if TURN env vars are not yet provisioned
    return jsonResponse({
      iceServers: DEFAULT_STUN_SERVERS,
      provider: 'stun-fallback',
      ttl: 3600,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Маршрут не найден' }, 404);
  }

  let body: Record<string, any> = {};
  try {
    body = (await request.json()) as Record<string, any>;
  } catch {
    return jsonResponse({ error: 'Некорректное JSON-тело запроса' }, 400);
  }

  const mintToken = deps?.mintCustomToken || createFirebaseCustomToken;

  try {
    // -----------------------------------------------------------------------
    // POST /api/auth/login
    // -----------------------------------------------------------------------
    if (pathname === '/api/auth/login') {
      const rawIdentifier = String(body.identifier || '').trim();
      const rawPassword = String(body.password || '');

      if (!rawIdentifier) {
        return jsonResponse({ error: 'Введите @юзернейм, имя или почту' }, 400);
      }
      if (!rawPassword || rawPassword.length < 4) {
        return jsonResponse({ error: 'Введите пароль от вашего аккаунта' }, 400);
      }

      const { db, sa } = await getAdminContext(env, deps);
      const { uid, normalizedEmail, pubDoc, privDoc } = await findAccountByIdentifierServer(
        db,
        rawIdentifier
      );

      if (!pubDoc) {
        return jsonResponse(
          {
            error:
              'Аккаунт с таким @юзернеймом, именем или почтой не найден! Нажмите «Регистрация», чтобы создать аккаунт.',
          },
          404
        );
      }

      if (privDoc?.passwordHash && privDoc?.passwordSalt) {
        const valid = await verifyPasswordHashServer(
          rawPassword,
          String(privDoc.passwordSalt),
          String(privDoc.passwordHash)
        );
        if (!valid) {
          return jsonResponse({ error: 'Неверный пароль от аккаунта!', code: 'INVALID_PASSWORD' }, 401);
        }
      } else if (privDoc?.pinHash && privDoc?.pinSalt) {
        const digitsOnly = rawPassword.replace(/\D/g, '');
        const matchesLegacyPin =
          digitsOnly.length >= 4 &&
          (await verifyPinHashServer(digitsOnly, String(privDoc.pinSalt), String(privDoc.pinHash)));
        if (!matchesLegacyPin) {
          return jsonResponse({ error: 'Неверный пароль от аккаунта!', code: 'INVALID_PASSWORD' }, 401);
        }
        const pwdSalt = generateSaltHex(16);
        const pwdHash = await hashPasswordServer(rawPassword, pwdSalt);
        await db.setDoc(
          `users_private/${uid}`,
          {
            passwordHash: pwdHash,
            passwordSalt: pwdSalt,
            updatedAt: SERVER_TIMESTAMP_SENTINEL,
          },
          ['passwordHash', 'passwordSalt', 'updatedAt']
        );
      } else if (privDoc && rawPassword.length >= 6) {
        const pwdSalt = generateSaltHex(16);
        const pwdHash = await hashPasswordServer(rawPassword, pwdSalt);
        await db.setDoc(
          `users_private/${uid}`,
          {
            passwordHash: pwdHash,
            passwordSalt: pwdSalt,
            updatedAt: SERVER_TIMESTAMP_SENTINEL,
          },
          ['passwordHash', 'passwordSalt', 'updatedAt']
        );
      }

      await db.setDoc(
        `users/${uid}`,
        { status: 'online', updatedAt: SERVER_TIMESTAMP_SENTINEL },
        ['status', 'updatedAt']
      );

      const customToken = await mintToken(sa, uid, {
        email_verified: true,
        mender_auth: 'password',
      });

      return jsonResponse({
        customToken,
        uid,
        email: privDoc?.email || normalizedEmail,
        displayName: pubDoc.displayName,
        photoURL: pubDoc.avatarUrl,
        requires2FaPin: Boolean(privDoc?.pinHash && privDoc?.twoFactorEnabled),
      });
    }

    // -----------------------------------------------------------------------
    // POST /api/auth/register
    // -----------------------------------------------------------------------
    if (pathname === '/api/auth/register') {
      const cyrillicMap: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
        з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
        п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
        ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
      };
      const toLatinSlug = (val: string) =>
        val
          .trim()
          .toLowerCase()
          .replace(/^@/, '')
          .split('')
          .map(ch => cyrillicMap[ch] ?? ch)
          .join('')
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');

      const cleanName = String(body.displayName || '').trim();
      const trimmedEmail = String(body.email || '').trim().toLowerCase();
      const rawUsernameInput = toLatinSlug(String(body.username || ''));
      const password = String(body.password || '');
      const cleanPin = String(body.pin2FA || '').replace(/\D/g, '');

      if (!cleanName) {
        return jsonResponse({ error: 'Введите ваше имя' }, 400);
      }

      const fallbackPrefix = trimmedEmail
        ? toLatinSlug(trimmedEmail.split('@')[0] || '')
        : toLatinSlug(cleanName) || `user_${Math.floor(1000 + Math.random() * 9000)}`;

      const baseUsername = rawUsernameInput || fallbackPrefix || `user_${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanUsername = (baseUsername.length >= 3 ? baseUsername : `user_${baseUsername}`).slice(0, 40);

      if (!password || password.length < 6) {
        return jsonResponse(
          { error: 'Пароль должен содержать минимум 6 символов (буквы, цифры или спецсимволы)' },
          400
        );
      }

      if (cleanPin) {
        if (cleanPin.length < 4 || cleanPin.length > 8) {
          return jsonResponse(
            { error: '2FA PIN-код должен содержать от 4 до 8 цифр (или оставьте поле пустым)' },
            400
          );
        }
        if (/^(\d)\1+$/.test(cleanPin) || cleanPin === '1234' || cleanPin === '123456') {
          return jsonResponse(
            { error: 'Слабый 2FA PIN-код! Не используйте одинаковые цифры (0000, 1111) или 1234.' },
            400
          );
        }
      }

      const normalizedEmail = trimmedEmail
        ? trimmedEmail.includes('@')
          ? trimmedEmail
          : `${trimmedEmail}@mender.app`
        : `${cleanUsername}@mender.app`;

      const { db, sa } = await getAdminContext(env, deps);
      const uid = await deriveUidFromEmailServer(normalizedEmail);

      const existingPub = await db.getDoc(`users/${uid}`);
      if (existingPub) {
        return jsonResponse(
          { error: 'Такой аккаунт уже зарегистрирован! Нажмите «Войти» и введите свой пароль.' },
          409
        );
      }

      const dupUsernames = await db.runStructuredQuery('users', 'username', 'EQUAL', cleanUsername, 2);
      if (dupUsernames.length > 0) {
        return jsonResponse(
          {
            error: `Юзернейм @${cleanUsername} уже занят. Выберите другой @username или войдите в существующий аккаунт.`,
          },
          409
        );
      }

      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        cleanName
      )}&background=0077FF&color=fff&bold=true`;

      const passwordSalt = generateSaltHex(16);
      const passwordHash = await hashPasswordServer(password, passwordSalt);
      const pinSalt = cleanPin ? generateSaltHex(16) : '';
      const pinHash = cleanPin ? await hashPinServer(cleanPin, pinSalt) : '';

      const publicDoc = {
        uid,
        displayName: cleanName.slice(0, 80),
        username: cleanUsername,
        avatarUrl: defaultAvatar,
        bio: 'Привет! Я на связи в Mender.',
        status: 'online',
        privacyLastSeen: 'everyone',
        privacyPhoto: 'everyone',
        privacyCalls: 'everyone',
        followersCount: 0,
        followingCount: 0,
        createdAt: SERVER_TIMESTAMP_SENTINEL,
        updatedAt: SERVER_TIMESTAMP_SENTINEL,
      };

      const privateDoc = {
        uid,
        email: normalizedEmail.slice(0, 254),
        phone: '',
        pinHash,
        pinSalt,
        passwordHash,
        passwordSalt,
        darkMode: false,
        notificationsEnabled: true,
        soundEnabled: true,
        twoFactorEnabled: Boolean(pinHash),
        createdAt: SERVER_TIMESTAMP_SENTINEL,
        updatedAt: SERVER_TIMESTAMP_SENTINEL,
      };

      await Promise.all([
        db.setDoc(`users/${uid}`, publicDoc),
        db.setDoc(`users_private/${uid}`, privateDoc),
      ]);

      const customToken = await mintToken(sa, uid, {
        email_verified: true,
        mender_auth: 'register',
      });

      return jsonResponse({
        customToken,
        uid,
        email: normalizedEmail,
        displayName: publicDoc.displayName,
        photoURL: publicDoc.avatarUrl,
        requires2FaPin: false,
      });
    }

    // -----------------------------------------------------------------------
    // POST /api/auth/quick-email
    // -----------------------------------------------------------------------
    if (pathname === '/api/auth/quick-email') {
      const trimmed = String(body.email || '').trim().toLowerCase();
      const customDisplayName = typeof body.displayName === 'string' ? body.displayName : undefined;
      const providedPin = typeof body.pin === 'string' ? body.pin : undefined;

      if (!trimmed) {
        return jsonResponse({ error: 'Введите адрес электронной почты' }, 400);
      }

      const cleanPin = providedPin ? providedPin.replace(/\D/g, '') : '';
      if (cleanPin && (cleanPin.length < 4 || cleanPin.length > 8)) {
        return jsonResponse({ error: 'Защитный PIN-код должен содержать от 4 до 8 цифр' }, 400);
      }

      const normalizedEmail = trimmed.includes('@') ? trimmed : `${trimmed}@mender.app`;
      const { db, sa } = await getAdminContext(env, deps);
      const uid = await deriveUidFromEmailServer(normalizedEmail);

      const [existingPub, existingPriv] = await Promise.all([
        db.getDoc(`users/${uid}`),
        db.getDoc(`users_private/${uid}`),
      ]);

      // CRITICAL SECURITY GATE:
      // Never allow Quick Email to bypass an account protected by a password or PIN!
      if (existingPriv?.passwordHash) {
        return jsonResponse(
          {
            error: 'Этот аккаунт защищён паролем. Используйте стандартный вход с паролем.',
            code: 'PASSWORD_REQUIRED',
          },
          403
        );
      }

      if (existingPriv?.pinHash && existingPriv?.pinSalt) {
        if (!cleanPin) {
          return jsonResponse(
            {
              error: 'Для входа в этот аккаунт необходимо ввести защитный PIN-код.',
              code: 'PIN_REQUIRED',
            },
            403
          );
        }
        const pinOk = await verifyPinHashServer(
          cleanPin,
          String(existingPriv.pinSalt),
          String(existingPriv.pinHash)
        );
        if (!pinOk) {
          return jsonResponse({ error: 'Неверный защитный PIN-код для этого аккаунта!' }, 401);
        }
      }

      const emailPrefix = normalizedEmail.split('@')[0] || 'user';
      const rawUsername = emailPrefix.replace(/[^a-z0-9_]/g, '_');
      const cleanUsername = (rawUsername.length >= 3 ? rawUsername : `user_${rawUsername}`).slice(0, 40);
      const resolvedName = (customDisplayName?.trim() || emailPrefix).slice(0, 80);
      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        resolvedName
      )}&background=4f46e5&color=fff&bold=true`;

      if (!existingPub) {
        await db.setDoc(`users/${uid}`, {
          uid,
          displayName: resolvedName,
          username: cleanUsername,
          avatarUrl: defaultAvatar,
          bio: 'Привет! Я на связи в Mender.',
          status: 'online',
          privacyLastSeen: 'everyone',
          privacyPhoto: 'everyone',
          privacyCalls: 'everyone',
          followersCount: 0,
          followingCount: 0,
          createdAt: SERVER_TIMESTAMP_SENTINEL,
          updatedAt: SERVER_TIMESTAMP_SENTINEL,
        });
      } else {
        await db.setDoc(
          `users/${uid}`,
          { status: 'online', updatedAt: SERVER_TIMESTAMP_SENTINEL },
          ['status', 'updatedAt']
        );
      }

      if (!existingPriv) {
        const newSalt = cleanPin ? generateSaltHex(16) : '';
        const newHash = cleanPin ? await hashPinServer(cleanPin, newSalt) : '';
        await db.setDoc(`users_private/${uid}`, {
          uid,
          email: normalizedEmail.slice(0, 254),
          phone: '',
          pinHash: newHash,
          pinSalt: newSalt,
          darkMode: true,
          notificationsEnabled: true,
          soundEnabled: true,
          twoFactorEnabled: Boolean(newHash),
          createdAt: SERVER_TIMESTAMP_SENTINEL,
          updatedAt: SERVER_TIMESTAMP_SENTINEL,
        });
      } else if (!existingPriv.pinHash && cleanPin) {
        const newSalt = generateSaltHex(16);
        const newHash = await hashPinServer(cleanPin, newSalt);
        await db.setDoc(
          `users_private/${uid}`,
          {
            pinHash: newHash,
            pinSalt: newSalt,
            twoFactorEnabled: true,
            updatedAt: SERVER_TIMESTAMP_SENTINEL,
          },
          ['pinHash', 'pinSalt', 'twoFactorEnabled', 'updatedAt']
        );
      }

      const customToken = await mintToken(sa, uid, {
        email_verified: true,
        mender_auth: 'quick_email',
      });

      return jsonResponse({
        customToken,
        uid,
        email: normalizedEmail,
        displayName: existingPub?.displayName || resolvedName,
        photoURL: existingPub?.avatarUrl || defaultAvatar,
        pinVerified: true,
      });
    }

    // -----------------------------------------------------------------------
    // POST /api/auth/recovery/challenge
    // -----------------------------------------------------------------------
    if (pathname === '/api/auth/recovery/challenge') {
      const rawIdentifier = String(body.identifier || '').trim();
      if (!rawIdentifier) {
        return jsonResponse({ error: 'Введите ваш @юзернейм, имя или почту' }, 400);
      }

      const { db, sa } = await getAdminContext(env, deps);
      const { uid, pubDoc, privDoc } = await findAccountByIdentifierServer(db, rawIdentifier);

      if (!pubDoc) {
        return jsonResponse({ error: 'Аккаунт с таким @юзернеймом, именем или почтой не найден!' }, 404);
      }

      const randBuf = new Uint32Array(1);
      crypto.getRandomValues(randBuf);
      const otpCode = String(100000 + (randBuf[0] % 900000));
      const expiresAt = Date.now() + 3 * 60 * 1000;

      const otpHash = await sha256Hex(`${uid}:${otpCode}`);
      const challengeToken = await signRecoveryChallengeToken(
        { uid, otpHash, exp: expiresAt },
        getRecoverySecret(env, sa)
      );

      const uname = String(pubDoc.username || 'user');
      const maskedHint =
        uname.length > 2
          ? `@${uname[0]}${'*'.repeat(Math.max(2, uname.length - 2))}${uname[uname.length - 1]}`
          : `@${uname}`;

      // Best-effort notification to the user's Mender Security chat
      try {
        const secChatId = `chat_system_security_${uid}`;
        const chatDoc = await db.getDoc(`chats/${secChatId}`);
        if (chatDoc) {
          const msgId = `msg_sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await db.setDoc(`chats/${secChatId}/messages/${msgId}`, {
            messageId: msgId,
            chatId: secChatId,
            senderId: 'mender_security_bot',
            senderName: 'Mender Безопасность',
            senderAvatar: '/icon.svg',
            recipientId: uid,
            chatVisibility: 'private',
            type: 'text',
            content: `🔐 Запрос восстановления пароля\n• Код подтверждения (3 мин): ${otpCode}`,
            mediaUrl: '',
            duration: 0,
            status: 'delivered',
            likesCount: 0,
            createdAt: SERVER_TIMESTAMP_SENTINEL,
            updatedAt: SERVER_TIMESTAMP_SENTINEL,
          });
        }
      } catch {
        // non-fatal
      }

      return jsonResponse({
        uid,
        maskedHint,
        requires2FaPin: Boolean(privDoc?.pinHash),
        requiresEmailOrUsernameCheck: uname,
        otpCode,
        expiresAt,
        challengeToken,
      });
    }

    // -----------------------------------------------------------------------
    // POST /api/auth/recovery/reset
    // -----------------------------------------------------------------------
    if (pathname === '/api/auth/recovery/reset') {
      const identifier = String(body.identifier || '').trim();
      const newPassword = String(body.newPassword || '');
      const confirmPassword = String(body.confirmPassword || '');
      const otpCode = String(body.otpCode || '').trim();
      const challengeToken = String(body.challengeToken || '');
      const pin2FA = String(body.pin2FA || '').replace(/\D/g, '');
      const ownerConfirmInput = String(body.ownerConfirmInput || '')
        .replace(/^@/, '')
        .trim()
        .toLowerCase();

      if (!identifier || !challengeToken) {
        return jsonResponse({ error: 'Срок действия проверки истёк. Запросите код заново.' }, 400);
      }

      const { db, sa } = await getAdminContext(env, deps);
      const tokenData = await verifyRecoveryChallengeToken(
        challengeToken,
        getRecoverySecret(env, sa)
      );
      if (!tokenData || Date.now() > tokenData.exp) {
        return jsonResponse(
          { error: 'Срок действия 6-значного кода истёк (3 мин). Запросите новый код.' },
          400
        );
      }

      const { uid, normalizedEmail, pubDoc, privDoc } = await findAccountByIdentifierServer(
        db,
        identifier
      );
      if (!pubDoc || uid !== tokenData.uid) {
        return jsonResponse({ error: 'Аккаунт не найден или не соответствует запросу восстановления!' }, 404);
      }

      const submittedHash = await sha256Hex(`${uid}:${otpCode}`);
      if (!otpCode || !constantTimeEqual(submittedHash, tokenData.otpHash)) {
        return jsonResponse({ error: 'Неверный 6-значный код безопасности!' }, 401);
      }

      if (
        !ownerConfirmInput ||
        (ownerConfirmInput !== String(pubDoc.username || '').toLowerCase() &&
          ownerConfirmInput !== String(privDoc?.email || '').toLowerCase())
      ) {
        return jsonResponse({ error: 'Неверно указан контрольный @username или почта владельца!' }, 401);
      }

      if (privDoc?.pinHash && privDoc?.pinSalt) {
        if (pin2FA.length < 4) {
          return jsonResponse({ error: 'На аккаунте включён 2FA PIN-код — введите ваш PIN!' }, 401);
        }
        const pinOk = await verifyPinHashServer(
          pin2FA,
          String(privDoc.pinSalt),
          String(privDoc.pinHash)
        );
        if (!pinOk) {
          return jsonResponse({ error: 'Неверный 2FA PIN-код владельца!' }, 401);
        }
      }

      const strengthErr = validateStrongPasswordServer(newPassword, pubDoc.username);
      if (strengthErr) {
        return jsonResponse({ error: strengthErr }, 400);
      }

      if (newPassword !== confirmPassword) {
        return jsonResponse({ error: 'Новый пароль и подтверждение не совпадают!' }, 400);
      }

      if (privDoc?.passwordHash && privDoc?.passwordSalt) {
        const sameAsOld = await verifyPasswordHashServer(
          newPassword,
          String(privDoc.passwordSalt),
          String(privDoc.passwordHash)
        );
        if (sameAsOld) {
          return jsonResponse({ error: 'Новый пароль не должен совпадать со старым паролем!' }, 400);
        }
      }

      const passwordSalt = generateSaltHex(16);
      const passwordHash = await hashPasswordServer(newPassword, passwordSalt);

      await Promise.all([
        db.setDoc(
          `users_private/${uid}`,
          {
            passwordHash,
            passwordSalt,
            updatedAt: SERVER_TIMESTAMP_SENTINEL,
          },
          ['passwordHash', 'passwordSalt', 'updatedAt']
        ),
        db.setDoc(
          `users/${uid}`,
          { status: 'online', updatedAt: SERVER_TIMESTAMP_SENTINEL },
          ['status', 'updatedAt']
        ),
      ]);

      const customToken = await mintToken(sa, uid, {
        email_verified: true,
        mender_auth: 'recovery_reset',
      });

      return jsonResponse({
        customToken,
        uid,
        email: privDoc?.email || normalizedEmail,
        displayName: pubDoc.displayName,
        photoURL: pubDoc.avatarUrl,
      });
    }

    return jsonResponse({ error: 'Неизвестный API-маршрут' }, 404);
  } catch (err: any) {
    const message = err?.message || 'Внутренняя ошибка сервера авторизации';
    const status = message.includes('SERVER_FIREBASE_CREDENTIALS_NOT_CONFIGURED') ? 503 : 500;
    return jsonResponse({ error: message }, status);
  }
}
