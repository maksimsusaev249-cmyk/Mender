import React from 'react';
import { useVideo } from '../../context/VideoContext';
import { useAuth } from '../../context/AuthContext';
import { formatVideoDate, formatVideoDuration } from './VideoCard';
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageSquare,
  Users,
  Film,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';

export const VideoAnalyticsView: React.FC = () => {
  const {
    myVideos,
    openVideoPlayer,
    openUploadStudio,
    deleteVideo,
    setVideoSubView,
  } = useVideo();
  const { profile } = useAuth();

  // Strictly real, database-derived aggregates — zero fake or synthetic numbers
  const totalViews = myVideos.reduce((acc, v) => acc + (v.viewsCount || 0), 0);
  const totalLikes = myVideos.reduce((acc, v) => acc + (v.likesCount || 0), 0);
  const totalComments = myVideos.reduce((acc, v) => acc + (v.commentsCount || 0), 0);
  const totalFollowers = profile?.followersCount || 0;
  const publishedCount = myVideos.filter(v => v.status === 'published').length;
  const draftsCount = myVideos.filter(v => v.status === 'draft').length;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#E1E3E6] rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setVideoSubView('home')}
            className="p-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#19191A] truncate">
              Аналитика автора Mender Video
            </h2>
            <p className="text-[11px] sm:text-xs text-[#818C99] line-clamp-1">
              Реальные показатели из базы данных по вашим видеороликам и аудитории
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openUploadStudio(null)}
          className="px-3 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Загрузить видео</span>
        </button>
      </div>

      {/* Real KPI Summary Strip (2x2 on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white border border-[#E1E3E6] rounded-xl p-3 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#818C99]">
            <span>Просмотры</span>
            <Eye className="w-4 h-4 text-[#0077FF] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#19191A] font-mono tabular-nums">
            {totalViews}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#818C99] tabular-nums">
            Опубл.: {publishedCount} · Черн.: {draftsCount}
          </div>
        </div>

        <div className="bg-white border border-[#E1E3E6] rounded-xl p-3 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#818C99]">
            <span>Лайки видео</span>
            <Heart className="w-4 h-4 text-[#E64646] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#19191A] font-mono tabular-nums">
            {totalLikes}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#818C99] line-clamp-1">
            Отметки «Нравится» от зрителей
          </div>
        </div>

        <div className="bg-white border border-[#E1E3E6] rounded-xl p-3 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#818C99]">
            <span>Комментарии</span>
            <MessageSquare className="w-4 h-4 text-[#0077FF] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#19191A] font-mono tabular-nums">
            {totalComments}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#818C99] line-clamp-1">
            Комментарии и ответы под роликами
          </div>
        </div>

        <div className="bg-white border border-[#E1E3E6] rounded-xl p-3 sm:p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#818C99]">
            <span>Подписчики</span>
            <Users className="w-4 h-4 text-[#16A34A] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#19191A] font-mono tabular-nums">
            {totalFollowers}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#818C99] tabular-nums">
            Ваших подписок: {profile?.followingCount || 0}
          </div>
        </div>
      </div>

      {/* Per-Video Detailed Statistics (Mobile Cards + Desktop Table) */}
      <div className="bg-white border border-[#E1E3E6] rounded-xl overflow-hidden">
        <div className="px-3.5 sm:px-4 py-3 border-b border-[#E1E3E6] flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-[#19191A]">
            Статистика каждого видеоролика ({myVideos.length})
          </h3>
        </div>

        {myVideos.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Film className="w-8 h-8 text-[#818C99] mx-auto" />
            <p className="text-xs text-[#818C99]">
              Вы ещё не загрузили ни одного видеоролика. Опубликуйте первое видео, чтобы отслеживать реальную статистику просмотров, лайков и комментариев.
            </p>
            <button
              type="button"
              onClick={() => openUploadStudio(null)}
              className="px-4 py-2 rounded-lg bg-[#0077FF] text-white text-xs font-semibold cursor-pointer"
            >
              Загрузить первое видео
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card List (visible on phones < md, no horizontal scrolling needed) */}
            <div className="md:hidden divide-y divide-[#E1E3E6]">
              {myVideos.map(video => {
                const views = video.viewsCount || 0;
                const engagements = (video.likesCount || 0) + (video.commentsCount || 0);
                const erPercent =
                  views > 0 ? Math.min(100, Math.round((engagements / views) * 100)) : 0;

                return (
                  <div key={video.videoId} className="p-3.5 space-y-3">
                    {/* Video Thumbnail + Title + Status */}
                    <div
                      onClick={() => openVideoPlayer(video.videoId)}
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <div className="relative w-24 aspect-video rounded-lg bg-[#14171A] overflow-hidden shrink-0 flex items-center justify-center border border-[#E1E3E6]">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-5 h-5 text-white/60" />
                        )}
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-white text-[9px] font-mono tabular-nums">
                          {formatVideoDuration(video.duration)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-xs font-bold text-[#19191A] line-clamp-2 leading-snug">
                          {video.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`font-semibold ${
                              video.status === 'published'
                                ? 'text-[#16A34A]'
                                : 'text-amber-600'
                            }`}
                          >
                            {video.status === 'published' ? 'Опубликовано' : 'Черновик'}
                          </span>
                          <span className="text-[#818C99]">·</span>
                          <span className="text-[#818C99]">{video.category}</span>
                          <span className="text-[#818C99]">·</span>
                          <span className="text-[#818C99] tabular-nums">
                            {formatVideoDate(video.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4-Column Metric Strip for Phone */}
                    <div className="grid grid-cols-4 gap-1.5 bg-[#F7F8FA] border border-[#E1E3E6] rounded-xl p-2 text-center">
                      <div>
                        <div className="text-[10px] text-[#818C99]">Просм.</div>
                        <div className="text-xs font-bold font-mono tabular-nums text-[#19191A]">
                          {video.viewsCount || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#818C99]">Лайки</div>
                        <div className="text-xs font-bold font-mono tabular-nums text-[#E64646]">
                          {video.likesCount || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#818C99]">Комм.</div>
                        <div className="text-xs font-bold font-mono tabular-nums text-[#0077FF]">
                          {video.commentsCount || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#818C99]">Вовлеч.</div>
                        <div className="text-xs font-bold font-mono tabular-nums text-[#19191A]">
                          {erPercent}%
                        </div>
                      </div>
                    </div>

                    {/* Mobile Touch Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => openUploadStudio(video)}
                        className="flex-1 py-2 px-3 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Редактировать</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteVideo(video.videoId)}
                        className="py-2 px-3 rounded-lg bg-[#FFEAEA] hover:bg-[#FFD6D6] text-[#E64646] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Удалить</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Full 9-Column Table (visible on md and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E1E3E6] bg-[#F7F8FA] text-[#818C99] font-semibold">
                    <th className="py-2.5 px-4">Видеоролик</th>
                    <th className="py-2.5 px-3">Статус</th>
                    <th className="py-2.5 px-3">Категория</th>
                    <th className="py-2.5 px-3">Дата</th>
                    <th className="py-2.5 px-3 text-right">Просмотры</th>
                    <th className="py-2.5 px-3 text-right">Лайки</th>
                    <th className="py-2.5 px-3 text-right">Комментарии</th>
                    <th className="py-2.5 px-3 text-right">Вовлечённость</th>
                    <th className="py-2.5 px-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E3E6]">
                  {myVideos.map(video => {
                    const views = video.viewsCount || 0;
                    const engagements = (video.likesCount || 0) + (video.commentsCount || 0);
                    const erPercent =
                      views > 0 ? Math.min(100, Math.round((engagements / views) * 100)) : 0;

                    return (
                      <tr
                        key={video.videoId}
                        className="hover:bg-[#F7F8FA] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div
                            onClick={() => openVideoPlayer(video.videoId)}
                            className="flex items-center gap-3 cursor-pointer max-w-xs"
                          >
                            <div className="w-16 aspect-video rounded bg-[#14171A] overflow-hidden shrink-0 flex items-center justify-center">
                              {video.thumbnailUrl ? (
                                <img
                                  src={video.thumbnailUrl}
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Film className="w-4 h-4 text-white/60" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#19191A] hover:text-[#0077FF] truncate">
                                {video.title}
                              </div>
                              <div className="text-[11px] text-[#818C99] font-mono tabular-nums">
                                {formatVideoDuration(video.duration)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              video.status === 'published'
                                ? 'text-[#16A34A]'
                                : 'text-amber-600'
                            }`}
                          >
                            {video.status === 'published' ? 'Опубликовано' : 'Черновик'}
                          </span>
                          <span className="text-[#818C99]">
                            {' '}
                            · {video.visibility === 'public' ? 'Публ.' : 'Прив.'}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-[#19191A]">
                          {video.category}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-[#818C99] tabular-nums">
                          {formatVideoDate(video.createdAt)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-[#19191A]">
                          {video.viewsCount || 0}
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-[#E64646]">
                          {video.likesCount || 0}
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-[#0077FF]">
                          {video.commentsCount || 0}
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums text-[#818C99]">
                          {erPercent}%
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openUploadStudio(video)}
                              className="p-1.5 rounded-lg hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#19191A] cursor-pointer"
                              title="Редактировать"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteVideo(video.videoId)}
                              className="p-1.5 rounded-lg hover:bg-[#FFEAEA] text-[#818C99] hover:text-[#E64646] cursor-pointer"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
