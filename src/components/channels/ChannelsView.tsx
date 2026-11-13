import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  Radio,
  Users,
  Plus,
  Check,
  Globe,
  MessageSquare,
  CheckCircle2,
  ArrowLeft,
  Heart,
  Share2,
  Bell,
  BellOff,
  Sparkles,
  Download,
  Send,
  Trash2,
  Eye,
} from 'lucide-react';
import { CreateGroupModal } from '../chats/CreateGroupModal';
import { Chat } from '../../types';
import {
  OFFICIAL_MENDER_COMMUNITY_ID,
  OFFICIAL_MENDER_NEWS_POSTS,
  APP_VERSION_FULL,
  APP_BUILD_NUMBER,
  APK_FILE_NAME,
  APK_VERSIONED_NAME,
  APK_SIZE_LABEL,
} from '../../version';
import { MENDER_WALLPAPERS } from '../../data/menderWallpapers';

interface CommunityComment {
  id: string;
  authorId?: string;
  authorName: string;
  authorUsername: string;
  date: string;
  text: string;
}

const STORAGE_LIKES_KEY = 'mender_official_news_likes_v1';
const STORAGE_COMMENTS_KEY = 'mender_official_news_comments_v1';
const STORAGE_NOTIFY_KEY = 'mender_official_notify_v1';

export const ChannelsView: React.FC = () => {
  const { publicChannelsAndGroups, chats, setActiveChatId, setActiveTab, joinPublicChat, leaveChat } = useChat();
  const { profile, toggleSubscription, isSubscribed } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState<'group' | 'channel' | null>(null);
  const [listFilter, setListFilter] = useState<'all' | 'groups' | 'channels'>(() => {
    try {
      const saved = sessionStorage.getItem('mender_channels_filter');
      if (saved === 'groups' || saved === 'channels' || saved === 'all') {
        sessionStorage.removeItem('mender_channels_filter');
        return saved;
      }
    } catch {
      // ignore
    }
    return 'all';
  });
  const [viewingOfficialCommunity, setViewingOfficialCommunity] = useState<boolean>(() => {
    try {
      const pending = sessionStorage.getItem('mender_open_official_community');
      if (pending === '1') {
        sessionStorage.removeItem('mender_open_official_community');
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  });
  const [communityTab, setCommunityTab] = useState<'all' | 'releases' | 'about'>('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_NOTIFY_KEY) !== '0';
    } catch {
      return true;
    }
  });

  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LIKES_KEY);
      return raw ? JSON.parse(raw) : { mender_news_welcome: true };
    } catch {
      return { mender_news_welcome: true };
    }
  });

  const [customComments, setCustomComments] = useState<Record<string, CommunityComment[]>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COMMENTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [openCommentsMap, setOpenCommentsMap] = useState<Record<string, boolean>>({
    mender_news_v740: true,
  });
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenOfficial = () => {
      setViewingOfficialCommunity(true);
    };
    const handleChannelsFilter = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail === 'groups' || custom.detail === 'channels' || custom.detail === 'all') {
        setViewingOfficialCommunity(false);
        setListFilter(custom.detail);
      }
    };
    window.addEventListener('mender:open-official-community', handleOpenOfficial);
    window.addEventListener('mender:channels-filter', handleChannelsFilter);
    return () => {
      window.removeEventListener('mender:open-official-community', handleOpenOfficial);
      window.removeEventListener('mender:channels-filter', handleChannelsFilter);
    };
  }, []);

  const isOfficialSubscribed = isSubscribed(OFFICIAL_MENDER_COMMUNITY_ID);
  const cosmicBanner = MENDER_WALLPAPERS[0]?.svgDataUrl || '';

  const handleToggleOfficialSubscription = async () => {
    await toggleSubscription(OFFICIAL_MENDER_COMMUNITY_ID, 'channel');
  };

  const handleToggleNotify = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    try {
      localStorage.setItem(STORAGE_NOTIFY_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  const handleToggleLikeNews = (postId: string) => {
    setLikedPosts(prev => {
      const next = { ...prev, [postId]: !prev[postId] };
      try {
        localStorage.setItem(STORAGE_LIKES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleAddOfficialComment = (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    const newComment: CommunityComment = {
      id: `usr_c_${Date.now()}`,
      authorId: profile?.uid || 'guest',
      authorName: profile?.displayName || 'Пользователь Mender',
      authorUsername: profile?.username || 'user',
      date: 'Только что',
      text,
    };

    setCustomComments(prev => {
      const list = prev[postId] || [];
      const next = { ...prev, [postId]: [...list, newComment] };
      try {
        localStorage.setItem(STORAGE_COMMENTS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    setOpenCommentsMap(prev => ({ ...prev, [postId]: true }));
  };

  const handleDeleteOfficialComment = (postId: string, commentId: string) => {
    setCustomComments(prev => {
      const list = (prev[postId] || []).filter(c => c.id !== commentId);
      const next = { ...prev, [postId]: list };
      try {
        localStorage.setItem(STORAGE_COMMENTS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleShareNews = (postId: string, title: string) => {
    try {
      navigator.clipboard?.writeText(`${title} — Официальное сообщество Mender (${window.location.origin})`);
    } catch {
      // ignore
    }
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  const handleToggleMembership = async (channel: Chat, isMember: boolean) => {
    if (isMember) {
      await leaveChat(channel.chatId);
    } else {
      await joinPublicChat(channel);
    }
    await toggleSubscription(channel.chatId, 'channel');
  };

  const filteredOfficialPosts = OFFICIAL_MENDER_NEWS_POSTS.filter(post => {
    if (communityTab === 'releases') return post.category === 'release';
    return true;
  });

  if (viewingOfficialCommunity) {
    return (
      <div className="flex-1 bg-[#EDEEF0] p-3 sm:p-6 overflow-y-auto select-none text-[#19191A] transition-colors duration-300">
        <div className="max-w-[640px] mx-auto space-y-4">
          {/* Top navigation bar */}
          <div className="flex items-center justify-between bg-white border border-[#E1E3E6] rounded-xl px-4 py-3 shadow-xs">
            <button
              type="button"
              onClick={() => setViewingOfficialCommunity(false)}
              className="flex items-center gap-2 text-xs font-semibold text-[#2A5885] hover:text-[#0077FF] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад ко всем сообществам</span>
            </button>
            <span className="px-2.5 py-0.5 rounded-md bg-[#EBF3FF] text-[#0077FF] text-[11px] font-bold">
              @mender_official
            </span>
          </div>

          {/* Community Cover & Profile Header */}
          <div className="bg-white border border-[#E1E3E6] rounded-xl overflow-hidden shadow-xs">
            <div className="relative h-36 sm:h-44 w-full bg-[#0077FF] overflow-hidden">
              {cosmicBanner && (
                <img
                  src={cosmicBanner}
                  alt="Mender Official Cover"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex flex-col justify-end p-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#0077FF] text-white text-[10px] font-bold uppercase tracking-wider">
                    Официальный канал новостей
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur-xs text-white text-[10px] font-semibold">
                    {APP_VERSION_FULL} · Build #{APP_BUILD_NUMBER}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-[#0077FF] flex items-center justify-center text-white font-black text-2xl shadow-sm shrink-0 border-2 border-white -mt-8 sm:-mt-10 relative z-10">
                    M
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-lg font-bold text-[#19191A]">Mender</h1>
                      <CheckCircle2 className="w-4 h-4 text-[#0077FF] fill-[#0077FF]/20 shrink-0" />
                    </div>
                    <p className="text-xs text-[#818C99]">
                      Официальное сообщество · {(18420 + (isOfficialSubscribed ? 1 : 0)).toLocaleString('ru-RU')} подписчиков
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleOfficialSubscription}
                    className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isOfficialSubscribed
                        ? 'bg-[#E5EBF1] text-[#2A5885] hover:bg-[#DCE3EA]'
                        : 'bg-[#0077FF] text-white hover:bg-[#0066EA]'
                    }`}
                  >
                    {isOfficialSubscribed ? (
                      <>
                        <Check className="w-4 h-4 text-[#0077FF]" />
                        <span>Вы подписаны</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Подписаться на новости</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleNotify}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      notificationsEnabled
                        ? 'bg-[#EBF3FF] border-[#B8D7FF] text-[#0077FF]'
                        : 'bg-[#F5F6F8] border-[#E1E3E6] text-[#818C99]'
                    }`}
                    title={
                      notificationsEnabled
                        ? 'Уведомления о новых версиях включены'
                        : 'Включить уведомления о новых версиях'
                    }
                  >
                    {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-[#2C3138] leading-relaxed">
                Официальное сообщество мессенджера и видеоплатформы <b>Mender</b>. Здесь публикуются все новости проекта, список изменений новых версий ({APP_VERSION_FULL}), свежие сборки Android APK и важные объявления.
              </p>

              {/* Tabs inside Official Community */}
              <div className="flex items-center gap-4 border-t border-[#E1E3E6] pt-3">
                <button
                  type="button"
                  onClick={() => setCommunityTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    communityTab === 'all'
                      ? 'bg-[#0077FF] text-white'
                      : 'bg-[#F0F2F5] text-[#5C6470] hover:bg-[#E5E7EB]'
                  }`}
                >
                  Все новости ({OFFICIAL_MENDER_NEWS_POSTS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCommunityTab('releases')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    communityTab === 'releases'
                      ? 'bg-[#0077FF] text-white'
                      : 'bg-[#F0F2F5] text-[#5C6470] hover:bg-[#E5E7EB]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Новые версии</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCommunityTab('about')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    communityTab === 'about'
                      ? 'bg-[#0077FF] text-white'
                      : 'bg-[#F0F2F5] text-[#5C6470] hover:bg-[#E5E7EB]'
                  }`}
                >
                  О сообществе
                </button>
              </div>
            </div>
          </div>

          {communityTab === 'about' ? (
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-5 space-y-4 shadow-xs text-xs text-[#2C3138]">
              <h2 className="text-sm font-bold text-[#19191A]">Официальное сообщество Mender</h2>
              <p className="leading-relaxed">
                Сообщество создано для того, чтобы вы всегда были в курсе обновлений Mender, могли мгновенно скачивать облегчённую Android-версию и оставлять обратную связь напрямую разработчикам.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6]">
                  <div className="text-[11px] text-[#818C99]">Текущая версия приложения</div>
                  <div className="text-sm font-bold text-[#0077FF] mt-0.5">
                    {APP_VERSION_FULL} (Build #{APP_BUILD_NUMBER})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6]">
                  <div className="text-[11px] text-[#818C99]">Размер Android APK</div>
                  <div className="text-sm font-bold text-[#19191A] mt-0.5">{APK_SIZE_LABEL}</div>
                </div>
              </div>
              <div className="pt-2">
                <a
                  href={`/${APK_FILE_NAME}`}
                  download={APK_VERSIONED_NAME}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white font-semibold text-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Скачать актуальный {APK_VERSIONED_NAME}</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOfficialPosts.map(post => {
                const isLiked = Boolean(likedPosts[post.id]);
                const likesCount = post.likesCount + (isLiked ? 1 : 0);
                const allComments = [
                  ...post.initialComments,
                  ...(customComments[post.id] || []),
                ];
                const isCommentsOpen = Boolean(openCommentsMap[post.id]);

                return (
                  <div
                    key={post.id}
                    className="bg-white border border-[#E1E3E6] rounded-xl p-4 sm:p-5 space-y-3 shadow-xs"
                  >
                    {/* Post Author Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0077FF] flex items-center justify-center text-white font-bold text-sm shrink-0">
                          M
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#2A5885]">Mender</span>
                            <CheckCircle2 className="w-4 h-4 text-[#0077FF] fill-[#0077FF]/20" />
                            {post.versionTag && (
                              <span className="px-2 py-0.5 rounded bg-[#EBF3FF] text-[#0077FF] text-[10px] font-bold">
                                {post.versionTag}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#818C99]">{post.date}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-[#818C99]">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{post.viewsCount.toLocaleString('ru-RU')}</span>
                      </div>
                    </div>

                    {/* Title & Body */}
                    <h3 className="text-sm sm:text-base font-bold text-[#19191A] leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#2C3138] leading-relaxed">
                      {post.content}
                    </p>

                    {post.bullets && post.bullets.length > 0 && (
                      <ul className="space-y-1.5 bg-[#F7F8FA] border border-[#E1E3E6] rounded-xl p-3 text-xs text-[#19191A]">
                        {post.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0077FF] mt-1.5 shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {post.id === 'mender_news_v740' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#EBF3FF]/60 border border-[#B8D7FF]">
                        <div>
                          <div className="text-xs font-bold text-[#19191A]">
                            Установочный пакет {APK_VERSIONED_NAME}
                          </div>
                          <div className="text-[11px] text-[#5C6470]">
                            Размер: {APK_SIZE_LABEL} · Поддержка работы без интернета
                          </div>
                        </div>
                        <a
                          href={`/${APK_FILE_NAME}`}
                          download={APK_VERSIONED_NAME}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Скачать APK</span>
                        </a>
                      </div>
                    )}

                    {/* Reaction Pills */}
                    <div className="flex items-center gap-2.5 pt-1 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => handleToggleLikeNews(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                          isLiked
                            ? 'bg-[#FFEAEA] text-[#E64646]'
                            : 'bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#818C99]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                        <span>{likesCount.toLocaleString('ru-RU')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenCommentsMap(prev => ({ ...prev, [post.id]: !prev[post.id] }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                          isCommentsOpen
                            ? 'bg-[#E5EBF1] text-[#0077FF]'
                            : 'bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#818C99]'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{allComments.length}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareNews(post.id, post.title)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#818C99] transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>{copiedPostId === post.id ? 'Скопировано!' : 'Поделиться'}</span>
                      </button>
                    </div>

                    {/* Comments Section */}
                    {isCommentsOpen && (
                      <div className="space-y-2.5 pt-2 border-t border-[#E1E3E6]">
                        {allComments.length > 0 ? (
                          <div className="bg-[#F7F8FA] rounded-xl p-3 border border-[#E1E3E6] space-y-2">
                            {allComments.map(c => {
                              const isOwn =
                                Boolean(profile?.uid && (c as CommunityComment).authorId === profile.uid) ||
                                c.id.startsWith('usr_c_');
                              return (
                                <div
                                  key={c.id}
                                  className="bg-white rounded-xl p-2.5 border border-[#E1E3E6] text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-[#2A5885]">
                                        {c.authorName}
                                      </span>
                                      {c.authorUsername === 'mender_official' && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0077FF]" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-[#818C99]">{c.date}</span>
                                      {isOwn && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteOfficialComment(post.id, c.id)}
                                          className="text-[#818C99] hover:text-red-600 cursor-pointer"
                                          title="Удалить комментарий"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-[#19191A] break-words">{c.text}</p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-[#818C99] px-1">
                            Комментариев пока нет. Оставьте первый отзыв об обновлении!
                          </div>
                        )}

                        <form
                          onSubmit={e => handleAddOfficialComment(post.id, e)}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            placeholder="Написать комментарий в официальном сообществе..."
                            value={commentInputs[post.id] || ''}
                            onChange={e =>
                              setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))
                            }
                            className="v7-input text-xs py-2"
                          />
                          <button
                            type="submit"
                            className="p-2.5 rounded-full bg-[#0077FF] hover:bg-[#0066EA] text-white transition-all cursor-pointer shrink-0 shadow-xs"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const filteredPublicList = publicChannelsAndGroups.filter(item => {
    if (listFilter === 'groups') return item.type === 'group';
    if (listFilter === 'channels') return item.type === 'channel';
    return true;
  });

  return (
    <div className="flex-1 bg-[#EDEEF0] p-4 md:p-6 overflow-y-auto select-none text-[#19191A] transition-colors duration-300">
      <div className="max-w-[620px] mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-[#19191A]">
                {listFilter === 'channels'
                  ? 'Каналы'
                  : listFilter === 'groups'
                  ? 'Сообщества и группы'
                  : 'Сообщества и каналы'}
              </h1>
              <p className="text-xs text-[#818C99]">
                Официальные новости Mender, открытые группы и публичные каналы
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F0F2F5] rounded-xl">
            <button
              type="button"
              onClick={() => setListFilter('all')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                listFilter === 'all'
                  ? 'bg-white text-[#0077FF] shadow-xs'
                  : 'text-[#5C6470] hover:text-[#19191A]'
              }`}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setListFilter('groups')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                listFilter === 'groups'
                  ? 'bg-white text-[#0077FF] shadow-xs'
                  : 'text-[#5C6470] hover:text-[#19191A]'
              }`}
            >
              Сообщества и группы
            </button>
            <button
              type="button"
              onClick={() => setListFilter('channels')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                listFilter === 'channels'
                  ? 'bg-white text-[#0077FF] shadow-xs'
                  : 'text-[#5C6470] hover:text-[#19191A]'
              }`}
            >
              Каналы
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreateModal('channel')}
              className="v7-btn"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Создать канал</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal('group')}
              className="v7-btn-secondary"
            >
              <Users className="w-4 h-4 text-[#0077FF] shrink-0" />
              <span>Создать группу</span>
            </button>
          </div>
        </div>

        {/* Pinned Official Mender Community Card */}
        <div className="bg-white border-2 border-[#0077FF]/30 rounded-xl p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div
              onClick={() => setViewingOfficialCommunity(true)}
              className="flex items-center gap-3.5 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0077FF] flex items-center justify-center text-white font-black text-xl shrink-0 shadow-xs">
                M
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-base font-bold text-[#2A5885] group-hover:underline">
                    Mender — Официальное сообщество
                  </h3>
                  <CheckCircle2 className="w-4 h-4 text-[#0077FF] fill-[#0077FF]/20 shrink-0" />
                  <span className="px-2 py-0.5 rounded bg-[#EBF3FF] text-[#0077FF] text-[10px] font-bold">
                    Новости и обновления
                  </span>
                </div>
                <p className="text-xs text-[#818C99] mt-0.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#0077FF]" />
                  <span>
                    {(18420 + (isOfficialSubscribed ? 1 : 0)).toLocaleString('ru-RU')} подписчиков · Актуальный релиз {APP_VERSION_FULL}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#19191A] leading-relaxed">
            Главное сообщество Mender: новости платформы, анонсы новых версий ({APP_VERSION_FULL} · Build #{APP_BUILD_NUMBER}), изменения офлайн-режима, плеера и свежие сборки Android APK.
          </p>

          <div className="v7-btn-list pt-1">
            <button
              type="button"
              onClick={() => setViewingOfficialCommunity(true)}
              className="v7-btn"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Перейти в сообщество (Читать новости)</span>
            </button>

            <button
              type="button"
              onClick={handleToggleOfficialSubscription}
              className="v7-btn-secondary"
            >
              {isOfficialSubscribed ? (
                <Check className="w-4 h-4 text-[#0077FF] shrink-0" />
              ) : (
                <Plus className="w-4 h-4 text-[#0077FF] shrink-0" />
              )}
              <span>{isOfficialSubscribed ? 'Вы подписаны на новости' : 'Подписаться на новости'}</span>
            </button>
          </div>
        </div>

        {/* User-Created Public Channels List */}
        {filteredPublicList.length > 0 && (
          <div className="space-y-3">
            {filteredPublicList.map(channel => {
              const isJoined =
                chats.some(c => c.chatId === channel.chatId) || isSubscribed(channel.chatId);
              return (
                <div
                  key={channel.chatId}
                  className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-col gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={channel.avatarUrl}
                      alt={channel.name}
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3
                          onClick={() => {
                            setActiveChatId(channel.chatId);
                            setActiveTab('chats');
                          }}
                          className="text-base font-semibold text-[#2A5885] hover:underline cursor-pointer"
                        >
                          {channel.name}
                        </h3>
                        <Globe className="w-3.5 h-3.5 text-[#818C99]" />
                      </div>
                      <p className="text-xs text-[#818C99] mt-0.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#0077FF]" />
                        <span>
                          {channel.type === 'channel' ? 'Канал' : 'Группа'} · {channel.membersCount} подписчиков
                        </span>
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-[#19191A] leading-relaxed">
                    {channel.description || 'Публичное сообщество'}
                  </p>

                  {/* Кнопки канала */}
                  <div className="v7-btn-list pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatId(channel.chatId);
                        setActiveTab('chats');
                      }}
                      className="v7-btn"
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>Перейти в {channel.type === 'channel' ? 'канал' : 'сообщество'}</span>
                    </button>

                    {channel.ownerId !== profile?.uid && (
                      <button
                        type="button"
                        onClick={() => handleToggleMembership(channel, isJoined)}
                        className="v7-btn-secondary"
                      >
                        {isJoined ? (
                          <Check className="w-4 h-4 text-[#0077FF] shrink-0" />
                        ) : (
                          <Plus className="w-4 h-4 text-[#0077FF] shrink-0" />
                        )}
                        <span>{isJoined ? 'Вы подписаны' : 'Подписаться'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(null)}
          defaultType={showCreateModal}
        />
      )}
    </div>
  );
};


