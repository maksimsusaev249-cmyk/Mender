import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  PictureInPicture2,
  Download,
  Check,
  Loader2,
  Gauge,
  AlertCircle,
} from 'lucide-react';
import { formatVideoDuration } from './VideoCard';
import {
  isVideoSavedOffline,
  saveVideoForOffline,
  removeVideoFromOffline,
} from '../../utils/media';

interface UniversalVideoPlayerProps {
  videoId: string;
  src: string;
  rawVideoUrl?: string;
  poster?: string;
  mimeType?: string;
  durationHint?: number;
  autoPlay?: boolean;
  title?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const UniversalVideoPlayer: React.FC<UniversalVideoPlayerProps> = ({
  videoId,
  src,
  rawVideoUrl,
  poster,
  mimeType = 'video/mp4',
  durationHint = 0,
  autoPlay = true,
  title,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' | 'center' }>({
    time: 0,
    side: 'center',
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [bufferedPct, setBufferedPct] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [autoMutedByBrowser, setAutoMutedByBrowser] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seekRipple, setSeekRipple] = useState<'left' | 'right' | null>(null);

  // Offline caching state
  const [savedOffline, setSavedOffline] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState(0);

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    setShowControls(true);
    hideControlsTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 3200);
  }, []);

  useEffect(() => {
    let active = true;
    isVideoSavedOffline(videoId, rawVideoUrl || src).then(saved => {
      if (active) setSavedOffline(saved);
    });
    return () => {
      active = false;
    };
  }, [videoId, rawVideoUrl, src]);

  // Apply webkit-playsinline & x5 attributes imperatively for iOS Safari & Android WebViews
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.setAttribute('playsinline', 'true');
    vid.setAttribute('webkit-playsinline', 'true');
    vid.setAttribute('x5-playsinline', 'true');
    vid.setAttribute('x5-video-player-type', 'h5');
  }, [src]);

  // Smart cross-device autoplay (tries with sound first; falls back to muted autoplay on iOS/Android)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !src) return;

    setHasError(false);
    setIsBuffering(true);
    setCurrentTime(0);
    if (durationHint > 0) setDuration(durationHint);

    vid.load();

    if (!autoPlay) {
      setIsBuffering(false);
      return;
    }

    let cancelled = false;
    const startPlayback = async () => {
      try {
        vid.muted = false;
        await vid.play();
        if (!cancelled) {
          setIsPlaying(true);
          setIsMuted(false);
          setAutoMutedByBrowser(false);
          scheduleHideControls();
        }
      } catch {
        // Mobile browsers (iOS Safari / Android Chrome) block unmuted autoplay -> fallback to muted autoplay
        try {
          vid.muted = true;
          await vid.play();
          if (!cancelled) {
            setIsPlaying(true);
            setIsMuted(true);
            setAutoMutedByBrowser(true);
            scheduleHideControls();
          }
        } catch {
          if (!cancelled) {
            setIsPlaying(false);
            setIsBuffering(false);
            setShowControls(true);
          }
        }
      }
    };

    void startPlayback();

    return () => {
      cancelled = true;
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [src, videoId, autoPlay, durationHint, scheduleHideControls]);

  // Listen to native fullscreen changes
  useEffect(() => {
    const onFullscreenChange = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  const togglePlayPause = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused || vid.ended) {
      vid.play()
        .then(() => {
          setIsPlaying(true);
          scheduleHideControls();
        })
        .catch(() => {
          vid.muted = true;
          setIsMuted(true);
          setAutoMutedByBrowser(true);
          vid.play().catch(() => {});
        });
    } else {
      vid.pause();
      setIsPlaying(false);
      setShowControls(true);
    }
  }, [scheduleHideControls]);

  const seekBy = useCallback(
    (deltaSec: number) => {
      const vid = videoRef.current;
      if (!vid) return;
      const maxDur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : duration;
      const nextTime = Math.max(0, Math.min(maxDur || 86400, vid.currentTime + deltaSec));
      vid.currentTime = nextTime;
      setCurrentTime(nextTime);
      scheduleHideControls();
    },
    [duration, scheduleHideControls]
  );

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    const nextVal = Number(e.target.value);
    setCurrentTime(nextVal);
    if (vid && Number.isFinite(nextVal)) {
      vid.currentTime = nextVal;
    }
    scheduleHideControls();
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const nextMuted = !isMuted;
    vid.muted = nextMuted;
    if (!nextMuted && vid.volume === 0) {
      vid.volume = 1;
      setVolume(1);
    }
    setIsMuted(nextMuted);
    setAutoMutedByBrowser(false);
    scheduleHideControls();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    const val = Number(e.target.value);
    setVolume(val);
    if (vid) {
      vid.volume = val;
      vid.muted = val === 0;
    }
    setIsMuted(val === 0);
    setAutoMutedByBrowser(false);
    scheduleHideControls();
  };

  const handleSelectSpeed = (speed: number) => {
    const vid = videoRef.current;
    setPlaybackRate(speed);
    if (vid) {
      vid.playbackRate = speed;
    }
    setShowSpeedMenu(false);
    scheduleHideControls();
  };

  const togglePictureInPicture = async () => {
    const vid = videoRef.current as HTMLVideoElement & {
      webkitSetPresentationMode?: (mode: string) => void;
      webkitPresentationMode?: string;
    };
    if (!vid) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (typeof vid.requestPictureInPicture === 'function') {
        await vid.requestPictureInPicture();
      } else if (typeof vid.webkitSetPresentationMode === 'function') {
        const nextMode =
          vid.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
        vid.webkitSetPresentationMode(nextMode);
      }
    } catch {
      // ignore if PiP not supported on device
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const vid = videoRef.current as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };

    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return;
    }

    const fsEl =
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;

    if (fsEl) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (
          (document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen
        ) {
          (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen();
        }
      } catch {
        setIsPseudoFullscreen(false);
      }
      return;
    }

    // 1. Try standard Fullscreen API on player container (keeps custom controls on desktop & Android)
    if (container) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
          return;
        }
        if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
          return;
        }
      } catch {
        // Fallback below
      }
    }

    // 2. iOS iPhone Safari native video fullscreen support
    if (vid && typeof vid.webkitEnterFullscreen === 'function') {
      try {
        vid.webkitEnterFullscreen();
        return;
      } catch {
        // Fallback below
      }
    }

    // 3. Universal CSS Pseudo-Fullscreen fallback (works inside iframes & Android Lite APK WebViews)
    setIsPseudoFullscreen(prev => !prev);
  };

  const handleToggleOfflineCache = async () => {
    if (savingOffline) return;
    if (savedOffline) {
      await removeVideoFromOffline(videoId);
      setSavedOffline(false);
      return;
    }
    setSavingOffline(true);
    setOfflineProgress(10);
    const ok = await saveVideoForOffline(videoId, rawVideoUrl || src, pct =>
      setOfflineProgress(pct)
    );
    setSavingOffline(false);
    if (ok) {
      setSavedOffline(true);
    }
  };

  // Touch & click handler on video surface: single tap toggles controls/play, double tap left/right seeks ±10s
  const handleVideoSurfacePointerUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
    const side: 'left' | 'right' | 'center' =
      relX < 0.35 ? 'left' : relX > 0.65 ? 'right' : 'center';
    const now = Date.now();

    if (now - lastTapRef.current.time < 280 && lastTapRef.current.side === side && side !== 'center') {
      if (side === 'left') {
        seekBy(-10);
        setSeekRipple('left');
      } else {
        seekBy(10);
        setSeekRipple('right');
      }
      window.setTimeout(() => setSeekRipple(null), 550);
      lastTapRef.current = { time: 0, side: 'center' };
      return;
    }

    lastTapRef.current = { time: now, side };

    // On touch devices, if controls are hidden, first tap reveals controls; otherwise toggle play/pause
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice && !showControls && isPlaying) {
      scheduleHideControls();
    } else {
      togglePlayPause();
    }
  };

  const effectiveDuration = duration > 0 ? duration : durationHint || 1;
  const progressPct = Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));
  const activeFullscreen = isFullscreen || isPseudoFullscreen;

  return (
    <div
      ref={containerRef}
      onMouseMove={scheduleHideControls}
      onTouchStart={scheduleHideControls}
      className={`relative bg-black overflow-hidden select-none group ${
        isPseudoFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none'
          : 'w-full aspect-video rounded-2xl border border-[#E1E3E6] shadow-xs'
      }`}
    >
      {/* HTML5 Cross-Platform Video Element */}
      <video
        ref={videoRef}
        key={videoId}
        src={src}
        poster={poster || undefined}
        playsInline
        preload="metadata"
        onLoadedMetadata={e => {
          const vid = e.currentTarget;
          if (Number.isFinite(vid.duration) && vid.duration > 0) {
            setDuration(vid.duration);
          }
          setIsBuffering(false);
        }}
        onCanPlay={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
        }}
        onTimeUpdate={e => {
          const vid = e.currentTarget;
          setCurrentTime(vid.currentTime);
          if (vid.buffered.length > 0 && vid.duration > 0) {
            const bufferedEnd = vid.buffered.end(vid.buffered.length - 1);
            setBufferedPct(Math.min(100, (bufferedEnd / vid.duration) * 100));
          }
        }}
        onError={() => {
          setIsBuffering(false);
          setHasError(true);
        }}
        className="w-full h-full object-contain bg-black"
      >
        <source src={src} type={mimeType || 'video/mp4'} />
        <source src={src} type="video/mp4" />
        <source src={src} type="video/webm" />
      </video>

      {/* Interactive Surface for Play/Pause and Double-Tap ±10s Seek */}
      <div
        onClick={handleVideoSurfacePointerUp}
        className="absolute inset-0 z-10 cursor-pointer"
        title={title || 'Нажмите для воспроизведения/паузы (двойное нажатие по краям: ±10 сек)'}
      />

      {/* Top Bar: Auto-Muted Sound Prompt & Offline Status Badge */}
      <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
        <div>
          {autoMutedByBrowser && isMuted && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                toggleMute();
              }}
              className="pointer-events-auto px-3 py-1.5 rounded-full bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer animate-bounce"
            >
              <VolumeX className="w-4 h-4" />
              <span>Включить звук</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            void handleToggleOfflineCache();
          }}
          className={`pointer-events-auto px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-xs transition-all cursor-pointer ${
            savedOffline
              ? 'bg-emerald-600/90 text-white border border-emerald-400/40'
              : 'bg-black/65 hover:bg-black/80 text-white border border-white/15'
          }`}
          title={
            savedOffline
              ? 'Видео сохранено в памяти устройства и работает без интернета (нажмите, чтобы удалить из офлайн-кэша)'
              : 'Сохранить видео на устройство для просмотра без интернета'
          }
        >
          {savingOffline ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Кэш {offlineProgress}%</span>
            </>
          ) : savedOffline ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Доступно офлайн</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Сохранить офлайн</span>
            </>
          )}
        </button>
      </div>

      {/* Double-Tap Seek Ripple Feedback (-10s / +10s) */}
      {seekRipple === 'left' && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 px-4 py-2.5 rounded-2xl bg-black/75 text-white text-xs font-bold flex items-center gap-1.5 pointer-events-none animate-pulse">
          <RotateCcw className="w-4 h-4 text-[#0077FF]" />
          <span>-10 сек</span>
        </div>
      )}
      {seekRipple === 'right' && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 px-4 py-2.5 rounded-2xl bg-black/75 text-white text-xs font-bold flex items-center gap-1.5 pointer-events-none animate-pulse">
          <RotateCw className="w-4 h-4 text-[#0077FF]" />
          <span>+10 сек</span>
        </div>
      )}

      {/* Center Buffering Spinner or Big Play Button */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        {hasError ? (
          <div className="pointer-events-auto bg-black/85 border border-white/15 rounded-2xl p-4 text-center max-w-xs space-y-2 text-white">
            <AlertCircle className="w-7 h-7 text-[#E64646] mx-auto" />
            <p className="text-xs font-semibold">
              Не удалось загрузить поток. Проверьте соединение или откройте сохранённую офлайн-копию.
            </p>
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                videoRef.current?.load();
                togglePlayPause();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer"
            >
              Повторить попытку
            </button>
          </div>
        ) : isBuffering ? (
          <div className="w-12 h-12 rounded-full bg-black/65 flex items-center justify-center text-white">
            <Loader2 className="w-6 h-6 animate-spin text-[#0077FF]" />
          </div>
        ) : !isPlaying ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0077FF]/95 hover:bg-[#0066EA] text-white flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer"
            aria-label="Воспроизвести"
          >
            <Play className="w-7 h-7 fill-current ml-0.5" />
          </button>
        ) : null}
      </div>

      {/* Bottom Controls Bar (Works on Mobile Touch & Desktop) */}
      <div
        onClick={e => e.stopPropagation()}
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/65 to-transparent pt-8 pb-2.5 px-3 sm:px-4 transition-opacity duration-200 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Scrubber Timeline */}
        <div className="relative flex items-center w-full h-5 mb-1.5">
          {/* Track background */}
          <div className="w-full h-1.5 bg-white/25 rounded-full overflow-hidden relative">
            {/* Buffered bar */}
            <div
              className="absolute inset-y-0 left-0 bg-white/40 transition-all"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Played progress bar */}
            <div
              className="absolute inset-y-0 left-0 bg-[#0077FF]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={effectiveDuration}
            step={0.1}
            value={Math.min(currentTime, effectiveDuration)}
            onChange={handleTimelineChange}
            aria-label="Перемотка видео"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Left Controls: Play/Pause, -10s, +10s, Volume, Time */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <button
              type="button"
              onClick={togglePlayPause}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer shrink-0"
              title={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer shrink-0"
              title="Назад на 10 секунд"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer shrink-0"
              title="Вперёд на 10 секунд"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Mute + Slider */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer shrink-0"
                title={isMuted ? 'Включить звук' : 'Выключить звук'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#FF6B6B]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Громкость"
                className="hidden sm:block w-16 h-1 accent-[#0077FF] cursor-pointer"
              />
            </div>

            {/* Timestamp */}
            <div className="text-[11px] sm:text-xs font-mono tabular-nums text-white/90 truncate pl-1">
              {formatVideoDuration(currentTime)} / {formatVideoDuration(effectiveDuration)}
            </div>
          </div>

          {/* Right Controls: Speed, PiP, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 relative">
            {/* Speed Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(prev => !prev)}
                className="px-2 py-1 rounded-lg hover:bg-white/15 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Скорость воспроизведения"
              >
                <Gauge className="w-3.5 h-3.5 text-[#0077FF]" />
                <span>{playbackRate}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-9 right-0 bg-[#19191A]/95 border border-white/15 rounded-xl p-1.5 shadow-xl flex flex-col gap-0.5 min-w-[78px] z-40">
                  {SPEED_OPTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSelectSpeed(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold text-left cursor-pointer ${
                        playbackRate === s
                          ? 'bg-[#0077FF] text-white'
                          : 'text-white/85 hover:bg-white/10'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Picture-in-Picture */}
            <button
              type="button"
              onClick={togglePictureInPicture}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              title="Картинка в картинке (PiP)"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Fullscreen (Hardware + iOS Safari + WebView Fallback) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              title={activeFullscreen ? 'Выйти из полноэкранного режима' : 'Во весь экран'}
            >
              {activeFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
