import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  Users,
  Radio,
  Pin,
  VolumeX,
  UserPlus,
  Sparkles,
  MessageSquarePlus,
} from 'lucide-react';
import { CreateGroupModal } from './CreateGroupModal';
import { SearchModal } from '../search/SearchModal';
import { WallpaperStudioModal } from '../wallpapers/WallpaperStudioModal';

export const ChatList: React.FC = () => {
  const {
    chats,
    activeChatId,
    setActiveChatId,
    usersDirectory,
    openUserProfile,
    startDirectChatWithUser,
  } = useChat();
  const { profile, isUserBlocked } = useAuth();
  const [filter, setFilter] = useState<'all' | 'direct' | 'group' | 'channel'>('all');
  const [createModalType, setCreateModalType] = useState<'direct' | 'group' | 'channel' | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  const filteredChats = chats.filter(chat => {
    if (chat.type === 'direct') {
      const otherUid = chat.ownerId === profile?.uid ? chat.peerUserId : chat.ownerId;
      if (otherUid && isUserBlocked(otherUid)) return false;
    }
    if (filter === 'direct' && chat.type !== 'direct') return false;
    if (filter === 'group' && chat.type !== 'group') return false;
    if (filter === 'channel' && chat.type !== 'channel') return false;
    return true;
  });

  const otherRegisteredUsers = React.useMemo(() => {
    const seenUsernames = new Set<string>();
    if (profile?.username) {
      seenUsernames.add(profile.username.toLowerCase());
    }
    return usersDirectory.filter(u => {
      if (u.uid === profile?.uid || isUserBlocked(u.uid)) return false;
      const uname = (u.username || '').toLowerCase();
      if (uname && seenUsernames.has(uname)) return false;
      if (uname) seenUsernames.add(uname);
      return true;
    });
  }, [usersDirectory, profile?.uid, profile?.username, isUserBlocked]);

  const formatTime = (ts?: any) => {
    if (!ts) return '21:45';
    try {
      const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '21:45';
    }
  };
  const isDarkMode = profile ? Boolean((profile as any).darkMode) : false;

  return (
    <div className="w-full bg-white flex flex-col h-full shrink-0 select-none text-[#19191A] transition-colors duration-200">
      {/* Top Header, Search & Quick Action Buttons */}
      <div className="p-3 border-b border-[#E1E3E6] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold tracking-tight text-[#19191A]">
              Мессенджер
            </h2>
            <span className="text-xs text-[#818C99] font-medium">({filteredChats.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowWallpaperModal(true)}
              className="p-1.5 rounded-lg hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#0077FF] transition-colors cursor-pointer"
              title="Фоны чатов"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              className="p-1.5 rounded-lg hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#0077FF] transition-colors cursor-pointer"
              title="Глобальный поиск"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div
          onClick={() => setShowSearchModal(true)}
          className="flex items-center gap-2 bg-[#EDEFEF] hover:bg-[#E5E7E8] rounded-[8px] px-3 py-1.5 text-[#818C99] cursor-pointer transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-[#818C99]" />
          <span className="text-xs">Поиск диалогов и людей...</span>
        </div>

        {/* Компактные кнопки создания чата и группы */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setCreateModalType('direct')}
            className="px-2.5 py-1.5 rounded-[8px] bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">+ Личный чат</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateModalType('group')}
            className="px-2.5 py-1.5 rounded-[8px] bg-[#EDEFEF] hover:bg-[#E2E5E8] text-[#2C3138] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
            <span className="truncate">+ Беседа</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-[#EDEFEF] p-0.5 rounded-[8px]">
          {(['all', 'direct', 'group', 'channel'] as const).map(tab => {
            const labels = { all: 'Все', direct: 'Личные', group: 'Беседы', channel: 'Каналы' };
            const isActive = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`flex-1 py-1 text-[11px] font-medium rounded-[6px] transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#0077FF] font-semibold shadow-2xs'
                    : 'text-[#818C99] hover:text-[#19191A]'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick People List */}
      {otherRegisteredUsers.length > 0 && (
        <div className="px-3 py-2 border-b border-[#E1E3E6] bg-[#F7F8FA]">
          <div className="text-[11px] font-semibold text-[#818C99] mb-1.5 flex items-center gap-1.5">
            <UserPlus className="w-3 h-3 text-[#0077FF]" />
            <span>Контакты ({otherRegisteredUsers.length})</span>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5">
            {otherRegisteredUsers.map(person => (
              <button
                key={person.uid}
                type="button"
                onClick={() => openUserProfile(person)}
                className="flex flex-col items-center shrink-0 group cursor-pointer"
                title={`Открыть страницу ${person.displayName}`}
              >
                <div className="relative">
                  <img
                    src={person.avatarUrl}
                    alt={person.displayName}
                    className="w-9 h-9 rounded-full object-cover border border-[#E1E3E6] group-hover:border-[#0077FF] transition-all"
                  />
                  {person.status === 'online' && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#4BB34B] ring-2 ring-white" />
                  )}
                </div>
                <span className="text-[10px] text-[#2C3138] mt-0.5 max-w-[58px] truncate font-medium group-hover:text-[#0077FF]">
                  {person.displayName.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#F2F3F5]">
        {filteredChats.length === 0 ? (
          <div className="p-4 text-[#818C99] space-y-3">
            <p className="text-xs leading-relaxed">
              В этой категории пока нет диалогов. Создайте новый диалог:
            </p>
            <div className="v7-btn-list">
              <button
                type="button"
                onClick={() => setCreateModalType('direct')}
                className="v7-btn text-xs"
              >
                <MessageSquarePlus className="w-4 h-4 shrink-0" />
                <span>+ Написать сообщение</span>
              </button>
            </div>
          </div>
        ) : (
          filteredChats.map(chat => {
            const isActive = chat.chatId === activeChatId;
            return (
              <div
                key={chat.chatId}
                onClick={() => setActiveChatId(chat.chatId)}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#E5EBF1] border-l-3 border-[#0077FF]'
                    : 'hover:bg-[#F5F6F8] border-l-3 border-transparent'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={chat.avatarUrl}
                    alt={chat.name}
                    className="w-11 h-11 rounded-full object-cover bg-[#EDEFEF] border border-[#E1E3E6]"
                  />
                  {chat.type === 'direct' && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#4BB34B] ring-2 ring-white" />
                  )}
                  {chat.type === 'group' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0077FF] text-white flex items-center justify-center text-[9px]">
                      <Users className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {chat.type === 'channel' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#2688EB] text-white flex items-center justify-center text-[9px]">
                      <Radio className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <h4 className="text-sm font-semibold text-[#19191A] truncate">
                        {chat.name}
                      </h4>
                      {chat.isPinned && <Pin className="w-3 h-3 text-[#0077FF] shrink-0" />}
                      {chat.isMuted && <VolumeX className="w-3 h-3 text-[#818C99] shrink-0" />}
                    </div>
                    <span className="text-[11px] text-[#818C99] shrink-0">
                      {formatTime(chat.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[#656565] truncate">
                      {chat.lastMessageText || chat.description || 'Нажмите для открытия диалога'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {createModalType && (
        <CreateGroupModal
          defaultType={createModalType}
          onClose={() => setCreateModalType(null)}
        />
      )}
      {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} />}
      {showWallpaperModal && <WallpaperStudioModal onClose={() => setShowWallpaperModal(false)} />}
    </div>
  );
};
