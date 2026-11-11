import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useVideo } from '../../context/VideoContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { MenderVideo, UserPublic, VideoPlaylist } from '../../types';
import { VideoCard } from './VideoCard';
import {
  ArrowLeft,
  UserPlus,
  Check,
  MessageSquare,
  Film,
  ListVideo,
  Globe,
  Lock,
  Play,
  Trash2,
} from 'lucide-react';

interface AuthorChannelViewProps {
  onOpenPlaylistModal: (video: MenderVideo) => void;
}

export const AuthorChannelView: React.FC<AuthorChannelViewProps> = ({ onOpenPlaylistModal }) => {
  const {
    selectedAuthorId,
    allAccessibleVideos,
    allAccessiblePlaylists,
    openVideoPlayer,
    openAuthorProfile,
    openUploadStudio,
    deleteVideo,
    updatePlaylist,
    deletePlaylist,
    setVideoSubView,
  } = useVideo();

  const { firebaseUser, profile, isSubscribed, toggleSubscription } = useAuth();
  const { usersDirectory, startDirectChatWithUser, setActiveChatId, setActiveTab } = useChat();

  const [fetchedAuthor, setFetchedAuthor] = useState<UserPublic | null>(null);
  const [activeAuthorTab, setActiveAuthorTab] = useState<'videos' | 'playlists'>('videos');
  const [selectedPlaylist, setSelectedPlaylist] = useState<VideoPlaylist | null>(null);

  const authorId = selectedAuthorId || firebaseUser?.uid || '';
  const isMe = Boolean(firebaseUser?.uid && authorId === firebaseUser.uid);

  const directoryAuthor = isMe
    ? profile
    : usersDirectory.find(u => u.uid === authorId) || null;

  useEffect(() => {
    if (!authorId) return;
    if (directoryAuthor) {
      setFetchedAuthor(directoryAuthor);
      return;
    }
    getDoc(doc(db, 'users', authorId))
      .then(snap => {
        if (snap.exists()) {
          setFetchedAuthor(snap.data() as UserPublic);
        }
      })
      .catch(() => {});
  }, [authorId, directoryAuthor]);

  const authorVideos = allAccessibleVideos.filter(v => {
    if (v.authorId !== authorId) return false;
    if (!isMe && (v.status !== 'published' || v.visibility !== 'public')) return false;
    return true;
  });

  const authorPlaylists = allAccessiblePlaylists.filter(p => {
    if (p.ownerId !== authorId) return false;
    if (!isMe && p.visibility !== 'public') return false;
    return true;
  });

  const fallbackVideoAuthor = authorVideos[0];
  const resolvedAuthor: UserPublic = fetchedAuthor || {
    uid: authorId,
    displayName: fallbackVideoAuthor?.authorName || 'Автор Mender',
    username: fallbackVideoAuthor?.authorUsername || 'author',
    avatarUrl:
      fallbackVideoAuthor?.authorAvatar ||
      'https://ui-avatars.com/api/?name=Author&background=0077FF&color=fff',
    bio: 'Автор видеороликов на платформе Mender Video.',
    status: 'online',
    privacyLastSeen: 'everyone',
    privacyPhoto: 'everyone',
    privacyCalls: 'everyone',
    followersCount: 0,
    followingCount: 0,
  };

  const subscribed = isSubscribed(authorId);

  const handleMessageAuthor = async () => {
    const chatId = await startDirectChatWithUser(resolvedAuthor);
    setActiveChatId(chatId);
    setActiveTab('chats');
  };

  const playlistVideos = selectedPlaylist
    ? selectedPlaylist.videoIds
        .map(id => allAccessibleVideos.find(v => v.videoId === id))
        .filter((v): v is MenderVideo => Boolean(v))
    : [];

  return (
    <div className="space-y-4">
      {/* Top Back Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVideoSubView('home')}
          className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F0F2F5] border border-[#E1E3E6] text-xs font-semibold text-[#19191A] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Все видеоролики</span>
        </button>
      </div>

      {/* Author Header Banner Card */}
      <div className="bg-white border border-[#E1E3E6] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <img
            src={resolvedAuthor.avatarUrl}
            alt={resolvedAuthor.displayName}
            referrerPolicy="no-referrer"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-[#0077FF]/30 shrink-0"
          />
          <div className="space-y-1.5 max-w-xl">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl font-bold text-[#19191A]">{resolvedAuthor.displayName}</h1>
              <span className="text-xs font-medium text-[#818C99]">
                @{resolvedAuthor.username}
              </span>
            </div>

            {resolvedAuthor.bio && (
              <p className="text-xs text-[#19191A] leading-relaxed break-words">
                {resolvedAuthor.bio}
              </p>
            )}

            {/* Stats: Followers · Following · Published Videos · Playlists */}
            <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[#818C99] tabular-nums">
              <span>
                Подписчиков:{' '}
                <strong className="text-[#19191A] font-bold">
                  {resolvedAuthor.followersCount || 0}
                </strong>
              </span>
              <span>
                Подписок:{' '}
                <strong className="text-[#19191A] font-bold">
                  {resolvedAuthor.followingCount || 0}
                </strong>
              </span>
              <span>
                Опубликовано видео:{' '}
                <strong className="text-[#19191A] font-bold">
                  {authorVideos.filter(v => v.status === 'published').length}
                </strong>
              </span>
              <span>
                Плейлистов:{' '}
                <strong className="text-[#19191A] font-bold">{authorPlaylists.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Subscribe & Message Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isMe ? (
            <>
              <button
                type="button"
                onClick={() => openUploadStudio(null)}
                className="px-4 py-2.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Загрузить новое видео
              </button>
              <button
                type="button"
                onClick={() => setVideoSubView('analytics')}
                className="px-4 py-2.5 rounded-xl bg-[#F0F2F5] hover:bg-[#E5E7EB] border border-[#E1E3E6] text-[#19191A] text-xs font-semibold cursor-pointer transition-colors"
              >
                Аналитика автора
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => toggleSubscription(authorId, 'user')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  subscribed
                    ? 'bg-[#E5EBF1] text-[#0077FF]'
                    : 'bg-[#0077FF] hover:bg-[#0066EA] text-white'
                }`}
              >
                {subscribed ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>{subscribed ? 'Вы подписаны' : 'Подписаться'}</span>
              </button>

              <button
                type="button"
                onClick={handleMessageAuthor}
                className="px-4 py-2.5 rounded-xl bg-[#F0F2F5] hover:bg-[#E5E7EB] border border-[#E1E3E6] text-[#19191A] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-[#0077FF]" />
                <span>Написать сообщение</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs: Videos vs Playlists */}
      <div className="bg-white border border-[#E1E3E6] rounded-xl px-4 pt-2.5 flex items-center gap-6">
        <button
          type="button"
          onClick={() => {
            setActiveAuthorTab('videos');
            setSelectedPlaylist(null);
          }}
          className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 relative cursor-pointer transition-colors ${
            activeAuthorTab === 'videos'
              ? 'text-[#0077FF]'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Видеоролики автора ({authorVideos.length})</span>
          {activeAuthorTab === 'videos' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#0077FF]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveAuthorTab('playlists');
            setSelectedPlaylist(null);
          }}
          className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 relative cursor-pointer transition-colors ${
            activeAuthorTab === 'playlists'
              ? 'text-[#0077FF]'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          <ListVideo className="w-4 h-4" />
          <span>Плейлисты автора ({authorPlaylists.length})</span>
          {activeAuthorTab === 'playlists' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#0077FF]" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeAuthorTab === 'videos' ? (
        authorVideos.length === 0 ? (
          <div className="bg-white border border-[#E1E3E6] rounded-xl p-8 text-center text-xs text-[#818C99]">
            У этого автора пока нет опубликованных видеороликов.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {authorVideos.map(video => (
              <VideoCard
                key={video.videoId}
                video={video}
                isOwnVideo={isMe}
                onSelectVideo={v => openVideoPlayer(v.videoId)}
                onSelectAuthor={aId => openAuthorProfile(aId)}
                onAddToPlaylist={v => onOpenPlaylistModal(v)}
                onEditVideo={v => openUploadStudio(v)}
                onDeleteVideo={v => deleteVideo(v.videoId)}
              />
            ))}
          </div>
        )
      ) : selectedPlaylist ? (
        /* Viewing a specific playlist of the author */
        <div className="space-y-4">
          <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => setSelectedPlaylist(null)}
                className="text-xs text-[#0077FF] hover:underline font-semibold mb-1 inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Назад ко всем плейлистам автора</span>
              </button>
              <h3 className="text-base font-bold text-[#19191A]">{selectedPlaylist.title}</h3>
              {selectedPlaylist.description && (
                <p className="text-xs text-[#818C99] mt-0.5">{selectedPlaylist.description}</p>
              )}
            </div>

            {playlistVideos.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  openVideoPlayer(playlistVideos[0].videoId, selectedPlaylist.playlistId)
                }
                className="px-4 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Воспроизвести весь плейлист</span>
              </button>
            )}
          </div>

          {playlistVideos.length === 0 ? (
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-8 text-center text-xs text-[#818C99]">
              В этом плейлисте пока нет видеороликов.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlistVideos.map(v => (
                <VideoCard
                  key={v.videoId}
                  video={v}
                  isOwnVideo={firebaseUser?.uid === v.authorId}
                  onSelectVideo={vid => openVideoPlayer(vid.videoId, selectedPlaylist.playlistId)}
                  onSelectAuthor={aId => openAuthorProfile(aId)}
                  onAddToPlaylist={vid => onOpenPlaylistModal(vid)}
                />
              ))}
            </div>
          )}
        </div>
      ) : authorPlaylists.length === 0 ? (
        <div className="bg-white border border-[#E1E3E6] rounded-xl p-8 text-center text-xs text-[#818C99]">
          У автора пока нет доступных плейлистов.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {authorPlaylists.map(pl => (
            <div
              key={pl.playlistId}
              className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-[#0077FF]/50 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4
                    onClick={() => setSelectedPlaylist(pl)}
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
                  <p className="text-xs text-[#818C99] line-clamp-2">{pl.description}</p>
                )}

                <div className="text-xs font-semibold text-[#19191A] tabular-nums">
                  Видео в плейлисте: {pl.videoIds.length}
                </div>
              </div>

              <div className="pt-2 border-t border-[#E1E3E6] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlaylist(pl)}
                  className="px-3 py-1.5 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold cursor-pointer"
                >
                  Открыть плейлист
                </button>

                {isMe && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updatePlaylist(pl.playlistId, {
                          visibility: pl.visibility === 'public' ? 'private' : 'public',
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
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
