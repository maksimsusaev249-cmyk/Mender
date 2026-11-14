import React, { useMemo, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  UserPlus,
  MessageSquare,
  Phone,
  Check,
  Users,
  X,
} from 'lucide-react';
import { CreateGroupModal } from '../chats/CreateGroupModal';
import { Avatar } from '../common/Avatar';
import { UserPublic } from '../../types';

type PeopleFilter = 'all' | 'online' | 'subscriptions';

export const PeopleView: React.FC = () => {
  const {
    usersDirectory,
    chats,
    openUserProfile,
    startDirectChatWithUser,
    startCall,
  } = useChat();
  const { profile, isUserBlocked, isSubscribed, toggleSubscription } = useAuth();

  const [queryText, setQueryText] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [showFindModal, setShowFindModal] = useState(false);

  const normalizedQuery = queryText.trim().toLowerCase();

  const allPeople = useMemo(() => {
    const seenUsernames = new Set<string>();
    if (profile?.username) {
      seenUsernames.add(profile.username.toLowerCase());
    }
    return usersDirectory
      .filter(u => {
        if (u.uid === profile?.uid || isUserBlocked(u.uid)) return false;
        const uname = (u.username || '').toLowerCase();
        if (uname && seenUsernames.has(uname)) return false;
        if (uname) seenUsernames.add(uname);
        return true;
      })
      .sort((a, b) => {
        const aOnline = a.status === 'online' && a.privacyLastSeen !== 'nobody' ? 1 : 0;
        const bOnline = b.status === 'online' && b.privacyLastSeen !== 'nobody' ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return a.displayName.localeCompare(b.displayName, 'ru');
      });
  }, [usersDirectory, profile?.uid, profile?.username, isUserBlocked]);

  const counts = useMemo(() => {
    const online = allPeople.filter(
      u => u.status === 'online' && u.privacyLastSeen !== 'nobody'
    ).length;
    const subscriptions = allPeople.filter(u => isSubscribed(u.uid)).length;
    return {
      all: allPeople.length,
      online,
      subscriptions,
    };
  }, [allPeople, isSubscribed]);

  const filteredPeople = useMemo(() => {
    return allPeople.filter(u => {
      if (filter === 'online') {
        if (!(u.status === 'online' && u.privacyLastSeen !== 'nobody')) return false;
      } else if (filter === 'subscriptions') {
        if (!isSubscribed(u.uid)) return false;
      }

      if (!normalizedQuery) return true;
      return (
        u.displayName.toLowerCase().includes(normalizedQuery) ||
        u.username.toLowerCase().includes(normalizedQuery) ||
        (u.bio && u.bio.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [allPeople, filter, normalizedQuery, isSubscribed]);

  const handleCallPerson = async (person: UserPublic) => {
    const chatId = await startDirectChatWithUser(person);
    const existingChat = chats.find(c => c.chatId === chatId) || {
      chatId,
      type: 'direct' as const,
      visibility: 'private' as const,
      name: person.displayName,
      description: '',
      avatarUrl: person.avatarUrl,
      ownerId: profile?.uid || '',
      peerUserId: person.uid,
      membersCount: 2,
      lastMessageText: '',
      lastMessageType: 'text' as const,
      lastMessageSenderId: profile?.uid || '',
    };
    await startCall('audio', existingChat);
  };

  return (
    <div className="flex-1 bg-[#F6F7F9] overflow-y-auto px-3 py-3 sm:p-5 select-none text-[#18191C] transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-3 pb-4">
        {/* Header & Search Card */}
        <div className="bg-white border border-[#E8EAED] rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-[18px] sm:text-xl font-bold tracking-tight text-[#18191C] whitespace-nowrap">
                Люди
              </h1>
              <span className="text-xs text-[#7B8494] font-medium tabular-nums whitespace-nowrap">
                · {counts.all}
                {counts.online > 0 ? ` · в сети ${counts.online}` : ''}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowFindModal(true)}
              className="min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Найти по @username</span>
              <span className="sm:hidden">Найти</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#7B8494] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              placeholder="Имя, @username или описание профиля..."
              className="w-full bg-[#F2F3F5] focus:bg-white border border-[#E8EAED] focus:border-[#0077FF] rounded-xl py-2.5 pl-10 pr-9 text-[16px] sm:text-xs text-[#18191C] placeholder-[#7B8494] focus:outline-none transition-colors"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                className="absolute right-2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-[#7B8494] hover:text-[#18191C] cursor-pointer"
                title="Очистить поиск"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Segmented Filter Tabs */}
          <div className="flex bg-[#F6F7F9] p-1 rounded-xl gap-1">
            {(
              [
                { id: 'all', label: 'Все', count: counts.all },
                { id: 'online', label: 'В сети', count: counts.online },
                { id: 'subscriptions', label: 'Подписки', count: counts.subscriptions },
              ] as const
            ).map(tab => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`flex-1 min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-[#0077FF] font-semibold shadow-2xs'
                      : 'text-[#7B8494] hover:text-[#18191C]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[11px] tabular-nums ${
                      isActive ? 'text-[#0077FF]' : 'text-[#7B8494]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* People List / Responsive Grid */}
        {filteredPeople.length === 0 ? (
          <div className="bg-white border border-[#E8EAED] rounded-2xl p-6 sm:p-8 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E5EBF1] text-[#0077FF] flex items-center justify-center mx-auto">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-[#18191C]">
              {normalizedQuery
                ? 'Никого не найдено'
                : filter === 'online'
                ? 'Сейчас никого нет в сети'
                : filter === 'subscriptions'
                ? 'У вас пока нет подписок'
                : 'Список людей пока пуст'}
            </div>
            <p className="text-xs text-[#7B8494] max-w-sm mx-auto leading-relaxed">
              {normalizedQuery
                ? `По запросу «${queryText.trim()}» пользователи не найдены. Попробуйте найти человека напрямую по @username.`
                : filter === 'subscriptions'
                ? 'Подпишитесь на интересных людей, чтобы следить за их записями в ленте «Новости».'
                : 'Добавьте собеседника по @username или электронной почте, чтобы начать общение.'}
            </p>
            <button
              type="button"
              onClick={() => {
                if (filter !== 'all' && !normalizedQuery) {
                  setFilter('all');
                } else {
                  setShowFindModal(true);
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {filter !== 'all' && !normalizedQuery ? 'Показать всех людей' : 'Найти по @username'}
              </span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            {filteredPeople.map(person => {
              const isOnline = person.status === 'online' && person.privacyLastSeen !== 'nobody';
              const subscribed = isSubscribed(person.uid);
              const statusText =
                person.privacyLastSeen === 'nobody'
                  ? 'статус скрыт'
                  : isOnline
                  ? 'в сети'
                  : 'недавно';

              return (
                <div
                  key={person.uid}
                  className="bg-white border border-[#E8EAED] rounded-2xl p-3.5 flex flex-col justify-between gap-3 transition-colors"
                >
                  {/* Person Identity Row */}
                  <div
                    onClick={() => openUserProfile(person)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openUserProfile(person);
                      }
                    }}
                    className="flex items-start gap-3 min-w-0 cursor-pointer group"
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        src={person.avatarUrl}
                        name={person.displayName}
                        className="w-12 h-12 rounded-full border border-[#E8EAED]"
                      />
                      {isOnline && (
                        <span
                          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#4BB34B] ring-2 ring-white"
                          title="В сети"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#18191C] group-hover:text-[#0077FF] truncate transition-colors">
                        {person.displayName}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#7B8494] truncate">
                        <span className="truncate">@{person.username}</span>
                        <span aria-hidden="true">·</span>
                        <span className={isOnline ? 'text-[#4BB34B] font-medium shrink-0' : 'shrink-0'}>
                          {statusText}
                        </span>
                      </div>
                      {person.bio && (
                        <p className="text-xs text-[#626D7A] mt-1 line-clamp-1 break-words">
                          {person.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mobile-Friendly Single-Line Actions */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => startDirectChatWithUser(person)}
                      className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>Написать</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSubscription(person.uid, 'user')}
                      className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                        subscribed
                          ? 'bg-[#E5EBF1] text-[#0077FF] hover:bg-[#DCE3EA]'
                          : 'bg-[#F6F7F9] hover:bg-[#EDEFEF] text-[#18191C]'
                      }`}
                    >
                      {subscribed ? (
                        <>
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>В подписках</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 shrink-0" />
                          <span>Подписаться</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCallPerson(person)}
                      className="min-h-[40px] min-w-[42px] px-2.5 py-2 rounded-xl bg-[#F6F7F9] hover:bg-[#EDEFEF] text-[#0077FF] flex items-center justify-center cursor-pointer transition-colors shrink-0"
                      title={`Позвонить ${person.displayName}`}
                      aria-label={`Позвонить ${person.displayName}`}
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showFindModal && (
        <CreateGroupModal
          defaultType="direct"
          onClose={() => setShowFindModal(false)}
        />
      )}
    </div>
  );
};
