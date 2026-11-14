import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Plus, Newspaper, UserCheck, LayoutGrid } from 'lucide-react';
import { CreateGroupModal } from '../chats/CreateGroupModal';
import { CreateActionSheet } from './CreateActionSheet';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, activeChatId, activeChat, chats } = useChat();
  const { themeMode, privateData } = useAuth();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createChatModalType, setCreateChatModalType] = useState<
    'direct' | 'group' | 'channel' | null
  >(null);

  const isDarkMode = themeMode === 'dark' || Boolean(privateData?.darkMode);

  // Hide bottom bar when an individual chat is open on mobile so message composer gets full screen
  if (activeTab === 'chats' && activeChatId && activeChat) {
    return null;
  }

  const activeChatsCount = chats.filter(c => !c.isArchived).length;

  const isMenuSectionActive =
    activeTab === 'menu' ||
    activeTab === 'video' ||
    activeTab === 'music' ||
    activeTab === 'calls' ||
    activeTab === 'channels' ||
    activeTab === 'settings';

  return (
    <>
      <nav
        aria-label="Основная нижняя панель навигации"
        className={`md:hidden fixed bottom-0 left-0 right-0 min-h-[56px] pb-safe border-t grid grid-cols-5 items-center px-1 z-40 select-none transition-colors ${
          isDarkMode
            ? 'bg-[#191B1F]/95 backdrop-blur-md border-[#282B32] text-[#F2F4F8]'
            : 'bg-white/95 backdrop-blur-md border-[#E8EAED] text-[#18191C]'
        }`}
      >
        {/* 1. Чаты */}
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
            activeTab === 'chats'
              ? 'text-[#0077FF] font-semibold'
              : 'text-[#7B8494] hover:text-[#18191C]'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5 shrink-0" />
          <span className="text-[11px] leading-tight whitespace-nowrap tabular-nums">
            Чаты{activeChatsCount > 0 ? ` · ${activeChatsCount}` : ''}
          </span>
        </button>

        {/* 2. Люди */}
        <button
          type="button"
          onClick={() => setActiveTab('people')}
          className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
            activeTab === 'people'
              ? 'text-[#0077FF] font-semibold'
              : 'text-[#7B8494] hover:text-[#18191C]'
          }`}
        >
          <UserCheck className="w-5 h-5 mb-0.5 shrink-0" />
          <span className="text-[11px] leading-tight whitespace-nowrap">Люди</span>
        </button>

        {/* 3. Создать (+) */}
        <button
          type="button"
          onClick={() => setShowCreateSheet(true)}
          aria-label="Создать"
          className="flex flex-col items-center justify-center min-h-[48px] text-[#0077FF] font-semibold cursor-pointer active:scale-95 transition-transform"
        >
          <div className="w-9 h-9 rounded-xl bg-[#E5EBF1] text-[#0077FF] flex items-center justify-center">
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </div>
        </button>

        {/* 4. Новости */}
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
            activeTab === 'feed'
              ? 'text-[#0077FF] font-semibold'
              : 'text-[#7B8494] hover:text-[#18191C]'
          }`}
        >
          <Newspaper className="w-5 h-5 mb-0.5 shrink-0" />
          <span className="text-[11px] leading-tight whitespace-nowrap">Новости</span>
        </button>

        {/* 5. Меню */}
        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
            isMenuSectionActive
              ? 'text-[#0077FF] font-semibold'
              : 'text-[#7B8494] hover:text-[#18191C]'
          }`}
        >
          <LayoutGrid className="w-5 h-5 mb-0.5 shrink-0" />
          <span className="text-[11px] leading-tight whitespace-nowrap">Меню</span>
        </button>
      </nav>

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
