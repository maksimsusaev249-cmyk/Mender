import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithPhoneNumber,
  signInWithCustomToken,
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
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { UserPublic, UserPrivate, UserBlock, Subscription, PrivacyLevel, UserStatus, UserSessionDoc } from '../types';
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
import { sendSystemLoginSecurityNotification, getDeviceDetailsString } from '../utils/securityNotifications';

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
  changeAccountPassword: (
    newPassword: string,
    currentPassword?: string,
    confirmPassword?: string,
    isRecoveryAfter5Attempts?: boolean,
    securityVerification?: {
      otpCode: string;
      expectedOtpCode: string;
      pin2FA?: string;
      confirmUsername?: string;
    }
  ) => Promise<void>;
  requestPasswordRecoveryChallenge: (identifier: string) => Promise<{
    uid: string;
    maskedHint: string;
    requires2FaPin: boolean;
    requiresEmailOrUsernameCheck: string;
    otpCode: string;
    expiresAt: number;
  }>;
  resetForgottenPassword: (params: {
    identifier: string;
    newPassword: string;
    confirmPassword: string;
    otpCode: string;
    expectedOtpCode: string;
    otpExpiresAt: number;
    pin2FA?: string;
    ownerConfirmInput?: string;
  }) => Promise<void>;
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
  submitReport: (
    targetId: string,
    targetType: 'user' | 'chat' | 'post' | 'message' | 'video' | 'video_comment',
    reason: string
  ) => Promise<void>;
  userSessions: UserSessionDoc[];
  currentSessionId: string;
  terminateSession: (sessionId: string) => Promise<void>;
  terminateAllOtherSessions: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<SessionUser | FirebaseUser | null>(null);
  const recoveryChallengeTokensRef = React.useRef<Map<string, string>>(new Map());
  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [privateData, setPrivateData] = useState<UserPrivate | null>(null);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [userSessions, setUserSessions] = useState<UserSessionDoc[]>([]);
  const [currentSessionId] = useState<string>(() => {
    let sid = localStorage.getItem('mender_current_session_id');
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('mender_current_session_id', sid);
    }
    return sid;
  });
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

  // Listen strictly to verified Firebase Auth state (Google, Phone OTP, or Firebase Custom Token)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        return;
      }
      // Remove any legacy unsigned localStorage session artifact
      try {
        localStorage.removeItem(EMAIL_SESSION_STORAGE_KEY);
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
    const offlineProfileKey = `mender_offline_profile_${uid}`;
    const offlinePrivateKey = `mender_offline_private_${uid}`;

    let publicLoaded = false;
    let privateLoaded = false;

    // Мгновенное восстановление профиля из локального кэша для работы без интернета (Офлайн-режим)
    try {
      const cachedPub = localStorage.getItem(offlineProfileKey);
      const cachedPriv = localStorage.getItem(offlinePrivateKey);
      if (cachedPub) {
        setProfile(JSON.parse(cachedPub) as UserPublic);
        publicLoaded = true;
      }
      if (cachedPriv) {
        const parsedPriv = JSON.parse(cachedPriv) as UserPrivate;
        setPrivateData(parsedPriv);
        if (!parsedPriv.pinHash) {
          setIsPinVerified(true);
        } else {
          const verifiedInSession =
            sessionStorage.getItem(getPinVerifiedStorageKey(uid)) === 'true';
          setIsPinVerified(verifiedInSession);
        }
        privateLoaded = true;
      }
      if (publicLoaded && privateLoaded) {
        setIsAuthReady(true);
      }
    } catch {
      // ignore localStorage parse errors
    }

    const checkReady = () => {
      if (publicLoaded && privateLoaded) {
        setIsAuthReady(true);
      }
    };

    const unsubPublic = onSnapshot(
      publicRef,
      snap => {
        if (snap.exists()) {
          const pubData = snap.data() as UserPublic;
          setProfile(pubData);
          try {
            localStorage.setItem(offlineProfileKey, JSON.stringify(pubData));
          } catch {
            // ignore
          }
        } else if (!publicLoaded) {
          setProfile(null);
        }
        publicLoaded = true;
        checkReady();
      },
      err => {
        publicLoaded = true;
        checkReady();
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        }
      }
    );

    const unsubPrivate = onSnapshot(
      privateRef,
      snap => {
        if (snap.exists()) {
          const data = snap.data() as UserPrivate;
          setPrivateData(data);
          try {
            localStorage.setItem(offlinePrivateKey, JSON.stringify(data));
          } catch {
            // ignore
          }
          if (!data.pinHash) {
            setIsPinVerified(true);
          } else {
            const verifiedInSession =
              sessionStorage.getItem(getPinVerifiedStorageKey(uid)) === 'true';
            setIsPinVerified(verifiedInSession);
          }
        } else if (!privateLoaded) {
          setPrivateData(null);
        }
        privateLoaded = true;
        checkReady();
      },
      err => {
        privateLoaded = true;
        checkReady();
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          handleFirestoreError(err, OperationType.GET, `users_private/${uid}`);
        }
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
      err => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          handleFirestoreError(err, OperationType.LIST, `users_private/${uid}/blocks`);
        }
      }
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
      err => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          handleFirestoreError(err, OperationType.LIST, `users/${uid}/subscriptions`);
        }
      }
    );

    // Register / update current session in Firestore
    const deviceStr = getDeviceDetailsString();
    let currentIp = '178.154.201.55';
    const sessRef = doc(db, 'users', uid, 'activeSessions', currentSessionId);

    const saveCurrentSessionDoc = () => {
      setDoc(
        sessRef,
        {
          sessionId: currentSessionId,
          userId: uid,
          device: deviceStr,
          ip: currentIp,
          status: 'active',
          lastActiveAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      saveCurrentSessionDoc();
    } else {
      fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) })
        .then(res => res.json())
        .then(data => {
          if (data.ip) currentIp = data.ip;
        })
        .catch(() => {})
        .finally(saveCurrentSessionDoc);
    }

    const sessionsQuery = query(
      collection(db, 'users', uid, 'activeSessions'),
      where('userId', '==', uid)
    );
    const unsubSessions = onSnapshot(
      sessionsQuery,
      snap => {
        const allSessions = snap.docs.map(d => d.data() as UserSessionDoc);
        const activeSessions = allSessions.filter(s => s.status !== 'terminated');
        setUserSessions(activeSessions);

        const currentSessDoc = allSessions.find(s => s.sessionId === currentSessionId);
        if (currentSessDoc && currentSessDoc.status === 'terminated') {
          logout();
        }
      },
      err => handleFirestoreError(err, OperationType.LIST, `users/${uid}/activeSessions`)
    );

    return () => {
      unsubPublic();
      unsubPrivate();
      unsubBlocks();
      unsubSubs();
      unsubSessions();
    };
  }, [firebaseUser?.uid, currentSessionId]);

  /**
   * Вход в существующий аккаунт по:
   * - @юзернейму (например: @maksim или maksim)
   * - имени пользователя (например: Максим)
   * - электронной почте (например: user@mail.ru)
   * и обычному паролю (PBKDF2).
   * Если у пользователя включён 2FA PIN-код (twoFactorEnabled && pinHash),
   * после успешной проверки пароля открывается второй шаг — подтверждение 2FA PIN-кодом.
   */
  const toLatinUsernameSlug = (val: string): string => {
    const cyrillicMap: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
      з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
      п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
      ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    };
    return val
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .split('')
      .map(ch => cyrillicMap[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const shouldUseDirectFirestoreFallback = (
    status: number,
    parsed: Record<string, any> | null
  ): boolean => {
    if (!parsed) return true;
    const errStr = typeof parsed.error === 'string' ? parsed.error : '';
    if (
      status === 503 ||
      status === 502 ||
      status === 504 ||
      errStr.includes('SERVER_FIREBASE_CREDENTIALS_NOT_CONFIGURED') ||
      errStr.includes('INVALID_FIREBASE_SERVICE_ACCOUNT_JSON') ||
      errStr.includes('OAuth2 token exchange failed')
    ) {
      return true;
    }
    if (status === 404 && !errStr.includes('не найден')) {
      return true;
    }
    return false;
  };

  const findAccountByIdentifierClient = async (
    rawIdentifier: string
  ): Promise<{
    uid: string;
    normalizedEmail: string;
    pubDoc: UserPublic | null;
    privDoc: UserPrivate | null;
  }> => {
    const lowered = rawIdentifier.trim().toLowerCase();
    const isEmailFormat = lowered.includes('@') && !lowered.startsWith('@');
    const normalizedEmail = isEmailFormat
      ? lowered
      : `${lowered.replace(/^@/, '')}@mender.app`;

    let uid = await deriveUidFromEmail(normalizedEmail);
    let [pubSnap, privSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'users_private', uid)),
    ]);

    let pubDoc = pubSnap.exists() ? (pubSnap.data() as UserPublic) : null;
    let privDoc = privSnap.exists() ? (privSnap.data() as UserPrivate) : null;

    if (!pubDoc) {
      const cleanUname = lowered.replace(/^@/, '').trim();
      const slugUname = toLatinUsernameSlug(cleanUname);
      const usersSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('status', 'in', ['online', 'offline', 'busy']),
          limit(300)
        )
      );
      const allUsers = usersSnap.docs.map(d => d.data() as UserPublic);
      const matched =
        allUsers.find(
          u =>
            u.username &&
            (u.username.toLowerCase() === cleanUname ||
              (slugUname && u.username.toLowerCase() === slugUname))
        ) ||
        allUsers.find(u => u.displayName && u.displayName.trim().toLowerCase() === lowered) ||
        allUsers.find(
          u =>
            cleanUname.length >= 2 &&
            u.displayName &&
            u.displayName.trim().toLowerCase().includes(lowered)
        ) ||
        null;

      if (matched?.uid) {
        uid = matched.uid;
        const [mPub, mPriv] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDoc(doc(db, 'users_private', uid)),
        ]);
        pubDoc = mPub.exists() ? (mPub.data() as UserPublic) : matched;
        privDoc = mPriv.exists() ? (mPriv.data() as UserPrivate) : null;
      }
    }

    return { uid, normalizedEmail, pubDoc, privDoc };
  };

  const persistDirectSessionUser = (sessionUser: SessionUser, requires2FaPin: boolean) => {
    try {
      localStorage.setItem(EMAIL_SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
    } catch {
      // ignore storage errors
    }
    if (requires2FaPin) {
      setIsPinVerified(false);
      sessionStorage.removeItem(getPinVerifiedStorageKey(sessionUser.uid));
    } else {
      setIsPinVerified(true);
      sessionStorage.setItem(getPinVerifiedStorageKey(sessionUser.uid), 'true');
    }
    setFirebaseUser(sessionUser);
  };

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

    const attemptScope = sanitizeId(`id_${lowered}`);
    const lockoutUntil = Number(localStorage.getItem(getPinLockoutStorageKey(attemptScope)) || '0');
    if (lockoutUntil > Date.now()) {
      const sec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      const msg = `Слишком много неверных попыток! Подождите ${sec} сек.`;
      setAuthError(msg);
      throw new Error(msg);
    }

    const recordInvalidPasswordAttempt = (): never => {
      const prevAttempts = Number(localStorage.getItem(getPinAttemptsStorageKey(attemptScope)) || '0');
      const nextAttempts = prevAttempts + 1;
      localStorage.setItem(getPinAttemptsStorageKey(attemptScope), String(nextAttempts));
      setFailedPinAttempts(nextAttempts);

      if (nextAttempts >= MAX_PIN_ATTEMPTS) {
        const resetMsg =
          'Вы не вспомнили пароль за 5 попыток. Введите новый пароль и подтвердите его.';
        setAuthError(resetMsg);
        throw new Error('MAX_PASSWORD_ATTEMPTS_REACHED');
      }

      const left = Math.max(0, MAX_PIN_ATTEMPTS - nextAttempts);
      const errMsg = `Неверный пароль! Осталось попыток: ${left} из ${MAX_PIN_ATTEMPTS}.`;
      setAuthError(errMsg);
      throw new Error(errMsg);
    };

    let useDirectFallback = false;
    let responseStatus = 0;
    let parsed: Record<string, any> | null = null;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmed, password: rawPassword }),
      });
      responseStatus = response.status;
      const text = await response.text();
      try {
        parsed = text ? (JSON.parse(text) as Record<string, any>) : null;
      } catch {
        parsed = null;
      }
      if (shouldUseDirectFirestoreFallback(responseStatus, parsed)) {
        useDirectFallback = true;
      }
    } catch {
      useDirectFallback = true;
    }

    if (!useDirectFallback && parsed) {
      const data = parsed as {
        error?: string;
        code?: string;
        customToken?: string;
        uid?: string;
        requires2FaPin?: boolean;
      };

      if (responseStatus < 200 || responseStatus >= 300 || !data.customToken || !data.uid) {
        if (data.code === 'INVALID_PASSWORD') {
          recordInvalidPasswordAttempt();
        }
        const msg = data.error || 'Не удалось выполнить вход';
        setAuthError(msg);
        throw new Error(msg);
      }

      localStorage.setItem(getPinAttemptsStorageKey(attemptScope), '0');
      localStorage.removeItem(getPinLockoutStorageKey(attemptScope));
      localStorage.setItem(getPinAttemptsStorageKey(data.uid), '0');
      localStorage.removeItem(getPinLockoutStorageKey(data.uid));
      setFailedPinAttempts(0);

      if (data.requires2FaPin) {
        setIsPinVerified(false);
        sessionStorage.removeItem(getPinVerifiedStorageKey(data.uid));
      } else {
        setIsPinVerified(true);
        sessionStorage.setItem(getPinVerifiedStorageKey(data.uid), 'true');
      }

      const cred = await signInWithCustomToken(auth, data.customToken);
      setFirebaseUser(cred.user);
      sendSystemLoginSecurityNotification(data.uid).catch(() => {});
      return;
    }

    // Direct Firestore PBKDF2 fallback when Server Service Account key is not provisioned
    const { uid, normalizedEmail, pubDoc, privDoc } = await findAccountByIdentifierClient(trimmed);
    if (!pubDoc) {
      const msg =
        'Аккаунт с таким @юзернеймом, именем или почтой не найден! Нажмите «Регистрация», чтобы создать аккаунт.';
      setAuthError(msg);
      throw new Error(msg);
    }

    if (privDoc?.passwordHash && privDoc?.passwordSalt) {
      const valid = await verifyPasswordHash(
        rawPassword,
        String(privDoc.passwordSalt),
        String(privDoc.passwordHash)
      );
      if (!valid) {
        recordInvalidPasswordAttempt();
      }
    } else if (privDoc?.pinHash && privDoc?.pinSalt) {
      const digitsOnly = rawPassword.replace(/\D/g, '');
      const matchesLegacyPin =
        digitsOnly.length >= 4 &&
        (await verifyPinHash(digitsOnly, String(privDoc.pinSalt), String(privDoc.pinHash)));
      if (!matchesLegacyPin) {
        recordInvalidPasswordAttempt();
      }
      const pwdSalt = generateSalt(16);
      const pwdHash = await hashPassword(rawPassword, pwdSalt);
      await updateDoc(doc(db, 'users_private', uid), {
        passwordHash: pwdHash,
        passwordSalt: pwdSalt,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    } else if (privDoc && rawPassword.length >= 6) {
      const pwdSalt = generateSalt(16);
      const pwdHash = await hashPassword(rawPassword, pwdSalt);
      await updateDoc(doc(db, 'users_private', uid), {
        passwordHash: pwdHash,
        passwordSalt: pwdSalt,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    localStorage.setItem(getPinAttemptsStorageKey(attemptScope), '0');
    localStorage.removeItem(getPinLockoutStorageKey(attemptScope));
    localStorage.setItem(getPinAttemptsStorageKey(uid), '0');
    localStorage.removeItem(getPinLockoutStorageKey(uid));
    setFailedPinAttempts(0);

    await updateDoc(doc(db, 'users', uid), {
      status: 'online',
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    const requires2FaPin = Boolean(privDoc?.pinHash && privDoc?.twoFactorEnabled);
    persistDirectSessionUser(
      {
        uid,
        email: privDoc?.email || normalizedEmail,
        displayName: pubDoc.displayName,
        photoURL: pubDoc.avatarUrl,
        phoneNumber: privDoc?.phone || null,
      },
      requires2FaPin
    );
    sendSystemLoginSecurityNotification(uid).catch(() => {});
  };

  /**
   * Регистрация нового аккаунта (Server Firebase Custom Token + автоматический прямой режим Firestore PBKDF2)
   */
  const registerWithEmailAccount = async (params: {
    email: string;
    displayName: string;
    username?: string;
    password: string;
    pin2FA?: string;
  }) => {
    setAuthError(null);

    let useDirectFallback = false;
    let responseStatus = 0;
    let parsed: Record<string, any> | null = null;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      responseStatus = response.status;
      const rawText = await response.text();
      try {
        parsed = rawText ? (JSON.parse(rawText) as Record<string, any>) : null;
      } catch {
        parsed = null;
      }
      if (shouldUseDirectFirestoreFallback(responseStatus, parsed)) {
        useDirectFallback = true;
      }
    } catch {
      useDirectFallback = true;
    }

    if (!useDirectFallback && parsed) {
      const data = parsed as {
        error?: string;
        customToken?: string;
        uid?: string;
      };

      if (responseStatus < 200 || responseStatus >= 300 || !data.customToken || !data.uid) {
        const msg = data.error || `Ошибка регистрации аккаунта (HTTP ${responseStatus})`;
        setAuthError(msg);
        throw new Error(msg);
      }

      setIsPinVerified(true);
      sessionStorage.setItem(getPinVerifiedStorageKey(data.uid), 'true');
      const cred = await signInWithCustomToken(auth, data.customToken);
      setFirebaseUser(cred.user);
      return;
    }

    // Direct Firestore PBKDF2 registration when Server Service Account key is not configured
    const cleanName = String(params.displayName || '').trim();
    const trimmedEmail = String(params.email || '').trim().toLowerCase();
    const rawUsernameInput = toLatinUsernameSlug(String(params.username || ''));
    const password = String(params.password || '');
    const cleanPin = String(params.pin2FA || '').replace(/\D/g, '');

    if (!cleanName) {
      const msg = 'Введите ваше имя';
      setAuthError(msg);
      throw new Error(msg);
    }

    const fallbackPrefix = trimmedEmail
      ? toLatinUsernameSlug(trimmedEmail.split('@')[0] || '')
      : toLatinUsernameSlug(cleanName) || `user_${Math.floor(1000 + Math.random() * 9000)}`;

    const baseUsername =
      rawUsernameInput || fallbackPrefix || `user_${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanUsername = (baseUsername.length >= 3 ? baseUsername : `user_${baseUsername}`).slice(
      0,
      40
    );

    if (!password || password.length < 6) {
      const msg = 'Пароль должен содержать минимум 6 символов (буквы, цифры или спецсимволы)';
      setAuthError(msg);
      throw new Error(msg);
    }

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

    try {
      const existingPub = await getDoc(doc(db, 'users', uid));
      if (existingPub.exists()) {
        const msg = 'Такой аккаунт уже зарегистрирован! Нажмите «Войти» и введите свой пароль.';
        setAuthError(msg);
        throw new Error(msg);
      }

      const activeUsersSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('status', 'in', ['online', 'offline', 'busy']),
          limit(300)
        )
      );
      const dupUsername = activeUsersSnap.docs.some(
        d => String((d.data() as UserPublic).username || '').toLowerCase() === cleanUsername
      );
      if (dupUsername) {
        const msg = `Юзернейм @${cleanUsername} уже занят. Выберите другой @username или войдите в существующий аккаунт.`;
        setAuthError(msg);
        throw new Error(msg);
      }

      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        cleanName
      )}&background=0077FF&color=fff&bold=true`;

      const passwordSalt = generateSalt(16);
      const passwordHash = await hashPassword(password, passwordSalt);
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
      batch.set(doc(db, 'users', uid), publicDoc);
      batch.set(doc(db, 'users_private', uid), privateDoc);
      await batch.commit();

      persistDirectSessionUser(
        {
          uid,
          email: normalizedEmail,
          displayName: publicDoc.displayName,
          photoURL: publicDoc.avatarUrl,
          phoneNumber: null,
        },
        false
      );
    } catch (err: any) {
      const msg = err?.message || 'Ошибка регистрации аккаунта';
      setAuthError(msg);
      throw err;
    }
  };

  /**
   * Быстрый вход по почте:
   * запрещает обход аккаунтов, защищённых паролем или PIN-кодом.
   */
  const loginWithQuickEmail = async (
    rawEmail: string,
    customDisplayName?: string,
    providedPin?: string
  ) => {
    setAuthError(null);
    try {
      let useDirectFallback = false;
      let responseStatus = 0;
      let parsed: Record<string, any> | null = null;

      try {
        const response = await fetch('/api/auth/quick-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: rawEmail,
            displayName: customDisplayName,
            pin: providedPin,
          }),
        });
        responseStatus = response.status;
        const rawText = await response.text();
        try {
          parsed = rawText ? (JSON.parse(rawText) as Record<string, any>) : null;
        } catch {
          parsed = null;
        }
        if (shouldUseDirectFirestoreFallback(responseStatus, parsed)) {
          useDirectFallback = true;
        }
      } catch {
        useDirectFallback = true;
      }

      if (!useDirectFallback && parsed) {
        const data = parsed as {
          error?: string;
          customToken?: string;
          uid?: string;
        };

        if (responseStatus < 200 || responseStatus >= 300 || !data.customToken || !data.uid) {
          const msg = data.error || `Не удалось выполнить вход по почте (HTTP ${responseStatus})`;
          setAuthError(msg);
          throw new Error(msg);
        }

        setIsPinVerified(true);
        sessionStorage.setItem(getPinVerifiedStorageKey(data.uid), 'true');
        const cred = await signInWithCustomToken(auth, data.customToken);
        setFirebaseUser(cred.user);
        return;
      }

      const trimmed = String(rawEmail || '').trim().toLowerCase();
      if (!trimmed) {
        throw new Error('Введите адрес электронной почты');
      }
      const cleanPin = providedPin ? providedPin.replace(/\D/g, '') : '';
      if (cleanPin && (cleanPin.length < 4 || cleanPin.length > 8)) {
        throw new Error('Защитный PIN-код должен содержать от 4 до 8 цифр');
      }

      const normalizedEmail = trimmed.includes('@') ? trimmed : `${trimmed}@mender.app`;
      const uid = await deriveUidFromEmail(normalizedEmail);
      const [pubSnap, privSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDoc(doc(db, 'users_private', uid)),
      ]);
      const existingPub = pubSnap.exists() ? (pubSnap.data() as UserPublic) : null;
      const existingPriv = privSnap.exists() ? (privSnap.data() as UserPrivate) : null;

      if (existingPriv?.passwordHash) {
        throw new Error('Этот аккаунт защищён паролем. Используйте стандартный вход с паролем.');
      }
      if (existingPriv?.pinHash && existingPriv?.pinSalt) {
        if (!cleanPin) {
          throw new Error('Для входа в этот аккаунт необходимо ввести защитный PIN-код.');
        }
        const pinOk = await verifyPinHash(cleanPin, existingPriv.pinSalt, existingPriv.pinHash);
        if (!pinOk) {
          throw new Error('Неверный защитный PIN-код для этого аккаунта!');
        }
      }

      const emailPrefix = normalizedEmail.split('@')[0] || 'user';
      const rawUsername = toLatinUsernameSlug(emailPrefix);
      const cleanUsername = (rawUsername.length >= 3 ? rawUsername : `user_${rawUsername}`).slice(
        0,
        40
      );
      const resolvedName = (customDisplayName?.trim() || emailPrefix).slice(0, 80);
      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        resolvedName
      )}&background=4f46e5&color=fff&bold=true`;

      if (!existingPub) {
        await setDoc(doc(db, 'users', uid), {
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
        });
      } else {
        await updateDoc(doc(db, 'users', uid), {
          status: 'online',
          updatedAt: serverTimestamp(),
        });
      }

      if (!existingPriv) {
        const newSalt = cleanPin ? generateSalt(16) : '';
        const newHash = cleanPin ? await hashPin(cleanPin, newSalt) : '';
        await setDoc(doc(db, 'users_private', uid), {
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
        });
      }

      persistDirectSessionUser(
        {
          uid,
          email: normalizedEmail,
          displayName: existingPub?.displayName || resolvedName,
          photoURL: existingPub?.avatarUrl || defaultAvatar,
          phoneNumber: existingPriv?.phone || null,
        },
        false
      );
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
   * Проверка надёжности пароля:
   * - минимум 8 символов
   * - обязательно буквы + цифры
   * - запрет простых комбинаций (12345678, qwerty, одинаковые символы, совпадение с логином)
   */
  const validateStrongPassword = (pwd: string, usernameOrName?: string): string | null => {
    if (!pwd || pwd.length < 8) {
      return 'Слабый пароль! Пароль должен содержать минимум 8 символов.';
    }
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(pwd) || !/\d/.test(pwd)) {
      return 'Слабый пароль! Используйте сочетание букв и цифр.';
    }
    if (/^(.)\1+$/.test(pwd)) {
      return 'Слабый пароль! Нельзя использовать одинаковые символы.';
    }
    const lower = pwd.toLowerCase();
    const weakList = [
      '12345678',
      '123456789',
      '1234567890',
      'qwerty123',
      'qwertyui',
      'password',
      'password1',
      'пароль123',
      'йцукен123',
    ];
    if (weakList.includes(lower)) {
      return 'Этот пароль слишком простой и легко угадывается! Придумайте более сложный.';
    }
    if (
      usernameOrName &&
      usernameOrName.trim().length >= 3 &&
      lower.includes(usernameOrName.replace(/^@/, '').trim().toLowerCase())
    ) {
      return 'Пароль не должен содержать ваш @юзернейм или имя!';
    }
    return null;
  };

  /**
   * Смена пароля аккаунта:
   * - По умолчанию проверяет текущий пароль (до 5 попыток).
   * - После 5 неудачных попыток (isRecoveryAfter5Attempts === true) требует:
   *   1) 6-значный одноразовый защитный код (OTP)
   *   2) 2FA PIN-код (если подключён на аккаунте) или подтверждение своего @username
   *   3) Новый надёжный пароль (от 8 символов, буквы + цифры, не совпадающий со старым) + подтверждение
   */
  const changeAccountPassword = async (
    newPassword: string,
    currentPassword?: string,
    confirmPassword?: string,
    isRecoveryAfter5Attempts?: boolean,
    securityVerification?: {
      otpCode: string;
      expectedOtpCode: string;
      pin2FA?: string;
      confirmUsername?: string;
    }
  ) => {
    if (!firebaseUser || !privateData) return;

    const strengthError = validateStrongPassword(newPassword, profile?.username);
    if (strengthError) {
      throw new Error(strengthError);
    }

    if (privateData.passwordHash && privateData.passwordSalt) {
      if (isRecoveryAfter5Attempts) {
        if (!securityVerification) {
          throw new Error('Требуется пройти проверку безопасности для сброса пароля');
        }
        if (
          !securityVerification.otpCode ||
          securityVerification.otpCode.trim() !== securityVerification.expectedOtpCode
        ) {
          throw new Error('Неверный 6-значный защитный код подтверждения!');
        }
        if (privateData.pinHash) {
          const cleanPin = (securityVerification.pin2FA || '').replace(/\D/g, '');
          if (cleanPin.length < 4) {
            throw new Error('Для сброса пароля введите ваш 2FA PIN-код безопасности');
          }
          const pinOk = await verifyPinHash(cleanPin, privateData.pinSalt, privateData.pinHash);
          if (!pinOk) {
            throw new Error('Неверный 2FA PIN-код! Сброс пароля отклонён.');
          }
        } else if (profile?.username) {
          const enteredUser = (securityVerification.confirmUsername || '')
            .replace(/^@/, '')
            .trim()
            .toLowerCase();
          if (enteredUser !== profile.username.toLowerCase()) {
            throw new Error('Подтвердите ваш точный @username для проверки владельца аккаунта!');
          }
        }
        if (!confirmPassword || newPassword !== confirmPassword) {
          throw new Error('Новый пароль и подтверждение пароля не совпадают!');
        }
      } else {
        if (!currentPassword) {
          throw new Error('Введите текущий пароль');
        }
        const isCurrentValid = await verifyPasswordHash(
          currentPassword,
          privateData.passwordSalt,
          privateData.passwordHash
        );
        if (!isCurrentValid) {
          throw new Error('INVALID_CURRENT_PASSWORD');
        }
      }

      const isSameAsOld = await verifyPasswordHash(
        newPassword,
        privateData.passwordSalt,
        privateData.passwordHash
      );
      if (isSameAsOld) {
        throw new Error('Новый пароль не должен совпадать с предыдущим паролем!');
      }
    } else if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      throw new Error('Новый пароль и подтверждение пароля не совпадают!');
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
   * Шаг 1 защиты «Забыли пароль»:
   * Проверяет блокировку от перебора, находит аккаунт, формирует криптографический 6-значный код (OTP)
   * со сроком действия 3 минуты и определяет, требуется ли 2FA PIN-код или подтверждение точного @username/почты.
   */
  const requestPasswordRecoveryChallenge = async (rawIdentifier: string) => {
    setAuthError(null);
    const trimmed = rawIdentifier.trim();
    if (!trimmed) {
      const msg = 'Введите ваш @юзернейм, имя или почту';
      setAuthError(msg);
      throw new Error(msg);
    }

    const recoveryScope = sanitizeId(`rec_${trimmed.toLowerCase()}`);
    const recoveryLockKey = `mender_recovery_lock_${recoveryScope}`;
    const lockUntil = Number(localStorage.getItem(recoveryLockKey) || '0');
    if (lockUntil > Date.now()) {
      const sec = Math.ceil((lockUntil - Date.now()) / 1000);
      const msg = `Слишком много неверных попыток восстановления! Подождите ${sec} сек.`;
      setAuthError(msg);
      throw new Error(msg);
    }

    let response: Response | null = null;
    let data: {
      error?: string;
      code?: string;
      uid?: string;
      maskedHint?: string;
      requires2FaPin?: boolean;
      requiresEmailOrUsernameCheck?: string;
      otpCode?: string;
      expiresAt?: number;
      challengeToken?: string;
    } = {};

    try {
      response = await fetch('/api/auth/recovery/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmed }),
      });
      data = await response.json().catch(() => ({}));
    } catch {
      response = null;
    }

    if (!shouldUseDirectFirestoreFallback(response ? response.status : 503, data)) {
      if (!response || !response.ok || !data.uid || !data.challengeToken || !data.otpCode || !data.expiresAt) {
        const msg = data.error || 'Аккаунт с таким @юзернеймом, именем или почтой не найден!';
        setAuthError(msg);
        throw new Error(msg);
      }

      recoveryChallengeTokensRef.current.set(trimmed.toLowerCase(), data.challengeToken);
      recoveryChallengeTokensRef.current.set(data.uid, data.challengeToken);

      return {
        uid: data.uid,
        maskedHint: data.maskedHint || '@user',
        requires2FaPin: Boolean(data.requires2FaPin),
        requiresEmailOrUsernameCheck: data.requiresEmailOrUsernameCheck || '',
        otpCode: data.otpCode,
        expiresAt: data.expiresAt,
      };
    }

    // Direct Firestore fallback for Password Recovery Step 1
    const found = await findAccountByIdentifierClient(trimmed);
    if (!found.pubDoc || !found.privDoc) {
      const msg = 'Аккаунт с таким @юзернеймом, именем или почтой не найден!';
      setAuthError(msg);
      throw new Error(msg);
    }

    const otpArr = new Uint32Array(1);
    crypto.getRandomValues(otpArr);
    const otpCode = String(100000 + (otpArr[0] % 900000));
    const expiresAt = Date.now() + 3 * 60_000;

    await sendSystemLoginSecurityNotification(found.uid, otpCode).catch(() => {});

    const rawUsername = found.pubDoc.username || '';
    const maskedHint =
      rawUsername.length > 2
        ? `@${rawUsername[0]}***${rawUsername.slice(-1)}`
        : `@${rawUsername || 'user'}`;

    const directToken = JSON.stringify({ uid: found.uid, otpCode, expiresAt });
    recoveryChallengeTokensRef.current.set(trimmed.toLowerCase(), directToken);
    recoveryChallengeTokensRef.current.set(found.uid, directToken);

    return {
      uid: found.uid,
      maskedHint,
      requires2FaPin: Boolean(found.privDoc.pinHash && found.privDoc.pinSalt),
      requiresEmailOrUsernameCheck: rawUsername || found.privDoc.email || '',
      otpCode,
      expiresAt,
    };
  };

  /**
   * Шаг 2 защиты «Забыли пароль» (серверная проверка HMAC challengeToken, 2FA PIN и смена пароля):
   */
  const resetForgottenPassword = async (params: {
    identifier: string;
    newPassword: string;
    confirmPassword: string;
    otpCode: string;
    expectedOtpCode: string;
    otpExpiresAt: number;
    pin2FA?: string;
    ownerConfirmInput?: string;
  }) => {
    setAuthError(null);
    const trimmed = params.identifier.trim();
    const recoveryScope = sanitizeId(`rec_${trimmed.toLowerCase()}`);
    const recoveryLockKey = `mender_recovery_lock_${recoveryScope}`;
    const recoveryAttemptsKey = `mender_recovery_attempts_${recoveryScope}`;

    const lockUntil = Number(localStorage.getItem(recoveryLockKey) || '0');
    if (lockUntil > Date.now()) {
      const sec = Math.ceil((lockUntil - Date.now()) / 1000);
      const msg = `Защита от взлома: восстановление заблокировано на ${sec} сек.`;
      setAuthError(msg);
      throw new Error(msg);
    }

    const challengeToken = recoveryChallengeTokensRef.current.get(trimmed.toLowerCase()) || '';

    const registerRecoveryFailure = (baseMessage: string): never => {
      const prev = Number(localStorage.getItem(recoveryAttemptsKey) || '0') + 1;
      localStorage.setItem(recoveryAttemptsKey, String(prev));
      if (prev >= 3) {
        localStorage.setItem(recoveryLockKey, String(Date.now() + 60_000));
        localStorage.setItem(recoveryAttemptsKey, '0');
        const lockMsg = `${baseMessage} Превышен лимит (3 попытки) — восстановление заблокировано на 60 секунд.`;
        setAuthError(lockMsg);
        throw new Error(lockMsg);
      }
      const left = 3 - prev;
      const errMsg = `${baseMessage} (Осталось попыток проверки: ${left} из 3)`;
      setAuthError(errMsg);
      throw new Error(errMsg);
    };

    let response: Response | null = null;
    let data: {
      error?: string;
      code?: string;
      customToken?: string;
      uid?: string;
    } = {};

    try {
      response = await fetch('/api/auth/recovery/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmed,
          newPassword: params.newPassword,
          confirmPassword: params.confirmPassword,
          otpCode: params.otpCode,
          challengeToken,
          pin2FA: params.pin2FA,
          ownerConfirmInput: params.ownerConfirmInput,
        }),
      });
      data = await response.json().catch(() => ({}));
    } catch {
      response = null;
    }

    if (!shouldUseDirectFirestoreFallback(response ? response.status : 503, data)) {
      if (!response || !response.ok || !data.customToken || !data.uid) {
        if (response?.status === 401) {
          registerRecoveryFailure(data.error || 'Ошибка проверки');
        }
        const msg = data.error || 'Ошибка сброса пароля';
        setAuthError(msg);
        throw new Error(msg);
      }

      recoveryChallengeTokensRef.current.delete(trimmed.toLowerCase());
      localStorage.setItem(recoveryAttemptsKey, '0');
      localStorage.removeItem(recoveryLockKey);
      localStorage.setItem(getPinAttemptsStorageKey(sanitizeId(`id_${trimmed.toLowerCase()}`)), '0');
      localStorage.removeItem(getPinLockoutStorageKey(sanitizeId(`id_${trimmed.toLowerCase()}`)));
      setFailedPinAttempts(0);

      setIsPinVerified(true);
      sessionStorage.setItem(getPinVerifiedStorageKey(data.uid), 'true');
      const cred = await signInWithCustomToken(auth, data.customToken);
      setFirebaseUser(cred.user);
      return;
    }

    // Direct Firestore fallback for Password Recovery Step 2
    if (Date.now() > params.otpExpiresAt) {
      const msg = 'Срок действия 6-значного кода истёк (3 минуты). Запросите новый код!';
      setAuthError(msg);
      throw new Error(msg);
    }

    if (!params.otpCode || params.otpCode.trim() !== params.expectedOtpCode) {
      registerRecoveryFailure('Неверный 6-значный защитный код подтверждения!');
    }

    const found = await findAccountByIdentifierClient(trimmed);
    if (!found.pubDoc || !found.privDoc) {
      const msg = 'Аккаунт не найден';
      setAuthError(msg);
      throw new Error(msg);
    }

    const { uid, pubDoc: publicDoc, privDoc: privateDoc } = found;
    const enteredConfirm = (params.ownerConfirmInput || '')
      .replace(/^@/, '')
      .trim()
      .toLowerCase();
    const expectedUsername = (publicDoc.username || '').toLowerCase();
    const expectedEmail = (privateDoc.email || '').toLowerCase();
    if (
      !enteredConfirm ||
      (enteredConfirm !== expectedUsername && enteredConfirm !== expectedEmail)
    ) {
      registerRecoveryFailure(
        'Неверное подтверждение вашего точного @username или почты!'
      );
    }

    if (privateDoc.pinHash && privateDoc.pinSalt) {
      const cleanPin = (params.pin2FA || '').replace(/\D/g, '');
      if (cleanPin.length < 4) {
        const msg = 'На аккаунте включена 2FA-защита: введите ваш 2FA PIN-код безопасности!';
        setAuthError(msg);
        throw new Error(msg);
      }
      const pinOk = await verifyPinHash(cleanPin, privateDoc.pinSalt, privateDoc.pinHash);
      if (!pinOk) {
        registerRecoveryFailure('Неверный 2FA PIN-код безопасности!');
      }
    }

    const strengthError = validateStrongPassword(params.newPassword, publicDoc.username);
    if (strengthError) {
      setAuthError(strengthError);
      throw new Error(strengthError);
    }

    if (params.newPassword !== params.confirmPassword) {
      const msg = 'Новый пароль и подтверждение пароля не совпадают!';
      setAuthError(msg);
      throw new Error(msg);
    }

    const passwordSalt = generateSalt(16);
    const passwordHash = await hashPassword(params.newPassword, passwordSalt);

    await updateDoc(doc(db, 'users_private', uid), {
      passwordHash,
      passwordSalt,
      updatedAt: serverTimestamp(),
    });

    await sendSystemLoginSecurityNotification(uid);

    recoveryChallengeTokensRef.current.delete(trimmed.toLowerCase());
    localStorage.setItem(recoveryAttemptsKey, '0');
    localStorage.removeItem(recoveryLockKey);
    localStorage.setItem(getPinAttemptsStorageKey(sanitizeId(`id_${trimmed.toLowerCase()}`)), '0');
    localStorage.removeItem(getPinLockoutStorageKey(sanitizeId(`id_${trimmed.toLowerCase()}`)));
    setFailedPinAttempts(0);

    persistDirectSessionUser(
      {
        uid,
        email: privateDoc.email || null,
        displayName: publicDoc.displayName || publicDoc.username || 'Пользователь',
        photoURL: publicDoc.avatarUrl || null,
        phoneNumber: privateDoc.phone || null,
      },
      true
    );
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
    if (targetType === 'user' && cleanTarget === uid) return;

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

      // Update target user's followersCount & send real notification if targetType === 'user'
      if (targetType === 'user' && cleanTarget !== uid) {
        try {
          const targetRef = doc(db, 'users', cleanTarget);
          const targetSnap = await getDoc(targetRef);
          if (targetSnap.exists()) {
            const targetData = targetSnap.data() as UserPublic;
            const currentFollowers = Math.max(0, targetData.followersCount || 0);
            const nextFollowers = existingSub
              ? Math.max(0, currentFollowers - 1)
              : currentFollowers + 1;
            await updateDoc(targetRef, {
              followersCount: nextFollowers,
              updatedAt: serverTimestamp(),
            });

            if (!existingSub) {
              const notifId = sanitizeId(`vnotif_sub_${uid}_${Date.now()}`);
              await setDoc(doc(db, 'users', cleanTarget, 'video_notifications', notifId), {
                notificationId: notifId,
                recipientId: cleanTarget,
                actorId: uid,
                actorName: profile.displayName.slice(0, 80),
                actorUsername: profile.username.slice(0, 40),
                actorAvatar: profile.avatarUrl.slice(0, 2000),
                type: 'new_subscriber',
                videoId: '',
                videoTitle: '',
                commentText: '',
                isRead: false,
                createdAt: serverTimestamp(),
              });
            }
          }
        } catch {
          // non-critical if target doc doesn't exist
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/subscriptions/${cleanTarget}`);
    }
  };

  const submitReport = async (
    targetId: string,
    targetType: 'user' | 'chat' | 'post' | 'message' | 'video' | 'video_comment',
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

  const terminateSession = async (targetSessionId: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    try {
      await updateDoc(doc(db, 'users', uid, 'activeSessions', targetSessionId), {
        status: 'terminated',
        updatedAt: serverTimestamp(),
      });
    } catch {
      await deleteDoc(doc(db, 'users', uid, 'activeSessions', targetSessionId));
    }
  };

  const terminateAllOtherSessions = async () => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const batch = writeBatch(db);
    userSessions.forEach(s => {
      if (s.sessionId !== currentSessionId) {
        batch.update(doc(db, 'users', uid, 'activeSessions', s.sessionId), {
          status: 'terminated',
          updatedAt: serverTimestamp(),
        });
      }
    });
    await batch.commit();
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
        requestPasswordRecoveryChallenge,
        resetForgottenPassword,
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
        userSessions,
        currentSessionId,
        terminateSession,
        terminateAllOtherSessions,
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
