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
  User,
  Film,
  Music,
  LayoutGrid,
  Plus,
} from 'lucide-react';
import { APP_VERSION_FULL, APP_BUILD_NUMBER } from '../../version';
import { CreateActionSheet } from './CreateActionSheet';
import { CreateGroupModal } from '../chats/CreateGroupModal';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, chats } = useChat();
  const { profile, privateData, lockSessionWithPin, logout } = useAuth();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createChatModalType, setCreateChatModalType] = useState<
    'direct' | 'group' | 'channel' | null
  >(null);

  const mainNavItems = [
    { id: 'feed', tab: 'feed', label: 'Новости', icon: Newspaper },
    { id: 'chats', tab: 'chats', label: 'Чаты', icon: MessageSquare, count: chats.length },
    { id: 'menu', tab: 'menu', label: 'Меню (Все разделы)', icon: LayoutGrid },
    { id: 'my_page', tab: 'settings', section: 'profile', label: 'Профиль', icon: User },
  ];

  const extraNavItems = [
    { id: 'video', tab: 'video', label: 'Mender Video', icon: Film },
    { id: 'music', tab: 'music', label: 'Mender Music', icon: Music },
    { id: 'channels', tab: 'channels', label: 'Сообщества и каналы', icon: Users },
    { id: 'calls', tab: 'calls', label: 'Звонки', icon: PhoneCall },
    { id: 'settings_prefs', tab: 'settings', section: 'settings', label: 'Настройки', icon: Settings },
  ];

  const handleNavClick = (item: { id: string; tab: string; section?: string }) => {
    setActiveTab(item.tab as any);
    if (item.section) {
      window.dispatchEvent(
        new CustomEvent('mender:profile-section', { detail: item.section })
      );
    }
  };

  return (
    <>
      <aside className="hidden md:flex w-[195px] lg:w-[215px] flex-col justify-between py-3 px-2.5 shrink-0 select-none h-full bg-[#EDEEF0] text-[#2C3138] border-r border-[#E1E3E6]">
        <div className="space-y-1.5 overflow-y-auto pr-0.5">
          {/* Кнопка Создать (+) для ПК и планшетов */}
          <button
            type="button"
            onClick={() => setShowCreateSheet(true)}
            className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Создать</span>
          </button>

          {/* Основные разделы */}
          <div className="space-y-0.5">
            {mainNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[9px] text-[13px] transition-colors cursor-pointer text-left ${
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
          </div>

          {/* Быстрый доступ к разделам из Меню */}
          <div className="pt-2 mt-2 border-t border-[#DCE1E6] space-y-0.5">
            <div className="px-3 py-1 text-[10px] font-semibold text-[#818C99]">
              Разделы меню
            </div>
            {extraNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab && item.id !== 'settings_prefs';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[9px] text-[12px] transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#E5EBF1] text-[#0077FF] font-semibold'
                      : 'text-[#2C3138] hover:bg-[#E2E5E8] hover:text-[#000000]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#0077FF]' : 'text-[#818C99]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

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

        {/* Информация о текущей версии сборки */}
        <div className="pt-2 border-t border-[#DCE1E6] px-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('settings');
              window.dispatchEvent(
                new CustomEvent('mender:profile-section', { detail: 'settings' })
              );
            }}
            className="w-full text-left p-2 rounded-lg bg-white/70 hover:bg-white border border-[#E1E3E6] transition-colors cursor-pointer"
            title="Перейти к информации о версии и обновлениях в Настройках"
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-[#19191A]">
              <span>Mender {APP_VERSION_FULL}</span>
              <span className="text-[10px] font-mono text-[#0077FF]">#{APP_BUILD_NUMBER}</span>
            </div>
            <div className="text-[10px] text-[#818C99] truncate mt-0.5">
              Офлайн · Плеер · APK ≤ 20 МБ
            </div>
          </button>
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



