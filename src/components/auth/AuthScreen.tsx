import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Phone,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Camera,
  LogOut,
  ShieldCheck,
  Delete,
  LogIn,
  UserPlus,
  AtSign,
  Sun,
  Moon,
  Palette,
  KeyRound,
} from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const {
    firebaseUser,
    profile,
    privateData,
    themeMode,
    customThemeBgColor,
    setThemeMode,
    setCustomThemeBgColor,
    isPinVerified,
    needsOnboarding,
    failedPinAttempts,
    maxPinAttempts,
    pinLockoutSecondsLeft,
    authError,
    clearAuthError,
    loginWithEmailAccount,
    requestPasswordRecoveryChallenge,
    resetForgottenPassword,
    registerWithEmailAccount,
    loginWithGoogle,
    sendPhoneOtp,
    confirmPhoneOtp,
    completeOnboardingProfile,
    verifySessionPin,
    logout,
  } = useAuth();

  // Начальный экран при входе:
  // 'login' — сразу открываем удобную форму входа (по @юзеру, имени или почте)
  // 'register' — форма регистрации нового аккаунта
  // 'choice' — все способы входа
  // 'phone' — вход по номеру телефона (SMS)
  const [entryScreen, setEntryScreen] = useState<'choice' | 'login' | 'register' | 'phone'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [recoveryChallenge, setRecoveryChallenge] = useState<{
    uid: string;
    maskedHint: string;
    requires2FaPin: boolean;
    requiresEmailOrUsernameCheck: string;
    otpCode: string;
    expiresAt: number;
  } | null>(null);
  const [recoveryOtpInput, setRecoveryOtpInput] = useState('');
  const [recoveryOwnerConfirmInput, setRecoveryOwnerConfirmInput] = useState('');
  const [recoveryPin2FAInput, setRecoveryPin2FAInput] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [emailNameInput, setEmailNameInput] = useState('');
  const [registerUsernameInput, setRegisterUsernameInput] = useState('');
  const [emailPinInput, setEmailPinInput] = useState('');
  const [phoneStep, setPhoneStep] = useState<'input' | 'otp'>('input');
  const [phoneInput, setPhoneInput] = useState('+7');
  const [otpInput, setOtpInput] = useState('');

  // Onboarding state (for Google / Phone first-time users)
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
  const [username, setUsername] = useState(
    (firebaseUser?.email?.split('@')[0] || 'mender_user').replace(/[^a-zA-Z0-9_]/g, '_')
  );
  const [bio, setBio] = useState('Привет! Я использую Mender.');
  const [onboardingPhone, setOnboardingPhone] = useState(firebaseUser?.phoneNumber || '');
  const [newPin, setNewPin] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // PIN verification state
  const [pinAttempt, setPinAttempt] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetMessages = () => {
    clearAuthError();
    setLocalError(null);
  };

  // Case 1: User is signed in and has a profile, but session is locked by Cloud PIN (PBKDF2 + Brute-Force Lockout)
  if (firebaseUser && !needsOnboarding && privateData?.pinHash && !isPinVerified) {
    const isLockedOut = pinLockoutSecondsLeft > 0;
    const attemptsLeft = Math.max(0, maxPinAttempts - failedPinAttempts);

    const handleVerifyPin = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (isLockedOut || pinAttempt.length < 4) return;
      setLocalError(null);
      setIsLoading(true);
      try {
        const ok = await verifySessionPin(pinAttempt);
        if (!ok) {
          setPinAttempt('');
          setLocalError('Неверный PIN-код! Попробуйте ещё раз.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    const handleKeypadDigit = (digit: string) => {
      if (isLockedOut || pinAttempt.length >= 8) return;
      setLocalError(null);
      setPinAttempt(prev => prev + digit);
    };

    const handleKeypadBackspace = () => {
      if (isLockedOut) return;
      setPinAttempt(prev => prev.slice(0, -1));
    };

    return (
      <div className="h-[100dvh] overflow-y-auto bg-[#EDEEF0] flex flex-col items-center py-6 px-4 text-[#19191A] select-none">
        <div className="w-full max-w-md my-auto bg-white rounded-2xl p-6 md:p-7 shadow-sm border border-[#E1E3E6]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0077FF]">
              <ShieldCheck className="w-4 h-4 text-[#4BB34B]" />
              <span>Двухфакторная защита (PIN-код)</span>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#E5F1FF] text-[#0077FF]">
              2FA
            </span>
          </div>

          <div className="flex items-center gap-3.5 mb-4 p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6]">
            <img
              src={profile?.avatarUrl}
              alt={profile?.displayName}
              className="w-14 h-14 rounded-full object-cover bg-[#E5F1FF] border border-[#E1E3E6] shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#19191A] truncate">
                {profile?.displayName}
              </h2>
              <p className="text-xs text-[#0077FF] font-medium truncate">@{profile?.username}</p>
              <p className="text-[11px] text-[#626D7A] mt-0.5">
                Введите ваш защитный PIN-код для входа в аккаунт
              </p>
            </div>
          </div>

          {/* Brute-force protection indicator */}
          <div className="mb-3 flex items-center justify-between text-xs px-1">
            <span className="text-[#626D7A]">Защита от перебора:</span>
            {isLockedOut ? (
              <span className="font-semibold text-[#E64646]">
                Блокировка ввода: {pinLockoutSecondsLeft} сек.
              </span>
            ) : (
              <span
                className={`font-semibold ${
                  attemptsLeft <= 2 ? 'text-amber-600' : 'text-[#4BB34B]'
                }`}
              >
                Попыток осталось: {attemptsLeft} из {maxPinAttempts}
              </span>
            )}
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              disabled={isLockedOut}
              value={pinAttempt}
              onChange={e => setPinAttempt(e.target.value.replace(/\D/g, ''))}
              placeholder={
                isLockedOut ? `Подождите ${pinLockoutSecondsLeft} сек...` : 'Введите PIN-код'
              }
              className="v7-input text-center text-lg tracking-[0.35em] font-mono disabled:opacity-50"
              autoFocus
              required
            />

            {/* Цифровая клавиатура */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                <button
                  key={digit}
                  type="button"
                  disabled={isLockedOut}
                  onClick={() => handleKeypadDigit(digit)}
                  className="py-2.5 rounded-xl bg-[#F2F3F5] hover:bg-[#E5E7EB] active:scale-95 border border-[#E1E3E6] text-base font-bold text-[#19191A] transition-all cursor-pointer disabled:opacity-40"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={isLockedOut || !pinAttempt}
                onClick={() => setPinAttempt('')}
                className="py-2.5 rounded-xl bg-[#FFEAEA] hover:bg-[#FFDADA] border border-[#E64646]/20 text-xs font-semibold text-[#E64646] transition-all cursor-pointer disabled:opacity-40"
              >
                Сброс
              </button>
              <button
                type="button"
                disabled={isLockedOut}
                onClick={() => handleKeypadDigit('0')}
                className="py-2.5 rounded-xl bg-[#F2F3F5] hover:bg-[#E5E7EB] active:scale-95 border border-[#E1E3E6] text-base font-bold text-[#19191A] transition-all cursor-pointer disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                disabled={isLockedOut || !pinAttempt}
                onClick={handleKeypadBackspace}
                className="py-2.5 rounded-xl bg-[#F2F3F5] hover:bg-[#E5E7EB] border border-[#E1E3E6] text-xs font-semibold text-[#626D7A] hover:text-[#19191A] flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                title="Стереть последнюю цифру"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            {localError && (
              <div className="p-3 rounded-xl bg-[#FFEAEA] border border-[#E64646]/30 text-[#E64646] text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{localError}</span>
              </div>
            )}

            <div className="v7-btn-list pt-1">
              <button
                type="submit"
                disabled={isLoading || isLockedOut || pinAttempt.length < 4}
                className="v7-btn justify-center"
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  {isLockedOut
                    ? `Заблокировано (${pinLockoutSecondsLeft} с)`
                    : isLoading
                    ? 'Проверка...'
                    : 'Войти в Mender'}
                </span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="v7-btn-danger justify-center"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Выйти из аккаунта</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Case 2: Authenticated user completing initial profile & PIN setup
  if (firebaseUser && needsOnboarding) {
    const handleCompleteOnboarding = async (e: React.FormEvent) => {
      e.preventDefault();
      setLocalError(null);
      if (newPin && (newPin.length < 4 || newPin.length > 8)) {
        setLocalError('PIN-код должен содержать от 4 до 8 цифр');
        return;
      }
      setIsLoading(true);
      try {
        await completeOnboardingProfile({
          displayName: displayName || firebaseUser.displayName || 'Пользователь Mender',
          username,
          bio,
          phone: onboardingPhone,
          pin: newPin,
          avatarFile,
        });
      } catch (err: any) {
        setLocalError(err?.message || 'Ошибка создания профиля');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="h-[100dvh] overflow-y-auto bg-[#EDEEF0] flex flex-col items-center py-6 px-4 text-[#19191A]">
        <div className="w-full max-w-lg my-auto bg-white rounded-2xl p-7 shadow-sm border border-[#E1E3E6]">
          <div className="text-xs font-semibold text-[#0077FF] mb-1">Настройка страницы</div>
          <h1 className="text-xl font-bold text-[#19191A] mb-1">Создание профиля Mender</h1>
          <p className="text-xs text-[#626D7A] mb-5">
            Укажите ваше имя и @юзернейм, по которым вас смогут находить друзья и по которым вы сможете входить в аккаунт
          </p>

          <form onSubmit={handleCompleteOnboarding} className="space-y-3.5">
            <div className="flex items-center gap-4 p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6]">
              <div className="relative shrink-0">
                <img
                  src={
                    avatarPreview ||
                    firebaseUser.photoURL ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      displayName || 'M'
                    )}&background=0077FF&color=fff&bold=true`
                  }
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover bg-[#E5F1FF] border border-[#E1E3E6]"
                />
                <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#0077FF] hover:bg-[#0066EA] text-white flex items-center justify-center cursor-pointer shadow-xs">
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="text-xs text-[#626D7A]">
                <p className="font-semibold text-[#19191A] text-sm">Фотография профиля</p>
                <p className="mt-0.5">Нажмите на значок камеры, чтобы загрузить своё фото</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#626D7A] mb-1">Ваше имя *</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Например: Максим"
                  className="v7-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#626D7A] mb-1">Ваш @юзернейм *</label>
                <input
                  type="text"
                  value={username}
                  onChange={e =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
                  }
                  placeholder="maksim"
                  className="v7-input font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#626D7A] mb-1">Телефон (необязательно)</label>
                <input
                  type="tel"
                  value={onboardingPhone}
                  onChange={e => setOnboardingPhone(e.target.value)}
                  placeholder="+7..."
                  className="v7-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#626D7A] mb-1">PIN-код (необязательно)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4–8 цифр"
                  className="v7-input font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#626D7A] mb-1">О себе</label>
              <input
                type="text"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Расскажите немного о себе"
                className="v7-input"
              />
            </div>

            {(localError || authError) && (
              <div className="p-3 rounded-xl bg-[#FFEAEA] border border-[#E64646]/30 text-[#E64646] text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{localError || authError}</span>
              </div>
            )}

            <div className="v7-btn-list pt-2">
              <button type="submit" disabled={isLoading} className="v7-btn justify-center">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isLoading ? 'Сохранение профиля...' : 'Продолжить в Mender'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Case 3: Unauthenticated user — Вход по @юзеру / имени / почте и Защищённый сброс пароля
  const handleStartRecoveryChallenge = async () => {
    resetMessages();
    if (!loginIdentifier.trim()) {
      setLocalError('Сначала введите ваш @юзернейм, имя или почту');
      return;
    }
    setIsLoading(true);
    try {
      const challenge = await requestPasswordRecoveryChallenge(loginIdentifier.trim());
      setRecoveryChallenge(challenge);
      setIsResettingPassword(true);
      setRecoveryOtpInput('');
      setRecoveryOwnerConfirmInput('');
      setRecoveryPin2FAInput('');
    } catch (err: any) {
      setLocalError(err?.message || 'Не удалось запросить защитный код');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrengthScore = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-zA-Zа-яА-ЯёЁ]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Zа-яА-ЯёЁ0-9]/.test(pwd) || (/[a-zа-я]/.test(pwd) && /[A-ZА-Я]/.test(pwd))) {
      score++;
    }
    return score;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!loginIdentifier.trim()) {
      setLocalError('Введите ваш @юзернейм, имя или почту');
      return;
    }
    if (isResettingPassword) {
      if (!recoveryChallenge) {
        await handleStartRecoveryChallenge();
        return;
      }
      if (resetNewPassword.length < 8) {
        setLocalError('Слабый пароль! Новый пароль должен содержать минимум 8 символов (буквы и цифры)');
        return;
      }
      if (resetNewPassword !== resetConfirmPassword) {
        setLocalError('Новый пароль и подтверждение не совпадают!');
        return;
      }
      setIsLoading(true);
      try {
        await resetForgottenPassword({
          identifier: loginIdentifier.trim(),
          newPassword: resetNewPassword,
          confirmPassword: resetConfirmPassword,
          otpCode: recoveryOtpInput.trim(),
          expectedOtpCode: recoveryChallenge.otpCode,
          otpExpiresAt: recoveryChallenge.expiresAt,
          pin2FA: recoveryPin2FAInput.trim(),
          ownerConfirmInput: recoveryOwnerConfirmInput.trim(),
        });
      } catch (err: any) {
        setLocalError(err?.message || 'Ошибка проверки безопасности при смене пароля');
      } finally {
        setIsLoading(false);
      }
      return;
    }
    if (!passwordInput) {
      setLocalError('Введите пароль от аккаунта');
      return;
    }
    setIsLoading(true);
    try {
      await loginWithEmailAccount(loginIdentifier.trim(), passwordInput);
    } catch (err: any) {
      if (err?.message === 'MAX_PASSWORD_ATTEMPTS_REACHED') {
        setPasswordInput('');
        try {
          const challenge = await requestPasswordRecoveryChallenge(loginIdentifier.trim());
          setRecoveryChallenge(challenge);
          setIsResettingPassword(true);
          setLocalError(
            'Использовано 5 из 5 попыток! Пройдите защитную проверку и задайте новый пароль.'
          );
        } catch (chErr: any) {
          setIsResettingPassword(true);
          setLocalError(chErr?.message || 'Пройдите проверку безопасности для смены пароля.');
        }
      } else {
        setLocalError(err?.message || 'Ошибка входа');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!emailNameInput.trim()) {
      setLocalError('Введите ваше имя');
      return;
    }
    if (!registerUsernameInput.trim() && !emailInput.trim()) {
      setLocalError('Укажите @юзернейм или почту для входа в аккаунт');
      return;
    }
    if (passwordInput.length < 6) {
      setLocalError('Придумайте пароль минимум из 6 символов');
      return;
    }
    setIsLoading(true);
    try {
      await registerWithEmailAccount({
        email: emailInput.trim(),
        displayName: emailNameInput.trim(),
        username: registerUsernameInput.trim() || undefined,
        password: passwordInput,
        pin2FA: emailPinInput.trim() || undefined,
      });
    } catch (err: any) {
      setLocalError(err?.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);
    try {
      await sendPhoneOtp(phoneInput.trim(), 'recaptcha-container');
      setPhoneStep('otp');
    } catch {
      // authError handled in context
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);
    try {
      await confirmPhoneOtp(otpInput.trim());
    } catch {
      // authError handled in context
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#EDEEF0] flex flex-col items-center py-6 px-4 text-[#19191A] select-none">
      <div className="w-full max-w-md my-auto bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-[#E1E3E6]">
        {/* Шапка с логотипом Mender и быстрым переключателем темы (Светлая / Тёмная / Свой) */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#0077FF] flex items-center justify-center text-white font-black text-2xl shadow-xs shrink-0">
              M
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-[#19191A] leading-none">
                Mender
              </div>
              <div className="text-xs text-[#626D7A] mt-1">Мессенджер и социальная сеть</div>
            </div>
          </div>

          {/* Единая кнопка переключения темы: Светлая -> Тёмная -> Свой */}
          <button
            type="button"
            onClick={() => {
              const nextMode =
                themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'custom' : 'light';
              setThemeMode(nextMode);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#F0F2F5] hover:bg-[#E5E7EB] border border-[#E1E3E6] text-[#19191A] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            title={
              themeMode === 'light'
                ? 'Тема: Светлая (нажмите для Тёмной)'
                : themeMode === 'dark'
                ? 'Тема: Тёмная (нажмите для Своей)'
                : 'Тема: Свой фон (нажмите для Светлой)'
            }
          >
            {themeMode === 'light' && <Sun className="w-4 h-4 text-[#0077FF]" />}
            {themeMode === 'dark' && <Moon className="w-4 h-4 text-[#0077FF]" />}
            {themeMode === 'custom' && <Palette className="w-4 h-4 text-[#0077FF]" />}
            <span>
              {themeMode === 'light' ? 'Светлая' : themeMode === 'dark' ? 'Тёмная' : 'Свой'}
            </span>
          </button>
        </div>

        {/* Быстрая палитра, если выбран режим «Свой» */}
        {themeMode === 'custom' && (
          <div className="flex items-center justify-between gap-2 p-2.5 mb-4 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6]">
            <span className="text-xs font-medium text-[#19191A]">Свой цвет фона:</span>
            <div className="flex items-center gap-1.5">
              {['#1E293B', '#0F172A', '#1E1B4B', '#064E3B', '#EAE4F7', '#F5EFE6'].map(hex => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setCustomThemeBgColor(hex)}
                  className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${
                    customThemeBgColor === hex ? 'scale-110 ring-2 ring-[#0077FF]' : 'border-[#E1E3E6]'
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
              <input
                type="color"
                value={customThemeBgColor}
                onChange={e => setCustomThemeBgColor(e.target.value)}
                className="w-6 h-6 rounded-md cursor-pointer border border-[#E1E3E6] bg-transparent"
                title="Выбрать любой свой цвет"
              />
            </div>
          </div>
        )}

        {/* Верхний переключатель: Войти | Регистрация */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F0F2F5] border border-[#E1E3E6] mb-5">
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setEntryScreen('login');
            }}
            className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              entryScreen === 'login' || entryScreen === 'choice'
                ? 'bg-white text-[#0077FF] shadow-xs'
                : 'text-[#626D7A] hover:text-[#19191A]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Войти</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setEntryScreen('register');
            }}
            className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              entryScreen === 'register'
                ? 'bg-white text-[#0077FF] shadow-xs'
                : 'text-[#626D7A] hover:text-[#19191A]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Регистрация</span>
          </button>
        </div>

        {/* ЭКРАН 1: ФОРМА «ВОЙТИ» (ПО @ЮЗЕРУ, ИМЕНИ ИЛИ ПОЧТЕ) */}
        {(entryScreen === 'login' || entryScreen === 'choice') && (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#19191A] mb-1.5">
                Имя, @юзернейм или почта
              </label>
              <div>
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={e => setLoginIdentifier(e.target.value)}
                  placeholder=""
                  className="v7-input"
                  autoFocus
                  required
                />
              </div>
            </div>

            {!isResettingPassword ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#19191A]">
                    Пароль
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (loginIdentifier.trim()) {
                        handleStartRecoveryChallenge();
                      } else {
                        resetMessages();
                        setIsResettingPassword(true);
                      }
                    }}
                    className="text-xs font-semibold text-[#0077FF] hover:underline cursor-pointer"
                  >
                    Забыли пароль?
                  </button>
                </div>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder=""
                  className="v7-input"
                  required
                />
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#0077FF]" />
                    <span className="text-xs font-bold text-[#19191A]">
                      Защищённое восстановление пароля
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setIsResettingPassword(false);
                      setRecoveryChallenge(null);
                    }}
                    className="text-xs font-semibold text-[#0077FF] hover:underline cursor-pointer"
                  >
                    Вспомнил пароль
                  </button>
                </div>

                {!recoveryChallenge ? (
                  <div className="space-y-2">
                    <p className="text-xs text-[#626D7A]">
                      Для защиты аккаунта от чужого сброса пароля сначала получите одноразовый 6-значный код безопасности.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartRecoveryChallenge}
                      disabled={isLoading || !loginIdentifier.trim()}
                      className="v7-btn text-xs py-2 justify-center"
                    >
                      <KeyRound className="w-4 h-4 shrink-0" />
                      <span>Получить 6-значный защитный код</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Одноразовый 6-значный код безопасности (3 минуты, макс. 3 попытки) */}
                    <div className="p-2.5 rounded-lg bg-[#E5F1FF] border border-[#B8D9FF] text-xs text-[#19191A] flex items-center justify-between">
                      <span>Одноразовый код безопасности (3 мин):</span>
                      <span className="font-mono font-extrabold text-sm text-[#0077FF] tracking-widest">
                        {recoveryChallenge.otpCode}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#19191A] mb-1">
                        1. Введите 6-значный код безопасности *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={recoveryOtpInput}
                        onChange={e => setRecoveryOtpInput(e.target.value.replace(/\D/g, ''))}
                        placeholder=""
                        className="v7-input font-mono tracking-widest"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#19191A] mb-1">
                        2. Подтвердите точный @username владельца ({recoveryChallenge.maskedHint}) *
                      </label>
                      <input
                        type="text"
                        value={recoveryOwnerConfirmInput}
                        onChange={e => setRecoveryOwnerConfirmInput(e.target.value)}
                        placeholder=""
                        className="v7-input"
                        required
                      />
                    </div>

                    {recoveryChallenge.requires2FaPin && (
                      <div>
                        <label className="block text-xs font-semibold text-[#19191A] mb-1">
                          3. Введите ваш 2FA PIN-код безопасности (4–8 цифр) *
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={8}
                          value={recoveryPin2FAInput}
                          onChange={e => setRecoveryPin2FAInput(e.target.value.replace(/\D/g, ''))}
                          placeholder=""
                          className="v7-input font-mono"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-[#19191A] mb-1">
                        Новый пароль (от 8 символов, буквы + цифры) *
                      </label>
                      <input
                        type="password"
                        value={resetNewPassword}
                        onChange={e => setResetNewPassword(e.target.value)}
                        placeholder=""
                        className="v7-input"
                        required
                      />
                      {/* Индикатор сложности пароля (4 уровня) */}
                      <div className="mt-1.5 space-y-1">
                        <div className="grid grid-cols-4 gap-1">
                          {[1, 2, 3, 4].map(level => {
                            const score = getPasswordStrengthScore(resetNewPassword);
                            const active = score >= level;
                            const color =
                              score <= 1
                                ? 'bg-[#E64646]'
                                : score <= 2
                                ? 'bg-[#FFA000]'
                                : 'bg-[#4BB34B]';
                            return (
                              <div
                                key={level}
                                className={`h-1 rounded-full transition-colors ${
                                  active ? color : 'bg-[#DCE1E6]'
                                }`}
                              />
                            );
                          })}
                        </div>
                        <div className="text-[11px] text-[#626D7A]">
                          Защита: минимум 8 символов, обязательно буквы и цифры, до 3 попыток проверки кода.
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#19191A] mb-1">
                        Подтвердите новый пароль *
                      </label>
                      <input
                        type="password"
                        value={resetConfirmPassword}
                        onChange={e => setResetConfirmPassword(e.target.value)}
                        placeholder=""
                        className="v7-input"
                        required
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="v7-btn-list pt-1">
              <button type="submit" disabled={isLoading} className="v7-btn justify-center py-2.5">
                <LogIn className="w-4 h-4 shrink-0" />
                <span>
                  {isLoading
                    ? 'Проверка защиты...'
                    : isResettingPassword
                    ? recoveryChallenge
                      ? 'Подтвердить код, сменить пароль и войти'
                      : 'Запросить защитный код восстановления'
                    : 'Войти в Mender'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setEntryScreen('register');
                }}
                className="v7-btn-secondary justify-center"
              >
                <UserPlus className="w-4 h-4 text-[#0077FF] shrink-0" />
                <span>Создать новый аккаунт</span>
              </button>
            </div>

            <div className="relative my-3 flex items-center justify-center">
              <div className="border-t border-[#E1E3E6] w-full" />
              <span className="bg-white px-3 text-[11px] text-[#818C99] shrink-0">или другие способы</span>
              <div className="border-t border-[#E1E3E6] w-full" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => loginWithGoogle().catch(() => {})}
                className="v7-btn-secondary justify-center text-xs py-2"
              >
                <Shield className="w-4 h-4 text-[#0077FF] shrink-0" />
                <span>Через Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setEntryScreen('phone');
                }}
                className="v7-btn-secondary justify-center text-xs py-2"
              >
                <Phone className="w-4 h-4 text-[#0077FF] shrink-0" />
                <span>По номеру SMS</span>
              </button>
            </div>
          </form>
        )}

        {/* ЭКРАН 2: ФОРМА «РЕГИСТРАЦИЯ» (ИМЯ + @ЮЗЕРНЕЙМ + ПАРОЛЬ, ПОЧТА ПО ЖЕЛАНИЮ) */}
        {entryScreen === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#19191A] mb-1">
                Ваше имя *
              </label>
              <input
                type="text"
                value={emailNameInput}
                onChange={e => setEmailNameInput(e.target.value)}
                placeholder="Например: Максим"
                className="v7-input"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#19191A] mb-1">
                Ваш @юзернейм (логин для входа) *
              </label>
              <input
                type="text"
                value={registerUsernameInput}
                onChange={e =>
                  setRegisterUsernameInput(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, '_')
                  )
                }
                placeholder="Например: @maksim"
                className="v7-input font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#626D7A] mb-1">
                Электронная почта (необязательно)
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="user@mail.ru (по желанию)"
                className="v7-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#19191A] mb-1">
                Пароль (минимум 6 символов) *
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Придумайте надёжный пароль"
                className="v7-input"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#626D7A] mb-1">
                Защитный 2FA PIN-код (необязательно)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={emailPinInput}
                onChange={e => setEmailPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4–8 цифр (если нужен второй шаг защиты)"
                className="v7-input font-mono"
              />
            </div>

            <div className="v7-btn-list pt-2">
              <button type="submit" disabled={isLoading} className="v7-btn justify-center py-2.5">
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>{isLoading ? 'Создание аккаунта...' : 'Зарегистрироваться'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setEntryScreen('login');
                }}
                className="v7-btn-secondary justify-center"
              >
                <LogIn className="w-4 h-4 text-[#0077FF] shrink-0" />
                <span>Уже есть аккаунт? Войти</span>
              </button>
            </div>
          </form>
        )}

        {/* ЭКРАН 3: ВХОД ПО НОМЕРУ ТЕЛЕФОНА (SMS) */}
        {entryScreen === 'phone' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[#19191A]">Вход по номеру телефона</div>
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setEntryScreen('login');
                }}
                className="text-xs text-[#0077FF] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Назад</span>
              </button>
            </div>

            {phoneStep === 'input' ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  placeholder="+79991234567"
                  className="v7-input font-mono"
                  required
                />

                <div className="v7-btn-list pt-1">
                  <button type="submit" disabled={isLoading} className="v7-btn justify-center">
                    <ArrowRight className="w-4 h-4 shrink-0" />
                    <span>{isLoading ? 'Отправка SMS...' : 'Получить SMS-код'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setEntryScreen('login');
                    }}
                    className="v7-btn-secondary justify-center"
                  >
                    <AtSign className="w-4 h-4 text-[#0077FF] shrink-0" />
                    <span>Войти по @юзеру или имени</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmOtp} className="space-y-3">
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value)}
                  placeholder="6-значный код из SMS"
                  className="v7-input text-center text-lg tracking-widest font-mono"
                  required
                />
                <div className="v7-btn-list pt-1">
                  <button type="submit" disabled={isLoading} className="v7-btn justify-center">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{isLoading ? 'Проверка...' : 'Подтвердить SMS-код'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoneStep('input')}
                    className="v7-btn-secondary justify-center"
                  >
                    <Phone className="w-4 h-4 text-[#0077FF] shrink-0" />
                    <span>Изменить номер телефона</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div id="recaptcha-container" />

        {(authError || localError) && (
          <div className="mt-4 p-3 rounded-xl bg-[#FFEAEA] border border-[#E64646]/30 text-[#E64646] text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{authError || localError}</p>
          </div>
        )}
      </div>
    </div>
  );
};
