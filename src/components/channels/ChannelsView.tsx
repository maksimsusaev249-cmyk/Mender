import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Radio, Users, Plus, Check, Globe, MessageSquare } from 'lucide-react';
import { CreateGroupModal } from '../chats/CreateGroupModal';
import { Chat } from '../../types';

export const ChannelsView: React.FC = () => {
  const { publicChannelsAndGroups, chats, setActiveChatId, setActiveTab, joinPublicChat, leaveChat } = useChat();
  const { profile, toggleSubscription, isSubscribed } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleToggleMembership = async (channel: Chat, isMember: boolean) => {
    if (isMember) {
      await leaveChat(channel.chatId);
    } else {
      await joinPublicChat(channel);
    }
    await toggleSubscription(channel.chatId, 'channel');
  };

  return (
    <div className="flex-1 bg-[#EDEEF0] p-4 md:p-6 overflow-y-auto select-none text-[#19191A] transition-colors duration-300">
      <div className="max-w-[620px] mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold text-[#19191A]">Сообщества</h1>
              <p className="text-xs text-[#818C99]">
                Открытые группы и каналы
              </p>
            </div>
          </div>

          <div className="v7-btn-list pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="v7-btn"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Создать сообщество</span>
            </button>
          </div>
        </div>

        {/* Channels List */}
        {publicChannelsAndGroups.length === 0 ? (
          <div className="bg-white border border-[#E1E3E6] rounded-xl p-6 text-center space-y-3 shadow-xs">
            <Radio className="w-10 h-10 text-[#0077FF] mx-auto opacity-70" />
            <h3 className="text-sm font-semibold text-[#19191A]">Сообществ пока нет</h3>
            <p className="text-xs text-[#818C99] max-w-md mx-auto">
              Создайте первое публичное сообщество, чтобы делиться новостями и записями с подписчиками.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {publicChannelsAndGroups.map(channel => {
              const isJoined =
                chats.some(c => c.chatId === channel.chatId) || isSubscribed(channel.chatId);
              return (
                <div
                  key={channel.chatId}
                  className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-col gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={channel.avatarUrl}
                      alt={channel.name}
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-semibold text-[#2A5885] hover:underline cursor-pointer">
                          {channel.name}
                        </h3>
                        <Globe className="w-3.5 h-3.5 text-[#818C99]" />
                      </div>
                      <p className="text-xs text-[#818C99] mt-0.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#0077FF]" />
                        <span>{channel.membersCount} подписчиков</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-[#19191A] leading-relaxed">
                    {channel.description || 'Публичное сообщество'}
                  </p>

                  {/* Кнопки канала */}
                  <div className="v7-btn-list pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatId(channel.chatId);
                        setActiveTab('chats');
                      }}
                      className="v7-btn"
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>Перейти в сообщество</span>
                    </button>

                    {channel.ownerId !== profile?.uid && (
                      <button
                        type="button"
                        onClick={() => handleToggleMembership(channel, isJoined)}
                        className="v7-btn-secondary"
                      >
                        {isJoined ? (
                          <Check className="w-4 h-4 text-[#0077FF] shrink-0" />
                        ) : (
                          <Plus className="w-4 h-4 text-[#0077FF] shrink-0" />
                        )}
                        <span>{isJoined ? 'Вы подписаны' : 'Подписаться'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} defaultType="channel" />
      )}
    </div>
  );
};

