import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, GalleryHorizontal } from 'lucide-react';
import { Post, PostMediaItem } from '../../types';
import { getSyncCachedMediaUrl, resolvePlayableMediaUrl } from '../../utils/media';

interface PostMediaViewerProps {
  post: Post;
}

const ResolvedMediaElement: React.FC<{
  item: PostMediaItem;
  className?: string;
  isGridThumb?: boolean;
}> = ({ item, className = '', isGridThumb = false }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(() =>
    getSyncCachedMediaUrl(item.url)
  );

  useEffect(() => {
    let mounted = true;
    resolvePlayableMediaUrl(item.url).then(url => {
      if (mounted) setResolvedUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, [item.url]);

  if (!resolvedUrl) return null;

  const isPosterImageOnly =
    item.type === 'video' && resolvedUrl.startsWith('data:image/');

  if (item.type === 'video' && !isPosterImageOnly) {
    if (isGridThumb) {
      return (
        <video
          src={resolvedUrl}
          className={className}
          muted
          playsInline
        />
      );
    }
    return (
      <video
        key={resolvedUrl}
        src={resolvedUrl}
        controls
        playsInline
        className={className}
      />
    );
  }

  return <img src={resolvedUrl} alt="post media" className={className} />;
};

export const PostMediaViewer: React.FC<PostMediaViewerProps> = ({ post }) => {
  const items: PostMediaItem[] =
    post.mediaItems && post.mediaItems.length > 0
      ? post.mediaItems.slice(0, 9)
      : post.mediaUrl && post.mediaType !== 'none'
      ? [{ url: post.mediaUrl, type: post.mediaType === 'video' ? 'video' : 'image' }]
      : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>(
    post.mediaLayout || 'carousel'
  );

  if (items.length === 0) return null;

  // Одиночное фото или видео
  if (items.length === 1) {
    const single = items[0];
    return (
      <div className="w-full rounded-xl overflow-hidden bg-[#F5F6F8] border border-[#E1E3E6]">
        <ResolvedMediaElement
          item={single}
          className={
            single.type === 'video'
              ? 'w-full max-h-96 object-contain bg-black'
              : 'w-full max-h-96 object-cover'
          }
        />
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, items.length - 1);
  const activeItem = items[safeIndex];

  const handlePrev = () => {
    setCurrentIndex(prev => (prev <= 0 ? items.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev >= items.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-[#818C99] px-0.5">
        <span>
          Вложения: <strong className="text-[#19191A]">{items.length}</strong>
        </span>
        <div className="flex items-center gap-1 bg-[#F0F2F5] p-0.5 rounded-lg border border-[#E1E3E6]">
          <button
            type="button"
            onClick={() => setViewMode('carousel')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors ${
              viewMode === 'carousel'
                ? 'bg-white text-[#0077FF] font-semibold shadow-2xs'
                : 'text-[#818C99] hover:text-[#19191A]'
            }`}
            title="Листать влево и вправо (Карусель)"
          >
            <GalleryHorizontal className="w-3 h-3" />
            <span>Карусель</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-[#0077FF] font-semibold shadow-2xs'
                : 'text-[#818C99] hover:text-[#19191A]'
            }`}
            title="Показать сеткой (до 9 штук)"
          >
            <LayoutGrid className="w-3 h-3" />
            <span>Сетка</span>
          </button>
        </div>
      </div>

      {viewMode === 'carousel' ? (
        /* РЕЖИМ 1: КАРУСЕЛЬ (листать влево и вправо) */
        <div className="relative w-full rounded-xl overflow-hidden bg-[#F5F6F8] border border-[#E1E3E6] group">
          <div className="w-full h-80 sm:h-96 flex items-center justify-center bg-[#EDEFEF]">
            <ResolvedMediaElement
              item={activeItem}
              className={
                activeItem.type === 'video'
                  ? 'w-full h-full object-contain bg-black'
                  : 'w-full h-full object-cover'
              }
            />
          </div>

          {/* Счётчик слайда */}
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-xs text-[11px] font-medium text-white">
            {safeIndex + 1} / {items.length}
          </div>

          {/* Кнопка ВЛЕВО */}
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#19191A] flex items-center justify-center shadow-md border border-[#E1E3E6] cursor-pointer transition-all"
            title="Листать влево"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Кнопка ВПРАВО */}
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#19191A] flex items-center justify-center shadow-md border border-[#E1E3E6] cursor-pointer transition-all"
            title="Листать вправо"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Индикаторы-точки внизу */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-xs">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === safeIndex ? 'w-5 bg-[#0077FF]' : 'w-2 bg-white/55 hover:bg-white'
                }`}
                title={`Перейти к ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      ) : (
        /* РЕЖИМ 2: СЕТКА (максимально 9 штук) */
        <div
          className={`grid gap-1.5 rounded-xl overflow-hidden ${
            items.length === 2 || items.length === 4 ? 'grid-cols-2' : 'grid-cols-3'
          }`}
        >
          {items.slice(0, 9).map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setViewMode('carousel');
              }}
              className="relative aspect-square bg-[#F5F6F8] border border-[#E1E3E6] rounded-lg overflow-hidden cursor-pointer group"
              title="Нажмите, чтобы открыть в карусели"
            >
              <ResolvedMediaElement
                item={item}
                isGridThumb
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-medium text-white">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
