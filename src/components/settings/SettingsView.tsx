import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  Check,
  Sparkles,
  Lock,
  Camera,
  Ban,
  Loader2,
  KeyRound,
  LogOut,
  Save,
  User,
  Settings,
  ArrowLeft,
  Heart,
  Image as ImageIcon,
  Send,
  Trash2,
  Pencil,
  MessageSquare,
  X,
  Film,
  Folder,
  FolderPlus,
  Sun,
  Moon,
  Palette,
  Upload,
  Laptop,
  Smartphone,
  Globe,
  Clock,
  XCircle,
  Download,
  Monitor,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { usePWAInstall } from '../../utils/usePWAInstall';
import { getDeviceDetailsString } from '../../utils/securityNotifications';
import { WallpaperStudioModal } from '../wallpapers/WallpaperStudioModal';
import { CreateGroupModal } from '../chats/CreateGroupModal';
import { WhatsNewComposer } from '../feed/WhatsNewComposer';
import { PostMediaViewer } from '../feed/PostMediaViewer';
import { PrivacyLevel, Post, PostComment } from '../../types';

export const SettingsView: React.FC = () => {
  const {
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
    updatePublicProfile,
    updatePrivatePreferences,
    changeAccountPassword,
    setupOrChangePin,
    resetPinWithReauth,
    lockSessionWithPin,
    unblockUser,
    logout,
    userSessions,
    currentSessionId,
    terminateSession,
    terminateAllOtherSessions,
  } = useAuth();
  const {
    usersDirectory,
    posts,
    postLikesByMe,
    postComments,
    commentLikesByMe,
    commentLikesCount,
    myProfileFolders,
    openUserProfile,
    createProfileFolder,
    deleteProfileFolder,
    togglePostInFolder,
    createPost,
    editPost,
    deletePost,
    toggleLikePost,
    loadCommentsForPost,
    addCommentToPost,
    editComment,
    deleteComment,
    toggleLikeComment,
  } = useChat();

  const { isInstallable, isInstalled, isIOS, installApp } = usePWAInstall();
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);
  const [shortcutCreatedMessage, setShortcutCreatedMessage] = useState<string | null>(null);

  // Навигация внутри раздела Профиль:
  // 'profile' — Моя страница (шапка профиля, стена «Что у вас нового?», папки, мои записи и понравившиеся)
  // 'settings' — Настройки (главное меню по референсу: Профиль, Пароль и 2FA, Активные сеансы, Приватность, Чёрный список, Установить приложение, Выйти)
  // 'menu' — быстрое меню профиля
  const [section, setSection] = useState<'menu' | 'profile' | 'settings'>('profile');
  const [settingsSubTab, setSettingsSubTab] = useState<
    'menu' | 'profile' | 'password_2fa' | 'sessions' | 'privacy' | 'blacklist' | 'install_app'
  >('menu');
  const [profileTab, setProfileTab] = useState<'my_posts' | 'liked_posts'>('my_posts');

  const handleCreateDesktopShortcut = async () => {
    setShortcutCreatedMessage(null);
    if (isInstallable) {
      const installed = await installApp();
      if (installed) {
        setShortcutCreatedMessage('Ярлык приложения Mender успешно установлен на ваше устройство!');
        return;
      }
    }
    try {
      const appUrl = window.location.origin;
      const shortcutContent = `[InternetShortcut]\r\nURL=${appUrl}\r\nIconIndex=0\r\n`;
      const blob = new Blob([shortcutContent], { type: 'application/internet-shortcut' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mender.url';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShortcutCreatedMessage(
        'Ярлык «Mender.url» создан и скачан! Перенесите его на рабочий стол или используйте кнопку «⋮» → «Сохранить и поделиться» → «Создать ярлык» для запуска в отдельном окне.'
      );
    } catch {
      setShowInstallGuideModal(true);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail === 'profile' || custom.detail === 'settings' || custom.detail === 'menu') {
        setSection(custom.detail);
        if (custom.detail === 'settings') {
          setSettingsSubTab('menu');
        }
      }
    };
    window.addEventListener('mender:profile-section', handler);
    return () => window.removeEventListener('mender:profile-section', handler);
  }, []);

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [username, setUsername] = useState(
    profile?.username ? `@${profile.username.replace(/^@/, '')}` : '@mender_user'
  );
  const [bio, setBio] = useState(profile?.bio || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Password management: по умолчанию текущий пароль (5 попыток), после 5 попыток — защищённый сброс (6-значный код + 2FA PIN/@username + новый пароль от 8 символов + подтверждение)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [failedPasswordAttempts, setFailedPasswordAttempts] = useState(0);
  const [settingsRecoveryOtp, setSettingsRecoveryOtp] = useState('');
  const [enteredSettingsOtp, setEnteredSettingsOtp] = useState('');
  const [enteredSettingsPin2FA, setEnteredSettingsPin2FA] = useState('');
  const [enteredSettingsUsername, setEnteredSettingsUsername] = useState('');
  const [passwordSavedMessage, setPasswordSavedMessage] = useState<string | null>(null);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);

  // 2FA PIN management (with current PIN verification)
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinSavedMessage, setPinSavedMessage] = useState<string | null>(null);
  const [pinErrorMessage, setPinErrorMessage] = useState<string | null>(null);

  // New Post / Video Composer inside Profile
  const [postContent, setPostContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Editing own post / comment inside Profile
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [openCommentsPostIds, setOpenCommentsPostIds] = useState<Record<string, boolean>>({});

  // Папки в профиле
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolderForm, setShowCreateFolderForm] = useState(false);
  const [newPostFolderId, setNewPostFolderId] = useState<string>('');
  const [folderPickerPostId, setFolderPickerPostId] = useState<string | null>(null);

  const toggleCommentsSection = (post: Post) => {
    const nextState = !openCommentsPostIds[post.postId];
    setOpenCommentsPostIds(prev => ({ ...prev, [post.postId]: nextState }));
    if (nextState && !postComments[post.postId]) {
      loadCommentsForPost(post.postId, post.visibility);
    }
  };

  // Modals
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [createChatModalType, setCreateChatModalType] = useState<'direct' | 'channel' | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const postFileInputRef = useRef<HTMLInputElement>(null);
  const customThemeFileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomThemeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomThemeBgImage(reader.result);
        setThemeMode('custom');
      }
    };
    reader.readAsDataURL(file);
  };

  const myPosts = posts.filter(p => p.authorId === profile?.uid);
  const likedPosts = posts.filter(p => Boolean(postLikesByMe[p.postId]));
  const baseProfilePosts = profileTab === 'my_posts' ? myPosts : likedPosts;
  const activeFolder = myProfileFolders.find(f => f.folderId === selectedFolderId);
  const displayedProfilePosts =
    selectedFolderId === 'all' || !activeFolder
      ? baseProfilePosts
      : baseProfilePosts.filter(p => activeFolder.postIds?.includes(p.postId));

  const displayedProfilePostIdsKey = displayedProfilePosts.map(p => p.postId).join(',');

  useEffect(() => {
    if (section === 'profile') {
      displayedProfilePosts.forEach(p => {
        loadCommentsForPost(p.postId, p.visibility);
      });
    }
  }, [section, profileTab, displayedProfilePostIdsKey, loadCommentsForPost]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);
    try {
      await updatePublicProfile({ avatarFile: file });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.replace(/^@/, '').trim() || 'mender_user';
    await updatePublicProfile({
      displayName: displayName.trim() || profile?.displayName || 'Пользователь',
      username: cleanUsername,
      bio,
    });
    setUsername(`@${cleanUsername}`);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const isPasswordRecoveryMode = failedPasswordAttempts >= 5;

  const generateSettingsRecoveryOtp = () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(100000 + (buf[0] % 900000));
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

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSavedMessage(null);
    setPasswordErrorMessage(null);

    const hasExistingPassword = Boolean(privateData?.passwordHash);

    if (hasExistingPassword && !isPasswordRecoveryMode) {
      if (!currentPassword) {
        setPasswordErrorMessage('Введите текущий пароль');
        return;
      }
      if (newPassword.length < 8) {
        setPasswordErrorMessage('Новый пароль должен содержать минимум 8 символов (буквы и цифры)');
        return;
      }
      try {
        await changeAccountPassword(newPassword, currentPassword, undefined, false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setFailedPasswordAttempts(0);
        setPasswordSavedMessage('Пароль аккаунта успешно изменён!');
        setTimeout(() => setPasswordSavedMessage(null), 4000);
      } catch (err: any) {
        if (err?.message === 'INVALID_CURRENT_PASSWORD') {
          const nextAttempts = failedPasswordAttempts + 1;
          setFailedPasswordAttempts(nextAttempts);
          setCurrentPassword('');
          if (nextAttempts >= 5) {
            setSettingsRecoveryOtp(generateSettingsRecoveryOtp());
            setEnteredSettingsOtp('');
            setEnteredSettingsPin2FA('');
            setEnteredSettingsUsername('');
            setPasswordErrorMessage(
              'Использовано 5 из 5 попыток! Включена защищённая проверка для установки нового пароля.'
            );
          } else {
            setPasswordErrorMessage(
              `Неверный текущий пароль! Осталось попыток: ${5 - nextAttempts} из 5.`
            );
          }
        } else {
          setPasswordErrorMessage(err?.message || 'Ошибка смены пароля');
        }
      }
      return;
    }

    // Защищённый режим после 5 неудачных попыток (или если пароль ещё не был установлен)
    if (newPassword.length < 8) {
      setPasswordErrorMessage('Слабый пароль! Новый пароль должен содержать минимум 8 символов (буквы и цифры)');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordErrorMessage('Новый пароль и подтверждение не совпадают!');
      return;
    }
    try {
      await changeAccountPassword(newPassword, undefined, confirmNewPassword, true, {
        otpCode: enteredSettingsOtp,
        expectedOtpCode: settingsRecoveryOtp,
        pin2FA: enteredSettingsPin2FA,
        confirmUsername: enteredSettingsUsername,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setEnteredSettingsOtp('');
      setEnteredSettingsPin2FA('');
      setEnteredSettingsUsername('');
      setFailedPasswordAttempts(0);
      setPasswordSavedMessage('Проверка пройдена! Новый надёжный пароль сохранён.');
      setTimeout(() => setPasswordSavedMessage(null), 4000);
    } catch (err: any) {
      setPasswordErrorMessage(err?.message || 'Ошибка смены пароля');
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinSavedMessage(null);
    setPinErrorMessage(null);
    if (newPin.length < 4) return;
    try {
      await setupOrChangePin(newPin, currentPin);
      setCurrentPin('');
      setNewPin('');
      setPinSavedMessage(
        '2FA PIN-код зашифрован (PBKDF2-SHA256, 100 000 итераций + salt) и активирован!'
      );
      setTimeout(() => setPinSavedMessage(null), 4000);
    } catch (err: any) {
      setPinErrorMessage(err?.message || 'Ошибка сохранения PIN-кода');
    }
  };

  const handleDisablePin = async () => {
    setPinSavedMessage(null);
    setPinErrorMessage(null);
    try {
      await resetPinWithReauth(currentPin);
      setCurrentPin('');
      setNewPin('');
      setPinSavedMessage('Защита PIN-кодом отключена после проверки текущего PIN.');
    } catch (err: any) {
      setPinErrorMessage(err?.message || 'Для отключения введите верный текущий PIN-код');
    }
  };

  const handleLockWithPinClick = () => {
    if (privateData?.pinHash) {
      lockSessionWithPin();
    } else {
      setSection('settings');
      setPinErrorMessage(
        'Сначала задайте облачный PIN-код (минимум 4 цифры, без 1234/0000), чтобы блокировать экран.'
      );
    }
  };

  const handlePostFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const createdId = await createProfileFolder(newFolderName.trim());
    setNewFolderName('');
    setShowCreateFolderForm(false);
    setSelectedFolderId(createdId);
  };

  const handleCreatePostInProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!postContent.trim() && !selectedFile) || isPublishing) return;
    setIsPublishing(true);
    try {
      await createPost({
        content: postContent.trim(),
        visibility: 'public',
        mediaFile: selectedFile,
        folderId: newPostFolderId || (selectedFolderId !== 'all' ? selectedFolderId : null),
      });
      setPostContent('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setProfileTab('my_posts');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSavePostEdit = async (postId: string) => {
    if (!editingPostText.trim()) return;
    await editPost(postId, editingPostText.trim());
    setEditingPostId(null);
    setEditingPostText('');
  };

  const handleAddComment = async (post: Post, e: React.FormEvent) => {
    e.preventDefault();
    const text = commentInputs[post.postId];
    if (!text || !text.trim()) return;
    setCommentInputs(prev => ({ ...prev, [post.postId]: '' }));
    await addCommentToPost(post, text);
  };

  const handleSaveCommentEdit = async (post: Post, comment: PostComment) => {
    if (!editingCommentText.trim()) return;
    await editComment(post, comment, editingCommentText.trim());
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const formatTime = (ts?: any) => {
    if (!ts) return '';
    try {
      const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const hasPin = Boolean(privateData?.pinHash);
  const contactSubtitle =
    privateData?.phone || privateData?.email || `@${profile?.username || 'mender_user'}`;

  return (
    <div className="flex-1 bg-[#EDEEF0] overflow-y-auto p-4 md:p-6 text-[#19191A] select-none transition-colors duration-300">
      <div className="max-w-[620px] mx-auto">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />

        {/* =====================================================================
            ЭКРАН 1: ГЛАВНЫЙ СПИСОК В ПРОФИЛЕ (section === 'menu')
            Кнопки по списку:
            1) Профиль (выкладывать свои посты, видео и смотреть залайканные)
            2) Настройки (настройки профиля, пин-код и т.д.)
            3) Заблокировать пин-кодом
            4) Выйти с аккаунта
        ===================================================================== */}
        {section === 'menu' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-[#19191A]">
              Моя страница
            </h1>

            {/* Карточка пользователя */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4 shadow-xs">
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-[#EDEFEF] overflow-hidden shrink-0 cursor-pointer group"
                title="Нажмите, чтобы сменить фото профиля"
              >
                {profile?.avatarUrl && (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="text-lg font-bold text-[#19191A]">
                  {profile?.displayName || 'Пользователь'}
                </div>
                <div className="text-xs text-[#818C99] mt-0.5">{contactSubtitle}</div>
                {profile?.bio && (
                  <p className="text-xs text-[#19191A] mt-1.5">{profile.bio}</p>
                )}

                <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileTab('my_posts');
                      setSection('profile');
                    }}
                    className="px-3 py-1 rounded-lg bg-[#EDEFEF] hover:bg-[#E5E7E8] text-xs text-[#2C3138] font-medium cursor-pointer"
                  >
                    Мои записи: <span className="font-bold text-[#0077FF]">{myPosts.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileTab('liked_posts');
                      setSection('profile');
                    }}
                    className="px-3 py-1 rounded-lg bg-[#EDEFEF] hover:bg-[#E5E7E8] text-xs text-[#2C3138] font-medium cursor-pointer"
                  >
                    Понравилось ❤️: <span className="font-bold text-[#E64646]">{likedPosts.length}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* КНОПКИ ПО СПИСКУ В ПРОФИЛЕ */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3 shadow-xs">
              <div className="text-xs font-semibold text-[#818C99]">МЕНЮ</div>

              <div className="v7-btn-list">
                <button
                  type="button"
                  onClick={() => {
                    setProfileTab('my_posts');
                    setSection('profile');
                  }}
                  className="v7-btn"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>Перейти к записям профиля</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSection('settings')}
                  className="v7-btn-secondary"
                >
                  <Settings className="w-4 h-4 shrink-0 text-[#0077FF]" />
                  <span>Настройки профиля, пароль и устройства</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInstallGuideModal(true)}
                  className="v7-btn-secondary border-[#0077FF]/30 bg-[#F4F8FF]"
                >
                  <Download className="w-4 h-4 shrink-0 text-[#0077FF]" />
                  <span>Установить приложение на ПК / Телефон (Создать ярлык)</span>
                </button>

                <button
                  type="button"
                  onClick={handleLockWithPinClick}
                  className="v7-btn-secondary"
                >
                  <Lock className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Заблокировать PIN-кодом</span>
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="v7-btn-danger"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Выйти из аккаунта</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            ЭКРАН 2: МОЯ СТРАНИЦА — ПРОФИЛЬ, ПАПКИ, МОИ ЗАПИСИ И ПОНРАВИВШИЕСЯ (section === 'profile')
        ===================================================================== */}
        {section === 'profile' && (
          <div className="space-y-4">
            {/* Шапка страницы в стиле ВК */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 min-w-0">
                  <div
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative w-20 h-20 rounded-full bg-[#EDEFEF] border border-[#E1E3E6] overflow-hidden shrink-0 cursor-pointer group"
                    title="Нажмите, чтобы сменить фото профиля"
                  >
                    {profile?.avatarUrl && (
                      <img
                        src={profile.avatarUrl}
                        alt={profile?.displayName}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      {uploadingAvatar ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  <div className="text-center sm:text-left min-w-0">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <h1 className="text-lg font-bold text-[#19191A] truncate">
                        {profile?.displayName || 'Пользователь'}
                      </h1>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8F9E8] text-[#2E7D32] text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4BB34B]" />
                        в сети
                      </span>
                    </div>
                    <div className="text-xs text-[#818C99] mt-0.5 truncate">
                      {contactSubtitle}
                    </div>
                    {profile?.bio && (
                      <p className="text-xs text-[#19191A] mt-1.5 leading-relaxed break-words">
                        {profile.bio}
                      </p>
                    )}

                    {/* Счётчики профиля */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 pt-2 border-t border-[#F2F3F5] text-xs">
                      <button
                        type="button"
                        onClick={() => setProfileTab('my_posts')}
                        className="flex items-center gap-1 text-[#818C99] hover:text-[#0077FF] cursor-pointer"
                      >
                        <span className="font-bold text-[#19191A]">{myPosts.length}</span>
                        <span>записей</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileTab('liked_posts')}
                        className="flex items-center gap-1 text-[#818C99] hover:text-[#E64646] cursor-pointer"
                      >
                        <span className="font-bold text-[#19191A]">{likedPosts.length}</span>
                        <span>понравилось</span>
                      </button>
                      <span className="flex items-center gap-1 text-[#818C99]">
                        <span className="font-bold text-[#19191A]">{myProfileFolders.length}</span>
                        <span>папок</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Кнопки действий в шапке профиля */}
                <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0 w-full sm:w-auto justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSection('settings');
                      setSettingsSubTab('menu');
                    }}
                    className="px-3.5 py-2 rounded-[8px] bg-[#EDEFEF] hover:bg-[#E2E5E8] text-xs font-semibold text-[#2C3138] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#0077FF]" />
                    <span>Настройки</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleLockWithPinClick}
                      className="flex-1 px-3 py-1.5 rounded-[8px] bg-[#F2F3F5] hover:bg-[#E5E7E8] text-xs font-medium text-[#2C3138] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Заблокировать экран PIN-кодом"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>PIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex-1 px-3 py-1.5 rounded-[8px] bg-[#FFEAEA] hover:bg-[#FFD6D6] text-xs font-medium text-[#E64646] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Выйти из аккаунта"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Выйти</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Блок «Что у вас нового?» (текст + выбор папки + до 9 фото/видео: Карусель или Сетка) */}
            <WhatsNewComposer
              defaultFolderId={selectedFolderId !== 'all' ? selectedFolderId : ''}
              onPublished={() => setProfileTab('my_posts')}
            />

            {/* ПАПКИ В ПРОФИЛЕ */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-[#818C99] flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-[#0077FF]" />
                  <span>Папки публикаций ({myProfileFolders.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateFolderForm(!showCreateFolderForm)}
                  className="px-3 py-1.5 rounded-[8px] bg-[#E5EBF1] hover:bg-[#DCE5EE] text-[#0077FF] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ Создать папку</span>
                </button>
              </div>

              {showCreateFolderForm && (
                <form
                  onSubmit={handleCreateFolderSubmit}
                  className="flex items-center gap-2 bg-[#F7F8FA] p-2.5 rounded-xl border border-[#E1E3E6]"
                >
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Название папки (например: Видео, Фото, Важное)..."
                    className="v7-input text-xs py-2"
                    autoFocus
                    required
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-[8px] bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold cursor-pointer shrink-0"
                  >
                    Создать
                  </button>
                </form>
              )}

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId('all')}
                  className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer transition-all ${
                    selectedFolderId === 'all'
                      ? 'bg-[#0077FF] text-white shadow-xs'
                      : 'bg-[#F0F2F5] text-[#656565] hover:bg-[#E5E7EB] hover:text-[#19191A]'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Все ({baseProfilePosts.length})</span>
                </button>

                {myProfileFolders.map(folder => {
                  const count = baseProfilePosts.filter(p =>
                    folder.postIds?.includes(p.postId)
                  ).length;
                  const isActive = selectedFolderId === folder.folderId;
                  return (
                    <div
                      key={folder.folderId}
                      className={`flex items-center rounded-[8px] text-xs font-semibold shrink-0 transition-all ${
                        isActive
                          ? 'bg-[#0077FF] text-white shadow-xs'
                          : 'bg-[#F0F2F5] text-[#656565] hover:bg-[#E5E7EB] hover:text-[#19191A]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedFolderId(folder.folderId)}
                        className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Folder
                          className={`w-3.5 h-3.5 ${
                            isActive ? 'text-white' : 'text-[#0077FF]'
                          }`}
                        />
                        <span>
                          {folder.name} ({count})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedFolderId === folder.folderId) {
                            setSelectedFolderId('all');
                          }
                          deleteProfileFolder(folder.folderId);
                        }}
                        className={`pr-2 pl-1 py-1.5 cursor-pointer ${
                          isActive
                            ? 'text-white/75 hover:text-white'
                            : 'text-[#818C99] hover:text-[#E64646]'
                        }`}
                        title={`Удалить папку «${folder.name}»`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Переключатель стены в стиле ВК: Мои записи | Понравилось */}
            <div className="flex bg-white p-1 rounded-xl border border-[#E1E3E6] shadow-xs">
              <button
                type="button"
                onClick={() => setProfileTab('my_posts')}
                className={`flex-1 py-2 text-xs font-semibold rounded-[8px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  profileTab === 'my_posts'
                    ? 'bg-[#E5EBF1] text-[#0077FF]'
                    : 'text-[#818C99] hover:text-[#19191A]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Мои записи ({myPosts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('liked_posts')}
                className={`flex-1 py-2 text-xs font-semibold rounded-[8px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  profileTab === 'liked_posts'
                    ? 'bg-[#FFEAEA] text-[#E64646]'
                    : 'text-[#818C99] hover:text-[#19191A]'
                }`}
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>Понравилось ({likedPosts.length})</span>
              </button>
            </div>

            {/* Список публикаций на стене */}
            <div className="space-y-3">
              {displayedProfilePosts.length === 0 ? (
                <div className="bg-white border border-[#E1E3E6] rounded-xl p-6 text-center text-xs text-[#818C99] shadow-xs">
                  {selectedFolderId !== 'all'
                    ? 'В выбранной папке пока нет записей. Нажмите «В папку» на любой записи, чтобы добавить её сюда.'
                    : profileTab === 'my_posts'
                    ? 'На стене пока нет ни одной записи. Опубликуйте первую запись выше!'
                    : 'Вы пока не отметили «Нравится» ни на одной записи.'}
                </div>
              ) : (
                displayedProfilePosts.map((post: Post) => {
                  const isAuthor = Boolean(profile?.uid && post.authorId === profile.uid);
                  const isLiked = Boolean(postLikesByMe[post.postId]);
                  const comments = postComments[post.postId] || [];

                  return (
                    <div
                      key={post.postId}
                      className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          onClick={() => openUserProfile(post.authorId)}
                          className="flex items-center gap-3 cursor-pointer group"
                          title="Открыть страницу автора"
                        >
                          <img
                            src={post.authorAvatar}
                            alt={post.authorName}
                            className="w-10 h-10 rounded-full object-cover bg-[#EDEFEF] border border-[#E1E3E6]"
                          />
                          <div>
                            <h4 className="text-[13.5px] font-semibold text-[#2A5885] group-hover:underline">
                              {post.authorName}
                            </h4>
                            <p className="text-xs text-[#818C99]">
                              @{post.authorUsername} · {formatTime(post.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Кнопка распределения поста по папкам профиля */}
                          <button
                            type="button"
                            onClick={() =>
                              setFolderPickerPostId(
                                folderPickerPostId === post.postId ? null : post.postId
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-xs font-medium text-[#2C3138] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Добавить или убрать из папки профиля"
                          >
                            <Folder className="w-3.5 h-3.5 text-[#0077FF]" />
                            <span>В папку</span>
                          </button>

                          {/* Удалить и редактировать можно ТОЛЬКО свои публикации */}
                          {isAuthor && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPostId(post.postId);
                                  setEditingPostText(post.content);
                                }}
                                className="p-2 rounded-lg text-[#818C99] hover:text-[#0077FF] hover:bg-[#F2F3F5] cursor-pointer"
                                title="Редактировать свою запись"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePost(post.postId)}
                                className="p-2 rounded-lg text-[#818C99] hover:text-[#E64646] hover:bg-red-50 cursor-pointer"
                                title="Удалить свою запись"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Выбор папок для текущего поста */}
                      {folderPickerPostId === post.postId && (
                        <div className="bg-[#F7F8FA] border border-[#E1E3E6] rounded-xl p-3 space-y-2">
                          <div className="text-xs font-semibold text-[#19191A]">
                            Выберите папки для этой записи:
                          </div>
                          {myProfileFolders.length === 0 ? (
                            <p className="text-xs text-[#818C99]">
                              У вас ещё нет папок. Нажмите «+ Создать папку» выше!
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {myProfileFolders.map(folder => {
                                const inFolder = folder.postIds?.includes(post.postId);
                                return (
                                  <button
                                    key={folder.folderId}
                                    type="button"
                                    onClick={() => togglePostInFolder(folder.folderId, post.postId)}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border ${
                                      inFolder
                                        ? 'bg-[#E5EBF1] border-[#0077FF]/40 text-[#0077FF]'
                                        : 'bg-white border-[#E1E3E6] text-[#656565] hover:text-[#19191A]'
                                    }`}
                                  >
                                    {inFolder ? (
                                      <Check className="w-3.5 h-3.5 text-[#0077FF]" />
                                    ) : (
                                      <Folder className="w-3.5 h-3.5 text-[#818C99]" />
                                    )}
                                    <span>{folder.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {editingPostId === post.postId ? (
                        <div className="space-y-2 bg-[#F7F8FA] p-3 rounded-xl border border-[#E1E3E6]">
                          <textarea
                            value={editingPostText}
                            onChange={e => setEditingPostText(e.target.value)}
                            rows={3}
                            className="v7-input text-xs resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPostId(null)}
                              className="px-3 py-1.5 rounded-lg bg-[#EDEFEF] text-xs text-[#656565] cursor-pointer"
                            >
                              Отмена
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSavePostEdit(post.postId)}
                              className="px-3 py-1.5 rounded-lg bg-[#0077FF] text-xs font-semibold text-white cursor-pointer"
                            >
                              Сохранить
                            </button>
                          </div>
                        </div>
                      ) : (
                        post.content && (
                          <p className="text-[14px] text-[#19191A] leading-relaxed whitespace-pre-wrap break-words">
                            {post.content}
                          </p>
                        )
                      )}

                      <PostMediaViewer post={post} />

                      {/* Кнопки Лайк и Комментарии в стиле ВК */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleLikePost(post)}
                          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                            isLiked
                              ? 'bg-[#FFEAEA] text-[#E64646]'
                              : 'bg-[#F0F2F5] text-[#656565] hover:bg-[#E5E7EB]'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                          <span>{post.likesCount}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleCommentsSection(post)}
                          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                            openCommentsPostIds[post.postId]
                              ? 'bg-[#E5EBF1] text-[#0077FF]'
                              : 'bg-[#F0F2F5] text-[#656565] hover:bg-[#E5E7EB]'
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>{post.commentsCount}</span>
                        </button>
                      </div>

                      {/* Выпадающий блок комментариев */}
                      {Boolean(openCommentsPostIds[post.postId]) && (
                        <div className="space-y-2.5 pt-2 border-t border-[#F2F3F5]">
                          {comments.length > 0 ? (
                            <div className="space-y-2">
                              {comments.map((comment: PostComment) => {
                                const isMyComment = Boolean(
                                  profile?.uid && comment.authorId === profile.uid
                                );
                                const commentLiked = Boolean(commentLikesByMe[comment.commentId]);
                                const commentLikes = commentLikesCount[comment.commentId] || 0;

                                return (
                                  <div
                                    key={comment.commentId}
                                    className="flex items-start gap-2.5 text-xs"
                                  >
                                    <img
                                      src={comment.authorAvatar}
                                      alt={comment.authorName}
                                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 border border-[#E1E3E6]"
                                    />
                                    <div className="flex-1 bg-[#F5F6F8] rounded-xl p-2.5">
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className="font-semibold text-[#2A5885]">
                                          {comment.authorName}
                                        </span>
                                        <span className="text-[10px] text-[#818C99]">
                                          {formatTime(comment.createdAt)}
                                        </span>
                                      </div>

                                      {editingCommentId === comment.commentId ? (
                                        <div className="space-y-2 mt-1">
                                          <input
                                            type="text"
                                            value={editingCommentText}
                                            onChange={e => setEditingCommentText(e.target.value)}
                                            className="v7-input text-xs py-1.5"
                                          />
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => setEditingCommentId(null)}
                                              className="px-2.5 py-1 rounded-md bg-[#EDEFEF] text-[11px] text-[#656565] cursor-pointer"
                                            >
                                              Отмена
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveCommentEdit(post, comment)}
                                              className="px-2.5 py-1 rounded-md bg-[#0077FF] text-[11px] text-white font-semibold cursor-pointer"
                                            >
                                              Сохранить
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-[#19191A] break-words">
                                          {comment.content}
                                        </p>
                                      )}

                                      <div className="flex items-center gap-3 mt-1.5">
                                        <button
                                          type="button"
                                          onClick={() => toggleLikeComment(comment.commentId)}
                                          className={`flex items-center gap-1 text-[11px] font-medium cursor-pointer ${
                                            commentLiked
                                              ? 'text-[#E64646]'
                                              : 'text-[#818C99] hover:text-[#E64646]'
                                          }`}
                                        >
                                          <Heart
                                            className={`w-3 h-3 ${
                                              commentLiked ? 'fill-current' : ''
                                            }`}
                                          />
                                          <span>{commentLikes > 0 ? commentLikes : 'Нравится'}</span>
                                        </button>

                                        {isMyComment && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingCommentId(comment.commentId);
                                                setEditingCommentText(comment.content);
                                              }}
                                              className="flex items-center gap-1 text-[11px] text-[#818C99] hover:text-[#0077FF] cursor-pointer"
                                            >
                                              <Pencil className="w-2.5 h-2.5" />
                                              <span>Изм.</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => deleteComment(post, comment)}
                                              className="flex items-center gap-1 text-[11px] text-[#818C99] hover:text-[#E64646] cursor-pointer"
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                              <span>Удалить</span>
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-[#818C99] px-1">
                              Комментариев пока нет. Напишите первый!
                            </div>
                          )}

                          <form
                            onSubmit={e => handleAddComment(post, e)}
                            className="flex items-center gap-2 pt-1"
                          >
                            <input
                              type="text"
                              placeholder="Написать комментарий..."
                              value={commentInputs[post.postId] || ''}
                              onChange={e =>
                                setCommentInputs({
                                  ...commentInputs,
                                  [post.postId]: e.target.value,
                                })
                              }
                              className="v7-input text-xs py-2 rounded-full"
                            />
                            <button
                              type="submit"
                              className="p-2 rounded-full bg-[#0077FF] hover:bg-[#0066EA] text-white cursor-pointer shrink-0"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            ЭКРАН 3: НАСТРОЙКИ (настройки профиля, пароль, PIN-код, приватность, обои)
        ===================================================================== */}
        {section === 'settings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 bg-white border border-[#E1E3E6] rounded-xl p-3.5 shadow-xs">
              <button
                type="button"
                onClick={() => setSection('profile')}
                className="px-3.5 py-1.5 rounded-[8px] bg-[#EDEFEF] hover:bg-[#E2E5E8] text-xs font-semibold text-[#2C3138] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-[#0077FF]" />
                <span>К моей странице</span>
              </button>
              <h2 className="text-sm font-bold text-[#19191A]">Настройки аккаунта и тема</h2>
            </div>

            {/* [00.1] УСТАНОВКА ПРИЛОЖЕНИЯ И СОЗДАНИЕ ЯРЛЫКА НА ПК / ТЕЛЕФОНЕ */}
            <div className="bg-[#EBF3FF] border border-[#0077FF]/30 rounded-xl p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0077FF] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0B1E36] flex items-center gap-1.5">
                      <span>Установить приложение Mender</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#0077FF] text-white">
                        PWA / ЯРЛЫК
                      </span>
                    </h3>
                    <p className="text-xs text-[#1E3A8A] mt-0.5">
                      Запускайте Mender прямо с рабочего стола или главного экрана телефона как отдельное удобное приложение без лишних вкладок браузера.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isInstallable && (
                    <button
                      type="button"
                      onClick={() => installApp()}
                      className="px-4 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Установить 1 кликом</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowInstallGuideModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F4F8FF] border border-[#0077FF]/40 text-[#0077FF] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Инструкция: Создать ярлык</span>
                  </button>
                </div>
              </div>

              {/* Пошаговая краткая подсказка */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-white/80 border border-[#0077FF]/20 text-xs space-y-1">
                  <div className="font-bold text-[#0077FF] flex items-center gap-1">
                    <span>1. Меню браузера</span>
                  </div>
                  <p className="text-[#3B4E66] text-[11px] leading-snug">
                    Нажмите три точки <strong>«⋮»</strong> в правом верхнем углу браузера (Chrome / Yandex / Edge).
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-white/80 border border-[#0077FF]/20 text-xs space-y-1">
                  <div className="font-bold text-[#0077FF] flex items-center gap-1">
                    <span>2. Создать ярлык</span>
                  </div>
                  <p className="text-[#3B4E66] text-[11px] leading-snug">
                    Выберите <strong>«Сохранить и поделиться»</strong> → <strong>«Создать ярлык приложения...»</strong>.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-white/80 border border-[#0077FF]/20 text-xs space-y-1">
                  <div className="font-bold text-[#0077FF] flex items-center gap-1">
                    <span>3. В отдельном окне</span>
                  </div>
                  <p className="text-[#3B4E66] text-[11px] leading-snug">
                    Поставьте галочку <strong>«Открывать в отдельном окне»</strong> и нажмите <strong>«Создать»</strong>!
                  </p>
                </div>
              </div>
            </div>

            {/* [00] ТЕМА ИНТЕРФЕЙСА: СВЕТЛАЯ | ТЁМНАЯ | СВОЙ ВАРИАНТ */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 shadow-xs space-y-4">
              <div>
                <div className="text-xs font-semibold text-[#818C99] uppercase tracking-wider mb-1">
                  Тема интерфейса Mender
                </div>
                <p className="text-xs text-[#626D7A]">
                  Выберите светлую версию, тёмную версию или установите свой цвет и картинку на фон всего приложения
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    themeMode === 'light'
                      ? 'bg-[#0077FF] text-white border-[#0077FF] shadow-xs'
                      : 'bg-[#F7F8FA] text-[#19191A] border-[#E1E3E6] hover:border-[#0077FF]'
                  }`}
                >
                  <Sun className="w-4 h-4 shrink-0" />
                  <span>Светлая</span>
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    themeMode === 'dark'
                      ? 'bg-[#0077FF] text-white border-[#0077FF] shadow-xs'
                      : 'bg-[#F7F8FA] text-[#19191A] border-[#E1E3E6] hover:border-[#0077FF]'
                  }`}
                >
                  <Moon className="w-4 h-4 shrink-0" />
                  <span>Тёмная</span>
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode('custom')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    themeMode === 'custom'
                      ? 'bg-[#0077FF] text-white border-[#0077FF] shadow-xs'
                      : 'bg-[#F7F8FA] text-[#19191A] border-[#E1E3E6] hover:border-[#0077FF]'
                  }`}
                >
                  <Palette className="w-4 h-4 shrink-0" />
                  <span>Свой</span>
                </button>
              </div>

              {themeMode === 'custom' && (
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#19191A]">
                      Свой цвет фона приложения:
                    </span>
                    <div className="flex items-center gap-2">
                      {[
                        { hex: '#1E293B', label: 'Сапфир' },
                        { hex: '#0F172A', label: 'Ночь' },
                        { hex: '#1E1B4B', label: 'Индиго' },
                        { hex: '#064E3B', label: 'Изумруд' },
                        { hex: '#3B071E', label: 'Бордо' },
                        { hex: '#EAE4F7', label: 'Лаванда' },
                        { hex: '#F5EFE6', label: 'Песочный' },
                        { hex: '#E0F2FE', label: 'Небо' },
                      ].map(p => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setCustomThemeBgColor(p.hex)}
                          className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${
                            customThemeBgColor === p.hex
                              ? 'scale-110 ring-2 ring-[#0077FF]'
                              : 'border-[#E1E3E6]'
                          }`}
                          style={{ backgroundColor: p.hex }}
                          title={p.label}
                        />
                      ))}
                      <input
                        type="color"
                        value={customThemeBgColor}
                        onChange={e => setCustomThemeBgColor(e.target.value)}
                        className="w-7 h-7 rounded-lg cursor-pointer border border-[#E1E3E6] bg-transparent"
                        title="Выбрать любой свой цвет"
                      />
                    </div>
                  </div>

                  {/* Стиль карточек поверх своего фона */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-[#E1E3E6]">
                    <span className="text-xs font-semibold text-[#19191A]">
                      Карточки поверх вашего фона:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomThemeCardTone('light')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                          customThemeCardTone === 'light'
                            ? 'bg-[#0077FF] text-white border-[#0077FF]'
                            : 'bg-white text-[#19191A] border-[#E1E3E6]'
                        }`}
                      >
                        Светлые карточки
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomThemeCardTone('dark')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                          customThemeCardTone === 'dark'
                            ? 'bg-[#0077FF] text-white border-[#0077FF]'
                            : 'bg-white text-[#19191A] border-[#E1E3E6]'
                        }`}
                      >
                        Тёмные карточки
                      </button>
                    </div>
                  </div>

                  {/* Своя картинка на фон всего интерфейса */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-[#E1E3E6]">
                    <input
                      ref={customThemeFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCustomThemeImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => customThemeFileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Своё фото на фон интерфейса</span>
                    </button>

                    {customThemeBgImage && (
                      <button
                        type="button"
                        onClick={() => setCustomThemeBgImage('')}
                        className="px-3 py-2 rounded-lg bg-[#FFEAEA] text-[#E64646] text-xs font-semibold cursor-pointer"
                      >
                        Убрать фото с фона
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* [01] PROFILE SETTINGS */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-[#818C99] uppercase tracking-wider mb-3">
                Основные данные профиля
              </div>

              <div className="flex items-center gap-4 mb-5">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative w-16 h-16 rounded-full bg-[#EDEFEF] border border-[#E1E3E6] overflow-hidden shrink-0 cursor-pointer group"
                >
                  {profile?.avatarUrl && (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                    <Camera className="w-5 h-5" />
                  </div>
                </div>

                <div>
                  <div className="text-base font-bold text-[#19191A] leading-tight">
                    {profile?.displayName || 'Пользователь'}
                  </div>
                  <div className="text-xs text-[#818C99] mt-0.5">
                    {contactSubtitle}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Ваше имя"
                    className="v7-input"
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="@mender_user"
                    className="v7-input"
                  />
                </div>

                <input
                  type="text"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="О себе (статус или описание страницы)"
                  className="v7-input"
                />

                {savedSuccess && (
                  <div className="text-xs font-semibold text-[#2E7D32] flex items-center gap-1.5 py-1">
                    <Check className="w-4 h-4" />
                    <span>Данные страницы сохранены</span>
                  </div>
                )}

                <div className="v7-btn-list pt-1">
                  <button type="submit" className="v7-btn">
                    <Save className="w-4 h-4 shrink-0" />
                    <span>Сохранить изменения</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="v7-btn-secondary"
                  >
                    <Camera className="w-4 h-4 shrink-0 text-[#0077FF]" />
                    <span>Загрузить новую фотографию</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWallpaperModal(true)}
                    className="v7-btn-secondary"
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-[#0077FF]" />
                    <span>Оформление и фоны чатов</span>
                  </button>
                </div>
              </form>
            </div>

            {/* [02] ACCOUNT PASSWORD */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-semibold text-[#818C99] uppercase tracking-wider">
                  Пароль аккаунта
                </div>
                {Boolean(privateData?.passwordHash) && (
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      isPasswordRecoveryMode
                        ? 'bg-[#FFF4E5] text-[#B76E00]'
                        : 'bg-[#E5F1FF] text-[#0077FF]'
                    }`}
                  >
                    {isPasswordRecoveryMode
                      ? 'Сброс после 5 попыток'
                      : `Попыток: ${5 - failedPasswordAttempts} из 5`}
                  </span>
                )}
              </div>

              <div className="font-semibold text-sm text-[#19191A] mb-1">
                {!privateData?.passwordHash
                  ? 'Установить пароль от аккаунта'
                  : isPasswordRecoveryMode
                  ? 'Введите новый пароль и подтвердите'
                  : 'Сменить пароль от аккаунта'}
              </div>
              <p className="text-xs text-[#818C99] mb-3">
                {!privateData?.passwordHash
                  ? 'Придумайте новый пароль (минимум 6 символов) и подтвердите его.'
                  : isPasswordRecoveryMode
                  ? 'Вы не вспомнили текущий пароль за 5 попыток. Введите сразу новый пароль и подтвердите его ниже.'
                  : 'По умолчанию введите текущий пароль. Если вы не вспомните его за 5 попыток — откроется ввод нового пароля с подтверждением.'}
              </p>

              <form onSubmit={handleSavePassword} className="space-y-3">
                {Boolean(privateData?.passwordHash) && !isPasswordRecoveryMode ? (
                  <>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Введите текущий пароль *"
                      className="v7-input"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Введите новый пароль (от 8 символов, буквы + цифры)"
                      className="v7-input"
                    />
                  </>
                ) : (
                  <>
                    {Boolean(privateData?.passwordHash) && isPasswordRecoveryMode && (
                      <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#19191A]">
                            Одноразовый защитный код:
                          </span>
                          <span className="font-mono font-extrabold text-sm text-[#0077FF] tracking-widest">
                            {settingsRecoveryOtp}
                          </span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={enteredSettingsOtp}
                          onChange={e => setEnteredSettingsOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="Введите 6-значный защитный код *"
                          className="v7-input font-mono tracking-widest"
                        />
                        {privateData?.pinHash ? (
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={8}
                            value={enteredSettingsPin2FA}
                            onChange={e =>
                              setEnteredSettingsPin2FA(e.target.value.replace(/\D/g, ''))
                            }
                            placeholder="Введите ваш 2FA PIN-код безопасности *"
                            className="v7-input font-mono"
                          />
                        ) : (
                          <input
                            type="text"
                            value={enteredSettingsUsername}
                            onChange={e => setEnteredSettingsUsername(e.target.value)}
                            placeholder="Подтвердите ваш @username владельца *"
                            className="v7-input"
                          />
                        )}
                      </div>
                    )}

                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Введите новый пароль (от 8 символов, буквы + цифры)"
                      className="v7-input"
                    />
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                      placeholder="Подтвердите новый пароль"
                      className="v7-input"
                    />
                  </>
                )}

                {/* Шкала надёжности нового пароля */}
                {newPassword.length > 0 && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 gap-1">
                      {[1, 2, 3, 4].map(level => {
                        const score = getPasswordStrengthScore(newPassword);
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
                    <p className="text-[11px] text-[#818C99]">
                      Минимум 8 символов, обязательно сочетание букв и цифр, отличие от старого пароля.
                    </p>
                  </div>
                )}

                {passwordErrorMessage && (
                  <div className="text-xs font-semibold text-[#E64646] bg-[#FFEAEA] border border-[#FFCCCC] rounded-xl px-3 py-2">
                    {passwordErrorMessage}
                  </div>
                )}

                {passwordSavedMessage && (
                  <div className="text-xs font-semibold text-[#2E7D32] bg-[#E8F9E8] border border-[#C8E6C9] rounded-xl px-3 py-2">
                    {passwordSavedMessage}
                  </div>
                )}

                <div className="v7-btn-list">
                  <button
                    type="submit"
                    disabled={
                      newPassword.length < 8 ||
                      (Boolean(privateData?.passwordHash) && !isPasswordRecoveryMode
                        ? !currentPassword
                        : !confirmNewPassword)
                    }
                    className="v7-btn"
                  >
                    <Save className="w-4 h-4 shrink-0" />
                    <span>
                      {Boolean(privateData?.passwordHash) && !isPasswordRecoveryMode
                        ? 'Изменить пароль аккаунта'
                        : 'Подтвердить защиту и сохранить новый пароль'}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* [03] 2FA CLOUD PIN-CODE */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-[#818C99] uppercase tracking-wider mb-2">
                Двухфакторная защита (2FA PIN-код)
              </div>
              <div className="font-semibold text-sm text-[#19191A] mb-1">
                {hasPin ? '2FA PIN-код активен' : 'Подключить 2FA PIN-код'}
              </div>
              <p className="text-xs text-[#818C99] mb-3">
                {hasPin
                  ? 'Запрашивается вторым шагом при входе и при блокировке экрана.'
                  : 'Установите PIN-код (4–8 цифр) для защиты входа и быстрой блокировки экрана.'}
              </p>

              <form onSubmit={handleSavePin} className="space-y-3">
                {hasPin && (
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Введите текущий PIN-код для подтверждения *"
                    className="v7-input font-mono"
                  />
                )}

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Введите новый PIN-код (4–8 цифр)"
                  className="v7-input font-mono"
                />

                {pinErrorMessage && (
                  <div className="text-xs font-semibold text-[#E64646] bg-[#FFEAEA] border border-[#FFCCCC] rounded-xl px-3 py-2">
                    {pinErrorMessage}
                  </div>
                )}

                {pinSavedMessage && (
                  <div className="text-xs font-semibold text-[#2E7D32] bg-[#E8F9E8] border border-[#C8E6C9] rounded-xl px-3 py-2">
                    {pinSavedMessage}
                  </div>
                )}

                <div className="v7-btn-list">
                  <button
                    type="submit"
                    disabled={newPin.length < 4 || (hasPin && currentPin.length < 4)}
                    className="v7-btn"
                  >
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>{hasPin ? 'Изменить 2FA PIN-код' : 'Включить 2FA PIN-код'}</span>
                  </button>

                  {hasPin && (
                    <button
                      type="button"
                      onClick={lockSessionWithPin}
                      className="v7-btn-secondary"
                    >
                      <Lock className="w-4 h-4 shrink-0 text-[#0077FF]" />
                      <span>Заблокировать экран сейчас</span>
                    </button>
                  )}

                  {hasPin && (
                    <button
                      type="button"
                      disabled={currentPin.length < 4}
                      onClick={handleDisablePin}
                      className="v7-btn-danger disabled:opacity-40"
                    >
                      <KeyRound className="w-4 h-4 shrink-0" />
                      <span>Отключить 2FA PIN-код</span>
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* [03.5] АКТИВНЫЕ СЕАНСЫ И УСТРОЙСТВА */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[#818C99] uppercase tracking-wider mb-1">
                    Активные сеансы и устройства ({userSessions.length})
                  </div>
                  <p className="text-xs text-[#626D7A]">
                    Просмотр всех подсоединённых устройств, браузеров и IP-адресов. Завершите лишние или подозрительные сеансы в один клик.
                  </p>
                </div>
                {userSessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Вы уверены, что хотите завершить все остальные сеансы на других устройствах?')) {
                        terminateAllOtherSessions();
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#FFEAEA] hover:bg-[#FFD6D6] text-[#E64646] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Завершить все остальные сеансы</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 pt-1">
                {(userSessions.length > 0
                  ? userSessions
                  : [
                      {
                        sessionId: currentSessionId,
                        userId: profile?.uid || '',
                        device: getDeviceDetailsString(),
                        ip: '178.154.201.55',
                        status: 'active' as const,
                      },
                    ]
                ).map(session => {
                  const isCurrent = session.sessionId === currentSessionId;
                  const resolvedDeviceName = session.device || getDeviceDetailsString();
                  const isMobile =
                    resolvedDeviceName.includes('Android') ||
                    resolvedDeviceName.includes('iOS') ||
                    resolvedDeviceName.includes('iPhone') ||
                    resolvedDeviceName.includes('Mobile');

                  return (
                    <div
                      key={session.sessionId}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors bg-[#F7F8FA] ${
                        isCurrent
                          ? 'border-[#0077FF] ring-1 ring-[#0077FF]/30'
                          : 'border-[#E1E3E6]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-[#0077FF] text-white shadow-xs'
                              : 'bg-[#EDEFEF] text-[#626D7A]'
                          }`}
                        >
                          {isMobile ? (
                            <Smartphone className="w-5 h-5" />
                          ) : (
                            <Laptop className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#19191A] break-words">
                              Устройство: {resolvedDeviceName}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0077FF] text-white shrink-0">
                                главное устройство (текущий сеанс)
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#626D7A] mt-1">
                            <span className="font-mono text-[#0077FF] flex items-center gap-1 font-semibold">
                              <Globe className="w-3.5 h-3.5" />
                              IP: {session.ip || '178.154.201.55'}
                            </span>
                            <span className="flex items-center gap-1 text-[#19191A] font-medium">
                              <Clock className="w-3.5 h-3.5 text-[#4BB34B]" />
                              {isCurrent ? 'В сети сейчас' : 'Активен недавно'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => terminateSession(session.sessionId)}
                          className="px-3 py-1.5 rounded-lg bg-[#FFEAEA] hover:bg-[#FFD6D6] text-[#E64646] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                          title="Завершить сеанс на этом устройстве"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Завершить</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* [04] PREFERENCES */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-[#818C99] uppercase tracking-wider mb-3">
                Приватность и уведомления
              </div>

              <div className="flex flex-col gap-3">
                <div className="pt-1 pb-1">
                  <button
                    type="button"
                    onClick={() => setShowWallpaperModal(true)}
                    className="v7-btn-secondary"
                  >
                    <Sparkles className="w-4 h-4 text-[#0077FF] shrink-0" />
                    <span>Настроить фон в чатах</span>
                  </button>
                </div>

                <label className="flex items-center justify-between py-1.5 cursor-pointer text-sm text-[#19191A]">
                  <span>Уведомления о сообщениях и звонках</span>
                  <input
                    type="checkbox"
                    checked={privateData?.notificationsEnabled ?? true}
                    onChange={e =>
                      updatePrivatePreferences({ notificationsEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#0077FF] cursor-pointer"
                  />
                </label>

                <div className="flex items-center justify-between py-1.5 text-sm text-[#19191A]">
                  <span>Кто видит мой статус «В сети»</span>
                  <select
                    value={profile?.privacyLastSeen || 'everyone'}
                    onChange={e =>
                      updatePublicProfile({ privacyLastSeen: e.target.value as PrivacyLevel })
                    }
                    className="bg-[#F2F3F5] border border-[#DCE1E6] rounded-lg text-xs text-[#19191A] px-3 py-1.5 focus:outline-none focus:border-[#0077FF]"
                  >
                    <option value="everyone">Все</option>
                    <option value="contacts">Только контакты</option>
                    <option value="nobody">Никто</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-1.5 text-sm text-[#19191A]">
                  <span>Кто может звонить мне</span>
                  <select
                    value={profile?.privacyCalls || 'everyone'}
                    onChange={e =>
                      updatePublicProfile({ privacyCalls: e.target.value as PrivacyLevel })
                    }
                    className="bg-[#F2F3F5] border border-[#DCE1E6] rounded-lg text-xs text-[#19191A] px-3 py-1.5 focus:outline-none focus:border-[#0077FF]"
                  >
                    <option value="everyone">Все</option>
                    <option value="contacts">Только контакты</option>
                    <option value="nobody">Никто</option>
                  </select>
                </div>
              </div>
            </div>

            {/* [05] BLOCKLIST */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-[#818C99] uppercase tracking-wider mb-3">
                Чёрный список ({blocks.length})
              </div>
              {blocks.length === 0 ? (
                <p className="text-xs text-[#818C99]">У вас нет заблокированных пользователей.</p>
              ) : (
                <div className="v7-btn-list">
                  {blocks.map(block => {
                    const blockedUser = usersDirectory.find(u => u.uid === block.blockedUserId);
                    return (
                      <div
                        key={block.blockedUserId}
                        className="flex flex-col gap-2 p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6]"
                      >
                        <span className="text-xs font-semibold text-[#19191A]">
                          {blockedUser
                            ? `${blockedUser.displayName} (@${blockedUser.username})`
                            : block.blockedUserId}
                        </span>
                        <button
                          type="button"
                          onClick={() => unblockUser(block.blockedUserId)}
                          className="v7-btn-secondary"
                        >
                          <Ban className="w-4 h-4 shrink-0 text-[#0077FF]" />
                          <span>Разблокировать пользователя</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showWallpaperModal && (
        <WallpaperStudioModal onClose={() => setShowWallpaperModal(false)} />
      )}
      {createChatModalType && (
        <CreateGroupModal
          defaultType={createChatModalType}
          onClose={() => setCreateChatModalType(null)}
        />
      )}
      {showInstallGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl border border-[#E1E3E6] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E1E3E6] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0077FF] text-white flex items-center justify-center font-bold">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#19191A]">Установка Mender (Создать ярлык)</h3>
                  <p className="text-xs text-[#626D7A]">Инструкция по установке приложения на ПК и телефон</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="p-1 rounded-lg text-[#818C99] hover:bg-[#EDEFEF] hover:text-[#19191A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-[#2C3138]">
              {isInstallable && (
                <div className="p-3.5 rounded-xl bg-[#E5F1FF] border border-[#B8D9FF] space-y-2">
                  <div className="font-bold text-[#0077FF] flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>Автоматическая установка доступна!</span>
                  </div>
                  <p className="text-[#19191A]">
                    Ваш браузер позволяет установить Mender в 1 клик прямо сейчас:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInstallGuideModal(false);
                      installApp();
                    }}
                    className="v7-btn justify-center py-2 text-xs"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Установить Mender на рабочий стол</span>
                  </button>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-2">
                <div className="font-bold text-[#19191A] flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-[#0077FF]" />
                  <span>Инструкция для компьютера (Windows / Mac / Linux):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-[#505965] pl-1">
                  <li>В правом верхнем углу браузера нажмите <strong>«⋮» (три точки)</strong> или иконку плюса <strong>«⊕»</strong> в адресной строке.</li>
                  <li>Перейдите в пункт <strong>«Сохранить и поделиться»</strong> → <strong>«Создать ярлык приложения...»</strong> (или «Установить Mender»).</li>
                  <li>В появившемся окне поставьте галочку <strong>«Открывать в отдельном окне»</strong>.</li>
                  <li>Нажмите синюю кнопку <strong>«Создать»</strong> — ярлык Mender появится на вашем рабочем столе и в меню «Пуск»!</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-2">
                <div className="font-bold text-[#19191A] flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#0077FF]" />
                  <span>Инструкция для телефонов (Android / iOS):</span>
                </div>
                <p className="text-[#505965] leading-relaxed">
                  • <strong>Android:</strong> Нажмите <strong>«⋮»</strong> в углу браузера → <strong>«Добавить на главный экран»</strong>.<br />
                  • <strong>iPhone (Safari):</strong> Нажмите иконку <strong>«Поделиться»</strong> (квадрат со стрелкой вверх) → <strong>«На экран Домой»</strong>.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="v7-btn justify-center"
              >
                <span>Понятно</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
