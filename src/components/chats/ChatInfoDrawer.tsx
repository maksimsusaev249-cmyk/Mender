import React, { useState } from 'react';
import {
  ArrowLeft,
  X,
  UserPlus,
  Loader2,
  Users,
  Crown,
  Shield,
  ShieldCheck,
  UserMinus,
  Sparkles,
  Pin,
  VolumeX,
  Ban,
  ShieldAlert,
  Image as ImageIcon,
  Film,
  Mic,
  Phone,
  Video,
  Search,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react';
import { Chat, ChatMember, Message, UserPublic } from '../../types';
import { getSyncCachedMediaUrl } from '../../utils/media';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  moderator: 'Модератор',
  member: 'Участник',
};

interface ChatInfoDrawerProps {
  activeChat: Chat;
  otherUser?: UserPublic;
  blockedOtherUser: boolean;
  myUid?: string;
  activeChatMembers: ChatMember[];
  candidateUsersToAdd: UserPublic[];
  messages: Message[];
  canManageMembers: boolean;
  isOwnerOrAdmin: boolean;
  onClose: () => void;
  onOpenUserProfile: (userOrUid: UserPublic | string) => void;
  onStartCall: (type: 'audio' | 'video', targetChat: Chat) => void;
  onOpenWallpaperModal: () => void;
  onTogglePinChat: (chatId: string) => void;
  onToggleMuteChat: (chatId: string) => void;
  onToggleArchiveChat: (chatId: string) => void;
  onDeleteChatForMe: (chatId: string) => Promise<void>;
  onDeleteChatForBoth: (chatId: string) => Promise<void>;
  onBlockToggle: (uid: string, currentlyBlocked: boolean) => void;
  onOpenReportModal: () => void;
  onOpenSearchInChat: () => void;
  onOpenLightbox: (url: string) => void;
  onAddMember: (
    chatId: string,
    contactOrUser: UserPublic | string,
    role: 'member' | 'moderator' | 'admin'
  ) => Promise<void>;
  onUpdateMemberRole: (
    chatId: string,
    memberUid: string,
    newRole: 'admin' | 'moderator' | 'member'
  ) => Promise<void>;
  onRemoveMember: (chatId: string, memberUid: string) => Promise<void>;
}

export const ChatInfoDrawer: React.FC<ChatInfoDrawerProps> = ({
  activeChat,
  otherUser,
  blockedOtherUser,
  myUid,
  activeChatMembers,
  candidateUsersToAdd,
  messages,
  canManageMembers,
  isOwnerOrAdmin,
  onClose,
  onOpenUserProfile,
  onStartCall,
  onOpenWallpaperModal,
  onTogglePinChat,
  onToggleMuteChat,
  onToggleArchiveChat,
  onDeleteChatForMe,
  onDeleteChatForBoth,
  onBlockToggle,
  onOpenReportModal,
  onOpenSearchInChat,
  onOpenLightbox,
  onAddMember,
  onUpdateMemberRole,
  onRemoveMember,
}) => {
  const [drawerTab, setDrawerTab] = useState<'overview' | 'media'>('overview');
  const [deletingChat, setDeletingChat] = useState(false);
  const [newMemberInput, setNewMemberInput] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'moderator' | 'admin'>('member');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberFeedback, setAddMemberFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const isSystemChat =
    activeChat.peerUserId === 'mender_security_bot' ||
    activeChat.chatId.startsWith('chat_system_security_');
  const canDeleteForBoth =
    !isSystemChat &&
    (activeChat.type === 'direct' || (Boolean(myUid) && activeChat.ownerId === myUid));

  const mediaMessages = messages.filter(
    m => m.type === 'image' || m.type === 'video' || m.type === 'video_circle'
  );
  const voiceMessages = messages.filter(m => m.type === 'voice');

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberInput.trim() || addingMember) return;
    setAddingMember(true);
    setAddMemberFeedback(null);
    try {
      await onAddMember(activeChat.chatId, newMemberInput.trim(), newMemberRole);
      setNewMemberInput('');
      setAddMemberFeedback({
        type: 'ok',
        text: `Участник добавлен с ролью «${ROLE_LABELS[newMemberRole]}»!`,
      });
    } catch {
      setAddMemberFeedback({
        type: 'err',
        text: 'Не удалось добавить участника',
      });
    } finally {
      setAddingMember(false);
    }
  };

  const handleQuickAddUser = async (userObj: UserPublic) => {
    if (addingMember) return;
    setAddingMember(true);
    setAddMemberFeedback(null);
    try {
      await onAddMember(activeChat.chatId, userObj, newMemberRole);
      setAddMemberFeedback({
        type: 'ok',
        text: `${userObj.displayName} добавлен(а) как «${ROLE_LABELS[newMemberRole]}»!`,
      });
    } catch {
      setAddMemberFeedback({
        type: 'err',
        text: 'Ошибка добавления участника',
      });
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white border-l border-[#E1E3E6] shadow-2xl h-full flex flex-col overflow-hidden text-[#19191A]"
      >
        {/* Top bar */}
        <div className="bg-white border-b border-[#E1E3E6] px-4 py-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#0077FF]" />
            <span>Назад</span>
          </button>
          <h3 className="text-sm font-bold text-[#19191A] truncate px-2">Информация</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#F2F3F5] cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile summary + quick action strip */}
        <div className="px-5 pt-5 pb-4 border-b border-[#E1E3E6] bg-[#F7F8FA] shrink-0">
          <div className="flex items-center gap-3.5">
            <img
              src={activeChat.avatarUrl}
              alt={activeChat.name}
              className="w-16 h-16 rounded-full object-cover border border-[#E1E3E6] shrink-0 bg-white"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-base font-bold text-[#19191A] truncate">{activeChat.name}</h4>
              <div className="text-xs text-[#818C99] flex items-center gap-1.5 mt-0.5">
                <span>
                  {activeChat.type === 'direct'
                    ? otherUser?.username
                      ? `@${otherUser.username}`
                      : 'Личный диалог'
                    : activeChat.type === 'group'
                    ? 'Беседа'
                    : 'Канал'}
                </span>
                {activeChat.type !== 'direct' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {Math.max(activeChat.membersCount || 1, activeChatMembers.length)} участников
                    </span>
                  </>
                )}
              </div>
              {activeChat.description && (
                <p className="text-xs text-[#626D7A] mt-1 line-clamp-2">{activeChat.description}</p>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {activeChat.type !== 'channel' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartCall('audio', activeChat);
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-white border border-[#E1E3E6] hover:border-[#0077FF]/40 text-[#19191A] text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-[#0077FF]" />
                  <span>Аудио</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartCall('video', activeChat);
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-white border border-[#E1E3E6] hover:border-[#0077FF]/40 text-[#19191A] text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <Video className="w-4 h-4 text-[#0077FF]" />
                  <span>Видео</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSearchInChat();
              }}
              className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-white border border-[#E1E3E6] hover:border-[#0077FF]/40 text-[#19191A] text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#0077FF]" />
              <span>Поиск</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleMuteChat(activeChat.chatId)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer ${
                activeChat.isMuted
                  ? 'bg-[#E5EBF1] border-[#0077FF]/40 text-[#0077FF]'
                  : 'bg-white border-[#E1E3E6] hover:border-[#0077FF]/40 text-[#19191A]'
              }`}
            >
              <VolumeX className="w-4 h-4 text-[#0077FF]" />
              <span>{activeChat.isMuted ? 'Вкл. звук' : 'Без звука'}</span>
            </button>
          </div>

          {/* Drawer Tabs */}
          <div className="flex bg-[#EDEFEF] p-1 rounded-xl mt-4">
            <button
              type="button"
              onClick={() => setDrawerTab('overview')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                drawerTab === 'overview'
                  ? 'bg-white text-[#0077FF] shadow-2xs'
                  : 'text-[#626D7A] hover:text-[#19191A]'
              }`}
            >
              {activeChat.type === 'direct' ? 'Управление' : `Участники (${activeChatMembers.length})`}
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab('media')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer tabular-nums ${
                drawerTab === 'media'
                  ? 'bg-white text-[#0077FF] shadow-2xs'
                  : 'text-[#626D7A] hover:text-[#19191A]'
              }`}
            >
              Медиа ({mediaMessages.length + voiceMessages.length})
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {drawerTab === 'media' ? (
            <div className="space-y-4">
              {mediaMessages.length === 0 && voiceMessages.length === 0 ? (
                <div className="py-10 text-center bg-[#F7F8FA] border border-[#E1E3E6] rounded-2xl px-4">
                  <ImageIcon className="w-8 h-8 text-[#818C99] mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[#19191A]">Медиафайлов пока нет</p>
                  <p className="text-[11px] text-[#818C99] mt-1">
                    Отправленные в этом чате фото, видео и голосовые появятся здесь.
                  </p>
                </div>
              ) : (
                <>
                  {mediaMessages.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-[#818C99] mb-2 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-[#0077FF]" />
                        <span>Фото и видео ({mediaMessages.length})</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {mediaMessages.map(m => {
                          const url = getSyncCachedMediaUrl(m.mediaUrl);
                          if (m.type === 'image') {
                            return (
                              <button
                                key={m.messageId}
                                type="button"
                                onClick={() => url && onOpenLightbox(url)}
                                className="aspect-square rounded-xl overflow-hidden bg-[#EDEFEF] border border-[#E1E3E6] cursor-pointer group"
                              >
                                <img
                                  src={url}
                                  alt={m.content || 'Фото'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </button>
                            );
                          }
                          return (
                            <div
                              key={m.messageId}
                              className="aspect-square rounded-xl overflow-hidden bg-black border border-[#E1E3E6] relative"
                            >
                              <video src={url} controls className="w-full h-full object-cover" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {voiceMessages.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-[#818C99] mb-2 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-[#0077FF]" />
                        <span>Голосовые ({voiceMessages.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {voiceMessages.map(m => (
                          <div
                            key={m.messageId}
                            className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center justify-between text-xs"
                          >
                            <span className="font-medium text-[#19191A] truncate">
                              {m.senderName}
                            </span>
                            <span className="font-mono text-[11px] text-[#818C99] tabular-nums shrink-0">
                              0:{(m.duration || 1).toString().padStart(2, '0')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {/* Add Members in Groups/Channels */}
              {activeChat.type !== 'direct' && (
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0077FF]">
                    <UserPlus className="w-3.5 h-3.5 text-[#0077FF]" />
                    <span>Добавить участников</span>
                  </div>

                  <form onSubmit={handleAddMemberSubmit} className="space-y-2.5">
                    <input
                      type="text"
                      value={newMemberInput}
                      onChange={e => setNewMemberInput(e.target.value)}
                      placeholder="Почта, @username или имя..."
                      className="v7-input text-xs py-2"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#656565]">Права:</span>
                      <select
                        value={newMemberRole}
                        onChange={e =>
                          setNewMemberRole(e.target.value as 'member' | 'moderator' | 'admin')
                        }
                        className="bg-white border border-[#E1E3E6] rounded-lg text-xs text-[#19191A] px-3 py-1.5 focus:outline-none focus:border-[#0077FF]"
                      >
                        <option value="member">Участник</option>
                        <option value="moderator">Модератор</option>
                        <option value="admin">Администратор</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={addingMember || !newMemberInput.trim()}
                      className="v7-btn text-xs py-2"
                    >
                      {addingMember ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <UserPlus className="w-4 h-4 shrink-0" />
                      )}
                      <span>+ Добавить ({ROLE_LABELS[newMemberRole]})</span>
                    </button>
                  </form>

                  {addMemberFeedback && (
                    <div
                      className={`text-xs px-3 py-2 rounded-xl border ${
                        addMemberFeedback.type === 'ok'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      {addMemberFeedback.text}
                    </div>
                  )}

                  {candidateUsersToAdd.length > 0 && (
                    <div className="pt-2 border-t border-[#E1E3E6] space-y-2">
                      <div className="text-[11px] font-semibold text-[#818C99]">
                        Быстро добавить из людей:
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {candidateUsersToAdd.map(u => (
                          <div
                            key={u.uid}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-[#E1E3E6]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={u.avatarUrl}
                                alt={u.displayName}
                                className="w-7 h-7 rounded-full object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#19191A] truncate">
                                  {u.displayName}
                                </div>
                                <div className="text-[10px] text-[#818C99] truncate">
                                  @{u.username}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleQuickAddUser(u)}
                              disabled={addingMember}
                              className="px-2.5 py-1 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-[11px] font-medium cursor-pointer shrink-0"
                            >
                              + Добавить
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Members list */}
              {activeChat.type !== 'direct' && (
                <div>
                  <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#818C99]">
                    <Users className="w-3.5 h-3.5 text-[#0077FF]" />
                    <span>Участники ({activeChatMembers.length})</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {activeChatMembers.map(member => (
                      <div
                        key={member.userId}
                        className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center justify-between gap-2"
                      >
                        <div
                          onClick={() => onOpenUserProfile(member.userId)}
                          className="flex items-center gap-2.5 overflow-hidden cursor-pointer group"
                        >
                          <img
                            src={member.avatarUrl}
                            alt={member.displayName}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <div className="overflow-hidden">
                            <div className="text-xs font-semibold text-[#19191A] group-hover:text-[#0077FF] truncate">
                              {member.displayName}
                            </div>
                            <div className="text-[10px] text-[#0077FF] font-medium flex items-center gap-1">
                              {member.role === 'owner' && (
                                <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                              )}
                              {member.role === 'admin' && (
                                <Shield className="w-3 h-3 text-[#0077FF] shrink-0" />
                              )}
                              {member.role === 'moderator' && (
                                <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                              )}
                              <span>{ROLE_LABELS[member.role] || member.role}</span>
                            </div>
                          </div>
                        </div>

                        {canManageMembers &&
                          member.userId !== myUid &&
                          member.role !== 'owner' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isOwnerOrAdmin && (
                                <select
                                  value={member.role}
                                  onChange={e =>
                                    onUpdateMemberRole(
                                      activeChat.chatId,
                                      member.userId,
                                      e.target.value as 'admin' | 'moderator' | 'member'
                                    )
                                  }
                                  className="bg-white border border-[#E1E3E6] rounded-lg text-[11px] text-[#19191A] px-2 py-1 focus:outline-none focus:border-[#0077FF]"
                                >
                                  <option value="member">Участник</option>
                                  <option value="moderator">Модератор</option>
                                  <option value="admin">Администратор</option>
                                </select>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemoveMember(activeChat.chatId, member.userId)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                                title="Удалить из группы"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings buttons */}
              <div className="v7-btn-list">
                {otherUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUserProfile(otherUser);
                    }}
                    className="v7-btn text-xs"
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Открыть профиль собеседника</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWallpaperModal();
                  }}
                  className="v7-btn-secondary text-xs"
                >
                  <Sparkles className="w-4 h-4 text-[#0077FF] shrink-0" />
                  <span>Оформление и фон чата</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTogglePinChat(activeChat.chatId)}
                  className="v7-btn-secondary text-xs"
                >
                  <Pin className="w-4 h-4 text-[#0077FF] shrink-0" />
                  <span>{activeChat.isPinned ? 'Открепить чат' : 'Закрепить чат'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleArchiveChat(activeChat.chatId)}
                  className="v7-btn-secondary text-xs"
                >
                  {activeChat.isArchived ? (
                    <ArchiveRestore className="w-4 h-4 text-[#0077FF] shrink-0" />
                  ) : (
                    <Archive className="w-4 h-4 text-[#0077FF] shrink-0" />
                  )}
                  <span>{activeChat.isArchived ? 'Вернуть из архива' : 'В архив'}</span>
                </button>
              </div>

              {/* Block & Report & Delete */}
              <div className="pt-4 border-t border-[#E1E3E6] v7-btn-list">
                {otherUser && (
                  <button
                    type="button"
                    onClick={() => onBlockToggle(otherUser.uid, blockedOtherUser)}
                    className="v7-btn-danger text-xs"
                  >
                    <Ban className="w-4 h-4 shrink-0" />
                    <span>
                      {blockedOtherUser
                        ? 'Разблокировать пользователя'
                        : 'Заблокировать пользователя'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenReportModal}
                  className="v7-btn-secondary text-xs"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Пожаловаться</span>
                </button>

                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Удалить чат</span>
                  </div>
                  <button
                    type="button"
                    disabled={deletingChat}
                    onClick={async () => {
                      setDeletingChat(true);
                      try {
                        await onDeleteChatForMe(activeChat.chatId);
                        onClose();
                      } finally {
                        setDeletingChat(false);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E1E3E6] hover:bg-[#EDEFEF] text-left cursor-pointer disabled:opacity-50"
                  >
                    <div className="text-xs font-bold text-[#19191A]">Удалить у себя</div>
                    <div className="text-[10px] text-[#818C99]">
                      Чат исчезнет только из вашего списка
                    </div>
                  </button>
                  {canDeleteForBoth && (
                    <button
                      type="button"
                      disabled={deletingChat}
                      onClick={async () => {
                        setDeletingChat(true);
                        try {
                          await onDeleteChatForBoth(activeChat.chatId);
                          onClose();
                        } finally {
                          setDeletingChat(false);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-left cursor-pointer disabled:opacity-50"
                    >
                      <div className="text-xs font-bold text-rose-500">
                        {activeChat.type === 'direct' ? 'Удалить у двоих' : 'Удалить у всех'}
                      </div>
                      <div className="text-[10px] text-rose-500/80">
                        {activeChat.type === 'direct'
                          ? 'Удалит переписку у вас и у собеседника'
                          : 'Удалит чат и сообщения для всех участников'}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
