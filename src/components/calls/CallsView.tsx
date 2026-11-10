import React from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, Users } from 'lucide-react';
import { UserPublic } from '../../types';

export const CallsView: React.FC = () => {
  const { callHistory, usersDirectory, chats, startCall, startDirectChatWithUser } = useChat();
  const { profile, isUserBlocked } = useAuth();

  const availableContacts = usersDirectory.filter(
    u => u.uid !== profile?.uid && !isUserBlocked(u.uid)
  );

  const formatDate = (ts?: any) => {
    if (!ts) return '';
    try {
      const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleCallUser = async (contact: UserPublic, type: 'audio' | 'video') => {
    const chatId = await startDirectChatWithUser(contact);
    const existingChat = chats.find(c => c.chatId === chatId) || {
      chatId,
      type: 'direct' as const,
      visibility: 'private' as const,
      name: contact.displayName,
      description: '',
      avatarUrl: contact.avatarUrl,
      ownerId: profile?.uid || '',
      peerUserId: contact.uid,
      membersCount: 2,
      lastMessageText: '',
      lastMessageType: 'text' as const,
      lastMessageSenderId: profile?.uid || '',
    };
    await startCall(type, existingChat);
  };

  return (
    <div className="flex-1 bg-[#EDEEF0] p-4 md:p-6 overflow-y-auto select-none text-[#19191A] transition-colors duration-300">
      <div className="max-w-[620px] mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-[#19191A] mb-1">Звонки</h1>
          <p className="text-xs text-[#818C99]">
            Аудио- и видеозвонки в реальном времени с демонстрацией экрана
          </p>
        </div>

        {/* Contacts Quick Call */}
        <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#818C99]">
            <Users className="w-3.5 h-3.5 text-[#0077FF]" />
            <span>Контакты для звонка</span>
          </div>
          {availableContacts.length === 0 ? (
            <p className="text-xs text-[#818C99] py-2">
              Пока нет других зарегистрированных пользователей для звонка.
            </p>
          ) : (
            <div className="space-y-3">
              {availableContacts.map(contact => (
                <div
                  key={contact.uid}
                  className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={contact.avatarUrl}
                      alt={contact.displayName}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-semibold text-[#2A5885] truncate">
                        {contact.displayName}
                      </h4>
                      <p className="text-xs text-[#818C99] truncate">
                        @{contact.username}
                      </p>
                    </div>
                  </div>
                  {/* Кнопки звонка */}
                  <div className="v7-btn-list">
                    <button
                      type="button"
                      onClick={() => handleCallUser(contact, 'audio')}
                      className="v7-btn text-xs py-2"
                    >
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>Аудиозвонок</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCallUser(contact, 'video')}
                      className="v7-btn-secondary text-xs py-2"
                    >
                      <Video className="w-4 h-4 text-[#0077FF] shrink-0" />
                      <span>Видеозвонок</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real Call History from Firestore */}
        <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3 shadow-xs">
          <div className="text-xs font-semibold text-[#818C99]">История звонков</div>
          {callHistory.length === 0 ? (
            <p className="text-xs text-[#818C99] py-3">
              История звонков пуста. Совершите первый аудио- или видеозвонок!
            </p>
          ) : (
            <div className="space-y-2">
              {callHistory.map(call => {
                const isOutgoing = call.callerId === profile?.uid;
                return (
                  <div
                    key={call.callId}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6]"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={call.callerAvatar}
                        alt={call.callerName}
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-[#19191A]">
                          {isOutgoing ? 'Исходящий вызов' : call.callerName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-[#818C99] mt-0.5">
                          {isOutgoing ? (
                            <PhoneOutgoing className="w-3.5 h-3.5 text-[#0077FF]" />
                          ) : (
                            <PhoneIncoming className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          <span>
                            {call.type === 'video' ? 'Видео' : 'Аудио'} · {formatDate(call.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

