import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  Heart,
  MessageSquare,
  Image as ImageIcon,
  Send,
  Trash2,
  UserPlus,
  Check,
  Loader2,
  X,
  Search,
  Share2,
  CheckCircle2,
  Pencil,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Post, PostComment } from '../../types';
import { MENDER_WALLPAPERS } from '../../data/menderWallpapers';
import { WhatsNewComposer } from './WhatsNewComposer';
import { PostMediaViewer } from './PostMediaViewer';
import {
  OFFICIAL_MENDER_COMMUNITY_ID,
  APP_VERSION_FULL,
  APP_BUILD_NUMBER,
} from '../../version';

export const SocialFeed: React.FC = () => {
  const {
    posts,
    postLikesByMe,
    postComments,
    commentLikesByMe,
    commentLikesCount,
    toggleLikePost,
    loadCommentsForPost,
    addCommentToPost,
    editComment,
    deleteComment,
    toggleLikeComment,
    createPost,
    editPost,
    deletePost,
    openUserProfile,
    startDirectChatWithUser,
    usersDirectory,
    setActiveTab,
  } = useChat();
  const { profile, toggleSubscription, isSubscribed, isUserBlocked } = useAuth();

  const [feedTab, setFeedTab] = useState<'recommended' | 'subscriptions' | 'liked'>('recommended');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [welcomeLiked, setWelcomeLiked] = useState(true);
  const [welcomeLikesCount, setWelcomeLikesCount] = useState(12500);

  const isSubscribedToOfficial = isSubscribed(OFFICIAL_MENDER_COMMUNITY_ID);

  const openOfficialMenderCommunity = () => {
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

  const [postContent, setPostContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Editing own post state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState('');

  // Editing own comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [openCommentsPostIds, setOpenCommentsPostIds] = useState<Record<string, boolean>>({});

  const toggleCommentsSection = (post: Post) => {
    const nextState = !openCommentsPostIds[post.postId];
    setOpenCommentsPostIds(prev => ({ ...prev, [post.postId]: nextState }));
    if (nextState && !postComments[post.postId]) {
      loadCommentsForPost(post.postId, post.visibility);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cosmicBanner = MENDER_WALLPAPERS[0]?.svgDataUrl || '';

  const visiblePosts = posts.filter(p => {
    if (isUserBlocked(p.authorId)) return false;
    if (feedTab === 'subscriptions' && !isSubscribed(p.authorId) && p.authorId !== profile?.uid) {
      return false;
    }
    if (feedTab === 'liked' && !postLikesByMe[p.postId]) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.content?.toLowerCase().includes(q) ||
        p.authorName?.toLowerCase().includes(q) ||
        p.authorUsername?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const visiblePostIdsKey = visiblePosts.map(p => p.postId).join(',');

  useEffect(() => {
    visiblePosts.forEach(p => {
      loadCommentsForPost(p.postId, p.visibility);
    });
  }, [visiblePostIdsKey, loadCommentsForPost]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!postContent.trim() && !selectedFile) || isPublishing) return;
    setIsPublishing(true);
    try {
      await createPost({
        content: postContent.trim(),
        visibility: 'public',
        mediaFile: selectedFile,
      });
      setPostContent('');
      setSelectedFile(null);
      setPreviewUrl(null);
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

  return (
    <div className="flex-1 bg-[#EDEEF0] overflow-y-auto p-3 sm:p-5 space-y-4 select-none text-[#19191A] transition-colors duration-300">
      <div className="max-w-[620px] mx-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-[#19191A]">Новости</h1>
          <button
            type="button"
            onClick={() => setShowSearch(prev => !prev)}
            className="p-1.5 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#E5E7E8] transition-colors cursor-pointer"
            title="Поиск по новостям"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {showSearch && (
          <div className="mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск записей или людей..."
              className="v7-input"
              autoFocus
            />
          </div>
        )}

        {/* Tabs: Рекомендации | Подписки | Залайканные */}
        <div className="flex items-center gap-6 border-b border-[#E1E3E6] mb-4 bg-white px-4 pt-2.5 rounded-t-xl border">
          <button
            type="button"
            onClick={() => setFeedTab('recommended')}
            className={`pb-2.5 text-xs font-semibold transition-colors relative cursor-pointer ${
              feedTab === 'recommended' ? 'text-[#0077FF]' : 'text-[#818C99] hover:text-[#19191A]'
            }`}
          >
            Интересное
            {feedTab === 'recommended' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#0077FF]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setFeedTab('subscriptions')}
            className={`pb-2.5 text-xs font-semibold transition-colors relative cursor-pointer ${
              feedTab === 'subscriptions' ? 'text-[#0077FF]' : 'text-[#818C99] hover:text-[#19191A]'
            }`}
          >
            Подписки
            {feedTab === 'subscriptions' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#0077FF]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setFeedTab('liked')}
            className={`pb-2.5 text-xs font-semibold transition-colors relative cursor-pointer flex items-center gap-1.5 ${
              feedTab === 'liked' ? 'text-[#E64646]' : 'text-[#818C99] hover:text-[#19191A]'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Понравилось</span>
            {feedTab === 'liked' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#E64646]" />
            )}
          </button>
        </div>

        {/* Объединённый блок «Что нового (+)»: текст + папка + фото/видео */}
        <div className="mb-3">
          <WhatsNewComposer />
        </div>

        {/* Official Mender Featured Card */}
        {(feedTab === 'recommended' || (feedTab === 'subscriptions' && isSubscribedToOfficial)) &&
          !searchQuery.trim() && (
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 mb-3 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div
                  onClick={openOfficialMenderCommunity}
                  className="flex items-center gap-3 cursor-pointer group"
                  title="Открыть официальное сообщество Mender"
                >
                  <div className="w-10 h-10 rounded-full bg-[#0077FF] flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                    M
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-semibold text-[#2A5885] group-hover:underline">
                        Mender
                      </h4>
                      <CheckCircle2 className="w-4 h-4 text-[#0077FF] fill-[#0077FF]/20" />
                      <span className="px-2 py-0.5 rounded bg-[#EBF3FF] text-[#0077FF] text-[10px] font-bold">
                        {APP_VERSION_FULL}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#818C99] group-hover:text-[#0077FF] transition-colors">
                      Официальное сообщество · Нажмите, чтобы открыть новости
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSubscription(OFFICIAL_MENDER_COMMUNITY_ID, 'channel')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSubscribedToOfficial
                        ? 'bg-[#E5EBF1] text-[#2A5885] hover:bg-[#DCE3EA]'
                        : 'bg-[#0077FF] text-white hover:bg-[#0066EA]'
                    }`}
                  >
                    {isSubscribedToOfficial ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#0077FF]" />
                        <span>Вы подписаны</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Подписаться</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div
                onClick={openOfficialMenderCommunity}
                className="space-y-2 cursor-pointer"
              >
                <p className="text-sm text-[#19191A] leading-relaxed">
                  Добро пожаловать в <b>Официальное сообщество Mender</b>! ✨{'\n'}
                  Вышло обновление <b>{APP_VERSION_FULL} (Build #{APP_BUILD_NUMBER})</b>: работа без интернета, офлайн-сохранение видео, универсальный плеер для всех устройств и сборка APK до 20 МБ.
                </p>

                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-[#E1E3E6] group">
                  {cosmicBanner && (
                    <img
                      src={cosmicBanner}
                      alt="Mender Banner"
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col items-center justify-end p-4 text-center">
                    <span className="text-base font-bold text-white drop-shadow">
                      Mender — Официальное сообщество
                    </span>
                    <span className="text-[11px] text-white/90 mt-0.5">
                      Перейти к новостям и истории обновлений ({APP_VERSION_FULL}) →
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setWelcomeLiked(prev => !prev);
                      setWelcomeLikesCount(prev => (welcomeLiked ? prev - 1 : prev + 1));
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                      welcomeLiked
                        ? 'bg-[#FFEAEA] text-[#E64646]'
                        : 'bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#818C99]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${welcomeLiked ? 'fill-current' : ''}`} />
                    <span>{(welcomeLikesCount / 1000).toFixed(1)}K</span>
                  </button>
                  <button
                    type="button"
                    onClick={openOfficialMenderCommunity}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#818C99] transition-colors cursor-pointer"
                    title="Открыть комментарии в официальном сообществе"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>742</span>
                  </button>
                  <button
                    type="button"
                    onClick={openOfficialMenderCommunity}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#818C99] transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>1.1K</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openOfficialMenderCommunity}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#EBF3FF] hover:bg-[#DCEBff] text-[#0077FF] text-xs font-bold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Перейти в сообщество</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

        {/* Posts Stream */}
        <div className="space-y-3">
          {visiblePosts.length === 0 && !(feedTab === 'subscriptions' && isSubscribedToOfficial) ? (
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-6 text-center text-[#818C99] space-y-3">
              <h3 className="text-sm font-semibold text-[#19191A]">
                {feedTab === 'subscriptions'
                  ? 'Нет записей от ваших подписок'
                  : feedTab === 'liked'
                  ? 'Вы ещё не лайкнули ни одной записи'
                  : 'Записей в ленте пока нет'}
              </h3>
              <p className="text-xs">
                {feedTab === 'subscriptions'
                  ? 'Подпишитесь на Официальное сообщество Mender, чтобы следить за новостями и новыми версиями!'
                  : 'Опубликуйте первую запись с фото или видео — она сразу появится в новостях!'}
              </p>
              {feedTab === 'subscriptions' && !isSubscribedToOfficial && (
                <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSubscription(OFFICIAL_MENDER_COMMUNITY_ID, 'channel')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Подписаться на сообщество Mender</span>
                  </button>
                  <button
                    type="button"
                    onClick={openOfficialMenderCommunity}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EBF3FF] hover:bg-[#DCEBff] text-[#0077FF] text-xs font-semibold cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Открыть сообщество Mender</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            visiblePosts.map((post: Post) => {
              const isAuthor = Boolean(profile?.uid && post.authorId === profile.uid);
              const subscribed = isSubscribed(post.authorId);
              const isLiked = Boolean(postLikesByMe[post.postId]);
              const comments = postComments[post.postId] || [];

              return (
                <div
                  key={post.postId}
                  className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3 shadow-xs"
                >
                  {/* Author header */}
                  <div className="flex items-center justify-between gap-2">
                    <div
                      onClick={() => openUserProfile(post.authorId)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer group"
                      title={`Открыть профиль ${post.authorName}`}
                    >
                      <img
                        src={post.authorAvatar}
                        alt={post.authorName}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-[#2A5885] hover:underline truncate">
                          {post.authorName}
                        </h4>
                        <p className="text-xs text-[#818C99] truncate">
                          {formatTime(post.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isAuthor && (
                        <button
                          type="button"
                          onClick={() => toggleSubscription(post.authorId, 'user')}
                          className="v7-btn-secondary text-xs py-1.5 px-3 w-auto"
                        >
                          {subscribed ? (
                            <Check className="w-3.5 h-3.5 text-[#0077FF]" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5 text-[#0077FF]" />
                          )}
                          <span>{subscribed ? 'Вы подписаны' : 'Подписаться'}</span>
                        </button>
                      )}

                      {/* Редактировать и удалять пост может ТОЛЬКО его автор */}
                      {isAuthor && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPostId(post.postId);
                              setEditingPostText(post.content);
                            }}
                            className="p-1.5 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#F2F3F5] cursor-pointer"
                            title="Редактировать запись"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePost(post.postId)}
                            className="p-1.5 rounded-lg text-[#818C99] hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Удалить запись"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content text or Edit Post Box */}
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
                          className="px-3 py-1.5 rounded-lg bg-[#EDEFEF] text-xs text-[#2C3138] cursor-pointer hover:bg-[#E5E7E8]"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePostEdit(post.postId)}
                          className="px-3 py-1.5 rounded-lg bg-[#0077FF] text-xs font-semibold text-white hover:bg-[#0066EA] cursor-pointer"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  ) : (
                    post.content && (
                      <p className="text-sm text-[#19191A] leading-relaxed whitespace-pre-wrap break-words">
                        {post.content}
                      </p>
                    )
                  )}

                  {/* Media if present */}
                  <PostMediaViewer post={post} />

                  {/* Actions Bar (VK Reaction Pills) */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleLikePost(post)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        isLiked
                          ? 'bg-[#FFEAEA] text-[#E64646]'
                          : 'bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#818C99]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                      <span>{post.likesCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCommentsSection(post)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        openCommentsPostIds[post.postId]
                          ? 'bg-[#E5EBF1] text-[#0077FF]'
                          : 'bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#818C99]'
                      }`}
                      title={
                        openCommentsPostIds[post.postId]
                          ? 'Скрыть комментарии'
                          : 'Открыть комментарии'
                      }
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{post.commentsCount}</span>
                    </button>
                  </div>

                  {/* Выпадающий блок комментариев */}
                  {Boolean(openCommentsPostIds[post.postId]) && (
                    <div className="space-y-2.5 pt-2 border-t border-[#E1E3E6]">
                      {comments.length > 0 ? (
                        <div className="bg-[#F7F8FA] rounded-xl p-3 border border-[#E1E3E6] space-y-2.5">
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
                                  onClick={() => openUserProfile(comment.authorId)}
                                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 cursor-pointer"
                                  title={`Открыть профиль ${comment.authorName}`}
                                />
                                <div className="flex-1 bg-white rounded-xl p-2.5 border border-[#E1E3E6]">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span
                                      onClick={() => openUserProfile(comment.authorId)}
                                      className="font-semibold text-[#2A5885] hover:underline cursor-pointer"
                                      title={`Открыть профиль ${comment.authorName}`}
                                    >
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
                                          className="px-2.5 py-1 rounded-md bg-[#EDEFEF] text-[11px] text-[#2C3138] cursor-pointer"
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
                                    <p className="text-[#19191A] break-words">{comment.content}</p>
                                  )}

                                  <div className="flex items-center gap-3 mt-2 pt-1 border-t border-[#E1E3E6]">
                                    <button
                                      type="button"
                                      onClick={() => toggleLikeComment(comment.commentId)}
                                      className={`flex items-center gap-1 text-[11px] font-medium cursor-pointer transition-colors ${
                                        commentLiked
                                          ? 'text-[#E64646]'
                                          : 'text-[#818C99] hover:text-[#E64646]'
                                      }`}
                                      title="Лайкнуть комментарий"
                                    >
                                      <Heart
                                        className={`w-3 h-3 ${commentLiked ? 'fill-current' : ''}`}
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
                                          className="flex items-center gap-1 text-[11px] text-[#0077FF] hover:underline cursor-pointer"
                                          title="Редактировать свой комментарий"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                          <span>Изм.</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteComment(post, comment)}
                                          className="flex items-center gap-1 text-[11px] text-[#818C99] hover:text-red-600 cursor-pointer"
                                          title="Удалить свой комментарий"
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

                      {/* Add Comment Input */}
                      <form
                        onSubmit={e => handleAddComment(post, e)}
                        className="flex items-center gap-2 pt-1"
                      >
                        <input
                          type="text"
                          placeholder="Написать комментарий..."
                          value={commentInputs[post.postId] || ''}
                          onChange={e =>
                            setCommentInputs({ ...commentInputs, [post.postId]: e.target.value })
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
            })
          )}
        </div>
      </div>
    </div>
  );
};
