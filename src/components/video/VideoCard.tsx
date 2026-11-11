import React, { useState, useEffect, useRef } from 'react';
import { MenderVideo } from '../../types';
import { resolvePlayableMediaUrl } from '../../utils/media';
import {
  Play,
  Eye,
  Heart,
  MessageSquare,
  ListPlus,
  Pencil,
  Trash2,
  Film,
  VolumeX,
} from 'lucide-react';

export function formatVideoDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatVideoDate(ts?: any): string {
  if (!ts) return 'Только что';
  try {
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

interface VideoCardProps {
  video: MenderVideo;
  isOwnVideo?: boolean;
  onSelectVideo: (video: MenderVideo) => void;
  onSelectAuthor: (authorId: string) => void;
  onAddToPlaylist?: (video: MenderVideo) => void;
  onEditVideo?: (video: MenderVideo) => void;
  onDeleteVideo?: (video: MenderVideo) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isOwnVideo = false,
  onSelectVideo,
  onSelectAuthor,
  onAddToPlaylist,
  onEditVideo,
  onDeleteVideo,
}) => {
  const [resolvedThumb, setResolvedThumb] = useState<string>('');
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>('');
  const [isHovering, setIsHovering] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    if (video.thumbnailUrl) {
      resolvePlayableMediaUrl(video.thumbnailUrl).then(url => {
        if (active) setResolvedThumb(url);
      });
    } else if (video.videoUrl?.startsWith('idb://')) {
      const pipeIdx = video.videoUrl.indexOf('|');
      if (pipeIdx >= 0) {
        setResolvedThumb(video.videoUrl.slice(pipeIdx + 1));
      }
    }
    return () => {
      active = false;
    };
  }, [video.thumbnailUrl, video.videoUrl]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(async () => {
      const url = resolvedVideoUrl || (await resolvePlayableMediaUrl(video.videoUrl));
      if (url) {
        setResolvedVideoUrl(url);
        setIsPlayingPreview(true);
      }
    }, 220);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsPlayingPreview(false);
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (previewVideoRef.current) {
      try {
        previewVideoRef.current.pause();
        previewVideoRef.current.currentTime = 0;
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (isPlayingPreview && previewVideoRef.current && resolvedVideoUrl) {
      previewVideoRef.current.currentTime = 0;
      previewVideoRef.current.play().catch(() => {
        setIsPlayingPreview(false);
      });
    }
  }, [isPlayingPreview, resolvedVideoUrl]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group bg-white border border-[#E1E3E6] rounded-xl overflow-hidden transition-all duration-200 hover:border-[#0077FF]/50 flex flex-col"
    >
      {/* 16:9 Cover & Desktop Hover Video Preview */}
      <div
        onClick={() => onSelectVideo(video)}
        className="relative aspect-video w-full bg-[#14171A] overflow-hidden cursor-pointer select-none"
      >
        {resolvedThumb ? (
          <img
            src={resolvedThumb}
            alt={video.title}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isHovering && !isPlayingPreview ? 'scale-[1.03]' : 'scale-100'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white/70 gap-2 p-4 text-center">
            <Film className="w-9 h-9 text-[#0077FF]" />
            <span className="text-xs font-medium line-clamp-1">{video.title}</span>
          </div>
        )}

        {/* Live Desktop Hover Video Preview */}
        {isPlayingPreview && resolvedVideoUrl && (
          <video
            ref={previewVideoRef}
            src={resolvedVideoUrl}
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover bg-black z-10"
          />
        )}

        {/* Subtle Dark Gradient Scrim at Bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none z-20" />

        {/* Preview Indicator on Hover */}
        {isPlayingPreview && (
          <div className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium flex items-center gap-1">
            <VolumeX className="w-3 h-3 text-[#0077FF]" />
            <span>Предпросмотр</span>
          </div>
        )}

        {/* Draft / Private status indicator for author */}
        {video.status === 'draft' && (
          <div className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider">
            Черновик
          </div>
        )}

        {/* Play overlay icon when hovering before preview starts */}
        {!isPlayingPreview && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-black/20 z-20 pointer-events-none">
            <div className="w-11 h-11 rounded-full bg-[#0077FF] text-white flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        )}

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2.5 z-20 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-mono tabular-nums font-semibold">
          {formatVideoDuration(video.duration)}
        </div>
      </div>

      {/* Card Body: Author Avatar, Title, Author Name, Views & Date */}
      <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
        <div className="flex items-start gap-3">
          {/* Author Avatar */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onSelectAuthor(video.authorId);
            }}
            className="shrink-0 mt-0.5 cursor-pointer"
            title={`Профиль автора ${video.authorName} (@${video.authorUsername})`}
          >
            <img
              src={video.authorAvatar}
              alt={video.authorName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-[#E1E3E6] hover:ring-2 hover:ring-[#0077FF] transition-all"
            />
          </button>

          <div className="min-w-0 flex-1">
            <h3
              onClick={() => onSelectVideo(video)}
              className="text-sm font-bold text-[#19191A] hover:text-[#0077FF] transition-colors line-clamp-2 leading-snug cursor-pointer"
              title={video.title}
            >
              {video.title}
            </h3>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSelectAuthor(video.authorId);
              }}
              className="mt-1 text-xs font-medium text-[#2A5885] hover:underline truncate block max-w-full cursor-pointer"
            >
              {video.authorName}{' '}
              <span className="text-[#818C99] font-normal">@{video.authorUsername}</span>
            </button>

            {/* Unboxed Metadata: Views · Date · Category */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#818C99] tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {video.viewsCount} просм.
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatVideoDate(video.createdAt)}</span>
              {video.category && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#19191A] font-medium">{video.category}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions Bar */}
        <div className="pt-2 border-t border-[#E1E3E6] flex items-center justify-between text-xs text-[#818C99]">
          <div className="flex items-center gap-3 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-[#E64646]" />
              {video.likesCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-[#0077FF]" />
              {video.commentsCount}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {onAddToPlaylist && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onAddToPlaylist(video);
                }}
                className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#818C99] hover:text-[#0077FF] transition-colors cursor-pointer"
                title="Добавить в плейлист"
              >
                <ListPlus className="w-4 h-4" />
              </button>
            )}
            {isOwnVideo && onEditVideo && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onEditVideo(video);
                }}
                className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#818C99] hover:text-[#19191A] transition-colors cursor-pointer"
                title="Редактировать видео"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {isOwnVideo && onDeleteVideo && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onDeleteVideo(video);
                }}
                className="p-1.5 rounded-lg hover:bg-[#FFEAEA] text-[#818C99] hover:text-[#E64646] transition-colors cursor-pointer"
                title="Удалить видео"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
