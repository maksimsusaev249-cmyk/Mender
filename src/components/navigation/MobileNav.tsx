import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Plus, Newspaper, User, LayoutGrid } from 'lucide-react';
import { CreateGroupModal } from '../chats/CreateGroupModal';
import { CreateActionSheet } from './CreateActionSheet';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, chats } = useChat();
  const { profile, themeMode, privateData } = useAuth();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createChatModalType, setCreateChatModalType] = useState<
    'direct' | 'group' | 'channel' | null
  >(null);

  const isDarkMode = themeMode === 'dark' || Boolean(privateData?.darkMode);

  // Secondary sections opened from Menu keep the Menu button highlighted
  const isMenuSectionActive =
    activeTab === 'menu' ||
    activeTab === 'video' ||
    activeTab === 'music' ||
    activeTab === 'calls' ||
    activeTab === 'channels';

  const handleOpenProfile = () => {
    setActiveTab('settings');
    window.dispatchEvent(
      new CustomEvent('mender:profile-section', { detail: 'profile' })
    );
  };

  return (
    <>
      <nav
        aria-label="Основная нижняя панель навигации"
        className={`md:hidden fixed bottom-0 left-0 right-0 h-[58px] border-t grid grid-cols-5 items-center px-1 z-40 select-none transition-colors ${
          isDarkMode
            ? 'bg-[#1F2023]/95 backdrop-blur-md border-[#323438] text-[#E1E3E6]'
            : 'bg-white/95 backdrop-blur-md border-[#E1E3E6] text-[#2C3138] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]'
        }`}
      >
        {/* 1. Новости */}
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer relative ${
            activeTab === 'feed'
              ? 'text-[#0077FF] font-bold'
              : isDarkMode
              ? 'text-[#8E9299] hover:text-white'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          <Newspaper className="w-5 h-5 mb-0.5 shrink-0" />
          <span className="text-[11px] leading-tight tracking-tight whitespace-nowrap">
            Новости
          </span>
          {activeTab === 'feed' && (
            <span className="absolute top-0 w-7 h-0.5 rounded-b-full bg-[#0077FF]" />
          )}
        </button>

        {/* 2. Чаты */}
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer relative ${
            activeTab === 'chats'
              ? 'text-[#0077FF] font-bold'
              : isDarkMode
              ? 'text-[#8E9299] hover:text-white'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 mb-0.5 shrink-0" />
            {chats.length > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#0077FF] text-white text-[9px] font-bold flex items-center justify-center">
                {chats.length > 99 ? '99+' : chats.length}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-tight tracking-tight whitespace-nowrap">
            Чаты
          </span>
          {activeTab === 'chats' && (
            <span className="absolute top-0 w-7 h-0.5 rounded-b-full bg-[#0077FF]" />
          )}
        </button>

        {/* 3. Создать (+) — большая центральная круглая кнопка */}
        <div className="flex flex-col items-center justify-center h-full">
          <button
            type="button"
            onClick={() => setShowCreateSheet(true)}
            aria-label="Создать"
            title="Создать публикацию, видео, фото, группу или канал"
            className={`w-12 h-12 -mt-4 rounded-full bg-[#0077FF] hover:bg-[#0066EA] text-white flex items-center justify-center shadow-lg shadow-[#0077FF]/30 border-[3px] cursor-pointer active:scale-95 transition-all ${
              isDarkMode ? 'border-[#1F2023]' : 'border-white'
            }`}
          >
            <Plus className="w-6 h-6 stroke-[2.6]" />
          </button>
          <span
            onClick={() => setShowCreateSheet(true)}
            className={`text-[10px] leading-tight tracking-tight font-semibold mt-0.5 whitespace-nowrap cursor-pointer ${
              showCreateSheet
                ? 'text-[#0077FF]'
                : isDarkMode
                ? 'text-[#8E9299]'
                : 'text-[#818C99]'
            }`}
          >
            Создать
          </span>
        </div>

        {/* 4. Меню */}
        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer relative ${
            isMenuSectionActive
              ? 'text-[#0077FF] font-bold'
              : isDarkMode
              ? 'text-[#8E9299] hover:text-white'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          <LayoutGrid className="w-5 h-5 mb-0.5 shrink-0" />
          <span className="text-[11px] leading-tight tracking-tight whitespace-nowrap">
            Меню
          </span>
          {isMenuSectionActive && (
            <span className="absolute top-0 w-7 h-0.5 rounded-b-full bg-[#0077FF]" />
          )}
        </button>

        {/* 5. Профиль */}
        <button
          type="button"
          onClick={handleOpenProfile}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer relative ${
            activeTab === 'settings'
              ? 'text-[#0077FF] font-bold'
              : isDarkMode
              ? 'text-[#8E9299] hover:text-white'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName || 'Профиль'}
              className={`w-5 h-5 rounded-full object-cover mb-0.5 border ${
                activeTab === 'settings' ? 'border-[#0077FF] ring-1 ring-[#0077FF]' : 'border-transparent'
              }`}
            />
          ) : (
            <User className="w-5 h-5 mb-0.5 shrink-0" />
          )}
          <span className="text-[11px] leading-tight tracking-tight whitespace-nowrap">
            Профиль
          </span>
          {activeTab === 'settings' && (
            <span className="absolute top-0 w-7 h-0.5 rounded-b-full bg-[#0077FF]" />
          )}
        </button>
      </nav>

      {/* Меню создания по нажатию на центральную кнопку (+) */}
      <CreateActionSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onOpenCreateChatModal={type => setCreateChatModalType(type)}
      />

      {createChatModalType && (
        <CreateGroupModal
          defaultType={createChatModalType}
          onClose={() => setCreateChatModalType(null)}
        />
      )}
    </>
  );
};


