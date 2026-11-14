import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  Users,
  Radio,
  Pin,
  PinOff,
  VolumeX,
  Volume2,
  Sparkles,
  MessageSquarePlus,
  ShieldCheck,
  CheckCircle2,
  X,
  Image as ImageIcon,
  Mic,
  Video,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { CreateGroupModal } from './CreateGroupModal';
import { SearchModal } from '../search/SearchModal';
import { WallpaperStudioModal } from '../wallpapers/WallpaperStudioModal';
import { Avatar } from '../common/Avatar';
import { TypingIndicatorText } from '../common/TypingIndicatorText';
import { Chat } from '../../types';

interface ChatMenuState {
  chat: Chat;
  x: number;
  y: number;
}

export const ChatList: React.FC = () => {
  const {
    chats,
    activeChatId,
    setActiveChatId,
    usersDirectory,
    typingUsersByChat,
    startDirectChatWithUser,
    togglePinChat,
    toggleMuteChat,
    toggleArchiveChat,
    deleteChatForMe,
    deleteChatForBoth,
  } = useChat();
  const { profile, isUserBlocked } = useAuth();

  const [filter, setFilter] = useState<'all' | 'direct' | 'group' | 'channel'>('all');
  const [localQuery, setLocalQuery] = useState('');
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [menuState, setMenuState] = useState<ChatMenuState | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    if (!menuState) {
      setMenuError('');
      return;
    }
    const syncViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    syncViewport();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyAction) {
        setMenuState(null);
      }
    };
    window.addEventListener('resize', syncViewport);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuState, busyAction]);
  const [createModalType, setCreateModalType] = useState<'direct' | 'group' | 'channel' | null>(
    null
  );
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  const normalizedQuery = localQuery.trim().toLowerCase();

  const usersById = useMemo(() => {
    const map = new Map<string, (typeof usersDirectory)[number]>();
    usersDirectory.forEach(u => map.set(u.uid, u));
    return map;
  }, [usersDirectory]);

  const unblockedChats = useMemo(() => {
    return chats.filter(chat => {
      if (chat.type === 'direct') {
        const otherUid = chat.ownerId === profile?.uid ? chat.peerUserId : chat.ownerId;
        if (otherUid && isUserBlocked(otherUid)) return false;
      }
      return true;
    });
  }, [chats, profile?.uid, isUserBlocked]);

  const activeUnblockedChats = useMemo(
    () => unblockedChats.filter(c => !c.isArchived),
    [unblockedChats]
  );

  const archivedUnblockedChats = useMemo(
    () => unblockedChats.filter(c => Boolean(c.isArchived)),
    [unblockedChats]
  );

  const tabCounts = useMemo(() => {
    return {
      all: activeUnblockedChats.length,
      direct: activeUnblockedChats.filter(c => c.type === 'direct').length,
      group: activeUnblockedChats.filter(c => c.type === 'group').length,
      channel: activeUnblockedChats.filter(c => c.type === 'channel').length,
    };
  }, [activeUnblockedChats]);

  const filteredChats = useMemo(() => {
    const sourceList = showArchiveView ? archivedUnblockedChats : activeUnblockedChats;
    return sourceList.filter(chat => {
      if (!showArchiveView && filter !== 'all' && chat.type !== filter) return false;
      if (!normalizedQuery) return true;
      const nameMatch = chat.name?.toLowerCase().includes(normalizedQuery);
      const lastMsgMatch = chat.lastMessageText?.toLowerCase().includes(normalizedQuery);
      const descMatch = chat.description?.toLowerCase().includes(normalizedQuery);
      return Boolean(nameMatch || lastMsgMatch || descMatch);
    });
  }, [showArchiveView, archivedUnblockedChats, activeUnblockedChats, filter, normalizedQuery]);

  const pinnedChats = useMemo(
    () => filteredChats.filter(c => c.isPinned),
    [filteredChats]
  );
  const regularChats = useMemo(
    () => filteredChats.filter(c => !c.isPinned),
    [filteredChats]
  );

  const otherRegisteredUsers = useMemo(() => {
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

  const matchedUsers = useMemo(() => {
    if (!normalizedQuery) return [];
    return otherRegisteredUsers.filter(
      u =>
        u.displayName?.toLowerCase().includes(normalizedQuery) ||
        u.username?.toLowerCase().includes(normalizedQuery)
    );
  }, [otherRegisteredUsers, normalizedQuery]);

  const formatChatTime = (ts?: any) => {
    if (!ts) return '';
    try {
      const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      const now = new Date();
      const sameDay =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
      if (sameDay) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      }
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        return 'Вчера';
      }
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderChatRow = (chat: Chat) => {
    const isActive = chat.chatId === activeChatId;
    const isSystemSecurityChat =
      chat.peerUserId === 'mender_security_bot' ||
      chat.chatId.startsWith('chat_system_security_');

    const otherUid =
      chat.type === 'direct'
        ? chat.ownerId === profile?.uid
          ? chat.peerUserId
          : chat.ownerId
        : null;
    const peerProfile = otherUid ? usersById.get(otherUid) : undefined;
    const isOnline = Boolean(peerProfile?.status === 'online' && !isSystemSecurityChat);
    const isSentByMe = Boolean(profile?.uid && chat.lastMessageSenderId === profile.uid);
    const chatTypingUsers = typingUsersByChat[chat.chatId] || [];

    const mediaPreviewIcon =
      chat.lastMessageType === 'image' ? (
        <ImageIcon className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
      ) : chat.lastMessageType === 'voice' ? (
        <Mic className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
      ) : chat.lastMessageType === 'video' || chat.lastMessageType === 'video_circle' ? (
        <Video className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
      ) : null;

    const openChatMenuAt = (chatObj: Chat, clientX: number, clientY: number) => {
      setMenuState({
        chat: chatObj,
        x: clientX,
        y: clientY,
      });
    };

    return (
      <div
        key={chat.chatId}
        onClick={() => setActiveChatId(chat.chatId)}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          openChatMenuAt(chat, e.clientX, e.clientY);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActiveChatId(chat.chatId);
          }
        }}
        className={`group mx-1.5 sm:mx-2 my-0.5 rounded-2xl sm:rounded-xl px-3 sm:px-2.5 py-2.5 min-h-[66px] sm:min-h-[62px] min-w-0 flex items-center gap-2.5 sm:gap-3 transition-colors cursor-pointer ${
          isActive
            ? 'bg-[#E5EBF1] text-[#19191A]'
            : isSystemSecurityChat
            ? 'bg-[#F7F8FA] hover:bg-[#EDEFEF]'
            : 'hover:bg-[#F5F6F8]'
        }`}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar
            src={chat.avatarUrl}
            name={chat.name}
            isSystemSecurity={isSystemSecurityChat}
            className="w-12 h-12 sm:w-11 sm:h-11 rounded-full border border-[#E1E3E6]"
          />
          {isSystemSecurityChat ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#0077FF] text-white flex items-center justify-center ring-2 ring-white">
              <ShieldCheck className="w-3 h-3" />
            </span>
          ) : isOnline ? (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#4BB34B] ring-2 ring-white" />
          ) : chat.type === 'group' ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0077FF] text-white flex items-center justify-center ring-2 ring-white">
              <Users className="w-2.5 h-2.5" />
            </span>
          ) : chat.type === 'channel' ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#2688EB] text-white flex items-center justify-center ring-2 ring-white">
              <Radio className="w-2.5 h-2.5" />
            </span>
          ) : null}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h4
                className={`text-[15px] sm:text-[13.5px] font-semibold truncate ${
                  isActive ? 'text-[#0077FF]' : 'text-[#19191A]'
                }`}
              >
                {chat.name}
              </h4>
              {isSystemSecurityChat && (
                <CheckCircle2
                  className="w-3.5 h-3.5 text-[#0077FF] shrink-0"
                  aria-label="Официальный системный чат"
                />
              )}
              {chat.isMuted && (
                <VolumeX className="w-3.5 h-3.5 text-[#818C99] shrink-0" aria-label="Без звука" />
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {chat.isPinned && (
                <Pin className="w-3 h-3 text-[#0077FF] shrink-0" aria-label="Закреплён" />
              )}
              <span className="text-[11px] text-[#818C99] tabular-nums">
                {formatChatTime(chat.updatedAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 min-w-0 text-[13px] sm:text-xs text-[#626D7A]">
            {chatTypingUsers.length > 0 ? (
              <TypingIndicatorText
                typingUsers={chatTypingUsers}
                isDirect={chat.type === 'direct'}
                showPrefix={chat.type !== 'direct'}
                className="text-[#0077FF] font-medium min-w-0"
              />
            ) : (
              <>
                {isSentByMe && (
                  <span className="text-[#0077FF] font-medium shrink-0">Вы:</span>
                )}
                {mediaPreviewIcon}
                <p className="truncate">
                  {chat.lastMessageText || chat.description || 'Открыть диалог'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Three-dots Chat Menu Button */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            openChatMenuAt(chat, rect.right, rect.bottom + 6);
          }}
          className="w-8 h-8 rounded-xl bg-[#F2F3F5] hover:bg-[#E5E7E8] flex items-center justify-center text-[#626D7A] hover:text-[#19191A] transition-colors cursor-pointer shrink-0"
          title="Действия с чатом"
          aria-label={`Действия для чата ${chat.name}`}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="w-full min-w-0 overflow-hidden bg-white flex flex-col h-full shrink-0 select-none text-[#19191A] transition-colors duration-200">
      {/* Header & Controls */}
      <div className="px-3.5 pt-3.5 pb-2.5 border-b border-[#E1E3E6] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {showArchiveView && (
              <button
                type="button"
                onClick={() => setShowArchiveView(false)}
                className="min-h-[36px] min-w-[36px] rounded-xl bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#19191A] flex items-center justify-center cursor-pointer transition-colors shrink-0"
                title="Назад ко всем чатам"
              >
                <ArrowLeft className="w-4 h-4 text-[#0077FF]" />
              </button>
            )}
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="text-[17px] font-bold tracking-tight text-[#19191A] whitespace-nowrap">
                {showArchiveView ? 'Архив' : 'Чаты'}
              </h2>
              <span className="text-xs text-[#818C99] font-medium tabular-nums">
                · {showArchiveView ? archivedUnblockedChats.length : activeUnblockedChats.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {profile?.uid && (
              <button
                type="button"
                onClick={() => setActiveChatId(`chat_system_security_${profile.uid}`)}
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl hover:bg-[#EDEFEF] text-[#0077FF] transition-colors cursor-pointer flex items-center justify-center"
                title="Mender Безопасность"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowWallpaperModal(true)}
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#0077FF] transition-colors cursor-pointer flex items-center justify-center"
              title="Фоны чатов"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCreateModalType('direct')}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Создать чат, беседу или канал"
            >
              <MessageSquarePlus className="w-4 h-4 shrink-0" />
              <span>Написать</span>
            </button>
          </div>
        </div>

        {/* Live Inline Search Input */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#818C99] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            placeholder={showArchiveView ? 'Поиск в архиве...' : 'Поиск диалогов и контактов...'}
            className="w-full bg-[#EDEFEF] focus:bg-white border border-transparent focus:border-[#0077FF] rounded-xl py-2.5 sm:py-2 pl-9 pr-8 text-[16px] sm:text-xs text-[#19191A] placeholder-[#818C99] focus:outline-none transition-colors"
          />
          {localQuery && (
            <button
              type="button"
              onClick={() => setLocalQuery('')}
              className="absolute right-2 p-1.5 rounded-md text-[#818C99] hover:text-[#19191A] cursor-pointer"
              title="Очистить поиск"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Segmented Filter Tabs */}
        {!showArchiveView && (
          <div className="flex bg-[#EDEFEF] p-1 rounded-xl gap-0.5">
            {(
              [
                { id: 'all', label: 'Все' },
                { id: 'direct', label: 'Личные' },
                { id: 'group', label: 'Беседы' },
                { id: 'channel', label: 'Каналы' },
              ] as const
            ).map(tab => {
              const isActive = filter === tab.id;
              const count = tabCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`flex-1 min-h-[34px] py-1.5 px-1 text-[11.5px] font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center gap-1 ${
                    isActive
                      ? 'bg-white text-[#0077FF] font-semibold shadow-2xs'
                      : 'text-[#626D7A] hover:text-[#19191A]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] tabular-nums ${
                        isActive ? 'text-[#0077FF]' : 'text-[#818C99]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Scrollable Chat Feed */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {/* Archive Folder Banner */}
        {!showArchiveView && archivedUnblockedChats.length > 0 && !normalizedQuery && (
          <button
            type="button"
            onClick={() => setShowArchiveView(true)}
            className="w-[calc(100%-12px)] sm:w-[calc(100%-16px)] mx-1.5 sm:mx-2 mb-1.5 rounded-2xl sm:rounded-xl px-3 py-2.5 bg-[#F7F8FA] hover:bg-[#EDEFEF] border border-[#E1E3E6] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#E5EBF1] text-[#0077FF] flex items-center justify-center shrink-0">
                <Archive className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[#19191A] flex items-center gap-1.5">
                  <span>Архив</span>
                  <span className="text-xs text-[#0077FF] tabular-nums">
                    · {archivedUnblockedChats.length}
                  </span>
                </div>
                <p className="text-xs text-[#818C99] truncate">
                  {archivedUnblockedChats.map(c => c.name).slice(0, 3).join(', ')}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#818C99] shrink-0" />
          </button>
        )}

        {filteredChats.length === 0 && matchedUsers.length === 0 ? (
          <div className="p-5 text-center space-y-3">
            <p className="text-xs text-[#818C99] leading-relaxed">
              {showArchiveView
                ? 'В архиве пока нет чатов.'
                : normalizedQuery
                ? `По запросу «${localQuery.trim()}» локальных чатов не найдено.`
                : 'В этой категории пока нет диалогов.'}
            </p>
            <div className="flex flex-col gap-2">
              {showArchiveView ? (
                <button
                  type="button"
                  onClick={() => setShowArchiveView(false)}
                  className="v7-btn text-xs justify-center"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>Вернуться к чатам</span>
                </button>
              ) : normalizedQuery ? (
                <button
                  type="button"
                  onClick={() => setShowSearchModal(true)}
                  className="v7-btn text-xs justify-center"
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>Искать во всём Mender</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setCreateModalType(filter === 'group' ? 'group' : filter === 'channel' ? 'channel' : 'direct')
                  }
                  className="v7-btn text-xs justify-center"
                >
                  <MessageSquarePlus className="w-4 h-4 shrink-0" />
                  <span>Начать новый диалог</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {pinnedChats.length > 0 && (
              <div className="mb-1">
                <div className="px-4 pt-1.5 pb-1 text-[11px] font-semibold text-[#818C99]">
                  Закреплённые
                </div>
                {pinnedChats.map(renderChatRow)}
              </div>
            )}

            {regularChats.length > 0 && (
              <div>
                {pinnedChats.length > 0 && (
                  <div className="px-4 pt-2 pb-1 text-[11px] font-semibold text-[#818C99]">
                    Все сообщения
                  </div>
                )}
                {regularChats.map(renderChatRow)}
              </div>
            )}

            {/* Matched people during inline search */}
            {matchedUsers.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#E1E3E6]">
                <div className="px-4 pb-1 text-[11px] font-semibold text-[#818C99]">
                  Контакты ({matchedUsers.length})
                </div>
                {matchedUsers.map(person => (
                  <button
                    key={person.uid}
                    type="button"
                    onClick={() => {
                      startDirectChatWithUser(person);
                      setLocalQuery('');
                    }}
                    className="w-[calc(100%-16px)] mx-2 my-0.5 rounded-xl px-2.5 py-2 flex items-center justify-between gap-3 hover:bg-[#F5F6F8] text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={person.avatarUrl}
                        name={person.displayName}
                        className="w-10 h-10 rounded-full border border-[#E1E3E6]"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#19191A] truncate">
                          {person.displayName}
                        </div>
                        <div className="text-[11px] text-[#818C99] truncate">@{person.username}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#0077FF] shrink-0">
                      Написать
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat Action Menu (Three-Dots + Right-Click Popover on Desktop / Bottom Sheet on Mobile, portaled above Header & MobileNav) */}
      {menuState &&
        typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const { chat, x, y } = menuState;
            const isSystemChat =
              chat.peerUserId === 'mender_security_bot' ||
              chat.chatId.startsWith('chat_system_security_');
            const canDeleteForBoth =
              !isSystemChat &&
              (chat.type === 'direct' ||
                (Boolean(profile?.uid) && chat.ownerId === profile?.uid));

            const isDesktopMenu = viewportSize.width >= 640;
            const menuWidth = 280;
            const estimatedHeight = canDeleteForBoth ? 380 : 310;
            const left = Math.max(12, Math.min(x - menuWidth + 24, viewportSize.width - menuWidth - 12));
            const top = Math.max(
              12,
              Math.min(y, viewportSize.height - estimatedHeight - 12)
            );

            const closeMenu = () => {
              if (!busyAction) setMenuState(null);
            };

            return (
              <div
                className={`fixed inset-0 z-[120] ${
                  isDesktopMenu ? 'bg-black/15' : 'bg-black/50 flex items-end justify-center'
                }`}
                onClick={closeMenu}
                onContextMenu={e => {
                  e.preventDefault();
                  closeMenu();
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={
                    isDesktopMenu
                      ? {
                          position: 'fixed',
                          left,
                          top,
                          width: menuWidth,
                          maxHeight: 'calc(100dvh - 24px)',
                        }
                      : undefined
                  }
                  className={
                    isDesktopMenu
                      ? 'bg-white border border-[#E1E3E6] rounded-2xl shadow-2xl overflow-y-auto text-[#19191A]'
                      : 'w-full max-w-lg bg-white border-t border-x border-[#E1E3E6] rounded-t-3xl shadow-2xl max-h-[82dvh] overflow-y-auto text-[#19191A] pb-[max(1.25rem,env(safe-area-inset-bottom))]'
                  }
                >
              {/* Header */}
              <div className="px-4 py-3 border-b border-[#E1E3E6] flex items-center justify-between gap-2 bg-[#F7F8FA]">
                <span className="text-xs font-bold text-[#19191A] truncate">{chat.name}</span>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="p-1 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#EDEFEF] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-1.5 space-y-0.5">
                {/* 1. Выключить / Включить звук */}
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={async () => {
                    await toggleMuteChat(chat.chatId);
                    setMenuState(null);
                  }}
                  className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-xl hover:bg-[#F5F6F8] flex items-center gap-3 text-left text-[14px] sm:text-xs font-medium text-[#19191A] cursor-pointer transition-colors"
                >
                  {chat.isMuted ? (
                    <Volume2 className="w-4 h-4 text-[#0077FF] shrink-0" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[#626D7A] shrink-0" />
                  )}
                  <span>{chat.isMuted ? 'Включить звук' : 'Выключить звук'}</span>
                </button>

                {/* 2. В архив / Вернуть из архива */}
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={async () => {
                    const willBeEmptyArchive =
                      showArchiveView && archivedUnblockedChats.length <= 1;
                    await toggleArchiveChat(chat.chatId);
                    setMenuState(null);
                    if (willBeEmptyArchive) setShowArchiveView(false);
                  }}
                  className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-xl hover:bg-[#F5F6F8] flex items-center gap-3 text-left text-[14px] sm:text-xs font-medium text-[#19191A] cursor-pointer transition-colors"
                >
                  {chat.isArchived ? (
                    <ArchiveRestore className="w-4 h-4 text-[#0077FF] shrink-0" />
                  ) : (
                    <Archive className="w-4 h-4 text-[#626D7A] shrink-0" />
                  )}
                  <span>{chat.isArchived ? 'Вернуть из архива' : 'В архив'}</span>
                </button>

                {/* 3. Закрепить / Открепить */}
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={async () => {
                    await togglePinChat(chat.chatId);
                    setMenuState(null);
                  }}
                  className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-xl hover:bg-[#F5F6F8] flex items-center gap-3 text-left text-[14px] sm:text-xs font-medium text-[#19191A] cursor-pointer transition-colors"
                >
                  {chat.isPinned ? (
                    <PinOff className="w-4 h-4 text-[#626D7A] shrink-0" />
                  ) : (
                    <Pin className="w-4 h-4 text-[#0077FF] shrink-0" />
                  )}
                  <span>{chat.isPinned ? 'Открепить' : 'Закрепить'}</span>
                </button>

                <div className="my-1.5 border-t border-[#E1E3E6]" />

                {/* 4. Удалить чат: сразу видны «Удалить у себя» и «Удалить у двоих» */}
                <div className="px-2 pt-0.5 pb-1 flex items-center gap-1.5 text-[11px] font-semibold text-rose-500">
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Удалить чат</span>
                </div>

                {menuError && (
                  <div className="mx-1.5 px-2.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-500">
                    {menuError}
                  </div>
                )}

                <div className="px-1 pb-1 space-y-1.5">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={async () => {
                      setBusyAction(true);
                      setMenuError('');
                      try {
                        await deleteChatForMe(chat.chatId);
                        setMenuState(null);
                      } catch (err: any) {
                        setMenuError(err?.message || 'Не удалось удалить чат');
                      } finally {
                        setBusyAction(false);
                      }
                    }}
                    className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-[#F7F8FA] hover:bg-[#EDEFEF] border border-[#E1E3E6] text-left cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <div className="text-[13.5px] sm:text-xs font-bold text-[#19191A]">
                      Удалить у себя
                    </div>
                    <div className="text-[11px] text-[#818C99]">
                      Чат исчезнет только из вашего списка
                    </div>
                  </button>

                  {canDeleteForBoth && (
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={async () => {
                        setBusyAction(true);
                        setMenuError('');
                        try {
                          await deleteChatForBoth(chat.chatId);
                          setMenuState(null);
                        } catch {
                          setMenuError('Не удалось удалить чат у всех участников');
                        } finally {
                          setBusyAction(false);
                        }
                      }}
                      className="w-full min-h-[46px] px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <div className="text-[13.5px] sm:text-xs font-bold text-rose-500">
                        {chat.type === 'direct' ? 'Удалить у двоих' : 'Удалить у всех'}
                      </div>
                      <div className="text-[11px] text-rose-500/80">
                        {chat.type === 'direct'
                          ? 'Удалит переписку у вас и у собеседника'
                          : 'Удалит чат и сообщения для всех участников'}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
            );
          })(),
          document.body
        )}

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
