import React, { useState, useEffect, useRef } from 'react';
import { useVideo } from '../../context/VideoContext';
import { useAuth } from '../../context/AuthContext';
import { MenderVideo, VideoCategory, VisibilityType } from '../../types';
import {
  validateVideoFile,
  validateCoverImageFile,
  extractVideoMetadataAndFrames,
  captureVideoFrameAtTime,
  ExtractedVideoFrame,
  compressImageToDataUrl,
  resolvePlayableMediaUrl,
} from '../../utils/media';
import { formatVideoDuration } from './VideoCard';
import {
  Upload,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Eye,
  Save,
  Send,
  Trash2,
  ArrowLeft,
  Sliders,
  Loader2,
} from 'lucide-react';

export const VIDEO_CATEGORIES: VideoCategory[] = [
  'Технологии и IT',
  'Музыка',
  'Игры',
  'Образование',
  'Развлечения',
  'Спорт',
  'Наука',
  'Путешествия',
  'Творчество',
  'Блоги',
];

interface UploadQueueItem {
  queueId: string;
  file: File | null;
  previewObjectUrl: string;
  title: string;
  description: string;
  category: VideoCategory;
  hashtagsInput: string;
  visibility: VisibilityType;
  duration: number;
  extractedFrames: ExtractedVideoFrame[];
  selectedThumbDataUrl: string;
  customCoverFile: File | null;
  customFrameTimeSec: number;
  isExtractingFrames: boolean;
  isUploading: boolean;
  uploadProgress: number;
  uploadDoneStatus: null | 'published' | 'draft';
  errorMsg: string | null;
}

export const VideoUploadStudio: React.FC = () => {
  const {
    editingVideo,
    setEditingVideo,
    publishOrSaveVideo,
    deleteVideo,
    setVideoSubView,
    openVideoPlayer,
  } = useVideo();
  const { profile } = useAuth();

  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
  const [activeQueueIndex, setActiveQueueIndex] = useState<number>(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showCardPreview, setShowCardPreview] = useState<boolean>(true);
  const [confirmDeleteExisting, setConfirmDeleteExisting] = useState<boolean>(false);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize queue item when editing an existing video or draft
  useEffect(() => {
    if (editingVideo) {
      let active = true;
      resolvePlayableMediaUrl(editingVideo.videoUrl).then(resolvedVidUrl => {
        if (!active) return;
        resolvePlayableMediaUrl(editingVideo.thumbnailUrl).then(resolvedThumb => {
          if (!active) return;
          const editItem: UploadQueueItem = {
            queueId: `edit_${editingVideo.videoId}`,
            file: null,
            previewObjectUrl: resolvedVidUrl,
            title: editingVideo.title,
            description: editingVideo.description,
            category: (editingVideo.category as VideoCategory) || 'Технологии и IT',
            hashtagsInput: (editingVideo.hashtags || []).join(' '),
            visibility: editingVideo.visibility || 'public',
            duration: editingVideo.duration || 15,
            extractedFrames: resolvedThumb ? [{ timeSec: 0, dataUrl: resolvedThumb }] : [],
            selectedThumbDataUrl: resolvedThumb || editingVideo.thumbnailUrl || '',
            customCoverFile: null,
            customFrameTimeSec: 1,
            isExtractingFrames: false,
            isUploading: false,
            uploadProgress: 0,
            uploadDoneStatus: null,
            errorMsg: null,
          };
          setQueueItems([editItem]);
          setActiveQueueIndex(0);
        });
      });
      return () => {
        active = false;
      };
    } else {
      setQueueItems([]);
      setActiveQueueIndex(0);
    }
  }, [editingVideo]);

  const handleSelectVideoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setGlobalError(null);

    const filesArray = Array.from(fileList);
    const newItems: UploadQueueItem[] = [];

    for (const file of filesArray) {
      const validationErr = validateVideoFile(file);
      if (validationErr) {
        setGlobalError(`${file.name}: ${validationErr}`);
        continue;
      }

      const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120);
      const qId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const objUrl = URL.createObjectURL(file);

      newItems.push({
        queueId: qId,
        file,
        previewObjectUrl: objUrl,
        title: defaultTitle || 'Новое видео',
        description: '',
        category: 'Технологии и IT',
        hashtagsInput: '#mender #видео',
        visibility: 'public',
        duration: 10,
        extractedFrames: [],
        selectedThumbDataUrl: '',
        customCoverFile: null,
        customFrameTimeSec: 1,
        isExtractingFrames: true,
        isUploading: false,
        uploadProgress: 0,
        uploadDoneStatus: null,
        errorMsg: null,
      });
    }

    if (e.target) e.target.value = '';
    if (newItems.length === 0) return;

    // If we are editing an existing video and user picked a replacement video file
    if (editingVideo && queueItems.length === 1) {
      const replacement = newItems[0];
      setQueueItems(prev => [
        {
          ...prev[0],
          file: replacement.file,
          previewObjectUrl: replacement.previewObjectUrl,
          isExtractingFrames: true,
          errorMsg: null,
        },
      ]);
      const meta = await extractVideoMetadataAndFrames(replacement.file!, 5);
      setQueueItems(prev =>
        prev.map((it, idx) =>
          idx === 0
            ? {
                ...it,
                duration: meta.duration || it.duration,
                extractedFrames: meta.frames,
                selectedThumbDataUrl: meta.frames[0]?.dataUrl || it.selectedThumbDataUrl,
                isExtractingFrames: false,
              }
            : it
        )
      );
      return;
    }

    setQueueItems(prev => {
      const next = [...prev, ...newItems];
      return next;
    });

    // Extract metadata & cover frames for each selected video file individually
    for (const item of newItems) {
      if (!item.file) continue;
      const meta = await extractVideoMetadataAndFrames(item.file, 5);
      setQueueItems(prev =>
        prev.map(q =>
          q.queueId === item.queueId
            ? {
                ...q,
                duration: meta.duration || 10,
                extractedFrames: meta.frames,
                selectedThumbDataUrl: meta.frames[0]?.dataUrl || '',
                customFrameTimeSec: meta.frames[0]?.timeSec || 1,
                isExtractingFrames: false,
              }
            : q
        )
      );
    }
  };

  const updateQueueItem = (queueId: string, updater: (prev: UploadQueueItem) => UploadQueueItem) => {
    setQueueItems(prev => prev.map(item => (item.queueId === queueId ? updater(item) : item)));
  };

  const removeQueueItem = (queueId: string) => {
    setQueueItems(prev => {
      const filtered = prev.filter(i => i.queueId !== queueId);
      if (activeQueueIndex >= filtered.length) {
        setActiveQueueIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  const handleCaptureFrameAtCustomTime = async (item: UploadQueueItem, timeSec: number) => {
    if (!item.file) return;
    updateQueueItem(item.queueId, it => ({ ...it, customFrameTimeSec: timeSec }));
    const frameDataUrl = await captureVideoFrameAtTime(item.file, timeSec);
    if (frameDataUrl) {
      updateQueueItem(item.queueId, it => ({
        ...it,
        selectedThumbDataUrl: frameDataUrl,
        customCoverFile: null,
      }));
    }
  };

  const handleCustomCoverSelect = async (
    item: UploadQueueItem,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateCoverImageFile(file);
    if (err) {
      updateQueueItem(item.queueId, it => ({ ...it, errorMsg: err }));
      return;
    }
    const compressedPreview = await compressImageToDataUrl(file, 960, 0.78, 280000);
    updateQueueItem(item.queueId, it => ({
      ...it,
      customCoverFile: file,
      selectedThumbDataUrl: compressedPreview,
      errorMsg: null,
    }));
    if (e.target) e.target.value = '';
  };

  const handleSubmitSingleItem = async (
    item: UploadQueueItem,
    targetStatus: 'published' | 'draft'
  ) => {
    if (item.isUploading) return;
    if (!item.title.trim()) {
      updateQueueItem(item.queueId, it => ({
        ...it,
        errorMsg: 'Пожалуйста, введите название видеоролика.',
      }));
      return;
    }

    updateQueueItem(item.queueId, it => ({
      ...it,
      isUploading: true,
      uploadProgress: 5,
      errorMsg: null,
    }));

    const parsedHashtags = item.hashtagsInput
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const savedVideo: MenderVideo = await publishOrSaveVideo({
        file: item.file,
        existingVideo: editingVideo || null,
        title: item.title,
        description: item.description,
        category: item.category,
        hashtags: parsedHashtags,
        thumbnailUrl: item.selectedThumbDataUrl,
        customCoverFile: item.customCoverFile,
        duration: item.duration,
        status: targetStatus,
        visibility: item.visibility,
        onProgress: pct => {
          updateQueueItem(item.queueId, it => ({ ...it, uploadProgress: pct }));
        },
      });

      updateQueueItem(item.queueId, it => ({
        ...it,
        isUploading: false,
        uploadProgress: 100,
        uploadDoneStatus: targetStatus,
      }));

      if (editingVideo) {
        setEditingVideo(null);
        if (targetStatus === 'published') {
          openVideoPlayer(savedVideo.videoId);
        } else {
          setVideoSubView('my_videos');
        }
      }
    } catch (err: any) {
      updateQueueItem(item.queueId, it => ({
        ...it,
        isUploading: false,
        errorMsg: err?.message || 'Ошибка при загрузке видео.',
      }));
    }
  };

  const handlePublishAllPending = async () => {
    for (const item of queueItems) {
      if (!item.uploadDoneStatus && !item.isUploading) {
        await handleSubmitSingleItem(item, 'published');
      }
    }
  };

  const handleDeleteCurrentEditingVideo = async () => {
    if (!editingVideo) return;
    await deleteVideo(editingVideo.videoId);
    setEditingVideo(null);
    setVideoSubView('home');
  };

  const currentItem = queueItems[activeQueueIndex] || null;

  return (
    <div className="space-y-4">
      {/* Studio Header */}
      <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingVideo(null);
              setVideoSubView('home');
            }}
            className="p-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] transition-colors cursor-pointer"
            title="Назад к видеоленте"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#19191A]">
              {editingVideo
                ? `Редактирование видео: ${editingVideo.title}`
                : 'Студия публикации Mender Video'}
            </h2>
            <p className="text-xs text-[#818C99]">
              {editingVideo
                ? 'Измените метаданные, обложку или статус публикации'
                : 'Загружайте одно или несколько видео по отдельности, выбирайте кадр обложки и публикуйте или сохраняйте в черновики'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.mov,.mkv"
            multiple={!editingVideo}
            onChange={handleSelectVideoFiles}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="px-3.5 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{editingVideo ? 'Заменить видеофайл' : 'Добавить видеофайлы'}</span>
          </button>

          {!editingVideo && queueItems.some(i => !i.uploadDoneStatus) && queueItems.length > 1 && (
            <button
              type="button"
              onClick={handlePublishAllPending}
              className="px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Опубликовать все ({queueItems.filter(i => !i.uploadDoneStatus).length})</span>
            </button>
          )}
        </div>
      </div>

      {globalError && (
        <div className="p-3.5 rounded-xl bg-[#FFEAEA] border border-[#FFCCCC] text-xs text-[#E64646] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{globalError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty Dropzone if no videos in queue */}
      {queueItems.length === 0 ? (
        <div
          onClick={() => videoInputRef.current?.click()}
          className="bg-white border-2 border-dashed border-[#0077FF]/40 hover:border-[#0077FF] rounded-2xl p-10 text-center cursor-pointer transition-all space-y-3"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#0077FF]/10 text-[#0077FF] flex items-center justify-center mx-auto">
            <Upload className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#19191A]">
              Выберите видео из галереи или файлов устройства
            </h3>
            <p className="text-xs text-[#818C99] max-w-md mx-auto">
              Поддерживаются форматы MP4, WebM, MOV, OGG (до 150 МБ на файл). Можно выбрать сразу несколько роликов — каждый будет настроен и загружен отдельно.
            </p>
          </div>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold inline-flex items-center gap-2 shadow-xs"
          >
            <Film className="w-4 h-4" />
            <span>Выбрать файлы на устройстве</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Multi-Video Queue Selector Bar */}
          {queueItems.length > 1 && (
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#818C99]">
                <span className="font-semibold text-[#19191A]">
                  Очередь выбранных видео ({queueItems.length} шт. — загрузка каждого по отдельности)
                </span>
                <span>Выберите ролик для настройки и публикации</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {queueItems.map((qItem, idx) => {
                  const isActive = idx === activeQueueIndex;
                  return (
                    <div
                      key={qItem.queueId}
                      onClick={() => setActiveQueueIndex(idx)}
                      className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2.5 cursor-pointer shrink-0 transition-all ${
                        isActive
                          ? 'bg-[#F0F6FF] border-[#0077FF] text-[#0077FF] font-semibold'
                          : 'bg-[#F7F8FA] border-[#E1E3E6] text-[#19191A]'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5 shrink-0" />
                      <span className="max-w-[160px] truncate">
                        {idx + 1}. {qItem.title || 'Без названия'}
                      </span>
                      {qItem.isUploading && (
                        <span className="text-[10px] font-mono tabular-nums text-[#0077FF]">
                          {qItem.uploadProgress}%
                        </span>
                      )}
                      {qItem.uploadDoneStatus && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          removeQueueItem(qItem.queueId);
                        }}
                        className="p-0.5 rounded hover:bg-black/10 text-[#818C99] hover:text-[#E64646]"
                        title="Убрать из очереди"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Video Editor & Preview Split */}
          {currentItem && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left 7 Cols: Metadata Form & Cover Selector */}
              <div className="lg:col-span-7 bg-white border border-[#E1E3E6] rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E1E3E6] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#19191A]">
                      Параметры видеоролика #{activeQueueIndex + 1}
                    </h3>
                    {currentItem.file && (
                      <p className="text-[11px] text-[#818C99] mt-0.5 tabular-nums">
                        Файл: {currentItem.file.name} ·{' '}
                        {(currentItem.file.size / (1024 * 1024)).toFixed(2)} МБ · Длительность:{' '}
                        {formatVideoDuration(currentItem.duration)}
                      </p>
                    )}
                  </div>
                  {currentItem.uploadDoneStatus && (
                    <span className="px-2.5 py-1 rounded-md bg-[#E8F9E8] text-[#16A34A] text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {currentItem.uploadDoneStatus === 'published'
                        ? 'Опубликовано'
                        : 'Сохранено в черновики'}
                    </span>
                  )}
                </div>

                {currentItem.errorMsg && (
                  <div className="p-3 rounded-lg bg-[#FFEAEA] border border-[#FFCCCC] text-xs text-[#E64646] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{currentItem.errorMsg}</span>
                  </div>
                )}

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#19191A] flex items-center justify-between">
                    <span>Название видео *</span>
                    <span className="text-[11px] font-normal text-[#818C99] tabular-nums">
                      {currentItem.title.length}/150
                    </span>
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    value={currentItem.title}
                    onChange={e =>
                      updateQueueItem(currentItem.queueId, it => ({
                        ...it,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Введите понятное и привлекательное название ролика..."
                    className="v7-input text-xs"
                  />
                </div>

                {/* Detailed Description */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#19191A] flex items-center justify-between">
                    <span>Подробное описание</span>
                    <span className="text-[11px] font-normal text-[#818C99] tabular-nums">
                      {currentItem.description.length}/4000
                    </span>
                  </label>
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={currentItem.description}
                    onChange={e =>
                      updateQueueItem(currentItem.queueId, it => ({
                        ...it,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Расскажите зрителям о чём это видео, добавьте таймкоды и полезные ссылки..."
                    className="v7-input text-xs resize-y"
                  />
                </div>

                {/* Category & Visibility */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#19191A]">Категория видео</label>
                    <select
                      value={currentItem.category}
                      onChange={e =>
                        updateQueueItem(currentItem.queueId, it => ({
                          ...it,
                          category: e.target.value as VideoCategory,
                        }))
                      }
                      className="v7-input text-xs cursor-pointer"
                    >
                      {VIDEO_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#19191A]">Доступность</label>
                    <select
                      value={currentItem.visibility}
                      onChange={e =>
                        updateQueueItem(currentItem.queueId, it => ({
                          ...it,
                          visibility: e.target.value as VisibilityType,
                        }))
                      }
                      className="v7-input text-xs cursor-pointer"
                    >
                      <option value="public">Публичное (видят все пользователи)</option>
                      <option value="private">Приватное (только для меня)</option>
                    </select>
                  </div>
                </div>

                {/* Hashtags */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#19191A]">
                    Хештеги (через пробел или запятую, до 15 тегов)
                  </label>
                  <input
                    type="text"
                    value={currentItem.hashtagsInput}
                    onChange={e =>
                      updateQueueItem(currentItem.queueId, it => ({
                        ...it,
                        hashtagsInput: e.target.value,
                      }))
                    }
                    placeholder="#mender #технологии #обзор #разработка"
                    className="v7-input text-xs"
                  />
                </div>

                {/* Cover Selection: Frames from Video OR Custom Cover Image */}
                <div className="space-y-3 pt-2 border-t border-[#E1E3E6]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-[#19191A]">
                        Обложка видеоролика (из кадров видео или своя)
                      </h4>
                      <p className="text-[11px] text-[#818C99]">
                        Выберите один из автоматически извлечённых кадров, укажите точный таймкод или загрузите свою обложку
                      </p>
                    </div>

                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e => handleCustomCoverSelect(currentItem, e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] border border-[#E1E3E6] text-xs font-semibold text-[#19191A] flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#0077FF]" />
                      <span>Загрузить свою обложку</span>
                    </button>
                  </div>

                  {/* Extracted Video Frames Strip */}
                  {currentItem.isExtractingFrames ? (
                    <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center justify-center gap-2 text-xs text-[#818C99]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0077FF]" />
                      <span>Извлечение кадров из видеоролика...</span>
                    </div>
                  ) : (
                    currentItem.extractedFrames.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {currentItem.extractedFrames.map((frame, fIdx) => {
                          const isSelected = currentItem.selectedThumbDataUrl === frame.dataUrl;
                          return (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() =>
                                updateQueueItem(currentItem.queueId, it => ({
                                  ...it,
                                  selectedThumbDataUrl: frame.dataUrl,
                                  customCoverFile: null,
                                }))
                              }
                              className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-[#0077FF] ring-2 ring-[#0077FF]/30 scale-[1.02]'
                                  : 'border-[#E1E3E6] opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={frame.dataUrl}
                                alt={`Кадр ${fIdx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/75 text-white text-[9px] font-mono tabular-nums">
                                {formatVideoDuration(frame.timeSec)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* Custom Frame Scrubber if File is Present */}
                  {currentItem.file && currentItem.duration > 1 && (
                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#19191A] flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-[#0077FF]" />
                          <span>Захват кадра на секунду:</span>
                        </span>
                        <span className="font-mono tabular-nums font-bold text-[#0077FF]">
                          {formatVideoDuration(currentItem.customFrameTimeSec)} /{' '}
                          {formatVideoDuration(currentItem.duration)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={Math.max(1, currentItem.duration - 0.1)}
                        step={0.5}
                        value={currentItem.customFrameTimeSec}
                        onChange={e =>
                          handleCaptureFrameAtCustomTime(currentItem, Number(e.target.value))
                        }
                        className="w-full accent-[#0077FF] cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Real Upload Progress Bar */}
                {currentItem.isUploading && (
                  <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#0077FF]/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#19191A]">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#0077FF]" />
                        <span>Загрузка видео и сохранение в базу данных...</span>
                      </span>
                      <span className="font-mono tabular-nums text-[#0077FF]">
                        {currentItem.uploadProgress}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E1E3E6] overflow-hidden">
                      <div
                        className="h-full bg-[#0077FF] transition-all duration-200"
                        style={{ width: `${currentItem.uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons: Publish, Save as Draft, Delete (if editing) */}
                <div className="pt-3 border-t border-[#E1E3E6] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={currentItem.isUploading}
                      onClick={() => handleSubmitSingleItem(currentItem, 'published')}
                      className="px-4 py-2.5 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {editingVideo ? 'Сохранить и опубликовать' : 'Опубликовать видео'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={currentItem.isUploading}
                      onClick={() => handleSubmitSingleItem(currentItem, 'draft')}
                      className="px-4 py-2.5 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] border border-[#E1E3E6] disabled:opacity-50 text-[#19191A] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Save className="w-3.5 h-3.5 text-[#818C99]" />
                      <span>Сохранить в черновики</span>
                    </button>
                  </div>

                  {editingVideo && (
                    <div>
                      {!confirmDeleteExisting ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteExisting(true)}
                          className="px-3 py-2 rounded-lg bg-[#FFEAEA] hover:bg-[#FFD6D6] text-[#E64646] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Удалить видео</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleDeleteCurrentEditingVideo}
                            className="px-3 py-2 rounded-lg bg-[#E64646] text-white text-xs font-bold cursor-pointer"
                          >
                            Подтвердить удаление
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteExisting(false)}
                            className="px-2.5 py-2 rounded-lg bg-[#F0F2F5] text-xs text-[#19191A] cursor-pointer"
                          >
                            Отмена
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right 5 Cols: Interactive Pre-Publish Preview (Video Player + Feed Card Preview) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#19191A] flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-[#0077FF]" />
                      <span>Предпросмотр перед публикацией</span>
                    </h4>
                    <div className="flex items-center gap-1 bg-[#F0F2F5] p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setShowCardPreview(true)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                          showCardPreview
                            ? 'bg-white text-[#19191A] shadow-2xs'
                            : 'text-[#818C99]'
                        }`}
                      >
                        Карточка
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCardPreview(false)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                          !showCardPreview
                            ? 'bg-white text-[#19191A] shadow-2xs'
                            : 'text-[#818C99]'
                        }`}
                      >
                        Видеоплеер
                      </button>
                    </div>
                  </div>

                  {showCardPreview ? (
                    /* Card Preview */
                    <div className="border border-[#E1E3E6] rounded-xl overflow-hidden bg-white">
                      <div className="relative aspect-video bg-[#14171A]">
                        {currentItem.selectedThumbDataUrl ? (
                          <img
                            src={currentItem.selectedThumbDataUrl}
                            alt="Обложка"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/50 text-xs">
                            Обложка не выбрана
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-mono tabular-nums font-semibold">
                          {formatVideoDuration(currentItem.duration)}
                        </div>
                      </div>
                      <div className="p-3.5 flex items-start gap-3">
                        {profile?.avatarUrl && (
                          <img
                            src={profile.avatarUrl}
                            alt={profile.displayName}
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#E1E3E6]"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-[#19191A] line-clamp-2">
                            {currentItem.title || 'Название вашего видео'}
                          </div>
                          <div className="text-xs text-[#2A5885] mt-1">
                            {profile?.displayName} · @{profile?.username}
                          </div>
                          <div className="text-[11px] text-[#818C99] mt-0.5">
                            0 просм. · Только что · {currentItem.category}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Video Player Preview */
                    <div className="rounded-xl overflow-hidden bg-black aspect-video">
                      {currentItem.previewObjectUrl ? (
                        <video
                          src={currentItem.previewObjectUrl}
                          poster={currentItem.selectedThumbDataUrl || undefined}
                          controls
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/60 text-xs">
                          Видеофайл не выбран
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
