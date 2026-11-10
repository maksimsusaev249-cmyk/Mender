import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Users, Plus, Newspaper, User } from 'lucide-react';
import { CreateGroupModal } from '../chats/CreateGroupModal';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab } = useChat();
  const { profile, privateData } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isDarkMode = privateData?.darkMode ?? false;

  return (
    <>
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 h-14 border-t flex items-center justify-around px-2 z-40 select-none transition-colors ${
          isDarkMode
            ? 'bg-[#242526] border-[#363738] text-[#E1E3E6]'
            : 'bg-white border-[#E1E3E6] text-[#2C3138] shadow-[0_-1px_2px_rgba(0,0,0,0.03)]'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'feed'
              ? 'text-[#0077FF] font-semibold'
              : isDarkMode
              ? 'text-[#828385]'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          <Newspaper className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Новости</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'chats'
              ? 'text-[#0077FF] font-semibold'
              : isDarkMode
              ? 'text-[#828385]'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Чаты</span>
        </button>

        {/* Center VK Blue + Button */}
        <div className="flex items-center justify-center px-1">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="w-10 h-10 -mt-3 rounded-full bg-[#0077FF] hover:bg-[#0066EA] text-white flex items-center justify-center shadow-md border-2 border-white cursor-pointer active:scale-95 transition-transform"
            title="Создать чат, группу или канал"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('channels')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'channels'
              ? 'text-[#0077FF] font-semibold'
              : isDarkMode
              ? 'text-[#828385]'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Сообщества</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'text-[#0077FF] font-semibold'
              : isDarkMode
              ? 'text-[#828385]'
              : 'text-[#818C99] hover:text-[#19191A]'
          }`}
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="w-5 h-5 rounded-full object-cover mb-0.5"
            />
          ) : (
            <User className="w-5 h-5 mb-0.5" />
          )}
          <span className="text-[10px] tracking-tight">Профиль</span>
        </button>
      </nav>

      {showCreateModal && (
        <CreateGroupModal defaultType="direct" onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
};

