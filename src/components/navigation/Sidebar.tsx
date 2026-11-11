import React from 'react';
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
  User,
  Film,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, chats } = useChat();
  const { profile, privateData, lockSessionWithPin, logout } = useAuth();

  const navItems = [
    { id: 'my_page', tab: 'settings', section: 'profile', label: 'Моя страница', icon: User },
    { id: 'feed', tab: 'feed', label: 'Новости', icon: Newspaper },
    { id: 'video', tab: 'video', label: 'Mender Video', icon: Film },
    { id: 'chats', tab: 'chats', label: 'Мессенджер', icon: MessageSquare, count: chats.length },
    { id: 'calls', tab: 'calls', label: 'Звонки', icon: PhoneCall },
    { id: 'channels', tab: 'channels', label: 'Сообщества', icon: Users },
    { id: 'settings_prefs', tab: 'settings', section: 'settings', label: 'Настройки', icon: Settings },
  ];

  const handleNavClick = (item: (typeof navItems)[number]) => {
    setActiveTab(item.tab as any);
    if (item.section) {
      window.dispatchEvent(
        new CustomEvent('mender:profile-section', { detail: item.section })
      );
    }
  };

  return (
    <aside className="hidden md:flex w-[190px] lg:w-[210px] flex-col justify-between py-3 px-2 shrink-0 select-none h-full bg-[#EDEEF0] text-[#2C3138] border-r border-[#E1E3E6]">
      <div className="space-y-1 overflow-y-auto pr-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.tab && item.id !== 'settings_prefs';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[13px] transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-[#E5EBF1] text-[#0077FF] font-semibold'
                  : 'text-[#2C3138] hover:bg-[#E2E5E8] hover:text-[#000000]'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                {item.id === 'my_page' && profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#0077FF]' : 'text-[#818C99]'
                    }`}
                  />
                )}
                <span className="truncate">{item.label}</span>
              </span>

              {Boolean(item.count) && (
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-[#0077FF] text-white'
                      : 'bg-[#DCE1E6] text-[#656565]'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Разделитель и быстрые действия */}
        <div className="pt-2 mt-2 border-t border-[#DCE1E6] flex flex-col gap-1">
          {privateData?.pinHash && (
            <button
              type="button"
              onClick={lockSessionWithPin}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs text-[#818C99] hover:bg-[#E2E5E8] hover:text-[#19191A] transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Блокировка</span>
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs text-[#E64646] hover:bg-[#FFEAEA] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Выйти</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

