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
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setVideoSubView('home')}
            className="p-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#19191A]">
              Аналитика автора Mender Video
            </h2>
            <p className="text-xs text-[#818C99]">
              Реальные показатели из базы данных по вашим видеороликам и аудитории
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openUploadStudio(null)}
          className="px-3.5 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Загрузить видео</span>
        </button>
      </div>

      {/* Real KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#818C99]">
            <span>Всего просмотров</span>
            <Eye className="w-4 h-4 text-[#0077FF]" />
          </div>
          <div className="text-2xl font-bold text-[#19191A] font-mono tabular-nums">
            {totalViews}
          </div>
          <div className="text-[11px] text-[#818C99] tabular-nums">
            Опубликовано: {publishedCount} · Черновиков: {draftsCount}
          </div>
        </div>

        <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#818C99]">
            <span>Лайки видео</span>
            <Heart className="w-4 h-4 text-[#E64646]" />
          </div>
          <div className="text-2xl font-bold text-[#19191A] font-mono tabular-nums">
            {totalLikes}
          </div>
          <div className="text-[11px] text-[#818C99]">
            Реальные отметки «Нравится» от зрителей
          </div>
        </div>

        <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#818C99]">
            <span>Комментарии</span>
            <MessageSquare className="w-4 h-4 text-[#0077FF]" />
          </div>
          <div className="text-2xl font-bold text-[#19191A] font-mono tabular-nums">
            {totalComments}
          </div>
          <div className="text-[11px] text-[#818C99]">
            Комментарии и ответы под вашими роликами
          </div>
        </div>

        <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#818C99]">
            <span>Подписчики</span>
            <Users className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="text-2xl font-bold text-[#19191A] font-mono tabular-nums">
            {totalFollowers}
          </div>
          <div className="text-[11px] text-[#818C99] tabular-nums">
            Ваших подписок: {profile?.followingCount || 0}
          </div>
        </div>
      </div>

      {/* Per-Video Detailed Statistics Table */}
      <div className="bg-white border border-[#E1E3E6] rounded-xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[#E1E3E6] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#19191A]">
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
          <div className="overflow-x-auto">
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
        )}
      </div>
    </div>
  );
};
