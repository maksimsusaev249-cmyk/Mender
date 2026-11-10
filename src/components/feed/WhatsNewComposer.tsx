import React, { useState, useRef } from 'react';
import {
  Plus,
  X,
  Folder,
  FolderPlus,
  Film,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  LayoutGrid,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

interface WhatsNewComposerProps {
  defaultFolderId?: string;
  onPublished?: () => void;
}

interface PreviewMedia {
  file: File;
  url: string;
  type: 'image' | 'video';
}

export const WhatsNewComposer: React.FC<WhatsNewComposerProps> = ({
  defaultFolderId = '',
  onPublished,
}) => {
  const { profile } = useAuth();
  const { myProfileFolders, createProfileFolder, createPost } = useChat();

  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(defaultFolderId);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [mediaList, setMediaList] = useState<PreviewMedia[]>([]);
  const [mediaLayout, setMediaLayout] = useState<'carousel' | 'grid'>('carousel');
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setMediaList(prev => {
      const remainingSlots = Math.max(0, 9 - prev.length);
      const sliced = files.slice(0, remainingSlots);
      const added: PreviewMedia[] = sliced.map(file => ({
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
      }));
      return [...prev, ...added].slice(0, 9);
    });

    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaList(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (previewSlideIndex >= next.length) {
        setPreviewSlideIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleQuickCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const id = await createProfileFolder(newFolderName.trim());
    setSelectedFolderId(id);
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && mediaList.length === 0) || isPublishing) return;

    setIsPublishing(true);
    try {
      await createPost({
        content: content.trim(),
        visibility: 'public',
        mediaFiles: mediaList.map(m => m.file),
        mediaLayout,
        folderId: selectedFolderId || null,
      });
      setContent('');
      setMediaList([]);
      setPreviewSlideIndex(0);
      setIsOpen(false);
      if (onPublished) onPublished();
    } finally {
      setIsPublishing(false);
    }
  };

  const safeSlide = Math.min(previewSlideIndex, Math.max(0, mediaList.length - 1));

  if (!isOpen) {
    return (
      <div
        onClick={() => setIsOpen(true)}
        className="bg-white hover:bg-[#F9F9FA] border border-[#E1E3E6] rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer transition-all shadow-xs group"
      >
        <div className="flex items-center gap-3 min-w-0">
          {profile?.avatarUrl && (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="w-9 h-9 rounded-full object-cover shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="text-sm text-[#818C99] group-hover:text-[#19191A] transition-colors">
              Что у вас нового?
            </div>
          </div>
        </div>

        <button
          type="button"
          className="px-3.5 py-1.5 rounded-lg bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138] text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#0077FF]" />
          <span>Запись</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3.5 shadow-xs text-[#19191A]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[#0077FF]/10 text-[#0077FF] flex items-center justify-center font-bold">
            <Plus className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm font-bold text-[#19191A]">Новая запись</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#818C99] hover:text-[#19191A] cursor-pointer"
          title="Свернуть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 1. Текст публикации */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Что у вас нового?..."
          rows={3}
          className="v7-input resize-none"
          autoFocus
        />

        {/* 2. Выбор папки профиля (или создание новой папки) */}
        <div className="bg-[#F7F8FA] border border-[#E1E3E6] rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#656565] flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-[#0077FF]" />
              <span>Папка профиля:</span>
            </span>

            <div className="flex items-center gap-2">
              <select
                value={selectedFolderId}
                onChange={e => setSelectedFolderId(e.target.value)}
                className="bg-white border border-[#E1E3E6] rounded-lg text-xs text-[#19191A] px-2.5 py-1.5 focus:outline-none focus:border-[#0077FF]"
              >
                <option value="">Без папки</option>
                {myProfileFolders.map(f => (
                  <option key={f.folderId} value={f.folderId}>
                    📁 {f.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#EDEFEF] border border-[#E1E3E6] text-xs font-semibold text-[#0077FF] flex items-center gap-1 cursor-pointer"
                title="Создать новую папку"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[#0077FF]" />
                <span>+ Папка</span>
              </button>
            </div>
          </div>

          {showNewFolderInput && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Название папки..."
                className="v7-input text-xs py-1.5"
              />
              <button
                type="button"
                onClick={handleQuickCreateFolder}
                className="px-3 py-1.5 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold cursor-pointer shrink-0"
              >
                Создать
              </button>
            </div>
          )}
        </div>

        {/* 3. Выбор режима отображения: Карусель или Сетка */}
        <div className="bg-[#F7F8FA] border border-[#E1E3E6] rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[#818C99]">
              Вложения: <strong className="text-[#19191A]">{mediaList.length} / 9</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMediaLayout('carousel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors ${
                  mediaLayout === 'carousel'
                    ? 'bg-[#0077FF] border-[#0077FF] text-white'
                    : 'bg-white border-[#E1E3E6] text-[#656565] hover:text-[#19191A]'
                }`}
              >
                <GalleryHorizontal className="w-3.5 h-3.5" />
                <span>Карусель</span>
              </button>

              <button
                type="button"
                onClick={() => setMediaLayout('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors ${
                  mediaLayout === 'grid'
                    ? 'bg-[#0077FF] border-[#0077FF] text-white'
                    : 'bg-white border-[#E1E3E6] text-[#656565] hover:text-[#19191A]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Сетка</span>
              </button>
            </div>
          </div>

          {/* Предпросмотр загруженных файлов: Карусель или Сетка */}
          {mediaList.length > 0 && (
            <div>
              {mediaLayout === 'carousel' ? (
                <div className="relative w-full h-64 rounded-xl overflow-hidden bg-[#EDEFEF] border border-[#E1E3E6]">
                  {mediaList[safeSlide]?.type === 'video' ? (
                    <video
                      key={mediaList[safeSlide].url}
                      src={mediaList[safeSlide].url}
                      controls
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <img
                      src={mediaList[safeSlide]?.url}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  )}

                  <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/65 text-[11px] font-medium text-white">
                    {safeSlide + 1} / {mediaList.length}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(safeSlide)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-[#E64646] hover:bg-red-600 text-white cursor-pointer"
                    title="Удалить"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {mediaList.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewSlideIndex(prev =>
                            prev <= 0 ? mediaList.length - 1 : prev - 1
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#19191A] flex items-center justify-center shadow-sm cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewSlideIndex(prev =>
                            prev >= mediaList.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#19191A] flex items-center justify-center shadow-sm cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaList.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-lg overflow-hidden bg-[#EDEFEF] border border-[#E1E3E6]"
                    >
                      {item.type === 'video' ? (
                        <video src={item.url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-[#E64646] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-medium text-white">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFilesSelected}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {mediaList.length < 9 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-[8px] bg-[#EDEFEF] hover:bg-[#E2E5E8] text-xs font-semibold text-[#2C3138] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Film className="w-4 h-4 text-[#0077FF] shrink-0" />
                <span>Прикрепить фото или видео</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={isPublishing || (!content.trim() && mediaList.length === 0)}
              className="px-4 py-2 rounded-[8px] bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              {isPublishing ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Send className="w-4 h-4 shrink-0" />
              )}
              <span>Опубликовать</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
