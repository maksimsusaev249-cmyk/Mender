import React, { useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useVideo } from '../../context/VideoContext';
import { useMusic } from '../../context/MusicContext';
import {
  Search,
  Film,
  Music,
  Users,
  Radio,
  PhoneCall,
  UserCheck,
  Star,
  Settings,
  Sparkles,
  BarChart3,
  Smartphone,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
  Heart,
  Play,
  Pause,
  Upload,
  Folder,
  CheckCircle2,
  UserPlus,
  X,
  Newspaper,
  User,
  Volume2,
  Trash2,
} from 'lucide-react';
import {
  APP_VERSION_FULL,
  APP_BUILD_NUMBER,
  APK_SIZE_LABEL,
  OFFICIAL_MENDER_NEWS_POSTS,
} from '../../version';
import { PostMediaViewer } from '../feed/PostMediaViewer';
import { VideoCard } from '../video/VideoCard';
import { CreateGroupModal } from '../chats/CreateGroupModal';

type MenuSubSection = 'hub' | 'contacts' | 'favorites' | 'music';
type SearchCategory =
  | 'all'
  | 'people'
  | 'chats'
  | 'communities'
  | 'channels'
  | 'posts'
  | 'videos';

interface LocalAudioTrack {
  id: string;
  title: string;
  artist: string;
  durationLabel: string;
  url: string;
  addedAt: string;
}

const DEFAULT_MENDER_TRACKS: LocalAudioTrack[] = [
  {
    id: 'mender_synth_1',
    title: 'Mender Ambient Wave (Официальная тема)',
    artist: 'Mender Sound Lab',
    durationLabel: '0:18',
    url: '',
    addedAt: 'Встроенный трек',
  },
  {
    id: 'mender_synth_2',
    title: 'Night Messenger Lo-Fi',
    artist: 'Mender Audio',
    durationLabel: '0:24',
    url: '',
    addedAt: 'Встроенный трек',
  },
];

export const MenuHubView: React.FC = () => {
  const {
    chats,
    publicChannelsAndGroups,
    messages,
    posts,
    postLikesByMe,
    usersDirectory,
    myProfileFolders,
    callHistory,
    setActiveTab,
    setActiveChatId,
    openUserProfile,
    startDirectChatWithUser,
    startCall,
    toggleLikePost,
  } = useChat();

  const { profile, themeMode, privateData, isUserBlocked, isSubscribed, toggleSubscription } =
    useAuth();

  const {
    publicVideos,
    myVideos,
    allAccessibleVideos,
    myPlaylists,
    openVideoPlayer,
    openUploadStudio,
    setVideoSubView,
  } = useVideo();

  const { allTracks: musicTracks } = useMusic();

  const [subSection, setSubSection] = useState<MenuSubSection>('hub');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('all');
  const [contactsFilter, setContactsFilter] = useState('');
  const [favoritesTab, setFavoritesTab] = useState<'posts' | 'videos' | 'folders'>('posts');
  const [createChatModalType, setCreateChatModalType] = useState<
    'direct' | 'group' | 'channel' | null
  >(null);

  // Music & Audio Player state
  const [customTracks, setCustomTracks] = useState<LocalAudioTrack[]>(() => {
    try {
      const saved = localStorage.getItem('mender_custom_audio_tracks_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthCtxRef = useRef<AudioContext | null>(null);
  const synthTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  const isDark = themeMode === 'dark' || Boolean(privateData?.darkMode);

  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (synthTimerRef.current) {
      window.clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
    if (synthCtxRef.current) {
      synthCtxRef.current.close().catch(() => {});
      synthCtxRef.current = null;
    }
    setPlayingTrackId(null);
  };

  const handlePlayTrack = (track: LocalAudioTrack) => {
    if (playingTrackId === track.id) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    if (track.url) {
      const audio = new Audio(track.url);
      audioRef.current = audio;
      setPlayingTrackId(track.id);
      audio.onended = () => setPlayingTrackId(null);
      audio.play().catch(() => setPlayingTrackId(null));
      return;
    }

    // Web Audio API ambient synth for built-in Mender tracks (works 100% offline without external MP3 dependencies)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      synthCtxRef.current = ctx;
      setPlayingTrackId(track.id);

      const notes =
        track.id === 'mender_synth_1'
          ? [261.63, 329.63, 392.0, 523.25, 392.0, 329.63]
          : [220.0, 277.18, 329.63, 440.0, 329.63, 277.18];
      let step = 0;

      const playNote = () => {
        if (!synthCtxRef.current) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[step % notes.length], ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
        step += 1;
        if (step >= 24) {
          stopAllAudio();
        }
      };

      playNote();
      synthTimerRef.current = window.setInterval(playNote, 600);
    } catch {
      setPlayingTrackId(null);
    }
  };

  const handleUploadAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const newTrack: LocalAudioTrack = {
      id: `aud_${Date.now()}`,
      title: cleanName || 'Аудиозапись',
      artist: profile?.displayName || 'Моя медиатека',
      durationLabel: 'Аудиофайл',
      url,
      addedAt: new Date().toLocaleDateString('ru-RU'),
    };
    setCustomTracks(prev => {
      const next = [newTrack, ...prev];
      try {
        localStorage.setItem('mender_custom_audio_tracks_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    if (e.target) e.target.value = '';
  };

  const handleDeleteAudioTrack = (id: string) => {
    if (playingTrackId === id) stopAllAudio();
    setCustomTracks(prev => {
      const next = prev.filter(t => t.id !== id);
      try {
        localStorage.setItem('mender_custom_audio_tracks_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Search filtering logic across ALL Mender entities
  const q = searchQuery.trim().toLowerCase();

  const allCombinedChats = Array.from(
    new Map([...chats, ...publicChannelsAndGroups].map(c => [c.chatId, c])).values()
  );

  const matchedUsers = q
    ? usersDirectory.filter(
        u =>
          !isUserBlocked(u.uid) &&
          (u.displayName.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q) ||
            (u.bio && u.bio.toLowerCase().includes(q)))
      )
    : [];

  const matchedDirectAndMessages = q
    ? allCombinedChats.filter(
        c =>
          c.type === 'direct' &&
          (c.name.toLowerCase().includes(q) ||
            (c.lastMessageText && c.lastMessageText.toLowerCase().includes(q)))
      )
    : [];

  const matchedMessagesInActiveChat = q
    ? messages.filter(m => m.content && m.content.toLowerCase().includes(q))
    : [];

  const matchedCommunities = q
    ? allCombinedChats.filter(
        c =>
          c.type === 'group' &&
          (c.name.toLowerCase().includes(q) ||
            (c.description && c.description.toLowerCase().includes(q)))
      )
    : [];

  const matchedOfficialCommunity =
    q &&
    ('mender'.includes(q) ||
      'официальное сообщество'.includes(q) ||
      'новости'.includes(q) ||
      'обновления'.includes(q));

  const matchedChannels = q
    ? allCombinedChats.filter(
        c =>
          c.type === 'channel' &&
          (c.name.toLowerCase().includes(q) ||
            (c.description && c.description.toLowerCase().includes(q)))
      )
    : [];

  const matchedPosts = q
    ? posts.filter(
        p =>
          !isUserBlocked(p.authorId) &&
          (p.content?.toLowerCase().includes(q) ||
            p.authorName?.toLowerCase().includes(q) ||
            p.authorUsername?.toLowerCase().includes(q))
      )
    : [];

  const matchedVideos = q
    ? allAccessibleVideos.filter(
        v =>
          !isUserBlocked(v.authorId) &&
          (v.title.toLowerCase().includes(q) ||
            v.description?.toLowerCase().includes(q) ||
            v.authorName.toLowerCase().includes(q) ||
            v.hashtags?.some(tag => tag.toLowerCase().includes(q)))
      )
    : [];

  const likedPostsList = posts.filter(p => Boolean(postLikesByMe[p.postId]));
  const voiceAndAudioMessages = messages.filter(
    m => m.type === 'voice' || (m.mediaUrl && m.mediaUrl.match(/\.(mp3|wav|ogg|m4a|webm)$/i))
  );

  const openOfficialCommunity = () => {
    try {
      sessionStorage.setItem('mender_open_official_community', '1');
    } catch {
      // ignore
    }
    setActiveTab('channels');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mender:open-official-community'));
    }, 30);
  };

  const openChannelsWithFilter = (filter: 'all' | 'groups' | 'channels') => {
    try {
      sessionStorage.setItem('mender_channels_filter', filter);
    } catch {
      // ignore
    }
    setActiveTab('channels');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mender:channels-filter', { detail: filter }));
    }, 30);
  };

  const openSettingsSection = (target: 'profile' | 'settings') => {
    setActiveTab('settings');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mender:profile-section', { detail: target }));
    }, 30);
  };

  // Sub-view: CONTACTS (👤 Контакты)
  if (subSection === 'contacts') {
    const cq = contactsFilter.trim().toLowerCase();
    const contactsList = usersDirectory.filter(
      u =>
        u.uid !== profile?.uid &&
        !isUserBlocked(u.uid) &&
        (!cq ||
          u.displayName.toLowerCase().includes(cq) ||
          u.username.toLowerCase().includes(cq))
    );

    return (
      <div className="flex-1 bg-[#EDEEF0] p-3 sm:p-6 overflow-y-auto select-none text-[#19191A]">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-white border border-[#E1E3E6] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSubSection('hub')}
                className="p-2 rounded-xl bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-base sm:text-lg font-bold">Контакты и люди</h1>
                <p className="text-xs text-[#818C99]">
                  Пользователи Mender ({contactsList.length})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreateChatModalType('direct')}
              className="px-3.5 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Найти по @username</span>
            </button>
          </div>

          <div className="bg-white border border-[#E1E3E6] rounded-2xl p-3.5 shadow-xs">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#818C99] absolute left-3.5" />
              <input
                type="text"
                value={contactsFilter}
                onChange={e => setContactsFilter(e.target.value)}
                placeholder="Поиск контактов по имени или @username..."
                className="v7-input pl-9 text-xs"
              />
            </div>
          </div>

          {contactsList.length === 0 ? (
            <div className="bg-white border border-[#E1E3E6] rounded-2xl p-8 text-center space-y-2">
              <UserCheck className="w-10 h-10 text-[#0077FF]/60 mx-auto" />
              <div className="text-sm font-bold">Контакты не найдены</div>
              <p className="text-xs text-[#818C99]">
                Нажмите «Найти по @username», чтобы начать диалог с любым пользователем Mender.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contactsList.map(user => {
                const subscribed = isSubscribed(user.uid);
                return (
                  <div
                    key={user.uid}
                    className="bg-white border border-[#E1E3E6] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div
                      onClick={() => openUserProfile(user)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer group"
                    >
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="w-11 h-11 rounded-full object-cover border border-[#E1E3E6] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#2A5885] group-hover:underline truncate">
                          {user.displayName}
                        </div>
                        <div className="text-xs text-[#818C99] truncate">@{user.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleSubscription(user.uid, 'user')}
                        className="px-2.5 py-1.5 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-xs font-semibold text-[#2C3138] cursor-pointer"
                        title={subscribed ? 'Вы подписаны' : 'Подписаться'}
                      >
                        {subscribed ? 'Подписка ✓' : '+ Подписаться'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await startDirectChatWithUser(user);
                          setActiveTab('chats');
                        }}
                        className="p-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white cursor-pointer"
                        title="Написать сообщение"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {createChatModalType && (
          <CreateGroupModal
            defaultType={createChatModalType}
            onClose={() => setCreateChatModalType(null)}
          />
        )}
      </div>
    );
  }

  // Sub-view: FAVORITES (⭐ Избранное)
  if (subSection === 'favorites') {
    return (
      <div className="flex-1 bg-[#EDEEF0] p-3 sm:p-6 overflow-y-auto select-none text-[#19191A]">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-white border border-[#E1E3E6] rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSubSection('hub')}
                  className="p-2 rounded-xl bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-base sm:text-lg font-bold">Избранное</h1>
                  <p className="text-xs text-[#818C99]">
                    Понравившиеся записи, плейлисты видео и папки профиля
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-[#F0F2F5] rounded-xl">
              <button
                type="button"
                onClick={() => setFavoritesTab('posts')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  favoritesTab === 'posts'
                    ? 'bg-white text-[#0077FF] shadow-xs'
                    : 'text-[#5C6470] hover:text-[#19191A]'
                }`}
              >
                Публикации ({likedPostsList.length})
              </button>
              <button
                type="button"
                onClick={() => setFavoritesTab('videos')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  favoritesTab === 'videos'
                    ? 'bg-white text-[#0077FF] shadow-xs'
                    : 'text-[#5C6470] hover:text-[#19191A]'
                }`}
              >
                Плейлисты ({myPlaylists.length})
              </button>
              <button
                type="button"
                onClick={() => setFavoritesTab('folders')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  favoritesTab === 'folders'
                    ? 'bg-white text-[#0077FF] shadow-xs'
                    : 'text-[#5C6470] hover:text-[#19191A]'
                }`}
              >
                Папки ({myProfileFolders.length})
              </button>
            </div>
          </div>

          {favoritesTab === 'posts' && (
            <div className="space-y-3">
              {likedPostsList.length === 0 ? (
                <div className="bg-white border border-[#E1E3E6] rounded-2xl p-8 text-center space-y-2">
                  <Heart className="w-10 h-10 text-[#E64646]/60 mx-auto" />
                  <div className="text-sm font-bold">В избранном пока нет публикаций</div>
                  <p className="text-xs text-[#818C99]">
                    Отмечайте понравившиеся записи сердечком в ленте «Новости», и они появятся здесь.
                  </p>
                </div>
              ) : (
                likedPostsList.map(post => (
                  <div
                    key={post.postId}
                    className="bg-white border border-[#E1E3E6] rounded-2xl p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => openUserProfile(post.authorId)}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        <div>
                          <div className="text-sm font-bold text-[#2A5885]">{post.authorName}</div>
                          <div className="text-[11px] text-[#818C99]">@{post.authorUsername}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLikePost(post)}
                        className="px-3 py-1.5 rounded-full bg-[#FFEAEA] text-[#E64646] text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        <span>{post.likesCount}</span>
                      </button>
                    </div>
                    {post.content && (
                      <p className="text-sm text-[#19191A] whitespace-pre-wrap">{post.content}</p>
                    )}
                    <PostMediaViewer post={post} />
                  </div>
                ))
              )}
            </div>
          )}

          {favoritesTab === 'videos' && (
            <div className="space-y-3">
              {myPlaylists.length === 0 ? (
                <div className="bg-white border border-[#E1E3E6] rounded-2xl p-8 text-center space-y-3">
                  <Film className="w-10 h-10 text-[#0077FF]/60 mx-auto" />
                  <div className="text-sm font-bold">У вас пока нет плейлистов</div>
                  <p className="text-xs text-[#818C99]">
                    Сохраняйте интересные видеоролики в плейлисты в разделе Mender Video.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('video')}
                    className="px-4 py-2 rounded-xl bg-[#0077FF] text-white text-xs font-bold cursor-pointer"
                  >
                    Перейти в Mender Video
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myPlaylists.map(pl => (
                    <div
                      key={pl.playlistId}
                      onClick={() => {
                        setActiveTab('video');
                        setVideoSubView('playlists');
                      }}
                      className="bg-white border border-[#E1E3E6] rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-[#0077FF]/40 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-bold text-[#19191A]">{pl.title}</div>
                        <div className="text-xs text-[#818C99] mt-0.5">
                          Видеороликов: {pl.videoIds.length}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#818C99]" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {favoritesTab === 'folders' && (
            <div className="space-y-3">
              {myProfileFolders.length === 0 ? (
                <div className="bg-white border border-[#E1E3E6] rounded-2xl p-8 text-center space-y-3">
                  <Folder className="w-10 h-10 text-[#0077FF]/60 mx-auto" />
                  <div className="text-sm font-bold">Папок пока нет</div>
                  <p className="text-xs text-[#818C99]">
                    Создавайте тематические папки на своей странице профиля.
                  </p>
                  <button
                    type="button"
                    onClick={() => openSettingsSection('profile')}
                    className="px-4 py-2 rounded-xl bg-[#0077FF] text-white text-xs font-bold cursor-pointer"
                  >
                    Открыть профиль
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myProfileFolders.map(folder => (
                    <div
                      key={folder.folderId}
                      onClick={() => openSettingsSection('profile')}
                      className="bg-white border border-[#E1E3E6] rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-[#0077FF]/40"
                    >
                      <div className="flex items-center gap-3">
                        <Folder className="w-5 h-5 text-[#0077FF]" />
                        <div>
                          <div className="text-sm font-bold">{folder.name}</div>
                          <div className="text-xs text-[#818C99]">
                            Записей: {folder.postIds?.length || 0}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#818C99]" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sub-view: MUSIC & AUDIO (🎵 Музыка)
  if (subSection === 'music') {
    const allTracks = [...customTracks, ...DEFAULT_MENDER_TRACKS];
    return (
      <div className="flex-1 bg-[#EDEEF0] p-3 sm:p-6 overflow-y-auto select-none text-[#19191A]">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-white border border-[#E1E3E6] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs flex-wrap">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  stopAllAudio();
                  setSubSection('hub');
                }}
                className="p-2 rounded-xl bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-base sm:text-lg font-bold">Музыка и аудиотека</h1>
                <p className="text-xs text-[#818C99]">
                  Ваши аудиофайлы, встроенные темы Mender и голосовые записи
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => audioFileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Добавить аудиофайл</span>
            </button>
            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleUploadAudioFile}
              className="hidden"
            />
          </div>

          <div className="bg-white border border-[#E1E3E6] rounded-2xl p-4 space-y-2.5 shadow-xs">
            <h2 className="text-xs font-bold text-[#818C99]">
              Аудиозаписи ({allTracks.length})
            </h2>
            <div className="space-y-2">
              {allTracks.map(track => {
                const isPlaying = playingTrackId === track.id;
                const isCustom = track.id.startsWith('aud_');
                return (
                  <div
                    key={track.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                      isPlaying
                        ? 'bg-[#EBF3FF]/70 border-[#0077FF]/40'
                        : 'bg-[#F7F8FA] border-[#E1E3E6]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handlePlayTrack(track)}
                        className="w-10 h-10 rounded-full bg-[#0077FF] hover:bg-[#0066EA] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-[#19191A] truncate">
                          {track.title}
                        </div>
                        <div className="text-[11px] text-[#818C99] truncate">
                          {track.artist} · {track.addedAt}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-[#5C6470]">
                        {track.durationLabel}
                      </span>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAudioTrack(track.id)}
                          className="p-1.5 rounded-lg text-[#818C99] hover:text-red-600 cursor-pointer"
                          title="Удалить аудиозапись"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {voiceAndAudioMessages.length > 0 && (
            <div className="bg-white border border-[#E1E3E6] rounded-2xl p-4 space-y-2.5 shadow-xs">
              <h2 className="text-xs font-bold text-[#818C99]">
                Голосовые сообщения из открытого чата ({voiceAndAudioMessages.length})
              </h2>
              <div className="space-y-2">
                {voiceAndAudioMessages.map(msg => (
                  <div
                    key={msg.messageId}
                    className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Volume2 className="w-4 h-4 text-[#0077FF] shrink-0" />
                      <span className="text-xs font-semibold truncate">{msg.senderName}</span>
                    </div>
                    {msg.mediaUrl && (
                      <audio controls src={msg.mediaUrl} className="h-8 max-w-[200px]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Hub Cards Configuration
  const menuCards = [
    {
      id: 'search',
      title: 'Поиск',
      subtitle: 'Люди, чаты, группы, каналы, записи и видео',
      icon: Search,
      color: 'bg-[#0077FF]/12 text-[#0077FF]',
      meta: 'Глобальный',
      onClick: () => {
        searchInputRef.current?.focus();
      },
    },
    {
      id: 'video',
      title: 'Видео',
      subtitle: 'Платформа Mender Video, плеер, студия и плейлисты',
      icon: Film,
      color: 'bg-[#E64646]/12 text-[#E64646]',
      meta: `${publicVideos.length + myVideos.length} видео`,
      onClick: () => setActiveTab('video'),
    },
    {
      id: 'music',
      title: 'Музыка',
      subtitle: 'Платформа Mender Music, плеер, альбомы, плейлисты и загрузка',
      icon: Music,
      color: 'bg-[#8B5CF6]/12 text-[#8B5CF6]',
      meta: `${musicTracks.length} треков`,
      onClick: () => setActiveTab('music'),
    },
    {
      id: 'communities',
      title: 'Сообщества',
      subtitle: 'Официальное сообщество Mender и открытые группы',
      icon: Users,
      color: 'bg-[#0077FF]/12 text-[#0077FF]',
      meta: 'Официальное + группы',
      onClick: () => openChannelsWithFilter('groups'),
    },
    {
      id: 'channels',
      title: 'Каналы',
      subtitle: 'Публичные и авторские каналы новостей',
      icon: Radio,
      color: 'bg-[#F59E0B]/12 text-[#F59E0B]',
      meta: 'Лента каналов',
      onClick: () => openChannelsWithFilter('channels'),
    },
    {
      id: 'calls',
      title: 'Звонки',
      subtitle: 'Аудио- и видеозвонки WebRTC, демонстрация экрана',
      icon: PhoneCall,
      color: 'bg-[#2EA043]/12 text-[#2EA043]',
      meta: callHistory.length > 0 ? `${callHistory.length} в истории` : 'Связь HD',
      onClick: () => setActiveTab('calls'),
    },
    {
      id: 'contacts',
      title: 'Контакты',
      subtitle: 'Каталог пользователей Mender и быстрый старт чата',
      icon: UserCheck,
      color: 'bg-[#06B6D4]/12 text-[#06B6D4]',
      meta: `${usersDirectory.length} чел.`,
      onClick: () => setSubSection('contacts'),
    },
    {
      id: 'favorites',
      title: 'Избранное',
      subtitle: 'Понравившиеся записи, плейлисты и папки профиля',
      icon: Star,
      color: 'bg-[#F59E0B]/15 text-[#D97706]',
      meta: `${likedPostsList.length} записей`,
      onClick: () => setSubSection('favorites'),
    },
    {
      id: 'settings',
      title: 'Настройки',
      subtitle: 'Безопасность, 2FA, активные устройства, приватность и APK',
      icon: Settings,
      color: 'bg-[#64748B]/12 text-[#475569]',
      meta: APP_VERSION_FULL,
      onClick: () => openSettingsSection('settings'),
    },
    {
      id: 'official_mender',
      title: 'Сообщество Mender',
      subtitle: `Официальные новости и релизы (${APP_VERSION_FULL})`,
      icon: Sparkles,
      color: 'bg-[#0077FF]/15 text-[#0077FF]',
      meta: `${OFFICIAL_MENDER_NEWS_POSTS.length} новостей`,
      onClick: openOfficialCommunity,
    },
    {
      id: 'video_studio',
      title: 'Видеостудия и аналитика',
      subtitle: 'Загрузка роликов, черновики и статистика просмотров',
      icon: BarChart3,
      color: 'bg-[#10B981]/12 text-[#10B981]',
      meta: 'Для авторов',
      onClick: () => {
        setActiveTab('video');
        setVideoSubView('analytics');
      },
    },
    {
      id: 'wallpapers',
      title: 'Темы и оформление',
      subtitle: 'Светлая, тёмная тема и студия фонов чатов',
      icon: Smartphone,
      color: 'bg-[#EC4899]/12 text-[#EC4899]',
      meta: `APK ${APK_SIZE_LABEL}`,
      onClick: () => {
        window.dispatchEvent(new CustomEvent('mender:open-wallpapers'));
      },
    },
  ];

  const searchCategories: { id: SearchCategory; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'people', label: 'Люди' },
    { id: 'chats', label: 'Чаты и сообщения' },
    { id: 'communities', label: 'Группы и сообщества' },
    { id: 'channels', label: 'Каналы' },
    { id: 'posts', label: 'Публикации' },
    { id: 'videos', label: 'Видео' },
  ];

  return (
    <div
      className={`flex-1 overflow-y-auto p-3 sm:p-6 select-none transition-colors duration-200 ${
        isDark ? 'bg-[#18191A] text-[#E1E3E6]' : 'bg-[#EDEEF0] text-[#19191A]'
      }`}
    >
      <div className="max-w-4xl mx-auto space-y-4 pb-6">
        {/* Top Profile & Quick Status Banner */}
        <div
          className={`rounded-2xl border p-4 flex items-center justify-between gap-3 flex-wrap shadow-xs ${
            isDark ? 'bg-[#242526] border-[#363738]' : 'bg-white border-[#E1E3E6]'
          }`}
        >
          <div
            onClick={() => openSettingsSection('profile')}
            className="flex items-center gap-3.5 cursor-pointer group min-w-0"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-12 h-12 rounded-2xl object-cover border border-[#E1E3E6] shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-[#0077FF] text-white font-bold text-lg flex items-center justify-center shrink-0">
                {profile?.displayName?.charAt(0) || 'M'}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold group-hover:text-[#0077FF] transition-colors truncate">
                  Меню Mender
                </h1>
                <span className="text-xs text-[#818C99]">·</span>
                <span className="text-xs font-semibold text-[#0077FF]">
                  {APP_VERSION_FULL} #{APP_BUILD_NUMBER}
                </span>
              </div>
              <p className="text-xs text-[#818C99] truncate">
                {profile?.displayName} (@{profile?.username}) — все разделы и глобальный поиск
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openSettingsSection('profile')}
              className="px-3 py-1.5 rounded-xl bg-[#EBF3FF] hover:bg-[#DCEBFF] text-[#0077FF] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>Моя страница</span>
            </button>
            <button
              type="button"
              onClick={() => openSettingsSection('settings')}
              className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                isDark
                  ? 'bg-[#2C2D30] border-[#3A3B3E] text-[#E1E3E6]'
                  : 'bg-[#F5F6F8] border-[#E1E3E6] text-[#2C3138] hover:bg-[#EAECEF]'
              }`}
              title="Настройки"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. УНИВЕРСАЛЬНАЯ СТРОКА ПОИСКА В МЕНЮ */}
        <div
          className={`rounded-2xl border p-4 space-y-3 shadow-xs ${
            isDark ? 'bg-[#242526] border-[#363738]' : 'bg-white border-[#E1E3E6]'
          }`}
        >
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#0077FF] absolute left-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск людей, сообщений, групп, сообществ, каналов, публикаций и видео..."
              className="v7-input pl-10 pr-9 text-xs sm:text-sm py-2.5"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 rounded-full text-[#818C99] hover:text-[#19191A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {searchCategories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSearchCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  searchCategory === cat.id
                    ? 'bg-[#0077FF] text-white'
                    : isDark
                    ? 'bg-[#2C2D30] text-[#A0A4AB] hover:text-white'
                    : 'bg-[#F0F2F5] text-[#5C6470] hover:text-[#19191A]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Live Search Results */}
          {q !== '' && (
            <div className="pt-2 border-t border-[#E1E3E6] space-y-4">
              {/* Official Community Match */}
              {(searchCategory === 'all' || searchCategory === 'communities') &&
                matchedOfficialCommunity && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#818C99]">Официальное сообщество</div>
                    <div
                      onClick={openOfficialCommunity}
                      className="p-3 rounded-xl bg-[#EBF3FF]/60 border border-[#0077FF]/30 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#0077FF] text-white font-black flex items-center justify-center">
                          M
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#2A5885]">
                              Mender — Официальное сообщество
                            </span>
                            <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                          </div>
                          <div className="text-xs text-[#5C6470]">
                            @mender_official · Новости и обновления {APP_VERSION_FULL}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#0077FF]" />
                    </div>
                  </div>
                )}

              {/* People */}
              {(searchCategory === 'all' || searchCategory === 'people') &&
                matchedUsers.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#818C99]">
                      Люди и контакты ({matchedUsers.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matchedUsers.map(u => (
                        <div
                          key={u.uid}
                          className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center justify-between gap-2"
                        >
                          <div
                            onClick={() => openUserProfile(u)}
                            className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                          >
                            <img
                              src={u.avatarUrl}
                              alt={u.displayName}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#2A5885] truncate">
                                {u.displayName}
                              </div>
                              <div className="text-[11px] text-[#818C99] truncate">
                                @{u.username}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await startDirectChatWithUser(u);
                              setActiveTab('chats');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer shrink-0"
                          >
                            Чат
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Direct Chats & Messages */}
              {(searchCategory === 'all' || searchCategory === 'chats') &&
                (matchedDirectAndMessages.length > 0 ||
                  matchedMessagesInActiveChat.length > 0) && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#818C99]">
                      Диалоги и сообщения (
                      {matchedDirectAndMessages.length + matchedMessagesInActiveChat.length})
                    </div>
                    <div className="space-y-1.5">
                      {matchedDirectAndMessages.map(chat => (
                        <div
                          key={chat.chatId}
                          onClick={() => {
                            setActiveChatId(chat.chatId);
                            setActiveTab('chats');
                          }}
                          className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center gap-3 cursor-pointer hover:border-[#0077FF]/40"
                        >
                          <img
                            src={chat.avatarUrl}
                            alt={chat.name}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{chat.name}</div>
                            <div className="text-[11px] text-[#818C99] truncate">
                              {chat.lastMessageText || 'Личный диалог'}
                            </div>
                          </div>
                        </div>
                      ))}
                      {matchedMessagesInActiveChat.slice(0, 5).map(msg => (
                        <div
                          key={msg.messageId}
                          onClick={() => {
                            setActiveChatId(msg.chatId);
                            setActiveTab('chats');
                          }}
                          className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] cursor-pointer hover:border-[#0077FF]/40"
                        >
                          <div className="text-xs font-bold text-[#2A5885]">{msg.senderName}</div>
                          <div className="text-xs text-[#19191A] line-clamp-1">{msg.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Communities & Groups */}
              {(searchCategory === 'all' || searchCategory === 'communities') &&
                matchedCommunities.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#818C99]">
                      Группы и сообщества ({matchedCommunities.length})
                    </div>
                    <div className="space-y-1.5">
                      {matchedCommunities.map(group => (
                        <div
                          key={group.chatId}
                          onClick={() => {
                            setActiveChatId(group.chatId);
                            setActiveTab('chats');
                          }}
                          className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center gap-3 cursor-pointer"
                        >
                          <img
                            src={group.avatarUrl}
                            alt={group.name}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{group.name}</div>
                            <div className="text-[11px] text-[#818C99] truncate">
                              Группа · {group.membersCount} уч.
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Channels */}
              {(searchCategory === 'all' || searchCategory === 'channels') &&
                matchedChannels.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#818C99]">
                      Каналы ({matchedChannels.length})
                    </div>
                    <div className="space-y-1.5">
                      {matchedChannels.map(ch => (
                        <div
                          key={ch.chatId}
                          onClick={() => {
                            setActiveChatId(ch.chatId);
                            setActiveTab('chats');
                          }}
                          className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center gap-3 cursor-pointer"
                        >
                          <img
                            src={ch.avatarUrl}
                            alt={ch.name}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{ch.name}</div>
                            <div className="text-[11px] text-[#818C99] truncate">
                              Канал · {ch.membersCount} подписчиков
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Posts */}
              {(searchCategory === 'all' || searchCategory === 'posts') &&
                matchedPosts.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#818C99]">
                      Публикации ({matchedPosts.length})
                    </div>
                    <div className="space-y-1.5">
                      {matchedPosts.slice(0, 6).map(post => (
                        <div
                          key={post.postId}
                          onClick={() => setActiveTab('feed')}
                          className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] cursor-pointer hover:border-[#0077FF]/40"
                        >
                          <div className="text-xs font-bold text-[#2A5885] mb-1">
                            {post.authorName}
                          </div>
                          <div className="text-xs text-[#19191A] line-clamp-2">{post.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Videos */}
              {(searchCategory === 'all' || searchCategory === 'videos') &&
                matchedVideos.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#818C99]">
                      Видеоролики ({matchedVideos.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {matchedVideos.slice(0, 4).map(video => (
                        <VideoCard
                          key={video.videoId}
                          video={video}
                          onSelectVideo={v => {
                            setActiveTab('video');
                            openVideoPlayer(v.videoId);
                          }}
                          onSelectAuthor={() => setActiveTab('video')}
                        />
                      ))}
                    </div>
                  </div>
                )}

              {!matchedOfficialCommunity &&
                matchedUsers.length === 0 &&
                matchedDirectAndMessages.length === 0 &&
                matchedMessagesInActiveChat.length === 0 &&
                matchedCommunities.length === 0 &&
                matchedChannels.length === 0 &&
                matchedPosts.length === 0 &&
                matchedVideos.length === 0 && (
                  <div className="py-6 text-center text-xs text-[#818C99]">
                    По запросу «{searchQuery}» ничего не найдено
                  </div>
                )}
            </div>
          )}
        </div>

        {/* 2. СЕТКА ВСЕХ РАЗДЕЛОВ MENDER (Карточки с иконками и названиями) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold">Все разделы Mender</h2>
            <span className="text-xs text-[#818C99]">Нажмите на карточку для перехода</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {menuCards.map(card => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={card.onClick}
                  className={`p-3.5 sm:p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer active:scale-[0.98] shadow-xs ${
                    isDark
                      ? 'bg-[#242526] hover:bg-[#2C2D30] border-[#363738]'
                      : 'bg-white hover:bg-[#F9FAFC] border-[#E1E3E6] hover:border-[#0077FF]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#818C99] shrink-0 mt-1" />
                  </div>

                  <div className="space-y-1 w-full">
                    <div className="text-sm font-bold leading-snug truncate">{card.title}</div>
                    <div className="text-[11px] text-[#818C99] line-clamp-2 leading-relaxed">
                      {card.subtitle}
                    </div>
                    <div className="pt-1 text-[10px] font-semibold text-[#0077FF] truncate">
                      {card.meta}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {createChatModalType && (
        <CreateGroupModal
          defaultType={createChatModalType}
          onClose={() => setCreateChatModalType(null)}
        />
      )}
    </div>
  );
};
