import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { handleApiRequest } from '../server/apiRouter';
import {
  FirestoreRestClient,
  ServiceAccountCredentials,
  createFirebaseCustomToken,
} from '../server/firebaseAdminRest';
import { dirtyDozenTestCases } from '../firestore.rules.test';

const root = path.resolve(process.cwd());

async function generateEphemeralServiceAccount(): Promise<{
  sa: ServiceAccountCredentials;
  publicKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const b64 = Buffer.from(pkcs8).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
  return {
    sa: {
      project_id: 'optical-quill-dcf5x',
      client_email: 'firebase-adminsdk-test@optical-quill-dcf5x.iam.gserviceaccount.com',
      private_key: pem,
    },
    publicKey: keyPair.publicKey,
  };
}

class InMemoryFirestoreRest {
  public docs = new Map<string, Record<string, any>>();

  asClient(): FirestoreRestClient {
    const store = this.docs;
    const mockClient = {
      async getDoc(docPath: string) {
        return store.has(docPath) ? structuredClone(store.get(docPath)!) : null;
      },
      async setDoc(docPath: string, data: Record<string, unknown>, mergeFields?: string[]) {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && '__serverTimestamp' in v) {
            clean[k] = new Date().toISOString();
          } else {
            clean[k] = v;
          }
        }
        if (mergeFields && store.has(docPath)) {
          const prev = store.get(docPath)!;
          store.set(docPath, { ...prev, ...clean });
        } else if (!mergeFields) {
          store.set(docPath, clean);
        } else {
          store.set(docPath, clean);
        }
      },
      async runStructuredQuery(
        collectionId: string,
        fieldPath?: string,
        op?: 'EQUAL' | 'IN',
        value?: unknown
      ) {
        const out: Record<string, any>[] = [];
        for (const [docPath, val] of store.entries()) {
          if (!docPath.startsWith(`${collectionId}/`)) continue;
          if (!fieldPath || !op) {
            out.push(structuredClone(val));
            continue;
          }
          const fieldVal = val[fieldPath];
          if (op === 'EQUAL' && fieldVal === value) {
            out.push(structuredClone(val));
          } else if (op === 'IN' && Array.isArray(value) && value.includes(fieldVal)) {
            out.push(structuredClone(val));
          }
        }
        return out;
      },
    };
    return mockClient as unknown as FirestoreRestClient;
  }
}

async function verifyJwtSignature(jwt: string, publicKey: CryptoKey) {
  const parts = jwt.split('.');
  assert.equal(parts.length, 3, 'JWT must have 3 segments');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  const sig = Buffer.from(parts[2], 'base64url');
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    sig,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  assert.equal(ok, true, 'RS256 Custom Token signature must verify cryptographically');
  return { header, payload };
}

async function testRulesStaticHardening() {
  const fsRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const stRules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');

  // 1. Critical Auth Bypasses Must Be Gone
  assert.equal(fsRules.includes('request.auth != null || request.time != null'), false, 'isSignedIn bypass must be removed');
  assert.equal(fsRules.includes('email_verified == true) || request.time != null'), false, 'isVerified bypass must be removed');
  assert.equal(fsRules.includes('request.auth == null ||'), false, 'isOwner request.auth==null bypass must be removed');
  assert.equal(fsRules.includes("userId.matches('^usr_.*')"), false, 'isOwner usr_.* bypass must be removed');

  // 2. Verify hardened rules presence
  assert.match(fsRules, /function isSignedIn\(\)\s*\{\s*return request\.auth != null && isValidId\(request\.auth\.uid\);/);
  assert.match(fsRules, /sign_in_provider in \['phone', 'custom'\]/);
  assert.match(fsRules, /function isOwner\(userId\)\s*\{\s*return isSignedIn\(\) && isValidId\(userId\) && request\.auth\.uid == userId;/);
  assert.match(fsRules, /isOwner\(existing\(\)\.callerId\) \|\| isOwner\(existing\(\)\.calleeId\)/);
  assert.match(fsRules, /isOwner\(existing\(\)\.authorId\) && incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(\['content', 'visibility', 'updatedAt'\]\)/);
  assert.match(fsRules, /isOwner\(existing\(\)\.senderId\)\s*&& incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(\['content', 'updatedAt'\]\)/);
  assert.match(fsRules, /exists\(\/databases\/\$\(database\)\/documents\/chats\/\$\(chatId\)\)/);

  // 3. Ensure NO allow list block contains get( or exists(
  const listMatches = fsRules.match(/allow list:[\s\S]*?;/g) || [];
  assert.ok(listMatches.length >= 10, 'Expected multiple allow list rules');
  for (const rule of listMatches) {
    assert.equal(/\b(get|exists|getAfter|existsAfter)\(/.test(rule), false, `allow list must not use get()/exists(): ${rule}`);
  }

  // 4. Storage Rules Checks
  assert.match(stRules, /match \/mender_videos\/\{userId\}\/\{fileName\}/);
  assert.match(stRules, /match \/mender_music\/\{userId\}\/\{fileName\}/);
  assert.match(stRules, /150 \* 1024 \* 1024/);
  assert.match(stRules, /50 \* 1024 \* 1024/);
  assert.match(stRules, /15 \* 1024 \* 1024/);
  assert.equal(stRules.includes("contentType.matches('image/.*')"), false, 'Wildcard image/* allowing SVG must not be used');

  // 5. Ensure Dirty Dozen list has all 12 cases covered
  assert.equal(dirtyDozenTestCases.length, 12, 'All 12 Dirty Dozen cases must exist');

  console.log('✅ [1/4] Static security audit on firestore.rules & storage.rules passed (all bypasses removed, Dirty Dozen guards present)');
}

function testVersionSynchronization() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'));
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  const apkInfo = JSON.parse(fs.readFileSync(path.join(root, 'public/apk-build-info.json'), 'utf8'));
  const buildScript = fs.readFileSync(path.join(root, 'scripts/build-apk-lite.mjs'), 'utf8');
  const versionTs = fs.readFileSync(path.join(root, 'src/version.ts'), 'utf8');

  assert.equal(pkg.version, '7.5.0');
  assert.equal(manifest.version, '7.5.0-lite');
  assert.match(manifest.name, /7\.5\.0/);
  assert.match(sw, /APP_SW_VERSION = 'v7\.5\.0-lite-b10'/);
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.equal(apkInfo.version, '7.5.0-lite');
  assert.equal(apkInfo.buildNumber, 10);
  assert.match(buildScript, /versionCode="10"/);
  assert.match(buildScript, /versionName="7\.5\.0-lite"/);
  assert.match(versionTs, /APP_VERSION = '7\.5\.0'/);
  assert.match(versionTs, /APP_BUILD_NUMBER = 10/);

  console.log('✅ [2/4] Version synchronization across package.json, version.ts, sw.js, manifest.json, apk-build-info.json, and APK builder verified (v7.5.0 / Build #10)');
}

async function testCustomAuthAndRecoveryApi() {
  const { sa, publicKey } = await generateEphemeralServiceAccount();
  const memDb = new InMemoryFirestoreRest();
  const env = {
    FIREBASE_PROJECT_ID: 'optical-quill-dcf5x',
    AUTH_CHALLENGE_SECRET: 'test-hmac-secret-mender-750',
    TURN_URLS: 'turn:turn.mender.kz:3478?transport=udp,turns:turn.mender.kz:5349?transport=tcp',
    TURN_SECRET: 'super-secret-coturn-key',
  };
  const deps = {
    createFirestore: async () => ({
      db: memDb.asClient(),
      sa,
      projectId: env.FIREBASE_PROJECT_ID,
    }),
    mintCustomToken: createFirebaseCustomToken,
    verifyIdToken: async (token: string) => (token === 'valid-id-token' ? { uid: 'uid_caller_1' } : null),
  };

  // A. Health check
  const healthRes = await handleApiRequest(new Request('https://mender.pages.dev/api/health'), {
    ...env,
    FIREBASE_CLIENT_EMAIL: sa.client_email,
    FIREBASE_PRIVATE_KEY: sa.private_key,
  });
  const healthBody = (await healthRes.json()) as any;
  assert.equal(healthRes.status, 200);
  assert.equal(healthBody.version, '7.5.0');
  assert.equal(healthBody.customAuthConfigured, true);
  assert.equal(healthBody.turnConfigured, true);

  // B. Register new account with password + 2FA PIN
  const regRes = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'almaty@example.kz',
        displayName: 'Асет Алматы',
        username: 'aset_kz',
        password: 'Password123',
        pin2FA: '4829',
      }),
    }),
    env,
    deps
  );
  assert.equal(regRes.status, 200);
  const regJson = (await regRes.json()) as any;
  assert.ok(regJson.customToken);
  const regJwt = await verifyJwtSignature(regJson.customToken, publicKey);
  assert.equal(regJwt.payload.uid, regJson.uid);
  assert.equal(regJwt.payload.claims.email_verified, true);

  // Duplicate register rejected
  const dupRes = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'other@example.kz',
        displayName: 'Clone',
        username: 'aset_kz',
        password: 'Password123',
      }),
    }),
    env,
    deps
  );
  assert.equal(dupRes.status, 409);

  // C. Wrong password rejected, valid @username login returns signed custom token + requires2FaPin
  const badLogin = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '@aset_kz', password: 'WrongPassword' }),
    }),
    env,
    deps
  );
  assert.equal(badLogin.status, 401);

  const okLogin = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '@aset_kz', password: 'Password123' }),
    }),
    env,
    deps
  );
  assert.equal(okLogin.status, 200);
  const loginJson = (await okLogin.json()) as any;
  assert.equal(loginJson.requires2FaPin, true);
  await verifyJwtSignature(loginJson.customToken, publicKey);

  // D. Quick Email MUST NOT bypass password/PIN-protected accounts
  const quickBypass = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/quick-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'almaty@example.kz' }),
    }),
    env,
    deps
  );
  assert.equal(quickBypass.status, 403);

  // Quick Email PIN-only account requires valid PIN
  const qCreate = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/quick-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pinonly@mender.app', displayName: 'Pin User', pin: '7391' }),
    }),
    env,
    deps
  );
  assert.equal(qCreate.status, 200);

  const qNoPin = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/quick-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pinonly@mender.app' }),
    }),
    env,
    deps
  );
  assert.equal(qNoPin.status, 403);

  const qWrongPin = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/quick-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pinonly@mender.app', pin: '9999' }),
    }),
    env,
    deps
  );
  assert.equal(qWrongPin.status, 401);

  // E. Password recovery challenge + reset
  const challRes = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/recovery/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'aset_kz' }),
    }),
    env,
    deps
  );
  assert.equal(challRes.status, 200);
  const chall = (await challRes.json()) as any;
  assert.ok(chall.challengeToken);

  // Tampered token rejected
  const forgedReset = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/recovery/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'aset_kz',
        newPassword: 'NewStrongPassword99',
        confirmPassword: 'NewStrongPassword99',
        otpCode: chall.otpCode,
        challengeToken: chall.challengeToken + 'x',
        pin2FA: '4829',
        ownerConfirmInput: 'aset_kz',
      }),
    }),
    env,
    deps
  );
  assert.equal(forgedReset.status, 400);

  // Valid reset succeeds and login with new password works
  const okReset = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/recovery/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'aset_kz',
        newPassword: 'NewStrongPassword99',
        confirmPassword: 'NewStrongPassword99',
        otpCode: chall.otpCode,
        challengeToken: chall.challengeToken,
        pin2FA: '4829',
        ownerConfirmInput: 'aset_kz',
      }),
    }),
    env,
    deps
  );
  assert.equal(okReset.status, 200);
  const resetJson = (await okReset.json()) as any;
  await verifyJwtSignature(resetJson.customToken, publicKey);

  const loginNewPwd = await handleApiRequest(
    new Request('https://mender.pages.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'aset_kz', password: 'NewStrongPassword99' }),
    }),
    env,
    deps
  );
  assert.equal(loginNewPwd.status, 200);

  console.log('✅ [3/4] Firebase Custom Auth API (/login, /register, /quick-email, /recovery/*) & RS256 token verification passed');

  // F. Dynamic TURN credentials endpoint
  const unauthTurn = await handleApiRequest(
    new Request('https://mender.pages.dev/api/turn-credentials'),
    env,
    deps
  );
  assert.equal(unauthTurn.status, 401);

  const coturnRes = await handleApiRequest(
    new Request('https://mender.pages.dev/api/turn-credentials', {
      headers: { Authorization: 'Bearer valid-id-token' },
    }),
    env,
    deps
  );
  assert.equal(coturnRes.status, 200);
  const coturnData = (await coturnRes.json()) as any;
  assert.equal(coturnData.provider, 'coturn-hmac');
  assert.ok(coturnData.iceServers.some((s: any) => String(s.urls).includes('turn:') && s.username && s.credential));

  const cfTurnRes = await handleApiRequest(
    new Request('https://mender.pages.dev/api/turn-credentials', {
      headers: { Authorization: 'Bearer valid-id-token' },
    }),
    { ...env, CF_TURN_TOKEN_ID: 'cf_key_1', CF_TURN_API_TOKEN: 'cf_tok_1' },
    {
      ...deps,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            iceServers: [
              {
                urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:3478?transport=udp'],
                username: 'cf_u',
                credential: 'cf_p',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    }
  );
  assert.equal(cfTurnRes.status, 200);
  const cfTurnData = (await cfTurnRes.json()) as any;
  assert.equal(cfTurnData.provider, 'cloudflare-turn');
  assert.ok(cfTurnData.iceServers.some((s: any) => JSON.stringify(s.urls).includes('turn.cloudflare.com')));

  console.log('✅ [4/4] WebRTC TURN credentials endpoint (unauthenticated reject, coturn HMAC-SHA1, Cloudflare Calls TURN) passed');
}

async function main() {
  await testRulesStaticHardening();
  testVersionSynchronization();
  await testCustomAuthAndRecoveryApi();
  console.log('\n🎉 All Mender v7.5.0 security, version, Custom Auth, and TURN verification checks passed.');
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
