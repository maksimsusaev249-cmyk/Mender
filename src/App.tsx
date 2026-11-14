import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { VideoProvider } from './context/VideoContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { Sidebar } from './components/navigation/Sidebar';
import { MobileNav } from './components/navigation/MobileNav';
import { MenuHubView } from './components/navigation/MenuHubView';
import { ChatList } from './components/chats/ChatList';
import { ChatWindow } from './components/chats/ChatWindow';
import { SocialFeed } from './components/feed/SocialFeed';
import { MenderVideoView } from './components/video/MenderVideoView';
import { MenderMusicView } from './components/music/MenderMusicView';
import { GlobalMusicPlayer } from './components/music/GlobalMusicPlayer';
import { CallsView } from './components/calls/CallsView';
import { ChannelsView } from './components/channels/ChannelsView';
import { SettingsView } from './components/settings/SettingsView';
import { CallModal } from './components/calls/CallModal';
import { CreateGroupModal } from './components/chats/CreateGroupModal';
import { WallpaperStudioModal } from './components/wallpapers/WallpaperStudioModal';
import { SearchModal } from './components/search/SearchModal';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { PeopleView } from './components/people/PeopleView';
import { Avatar } from './components/common/Avatar';

import { Search, Sun, Moon, Palette, WifiOff, X, Download, CheckCircle2 } from 'lucide-react';
import {
  APP_VERSION_FULL,
  APP_BUILD_NUMBER,
  APP_RELEASE_DATE,
  APK_SIZE_LABEL,
  APP_VERSION_HISTORY,
} from './version';

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
  const { activeTab, setActiveTab, activeChatId, activeChat } = useChat();

  const [createModalType, setCreateModalType] = useState<'direct' | 'group' | null>(null);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleOpenWallpapers = () => setShowWallpaperModal(true);
    const handleOpenVersions = () => setShowVersionModal(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('mender:open-wallpapers', handleOpenWallpapers);
    window.addEventListener('mender:open-versions', handleOpenVersions);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('mender:open-wallpapers', handleOpenWallpapers);
      window.removeEventListener('mender:open-versions', handleOpenVersions);
    };
  }, []);

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen bg-[#F6F7F9] flex flex-col items-center justify-center text-[#18191C] gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#0077FF] flex items-center justify-center shadow-sm animate-pulse">
          <span className="text-white font-extrabold text-lg">M</span>
        </div>
        <span className="text-xs font-medium text-[#7B8494]">
          Подключение к Mender...
        </span>
      </div>
    );
  }

  if (!firebaseUser || needsOnboarding || needsPinSetup || !isPinVerified) {
    return <AuthScreen />;
  }

  const isMobileChatOpen = activeTab === 'chats' && Boolean(activeChatId && activeChat);

  const mobileTabTitleMap: Record<string, string> = {
    chats: 'Mender',
    people: 'Люди',
    feed: 'Новости',
    video: 'Видео',
    music: 'Музыка',
    channels: 'Сообщества',
    calls: 'Звонки',
    menu: 'Меню',
    settings: 'Профиль',
  };
  const mobileTitle = mobileTabTitleMap[activeTab] || 'Mender';

  return (
    <div className="h-[100dvh] w-full overflow-hidden relative flex flex-col bg-[#F6F7F9] text-[#18191C] transition-colors duration-200">
      {/* Clean Responsive Top Bar (hidden on mobile inside active chat so chat header has full room) */}
      <header
        className={`${
          isMobileChatOpen ? 'hidden md:flex' : 'flex'
        } h-[52px] w-full px-3 md:px-5 items-center justify-between gap-2 md:gap-4 border-b bg-white border-[#E8EAED] text-[#18191C] z-30 shrink-0 select-none`}
      >
        {/* Zone 1: Brand Wordmark + Mobile Section Context */}
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-[#0077FF] group-hover:bg-[#0066EA] flex items-center justify-center text-white font-extrabold text-sm tracking-tight transition-colors">
            M
          </div>
          <span className="md:hidden font-bold text-[16px] tracking-tight text-[#18191C] whitespace-nowrap">
            {mobileTitle}
          </span>
          <span className="hidden md:inline font-bold text-[16px] tracking-tight text-[#18191C] whitespace-nowrap">
            Mender
          </span>
        </button>

        {/* Zone 2: Wide Search Bar on Desktop/Tablet */}
        <button
          type="button"
          onClick={() => setShowSearchModal(true)}
          className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors flex-1 min-w-0 max-w-md bg-[#F6F7F9] hover:bg-[#EDEFEF] text-[#7B8494]"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="truncate">Поиск людей, чатов, видео и музыки...</span>
        </button>

        {/* Zone 3: Mobile Compact Search + Theme Switcher & Profile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSearchModal(true)}
            className="md:hidden w-10 h-10 rounded-xl hover:bg-[#F2F4F7] text-[#7B8494] hover:text-[#18191C] flex items-center justify-center cursor-pointer transition-colors"
            title="Глобальный поиск"
            aria-label="Поиск"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => {
              const nextMode =
                themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'custom' : 'light';
              setThemeMode(nextMode);
            }}
            className="w-10 h-10 md:w-9 md:h-9 rounded-xl hover:bg-[#F2F4F7] text-[#7B8494] hover:text-[#18191C] flex items-center justify-center cursor-pointer transition-colors"
            title={
              themeMode === 'light'
                ? 'Светлая тема (нажмите для Тёмной)'
                : themeMode === 'dark'
                ? 'Тёмная тема (нажмите для Своей)'
                : 'Свой фон (нажмите для Светлой)'
            }
          >
            {themeMode === 'light' && <Sun className="w-[18px] h-[18px]" />}
            {themeMode === 'dark' && <Moon className="w-[18px] h-[18px]" />}
            {themeMode === 'custom' && <Palette className="w-[18px] h-[18px] text-[#0077FF]" />}
          </button>

          {themeMode === 'custom' && (
            <input
              type="color"
              value={customThemeBgColor}
              onChange={e => setCustomThemeBgColor(e.target.value)}
              className="w-7 h-7 rounded-lg cursor-pointer border border-[#E8EAED] bg-transparent"
              title="Выбрать свой цвет фона"
            />
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab('settings');
              window.dispatchEvent(new CustomEvent('mender:profile-section', { detail: 'profile' }));
            }}
            className="flex items-center gap-2 p-1 md:pr-2.5 rounded-xl hover:bg-[#F2F4F7] cursor-pointer transition-colors"
            title="Мой профиль"
          >
            <Avatar
              src={profile?.avatarUrl}
              name={profile?.displayName || 'Профиль'}
              className="w-8 h-8 md:w-7 md:h-7 rounded-full border border-[#E8EAED]"
            />
            <span className="text-xs font-semibold max-w-[100px] truncate hidden md:inline text-[#18191C]">
              {profile?.displayName?.split(' ')[0] || 'Профиль'}
            </span>
          </button>
        </div>
      </header>

      {/* Индикатор работы без интернета (Автономный офлайн-режим) */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-3 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 z-30 shrink-0">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            Автономный режим (без интернета) — чаты, записи и офлайн-видео работают из памяти устройства
          </span>
        </div>
      )}

      {/* Main Full-Height Workspace */}
      <div
        className={`relative z-10 flex-1 min-h-0 flex overflow-hidden h-full ${
          isMobileChatOpen ? 'pb-0' : 'pb-[56px] md:pb-0'
        }`}
      >
        <Sidebar />

        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden h-full">
          <main className="flex-1 min-h-0 min-w-0 w-full flex overflow-hidden h-full bg-[#F6F7F9] transition-colors duration-200">
            {activeTab === 'chats' && (
              <div className="flex-1 min-w-0 w-full flex overflow-hidden h-full">
                <div
                  className={`${
                    isMobileChatOpen ? 'hidden md:flex' : 'flex'
                  } w-full md:w-[330px] lg:w-[370px] min-w-0 h-full border-r border-[#E1E3E6] bg-white shrink-0 overflow-hidden`}
                >
                  <ChatList />
                </div>
                <div
                  className={`${
                    isMobileChatOpen ? 'flex' : 'hidden md:flex'
                  } flex-1 min-w-0 overflow-hidden h-full`}
                >
                  <ChatWindow />
                </div>
              </div>
            )}

            {activeTab === 'people' && <PeopleView />}
            {activeTab === 'feed' && <SocialFeed />}
            {activeTab === 'menu' && <MenuHubView />}
            {activeTab === 'video' && <MenderVideoView />}
            {activeTab === 'music' && <MenderMusicView />}
            {activeTab === 'calls' && <CallsView />}
            {activeTab === 'channels' && <ChannelsView />}
            {activeTab === 'settings' && <SettingsView />}
          </main>

          {/* Компактный мини-плеер и полноэкранный плеер Mender Music, доступные из любого раздела */}
          <GlobalMusicPlayer />
        </div>
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

      {/* Модальное окно: Новые версии и история обновлений Mender */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-[#E1E3E6] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-[#19191A]">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E1E3E6] flex items-center justify-between gap-3 bg-[#F7F8FA]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0077FF] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  M
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-extrabold text-[#19191A]">
                      Версии и обновления Mender
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#0077FF] text-white text-[10px] font-bold">
                      {APP_VERSION_FULL} · Build #{APP_BUILD_NUMBER}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#626D7A] truncate">
                    Дата релиза: {APP_RELEASE_DATE} · APK Lite: {APK_SIZE_LABEL}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVersionModal(false)}
                className="p-1.5 rounded-lg text-[#818C99] hover:bg-[#EDEFEF] hover:text-[#19191A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
              {APP_VERSION_HISTORY.map((rel, idx) => (
                <div
                  key={rel.version}
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    idx === 0
                      ? 'bg-[#EBF3FF]/60 border-[#0077FF]/40'
                      : 'bg-[#F7F8FA] border-[#E1E3E6]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#0077FF] font-mono">
                        {rel.version}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E1E3E6] text-[#505965]">
                        Build #{rel.buildNumber} · {rel.date}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        idx === 0
                          ? 'bg-[#0077FF] text-white'
                          : 'bg-[#E5EBF1] text-[#2A5885]'
                      }`}
                    >
                      {rel.badge} · APK {rel.apkSize}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-[#19191A]">{rel.title}</div>

                  <ul className="space-y-1 text-[11px] text-[#3B4E66]">
                    {rel.highlights.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0077FF] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-[#E1E3E6] bg-[#F7F8FA] flex flex-wrap items-center justify-between gap-2">
              <a
                href="/Mender-Lite-Android.apk"
                download={`Mender-${APP_VERSION_FULL}-Android.apk`}
                className="px-3.5 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать APK {APP_VERSION_FULL} ({APK_SIZE_LABEL})</span>
              </a>
              <button
                type="button"
                onClick={() => setShowVersionModal(false)}
                className="px-4 py-2 rounded-xl bg-[#EDEFEF] hover:bg-[#E2E5E8] text-xs font-semibold text-[#19191A] cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <VideoProvider>
          <MusicProvider>
            <MainMessenger />
          </MusicProvider>
        </VideoProvider>
      </ChatProvider>
    </AuthProvider>
  );
}

