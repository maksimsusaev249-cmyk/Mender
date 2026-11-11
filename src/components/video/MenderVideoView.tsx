import React, { useState } from 'react';
import { useVideo } from '../../context/VideoContext';
import { useAuth } from '../../context/AuthContext';
import { MenderVideo, VideoPlaylist, VisibilityType } from '../../types';
import { VideoCard, formatVideoDate } from './VideoCard';
import { VideoUploadStudio, VIDEO_CATEGORIES } from './VideoUploadStudio';
import { VideoPlayerView } from './VideoPlayerView';
import { AuthorChannelView } from './AuthorChannelView';
import { VideoAnalyticsView } from './VideoAnalyticsView';
import {
  Film,
  Upload,
  ListVideo,
  BarChart3,
  Bell,
  Search,
  Plus,
  Check,
  Globe,
  Lock,
  Trash2,
  Play,
  User,
  X,
  FolderOpen,
  ArrowLeft,
} from 'lucide-react';

export const MenderVideoView: React.FC = () => {
  const {
    publicVideos,
    myVideos,
    allAccessibleVideos,
    publicPlaylists,
    myPlaylists,
    allAccessiblePlaylists,
    videoNotifications,
    unreadNotificationsCount,
    videoSubView,
    setVideoSubView,
    openVideoPlayer,
    openAuthorProfile,
    openUploadStudio,
    deleteVideo,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    toggleVideoInPlaylist,
    markNotificationRead,
    markAllNotificationsRead,
  } = useVideo();

  const { firebaseUser, isUserBlocked } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [myVideosFilter, setMyVideosFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Notifications dropdown
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Add-to-Playlist Modal state
  const [playlistModalVideo, setPlaylistModalVideo] = useState<MenderVideo | null>(null);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistVisibility, setNewPlaylistVisibility] = useState<VisibilityType>('public');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  // Playlists View state
  const [openedPlaylist, setOpenedPlaylist] = useState<VideoPlaylist | null>(null);
  const [showCreatePlaylistForm, setShowCreatePlaylistForm] = useState(false);

  const filteredHomeVideos = publicVideos.filter(v => {
    if (isUserBlocked(v.authorId)) return false;
    if (selectedCategory !== 'Все' && v.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = v.title.toLowerCase().includes(q);
      const matchDesc = v.description?.toLowerCase().includes(q);
      const matchAuthor =
        v.authorName.toLowerCase().includes(q) ||
        v.authorUsername.toLowerCase().includes(q);
      const matchTags = v.hashtags?.some(t => t.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchAuthor || matchTags;
    }
    return true;
  });

  const filteredMyVideos = myVideos.filter(v => {
    if (myVideosFilter === 'published') return v.status === 'published';
    if (myVideosFilter === 'draft') return v.status === 'draft';
    return true;
  });

  const handleCreateNewPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim() || isCreatingPlaylist) return;
    setIsCreatingPlaylist(true);
    try {
      await createPlaylist({
        title: newPlaylistTitle.trim(),
        description: newPlaylistDesc.trim(),
        visibility: newPlaylistVisibility,
        initialVideoId: playlistModalVideo?.videoId,
        coverUrl: playlistModalVideo?.thumbnailUrl || '',
      });
      setNewPlaylistTitle('');
      setNewPlaylistDesc('');
      setShowCreatePlaylistForm(false);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const activeOpenedPlaylist = openedPlaylist
    ? allAccessiblePlaylists.find(p => p.playlistId === openedPlaylist.playlistId) || openedPlaylist
    : null;

  const activeOpenedPlaylistVideos = activeOpenedPlaylist
    ? activeOpenedPlaylist.videoIds
        .map(id => allAccessibleVideos.find(v => v.videoId === id))
        .filter((v): v is MenderVideo => Boolean(v))
    : [];

  return (
    <div className="flex-1 bg-[#EDEEF0] overflow-y-auto p-2.5 sm:p-5 pb-20 md:pb-6 text-[#19191A] select-none">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* Top Mender Video Navigation Bar — Compact 2-row on Mobile, 1-row on Desktop */}
        <div className="bg-white border border-[#E1E3E6] rounded-xl p-2.5 sm:px-4 sm:py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 relative">
          {/* Top Row on Mobile: Logo + Bell + Upload CTA */}
          <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => {
                setOpenedPlaylist(null);
                setVideoSubView('home');
              }}
              className="flex items-center gap-2 cursor-pointer shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0077FF] text-white flex items-center justify-center shadow-xs shrink-0">
                <Film className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#19191A] whitespace-nowrap">
                Mender Video
              </span>
            </button>

            {/* Mobile Right Controls (visible on < lg) */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNotifPanel(prev => !prev)}
                className="p-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] relative cursor-pointer transition-colors"
                title="Уведомления"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E64646] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => openUploadStudio(null)}
                className="px-3 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>Опубликовать</span>
              </button>
            </div>
          </div>

          {/* Horizontal Scrollable Pill Navigation Tabs (1 line on Mobile & Desktop) */}
          <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
            <button
              type="button"
              onClick={() => {
                setOpenedPlaylist(null);
                setVideoSubView('home');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                videoSubView === 'home'
                  ? 'bg-[#E5EBF1] text-[#0077FF]'
                  : 'text-[#818C99] hover:text-[#19191A] hover:bg-[#F0F2F5]'
              }`}
            >
              Все видео
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenedPlaylist(null);
                setVideoSubView('playlists');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                videoSubView === 'playlists'
                  ? 'bg-[#E5EBF1] text-[#0077FF]'
                  : 'text-[#818C99] hover:text-[#19191A] hover:bg-[#F0F2F5]'
              }`}
            >
              <ListVideo className="w-3.5 h-3.5 shrink-0" />
              <span>Плейлисты</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenedPlaylist(null);
                setVideoSubView('my_videos');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                videoSubView === 'my_videos'
                  ? 'bg-[#E5EBF1] text-[#0077FF]'
                  : 'text-[#818C99] hover:text-[#19191A] hover:bg-[#F0F2F5]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Мои видео ({myVideos.length})</span>
              <span className="hidden sm:inline">Мои видео и черновики ({myVideos.length})</span>
            </button>

            {firebaseUser && (
              <button
                type="button"
                onClick={() => openAuthorProfile(firebaseUser.uid)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  videoSubView === 'author'
                    ? 'bg-[#E5EBF1] text-[#0077FF]'
                    : 'text-[#818C99] hover:text-[#19191A] hover:bg-[#F0F2F5]'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>Профиль автора</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setVideoSubView('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                videoSubView === 'analytics'
                  ? 'bg-[#E5EBF1] text-[#0077FF]'
                  : 'text-[#818C99] hover:text-[#19191A] hover:bg-[#F0F2F5]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>Аналитика</span>
            </button>
          </nav>

          {/* Desktop Right Controls: Notifications Bell & Upload CTA */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNotifPanel(prev => !prev)}
              className="p-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] relative cursor-pointer transition-colors"
              title="Уведомления о подписчиках, комментариях и реакциях"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E64646] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => openUploadStudio(null)}
              className="px-3.5 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Опубликовать видео</span>
            </button>
          </div>

          {/* Mobile-safe & Desktop Notifications Popover */}
          {showNotifPanel && (
            <>
              <div
                onClick={() => setShowNotifPanel(false)}
                className="fixed inset-0 bg-black/25 z-40 sm:hidden"
              />
              <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-auto sm:right-3 sm:top-full sm:mt-2 sm:w-96 bg-white border border-[#E1E3E6] rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E1E3E6] flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#19191A]">
                    Уведомления ({unreadNotificationsCount} новых)
                  </span>
                  <div className="flex items-center gap-2">
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] text-[#0077FF] hover:underline font-medium cursor-pointer"
                      >
                        Прочитать все
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotifPanel(false)}
                      className="p-1 rounded hover:bg-[#F0F2F5] text-[#818C99]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[65vh] sm:max-h-96 overflow-y-auto divide-y divide-[#E1E3E6]">
                  {videoNotifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#818C99]">
                      Уведомлений пока нет. Здесь появятся новые подписчики, комментарии, ответы и лайки ваших видео.
                    </div>
                  ) : (
                    videoNotifications.map(notif => {
                      let actionText = '';
                      if (notif.type === 'new_subscriber') {
                        actionText = 'подписался(-ась) на ваш профиль автора';
                      } else if (notif.type === 'video_like') {
                        actionText = `оценил(-а) ваше видео «${notif.videoTitle}»`;
                      } else if (notif.type === 'new_comment') {
                        actionText = `оставил(-а) комментарий к видео «${notif.videoTitle}»: "${notif.commentText}"`;
                      } else if (notif.type === 'comment_reply') {
                        actionText = `ответил(-а) на ваш комментарий под «${notif.videoTitle}»: "${notif.commentText}"`;
                      } else if (notif.type === 'comment_like') {
                        actionText = `оценил(-а) ваш комментарий: "${notif.commentText}"`;
                      }

                      return (
                        <div
                          key={notif.notificationId}
                          onClick={() => {
                            markNotificationRead(notif.notificationId);
                            setShowNotifPanel(false);
                            if (notif.videoId) {
                              openVideoPlayer(notif.videoId);
                            } else {
                              openAuthorProfile(notif.actorId);
                            }
                          }}
                          className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-[#F7F8FA] transition-colors ${
                            !notif.isRead ? 'bg-[#F0F6FF]' : 'bg-white'
                          }`}
                        >
                          <img
                            src={notif.actorAvatar}
                            alt={notif.actorName}
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#E1E3E6]"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <p className="text-[#19191A] leading-snug">
                              <strong className="font-bold text-[#2A5885]">
                                {notif.actorName}
                              </strong>{' '}
                              {actionText}
                            </p>
                            <span className="text-[10px] text-[#818C99] mt-0.5 block">
                              {formatVideoDate(notif.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Route SubViews */}
        {videoSubView === 'upload' && <VideoUploadStudio />}

        {videoSubView === 'watch' && (
          <VideoPlayerView onOpenPlaylistModal={v => setPlaylistModalVideo(v)} />
        )}

        {videoSubView === 'author' && (
          <AuthorChannelView onOpenPlaylistModal={v => setPlaylistModalVideo(v)} />
        )}

        {videoSubView === 'analytics' && <VideoAnalyticsView />}

        {videoSubView === 'my_videos' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[#19191A]">
                  Мои видеоролики и черновики
                </h2>
                <p className="text-xs text-[#818C99]">
                  Управляйте опубликованными видео и дорабатывайте сохранённые черновики
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#F0F2F5] p-1 rounded-lg overflow-x-auto no-scrollbar w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setMyVideosFilter('all')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap text-center ${
                    myVideosFilter === 'all'
                      ? 'bg-white text-[#19191A] shadow-2xs'
                      : 'text-[#818C99]'
                  }`}
                >
                  Все ({myVideos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMyVideosFilter('published')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap text-center ${
                    myVideosFilter === 'published'
                      ? 'bg-white text-[#19191A] shadow-2xs'
                      : 'text-[#818C99]'
                  }`}
                >
                  Опубликованные ({myVideos.filter(v => v.status === 'published').length})
                </button>
                <button
                  type="button"
                  onClick={() => setMyVideosFilter('draft')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap text-center ${
                    myVideosFilter === 'draft'
                      ? 'bg-white text-[#19191A] shadow-2xs'
                      : 'text-[#818C99]'
                  }`}
                >
                  Черновики ({myVideos.filter(v => v.status === 'draft').length})
                </button>
              </div>
            </div>

            {filteredMyVideos.length === 0 ? (
              <div className="bg-white border border-[#E1E3E6] rounded-xl p-8 text-center space-y-3">
                <p className="text-xs text-[#818C99]">
                  В этом разделе пока нет видеороликов.
                </p>
                <button
                  type="button"
                  onClick={() => openUploadStudio(null)}
                  className="px-4 py-2 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer"
                >
                  Загрузить видео
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMyVideos.map(video => (
                  <VideoCard
                    key={video.videoId}
                    video={video}
                    isOwnVideo={true}
                    onSelectVideo={v => openVideoPlayer(v.videoId)}
                    onSelectAuthor={aId => openAuthorProfile(aId)}
                    onAddToPlaylist={v => setPlaylistModalVideo(v)}
                    onEditVideo={v => openUploadStudio(v)}
                    onDeleteVideo={v => deleteVideo(v.videoId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {videoSubView === 'playlists' && (
          <div className="space-y-4">
            {activeOpenedPlaylist ? (
              <div className="space-y-4">
                <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenedPlaylist(null)}
                      className="text-xs text-[#0077FF] hover:underline font-semibold mb-1 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Назад ко всем плейлистам</span>
                    </button>
                    <h2 className="text-base font-bold text-[#19191A]">
                      Плейлист: {activeOpenedPlaylist.title}
                    </h2>
                    <p className="text-xs text-[#818C99]">
                      Автор: {activeOpenedPlaylist.ownerName} (@{activeOpenedPlaylist.ownerUsername}) ·{' '}
                      {activeOpenedPlaylist.visibility === 'public' ? 'Публичный' : 'Приватный'} ·{' '}
                      {activeOpenedPlaylistVideos.length} видео
                    </p>
                  </div>

                  {activeOpenedPlaylistVideos.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        openVideoPlayer(
                          activeOpenedPlaylistVideos[0].videoId,
                          activeOpenedPlaylist.playlistId
                        )
                      }
                      className="px-4 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Смотреть плейлист</span>
                    </button>
                  )}
                </div>

                {activeOpenedPlaylistVideos.length === 0 ? (
                  <div className="bg-white border border-[#E1E3E6] rounded-xl p-8 text-center text-xs text-[#818C99]">
                    В этом плейлисте пока нет видеороликов.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeOpenedPlaylistVideos.map(v => {
                      const isPlaylistOwner =
                        firebaseUser?.uid === activeOpenedPlaylist.ownerId;
                      return (
                        <div key={v.videoId} className="space-y-1.5">
                          <VideoCard
                            video={v}
                            isOwnVideo={firebaseUser?.uid === v.authorId}
                            onSelectVideo={vid =>
                              openVideoPlayer(vid.videoId, activeOpenedPlaylist.playlistId)
                            }
                            onSelectAuthor={aId => openAuthorProfile(aId)}
                            onAddToPlaylist={vid => setPlaylistModalVideo(vid)}
                          />
                          {isPlaylistOwner && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleVideoInPlaylist(activeOpenedPlaylist.playlistId, v)
                              }
                              className="w-full py-1.5 rounded-lg bg-white hover:bg-[#FFEAEA] border border-[#E1E3E6] text-xs font-medium text-[#E64646] cursor-pointer transition-colors"
                            >
                              Убрать из плейлиста
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[#19191A]">
                      Плейлисты Mender Video
                    </h2>
                    <p className="text-xs text-[#818C99]">
                      Создавайте публичные и приватные подборки видео и открывайте плейлисты других авторов
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreatePlaylistForm(prev => !prev)}
                    className="px-3.5 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Создать плейлист</span>
                  </button>
                </div>

                {showCreatePlaylistForm && (
                  <form
                    onSubmit={handleCreateNewPlaylist}
                    className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3"
                  >
                    <h3 className="text-sm font-bold text-[#19191A]">Новый плейлист</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={newPlaylistTitle}
                        onChange={e => setNewPlaylistTitle(e.target.value)}
                        placeholder="Название плейлиста *"
                        className="v7-input text-xs"
                      />
                      <select
                        value={newPlaylistVisibility}
                        onChange={e => setNewPlaylistVisibility(e.target.value as VisibilityType)}
                        className="v7-input text-xs"
                      >
                        <option value="public">Публичный (виден всем пользователям)</option>
                        <option value="private">Приватный (только для меня)</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      maxLength={1000}
                      value={newPlaylistDesc}
                      onChange={e => setNewPlaylistDesc(e.target.value)}
                      placeholder="Описание плейлиста (необязательно)"
                      className="v7-input text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCreatePlaylistForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-[#F0F2F5] text-xs font-semibold cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingPlaylist}
                        className="px-4 py-1.5 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer"
                      >
                        Создать
                      </button>
                    </div>
                  </form>
                )}

                {/* My Playlists */}
                <div className="space-y-2.5">
                  <h3 className="text-sm font-bold text-[#19191A]">
                    Мои плейлисты ({myPlaylists.length})
                  </h3>
                  {myPlaylists.length === 0 ? (
                    <div className="bg-white border border-[#E1E3E6] rounded-xl p-6 text-center text-xs text-[#818C99]">
                      У вас пока нет созданных плейлистов. Нажмите «Создать плейлист» выше.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myPlaylists.map(pl => (
                        <div
                          key={pl.playlistId}
                          className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <h4
                                onClick={() => setOpenedPlaylist(pl)}
                                className="text-sm font-bold text-[#19191A] hover:text-[#0077FF] cursor-pointer truncate"
                              >
                                {pl.title}
                              </h4>
                              <span className="text-[11px] text-[#818C99] flex items-center gap-1 shrink-0">
                                {pl.visibility === 'public' ? (
                                  <>
                                    <Globe className="w-3 h-3 text-[#16A34A]" />
                                    <span>Публичный</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3 h-3 text-amber-600" />
                                    <span>Приватный</span>
                                  </>
                                )}
                              </span>
                            </div>
                            {pl.description && (
                              <p className="text-xs text-[#818C99] line-clamp-2">
                                {pl.description}
                              </p>
                            )}
                            <p className="text-xs font-semibold text-[#19191A] tabular-nums">
                              Видеороликов: {pl.videoIds.length}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#E1E3E6] flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setOpenedPlaylist(pl)}
                              className="px-3 py-1.5 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer"
                            >
                              Открыть
                            </button>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  updatePlaylist(pl.playlistId, {
                                    visibility:
                                      pl.visibility === 'public' ? 'private' : 'public',
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[11px] font-medium text-[#19191A] cursor-pointer"
                              >
                                {pl.visibility === 'public' ? 'Сделать приватным' : 'Сделать публичным'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePlaylist(pl.playlistId)}
                                className="p-1.5 rounded-lg hover:bg-[#FFEAEA] text-[#818C99] hover:text-[#E64646] cursor-pointer"
                                title="Удалить плейлист"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Public Playlists of Other Users */}
                <div className="space-y-2.5 pt-2">
                  <h3 className="text-sm font-bold text-[#19191A]">
                    Публичные плейлисты пользователей (
                    {publicPlaylists.filter(p => p.ownerId !== firebaseUser?.uid).length})
                  </h3>
                  {publicPlaylists.filter(p => p.ownerId !== firebaseUser?.uid).length === 0 ? (
                    <div className="bg-white border border-[#E1E3E6] rounded-xl p-6 text-center text-xs text-[#818C99]">
                      Другие пользователи пока не опубликовали публичных плейлистов.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {publicPlaylists
                        .filter(p => p.ownerId !== firebaseUser?.uid)
                        .map(pl => (
                          <div
                            key={pl.playlistId}
                            className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1.5">
                              <h4
                                onClick={() => setOpenedPlaylist(pl)}
                                className="text-sm font-bold text-[#19191A] hover:text-[#0077FF] cursor-pointer truncate"
                              >
                                {pl.title}
                              </h4>
                              <button
                                type="button"
                                onClick={() => openAuthorProfile(pl.ownerId)}
                                className="text-xs text-[#2A5885] hover:underline cursor-pointer"
                              >
                                Автор: {pl.ownerName} (@{pl.ownerUsername})
                              </button>
                              {pl.description && (
                                <p className="text-xs text-[#818C99] line-clamp-2">
                                  {pl.description}
                                </p>
                              )}
                              <p className="text-xs font-semibold text-[#19191A] tabular-nums">
                                Видеороликов: {pl.videoIds.length}
                              </p>
                            </div>
                            <div className="pt-2 border-t border-[#E1E3E6]">
                              <button
                                type="button"
                                onClick={() => setOpenedPlaylist(pl)}
                                className="px-3.5 py-1.5 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer"
                              >
                                Открыть плейлист
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Home View: Search + Categories + Video Grid */}
        {videoSubView === 'home' && (
          <div className="space-y-3 sm:space-y-4">
            {/* Search and Category Filters */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-3 sm:p-3.5 space-y-2.5 sm:space-y-3">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-[#818C99] absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск видео по названию, #хештегам или автору..."
                  className="v7-input v7-input-search text-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 p-1 rounded-full hover:bg-[#F0F2F5] text-[#818C99] hover:text-[#19191A] cursor-pointer"
                    title="Очистить поиск"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
                {['Все', ...VIDEO_CATEGORIES].map(cat => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#0077FF] text-white'
                          : 'bg-[#F0F2F5] text-[#19191A] hover:bg-[#E5E7EB]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Video Feed Grid */}
            {filteredHomeVideos.length === 0 ? (
              <div className="bg-white border border-[#E1E3E6] rounded-2xl p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#0077FF]/10 text-[#0077FF] flex items-center justify-center mx-auto">
                  <Film className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#19191A]">
                    {searchQuery || selectedCategory !== 'Все'
                      ? 'По вашему запросу видеороликов не найдено'
                      : 'В ленте Mender Video пока нет опубликованных роликов'}
                  </h3>
                  <p className="text-xs text-[#818C99] max-w-md mx-auto">
                    Опубликуйте своё первое видео с обложкой из кадра ролика, описанием и хештегами — оно сразу станет доступно зрителям!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openUploadStudio(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Загрузить и опубликовать видео</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHomeVideos.map(video => (
                  <VideoCard
                    key={video.videoId}
                    video={video}
                    isOwnVideo={firebaseUser?.uid === video.authorId}
                    onSelectVideo={v => openVideoPlayer(v.videoId)}
                    onSelectAuthor={aId => openAuthorProfile(aId)}
                    onAddToPlaylist={v => setPlaylistModalVideo(v)}
                    onEditVideo={v => openUploadStudio(v)}
                    onDeleteVideo={v => deleteVideo(v.videoId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add-to-Playlist Modal */}
      {playlistModalVideo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E1E3E6] rounded-2xl p-5 space-y-4 text-[#19191A] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E1E3E6] pb-3">
              <div>
                <h3 className="text-sm font-bold">Добавить в плейлист</h3>
                <p className="text-xs text-[#818C99] truncate max-w-xs">
                  {playlistModalVideo.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlaylistModalVideo(null)}
                className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#818C99]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Existing Playlists Checklist */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {myPlaylists.length === 0 ? (
                <p className="text-xs text-[#818C99]">
                  У вас ещё нет плейлистов. Создайте новый плейлист ниже.
                </p>
              ) : (
                myPlaylists.map(pl => {
                  const included = pl.videoIds.includes(playlistModalVideo.videoId);
                  return (
                    <button
                      key={pl.playlistId}
                      type="button"
                      onClick={() => toggleVideoInPlaylist(pl.playlistId, playlistModalVideo)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                        included
                          ? 'bg-[#F0F6FF] border-[#0077FF] font-semibold'
                          : 'bg-[#F7F8FA] border-[#E1E3E6] hover:bg-[#EDEFEF]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {pl.visibility === 'public' ? (
                          <Globe className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span className="truncate">{pl.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-[#818C99]">
                          {pl.videoIds.length} видео
                        </span>
                        {included && <Check className="w-4 h-4 text-[#0077FF]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Quick Create New Playlist */}
            <form
              onSubmit={handleCreateNewPlaylist}
              className="pt-3 border-t border-[#E1E3E6] space-y-2.5"
            >
              <div className="text-xs font-semibold text-[#19191A]">
                Создать новый плейлист и добавить видео
              </div>
              <input
                type="text"
                required
                maxLength={120}
                value={newPlaylistTitle}
                onChange={e => setNewPlaylistTitle(e.target.value)}
                placeholder="Название нового плейлиста..."
                className="v7-input text-xs"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={newPlaylistVisibility}
                  onChange={e => setNewPlaylistVisibility(e.target.value as VisibilityType)}
                  className="v7-input text-xs py-1.5"
                >
                  <option value="public">Публичный</option>
                  <option value="private">Приватный</option>
                </select>
                <button
                  type="submit"
                  disabled={!newPlaylistTitle.trim() || isCreatingPlaylist}
                  className="px-4 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shrink-0"
                >
                  Создать и добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
