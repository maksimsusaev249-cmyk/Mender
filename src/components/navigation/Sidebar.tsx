import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  MessageSquare,
  Newspaper,
  Users,
  PhoneCall,
  Settings,
  LogOut,
  Lock,
  Film,
  Music,
  LayoutGrid,
  Plus,
  UserCheck,
} from 'lucide-react';
import { APP_VERSION_FULL } from '../../version';
import { CreateActionSheet } from './CreateActionSheet';
import { CreateGroupModal } from '../chats/CreateGroupModal';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, chats } = useChat();
  const { privateData, lockSessionWithPin, logout } = useAuth();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createChatModalType, setCreateChatModalType] = useState<
    'direct' | 'group' | 'channel' | null
  >(null);

  const activeChatsCount = chats.filter(c => !c.isArchived).length;

  const navItems = [
    { id: 'chats', tab: 'chats', label: 'Чаты', icon: MessageSquare, count: activeChatsCount },
    { id: 'people', tab: 'people', label: 'Люди', icon: UserCheck },
    { id: 'feed', tab: 'feed', label: 'Новости', icon: Newspaper },
    { id: 'video', tab: 'video', label: 'Видео', icon: Film },
    { id: 'music', tab: 'music', label: 'Музыка', icon: Music },
    { id: 'channels', tab: 'channels', label: 'Сообщества', icon: Users },
    { id: 'calls', tab: 'calls', label: 'Звонки', icon: PhoneCall },
    { id: 'menu', tab: 'menu', label: 'Все разделы', icon: LayoutGrid },
  ];

  const handleNavClick = (tab: string, section?: string) => {
    setActiveTab(tab as any);
    if (section) {
      window.dispatchEvent(
        new CustomEvent('mender:profile-section', { detail: section })
      );
    }
  };

  return (
    <>
      <aside className="hidden md:flex w-[208px] lg:w-[224px] flex-col justify-between py-3.5 px-3 shrink-0 select-none h-full bg-white text-[#18191C] border-r border-[#E8EAED]">
        <div className="space-y-1 overflow-y-auto no-scrollbar">
          {/* Primary Navigation */}
          <nav aria-label="Разделы Mender" className="space-y-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.tab)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#E5EBF1] text-[#0077FF] font-semibold'
                      : 'text-[#2C3138] hover:bg-[#F2F4F7] hover:text-[#18191C] font-medium'
                  }`}
                >
                  <span className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 ${
                        isActive ? 'text-[#0077FF]' : 'text-[#7B8494]'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </span>

                  {Boolean(item.count) && (
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        isActive ? 'text-[#0077FF]' : 'text-[#7B8494]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Clean Create Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowCreateSheet(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F6F7F9] hover:bg-[#EDEFEF] text-[#0077FF] text-[13.5px] font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-[18px] h-[18px] shrink-0" />
              <span className="whitespace-nowrap">Создать</span>
            </button>
          </div>
        </div>

        {/* Quiet Bottom Utility Area */}
        <div className="pt-3 border-t border-[#E8EAED] space-y-1">
          <button
            type="button"
            onClick={() => handleNavClick('settings', 'settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors cursor-pointer text-left ${
              activeTab === 'settings'
                ? 'bg-[#E5EBF1] text-[#0077FF] font-semibold'
                : 'text-[#2C3138] hover:bg-[#F2F4F7] font-medium'
            }`}
          >
            <Settings
              className={`w-[18px] h-[18px] shrink-0 ${
                activeTab === 'settings' ? 'text-[#0077FF]' : 'text-[#7B8494]'
              }`}
            />
            <span className="whitespace-nowrap">Настройки</span>
          </button>

          <div className="flex items-center justify-between px-3 pt-1">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('mender:open-versions'))}
              className="text-[11px] text-[#7B8494] hover:text-[#0077FF] transition-colors cursor-pointer whitespace-nowrap"
              title="История обновлений Mender"
            >
              {APP_VERSION_FULL}
            </button>

            <div className="flex items-center gap-1">
              {privateData?.pinHash && (
                <button
                  type="button"
                  onClick={lockSessionWithPin}
                  className="p-1.5 rounded-lg text-[#7B8494] hover:text-[#18191C] hover:bg-[#F2F4F7] transition-colors cursor-pointer"
                  title="Заблокировать PIN-кодом"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-lg text-[#7B8494] hover:text-[#E64646] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                title="Выйти из аккаунта"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

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
