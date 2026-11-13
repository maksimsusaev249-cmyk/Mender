import React, { useState, useRef, useMemo } from 'react';
import { useMusic } from '../../context/MusicContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  MenderMusicTrack,
  MenderMusicAlbum,
  MenderMusicArtist,
  VisibilityType,
} from '../../types';
import {
  MUSIC_GENRES,
  BUILTIN_MUSIC_COVERS,
  formatMusicDuration,
} from '../../utils/musicAudioGenerator';
import {
  validateAudioFile,
  extractAudioDuration,
  validateCoverImageFile,
} from '../../utils/media';
import {
  Music,
  Play,
  Pause,
  Shuffle,
  Heart,
  Plus,
  ListMusic,
  Share2,
  Search,
  Upload,
  Disc,
  Clock,
  Sparkles,
  Flame,
  FolderPlus,
  Trash2,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Send,
  Copy,
  Check,
  Headphones,
  Library,
  TrendingUp,
} from 'lucide-react';

type LibraryTab = 'favorites' | 'recent' | 'uploads' | 'genres';

export const MenderMusicView: React.FC = () => {
  const {
    allTracks,
    uploadedTracks,
    myUploadedTracks,
    albums,
    artists,
    playlists,
    myPlaylists,
    officialMenderPlaylist,
    favoriteTrackIds,
    favoriteTracks,
    recentlyPlayedTracks,
    musicSubView,
    setMusicSubView,
    selectedGenre,
    setSelectedGenre,
    selectedAlbumId,
    selectedArtistId,
    selectedPlaylistId,
    openAlbum,
    openArtist,
    openPlaylist,
    openUploadTrackStudio,
    currentTrack,
    isPlaying,
    playTrack,
    pauseMusic,
    resumeMusic,
    addToQueue,
    toggleFavoriteTrack,
    clearListeningHistory,
    createMusicPlaylist,
    deleteMusicPlaylist,
    toggleTrackInPlaylist,
    uploadMusicTrack,
    deleteUploadedTrack,
  } = useMusic();

  const { profile } = useAuth();
  const { chats, setActiveChatId, setActiveTab, sendMessage } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('favorites');

  // Modals: Add to playlist, Create playlist, Share track
  const [playlistModalTrack, setPlaylistModalTrack] = useState<MenderMusicTrack | null>(null);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistVisibility] = useState<VisibilityType>('public');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const [shareModalTrack, setShareModalTrack] = useState<MenderMusicTrack | null>(null);
  const [copiedTrackLink, setCopiedTrackLink] = useState(false);
  const [sharedToChatId, setSharedToChatId] = useState<string | null>(null);

  // Upload track form state
  const [uploadAudioFile, setUploadAudioFile] = useState<File | null>(null);
  const [uploadCoverFile, setUploadCoverFile] = useState<File | null>(null);
  const [uploadCoverPreview, setUploadCoverPreview] = useState<string>(BUILTIN_MUSIC_COVERS.aurora);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadAlbum, setUploadAlbum] = useState('Общий плейлист от Mender');
  const [uploadGenre, setUploadGenre] = useState<string>('Электроника');
  const [uploadYear] = useState<number>(2026);
  const [uploadLyrics, setUploadLyrics] = useState('');
  const [uploadVisibility] = useState<VisibilityType>('public');
  const [uploadDuration, setUploadDuration] = useState<number>(180);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const q = searchQuery.trim().toLowerCase();

  const filteredSearchTracks = useMemo(() => {
    if (!q) return [];
    return allTracks.filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.albumTitle.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
    );
  }, [allTracks, q]);

  const filteredSearchAlbums = useMemo(() => {
    if (!q) return [];
    return albums.filter(
      a =>
        a.title.toLowerCase().includes(q) ||
        a.artist.toLowerCase().includes(q) ||
        a.genre.toLowerCase().includes(q)
    );
  }, [albums, q]);

  // Рекомендации: персональный подбор из реальных треков (недавние + избранные + базовые темы)
  const recommendedTracks = useMemo(() => {
    const favoriteGenres = new Set(favoriteTracks.map(t => t.genre));
    const scored = [...allTracks].sort((a, b) => {
      const scoreA =
        (favoriteGenres.has(a.genre) ? 3 : 0) +
        (favoriteTrackIds[a.trackId] ? 1 : 0) +
        (a.likesCount || 0) * 0.2;
      const scoreB =
        (favoriteGenres.has(b.genre) ? 3 : 0) +
        (favoriteTrackIds[b.trackId] ? 1 : 0) +
        (b.likesCount || 0) * 0.2;
      return scoreB - scoreA;
    });
    return scored.slice(0, 6);
  }, [allTracks, favoriteTrackIds, favoriteTracks]);

  // Новинки: свежие загруженные треки и новейшие релизы
  const newReleaseTracks = useMemo(() => {
    return [...allTracks].sort((a, b) => {
      const tsA = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const tsB = typeof b.createdAt === 'number' ? b.createdAt : 0;
      return tsB - tsA;
    });
  }, [allTracks]);

  // Популярная музыка: сортировка по прослушиваниям и лайкам
  const popularTracks = useMemo(() => {
    return [...allTracks].sort(
      (a, b) => b.playsCount + b.likesCount * 2 - (a.playsCount + a.likesCount * 2)
    );
  }, [allTracks]);

  const genreTracks = useMemo(() => {
    if (selectedGenre === 'Все жанры') return allTracks;
    return allTracks.filter(t => t.genre === selectedGenre);
  }, [allTracks, selectedGenre]);

  const activeAlbum: MenderMusicAlbum | null = useMemo(
    () => albums.find(a => a.albumId === selectedAlbumId) || null,
    [albums, selectedAlbumId]
  );

  const activeArtist: MenderMusicArtist | null = useMemo(
    () => artists.find(a => a.artistId === selectedArtistId) || null,
    [artists, selectedArtistId]
  );

  const activePlaylist = useMemo(
    () => playlists.find(p => p.playlistId === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  const isSectionActive = (sec: 'music' | 'library' | 'playlists') => {
    if (sec === 'music') {
      return musicSubView === 'home' || musicSubView === 'album_detail' || musicSubView === 'artist_detail';
    }
    if (sec === 'library') {
      return (
        musicSubView === 'library' ||
        musicSubView === 'favorites' ||
        musicSubView === 'history' ||
        musicSubView === 'my_uploads' ||
        musicSubView === 'genres' ||
        musicSubView === 'albums' ||
        musicSubView === 'artists' ||
        musicSubView === 'upload'
      );
    }
    return musicSubView === 'playlists' || musicSubView === 'playlist_detail';
  };

  const handleBack = () => {
    if (q) {
      setSearchQuery('');
      return;
    }
    if (musicSubView === 'playlist_detail') {
      setMusicSubView('playlists');
      return;
    }
    if (musicSubView === 'album_detail' || musicSubView === 'artist_detail' || musicSubView === 'upload') {
      setMusicSubView('home');
      return;
    }
    if (musicSubView !== 'home') {
      setMusicSubView('home');
      return;
    }
    setActiveTab('menu');
  };

  const handleTrackPlayToggle = (track: MenderMusicTrack, listContext: MenderMusicTrack[]) => {
    if (currentTrack?.trackId === track.trackId) {
      if (isPlaying) {
        pauseMusic();
      } else {
        void resumeMusic();
      }
      return;
    }
    void playTrack(track, listContext);
  };

  const handleSelectAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);

    const err = validateAudioFile(file);
    if (err) {
      setUploadError(err);
      return;
    }

    setUploadAudioFile(file);
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
    if (!uploadTitle) setUploadTitle(baseName);
    if (!uploadArtist) setUploadArtist(profile?.displayName || '');

    const dur = await extractAudioDuration(file);
    setUploadDuration(dur);
  };

  const handleSelectCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateCoverImageFile(file);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadCoverFile(file);
    setUploadCoverPreview(URL.createObjectURL(file));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!uploadAudioFile) {
      setUploadError('Выберите аудиофайл (MP3, WAV, FLAC, OGG, M4A).');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Укажите название композиции.');
      return;
    }
    if (!rightsConfirmed) {
      setUploadError('Подтвердите права на использование аудиофайла.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    try {
      const created = await uploadMusicTrack({
        audioFile: uploadAudioFile,
        coverFile: uploadCoverFile,
        coverUrl: uploadCoverPreview,
        title: uploadTitle,
        artist: uploadArtist || profile?.displayName || 'Mender User',
        albumTitle: uploadAlbum || 'Общий плейлист от Mender',
        genre: uploadGenre,
        releaseYear: uploadYear,
        lyrics: uploadLyrics,
        visibility: uploadVisibility,
        duration: uploadDuration,
        onProgress: pct => setUploadProgress(pct),
      });

      setUploadSuccess(`Трек «${created.title}» опубликован!`);
      setUploadAudioFile(null);
      setUploadCoverFile(null);
      setUploadTitle('');
      setUploadLyrics('');
      setRightsConfirmed(false);
      await playTrack(created, [created, ...allTracks]);
    } catch (err: any) {
      setUploadError(err?.message || 'Ошибка при загрузке аудиофайла.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreatePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) return;
    setCreatingPlaylist(true);
    try {
      const pl = await createMusicPlaylist({
        title: newPlaylistTitle,
        description: newPlaylistDesc,
        visibility: newPlaylistVisibility,
        coverUrl: playlistModalTrack?.coverUrl || BUILTIN_MUSIC_COVERS.aurora,
        initialTrackId: playlistModalTrack?.trackId,
      });
      setNewPlaylistTitle('');
      setNewPlaylistDesc('');
      setShowCreatePlaylistModal(false);
      if (!playlistModalTrack) {
        openPlaylist(pl.playlistId);
      } else {
        setPlaylistModalTrack(null);
      }
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleShareTrackToChat = async (chatId: string, track: MenderMusicTrack) => {
    setActiveChatId(chatId);
    const shareText = `🎵 Mender Music: ${track.artist} — «${track.title}» (${track.albumTitle}, ${track.genre} · ${formatMusicDuration(track.duration)})`;
    await sendMessage({ content: shareText, type: 'text' });
    setSharedToChatId(chatId);
    setTimeout(() => {
      setSharedToChatId(null);
      setShareModalTrack(null);
      setActiveTab('chats');
    }, 550);
  };

  const handleCopyTrackShare = (track: MenderMusicTrack) => {
    const shareUrl = `${window.location.origin}/?music=${encodeURIComponent(track.trackId)}`;
    navigator.clipboard?.writeText(
      `🎵 ${track.artist} — ${track.title} в Mender Music: ${shareUrl}`
    );
    setCopiedTrackLink(true);
    setTimeout(() => setCopiedTrackLink(false), 2000);
  };

  // Чистая строка трека
  const renderTrackRow = (
    track: MenderMusicTrack,
    listContext: MenderMusicTrack[],
    index?: number,
    rankNumber?: number,
    playlistIdForRemove?: string
  ) => {
    const isCurrent = currentTrack?.trackId === track.trackId;
    const isFav = Boolean(favoriteTrackIds[track.trackId]);
    const isMine = track.uploaderId === profile?.uid && !track.isBuiltIn;

    return (
      <div
        key={`${track.trackId}_${index ?? 0}`}
        onClick={() => handleTrackPlayToggle(track, listContext)}
        className={`group flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
          isCurrent
            ? 'bg-[#0077FF]/15 border-[#0077FF]/55 shadow-xs'
            : 'bg-[#141822] hover:bg-[#191F2C] border-[#1F2636]'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {typeof rankNumber === 'number' && (
            <span
              className={`w-5 text-center text-xs font-extrabold tabular-nums shrink-0 ${
                isCurrent ? 'text-[#52A8FF]' : 'text-[#64748B]'
              }`}
            >
              {rankNumber}
            </span>
          )}

          <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[#1B2232] border border-white/10">
            <img
              src={track.coverUrl || BUILTIN_MUSIC_COVERS.aurora}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                isCurrent ? 'bg-[#0077FF]/60 opacity-100' : 'bg-black/35 opacity-0 group-hover:opacity-100'
              }`}
            >
              {isCurrent && isPlaying ? (
                <Pause className="w-4 h-4 text-white fill-current" />
              ) : (
                <Play className="w-4 h-4 text-white fill-current ml-0.5" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs sm:text-sm font-bold truncate ${
                  isCurrent ? 'text-[#52A8FF]' : 'text-white'
                }`}
              >
                {track.title}
              </span>
              {isCurrent && isPlaying && (
                <span className="inline-flex items-end gap-0.5 h-3 shrink-0" title="Воспроизведение">
                  <span className="w-0.5 h-3 bg-[#0077FF] animate-pulse rounded-full" />
                  <span className="w-0.5 h-2 bg-[#52A8FF] animate-pulse rounded-full" />
                  <span className="w-0.5 h-3 bg-[#0077FF] animate-pulse rounded-full" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#8E9BAE] truncate mt-0.5">
              <span className="truncate">{track.artist}</span>
              <span>·</span>
              <span className="text-[10px] text-[#64748B] shrink-0">
                {formatMusicDuration(track.duration)}
              </span>
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => void toggleFavoriteTrack(track)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isFav
                ? 'text-[#FF4D6D] bg-[#FF4D6D]/10'
                : 'text-[#8E9BAE] hover:text-white hover:bg-white/5'
            }`}
            title={isFav ? 'Убрать из избранного' : 'В избранное'}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setPlaylistModalTrack(track)}
            className="p-2 rounded-xl text-[#8E9BAE] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="В плейлист или очередь"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShareModalTrack(track)}
            className="hidden sm:inline-flex p-2 rounded-xl text-[#8E9BAE] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Поделиться"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {playlistIdForRemove && playlistIdForRemove !== 'mpl_mender_official' && (
            <button
              type="button"
              onClick={() => void toggleTrackInPlaylist(playlistIdForRemove, track.trackId)}
              className="p-2 rounded-xl text-[#8E9BAE] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Удалить из плейлиста"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {isMine && !playlistIdForRemove && (
            <button
              type="button"
              onClick={() => void deleteUploadedTrack(track)}
              className="p-2 rounded-xl text-[#8E9BAE] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Удалить мой трек"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col h-full overflow-hidden bg-[#0D1017] text-[#F1F5F9] select-none">
      {/* ЛЁГКАЯ И СОВРЕМЕННАЯ ШАПКА MENDER MUSIC */}
      <header className="px-3 sm:px-6 pt-3 pb-2.5 border-b border-[#1D2332] bg-[#11151E]/95 backdrop-blur-md shrink-0 z-20 space-y-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="px-2.5 py-1.5 rounded-xl bg-[#181E2B] hover:bg-[#20283A] border border-[#262F42] text-white flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              title={musicSubView !== 'home' ? 'Назад' : 'Вернуться в Меню'}
            >
              <ArrowLeft className="w-4 h-4 text-[#52A8FF]" />
              <span className="text-xs font-bold">Назад</span>
            </button>

            <div
              onClick={() => {
                setSearchQuery('');
                setMusicSubView('home');
              }}
              className="flex items-center gap-2 min-w-0 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0077FF] to-[#2563EB] flex items-center justify-center shrink-0 shadow-sm shadow-[#0077FF]/30">
                <Music className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  Mender Music
                </h1>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openUploadTrackStudio}
            className="px-3 py-1.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Загрузить</span>
          </button>
        </div>

        {/* Строка поиска */}
        <div className="max-w-5xl mx-auto relative flex items-center">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск музыки, исполнителей и альбомов..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-[#161B26] border border-[#232B3D] focus:border-[#0077FF] text-xs sm:text-sm text-white placeholder-[#64748B] outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 text-[#8E9BAE] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3 ОСНОВНЫХ РАЗДЕЛА: «Музыка», «Библиотека», «Плейлисты» */}
        <nav className="max-w-5xl mx-auto grid grid-cols-3 gap-1.5 bg-[#151A24] p-1 rounded-2xl border border-[#202737]">
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setMusicSubView('home');
            }}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !q && isSectionActive('music')
                ? 'bg-[#0077FF] text-white shadow-xs'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Music className="w-4 h-4 shrink-0" />
            <span>Музыка</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setMusicSubView('library');
            }}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !q && isSectionActive('library')
                ? 'bg-[#0077FF] text-white shadow-xs'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Library className="w-4 h-4 shrink-0" />
            <span>Библиотека</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setMusicSubView('playlists');
            }}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !q && isSectionActive('playlists')
                ? 'bg-[#0077FF] text-white shadow-xs'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <ListMusic className="w-4 h-4 shrink-0" />
            <span>Плейлисты</span>
          </button>
        </nav>
      </header>

      {/* ПРОКРУЧИВАЕМОЕ СОДЕРЖИМОЕ РАЗДЕЛА */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y p-3 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-6 pb-8">
          {/* РЕЗУЛЬТАТЫ ПОИСКА */}
          {q !== '' ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  Результаты по запросу «{searchQuery}»
                </h2>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-bold text-[#52A8FF] hover:underline cursor-pointer"
                >
                  Сбросить
                </button>
              </div>

              {filteredSearchTracks.length === 0 && filteredSearchAlbums.length === 0 ? (
                <div className="bg-[#141822] border border-[#202737] rounded-2xl p-8 text-center space-y-2">
                  <Music className="w-9 h-9 text-[#0077FF]/60 mx-auto" />
                  <div className="text-sm font-bold text-white">Ничего не найдено</div>
                  <p className="text-xs text-[#8E9BAE]">
                    Попробуйте другой запрос или загрузите собственный аудиофайл.
                  </p>
                </div>
              ) : (
                <>
                  {filteredSearchAlbums.length > 0 && (
                    <section className="space-y-2.5">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8E9BAE]">
                        Альбомы
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {filteredSearchAlbums.map(alb => (
                          <div
                            key={alb.albumId}
                            onClick={() => openAlbum(alb.albumId)}
                            className="bg-[#141822] hover:bg-[#1A202D] border border-[#202737] rounded-2xl p-3 cursor-pointer transition-colors"
                          >
                            <img
                              src={alb.coverUrl}
                              alt={alb.title}
                              className="w-full aspect-square rounded-xl object-cover mb-2.5"
                            />
                            <div className="text-xs font-bold text-white truncate">{alb.title}</div>
                            <div className="text-[11px] text-[#8E9BAE] truncate">{alb.artist}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {filteredSearchTracks.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8E9BAE]">
                        Треки ({filteredSearchTracks.length})
                      </h3>
                      {filteredSearchTracks.map((t, i) =>
                        renderTrackRow(t, filteredSearchTracks, i)
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {/* 1. ГЛАВНАЯ СТРАНИЦА «МУЗЫКА»: РЕКОМЕНДАЦИИ, НОВИНКИ, ПОПУЛЯРНОЕ И АЛЬБОМЫ */}
              {musicSubView === 'home' && (
                <div className="space-y-7">
                  {/* Главный баннер: Общий плейлист Mender */}
                  <section className="rounded-3xl overflow-hidden border border-[#233250] bg-gradient-to-br from-[#0F1F42] via-[#12254C] to-[#141822] p-4 sm:p-6 shadow-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                      <img
                        src={officialMenderPlaylist.coverUrl}
                        alt={officialMenderPlaylist.title}
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover border border-white/15 shadow-lg shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#66B2FF]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Подборка Mender</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#8E9BAE] font-medium tabular-nums">
                            {allTracks.length} трек.
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-2xl font-black text-white leading-tight">
                          {officialMenderPlaylist.title}
                        </h2>
                        <p className="text-xs text-[#B8C6DC] line-clamp-2 max-w-2xl">
                          {officialMenderPlaylist.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (currentTrack) {
                                if (isPlaying) {
                                  pauseMusic();
                                } else {
                                  void resumeMusic();
                                }
                              } else if (allTracks[0]) {
                                void playTrack(allTracks[0], allTracks);
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0077FF]/30 cursor-pointer transition-colors"
                          >
                            {currentTrack && isPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5 fill-current" />
                                <span>Пауза</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Слушать сейчас</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const rnd =
                                allTracks[Math.floor(Math.random() * allTracks.length)] ||
                                allTracks[0];
                              if (rnd) void playTrack(rnd, allTracks);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Shuffle className="w-3.5 h-3.5 text-[#52A8FF]" />
                            <span>Вперемешку</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Рекомендации (карточки с обложками) */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#0077FF]" />
                        <span>Рекомендации для вас</span>
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {recommendedTracks.map(trk => {
                        const active = currentTrack?.trackId === trk.trackId;
                        return (
                          <div
                            key={trk.trackId}
                            onClick={() => handleTrackPlayToggle(trk, recommendedTracks)}
                            className={`group rounded-2xl border p-3 cursor-pointer transition-all ${
                              active
                                ? 'bg-[#0077FF]/15 border-[#0077FF]/60'
                                : 'bg-[#141822] hover:bg-[#1A202D] border-[#1F2636]'
                            }`}
                          >
                            <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-[#1B2232]">
                              <img
                                src={trk.coverUrl || BUILTIN_MUSIC_COVERS.aurora}
                                alt={trk.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <button
                                type="button"
                                aria-label={active && isPlaying ? 'Пауза' : 'Включить'}
                                className={`absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all ${
                                  active
                                    ? 'bg-[#0077FF] text-white opacity-100'
                                    : 'bg-[#0077FF] text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100'
                                }`}
                              >
                                {active && isPlaying ? (
                                  <Pause className="w-4 h-4 fill-current" />
                                ) : (
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                )}
                              </button>
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-white truncate">
                              {trk.title}
                            </div>
                            <div className="text-[11px] text-[#8E9BAE] truncate mt-0.5">
                              {trk.artist} · {formatMusicDuration(trk.duration)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Новинки */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                        <Flame className="w-4 h-4 text-[#52A8FF]" />
                        <span>Новинки</span>
                      </h2>
                      <button
                        type="button"
                        onClick={openUploadTrackStudio}
                        className="text-xs font-bold text-[#52A8FF] hover:underline cursor-pointer"
                      >
                        + Добавить свой трек
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {newReleaseTracks.slice(0, 6).map((trk, idx) =>
                        renderTrackRow(trk, newReleaseTracks, idx)
                      )}
                    </div>
                  </section>

                  {/* Популярная музыка */}
                  <section className="space-y-3">
                    <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#0077FF]" />
                      <span>Популярная музыка</span>
                    </h2>
                    <div className="space-y-2">
                      {popularTracks.map((trk, idx) =>
                        renderTrackRow(trk, popularTracks, idx, idx + 1)
                      )}
                    </div>
                  </section>

                  {/* Альбомы и релизы */}
                  <section className="space-y-3">
                    <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                      <Disc className="w-4 h-4 text-[#0077FF]" />
                      <span>Альбомы ({albums.length})</span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {albums.map(alb => (
                        <div
                          key={alb.albumId}
                          onClick={() => openAlbum(alb.albumId)}
                          className="bg-[#141822] hover:bg-[#1A202D] border border-[#1F2636] rounded-2xl p-3 cursor-pointer transition-colors"
                        >
                          <img
                            src={alb.coverUrl}
                            alt={alb.title}
                            referrerPolicy="no-referrer"
                            className="w-full aspect-square rounded-xl object-cover mb-2.5"
                          />
                          <div className="text-xs sm:text-sm font-bold text-white truncate">
                            {alb.title}
                          </div>
                          <div className="text-[11px] text-[#8E9BAE] truncate">
                            {alb.artist} · {alb.trackIds.length} тр.
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* 2. РАЗДЕЛ «БИБЛИОТЕКА»: ИЗБРАННОЕ, НЕДАВНИЕ, МОИ ЗАГРУЗКИ, ЖАНРЫ */}
              {(musicSubView === 'library' ||
                musicSubView === 'favorites' ||
                musicSubView === 'history' ||
                musicSubView === 'my_uploads' ||
                musicSubView === 'genres' ||
                musicSubView === 'albums' ||
                musicSubView === 'artists') && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-white">Библиотека</h2>
                      <p className="text-xs text-[#8E9BAE]">
                        Сохранённые треки, история прослушивания и ваши загрузки
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openUploadTrackStudio}
                      className="px-3 py-1.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Загрузить аудио</span>
                    </button>
                  </div>

                  {/* Вкладки Библиотеки */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {(
                      [
                        {
                          id: 'favorites',
                          label: `Избранное (${favoriteTracks.length})`,
                          icon: Heart,
                        },
                        {
                          id: 'recent',
                          label: `Недавние (${recentlyPlayedTracks.length})`,
                          icon: Clock,
                        },
                        {
                          id: 'uploads',
                          label: `Мои загрузки (${myUploadedTracks.length})`,
                          icon: Headphones,
                        },
                        { id: 'genres', label: 'По жанрам', icon: Disc },
                      ] as const
                    ).map(tab => {
                      const Icon = tab.icon;
                      const activeTabState =
                        (musicSubView === 'favorites' && tab.id === 'favorites') ||
                        (musicSubView === 'history' && tab.id === 'recent') ||
                        (musicSubView === 'my_uploads' && tab.id === 'uploads') ||
                        (musicSubView === 'genres' && tab.id === 'genres') ||
                        (musicSubView === 'library' && libraryTab === tab.id);

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setMusicSubView('library');
                            setLibraryTab(tab.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                            activeTabState
                              ? 'bg-[#0077FF] text-white'
                              : 'bg-[#151A24] hover:bg-[#1B2130] text-[#94A3B8] border border-[#222A3A]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Избранные треки */}
                  {(musicSubView === 'favorites' ||
                    (musicSubView === 'library' && libraryTab === 'favorites')) && (
                    <div className="space-y-2.5">
                      {favoriteTracks.length === 0 ? (
                        <div className="bg-[#141822] border border-[#202737] rounded-2xl p-8 text-center space-y-2">
                          <Heart className="w-8 h-8 text-[#FF4D6D]/60 mx-auto" />
                          <div className="text-sm font-bold text-white">
                            В избранном пока нет треков
                          </div>
                          <p className="text-xs text-[#8E9BAE]">
                            Нажмите на сердечко рядом с композицией, чтобы сохранить её здесь.
                          </p>
                        </div>
                      ) : (
                        favoriteTracks.map((trk, idx) =>
                          renderTrackRow(trk, favoriteTracks, idx)
                        )
                      )}
                    </div>
                  )}

                  {/* Недавние */}
                  {(musicSubView === 'history' ||
                    (musicSubView === 'library' && libraryTab === 'recent')) && (
                    <div className="space-y-2.5">
                      {recentlyPlayedTracks.length > 0 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={clearListeningHistory}
                            className="text-xs text-[#94A3B8] hover:text-white cursor-pointer"
                          >
                            Очистить историю
                          </button>
                        </div>
                      )}
                      {recentlyPlayedTracks.length === 0 ? (
                        <div className="bg-[#141822] border border-[#202737] rounded-2xl p-8 text-center text-xs text-[#8E9BAE]">
                          История прослушивания пуста. Включите любой трек в разделе «Музыка».
                        </div>
                      ) : (
                        recentlyPlayedTracks.map((trk, idx) =>
                          renderTrackRow(trk, recentlyPlayedTracks, idx)
                        )
                      )}
                    </div>
                  )}

                  {/* Мои загрузки */}
                  {(musicSubView === 'my_uploads' ||
                    (musicSubView === 'library' && libraryTab === 'uploads')) && (
                    <div className="space-y-3">
                      {myUploadedTracks.length === 0 ? (
                        <div className="bg-[#141822] border border-[#202737] rounded-2xl p-8 text-center space-y-3">
                          <Headphones className="w-9 h-9 text-[#0077FF] mx-auto" />
                          <div className="text-sm font-bold text-white">
                            Вы ещё не загружали аудиофайлы
                          </div>
                          <button
                            type="button"
                            onClick={openUploadTrackStudio}
                            className="px-4 py-2 rounded-xl bg-[#0077FF] text-white text-xs font-bold cursor-pointer"
                          >
                            Загрузить трек
                          </button>
                        </div>
                      ) : (
                        myUploadedTracks.map((trk, idx) =>
                          renderTrackRow(trk, myUploadedTracks, idx)
                        )
                      )}
                    </div>
                  )}

                  {/* По жанрам */}
                  {(musicSubView === 'genres' ||
                    (musicSubView === 'library' && libraryTab === 'genres')) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        {['Все жанры', ...MUSIC_GENRES].map(genre => {
                          const active = selectedGenre === genre;
                          return (
                            <button
                              key={genre}
                              type="button"
                              onClick={() => setSelectedGenre(genre)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                                active
                                  ? 'bg-[#0077FF] text-white'
                                  : 'bg-[#141822] text-[#94A3B8] border border-[#202737]'
                              }`}
                            >
                              {genre}
                            </button>
                          );
                        })}
                      </div>
                      {genreTracks.length === 0 ? (
                        <div className="bg-[#141822] border border-[#202737] rounded-2xl p-6 text-center text-xs text-[#8E9BAE]">
                          В жанре «{selectedGenre}» пока нет треков.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {genreTracks.map((trk, idx) => renderTrackRow(trk, genreTracks, idx))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 3. РАЗДЕЛ «ПЛЕЙЛИСТЫ» */}
              {musicSubView === 'playlists' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-white">Плейлисты</h2>
                      <p className="text-xs text-[#8E9BAE]">
                        Подборки Mender и ваши собственные плейлисты
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaylistModalTrack(null);
                        setShowCreatePlaylistModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span>Создать плейлист</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {playlists.map(pl => (
                      <div
                        key={pl.playlistId}
                        onClick={() => openPlaylist(pl.playlistId)}
                        className="bg-[#141822] hover:bg-[#1A202D] border border-[#202737] rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={pl.coverUrl || BUILTIN_MUSIC_COVERS.aurora}
                            alt={pl.title}
                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{pl.title}</div>
                            <div className="text-xs text-[#8E9BAE] truncate mt-0.5">
                              Треков: {pl.trackIds.length} · @{pl.ownerUsername}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#8E9BAE] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* СТРАНИЦА ПЛЕЙЛИСТА */}
              {musicSubView === 'playlist_detail' && activePlaylist && (
                <div className="space-y-4">
                  <div className="bg-[#141822] border border-[#202737] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={activePlaylist.coverUrl || BUILTIN_MUSIC_COVERS.aurora}
                        alt={activePlaylist.title}
                        className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-white/10"
                      />
                      <div className="min-w-0 space-y-1.5">
                        <h2 className="text-base sm:text-xl font-black text-white truncate">
                          {activePlaylist.title}
                        </h2>
                        <div className="text-xs text-[#8E9BAE]">
                          Треков: {activePlaylist.trackIds.length}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const plTracks = allTracks.filter(t =>
                              activePlaylist.trackIds.includes(t.trackId)
                            );
                            if (plTracks[0]) void playTrack(plTracks[0], plTracks);
                          }}
                          disabled={activePlaylist.trackIds.length === 0}
                          className="px-4 py-1.5 rounded-xl bg-[#0077FF] disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Слушать</span>
                        </button>
                      </div>
                    </div>

                    {activePlaylist.ownerId === profile?.uid &&
                      activePlaylist.playlistId !== 'mpl_mender_official' && (
                        <button
                          type="button"
                          onClick={() => void deleteMusicPlaylist(activePlaylist.playlistId)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Удалить</span>
                        </button>
                      )}
                  </div>

                  {activePlaylist.trackIds.length === 0 ? (
                    <div className="bg-[#141822] border border-[#202737] rounded-2xl p-8 text-center text-xs text-[#8E9BAE]">
                      В этом плейлисте пока нет треков. Нажмите «+» рядом с любым треком, чтобы добавить его.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allTracks
                        .filter(t => activePlaylist.trackIds.includes(t.trackId))
                        .map((trk, idx, arr) =>
                          renderTrackRow(
                            trk,
                            arr,
                            idx,
                            undefined,
                            activePlaylist.ownerId === profile?.uid
                              ? activePlaylist.playlistId
                              : undefined
                          )
                        )}
                    </div>
                  )}
                </div>
              )}

              {/* СТРАНИЦА АЛЬБОМА */}
              {musicSubView === 'album_detail' && activeAlbum && (
                <div className="space-y-4">
                  <div className="bg-[#141822] border border-[#202737] rounded-2xl p-4 sm:p-5 flex items-center gap-4">
                    <img
                      src={activeAlbum.coverUrl}
                      alt={activeAlbum.title}
                      className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl object-cover shrink-0 border border-white/10"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="text-[10px] font-extrabold text-[#52A8FF] uppercase">
                        Альбом · {activeAlbum.releaseYear}
                      </div>
                      <h2 className="text-base sm:text-xl font-black text-white truncate">
                        {activeAlbum.title}
                      </h2>
                      <div className="text-xs text-[#94A3B8] truncate">{activeAlbum.artist}</div>
                      <button
                        type="button"
                        onClick={() => {
                          const albumTracks = allTracks.filter(t =>
                            activeAlbum.trackIds.includes(t.trackId)
                          );
                          if (albumTracks[0]) void playTrack(albumTracks[0], albumTracks);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-[#0077FF] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Слушать альбом</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {allTracks
                      .filter(t => activeAlbum.trackIds.includes(t.trackId))
                      .map((trk, idx, arr) => renderTrackRow(trk, arr, idx, idx + 1))}
                  </div>
                </div>
              )}

              {/* СТРАНИЦА ИСПОЛНИТЕЛЯ */}
              {musicSubView === 'artist_detail' && activeArtist && (
                <div className="space-y-4">
                  <div className="bg-[#141822] border border-[#202737] rounded-2xl p-4 sm:p-5 flex items-center gap-4">
                    <img
                      src={activeArtist.avatarUrl}
                      alt={activeArtist.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#0077FF] shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-1.5">
                        <span>{activeArtist.name}</span>
                        <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                      </h2>
                      <p className="text-xs text-[#94A3B8] line-clamp-2">{activeArtist.bio}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {allTracks
                      .filter(
                        t =>
                          t.artistId === activeArtist.artistId || t.artist === activeArtist.name
                      )
                      .map((trk, idx, arr) => renderTrackRow(trk, arr, idx))}
                  </div>
                </div>
              )}

              {/* ЗАГРУЗКА СВОЕГО АУДИОФАЙЛА */}
              {musicSubView === 'upload' && (
                <div className="bg-[#141822] border border-[#202737] rounded-2xl p-4 sm:p-6 space-y-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-[#0077FF]" />
                      <span>Загрузить музыку в Mender</span>
                    </h2>
                    <p className="text-xs text-[#8E9BAE] mt-0.5">
                      Поддерживаются MP3, WAV, FLAC, OGG, M4A (до 50 МБ)
                    </p>
                  </div>

                  {uploadError && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
                      {uploadError}
                    </div>
                  )}

                  {uploadSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between">
                      <span>{uploadSuccess}</span>
                      <button
                        type="button"
                        onClick={() => setMusicSubView('home')}
                        className="underline font-bold cursor-pointer"
                      >
                        На главную →
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleUploadSubmit} className="space-y-3.5">
                    <div
                      onClick={() => audioInputRef.current?.click()}
                      className="border-2 border-dashed border-[#2B354D] hover:border-[#0077FF] rounded-2xl p-5 text-center cursor-pointer bg-[#0F131C] transition-colors"
                    >
                      <Music className="w-7 h-7 text-[#0077FF] mx-auto mb-1.5" />
                      {uploadAudioFile ? (
                        <div>
                          <div className="text-xs font-bold text-white truncate">
                            {uploadAudioFile.name}
                          </div>
                          <div className="text-[11px] text-[#52A8FF]">
                            {(uploadAudioFile.size / (1024 * 1024)).toFixed(2)} МБ ·{' '}
                            {formatMusicDuration(uploadDuration)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-white">
                          Выбрать аудиофайл с устройства
                        </div>
                      )}
                    </div>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
                      onChange={handleSelectAudioFile}
                      className="hidden"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Название трека *
                        </label>
                        <input
                          type="text"
                          value={uploadTitle}
                          onChange={e => setUploadTitle(e.target.value)}
                          placeholder="Название композиции"
                          maxLength={140}
                          className="w-full px-3 py-2 rounded-xl bg-[#0E121A] border border-[#252D40] text-xs text-white outline-none focus:border-[#0077FF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Исполнитель
                        </label>
                        <input
                          type="text"
                          value={uploadArtist}
                          onChange={e => setUploadArtist(e.target.value)}
                          placeholder={profile?.displayName || 'Имя артиста'}
                          maxLength={100}
                          className="w-full px-3 py-2 rounded-xl bg-[#0E121A] border border-[#252D40] text-xs text-white outline-none focus:border-[#0077FF]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Альбом
                        </label>
                        <input
                          type="text"
                          value={uploadAlbum}
                          onChange={e => setUploadAlbum(e.target.value)}
                          placeholder="Сингл или альбом"
                          maxLength={100}
                          className="w-full px-3 py-2 rounded-xl bg-[#0E121A] border border-[#252D40] text-xs text-white outline-none focus:border-[#0077FF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Жанр
                        </label>
                        <select
                          value={uploadGenre}
                          onChange={e => setUploadGenre(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#0E121A] border border-[#252D40] text-xs text-white outline-none focus:border-[#0077FF]"
                        >
                          {MUSIC_GENRES.map(g => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Обложка (необязательно)
                        </label>
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          className="w-full py-2 px-3 rounded-xl bg-[#1A2132] hover:bg-[#222B42] text-xs font-bold text-white cursor-pointer truncate"
                        >
                          {uploadCoverFile ? uploadCoverFile.name : 'Выбрать обложку'}
                        </button>
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleSelectCoverFile}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#B0C0D8]">
                      <input
                        type="checkbox"
                        checked={rightsConfirmed}
                        onChange={e => setRightsConfirmed(e.target.checked)}
                        className="mt-0.5 accent-[#0077FF]"
                      />
                      <span>Подтверждаю наличие прав на публикацию этого аудиофайла.</span>
                    </label>

                    {isUploading && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-[#52A8FF] font-bold">
                          <span>Загрузка...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1E2536] overflow-hidden">
                          <div
                            className="h-full bg-[#0077FF]"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isUploading}
                      className="w-full py-2.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
                    >
                      {isUploading ? 'Сохранение...' : 'Опубликовать трек'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* МОДАЛКА: ДОБАВИТЬ В ПЛЕЙЛИСТ */}
      {playlistModalTrack && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPlaylistModalTrack(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#151A26] border border-[#283147] rounded-2xl w-full max-w-md p-4 space-y-3.5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Добавить в плейлист</h3>
              <button
                type="button"
                onClick={() => setPlaylistModalTrack(null)}
                className="p-1 text-[#8E9BAE] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  addToQueue(playlistModalTrack);
                  setPlaylistModalTrack(null);
                }}
                className="w-full p-2.5 rounded-xl bg-[#1D2436] hover:bg-[#252E44] flex items-center justify-between text-xs font-bold cursor-pointer"
              >
                <span>В очередь воспроизведения</span>
                <Plus className="w-4 h-4 text-[#52A8FF]" />
              </button>

              {myPlaylists.map(pl => {
                const inPl = pl.trackIds.includes(playlistModalTrack.trackId);
                return (
                  <button
                    key={pl.playlistId}
                    type="button"
                    onClick={() =>
                      void toggleTrackInPlaylist(pl.playlistId, playlistModalTrack.trackId)
                    }
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold cursor-pointer ${
                      inPl
                        ? 'bg-[#0077FF]/20 border-[#0077FF] text-white'
                        : 'bg-[#1A2030] border-[#262F45] text-[#CBD5E1]'
                    }`}
                  >
                    <span className="truncate">{pl.title}</span>
                    <span className="text-[#52A8FF] shrink-0">
                      {inPl ? 'В плейлисте ✓' : '+ Добавить'}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowCreatePlaylistModal(true)}
              className="w-full py-2.5 rounded-xl bg-[#0077FF] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Создать свой плейлист</span>
            </button>
          </div>
        </div>
      )}

      {/* МОДАЛКА: СОЗДАТЬ ПЛЕЙЛИСТ */}
      {showCreatePlaylistModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCreatePlaylistModal(false)}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleCreatePlaylistSubmit}
            className="bg-[#151A26] border border-[#283147] rounded-2xl w-full max-w-md p-4 space-y-3.5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Новый плейлист</h3>
              <button
                type="button"
                onClick={() => setShowCreatePlaylistModal(false)}
                className="p-1 text-[#8E9BAE] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              required
              value={newPlaylistTitle}
              onChange={e => setNewPlaylistTitle(e.target.value)}
              placeholder="Название плейлиста"
              maxLength={120}
              className="w-full px-3 py-2 rounded-xl bg-[#0E121B] border border-[#283147] text-xs text-white outline-none"
            />

            <textarea
              rows={2}
              value={newPlaylistDesc}
              onChange={e => setNewPlaylistDesc(e.target.value)}
              placeholder="Описание (необязательно)"
              maxLength={1000}
              className="w-full px-3 py-2 rounded-xl bg-[#0E121B] border border-[#283147] text-xs text-white outline-none resize-none"
            />

            <button
              type="submit"
              disabled={creatingPlaylist}
              className="w-full py-2.5 rounded-xl bg-[#0077FF] text-white text-xs font-extrabold cursor-pointer"
            >
              {creatingPlaylist ? 'Создание...' : 'Создать'}
            </button>
          </form>
        </div>
      )}

      {/* МОДАЛКА: ПОДЕЛИТЬСЯ ТРЕКОМ */}
      {shareModalTrack && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShareModalTrack(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#151A26] border border-[#283147] rounded-2xl w-full max-w-md p-4 space-y-3.5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Поделиться треком</h3>
              <button
                type="button"
                onClick={() => setShareModalTrack(null)}
                className="p-1 text-[#8E9BAE] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleCopyTrackShare(shareModalTrack)}
              className="w-full py-2 px-3 rounded-xl bg-[#1E2638] text-xs font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Скопировать ссылку</span>
              {copiedTrackLink ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Скопировано
                </span>
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#52A8FF]" />
              )}
            </button>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-[#94A3B8]">Отправить в чат Mender:</div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {chats.map(c => (
                  <button
                    key={c.chatId}
                    type="button"
                    onClick={() => void handleShareTrackToChat(c.chatId, shareModalTrack)}
                    className="w-full p-2 rounded-xl bg-[#1B2132] hover:bg-[#232B40] flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <span className="text-xs font-bold truncate">{c.name}</span>
                    {sharedToChatId === c.chatId ? (
                      <span className="text-[11px] text-emerald-400">Отправлено ✓</span>
                    ) : (
                      <Send className="w-3.5 h-3.5 text-[#52A8FF] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
