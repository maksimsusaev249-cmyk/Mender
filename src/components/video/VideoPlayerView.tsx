import React, { useState, useEffect } from 'react';
import { useVideo } from '../../context/VideoContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { MenderVideo, MenderVideoComment } from '../../types';
import { resolvePlayableMediaUrl } from '../../utils/media';
import { formatVideoDate, formatVideoDuration, VideoCard } from './VideoCard';
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  ListPlus,
  Flag,
  Trash2,
  Pencil,
  UserPlus,
  Check,
  Send,
  CornerDownRight,
  Eye,
  X,
  Play,
  ListVideo,
  CheckCircle2,
} from 'lucide-react';

interface VideoPlayerViewProps {
  onOpenPlaylistModal: (video: MenderVideo) => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({ onOpenPlaylistModal }) => {
  const {
    activeVideoId,
    activePlaylistId,
    allAccessibleVideos,
    allAccessiblePlaylists,
    videoLikesByMe,
    videoCommentsMap,
    recordUniqueVideoView,
    toggleLikeVideo,
    subscribeToVideoComments,
    addVideoComment,
    toggleLikeVideoComment,
    deleteVideoComment,
    openVideoPlayer,
    openAuthorProfile,
    openUploadStudio,
    deleteVideo,
    setVideoSubView,
  } = useVideo();

  const {
    firebaseUser,
    profile,
    isSubscribed,
    toggleSubscription,
    submitReport,
  } = useAuth();

  const { usersDirectory, startDirectChatWithUser, setActiveChatId, setActiveTab } = useChat();

  const video = allAccessibleVideos.find(v => v.videoId === activeVideoId) || null;
  const activePlaylist = allAccessiblePlaylists.find(p => p.playlistId === activePlaylistId) || null;

  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>('');
  const [resolvedPosterUrl, setResolvedPosterUrl] = useState<string>('');
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<MenderVideoComment | null>(null);
  const [replyText, setReplyText] = useState('');

  // Report modal state
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    type: 'video' | 'video_comment';
    label: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Спам или вводящий в заблуждение контент');
  const [reportCustomText, setReportCustomText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [confirmDeleteVideo, setConfirmDeleteVideo] = useState(false);

  useEffect(() => {
    if (!video) return;
    let active = true;
    resolvePlayableMediaUrl(video.videoUrl).then(url => {
      if (active) setResolvedVideoUrl(url);
    });
    if (video.thumbnailUrl) {
      resolvePlayableMediaUrl(video.thumbnailUrl).then(tUrl => {
        if (active) setResolvedPosterUrl(tUrl);
      });
    } else {
      setResolvedPosterUrl('');
    }

    // Record deduplicated unique view (never duplicates on page reload)
    recordUniqueVideoView(video);

    // Subscribe to real-time comments for this video
    const unsub = subscribeToVideoComments(video.videoId);
    return () => {
      active = false;
      unsub();
    };
  }, [video?.videoId]);

  if (!video) {
    return (
      <div className="bg-white border border-[#E1E3E6] rounded-xl p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-[#19191A]">Видеоролик не найден или был удалён.</p>
        <button
          type="button"
          onClick={() => setVideoSubView('home')}
          className="px-4 py-2 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer"
        >
          Вернуться к видеороликам
        </button>
      </div>
    );
  }

  const isOwnVideo = firebaseUser?.uid === video.authorId;
  const isLiked = Boolean(videoLikesByMe[video.videoId]);
  const subscribed = isSubscribed(video.authorId);
  const authorDoc = usersDirectory.find(u => u.uid === video.authorId);
  const followersCount = authorDoc?.followersCount ?? 0;

  const allComments = videoCommentsMap[video.videoId] || [];
  const rootComments = allComments.filter(c => !c.parentCommentId);
  const getReplies = (parentId: string) =>
    allComments.filter(c => c.parentCommentId === parentId);

  const playlistVideos = activePlaylist
    ? activePlaylist.videoIds
        .map(id => allAccessibleVideos.find(v => v.videoId === id))
        .filter((v): v is MenderVideo => Boolean(v))
    : [];

  const recommendedVideos = allAccessibleVideos
    .filter(v => v.videoId !== video.videoId && v.status === 'published')
    .slice(0, 8);

  const handleMessageAuthor = async () => {
    const targetUser = authorDoc || {
      uid: video.authorId,
      displayName: video.authorName,
      username: video.authorUsername,
      avatarUrl: video.authorAvatar,
      bio: '',
      status: 'online',
      privacyLastSeen: 'everyone',
      privacyPhoto: 'everyone',
      privacyCalls: 'everyone',
      followersCount: 0,
      followingCount: 0,
    };
    const chatId = await startDirectChatWithUser(targetUser);
    setActiveChatId(chatId);
    setActiveTab('chats');
  };

  const handlePostRootComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');
    await addVideoComment(video, text, null);
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingTo || !replyText.trim()) return;
    const text = replyText.trim();
    const targetComment = replyingTo;
    setReplyText('');
    setReplyingTo(null);
    // Group under top-level parent if replying to a nested reply
    const rootParentId = targetComment.parentCommentId || targetComment.commentId;
    const rootCommentObj =
      allComments.find(c => c.commentId === rootParentId) || targetComment;
    await addVideoComment(video, text, {
      ...rootCommentObj,
      authorName: targetComment.authorName,
      authorId: targetComment.authorId,
    });
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    const fullReason = reportCustomText.trim()
      ? `${reportReason}: ${reportCustomText.trim()}`
      : reportReason;
    await submitReport(reportTarget.id, reportTarget.type, fullReason);
    setReportSubmitted(true);
    setTimeout(() => {
      setReportSubmitted(false);
      setReportTarget(null);
      setReportCustomText('');
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVideoSubView('home')}
          className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F0F2F5] border border-[#E1E3E6] text-xs font-semibold text-[#19191A] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад в Mender Video</span>
        </button>

        {video.status === 'draft' && (
          <span className="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-700 border border-amber-500/30 text-xs font-bold">
            Черновик (виден только вам)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Main Column: Player + Info + Author + Comments */}
        <div className="xl:col-span-8 space-y-4">
          {/* Video Player Container */}
          <div className="bg-black rounded-2xl overflow-hidden aspect-video border border-[#E1E3E6] shadow-xs">
            {resolvedVideoUrl ? (
              <video
                key={video.videoId}
                src={resolvedVideoUrl}
                poster={resolvedPosterUrl || undefined}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/70 text-xs">
                Загрузка видеопотока...
              </div>
            )}
          </div>

          {/* Video Details & Action Bar */}
          <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <h1 className="text-lg sm:text-xl font-bold text-[#19191A] leading-snug">
                {video.title}
              </h1>

              {/* Metadata line: Views · Date · Category · Duration */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#818C99] tabular-nums">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#19191A]">
                    <Eye className="w-4 h-4 text-[#0077FF]" />
                    {video.viewsCount} просмотров
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatVideoDate(video.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#19191A]">{video.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>Длительность: {formatVideoDuration(video.duration)}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLikeVideo(video)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors tabular-nums ${
                      isLiked
                        ? 'bg-[#FFEAEA] text-[#E64646] border border-[#FFCCCC]'
                        : 'bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                    <span>Нравится · {video.likesCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPlaylistModal(video)}
                    className="px-3.5 py-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ListPlus className="w-4 h-4 text-[#0077FF]" />
                    <span>В плейлист</span>
                  </button>

                  {isOwnVideo ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openUploadStudio(video)}
                        className="px-3 py-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Редактировать</span>
                      </button>

                      {!confirmDeleteVideo ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteVideo(true)}
                          className="px-3 py-2 rounded-lg bg-[#FFEAEA] hover:bg-[#FFD6D6] text-[#E64646] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Удалить</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => deleteVideo(video.videoId)}
                            className="px-3 py-2 rounded-lg bg-[#E64646] text-white text-xs font-bold cursor-pointer"
                          >
                            Подтвердить
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteVideo(false)}
                            className="px-2.5 py-2 rounded-lg bg-[#F0F2F5] text-xs text-[#19191A] cursor-pointer"
                          >
                            Отмена
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setReportTarget({
                          id: video.videoId,
                          type: 'video',
                          label: `Видео «${video.title}»`,
                        })
                      }
                      className="px-3 py-2 rounded-lg bg-[#F0F2F5] hover:bg-[#FFEAEA] text-[#818C99] hover:text-[#E64646] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Пожаловаться на нарушение"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Жалоба</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Author Strip: Avatar, Name, @username, Followers, Subscribe & Message Buttons */}
            <div className="pt-3 border-t border-[#E1E3E6] flex flex-wrap items-center justify-between gap-3">
              <div
                onClick={() => openAuthorProfile(video.authorId)}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <img
                  src={video.authorAvatar}
                  alt={video.authorName}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-[#E1E3E6] group-hover:ring-2 group-hover:ring-[#0077FF] transition-all"
                />
                <div>
                  <div className="text-sm font-bold text-[#19191A] group-hover:text-[#0077FF] transition-colors">
                    {video.authorName}
                  </div>
                  <div className="text-xs text-[#818C99] tabular-nums">
                    @{video.authorUsername} · {followersCount} подписчиков
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuthorProfile(video.authorId)}
                  className="px-3 py-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Профиль автора
                </button>

                {!isOwnVideo && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleSubscription(video.authorId, 'user')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        subscribed
                          ? 'bg-[#E5EBF1] text-[#0077FF]'
                          : 'bg-[#0077FF] hover:bg-[#0066EA] text-white'
                      }`}
                    >
                      {subscribed ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>{subscribed ? 'Вы подписаны' : 'Подписаться'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleMessageAuthor}
                      className="px-3.5 py-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] border border-[#E1E3E6] text-[#19191A] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#0077FF]" />
                      <span>Написать сообщение</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Description & Hashtags Box */}
            {(video.description || (video.hashtags && video.hashtags.length > 0)) && (
              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-2 text-xs">
                {video.hashtags && video.hashtags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-[#0077FF] font-semibold">
                    {video.hashtags.map(tag => (
                      <span key={tag}>{tag.startsWith('#') ? tag : `#${tag}`}</span>
                    ))}
                  </div>
                )}
                {video.description && (
                  <p className="text-[#19191A] whitespace-pre-wrap break-words leading-relaxed">
                    {video.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Threaded Comments Section */}
          <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#19191A] tabular-nums">
                Комментарии ({allComments.length})
              </h3>
            </div>

            {/* New Root Comment Form */}
            <form onSubmit={handlePostRootComment} className="flex items-start gap-3">
              {profile?.avatarUrl && (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#E1E3E6]"
                />
              )}
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Написать комментарий к видео..."
                  className="v7-input text-xs py-2.5"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="px-4 py-2.5 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Отправить</span>
                </button>
              </div>
            </form>

            {/* Comments List with Replies */}
            {rootComments.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] text-center text-xs text-[#818C99]">
                Комментариев пока нет. Станьте первым, кто поделится впечатлением!
              </div>
            ) : (
              <div className="space-y-3">
                {rootComments.map(comment => {
                  const isMyComment = firebaseUser?.uid === comment.authorId;
                  const canDelete = isMyComment || isOwnVideo;
                  const isCommentLiked = Boolean(
                    firebaseUser?.uid && comment.likedByUserIds?.includes(firebaseUser.uid)
                  );
                  const replies = getReplies(comment.commentId);

                  return (
                    <div
                      key={comment.commentId}
                      className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={comment.authorAvatar}
                          alt={comment.authorName}
                          onClick={() => openAuthorProfile(comment.authorId)}
                          className="w-8 h-8 rounded-full object-cover shrink-0 cursor-pointer border border-[#E1E3E6]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openAuthorProfile(comment.authorId)}
                              className="text-xs font-bold text-[#2A5885] hover:underline cursor-pointer"
                            >
                              {comment.authorName}{' '}
                              <span className="font-normal text-[#818C99]">
                                @{comment.authorUsername}
                              </span>
                            </button>
                            <span className="text-[10px] text-[#818C99]">
                              {formatVideoDate(comment.createdAt)}
                            </span>
                          </div>

                          <p className="text-xs text-[#19191A] mt-1 break-words leading-relaxed">
                            {comment.content}
                          </p>

                          {/* Comment Action Bar */}
                          <div className="flex flex-wrap items-center gap-4 mt-2 pt-1.5 border-t border-[#E1E3E6] text-[11px]">
                            <button
                              type="button"
                              onClick={() => toggleLikeVideoComment(video, comment)}
                              className={`flex items-center gap-1 font-medium cursor-pointer tabular-nums ${
                                isCommentLiked
                                  ? 'text-[#E64646]'
                                  : 'text-[#818C99] hover:text-[#E64646]'
                              }`}
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${isCommentLiked ? 'fill-current' : ''}`}
                              />
                              <span>{comment.likesCount || 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setReplyingTo(comment);
                                setReplyText('');
                              }}
                              className="flex items-center gap-1 text-[#0077FF] hover:underline font-medium cursor-pointer"
                            >
                              <CornerDownRight className="w-3 h-3" />
                              <span>Ответить</span>
                            </button>

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => deleteVideoComment(video, comment)}
                                className="flex items-center gap-1 text-[#818C99] hover:text-[#E64646] cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Удалить</span>
                              </button>
                            )}

                            {!isMyComment && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReportTarget({
                                    id: comment.commentId,
                                    type: 'video_comment',
                                    label: `Комментарий от ${comment.authorName}`,
                                  })
                                }
                                className="flex items-center gap-1 text-[#818C99] hover:text-[#E64646] cursor-pointer"
                              >
                                <Flag className="w-3 h-3" />
                                <span>Жалоба</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Nested Replies */}
                      {replies.length > 0 && (
                        <div className="pl-7 sm:pl-10 space-y-2.5 border-l-2 border-[#E1E3E6]">
                          {replies.map(reply => {
                            const isMyReply = firebaseUser?.uid === reply.authorId;
                            const canDeleteReply = isMyReply || isOwnVideo;
                            const isReplyLiked = Boolean(
                              firebaseUser?.uid &&
                                reply.likedByUserIds?.includes(firebaseUser.uid)
                            );
                            return (
                              <div
                                key={reply.commentId}
                                className="p-2.5 rounded-lg bg-white border border-[#E1E3E6] flex items-start gap-2.5"
                              >
                                <img
                                  src={reply.authorAvatar}
                                  alt={reply.authorName}
                                  onClick={() => openAuthorProfile(reply.authorId)}
                                  className="w-6 h-6 rounded-full object-cover shrink-0 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      onClick={() => openAuthorProfile(reply.authorId)}
                                      className="text-[11px] font-bold text-[#2A5885] hover:underline cursor-pointer"
                                    >
                                      {reply.authorName}
                                      {reply.replyToAuthorName && (
                                        <span className="font-normal text-[#818C99]">
                                          {' '}
                                          → {reply.replyToAuthorName}
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-[10px] text-[#818C99]">
                                      {formatVideoDate(reply.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#19191A] mt-0.5 break-words">
                                    {reply.content}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                                    <button
                                      type="button"
                                      onClick={() => toggleLikeVideoComment(video, reply)}
                                      className={`flex items-center gap-1 cursor-pointer tabular-nums ${
                                        isReplyLiked ? 'text-[#E64646]' : 'text-[#818C99]'
                                      }`}
                                    >
                                      <Heart
                                        className={`w-3 h-3 ${isReplyLiked ? 'fill-current' : ''}`}
                                      />
                                      <span>{reply.likesCount || 0}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingTo(reply);
                                        setReplyText('');
                                      }}
                                      className="text-[#0077FF] hover:underline cursor-pointer"
                                    >
                                      Ответить
                                    </button>

                                    {canDeleteReply && (
                                      <button
                                        type="button"
                                        onClick={() => deleteVideoComment(video, reply)}
                                        className="text-[#818C99] hover:text-[#E64646] cursor-pointer"
                                      >
                                        Удалить
                                      </button>
                                    )}

                                    {!isMyReply && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReportTarget({
                                            id: reply.commentId,
                                            type: 'video_comment',
                                            label: `Ответ от ${reply.authorName}`,
                                          })
                                        }
                                        className="text-[#818C99] hover:text-[#E64646] cursor-pointer"
                                      >
                                        Жалоба
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Active Reply Input Box */}
                      {replyingTo &&
                        (replyingTo.commentId === comment.commentId ||
                          replyingTo.parentCommentId === comment.commentId) && (
                          <form
                            onSubmit={handlePostReply}
                            className="pl-7 sm:pl-10 flex items-center gap-2 pt-1"
                          >
                            <input
                              type="text"
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder={`Ответ для ${replyingTo.authorName}...`}
                              className="v7-input text-xs py-1.5"
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer shrink-0"
                            >
                              Ответить
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyingTo(null)}
                              className="p-1.5 rounded-lg bg-[#EDEFEF] text-[#818C99] hover:text-[#19191A] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Active Playlist Queue + Recommended Videos */}
        <div className="xl:col-span-4 space-y-4">
          {activePlaylist && (
            <div className="bg-white border border-[#0077FF]/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E1E3E6] pb-2.5">
                <div>
                  <div className="text-xs font-bold text-[#0077FF] flex items-center gap-1.5">
                    <ListVideo className="w-4 h-4" />
                    <span>Плейлист: {activePlaylist.title}</span>
                  </div>
                  <p className="text-[11px] text-[#818C99]">
                    Автор: {activePlaylist.ownerName} · {playlistVideos.length} видео
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {playlistVideos.map((pVid, idx) => {
                  const isCurrentPlaying = pVid.videoId === video.videoId;
                  return (
                    <button
                      key={pVid.videoId}
                      type="button"
                      onClick={() => openVideoPlayer(pVid.videoId, activePlaylist.playlistId)}
                      className={`w-full p-2 rounded-lg border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                        isCurrentPlaying
                          ? 'bg-[#F0F6FF] border-[#0077FF]'
                          : 'bg-[#F7F8FA] border-[#E1E3E6] hover:bg-[#EDEFEF]'
                      }`}
                    >
                      <span className="text-xs font-mono tabular-nums text-[#818C99] w-5">
                        {isCurrentPlaying ? (
                          <Play className="w-3.5 h-3.5 text-[#0077FF] fill-current" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[#19191A] truncate">
                          {pVid.title}
                        </div>
                        <div className="text-[10px] text-[#818C99]">
                          {pVid.authorName} · {formatVideoDuration(pVid.duration)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommended Next Videos */}
          <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#19191A]">Другие видеоролики</h3>
            {recommendedVideos.length === 0 ? (
              <p className="text-xs text-[#818C99]">Пока нет других опубликованных видео.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {recommendedVideos.map(rec => (
                  <VideoCard
                    key={rec.videoId}
                    video={rec}
                    isOwnVideo={firebaseUser?.uid === rec.authorId}
                    onSelectVideo={v => openVideoPlayer(v.videoId)}
                    onSelectAuthor={aId => openAuthorProfile(aId)}
                    onAddToPlaylist={v => onOpenPlaylistModal(v)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Violation Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E1E3E6] rounded-2xl p-5 space-y-4 text-[#19191A] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E1E3E6] pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Flag className="w-4 h-4 text-[#E64646]" />
                <span>Пожаловаться на нарушение</span>
              </h3>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="p-1 rounded-lg hover:bg-[#F0F2F5] text-[#818C99]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="p-4 rounded-xl bg-[#E8F9E8] text-[#16A34A] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Жалоба сохранена в базе данных и передана на проверку.</span>
              </div>
            ) : (
              <form onSubmit={handleSendReport} className="space-y-3">
                <p className="text-xs text-[#818C99]">Объект: {reportTarget.label}</p>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Причина жалобы</label>
                  <select
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    className="v7-input text-xs"
                  >
                    <option value="Спам или вводящий в заблуждение контент">
                      Спам или вводящий в заблуждение контент
                    </option>
                    <option value="Оскорбления или травля">Оскорбления или травля</option>
                    <option value="Нарушение авторских прав">Нарушение авторских прав</option>
                    <option value="Запрещённый или опасный контент">
                      Запрещённый или опасный контент
                    </option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Подробности (необязательно)</label>
                  <textarea
                    rows={3}
                    value={reportCustomText}
                    onChange={e => setReportCustomText(e.target.value)}
                    placeholder="Опишите суть нарушения..."
                    className="v7-input text-xs resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportTarget(null)}
                    className="px-3.5 py-2 rounded-lg bg-[#F0F2F5] text-xs font-semibold cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#E64646] text-white text-xs font-semibold cursor-pointer"
                  >
                    Отправить жалобу
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
