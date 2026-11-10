import React, { useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Users,
  Radio,
  Plus,
  Globe,
  Lock,
  Camera,
  Loader2,
  MessageSquare,
  Mail,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import { VisibilityType, UserPublic } from '../../types';

interface CreateGroupModalProps {
  onClose: () => void;
  defaultType?: 'direct' | 'group' | 'channel';
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  onClose,
  defaultType = 'direct',
}) => {
  const {
    createGroupOrChannel,
    startDirectChatWithUser,
    startDirectChatByContact,
    usersDirectory,
  } = useChat();
  const { profile, isUserBlocked } = useAuth();

  const [type, setType] = useState<'direct' | 'group' | 'channel'>(defaultType);
  const [visibility, setVisibility] = useState<VisibilityType>(
    defaultType === 'channel' ? 'public' : 'private'
  );

  // Direct 1-on-1 chat creation fields
  const [contactEmailOrUsername, setContactEmailOrUsername] = useState('');
  const [contactDisplayName, setContactDisplayName] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Group / Channel fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableUsers = usersDirectory.filter(
    u => u.uid !== profile?.uid && !isUserBlocked(u.uid)
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSelectDirectUser = async (targetUser: UserPublic) => {
    if (isSubmitting) return;
    setErrorText(null);
    setIsSubmitting(true);
    try {
      await startDirectChatWithUser(targetUser);
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Не удалось открыть личный чат');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorText(null);

    if (type === 'direct') {
      if (!contactEmailOrUsername.trim()) {
        setErrorText('Введите почту или @username собеседника либо выберите человека из списка ниже');
        return;
      }
      setIsSubmitting(true);
      try {
        await startDirectChatByContact(
          contactEmailOrUsername.trim(),
          contactDisplayName.trim() || undefined
        );
        onClose();
      } catch (err: any) {
        setErrorText(err?.message || 'Не удалось создать личный чат');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const memberUsers = availableUsers.filter(u => selectedUserIds.includes(u.uid));
      await createGroupOrChannel({
        type,
        visibility,
        name: name.trim(),
        description: description.trim(),
        memberUsers,
        avatarFile,
      });
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Ошибка создания');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg bg-white border border-[#E1E3E6] rounded-2xl p-6 shadow-2xl text-[#19191A] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E5EBF1] text-[#0077FF] flex items-center justify-center">
              {type === 'direct' ? (
                <MessageSquare className="w-5 h-5" />
              ) : type === 'group' ? (
                <Users className="w-5 h-5" />
              ) : (
                <Radio className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#19191A]">
                {type === 'direct'
                  ? 'Новый личный диалог'
                  : type === 'group'
                  ? 'Создать беседу'
                  : 'Создать сообщество'}
              </h2>
              <p className="text-xs text-[#818C99]">
                {type === 'direct'
                  ? 'Переписка по почте, @username или из списка контактов'
                  : 'Настройте название, аватар и участников'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#818C99] hover:text-[#19191A] p-2 rounded-lg hover:bg-[#EDEFEF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Way Type Toggle: Личный чат | Беседа | Сообщество */}
        <div className="flex bg-[#EDEFEF] p-1 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => {
              setType('direct');
              setErrorText(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              type === 'direct'
                ? 'bg-white text-[#0077FF] shadow-xs'
                : 'text-[#656565] hover:text-[#19191A]'
            }`}
          >
            Личный диалог
          </button>
          <button
            type="button"
            onClick={() => {
              setType('group');
              setErrorText(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              type === 'group'
                ? 'bg-white text-[#0077FF] shadow-xs'
                : 'text-[#656565] hover:text-[#19191A]'
            }`}
          >
            Беседа
          </button>
          <button
            type="button"
            onClick={() => {
              setType('channel');
              setVisibility('public');
              setErrorText(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              type === 'channel'
                ? 'bg-white text-[#0077FF] shadow-xs'
                : 'text-[#656565] hover:text-[#19191A]'
            }`}
          >
            Сообщество
          </button>
        </div>

        {type === 'direct' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#656565] mb-1">
                  Почта или @username собеседника
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#818C99] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contactEmailOrUsername}
                    onChange={e => setContactEmailOrUsername(e.target.value)}
                    placeholder="Например: friend@mail.ru или @alex"
                    className="w-full bg-white border border-[#DCE1E6] rounded-lg py-2.5 pl-10 pr-3 text-[#19191A] text-sm focus:outline-none focus:border-[#0077FF]"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#656565] mb-1">
                  Имя собеседника (необязательно)
                </label>
                <input
                  type="text"
                  value={contactDisplayName}
                  onChange={e => setContactDisplayName(e.target.value)}
                  placeholder="Например: Алексей"
                  className="w-full bg-white border border-[#DCE1E6] rounded-lg py-2 px-3 text-[#19191A] text-sm focus:outline-none focus:border-[#0077FF]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !contactEmailOrUsername.trim()}
                className="w-full py-2.5 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>Начать диалог</span>
              </button>
            </div>

            {errorText && (
              <div className="p-3 rounded-xl bg-[#FFEAEA] border border-[#FFCCCC] text-[#E64646] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorText}</span>
              </div>
            )}

            {/* Or select from registered users */}
            <div>
              <label className="block text-xs font-semibold text-[#818C99] mb-2">
                Или выберите пользователя Mender ({availableUsers.length})
              </label>
              {availableUsers.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] text-xs text-[#818C99] text-center">
                  Введите почту или @username выше и нажмите «Начать диалог».
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableUsers.map(u => (
                    <button
                      type="button"
                      key={u.uid}
                      onClick={() => handleSelectDirectUser(u)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border bg-[#F7F8FA] border-[#E1E3E6] text-[#19191A] hover:bg-[#EDEFEF] transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatarUrl}
                          alt={u.displayName}
                          className="w-9 h-9 rounded-full object-cover border border-[#E1E3E6]"
                        />
                        <div>
                          <h4 className="text-sm font-semibold text-[#19191A]">{u.displayName}</h4>
                          <p className="text-xs text-[#818C99]">@{u.username}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-lg bg-[#E5EBF1] text-[#0077FF] text-xs font-semibold">
                        Написать
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar + Name */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-2xl bg-[#F2F3F5] border border-[#DCE1E6] hover:border-[#0077FF] flex items-center justify-center overflow-hidden relative shrink-0 cursor-pointer group"
                title="Загрузить аватар"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-[#818C99] group-hover:text-[#0077FF] transition-colors" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#656565] mb-1">
                  {type === 'group' ? 'Название беседы' : 'Название сообщества'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={
                    type === 'group' ? 'Например: Команда разработки' : 'Например: Mender News'
                  }
                  className="w-full bg-[#F2F3F5] border border-[#DCE1E6] rounded-lg py-2.5 px-3 text-[#19191A] text-sm focus:outline-none focus:border-[#0077FF] focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-xs font-semibold text-[#656565] mb-1.5">
                Тип доступа
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    visibility === 'public'
                      ? 'bg-[#E5EBF1] border-[#0077FF] text-[#19191A]'
                      : 'bg-[#F7F8FA] border-[#E1E3E6] text-[#656565] hover:text-[#19191A]'
                  }`}
                >
                  <Globe className="w-4 h-4 text-[#0077FF] shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Открытый</div>
                    <div className="text-[10px] text-[#818C99]">Виден в поиске и каталоге</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    visibility === 'private'
                      ? 'bg-[#E5EBF1] border-[#0077FF] text-[#19191A]'
                      : 'bg-[#F7F8FA] border-[#E1E3E6] text-[#656565] hover:text-[#19191A]'
                  }`}
                >
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Закрытый</div>
                    <div className="text-[10px] text-[#818C99]">Только для участников</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#656565] mb-1">
                Описание
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="О чём эта беседа или сообщество..."
                rows={2}
                className="w-full bg-[#F2F3F5] border border-[#DCE1E6] rounded-lg py-2 px-3 text-[#19191A] text-sm focus:outline-none focus:border-[#0077FF] focus:bg-white resize-none"
              />
            </div>

            {/* Registered Users Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#656565] mb-2">
                Добавить участников ({selectedUserIds.length} выбрано)
              </label>
              {availableUsers.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] text-xs text-[#818C99] text-center">
                  Пока нет других пользователей. Вы сможете пригласить их позже.
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {availableUsers.map(u => {
                    const isSelected = selectedUserIds.includes(u.uid);
                    return (
                      <div
                        key={u.uid}
                        onClick={() => toggleUser(u.uid)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#E5EBF1] border-[#0077FF] text-[#19191A]'
                            : 'bg-[#F7F8FA] border-[#E1E3E6] text-[#19191A] hover:bg-[#EDEFEF]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatarUrl}
                            alt={u.displayName}
                            className="w-8 h-8 rounded-full object-cover border border-[#E1E3E6]"
                          />
                          <div>
                            <h4 className="text-sm font-medium text-[#19191A]">{u.displayName}</h4>
                            <p className="text-xs text-[#818C99]">@{u.username}</p>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            isSelected
                              ? 'bg-[#0077FF] border-[#0077FF] text-white'
                              : 'border-[#DCE1E6] bg-white'
                          }`}
                        >
                          {isSelected && <Plus className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-[#E1E3E6]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-[#656565] hover:text-[#19191A] hover:bg-[#EDEFEF] text-xs font-semibold transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-5 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{type === 'group' ? 'Создать беседу' : 'Создать сообщество'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
