import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Search, X } from 'lucide-react';
import { Avatar } from '../common/Avatar';

interface SearchModalProps {
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ onClose }) => {
  const {
    chats,
    publicChannelsAndGroups,
    posts,
    usersDirectory,
    startDirectChatWithUser,
    openUserProfile,
    setActiveChatId,
    setActiveTab,
  } = useChat();
  const { profile, isUserBlocked } = useAuth();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const allChats = Array.from(
    new Map([...chats, ...publicChannelsAndGroups].map(c => [c.chatId, c])).values()
  );
  const filteredChats = allChats.filter(c => c.name.toLowerCase().includes(q));
  const filteredUsers = usersDirectory.filter(
    u =>
      u.uid !== profile?.uid &&
      !isUserBlocked(u.uid) &&
      (u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
  );
  const filteredPosts = posts.filter(p => p.content.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-3 sm:pt-16 p-2 sm:p-4 z-50">
      <div className="w-full max-w-2xl bg-white border border-[#E1E3E6] rounded-2xl shadow-2xl overflow-hidden text-[#19191A] flex flex-col max-h-[90dvh] sm:max-h-[80vh]">
        {/* Search Header Input */}
        <div className="p-3.5 sm:p-4 border-b border-[#E1E3E6] flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-[#0077FF] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск людей, бесед, сообществ и записей..."
            className="w-full bg-transparent text-[#19191A] placeholder-[#818C99] focus:outline-none text-[16px] sm:text-sm"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="text-[#818C99] hover:text-[#19191A] min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-[#EDEFEF] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#EDEEF0]">
          {q === '' ? (
            <div className="text-center py-12 text-[#818C99] bg-white border border-[#E1E3E6] rounded-xl">
              <Search className="w-10 h-10 mx-auto mb-2.5 text-[#0077FF]/50" />
              <p className="text-xs">Введите имя, @username, название сообщества или текст записи</p>
            </div>
          ) : (
            <>
              {/* Users */}
              {filteredUsers.length > 0 && (
                <div className="bg-white border border-[#E1E3E6] rounded-xl p-3.5 space-y-2.5 shadow-xs">
                  <h3 className="text-xs font-semibold text-[#818C99]">
                    Люди ({filteredUsers.length})
                  </h3>
                  <div className="space-y-1.5">
                    {filteredUsers.map(foundUser => (
                      <div
                        key={foundUser.uid}
                        className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-[#F5F6F8] transition-colors"
                      >
                        <div
                          onClick={() => {
                            openUserProfile(foundUser);
                            onClose();
                          }}
                          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                        >
                          <Avatar
                            src={foundUser.avatarUrl}
                            name={foundUser.displayName}
                            className="w-10 h-10 rounded-full border border-[#E1E3E6] shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-[#2A5885] truncate">
                              {foundUser.displayName}
                            </h4>
                            <p className="text-xs text-[#818C99] truncate">
                              @{foundUser.username}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              openUserProfile(foundUser);
                              onClose();
                            }}
                            className="hidden sm:inline-flex px-3 py-2 rounded-lg bg-[#EDEFEF] hover:bg-[#E2E5E8] text-xs font-semibold text-[#2C3138] cursor-pointer"
                          >
                            Страница
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await startDirectChatWithUser(foundUser);
                              setActiveTab('chats');
                              onClose();
                            }}
                            className="px-3.5 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-xs font-semibold text-white cursor-pointer"
                          >
                            Написать
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chats & Groups */}
              {filteredChats.length > 0 && (
                <div className="bg-white border border-[#E1E3E6] rounded-xl p-3.5 space-y-2.5 shadow-xs">
                  <h3 className="text-xs font-semibold text-[#818C99]">
                    Диалоги, беседы и сообщества ({filteredChats.length})
                  </h3>
                  <div className="space-y-1.5">
                    {filteredChats.map(chat => (
                      <div
                        key={chat.chatId}
                        onClick={() => {
                          setActiveChatId(chat.chatId);
                          setActiveTab('chats');
                          onClose();
                        }}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#F5F6F8] cursor-pointer transition-colors"
                      >
                        <Avatar
                          src={chat.avatarUrl}
                          name={chat.name}
                          isSystemSecurity={
                            chat.peerUserId === 'mender_security_bot' ||
                            chat.chatId.startsWith('chat_system_security_') ||
                            chat.name === 'Mender Безопасность'
                          }
                          className="w-10 h-10 rounded-full border border-[#E1E3E6] shrink-0"
                        />
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-sm font-semibold text-[#19191A] truncate">{chat.name}</h4>
                          <p className="text-xs text-[#818C99] truncate">{chat.description || chat.lastMessageText}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts */}
              {filteredPosts.length > 0 && (
                <div className="bg-white border border-[#E1E3E6] rounded-xl p-3.5 space-y-2.5 shadow-xs">
                  <h3 className="text-xs font-semibold text-[#818C99]">
                    Записи в ленте ({filteredPosts.length})
                  </h3>
                  <div className="space-y-1.5">
                    {filteredPosts.map(post => (
                      <div
                        key={post.postId}
                        onClick={() => {
                          setActiveTab('feed');
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-[#F7F8FA] hover:bg-[#EDEFEF] border border-[#E1E3E6] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar
                            src={post.authorAvatar}
                            name={post.authorName}
                            className="w-6 h-6 rounded-full border border-[#E1E3E6] shrink-0"
                          />
                          <span className="text-xs font-semibold text-[#2A5885]">{post.authorName}</span>
                        </div>
                        <p className="text-xs text-[#19191A] line-clamp-2">{post.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredUsers.length === 0 && filteredChats.length === 0 && filteredPosts.length === 0 && (
                <div className="text-center py-12 text-[#818C99] bg-white border border-[#E1E3E6] rounded-xl">
                  <p className="text-xs">Ничего не найдено по запросу «{query}»</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
