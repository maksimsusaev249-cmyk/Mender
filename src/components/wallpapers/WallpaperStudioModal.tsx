import React, { useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  MENDER_WALLPAPERS,
  WALLPAPER_CATEGORIES,
  SOLID_WALLPAPER_COLORS,
  generateAiWallpaperFromPrompt,
} from '../../data/menderWallpapers';
import { WallpaperCategory, CustomWallpaper } from '../../types';
import {
  X,
  Sparkles,
  Upload,
  Check,
  Trash2,
  RotateCcw,
  Sliders,
  Image as ImageIcon,
  Palette,
  ZoomIn,
  Move,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Star,
  Loader2,
  Search,
} from 'lucide-react';

interface WallpaperStudioModalProps {
  onClose: () => void;
  targetChatId?: string | null;
  targetChatName?: string;
  initialTab?: 'recommended' | 'my' | 'ai';
}

export const WallpaperStudioModal: React.FC<WallpaperStudioModalProps> = ({
  onClose,
  targetChatId,
  targetChatName,
  initialTab = 'recommended',
}) => {
  const {
    wallpaperConfigs,
    customWallpapers,
    getEffectiveWallpaper,
    saveWallpaperConfig,
    resetWallpaperConfig,
    uploadCustomWallpaper,
    deleteCustomWallpaper,
  } = useChat();
  const { setThemeMode, setCustomThemeBgColor, setCustomThemeBgImage } = useAuth();

  const [scope, setScope] = useState<string>(targetChatId || 'global');
  const currentSaved = wallpaperConfigs[scope] || getEffectiveWallpaper(targetChatId);

  const [topTab, setTopTab] = useState<'recommended' | 'my' | 'ai'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<'all' | WallpaperCategory | 'custom'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const [wallpaperId, setWallpaperId] = useState<string>(
    currentSaved?.wallpaperId || MENDER_WALLPAPERS[0].id
  );
  const [sourceType, setSourceType] = useState<'builtin' | 'custom' | 'color'>(
    currentSaved?.sourceType || 'builtin'
  );
  const [imageUrl, setImageUrl] = useState<string>(
    currentSaved?.imageUrl || MENDER_WALLPAPERS[0].svgDataUrl
  );
  const [backgroundColor, setBackgroundColor] = useState<string>(
    currentSaved?.backgroundColor || '#080916'
  );

  const [dimming, setDimming] = useState<number>(currentSaved?.dimming ?? 40);
  const [brightness, setBrightness] = useState<number>(currentSaved?.brightness ?? 80);
  const [blur, setBlur] = useState<number>(currentSaved?.blur ?? 0);
  const [scale, setScale] = useState<number>(currentSaved?.scale ?? 100);
  const [posX, setPosX] = useState<number>(currentSaved?.posX ?? 0);
  const [posY, setPosY] = useState<number>(currentSaved?.posY ?? 0);

  // AI Prompt Generator State
  const [aiPrompt, setAiPrompt] = useState('Космос и фиолетовые облака');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Upload & Crop state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [cropZoom, setCropZoom] = useState<number>(100);
  const [cropOffsetX, setCropOffsetX] = useState<number>(0);
  const [cropOffsetY, setCropOffsetY] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredBuiltin = MENDER_WALLPAPERS.filter(w => {
    const matchesCat = selectedCategory === 'all' || selectedCategory === 'custom' ? true : w.category === selectedCategory;
    const matchesSearch = !searchFilter.trim() || w.name.toLowerCase().includes(searchFilter.trim().toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSelectBuiltin = (wp: (typeof MENDER_WALLPAPERS)[0]) => {
    setWallpaperId(wp.id);
    setSourceType('builtin');
    setImageUrl(wp.svgDataUrl);
    setErrorMsg(null);
  };

  const handleSelectCustom = (cwp: CustomWallpaper) => {
    setWallpaperId(cwp.wallpaperId);
    setSourceType('custom');
    setImageUrl(cwp.imageUrl);
    setErrorMsg(null);
  };

  const handleSelectSolidColor = (colorObj: (typeof SOLID_WALLPAPER_COLORS)[0]) => {
    setWallpaperId(colorObj.id);
    setSourceType('color');
    setImageUrl('');
    setBackgroundColor(colorObj.hex);
    setErrorMsg(null);
  };

  const handleGenerateAiWallpaper = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isGeneratingAi) return;
    setErrorMsg(null);
    setIsGeneratingAi(true);
    try {
      const generated = await generateAiWallpaperFromPrompt(aiPrompt);
      const savedCustom = await uploadCustomWallpaper(
        generated.blob,
        generated.title,
        pct => setUploadProgress(pct)
      );
      setUploadProgress(null);
      setWallpaperId(savedCustom.wallpaperId);
      setSourceType('custom');
      setImageUrl(savedCustom.imageUrl);
      setStatusMessage(`Уникальный ИИ-фон «${generated.title}» создан и сохранён в облаке!`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      setUploadProgress(null);
      setErrorMsg(err?.message || 'Ошибка генерации ИИ-фона');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Пожалуйста, выберите изображение в формате JPG, PNG или WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Размер файла не должен превышать 10 МБ.');
      return;
    }

    const url = URL.createObjectURL(file);
    setPendingUploadFile(file);
    setPendingPreviewUrl(url);
    setCustomName(file.name.replace(/\.[^/.]+$/, '').slice(0, 40) || 'Мои обои');
    setCropZoom(100);
    setCropOffsetX(0);
    setCropOffsetY(0);
  };

  const handleConfirmUpload = async () => {
    if (!pendingUploadFile || !pendingPreviewUrl) return;
    setErrorMsg(null);
    setUploadProgress(1);

    try {
      const croppedBlob = await renderCroppedWallpaperBlob(
        pendingPreviewUrl,
        cropZoom,
        cropOffsetX,
        cropOffsetY
      );

      const savedCustom = await uploadCustomWallpaper(
        croppedBlob,
        customName || 'Пользовательский фон',
        pct => setUploadProgress(pct)
      );

      URL.revokeObjectURL(pendingPreviewUrl);
      setPendingUploadFile(null);
      setPendingPreviewUrl(null);
      setUploadProgress(null);

      setWallpaperId(savedCustom.wallpaperId);
      setSourceType('custom');
      setImageUrl(savedCustom.imageUrl);
      setTopTab('my');
      setStatusMessage('Собственный фон загружен и готов к установке');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setUploadProgress(null);
      setErrorMsg(err?.message || 'Ошибка при загрузке пользовательского фона');
    }
  };

  const handleApplyWallpaper = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await saveWallpaperConfig(scope, {
        wallpaperId,
        sourceType,
        imageUrl: sourceType === 'color' ? '' : imageUrl,
        backgroundColor,
        dimming,
        brightness,
        blur,
        scale,
        posX,
        posY,
      });
      setStatusMessage(
        scope === 'global'
          ? 'Обои успешно установлены для всех чатов!'
          : `Обои установлены для чата «${targetChatName || 'Чат'}»!`
      );
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось сохранить настройки фона');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await resetWallpaperConfig(scope);
      setWallpaperId(MENDER_WALLPAPERS[0].id);
      setSourceType('builtin');
      setImageUrl(MENDER_WALLPAPERS[0].svgDataUrl);
      setBackgroundColor('#080916');
      setDimming(25);
      setBrightness(100);
      setBlur(0);
      setScale(100);
      setPosX(0);
      setPosY(0);
      setStatusMessage('Возвращены стандартные обои Mender');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось сбросить обои');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 z-50 select-none">
      <div className="w-full max-w-6xl bg-white border border-[#E1E3E6] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#19191A]">
        
        {/* Top Modal Header */}
        <div className="px-4 md:px-5 py-3 border-b border-[#E1E3E6] flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-bold tracking-tight text-[#19191A]">
                  Фоны чатов
                </h2>
                <span className="text-[11px] font-medium text-[#0077FF] bg-[#0077FF]/10 px-2.5 py-0.5 rounded-full shrink-0">
                  Оформление
                </span>
              </div>
              <p className="text-xs text-[#818C99] truncate sm:whitespace-normal">
                Рекомендуемые обои, загрузка своих картинок и настройка яркости
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search input */}
            <div className="hidden md:flex items-center gap-2 bg-[#F2F3F5] border border-[#E1E3E6] rounded-xl px-3 py-1.5">
              <Search className="w-4 h-4 text-[#818C99]" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Поиск обоев..."
                className="bg-transparent text-xs text-[#19191A] placeholder-[#818C99] focus:outline-none w-36"
              />
            </div>

            {targetChatId && (
              <div className="hidden sm:flex bg-[#F2F3F5] p-1 rounded-xl border border-[#E1E3E6]">
                <button
                  type="button"
                  onClick={() => setScope(targetChatId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    scope === targetChatId
                      ? 'bg-[#0077FF] text-white shadow-xs'
                      : 'text-[#818C99] hover:text-[#19191A]'
                  }`}
                >
                  Только «{targetChatName?.slice(0, 16) || 'Этот чат'}»
                </button>
                <button
                  type="button"
                  onClick={() => setScope('global')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    scope === 'global'
                      ? 'bg-[#0077FF] text-white shadow-xs'
                      : 'text-[#818C99] hover:text-[#19191A]'
                  }`}
                >
                  Для всех чатов
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#F2F3F5] transition-colors cursor-pointer shrink-0"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Two-Column Content */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E1E3E6]">
          
          {/* Left Column: 3 Tabs (Рекомендуемые | Мои | ИИ), Cards Grid & AI Prompt Box (7 cols) */}
          <div className="lg:col-span-7 p-4 md:p-5 space-y-5 shrink-0 lg:shrink lg:min-h-0 lg:overflow-y-auto">
            
            {/* Primary 3 Tabs: Рекомендуемые | Мои | ИИ */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#F0F2F5] p-1 rounded-xl border border-[#E1E3E6]">
                <button
                  type="button"
                  onClick={() => {
                    setTopTab('recommended');
                    setSelectedCategory('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    topTab === 'recommended'
                      ? 'bg-[#0077FF] text-white shadow-xs'
                      : 'text-[#818C99] hover:text-[#19191A]'
                  }`}
                >
                  Рекомендуемые
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTopTab('my');
                    setSelectedCategory('custom');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    topTab === 'my'
                      ? 'bg-[#0077FF] text-white shadow-xs'
                      : 'text-[#818C99] hover:text-[#19191A]'
                  }`}
                >
                  Мои {customWallpapers.length > 0 ? `(${customWallpapers.length})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setTopTab('ai')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    topTab === 'ai'
                      ? 'bg-[#0077FF] text-white shadow-xs'
                      : 'text-[#818C99] hover:text-[#19191A]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0077FF]" />
                  <span>ИИ</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138] text-xs font-semibold transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#0077FF]" />
                <span>Загрузить своё фото</span>
              </button>
            </div>

            {/* AI Prompt Card */}
            <div className="bg-[#F7F8FA] border border-[#E1E3E6] rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0077FF] flex items-center justify-center text-white shadow-xs shrink-0">
                  <Star className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#19191A]">
                    Создай уникальный фон с помощью ИИ!
                  </h3>
                  <p className="text-xs text-[#818C99]">
                    Опишите атмосферу, и Mender сгенерирует и сохранит обои в вашу коллекцию
                  </p>
                </div>
              </div>

              <form onSubmit={handleGenerateAiWallpaper} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Например: «Космос и фиолетовые облака»"
                    className="w-full bg-white border border-[#DCE1E6] rounded-xl py-2.5 pl-3.5 pr-12 text-xs text-[#19191A] placeholder-[#818C99] focus:outline-none focus:border-[#0077FF]"
                  />
                  <button
                    type="submit"
                    disabled={isGeneratingAi}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
                    title="Сгенерировать фон"
                  >
                    {isGeneratingAi ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </form>

              {/* Quick AI Prompt Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {[
                  'Космос и фиолетовые облака',
                  'Закат и океан',
                  'Цветущая сакура',
                  'Ледяные горы и сияние',
                  'Изумрудная аврора',
                ].map(presetPrompt => (
                  <button
                    key={presetPrompt}
                    type="button"
                    onClick={() => setAiPrompt(presetPrompt)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EDEFEF] border border-[#E1E3E6] text-[11px] text-[#2C3138] whitespace-nowrap cursor-pointer transition-colors"
                  >
                    «{presetPrompt}»
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Crop / Zoom / Position Editor when a file is chosen */}
            {pendingUploadFile && pendingPreviewUrl && (
              <div className="bg-[#F7F8FA] border border-[#0077FF]/40 rounded-2xl p-4 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#0077FF] flex items-center gap-2">
                    <Move className="w-4 h-4" />
                    <span>Кадрирование и позиционирование перед загрузкой</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(pendingPreviewUrl);
                      setPendingUploadFile(null);
                      setPendingPreviewUrl(null);
                    }}
                    className="text-xs text-[#818C99] hover:text-[#19191A] cursor-pointer"
                  >
                    Отменить
                  </button>
                </div>

                <div className="relative h-48 w-full rounded-xl overflow-hidden bg-[#EDEFEF] border border-[#E1E3E6]">
                  <img
                    src={pendingPreviewUrl}
                    alt="Crop preview"
                    className="w-full h-full object-cover transition-transform duration-75"
                    style={{
                      transform: `scale(${cropZoom / 100}) translate(${cropOffsetX}%, ${cropOffsetY}%)`,
                    }}
                  />
                  <div className="absolute inset-0 pointer-events-none border-2 border-[#0077FF]/40 rounded-xl" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="flex justify-between text-[#656565] mb-1">
                      <span>Масштаб</span>
                      <span className="font-mono text-[#0077FF]">{cropZoom}%</span>
                    </label>
                    <input
                      type="range"
                      min={100}
                      max={250}
                      value={cropZoom}
                      onChange={e => setCropZoom(Number(e.target.value))}
                      className="w-full accent-[#0077FF]"
                    />
                  </div>
                  <div>
                    <label className="flex justify-between text-[#656565] mb-1">
                      <span>Горизонталь (X)</span>
                      <span className="font-mono text-[#0077FF]">{cropOffsetX}%</span>
                    </label>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={cropOffsetX}
                      onChange={e => setCropOffsetX(Number(e.target.value))}
                      className="w-full accent-[#0077FF]"
                    />
                  </div>
                  <div>
                    <label className="flex justify-between text-[#656565] mb-1">
                      <span>Вертикаль (Y)</span>
                      <span className="font-mono text-[#0077FF]">{cropOffsetY}%</span>
                    </label>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={cropOffsetY}
                      onChange={e => setCropOffsetY(Number(e.target.value))}
                      className="w-full accent-[#0077FF]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Название обоев..."
                    className="flex-1 bg-white border border-[#DCE1E6] rounded-xl px-3 py-2 text-xs text-[#19191A] focus:outline-none focus:border-[#0077FF]"
                  />
                  <button
                    type="button"
                    disabled={uploadProgress !== null}
                    onClick={handleConfirmUpload}
                    className="px-4 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {uploadProgress !== null ? `Загрузка ${uploadProgress}%...` : 'Сохранить в Мои обои'}
                  </button>
                </div>
              </div>
            )}

            {/* Category Sub-Filter Tabs when in Recommended */}
            {topTab === 'recommended' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {WALLPAPER_CATEGORIES.filter(c => c.id !== 'custom').map(cat => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#0077FF] text-white shadow-xs'
                          : 'bg-[#F0F2F5] text-[#656565] hover:text-[#19191A] hover:bg-[#E5E7EB]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Wallpaper Cards Grid */}
            {topTab === 'my' ? (
              <div className="space-y-3">
                {customWallpapers.length === 0 ? (
                  <div className="text-center py-12 bg-[#F7F8FA] rounded-2xl border border-[#E1E3E6] p-6">
                    <ImageIcon className="w-10 h-10 text-[#0077FF]/60 mx-auto mb-2" />
                    <p className="text-sm font-medium text-[#19191A]">У вас пока нет собственных или ИИ-обоев</p>
                    <p className="text-xs text-[#818C99] mt-1">
                      Загрузите фото с устройства или создайте уникальный фон через ИИ-генератор выше!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3.5">
                    {customWallpapers.map(cwp => {
                      const isSelected = wallpaperId === cwp.wallpaperId && sourceType === 'custom';
                      return (
                        <div
                          key={cwp.wallpaperId}
                          onClick={() => handleSelectCustom(cwp)}
                          className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer aspect-[3/4] ${
                            isSelected
                              ? 'border-[#0077FF] ring-2 ring-[#0077FF]/30 shadow-md'
                              : 'border-[#E1E3E6] hover:border-[#0077FF]/60'
                          }`}
                        >
                          <img
                            src={cwp.imageUrl}
                            alt={cwp.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex flex-col justify-end p-2.5">
                            <span className="text-[11px] font-semibold text-white truncate">{cwp.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              deleteCustomWallpaper(cwp);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-[#E64646] text-white transition-colors cursor-pointer"
                            title="Удалить обои"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {isSelected && (
                            <div className="absolute bottom-2.5 right-2.5 w-6 h-6 rounded-full bg-white text-[#0077FF] flex items-center justify-center shadow-md">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3.5">
                {filteredBuiltin.map(wp => {
                  const isSelected = wallpaperId === wp.id && sourceType === 'builtin';
                  return (
                    <div
                      key={wp.id}
                      onClick={() => handleSelectBuiltin(wp)}
                      className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer aspect-[3/4] ${
                        isSelected
                          ? 'border-[#0077FF] ring-2 ring-[#0077FF]/30 shadow-md'
                          : 'border-[#E1E3E6] hover:border-[#0077FF]/60'
                      }`}
                    >
                      <img
                        src={wp.svgDataUrl}
                        alt={wp.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent flex flex-col justify-end p-3">
                        <span className="text-xs font-bold text-white leading-tight">{wp.name}</span>
                        <span className="text-[10px] text-white/80 truncate mt-0.5">{wp.subtitle}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute bottom-2.5 right-2.5 w-6 h-6 rounded-full bg-white text-[#0077FF] flex items-center justify-center shadow-md">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Solid Background Color Picker Row */}
            <div className="pt-2 border-t border-[#E1E3E6]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-[#656565] flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#0077FF]" />
                  <span>Чистый цвет фона или подложка</span>
                </span>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={e => {
                    setBackgroundColor(e.target.value);
                    setSourceType('color');
                    setWallpaperId('custom_solid_color');
                    setImageUrl('');
                  }}
                  className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-[#DCE1E6]"
                  title="Выбрать произвольный цвет"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {SOLID_WALLPAPER_COLORS.map(c => {
                  const isSelected = sourceType === 'color' && backgroundColor === c.hex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectSolidColor(c)}
                      className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0077FF] ring-2 ring-[#0077FF]/30 text-white'
                          : 'border-[#DCE1E6] text-white hover:border-[#0077FF]'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white/80" />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Live Chat Preview, "Установить фон", "Настройки фона" & "Сбросить" (5 cols) */}
          <div className="lg:col-span-5 p-4 md:p-5 flex flex-col justify-between bg-[#F7F8FA] space-y-4 shrink-0 lg:shrink lg:min-h-0 lg:overflow-y-auto">
            
            {/* Real Live Preview Container */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#656565]">
                  Предпросмотр чата Mender
                </span>
                <span className="text-[11px] text-[#0077FF] font-semibold">
                  {scope === 'global' ? 'Все чаты' : `Чат: ${targetChatName || 'Выбранный'}`}
                </span>
              </div>

              <div
                className="relative h-60 w-full rounded-2xl overflow-hidden border border-[#E1E3E6] shadow-inner flex flex-col justify-between p-4"
                style={{ backgroundColor }}
              >
                {sourceType !== 'color' && imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Live wallpaper preview"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-all duration-150"
                    style={{
                      filter: `brightness(${brightness}%) blur(${blur}px)`,
                      transform: `scale(${scale / 100}) translate(${posX}%, ${posY}%)`,
                    }}
                  />
                )}

                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-150"
                  style={{
                    backgroundColor: '#050611',
                    opacity: dimming / 100,
                  }}
                />

                <div className="relative z-10 flex items-center justify-between bg-white/95 px-3 py-2 rounded-xl border border-[#E1E3E6] shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#0077FF] flex items-center justify-center text-white text-[10px] font-bold">
                      {targetChatName?.charAt(0) || 'А'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#19191A] leading-none">
                        {targetChatName || 'Аня'}
                      </p>
                      <p className="text-[10px] text-[#4BB34B] font-medium mt-0.5">в сети</p>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 space-y-2 my-auto py-2">
                  <div className="max-w-[75%] ml-auto bg-[#CCE4FF] border border-[#B8D7FC] text-[#000000] rounded-[14px] rounded-br-[2px] px-3.5 py-2 text-xs shadow-xs">
                    <p>Привет! ✨</p>
                    <span className="block text-[9px] text-[#528FCC] text-right mt-0.5 font-mono">21:40 ✓✓</span>
                  </div>

                  <div className="max-w-[75%] bg-white border border-[#E1E3E6] text-[#19191A] rounded-[14px] rounded-bl-[2px] px-3.5 py-2 text-xs shadow-xs">
                    <p>Как дела? 😉</p>
                    <span className="block text-[9px] text-[#818C99] text-right mt-0.5 font-mono">21:41 ✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Buttons: "Установить фон чатов" & "Установить на весь интерфейс (Свой)" */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleApplyWallpaper}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{isSaving ? 'Сохранение...' : 'Установить фон для чатов'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (sourceType === 'color') {
                    setCustomThemeBgImage('');
                    setCustomThemeBgColor(backgroundColor);
                  } else {
                    setCustomThemeBgImage(imageUrl);
                    setCustomThemeBgColor(backgroundColor || '#1E293B');
                  }
                  setThemeMode('custom');
                  setStatusMessage('Этот фон установлен как «Свой вариант» на весь интерфейс Mender!');
                  setTimeout(() => {
                    setStatusMessage(null);
                    onClose();
                  }, 900);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#EDEFEF] hover:bg-[#E2E5E8] text-[#19191A] text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-[#E1E3E6]"
              >
                <Palette className="w-4 h-4 text-[#0077FF]" />
                <span>Установить на весь интерфейс (тема «Свой»)</span>
              </button>
            </div>

            {/* "Настройки фона" Sliders */}
            <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3.5 text-[#19191A] shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#19191A] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0077FF]" />
                  <span>Настройки фона</span>
                </h4>
                <span className="text-[11px] text-[#0077FF] font-mono flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" /> {scale}%
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="flex justify-between text-[#19191A] mb-1 font-medium">
                    <span>Затемнение</span>
                    <span className="font-mono text-[#0077FF]">{dimming}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={85}
                    value={dimming}
                    onChange={e => setDimming(Number(e.target.value))}
                    className="w-full accent-[#0077FF]"
                  />
                </div>

                <div>
                  <label className="flex justify-between text-[#19191A] mb-1 font-medium">
                    <span>Размытие</span>
                    <span className="font-mono text-[#0077FF]">{blur}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    value={blur}
                    onChange={e => setBlur(Number(e.target.value))}
                    className="w-full accent-[#0077FF]"
                  />
                </div>

                <div>
                  <label className="flex justify-between text-[#19191A] mb-1 font-medium">
                    <span>Яркость</span>
                    <span className="font-mono text-[#0077FF]">{brightness}%</span>
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={150}
                    value={brightness}
                    onChange={e => setBrightness(Number(e.target.value))}
                    className="w-full accent-[#0077FF]"
                  />
                </div>

                <div>
                  <label className="flex justify-between text-[#19191A] mb-1 font-medium">
                    <span>Масштаб</span>
                    <span className="font-mono text-[#0077FF]">{scale}%</span>
                  </label>
                  <input
                    type="range"
                    min={100}
                    max={220}
                    value={scale}
                    onChange={e => setScale(Number(e.target.value))}
                    className="w-full accent-[#0077FF]"
                  />
                </div>
              </div>

              {/* "Сбросить" button at the bottom of Настройки фона */}
              <button
                type="button"
                disabled={isSaving}
                onClick={handleResetToDefault}
                className="w-full py-2.5 rounded-xl bg-[#EDEFEF] hover:bg-[#E2E5E8] text-[#2C3138] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#0077FF]" />
                <span>Сбросить</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#FFEAEA] border border-[#FFCCCC] text-[#E64646] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 rounded-xl bg-[#E8F9E8] border border-[#C8E6C9] text-[#2E7D32] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
};

async function renderCroppedWallpaperBlob(
  imageSrc: string,
  zoomPct: number,
  offsetXPct: number,
  offsetYPct: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetWidth = 1280;
      const targetHeight = 800;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const scaleFactor = zoomPct / 100;
      const baseScale = Math.max(targetWidth / img.width, targetHeight / img.height);
      const drawW = img.width * baseScale * scaleFactor;
      const drawH = img.height * baseScale * scaleFactor;

      const centerX = targetWidth / 2 + (offsetXPct / 100) * (targetWidth * 0.5);
      const centerY = targetHeight / 2 + (offsetYPct / 100) * (targetHeight * 0.5);

      ctx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);

      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to encode cropped wallpaper'));
        },
        'image/jpeg',
        0.86
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = imageSrc;
  });
}
