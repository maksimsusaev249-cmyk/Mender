import React, { useState } from 'react';
import { useMusic } from '../../context/MusicContext';
import { useChat } from '../../context/ChatContext';
import { BUILTIN_MUSIC_COVERS, formatMusicDuration } from '../../utils/musicAudioGenerator';
import { MenderMusicTrack, VisibilityType } from '../../types';
import {
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  Plus,
  ListMusic,
  Share2,
  Maximize2,
  ChevronDown,
  X,
  ArrowLeft,
  FolderPlus,
  Send,
  Copy,
  Check,
  Music,
} from 'lucide-react';

// Чёткие контурные иконки управления плеером по эскизу: |◁  ||  ▷  □  ▷|
const TransportPrevIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <line x1="6" y1="5" x2="6" y2="19" />
    <polygon points="18,6 8,12 18,18" />
  </svg>
);

const TransportPauseIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    aria-hidden="true"
    className={className}
  >
    <line x1="9" y1="5" x2="9" y2="19" />
    <line x1="15" y1="5" x2="15" y2="19" />
  </svg>
);

const TransportPlayIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <polygon points="7,5 19,12 7,19" />
  </svg>
);

const TransportStopIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <rect x="6" y="6" width="12" height="12" rx="1.2" />
  </svg>
);

const TransportNextIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <polygon points="6,6 16,12 6,18" />
    <line x1="18" y1="5" x2="18" y2="19" />
  </svg>
);

export const GlobalMusicPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    queue,
    isFullScreenPlayerOpen,
    setIsFullScreenPlayerOpen,
    pauseMusic,
    resumeMusic,
    playTrack,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    addToQueue,
    removeFromQueue,
    closePlayer,
    favoriteTrackIds,
    toggleFavoriteTrack,
    myPlaylists,
    createMusicPlaylist,
    toggleTrackInPlaylist,
    openArtist,
  } = useMusic();

  const { chats, setActiveChatId, setActiveTab, sendMessage } = useChat();

  const [fullScreenTab, setFullScreenTab] = useState<'player' | 'queue'>('player');
  const [playlistModalTrack, setPlaylistModalTrack] = useState<MenderMusicTrack | null>(null);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistVisibility] = useState<VisibilityType>('public');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const [shareModalTrack, setShareModalTrack] = useState<MenderMusicTrack | null>(null);
  const [copiedTrackLink, setCopiedTrackLink] = useState(false);
  const [sharedToChatId, setSharedToChatId] = useState<string | null>(null);

  if (!currentTrack) {
    return null;
  }

  const totalDuration = Math.max(1, duration || currentTrack.duration || 1);
  const clampedTime = Math.min(currentTime, totalDuration);

  const handleCreatePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) return;
    setCreatingPlaylist(true);
    try {
      await createMusicPlaylist({
        title: newPlaylistTitle,
        description: newPlaylistDesc,
        visibility: newPlaylistVisibility,
        coverUrl: playlistModalTrack?.coverUrl || BUILTIN_MUSIC_COVERS.aurora,
        initialTrackId: playlistModalTrack?.trackId,
      });
      setNewPlaylistTitle('');
      setNewPlaylistDesc('');
      setShowCreatePlaylistModal(false);
      setPlaylistModalTrack(null);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleCopyTrackShare = (track: MenderMusicTrack) => {
    const shareUrl = `${window.location.origin}/?music=${encodeURIComponent(track.trackId)}`;
    navigator.clipboard?.writeText(
      `🎵 ${track.artist} — ${track.title} в Mender Music: ${shareUrl}`
    );
    setCopiedTrackLink(true);
    setTimeout(() => setCopiedTrackLink(false), 2000);
  };

  const handleShareTrackToChat = async (chatId: string, track: MenderMusicTrack) => {
    setActiveChatId(chatId);
    const shareText = `🎵 Mender Music: ${track.artist} — «${track.title}» (${track.albumTitle}, ${track.genre} · ${formatMusicDuration(track.duration)})`;
    await sendMessage({ content: shareText, type: 'text' });
    setSharedToChatId(chatId);
    setTimeout(() => {
      setSharedToChatId(null);
      setShareModalTrack(null);
      setIsFullScreenPlayerOpen(false);
      setActiveTab('chats');
    }, 550);
  };

  return (
    <>
      {/* 1. КОМПАКТНЫЙ ПОСТОЯННЫЙ МИНИ-ПЛЕЕР (ДОСТУПЕН ВО ВСЕХ РАЗДЕЛАХ MENDER) */}
      {!isFullScreenPlayerOpen && (
        <section
          aria-label="Мини-плеер Mender Music"
          className="w-full shrink-0 z-30 bg-[#121621] border-t border-[#222B3E] text-[#F1F5F9] shadow-[0_-6px_24px_rgba(0,0,0,0.45)] select-none"
        >
          {/* Тонкая визуальная полоса прогресса для мобильной версии */}
          <div className="sm:hidden w-full h-[2px] bg-[#242D42] overflow-hidden">
            <div
              className="h-full bg-[#0077FF] transition-all duration-200"
              style={{ width: `${Math.min(100, (clampedTime / totalDuration) * 100)}%` }}
            />
          </div>

          {/* Мобильный однострочный мини-плеер (< sm) */}
          <div className="sm:hidden px-3 py-1.5 flex items-center justify-between gap-2">
            <div
              onClick={() => setIsFullScreenPlayerOpen(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
              title="Открыть полноэкранный плеер"
            >
              <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-[#0077FF]/40 bg-[#1B2233]">
                <img
                  src={currentTrack.coverUrl || BUILTIN_MUSIC_COVERS.aurora}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  onError={e => {
                    e.currentTarget.src = BUILTIN_MUSIC_COVERS.aurora;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-white truncate">
                  {currentTrack.title}
                </div>
                <div className="text-[11px] text-[#8E9BAE] truncate">
                  {currentTrack.artist} ·{' '}
                  <span className={isPlaying ? 'text-[#52A8FF]' : 'text-amber-400'}>
                    {isPlaying ? 'В фоне' : 'Пауза'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => (isPlaying ? pauseMusic() : void resumeMusic())}
                className="w-10 h-10 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white flex items-center justify-center active:scale-95 cursor-pointer transition-all"
                title={isPlaying ? 'Пауза' : 'Продолжить'}
                aria-label={isPlaying ? 'Пауза' : 'Продолжить'}
              >
                {isPlaying ? (
                  <TransportPauseIcon className="w-4 h-4" />
                ) : (
                  <TransportPlayIcon className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void nextTrack()}
                className="w-10 h-10 rounded-xl bg-[#181D2B] hover:bg-[#232B3E] text-[#CBD5E1] hover:text-white flex items-center justify-center active:scale-95 cursor-pointer transition-all"
                title="Следующий трек"
                aria-label="Следующий трек"
              >
                <TransportNextIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={closePlayer}
                className="w-10 h-10 rounded-xl hover:bg-rose-500/20 text-[#8E9BAE] hover:text-rose-300 flex items-center justify-center active:scale-95 cursor-pointer transition-all"
                title="Закрыть плеер"
                aria-label="Закрыть плеер"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Полоса перемотки сверху мини-плеера (>= sm) */}
          <div className="hidden sm:flex w-full px-4 pt-1.5 items-center gap-2">
            <span className="text-[10px] font-mono text-[#8E9BAE] tabular-nums w-8 text-right shrink-0">
              {formatMusicDuration(clampedTime)}
            </span>
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.2}
              value={clampedTime}
              onChange={e => seekTo(Number(e.target.value))}
              aria-label="Перемотка трека"
              className="flex-1 h-1 accent-[#0077FF] bg-[#242D42] rounded-full cursor-pointer"
            />
            <span className="text-[10px] font-mono text-[#8E9BAE] tabular-nums w-8 shrink-0">
              {formatMusicDuration(totalDuration)}
            </span>
          </div>

          {/* Полная панель мини-плеера (>= sm) */}
          <div className="hidden sm:flex px-4 py-2 flex-nowrap items-center justify-between gap-2">
            {/* Обложка, название и исполнитель (открывает полноэкранный плеер) */}
            <div
              onClick={() => setIsFullScreenPlayerOpen(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
              title="Открыть полноэкранный плеер"
            >
              <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-[#0077FF]/40 bg-[#1B2233]">
                <img
                  src={currentTrack.coverUrl || BUILTIN_MUSIC_COVERS.aurora}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  onError={e => {
                    e.currentTarget.src = BUILTIN_MUSIC_COVERS.aurora;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white group-hover:text-[#52A8FF] transition-colors truncate">
                    {currentTrack.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#8E9BAE] truncate">
                  <span className="truncate">{currentTrack.artist}</span>
                  <span>·</span>
                  <span
                    className={`font-semibold shrink-0 ${
                      isPlaying ? 'text-[#52A8FF]' : 'text-amber-400'
                    }`}
                  >
                    {isPlaying ? 'Играет в фоне' : 'На паузе'}
                  </span>
                </div>
              </div>
            </div>

            {/* Элементы управления: |◁  ||  ▷  □  ▷| + Громкость и Полноэкранный режим */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              <div
                className="flex items-center gap-1 bg-[#181D2B] border border-[#252E42] rounded-xl p-1"
                role="group"
                aria-label="Управление воспроизведением"
              >
                <button
                  type="button"
                  onClick={() => void prevTrack()}
                  className="w-10 h-9 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-white hover:bg-[#232B3E] active:scale-95 cursor-pointer transition-all"
                  title="Предыдущий трек"
                  aria-label="Предыдущий трек"
                >
                  <TransportPrevIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={pauseMusic}
                  disabled={!isPlaying}
                  className={`w-10 h-9 rounded-lg flex items-center justify-center active:scale-95 transition-all ${
                    isPlaying
                      ? 'bg-[#252E44] hover:bg-[#2E3954] text-white cursor-pointer'
                      : 'text-[#64748B] opacity-55 cursor-default'
                  }`}
                  title="Пауза"
                  aria-label="Пауза"
                >
                  <TransportPauseIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => void resumeMusic()}
                  disabled={isPlaying}
                  className={`w-10 h-9 rounded-lg flex items-center justify-center active:scale-95 transition-all ${
                    !isPlaying
                      ? 'bg-[#0077FF] hover:bg-[#0066EA] text-white shadow-sm shadow-[#0077FF]/35 cursor-pointer'
                      : 'text-[#52A8FF] bg-[#0077FF]/15 cursor-default'
                  }`}
                  title="Продолжить воспроизведение"
                  aria-label="Продолжить воспроизведение"
                >
                  <TransportPlayIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={closePlayer}
                  className="w-10 h-9 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-rose-300 hover:bg-rose-500/20 active:scale-95 cursor-pointer transition-all"
                  title="Остановить музыку и закрыть плеер"
                  aria-label="Остановить музыку и закрыть плеер"
                >
                  <TransportStopIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => void nextTrack()}
                  className="w-10 h-9 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-white hover:bg-[#232B3E] active:scale-95 cursor-pointer transition-all"
                  title="Следующий трек"
                  aria-label="Следующий трек"
                >
                  <TransportNextIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="hidden lg:flex items-center gap-1.5 px-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-[#8E9BAE] hover:text-white cursor-pointer"
                  title={isMuted ? 'Включить звук' : 'Выключить звук'}
                  aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={isMuted ? 0 : volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  aria-label="Громкость"
                  className="w-16 h-1 accent-[#0077FF] bg-[#252E42] rounded-full cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsFullScreenPlayerOpen(true)}
                className="w-9 h-9 rounded-xl bg-[#181D2B] hover:bg-[#232B3E] border border-[#252E42] text-[#93C5FD] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
                title="Полноэкранный плеер"
                aria-label="Полноэкранный плеер"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 2. ПОЛНОЭКРАННЫЙ ПЛЕЕР (С ОБЛОЖКОЙ, НАЗВАНИЕМ, ИСПОЛНИТЕЛЕМ, ПЕРЕМОТКОЙ, ГРОМКОСТЬЮ И ОЧЕРЕДЬЮ) */}
      {isFullScreenPlayerOpen && (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#131926] via-[#0D1017] to-[#080A0F] text-white flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden select-none">
          {/* Верхняя панель */}
          <div className="px-3 sm:px-6 py-3 flex items-center justify-between border-b border-white/10 bg-[#10141F]/90 backdrop-blur-md shrink-0">
            <button
              type="button"
              onClick={() => {
                if (fullScreenTab === 'queue') {
                  setFullScreenTab('player');
                } else {
                  setIsFullScreenPlayerOpen(false);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-[#1A2234] hover:bg-[#232D45] border border-[#2B3752] text-xs font-bold flex items-center gap-1.5 cursor-pointer text-white"
            >
              {fullScreenTab === 'queue' ? (
                <>
                  <ArrowLeft className="w-4 h-4 text-[#52A8FF]" />
                  <span>К плееру</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-[#52A8FF]" />
                  <span>Свернуть</span>
                </>
              )}
            </button>

            <div className="text-center min-w-0 px-2">
              <div className="text-[10px] font-extrabold text-[#52A8FF] uppercase tracking-wider">
                {isPlaying ? 'Mender Music · Фоновый режим' : 'Mender Music · Пауза'}
              </div>
              <div className="text-[11px] text-[#94A3B8] truncate">{currentTrack.albumTitle}</div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setFullScreenTab(prev => (prev === 'player' ? 'queue' : 'player'))
                }
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  fullScreenTab === 'queue'
                    ? 'bg-[#0077FF] text-white'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Очередь ({queue.length})</span>
              </button>

              <button
                type="button"
                onClick={closePlayer}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Остановить музыку и закрыть плеер"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Остановить</span>
              </button>
            </div>
          </div>

          {/* Прокручиваемая основная область */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-6 pb-16">
            {fullScreenTab === 'player' ? (
              <div className="w-full max-w-md mx-auto space-y-6 text-center">
                {/* Большая обложка */}
                <div className="mx-auto w-56 h-56 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,119,255,0.22)] border border-white/15 bg-[#161B26]">
                  <img
                    src={currentTrack.coverUrl || BUILTIN_MUSIC_COVERS.aurora}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Название, исполнитель и жанр */}
                <div className="space-y-1.5 px-2">
                  <h2 className="text-lg sm:text-2xl font-black text-white leading-tight truncate">
                    {currentTrack.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFullScreenPlayerOpen(false);
                      setActiveTab('music');
                      openArtist(currentTrack.artistId);
                    }}
                    className="text-sm sm:text-base text-[#52A8FF] hover:underline font-bold truncate cursor-pointer"
                  >
                    {currentTrack.artist}
                  </button>
                  <div className="text-[11px] text-[#8E9BAE]">
                    {currentTrack.genre} · {currentTrack.releaseYear || 2026}
                  </div>
                </div>

                {/* Полоса перемотки */}
                <div className="space-y-1.5 px-1">
                  <input
                    type="range"
                    min={0}
                    max={totalDuration}
                    step={0.1}
                    value={clampedTime}
                    onChange={e => seekTo(Number(e.target.value))}
                    className="w-full h-1.5 accent-[#0077FF] bg-white/15 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-[#94A3B8]">
                    <span>{formatMusicDuration(clampedTime)}</span>
                    <span>{formatMusicDuration(totalDuration)}</span>
                  </div>
                </div>

                {/* Основные кнопки управления по эскизу: |◁  ||  ▷  □  ▷| */}
                <div className="space-y-3">
                  <div
                    className="inline-flex items-center justify-center gap-1.5 sm:gap-2.5 bg-[#161B28] border border-white/10 rounded-2xl p-2 shadow-xl"
                    role="group"
                    aria-label="Управление воспроизведением"
                  >
                    <button
                      type="button"
                      onClick={() => void prevTrack()}
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-[#E2E8F0] hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer transition-all"
                      title="Предыдущий трек"
                      aria-label="Предыдущий трек"
                    >
                      <TransportPrevIcon className="w-6 h-6" />
                    </button>

                    <button
                      type="button"
                      onClick={pauseMusic}
                      disabled={!isPlaying}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all ${
                        isPlaying
                          ? 'bg-white/15 hover:bg-white/25 text-white cursor-pointer'
                          : 'text-[#64748B] opacity-55 cursor-default'
                      }`}
                      title="Пауза"
                      aria-label="Пауза"
                    >
                      <TransportPauseIcon className="w-6 h-6" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void resumeMusic()}
                      disabled={isPlaying}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all ${
                        !isPlaying
                          ? 'bg-[#0077FF] hover:bg-[#0066EA] text-white shadow-lg shadow-[#0077FF]/40 cursor-pointer'
                          : 'bg-[#0077FF]/20 text-[#52A8FF] cursor-default'
                      }`}
                      title="Продолжить воспроизведение"
                      aria-label="Продолжить воспроизведение"
                    >
                      <TransportPlayIcon className="w-6 h-6" />
                    </button>

                    <button
                      type="button"
                      onClick={closePlayer}
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-[#E2E8F0] hover:text-rose-300 hover:bg-rose-500/20 active:scale-95 cursor-pointer transition-all"
                      title="Остановить музыку и закрыть плеер"
                      aria-label="Остановить музыку и закрыть плеер"
                    >
                      <TransportStopIcon className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void nextTrack()}
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-[#E2E8F0] hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer transition-all"
                      title="Следующий трек"
                      aria-label="Следующий трек"
                    >
                      <TransportNextIcon className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Режимы перемешивания и повтора */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={toggleShuffle}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isShuffle ? 'bg-[#0077FF]/25 text-[#52A8FF]' : 'bg-white/5 text-[#94A3B8] hover:text-white'
                      }`}
                      title="Перемешать"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Перемешать</span>
                    </button>

                    <button
                      type="button"
                      onClick={cycleRepeatMode}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        repeatMode !== 'off'
                          ? 'bg-[#0077FF]/25 text-[#52A8FF]'
                          : 'bg-white/5 text-[#94A3B8] hover:text-white'
                      }`}
                      title="Повтор"
                    >
                      {repeatMode === 'one' ? (
                        <Repeat1 className="w-3.5 h-3.5" />
                      ) : (
                        <Repeat className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {repeatMode === 'one' ? 'Повтор трека' : repeatMode === 'all' ? 'Повтор всех' : 'Повтор выкл.'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Регулировка громкости */}
                <div className="flex items-center justify-center gap-3 px-4">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-[#94A3B8] hover:text-white cursor-pointer"
                    title={isMuted ? 'Включить звук' : 'Выключить звук'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={isMuted ? 0 : volume}
                    onChange={e => setVolume(Number(e.target.value))}
                    className="w-full max-w-[220px] h-1.5 accent-[#0077FF] bg-white/20 rounded-lg cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-[#8E9BAE] w-8 text-left">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>

                {/* Действия с треком */}
                <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => void toggleFavoriteTrack(currentTrack)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      favoriteTrackIds[currentTrack.trackId]
                        ? 'bg-[#FF4D6D]/20 text-[#FF4D6D] border border-[#FF4D6D]/40'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        favoriteTrackIds[currentTrack.trackId] ? 'fill-current' : ''
                      }`}
                    />
                    <span>Избранное</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlaylistModalTrack(currentTrack)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>В плейлист</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShareModalTrack(currentTrack)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Поделиться</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsFullScreenPlayerOpen(false);
                      setActiveTab('music');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#0077FF]/20 hover:bg-[#0077FF]/30 border border-[#0077FF]/40 text-[#66B2FF] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>В Mender Music</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Очередь воспроизведения */
              <div className="w-full max-w-lg mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-white">
                    Очередь воспроизведения ({queue.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setFullScreenTab('player')}
                    className="text-xs font-bold text-[#52A8FF] hover:underline cursor-pointer"
                  >
                    Вернуться к обложке
                  </button>
                </div>
                <div className="space-y-1.5">
                  {queue.map((trk, idx) => {
                    const active = currentTrack.trackId === trk.trackId;
                    return (
                      <div
                        key={`${trk.trackId}_${idx}`}
                        onClick={() => void playTrack(trk)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#0077FF]/25 border-[#0077FF]'
                            : 'bg-white/5 hover:bg-white/10 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={trk.coverUrl || BUILTIN_MUSIC_COVERS.aurora}
                            alt={trk.title}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {trk.title}
                            </div>
                            <div className="text-[11px] text-[#94A3B8] truncate">
                              {trk.artist} · {formatMusicDuration(trk.duration)}
                            </div>
                          </div>
                        </div>
                        {!active && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              removeFromQueue(trk.trackId);
                            }}
                            className="p-1.5 text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                            title="Убрать из очереди"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
              className="w-full py-2.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
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
    </>
  );
};
