import React from 'react';
import {
  FileText,
  Film,
  Image as ImageIcon,
  Users,
  Radio,
  MessageSquarePlus,
  Music,
  X,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useVideo } from '../../context/VideoContext';
import { useMusic } from '../../context/MusicContext';
import { useAuth } from '../../context/AuthContext';

interface CreateActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateChatModal: (type: 'direct' | 'group' | 'channel') => void;
}

export const CreateActionSheet: React.FC<CreateActionSheetProps> = ({
  isOpen,
  onClose,
  onOpenCreateChatModal,
}) => {
  const { setActiveTab } = useChat();
  const { openUploadStudio } = useVideo();
  const { openUploadTrackStudio } = useMusic();
  const { themeMode, privateData } = useAuth();

  if (!isOpen) return null;

  const isDark = themeMode === 'dark' || Boolean(privateData?.darkMode);

  const handleWritePost = () => {
    try {
      sessionStorage.setItem('mender_open_composer', 'post');
    } catch {
      // ignore
    }
    setActiveTab('feed');
    onClose();
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('mender:open-composer', { detail: { mode: 'post' } })
      );
    }, 50);
  };

  const handleAddPhoto = () => {
    try {
      sessionStorage.setItem('mender_open_composer', 'photo');
    } catch {
      // ignore
    }
    setActiveTab('feed');
    onClose();
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('mender:open-composer', { detail: { mode: 'photo' } })
      );
    }, 50);
  };

  const handleUploadVideo = () => {
    setActiveTab('video');
    openUploadStudio();
    onClose();
  };

  const handleUploadMusic = () => {
    setActiveTab('music');
    openUploadTrackStudio();
    onClose();
  };

  const handleCreateGroup = () => {
    onClose();
    onOpenCreateChatModal('group');
  };

  const handleCreateChannel = () => {
    onClose();
    onOpenCreateChatModal('channel');
  };

  const handleStartDirectChat = () => {
    onClose();
    onOpenCreateChatModal('direct');
  };

  const creationActions = [
    {
      id: 'write_post',
      title: 'Написать публикацию',
      subtitle: 'Поделиться записью на стене и в ленте новостей',
      icon: FileText,
      iconBg: 'bg-[#0077FF]/12 text-[#0077FF]',
      onClick: handleWritePost,
    },
    {
      id: 'upload_video',
      title: 'Загрузить видео',
      subtitle: 'Опубликовать ролик в студии Mender Video или сохранить в черновики',
      icon: Film,
      iconBg: 'bg-[#E64646]/12 text-[#E64646]',
      onClick: handleUploadVideo,
    },
    {
      id: 'upload_music',
      title: 'Загрузить музыку',
      subtitle: 'Добавить аудиофайл и обложку в медиатеку Mender Music',
      icon: Music,
      iconBg: 'bg-[#8B5CF6]/12 text-[#8B5CF6]',
      onClick: handleUploadMusic,
    },
    {
      id: 'add_photo',
      title: 'Добавить фотографию',
      subtitle: 'Выбрать фото из галереи и опубликовать в ленте или папке профиля',
      icon: ImageIcon,
      iconBg: 'bg-[#2EA043]/12 text-[#2EA043]',
      onClick: handleAddPhoto,
    },
    {
      id: 'create_group',
      title: 'Создать группу',
      subtitle: 'Беседа для общения с друзьями, коллегами или сообществом',
      icon: Users,
      iconBg: 'bg-[#8B5CF6]/12 text-[#8B5CF6]',
      onClick: handleCreateGroup,
    },
    {
      id: 'create_channel',
      title: 'Создать канал',
      subtitle: 'Публичный или приватный канал для трансляции новостей подписчикам',
      icon: Radio,
      iconBg: 'bg-[#F59E0B]/12 text-[#F59E0B]',
      onClick: handleCreateChannel,
    },
    {
      id: 'new_direct',
      title: 'Новый диалог',
      subtitle: 'Найти собеседника по @username или email и начать личный чат',
      icon: MessageSquarePlus,
      iconBg: 'bg-[#06B6D4]/12 text-[#06B6D4]',
      onClick: handleStartDirectChat,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border overflow-hidden shadow-2xl transition-all duration-200 ${
          isDark
            ? 'bg-[#1F2023] border-[#323438] text-[#E1E3E6]'
            : 'bg-white border-[#E1E3E6] text-[#19191A]'
        }`}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <div
            className={`w-10 h-1.5 rounded-full ${
              isDark ? 'bg-[#3A3B3E]' : 'bg-[#D5D8DC]'
            }`}
          />
        </div>

        {/* Sheet Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between ${
            isDark ? 'border-[#2E3034]' : 'border-[#E1E3E6]'
          }`}
        >
          <div>
            <h3 className="text-base font-bold">Создать в Mender</h3>
            <p className="text-xs text-[#818C99]">
              Выберите действие для быстрой публикации или общения
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#2C2D30] text-[#A0A4AB] hover:text-white'
                : 'bg-[#F0F2F5] text-[#818C99] hover:text-[#19191A]'
            }`}
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Grid */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[75vh] overflow-y-auto pb-6 sm:pb-5">
          {creationActions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className={`flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
                  isDark
                    ? 'bg-[#26282C] hover:bg-[#2E3136] border-[#34363C]'
                    : 'bg-[#F7F8FA] hover:bg-[#EBF3FF]/60 border-[#E1E3E6] hover:border-[#0077FF]/40'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${action.iconBg}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-snug">{action.title}</div>
                  <div className="text-[11px] text-[#818C99] leading-relaxed mt-0.5 line-clamp-2">
                    {action.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
