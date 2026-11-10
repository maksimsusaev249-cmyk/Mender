import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { UserPublic, UserPrivate, UserBlock, Subscription, PrivacyLevel, UserStatus } from '../types';
import {
  generateSalt,
  hashPin,
  verifyPinHash,
  hashPassword,
  verifyPasswordHash,
  deriveUidFromEmail,
  sanitizeId,
} from '../utils/crypto';
import { uploadMediaFile } from '../utils/media';

const EMAIL_SESSION_STORAGE_KEY = 'mender_email_session_v1';
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 30000; // 30 seconds lockout after 5 wrong attempts

function getPinVerifiedStorageKey(uid?: string | null): string {
  return uid ? `mender_pin_verified_${uid}` : 'mender_pin_verified';
}

function getPinAttemptsStorageKey(uid?: string | null): string {
  return uid ? `mender_pin_attempts_${uid}` : 'mender_pin_attempts';
}

function getPinLockoutStorageKey(uid?: string | null): string {
  return uid ? `mender_pin_lockout_${uid}` : 'mender_pin_lockout';
}

export type AppThemeMode = 'light' | 'dark' | 'custom';

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
}

interface AuthContextType {
  firebaseUser: SessionUser | FirebaseUser | null;
  profile: UserPublic | null;
  privateData: UserPrivate | null;
  themeMode: AppThemeMode;
  customThemeBgColor: string;
  customThemeBgImage: string;
  customThemeCardTone: 'light' | 'dark';
  setThemeMode: (mode: AppThemeMode) => void;
  setCustomThemeBgColor: (color: string) => void;
  setCustomThemeBgImage: (url: string) => void;
  setCustomThemeCardTone: (tone: 'light' | 'dark') => void;
  blocks: UserBlock[];
  subscriptions: Subscription[];
  isAuthReady: boolean;
  isPinVerified: boolean;
  needsOnboarding: boolean;
  needsPinSetup: boolean;
  failedPinAttempts: number;
  maxPinAttempts: number;
  pinLockoutSecondsLeft: number;
  authError: string | null;
  clearAuthError: () => void;
  loginWithEmailAccount: (email: string, password: string) => Promise<void>;
  registerWithEmailAccount: (params: {
    email: string;
    displayName: string;
    username?: string;
    password: string;
    pin2FA?: string;
  }) => Promise<void>;
  loginWithQuickEmail: (email: string, displayName?: string, pin?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendPhoneOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<void>;
  confirmPhoneOtp: (code: string) => Promise<void>;
  completeOnboardingProfile: (params: {
    displayName: string;
    username: string;
    bio: string;
    phone: string;
    pin: string;
    avatarFile?: File | null;
  }) => Promise<void>;
  changeAccountPassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  setupOrChangePin: (newPin: string, currentPin?: string) => Promise<void>;
  verifySessionPin: (pin: string) => Promise<boolean>;
  resetPinWithReauth: (currentPin?: string) => Promise<void>;
  lockSessionWithPin: () => void;
  updatePublicProfile: (updates: {
    displayName?: string;
    username?: string;
    bio?: string;
    status?: UserStatus;
    privacyLastSeen?: PrivacyLevel;
    privacyPhoto?: PrivacyLevel;
    privacyCalls?: PrivacyLevel;
    avatarFile?: File | null;
  }) => Promise<void>;
  updatePrivatePreferences: (updates: {
    phone?: string;
    darkMode?: boolean;
    notificationsEnabled?: boolean;
    soundEnabled?: boolean;
  }) => Promise<void>;
  blockUser: (targetUid: string, reason?: string) => Promise<void>;
  unblockUser: (targetUid: string) => Promise<void>;
  isUserBlocked: (targetUid: string) => boolean;
  toggleSubscription: (targetId: string, targetType: 'user' | 'channel') => Promise<void>;
  isSubscribed: (targetId: string) => boolean;
  submitReport: (targetId: string, targetType: 'user' | 'chat' | 'post' | 'message', reason: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<SessionUser | FirebaseUser | null>(() => {
    try {
      const saved = localStorage.getItem(EMAIL_SESSION_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as SessionUser;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [privateData, setPrivateData] = useState<UserPrivate | null>(null);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isPinVerified, setIsPinVerified] = useState<boolean>(false);
  const [failedPinAttempts, setFailedPinAttempts] = useState<number>(0);
  const [pinLockoutSecondsLeft, setPinLockoutSecondsLeft] = useState<number>(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [themeMode, setThemeModeState] = useState<AppThemeMode>(() => {
    const saved = localStorage.getItem('mender_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'custom') return saved;
    return 'light';
  });
  const [customThemeBgColor, setCustomThemeBgColorState] = useState<string>(() => {
    return localStorage.getItem('mender_custom_bg_color') || '#1E293B';
  });
  const [customThemeBgImage, setCustomThemeBgImageState] = useState<string>(() => {
    return localStorage.getItem('mender_custom_bg_image') || '';
  });
  const [customThemeCardTone, setCustomThemeCardToneState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mender_custom_card_tone');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const setThemeMode = useCallback(
    (mode: AppThemeMode) => {
      setThemeModeState(mode);
      localStorage.setItem('mender_theme_mode', mode);
      if (firebaseUser) {
        updateDoc(doc(db, 'users_private', firebaseUser.uid), {
          darkMode: mode === 'dark',
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    },
    [firebaseUser]
  );

  const setCustomThemeBgColor = useCallback((color: string) => {
    setCustomThemeBgColorState(color);
    localStorage.setItem('mender_custom_bg_color', color);
    // Automatically pick readable card tone based on color luminance if user hasn't locked it
    const hex = color.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const autoTone = lum < 0.45 ? 'dark' : 'light';
      setCustomThemeCardToneState(autoTone);
      localStorage.setItem('mender_custom_card_tone', autoTone);
    }
  }, []);

  const setCustomThemeBgImage = useCallback((url: string) => {
    setCustomThemeBgImageState(url);
    try {
      localStorage.setItem('mender_custom_bg_image', url);
    } catch {
      // ignore quota if large data URL
    }
  }, []);

  const setCustomThemeCardTone = useCallback((tone: 'light' | 'dark') => {
    setCustomThemeCardToneState(tone);
    localStorage.setItem('mender_custom_card_tone', tone);
  }, []);

  // Apply theme classes & CSS variables to document.body
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    body.classList.remove('theme-light', 'theme-dark', 'theme-custom', 'custom-cards-dark', 'custom-cards-light', 'dark');
    root.classList.remove('dark');

    if (themeMode === 'dark') {
      body.classList.add('theme-dark', 'dark');
      root.classList.add('dark');
      body.style.removeProperty('--custom-app-bg');
      body.style.removeProperty('--custom-app-image');
    } else if (themeMode === 'custom') {
      body.classList.add('theme-custom');
      if (customThemeCardTone === 'dark') {
        body.classList.add('theme-dark', 'custom-cards-dark', 'dark');
        root.classList.add('dark');
      } else {
        body.classList.add('theme-light', 'custom-cards-light');
      }
      body.style.setProperty('--custom-app-bg', customThemeBgColor);
      if (customThemeBgImage) {
        body.style.setProperty('--custom-app-image', `url("${customThemeBgImage}")`);
      } else {
        body.style.removeProperty('--custom-app-image');
      }
    } else {
      body.classList.add('theme-light');
      body.style.removeProperty('--custom-app-bg');
      body.style.removeProperty('--custom-app-image');
    }
  }, [themeMode, customThemeBgColor, customThemeBgImage, customThemeCardTone]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // Load brute-force state and countdown timer for current user
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) {
      setFailedPinAttempts(0);
      setPinLockoutSecondsLeft(0);
      return;
    }

    const savedAttempts = Number(localStorage.getItem(getPinAttemptsStorageKey(uid)) || '0');
    setFailedPinAttempts(Number.isFinite(savedAttempts) ? savedAttempts : 0);

    const updateLockoutTimer = () => {
      const lockoutUntil = Number(localStorage.getItem(getPinLockoutStorageKey(uid)) || '0');
      const now = Date.now();
      if (lockoutUntil > now) {
        setPinLockoutSecondsLeft(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        setPinLockoutSecondsLeft(0);
        if (lockoutUntil > 0) {
          localStorage.removeItem(getPinLockoutStorageKey(uid));
          localStorage.setItem(getPinAttemptsStorageKey(uid), '0');
          setFailedPinAttempts(0);
        }
      }
    };

    updateLockoutTimer();
    const timer = window.setInterval(updateLockoutTimer, 1000);
    return () => clearInterval(timer);
  }, [firebaseUser?.uid]);

  // Listen to Firebase Auth state while preserving Quick Email session if present
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        return;
      }
      try {
        const saved = localStorage.getItem(EMAIL_SESSION_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as SessionUser;
          setFirebaseUser(parsed);
          return;
        }
      } catch {
        // ignore
      }
      setFirebaseUser(null);
      setProfile(null);
      setPrivateData(null);
      setBlocks([]);
      setSubscriptions([]);
      setIsPinVerified(false);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listeners for user profile, private settings, blocks, and subscriptions
  useEffect(() => {
    if (!firebaseUser) return;

    const uid = firebaseUser.uid;
    const publicRef = doc(db, 'users', uid);
    const privateRef = doc(db, 'users_private', uid);

    let publicLoaded = false;
    let privateLoaded = false;

    const checkReady = () => {
      if (publicLoaded && privateLoaded) {
        setIsAuthReady(true);
      }
    };

    const unsubPublic = onSnapshot(
      publicRef,
      snap => {
        if (snap.exists()) {
          setProfile(snap.data() as UserPublic);
        } else {
          setProfile(null);
        }
        publicLoaded = true;
        checkReady();
      },
      err => {
        publicLoaded = true;
        checkReady();
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    );

    const unsubPrivate = onSnapshot(
      privateRef,
      snap => {
        if (snap.exists()) {
          const data = snap.data() as UserPrivate;
          setPrivateData(data);
          if (!data.pinHash) {
            setIsPinVerified(true);
          } else {
            const verifiedInSession =
              sessionStorage.getItem(getPinVerifiedStorageKey(uid)) === 'true';
            setIsPinVerified(verifiedInSession);
          }
        } else {
          setPrivateData(null);
        }
        privateLoaded = true;
        checkReady();
      },
      err => {
        privateLoaded = true;
        checkReady();
        handleFirestoreError(err, OperationType.GET, `users_private/${uid}`);
      }
    );

    const blocksQuery = query(
      collection(db, 'users_private', uid, 'blocks'),
      where('blockerId', '==', uid)
    );
    const unsubBlocks = onSnapshot(
      blocksQuery,
      snap => {
        setBlocks(snap.docs.map(d => d.data() as UserBlock));
      },
      err => handleFirestoreError(err, OperationType.LIST, `users_private/${uid}/blocks`)
    );

    const subsQuery = query(
      collection(db, 'users', uid, 'subscriptions'),
      where('subscriberId', '==', uid)
    );
    const unsubSubs = onSnapshot(
      subsQuery,
      snap => {
        setSubscriptions(snap.docs.map(d => d.data() as Subscription));
      },
      err => handleFirestoreError(err, OperationType.LIST, `users/${uid}/subscriptions`)
    );

    return () => {
      unsubPublic();
      unsubPrivate();
      unsubBlocks();
      unsubSubs();
    };
  }, [firebaseUser?.uid]);

  /**
   * Вход в существующий аккаунт по:
   * - @юзернейму (например: @maksim или maksim)
   * - имени пользователя (например: Максим)
   * - электронной почте (например: user@mail.ru)
   * и обычному паролю (PBKDF2).
   * Если у пользователя включён 2FA PIN-код (twoFactorEnabled && pinHash),
   * после успешной проверки пароля открывается второй шаг — подтверждение 2FA PIN-кодом.
   */
  const loginWithEmailAccount = async (rawIdentifier: string, rawPassword: string) => {
    setAuthError(null);
    const trimmed = rawIdentifier.trim();
    const lowered = trimmed.toLowerCase();
    if (!lowered) {
      const msg = 'Введите @юзернейм, имя или почту';
      setAuthError(msg);
      throw new Error(msg);
    }

    if (!rawPassword || rawPassword.length < 4) {
      const msg = 'Введите пароль от вашего аккаунта';
      setAuthError(msg);
      throw new Error(msg);
    }

    const isEmailFormat = lowered.includes('@') && !lowered.startsWith('@');
    const normalizedEmail = isEmailFormat
      ? lowered
      : `${lowered.replace(/^@/, '')}@mender.app`;
    let uid = await deriveUidFromEmail(normalizedEmail);

    let publicRef = doc(db, 'users', uid);
    let privateRef = doc(db, 'users_private', uid);
    let [pubSnap, privSnap] = await Promise.all([getDoc(publicRef), getDoc(privateRef)]);

    // Если по прямому email профиль не найден — ищем пользователя по @username или по имени (displayName)
    if (!pubSnap.exists()) {
      const cleanUsernameQuery = lowered.replace(/^@/, '').trim();
      const usersQuery = query(
        collection(db, 'users'),
        where('status', 'in', ['online', 'offline', 'busy'])
      );
      const usersSnap = await getDocs(usersQuery);
      const allUsers = usersSnap.docs.map(d => d.data() as UserPublic);

      // 1. Точное совпадение по @username
      let matchedUser = allUsers.find(
        u => u.username && u.username.toLowerCase() === cleanUsernameQuery
      );

      // 2. Точное совпадение по имени (displayName)
      if (!matchedUser) {
        matchedUser = allUsers.find(
          u => u.displayName && u.displayName.trim().toLowerCase() === lowered
        );
      }

      // 3. Совпадение по части имени (например, если введено только имя без фамилии)
      if (!matchedUser && cleanUsernameQuery.length >= 2) {
        matchedUser = allUsers.find(
          u =>
            u.username?.toLowerCase() === cleanUsernameQuery ||
            u.displayName?.trim().toLowerCase().split(/\s+/).includes(lowered) ||
            u.displayName?.trim().toLowerCase().includes(lowered)
        );
      }

      if (matchedUser) {
        uid = matchedUser.uid;
        publicRef = doc(db, 'users', uid);
        privateRef = doc(db, 'users_private', uid);
        [pubSnap, privSnap] = await Promise.all([getDoc(publicRef), getDoc(privateRef)]);
      }
    }

    const lockoutUntil = Number(localStorage.getItem(getPinLockoutStorageKey(uid)) || '0');
    if (lockoutUntil > Date.now()) {
      const sec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      const msg = `Слишком много неверных попыток! Подождите ${sec} сек.`;
      setAuthError(msg);
      throw new Error(msg);
    }

    if (!pubSnap.exists()) {
      const msg =
        'Аккаунт с таким @юзернеймом, именем или почтой не найден! Нажмите «Регистрация», чтобы создать аккаунт.';
      setAuthError(msg);
      throw new Error(msg);
    }

    const existingPub = pubSnap.data() as UserPublic;
    const existingPriv = privSnap.exists() ? (privSnap.data() as UserPrivate) : null;

    // 1. Проверка основного пароля аккаунта
    if (existingPriv?.passwordHash && existingPriv?.passwordSalt) {
      const isPasswordValid = await verifyPasswordHash(
        rawPassword,
        existingPriv.passwordSalt,
        existingPriv.passwordHash
      );
      if (!isPasswordValid) {
        const prevAttempts = Number(localStorage.getItem(getPinAttemptsStorageKey(uid)) || '0');
        const nextAttempts = prevAttempts + 1;
        localStorage.setItem(getPinAttemptsStorageKey(uid), String(nextAttempts));
        setFailedPinAttempts(nextAttempts);

        if (nextAttempts >= MAX_PIN_ATTEMPTS) {
          const until = Date.now() + PIN_LOCKOUT_DURATION_MS;
          localStorage.setItem(getPinLockoutStorageKey(uid), String(until));
          setPinLockoutSecondsLeft(Math.ceil(PIN_LOCKOUT_DURATION_MS / 1000));
          const lockMsg = 'Превышен лимит попыток! Вход заблокирован на 30 секунд.';
          setAuthError(lockMsg);
          throw new Error(lockMsg);
        }

        const left = Math.max(0, MAX_PIN_ATTEMPTS - nextAttempts);
        const errMsg = `Неверный пароль! Осталось попыток: ${left} из ${MAX_PIN_ATTEMPTS}.`;
        setAuthError(errMsg);
        throw new Error(errMsg);
      }
    } else if (existingPriv?.pinHash) {
      // Обратная совместимость для аккаунтов, созданных до разделения пароля и 2FA PIN
      const digitsOnly = rawPassword.replace(/\D/g, '');
      const matchesLegacyPin =
        digitsOnly.length >= 4 &&
        (await verifyPinHash(digitsOnly, existingPriv.pinSalt, existingPriv.pinHash));
      if (!matchesLegacyPin) {
        const prevAttempts = Number(localStorage.getItem(getPinAttemptsStorageKey(uid)) || '0');
        const nextAttempts = prevAttempts + 1;
        localStorage.setItem(getPinAttemptsStorageKey(uid), String(nextAttempts));
        setFailedPinAttempts(nextAttempts);

        if (nextAttempts >= MAX_PIN_ATTEMPTS) {
          const until = Date.now() + PIN_LOCKOUT_DURATION_MS;
          localStorage.setItem(getPinLockoutStorageKey(uid), String(until));
          setPinLockoutSecondsLeft(Math.ceil(PIN_LOCKOUT_DURATION_MS / 1000));
          const lockMsg = 'Превышен лимит попыток! Вход заблокирован на 30 секунд.';
          setAuthError(lockMsg);
          throw new Error(lockMsg);
        }

        const left = Math.max(0, MAX_PIN_ATTEMPTS - nextAttempts);
        const errMsg = `Неверный пароль! Осталось попыток: ${left} из ${MAX_PIN_ATTEMPTS}.`;
        setAuthError(errMsg);
        throw new Error(errMsg);
      }

      const pwdSalt = generateSalt(16);
      const pwdHash = await hashPassword(rawPassword, pwdSalt);
      await updateDoc(privateRef, {
        passwordHash: pwdHash,
        passwordSalt: pwdSalt,
        updatedAt: serverTimestamp(),
      });
    } else if (privSnap.exists() && rawPassword.length >= 6) {
      const pwdSalt = generateSalt(16);
      const pwdHash = await hashPassword(rawPassword, pwdSalt);
      await updateDoc(privateRef, {
        passwordHash: pwdHash,
        passwordSalt: pwdSalt,
        updatedAt: serverTimestamp(),
      });
    }

    localStorage.setItem(getPinAttemptsStorageKey(uid), '0');
    localStorage.removeItem(getPinLockoutStorageKey(uid));
    setFailedPinAttempts(0);

    await updateDoc(publicRef, {
      status: 'online',
      updatedAt: serverTimestamp(),
    });

    const sessionUser: SessionUser = {
      uid,
      email: existingPriv?.email || normalizedEmail,
      displayName: existingPub.displayName,
      photoURL: existingPub.avatarUrl,
      phoneNumber: null,
    };

    localStorage.setItem(EMAIL_SESSION_STORAGE_KEY, JSON.stringify(sessionUser));

    const requires2FaPin = Boolean(existingPriv?.pinHash && existingPriv?.twoFactorEnabled);
    if (requires2FaPin) {
      setIsPinVerified(false);
      sessionStorage.removeItem(getPinVerifiedStorageKey(uid));
    } else {
      setIsPinVerified(true);
      sessionStorage.setItem(getPinVerifiedStorageKey(uid), 'true');
    }

    setFirebaseUser(sessionUser);
  };

  /**
   * Регистрация нового аккаунта по имени, @юзернейму и/или почте с обычным паролем (минимум 6 символов)
   * и необязательным 2FA PIN-кодом (4–8 цифр для двухфакторной аутентификации)
   */
  const registerWithEmailAccount = async (params: {
    email: string;
    displayName: string;
    username?: string;
    password: string;
    pin2FA?: string;
  }) => {
    setAuthError(null);
    const cleanName = params.displayName.trim();
    if (!cleanName) {
      const msg = 'Введите ваше имя';
      setAuthError(msg);
      throw new Error(msg);
    }

    const trimmedEmail = params.email.trim().toLowerCase();
    const rawUsernameInput = (params.username?.trim() || '')
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/[^a-z0-9_]/g, '_');

    const fallbackPrefix = trimmedEmail
      ? trimmedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '_')
      : cleanName
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_') || `user_${Math.floor(1000 + Math.random() * 9000)}`;

    const baseUsername = rawUsernameInput || fallbackPrefix;
    const cleanUsername = (baseUsername.length >= 3 ? baseUsername : `user_${baseUsername}`).slice(
      0,
      40
    );

    if (!params.password || params.password.length < 6) {
      const msg = 'Пароль должен содержать минимум 6 символов (буквы, цифры или спецсимволы)';
      setAuthError(msg);
      throw new Error(msg);
    }

    const cleanPin = (params.pin2FA || '').replace(/\D/g, '');
    if (cleanPin) {
      if (cleanPin.length < 4 || cleanPin.length > 8) {
        const msg = '2FA PIN-код должен содержать от 4 до 8 цифр (или оставьте поле пустым)';
        setAuthError(msg);
        throw new Error(msg);
      }
      if (/^(\d)\1+$/.test(cleanPin) || cleanPin === '1234' || cleanPin === '123456') {
        const msg = 'Слабый 2FA PIN-код! Не используйте одинаковые цифры (0000, 1111) или 1234.';
        setAuthError(msg);
        throw new Error(msg);
      }
    }

    const normalizedEmail = trimmedEmail
      ? trimmedEmail.includes('@')
        ? trimmedEmail
        : `${trimmedEmail}@mender.app`
      : `${cleanUsername}@mender.app`;
    const uid = await deriveUidFromEmail(normalizedEmail);

    const publicRef = doc(db, 'users', uid);
    const privateRef = doc(db, 'users_private', uid);
    const pubSnap = await getDoc(publicRef);

    if (pubSnap.exists()) {
      const msg =
        'Такой аккаунт уже зарегистрирован! Нажмите «Войти» и введите свой пароль.';
      setAuthError(msg);
      throw new Error(msg);
    }

    // Проверяем, не занят ли @username другим пользователем
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('status', 'in', ['online', 'offline', 'busy'])
      );
      const usersSnap = await getDocs(usersQuery);
      const usernameTaken = usersSnap.docs.some(
        d => (d.data() as UserPublic).username?.toLowerCase() === cleanUsername
      );
      if (usernameTaken) {
        const msg = `Юзернейм @${cleanUsername} уже занят. Выберите другой @username или войдите в существующий аккаунт.`;
        setAuthError(msg);
        throw new Error(msg);
      }
    } catch (err: any) {
      if (err?.message?.includes('уже занят')) throw err;
    }

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      cleanName
    )}&background=0077FF&color=fff&bold=true`;

    const passwordSalt = generateSalt(16);
    const passwordHash = await hashPassword(params.password, passwordSalt);

    const pinSalt = cleanPin ? generateSalt(16) : '';
    const pinHash = cleanPin ? await hashPin(cleanPin, pinSalt) : '';

    const publicDoc: UserPublic = {
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const privateDoc: UserPrivate = {
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.set(publicRef, publicDoc);
    batch.set(privateRef, privateDoc);
    await batch.commit();

    const sessionUser: SessionUser = {
      uid,
      email: normalizedEmail,
      displayName: publicDoc.displayName,
      photoURL: publicDoc.avatarUrl,
      phoneNumber: null,
    };

    localStorage.setItem(EMAIL_SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
    setIsPinVerified(true);
    sessionStorage.setItem(getPinVerifiedStorageKey(uid), 'true');
    setFirebaseUser(sessionUser);
  };

  /**
   * Secure Login by Email (legacy helper):
   */
  const loginWithQuickEmail = async (
    rawEmail: string,
    customDisplayName?: string,
    providedPin?: string
  ) => {
    setAuthError(null);
    const trimmed = rawEmail.trim().toLowerCase();
    if (!trimmed) {
      setAuthError('Введите адрес электронной почты');
      throw new Error('Введите адрес электронной почты');
    }

    const cleanPin = providedPin ? providedPin.replace(/\D/g, '') : '';
    if (cleanPin && (cleanPin.length < 4 || cleanPin.length > 8)) {
      const msg = 'Защитный PIN-код должен содержать от 4 до 8 цифр';
      setAuthError(msg);
      throw new Error(msg);
    }

    const normalizedEmail = trimmed.includes('@') ? trimmed : `${trimmed}@mender.app`;
    const uid = await deriveUidFromEmail(normalizedEmail);
    const emailPrefix = normalizedEmail.split('@')[0] || 'user';
    const rawUsername = emailPrefix.replace(/[^a-z0-9_]/g, '_');
    const cleanUsername = (rawUsername.length >= 3 ? rawUsername : `user_${rawUsername}`).slice(
      0,
      40
    );
    const resolvedName = (customDisplayName?.trim() || emailPrefix).slice(0, 80);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      resolvedName
    )}&background=4f46e5&color=fff&bold=true`;

    try {
      const publicRef = doc(db, 'users', uid);
      const privateRef = doc(db, 'users_private', uid);
      const [pubSnap, privSnap] = await Promise.all([getDoc(publicRef), getDoc(privateRef)]);

      const existingPrivate = privSnap.exists() ? (privSnap.data() as UserPrivate) : null;
      const existingHasPin = Boolean(existingPrivate?.pinHash);

      // Check if existing account has a PIN and user entered a PIN on the login form
      let verifiedNow = false;
      if (existingHasPin && existingPrivate) {
        if (cleanPin) {
          const valid = await verifyPinHash(
            cleanPin,
            existingPrivate.pinSalt,
            existingPrivate.pinHash
          );
          if (!valid) {
            const msg = 'Неверный защитный PIN-код для этого аккаунта!';
            setAuthError(msg);
            throw new Error(msg);
          }
          verifiedNow = true;
        } else {
          // Account has a PIN, so session starts LOCKED until PIN is verified on the lock screen
          verifiedNow = false;
        }
      } else {
        // New account or account without a PIN yet
        verifiedNow = true;
      }

      const batch = writeBatch(db);

      if (!pubSnap.exists()) {
        const publicDoc: UserPublic = {
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(publicRef, publicDoc);
      } else {
        batch.update(publicRef, {
          status: 'online',
          updatedAt: serverTimestamp(),
        });
      }

      if (!privSnap.exists()) {
        const newSalt = cleanPin ? generateSalt(16) : '';
        const newHash = cleanPin ? await hashPin(cleanPin, newSalt) : '';
        const privateDoc: UserPrivate = {
          uid,
          email: normalizedEmail.slice(0, 254),
          phone: '',
          pinHash: newHash,
          pinSalt: newSalt,
          darkMode: true,
          notificationsEnabled: true,
          soundEnabled: true,
          twoFactorEnabled: Boolean(newHash),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(privateRef, privateDoc);
      } else if (!existingHasPin && cleanPin) {
        // Upgrade existing account without PIN if user entered a new PIN during login
        const newSalt = generateSalt(16);
        const newHash = await hashPin(cleanPin, newSalt);
        batch.update(privateRef, {
          pinHash: newHash,
          pinSalt: newSalt,
          twoFactorEnabled: true,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      const existingPub = pubSnap.exists() ? (pubSnap.data() as UserPublic) : null;
      const sessionUser: SessionUser = {
        uid,
        email: normalizedEmail,
        displayName: existingPub?.displayName || resolvedName,
        photoURL: existingPub?.avatarUrl || defaultAvatar,
        phoneNumber: null,
      };

      localStorage.setItem(EMAIL_SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
      if (verifiedNow) {
        setIsPinVerified(true);
        sessionStorage.setItem(getPinVerifiedStorageKey(uid), 'true');
      } else {
        setIsPinVerified(false);
        sessionStorage.removeItem(getPinVerifiedStorageKey(uid));
      }
      setFirebaseUser(sessionUser);
    } catch (err: any) {
      setAuthError(err?.message || 'Не удалось выполнить вход по почте');
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setAuthError(err?.message || 'Ошибка входа через Google');
      throw err;
    }
  };

  const sendPhoneOtp = async (phoneNumber: string, recaptchaContainerId: string) => {
    setAuthError(null);
    try {
      const existingVerifier = (window as any).recaptchaVerifier;
      if (existingVerifier) {
        try {
          existingVerifier.clear();
        } catch {
          // ignore
        }
      }
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: 'invisible',
      });
      (window as any).recaptchaVerifier = verifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(result);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/billing-not-enabled') {
        setAuthError(
          'Провайдер SMS-аутентификации (Phone Auth) ещё не включён в вашей консоли Firebase. Используйте вход по почте с защитным PIN-кодом.'
        );
      } else {
        setAuthError(err?.message || 'Не удалось отправить SMS-код');
      }
      throw err;
    }
  };

  const confirmPhoneOtp = async (code: string) => {
    setAuthError(null);
    if (!confirmationResult) {
      setAuthError('Сначала запросите SMS-код');
      return;
    }
    try {
      await confirmationResult.confirm(code);
    } catch (err: any) {
      setAuthError(err?.message || 'Неверный код подтверждения');
      throw err;
    }
  };

  const completeOnboardingProfile = async (params: {
    displayName: string;
    username: string;
    bio: string;
    phone: string;
    pin: string;
    avatarFile?: File | null;
  }) => {
    if (!firebaseUser) throw new Error('Пользователь не авторизован');
    setAuthError(null);

    const uid = firebaseUser.uid;
    const cleanUsername = params.username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 40);

    if (cleanUsername.length < 3) {
      throw new Error(
        'Имя пользователя (username) должно содержать минимум 3 символа (латиница, цифры, _)'
      );
    }

    let avatarUrl =
      firebaseUser.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        params.displayName.trim()
      )}&background=4f46e5&color=fff&bold=true`;

    if (params.avatarFile) {
      avatarUrl = await uploadMediaFile(params.avatarFile, uid, 'avatars', params.avatarFile.name);
    }

    const salt = generateSalt(16);
    const pinHash = params.pin ? await hashPin(params.pin, salt) : '';

    const publicDoc: UserPublic = {
      uid,
      displayName: params.displayName.trim().slice(0, 80),
      username: cleanUsername,
      avatarUrl: avatarUrl.slice(0, 2000),
      bio: (params.bio || 'В сети Mender').trim().slice(0, 500),
      status: 'online',
      privacyLastSeen: 'everyone',
      privacyPhoto: 'everyone',
      privacyCalls: 'everyone',
      followersCount: 0,
      followingCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const privateDoc: UserPrivate = {
      uid,
      email: (firebaseUser.email || '').slice(0, 254),
      phone: (params.phone || firebaseUser.phoneNumber || '').trim().slice(0, 32),
      pinHash,
      pinSalt: salt,
      darkMode: true,
      notificationsEnabled: true,
      soundEnabled: true,
      twoFactorEnabled: Boolean(pinHash),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), publicDoc);
      batch.set(doc(db, 'users_private', uid), privateDoc);
      await batch.commit();
      setIsPinVerified(true);
      sessionStorage.setItem(getPinVerifiedStorageKey(uid), 'true');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
    }
  };

  /**
   * Установка или смена основного пароля аккаунта (с обязательной проверкой текущего пароля, если он уже задан)
   */
  const changeAccountPassword = async (newPassword: string, currentPassword?: string) => {
    if (!firebaseUser || !privateData) return;
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Новый пароль должен содержать минимум 6 символов');
    }

    if (privateData.passwordHash && privateData.passwordSalt) {
      if (!currentPassword) {
        throw new Error('Для смены пароля введите текущий пароль');
      }
      const isCurrentValid = await verifyPasswordHash(
        currentPassword,
        privateData.passwordSalt,
        privateData.passwordHash
      );
      if (!isCurrentValid) {
        throw new Error('Неверный текущий пароль! Изменение отклонено.');
      }
    }

    const passwordSalt = generateSalt(16);
    const passwordHash = await hashPassword(newPassword, passwordSalt);

    try {
      await updateDoc(doc(db, 'users_private', firebaseUser.uid), {
        passwordHash,
        passwordSalt,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users_private/${firebaseUser.uid}`);
    }
  };

  /**
   * Setup a new 2FA PIN or change an existing 2FA PIN.
   * If a PIN is already set (`privateData.pinHash`), requires verifying `currentPin` first!
   */
  const setupOrChangePin = async (newPin: string, currentPin?: string) => {
    if (!firebaseUser || !privateData) return;
    const cleanNewPin = newPin.replace(/\D/g, '');
    if (cleanNewPin.length < 4 || cleanNewPin.length > 8) {
      throw new Error('Новый PIN-код должен содержать от 4 до 8 цифр');
    }

    // Reject trivial sequential/repeated PINs like 0000, 1111, 1234
    if (/^(\d)\1+$/.test(cleanNewPin) || cleanNewPin === '1234' || cleanNewPin === '123456') {
      throw new Error(
        'Слабый PIN-код! Не используйте одинаковые цифры (0000, 1111) или 1234.'
      );
    }

    if (privateData.pinHash) {
      if (!currentPin) {
        throw new Error('Для изменения защиты необходимо ввести текущий PIN-код');
      }
      const isCurrentValid = await verifyPinHash(
        currentPin.replace(/\D/g, ''),
        privateData.pinSalt,
        privateData.pinHash
      );
      if (!isCurrentValid) {
        throw new Error('Неверный текущий PIN-код! Изменение отклонено.');
      }
    }

    const salt = generateSalt(16);
    const pinHash = await hashPin(cleanNewPin, salt);

    try {
      await updateDoc(doc(db, 'users_private', firebaseUser.uid), {
        pinHash,
        pinSalt: salt,
        twoFactorEnabled: true,
        updatedAt: serverTimestamp(),
      });
      setIsPinVerified(true);
      sessionStorage.setItem(getPinVerifiedStorageKey(firebaseUser.uid), 'true');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users_private/${firebaseUser.uid}`);
    }
  };

  /**
   * Verify PIN on Lock Screen with Brute-Force Protection (5 attempts max, then 30s lockout)
   */
  const verifySessionPin = async (pin: string): Promise<boolean> => {
    if (!privateData || !firebaseUser) return false;
    const uid = firebaseUser.uid;

    const lockoutUntil = Number(localStorage.getItem(getPinLockoutStorageKey(uid)) || '0');
    if (lockoutUntil > Date.now()) {
      return false;
    }

    const isValid = await verifyPinHash(pin, privateData.pinSalt, privateData.pinHash);
    if (isValid) {
      localStorage.setItem(getPinAttemptsStorageKey(uid), '0');
      localStorage.removeItem(getPinLockoutStorageKey(uid));
      setFailedPinAttempts(0);
      setPinLockoutSecondsLeft(0);
      setIsPinVerified(true);
      sessionStorage.setItem(getPinVerifiedStorageKey(uid), 'true');

      // Transparently upgrade legacy SHA-256 hash to PBKDF2-HMAC-SHA256 (100,000 iterations)
      if (!privateData.pinHash.startsWith('pbkdf2_v3$')) {
        try {
          const newSalt = generateSalt(16);
          const upgradedHash = await hashPin(pin, newSalt);
          await updateDoc(doc(db, 'users_private', uid), {
            pinHash: upgradedHash,
            pinSalt: newSalt,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // ignore background hash upgrade failure
        }
      }
      return true;
    }

    // Increment failed attempts counter
    const nextAttempts = failedPinAttempts + 1;
    setFailedPinAttempts(nextAttempts);
    localStorage.setItem(getPinAttemptsStorageKey(uid), String(nextAttempts));

    if (nextAttempts >= MAX_PIN_ATTEMPTS) {
      const until = Date.now() + PIN_LOCKOUT_DURATION_MS;
      localStorage.setItem(getPinLockoutStorageKey(uid), String(until));
      setPinLockoutSecondsLeft(Math.ceil(PIN_LOCKOUT_DURATION_MS / 1000));
    }

    return false;
  };

  /**
   * Disable PIN protection — strictly requires verifying `currentPin` first!
   */
  const resetPinWithReauth = async (currentPin?: string) => {
    if (!firebaseUser || !privateData) return;
    if (privateData.pinHash) {
      if (!currentPin) {
        throw new Error('Для отключения защиты необходимо ввести текущий PIN-код');
      }
      const isCurrentValid = await verifyPinHash(
        currentPin.replace(/\D/g, ''),
        privateData.pinSalt,
        privateData.pinHash
      );
      if (!isCurrentValid) {
        throw new Error('Неверный текущий PIN-код! Отключение защиты запрещено.');
      }
    }

    try {
      await updateDoc(doc(db, 'users_private', firebaseUser.uid), {
        pinHash: '',
        pinSalt: '',
        twoFactorEnabled: false,
        updatedAt: serverTimestamp(),
      });
      setIsPinVerified(true);
      sessionStorage.setItem(getPinVerifiedStorageKey(firebaseUser.uid), 'true');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users_private/${firebaseUser.uid}`);
    }
  };

  const lockSessionWithPin = () => {
    if (privateData?.pinHash && firebaseUser) {
      setIsPinVerified(false);
      sessionStorage.removeItem(getPinVerifiedStorageKey(firebaseUser.uid));
    }
  };

  const updatePublicProfile = async (updates: {
    displayName?: string;
    username?: string;
    bio?: string;
    status?: UserStatus;
    privacyLastSeen?: PrivacyLevel;
    privacyPhoto?: PrivacyLevel;
    privacyCalls?: PrivacyLevel;
    avatarFile?: File | null;
  }) => {
    if (!firebaseUser || !profile) return;
    const uid = firebaseUser.uid;

    let avatarUrl = profile.avatarUrl;
    if (updates.avatarFile) {
      avatarUrl = await uploadMediaFile(
        updates.avatarFile,
        uid,
        'avatars',
        updates.avatarFile.name
      );
    }

    const cleanUsername = updates.username
      ? updates.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40)
      : profile.username;

    try {
      await updateDoc(doc(db, 'users', uid), {
        displayName: (updates.displayName ?? profile.displayName).trim().slice(0, 80),
        username: cleanUsername.length >= 3 ? cleanUsername : profile.username,
        avatarUrl: avatarUrl.slice(0, 2000),
        bio: (updates.bio ?? profile.bio).trim().slice(0, 500),
        status: updates.status ?? profile.status,
        privacyLastSeen: updates.privacyLastSeen ?? profile.privacyLastSeen,
        privacyPhoto: updates.privacyPhoto ?? profile.privacyPhoto,
        privacyCalls: updates.privacyCalls ?? profile.privacyCalls,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const updatePrivatePreferences = async (updates: {
    phone?: string;
    darkMode?: boolean;
    notificationsEnabled?: boolean;
    soundEnabled?: boolean;
  }) => {
    if (!firebaseUser || !privateData) return;
    const uid = firebaseUser.uid;

    setPrivateData(prev =>
      prev
        ? {
            ...prev,
            phone: (updates.phone ?? prev.phone).trim().slice(0, 32),
            darkMode: updates.darkMode ?? prev.darkMode,
            notificationsEnabled: updates.notificationsEnabled ?? prev.notificationsEnabled,
            soundEnabled: updates.soundEnabled ?? prev.soundEnabled,
          }
        : prev
    );

    try {
      await updateDoc(doc(db, 'users_private', uid), {
        phone: (updates.phone ?? privateData.phone).trim().slice(0, 32),
        darkMode: updates.darkMode ?? privateData.darkMode,
        notificationsEnabled: updates.notificationsEnabled ?? privateData.notificationsEnabled,
        soundEnabled: updates.soundEnabled ?? privateData.soundEnabled,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users_private/${uid}`);
    }
  };

  const blockUser = async (targetUid: string, reason = 'Заблокирован пользователем') => {
    if (!firebaseUser || targetUid === firebaseUser.uid) return;
    const uid = firebaseUser.uid;
    const cleanTarget = sanitizeId(targetUid);
    try {
      await setDoc(doc(db, 'users_private', uid, 'blocks', cleanTarget), {
        blockerId: uid,
        blockedUserId: cleanTarget,
        reason: reason.slice(0, 200),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users_private/${uid}/blocks/${cleanTarget}`);
    }
  };

  const unblockUser = async (targetUid: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const cleanTarget = sanitizeId(targetUid);
    try {
      await deleteDoc(doc(db, 'users_private', uid, 'blocks', cleanTarget));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users_private/${uid}/blocks/${cleanTarget}`);
    }
  };

  const isUserBlocked = useCallback(
    (targetUid: string) => blocks.some(b => b.blockedUserId === targetUid),
    [blocks]
  );

  const isSubscribed = useCallback(
    (targetId: string) => subscriptions.some(s => s.targetId === targetId),
    [subscriptions]
  );

  const toggleSubscription = async (targetId: string, targetType: 'user' | 'channel') => {
    if (!firebaseUser || !profile) return;
    const uid = firebaseUser.uid;
    const cleanTarget = sanitizeId(targetId);
    const subRef = doc(db, 'users', uid, 'subscriptions', cleanTarget);
    const userRef = doc(db, 'users', uid);

    try {
      const existingSub = subscriptions.find(s => s.targetId === cleanTarget);
      const batch = writeBatch(db);
      if (existingSub) {
        batch.delete(subRef);
        batch.update(userRef, {
          followingCount: Math.max(0, (profile.followingCount || 1) - 1),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(subRef, {
          subscriberId: uid,
          targetId: cleanTarget,
          targetType,
          createdAt: serverTimestamp(),
        });
        batch.update(userRef, {
          followingCount: (profile.followingCount || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/subscriptions/${cleanTarget}`);
    }
  };

  const submitReport = async (
    targetId: string,
    targetType: 'user' | 'chat' | 'post' | 'message',
    reason: string
  ) => {
    if (!firebaseUser) return;
    const reportId = sanitizeId(`rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    try {
      await setDoc(doc(db, 'reports', reportId), {
        reportId,
        reporterId: firebaseUser.uid,
        targetId: sanitizeId(targetId),
        targetType,
        reason: reason.trim().slice(0, 1000),
        status: 'open',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
    }
  };

  const logout = async () => {
    const uid = firebaseUser?.uid;
    if (firebaseUser && profile) {
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          status: 'offline',
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore offline status update error during logout
      }
    }
    localStorage.removeItem(EMAIL_SESSION_STORAGE_KEY);
    if (uid) {
      sessionStorage.removeItem(getPinVerifiedStorageKey(uid));
    }
    sessionStorage.removeItem('mender_pin_verified');
    setFirebaseUser(null);
    setProfile(null);
    setPrivateData(null);
    setIsPinVerified(false);
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
  };

  const needsOnboarding = Boolean(firebaseUser && isAuthReady && (!profile || !privateData));
  const needsPinSetup = false;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        privateData,
        themeMode,
        customThemeBgColor,
        customThemeBgImage,
        customThemeCardTone,
        setThemeMode,
        setCustomThemeBgColor,
        setCustomThemeBgImage,
        setCustomThemeCardTone,
        blocks,
        subscriptions,
        isAuthReady,
        isPinVerified,
        needsOnboarding,
        needsPinSetup,
        failedPinAttempts,
        maxPinAttempts: MAX_PIN_ATTEMPTS,
        pinLockoutSecondsLeft,
        authError,
        clearAuthError,
        loginWithEmailAccount,
        registerWithEmailAccount,
        loginWithQuickEmail,
        loginWithGoogle,
        sendPhoneOtp,
        confirmPhoneOtp,
        completeOnboardingProfile,
        changeAccountPassword,
        setupOrChangePin,
        verifySessionPin,
        resetPinWithReauth,
        lockSessionWithPin,
        updatePublicProfile,
        updatePrivatePreferences,
        blockUser,
        unblockUser,
        isUserBlocked,
        toggleSubscription,
        isSubscribed,
        submitReport,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
