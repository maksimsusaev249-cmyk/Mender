import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { VideoProvider } from './context/VideoContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { Sidebar } from './components/navigation/Sidebar';
import { MobileNav } from './components/navigation/MobileNav';
import { ChatList } from './components/chats/ChatList';
import { ChatWindow } from './components/chats/ChatWindow';
import { SocialFeed } from './components/feed/SocialFeed';
import { MenderVideoView } from './components/video/MenderVideoView';
import { CallsView } from './components/calls/CallsView';
import { ChannelsView } from './components/channels/ChannelsView';
import { SettingsView } from './components/settings/SettingsView';
import { CallModal } from './components/calls/CallModal';
import { CreateGroupModal } from './components/chats/CreateGroupModal';
import { WallpaperStudioModal } from './components/wallpapers/WallpaperStudioModal';
import { SearchModal } from './components/search/SearchModal';
import { UserProfileModal } from './components/profile/UserProfileModal';

import { Search, Sparkles, ChevronDown, MessageSquare, PhoneCall, Sun, Moon, Palette, Film, WifiOff } from 'lucide-react';

const MainMessenger: React.FC = () => {
  const {
    firebaseUser,
    profile,
    themeMode,
    customThemeBgColor,
    setThemeMode,
    setCustomThemeBgColor,
    isAuthReady,
    isPinVerified,
    needsOnboarding,
    needsPinSetup,
  } = useAuth();
  const { activeTab, setActiveTab, activeChatId } = useChat();

  const [createModalType, setCreateModalType] = useState<'direct' | 'group' | null>(null);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen bg-[#EDEEF0] flex flex-col items-center justify-center text-[#19191A] gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#0077FF] flex items-center justify-center shadow-md animate-pulse">
          <span className="text-white font-black text-xl">M</span>
        </div>
        <span className="text-xs font-medium text-[#818C99]">
          Подключение к Mender...
        </span>
      </div>
    );
  }

  if (!firebaseUser || needsOnboarding || needsPinSetup || !isPinVerified) {
    return <AuthScreen />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col bg-[#EDEEF0] text-[#19191A] transition-colors duration-200">
      {/* Top Header Bar */}
      <header className="h-[48px] px-3 md:px-6 flex items-center justify-between border-b bg-white border-[#E1E3E6] text-[#19191A] z-30 shrink-0 select-none">
        {/* Left: Mender Logo & Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-[7px] bg-[#0077FF] hover:bg-[#0066EA] flex items-center justify-center text-white font-extrabold text-sm tracking-tighter shadow-xs transition-colors">
              M
            </div>
            <span className="font-bold text-[16px] tracking-tight hidden sm:inline text-[#19191A] group-hover:text-[#0077FF] transition-colors">
              Mender
            </span>
          </button>

          {/* Search Bar */}
          <div
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs cursor-pointer transition-colors w-32 sm:w-52 md:w-64 bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#818C99]"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Поиск</span>
          </div>
        </div>

        {/* Right: Single Unified Theme Button, Quick Actions & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 relative">
          {/* Единая кнопка переключения темы интерфейса (Светлая -> Тёмная -> Свой) */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => {
                const nextMode =
                  themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'custom' : 'light';
                setThemeMode(nextMode);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] border border-[#E1E3E6] text-[#19191A] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title={
                themeMode === 'light'
                  ? 'Тема: Светлая (нажмите для Тёмной)'
                  : themeMode === 'dark'
                  ? 'Тема: Тёмная (нажмите для Своей)'
                  : 'Тема: Свой фон (нажмите для Светлой)'
              }
            >
              {themeMode === 'light' && <Sun className="w-4 h-4 text-[#0077FF]" />}
              {themeMode === 'dark' && <Moon className="w-4 h-4 text-[#0077FF]" />}
              {themeMode === 'custom' && <Palette className="w-4 h-4 text-[#0077FF]" />}
              <span className="hidden sm:inline text-[11px]">
                {themeMode === 'light' ? 'Светлая' : themeMode === 'dark' ? 'Тёмная' : 'Свой'}
              </span>
            </button>

            {themeMode === 'custom' && (
              <input
                type="color"
                value={customThemeBgColor}
                onChange={e => setCustomThemeBgColor(e.target.value)}
                className="w-6 h-6 rounded-md cursor-pointer border border-[#E1E3E6] bg-transparent ml-1"
                title="Выбрать свой цвет фона приложения"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowWallpaperModal(true)}
            className="p-1.5 rounded-full hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#0077FF] transition-colors cursor-pointer"
            title="Студия фонов и оформления"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className="hidden sm:flex p-1.5 rounded-full hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#0077FF] transition-colors cursor-pointer"
            title="Mender Video"
          >
            <Film className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className="hidden sm:flex p-1.5 rounded-full hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#0077FF] transition-colors cursor-pointer"
            title="Звонки"
          >
            <PhoneCall className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className="hidden sm:flex p-1.5 rounded-full hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#0077FF] transition-colors cursor-pointer"
            title="Мессенджер"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* User Profile Pill */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('settings');
              window.dispatchEvent(new CustomEvent('mender:profile-section', { detail: 'profile' }));
            }}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full hover:bg-[#EDEFEF] cursor-pointer transition-colors"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-7 h-7 rounded-full object-cover border border-[#E1E3E6]"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#0077FF] text-white font-bold text-xs flex items-center justify-center">
                {profile?.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <span className="text-xs font-semibold max-w-[90px] truncate hidden md:inline text-[#19191A]">
              {profile?.displayName?.split(' ')[0] || 'Моя страница'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#818C99]" />
          </button>
        </div>
      </header>

      {/* Индикатор работы без интернета (Автономный офлайн-режим) */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-3 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 z-30 shrink-0 shadow-xs">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            Автономный режим (без интернета) — чаты, записи и офлайн-видео работают из памяти устройства
          </span>
        </div>
      )}

      {/* Main Full-Height Workspace */}
      <div className="relative z-10 flex-1 flex overflow-hidden h-full pb-14 md:pb-0">
        <Sidebar />

        <main className="flex-1 flex overflow-hidden h-full bg-[#EDEEF0] transition-colors duration-200">
          {activeTab === 'chats' && (
            <div className="flex-1 flex overflow-hidden h-full">
              <div
                className={`${
                  activeChatId ? 'hidden md:flex' : 'flex'
                } w-full md:w-[320px] lg:w-[350px] h-full border-r border-[#E1E3E6] bg-white shrink-0`}
              >
                <ChatList />
              </div>
              <div
                className={`${
                  activeChatId ? 'flex' : 'hidden md:flex'
                } flex-1 overflow-hidden h-full`}
              >
                <ChatWindow />
              </div>
            </div>
          )}

          {activeTab === 'feed' && <SocialFeed />}
          {activeTab === 'video' && <MenderVideoView />}
          {activeTab === 'calls' && <CallsView />}
          {activeTab === 'channels' && <ChannelsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />

      {/* Active Call & Incoming Call Modal */}
      <CallModal />

      {/* User Profile Modal (opens when clicking any user's avatar or name) */}
      <UserProfileModal />

      {createModalType && (
        <CreateGroupModal
          defaultType={createModalType}
          onClose={() => setCreateModalType(null)}
        />
      )}
      {showWallpaperModal && (
        <WallpaperStudioModal onClose={() => setShowWallpaperModal(false)} />
      )}
      {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} />}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <VideoProvider>
          <MainMessenger />
        </VideoProvider>
      </ChatProvider>
    </AuthProvider>
  );
}

