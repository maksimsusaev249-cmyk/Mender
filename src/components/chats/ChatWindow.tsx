import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  Phone,
  Video,
  Send,
  Image as ImageIcon,
  Mic,
  Smile,
  Paperclip,
  MoreVertical,
  Play,
  Pause,
  CheckCheck,
  Sparkles,
  Square,
  ShieldAlert,
  Ban,
  Pin,
  VolumeX,
  Users,
  Crown,
  Shield,
  ShieldCheck,
  UserMinus,
  UserPlus,
  ArrowLeft,
  Loader2,
  X,
  Camera,
  Heart,
  Trash2,
  Pencil,
  Check,
  Reply,
  Forward,
  EyeOff,
} from 'lucide-react';
import { WallpaperStudioModal } from '../wallpapers/WallpaperStudioModal';
import { CreateGroupModal } from './CreateGroupModal';
import { MENDER_WALLPAPERS } from '../../data/menderWallpapers';
import { resolvePlayableMediaUrl, getSyncCachedMediaUrl } from '../../utils/media';
import { Message, ChatMember, UserPublic, Chat } from '../../types';

const QUICK_REACTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🎉'];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  moderator: 'Модератор',
  member: 'Участник',
};

export const ChatWindow: React.FC = () => {
  const {
    chats,
    activeChat,
    setActiveChatId,
    messages,
    messageLikesByMe,
    messageReactions,
    deletedForMeMessageIds,
    activeChatMembers,
    usersDirectory,
    sendMessage,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    reactToMessage,
    forwardMessageToTarget,
    startCall,
    togglePinChat,
    toggleMuteChat,
    addMemberToChat,
    updateMemberRole,
    removeMemberFromChat,
    openUserProfile,
    joinPublicChat,
    getEffectiveWallpaper,
  } = useChat();
  const { profile, blockUser, unblockUser, isUserBlocked, submitReport } = useAuth();

  const [inputText, setInputText] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    msg: Message;
    x: number;
    y: number;
  } | null>(null);
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showNewDirectModal, setShowNewDirectModal] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const textInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Add Member to Group / Channel state
  const [newMemberInput, setNewMemberInput] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'moderator' | 'admin'>('member');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberFeedback, setAddMemberFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Voice & Video Circle Real Recording States
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingVideoCircle, setIsRecordingVideoCircle] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const liveVideoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  // Audio playback
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.chatId, messages.length]);

  useEffect(() => {
    setEditingMessage(null);
    setReplyingToMessage(null);
    setContextMenu(null);
    setInputText('');
    setAddMemberFeedback(null);
  }, [activeChat?.chatId]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (!activeChat) {
    const globalWpConfig = getEffectiveWallpaper('global');
    const globalBuiltin = MENDER_WALLPAPERS.find(w => w.id === globalWpConfig?.wallpaperId);
    const isGlobalSolidColor = globalWpConfig?.sourceType === 'color';
    const globalBgColor = isGlobalSolidColor
      ? globalWpConfig?.backgroundColor || '#EDEEF0'
      : '#EDEEF0';
    const globalBgUrl = !globalWpConfig
      ? ''
      : isGlobalSolidColor
      ? ''
      : globalWpConfig.sourceType === 'custom' && globalWpConfig.imageUrl
      ? globalWpConfig.imageUrl
      : globalBuiltin?.svgDataUrl || '';
    const globalDimming = globalWpConfig ? globalWpConfig.dimming : 0;
    const globalBrightness = globalWpConfig ? globalWpConfig.brightness : 100;
    const globalBlur = globalWpConfig ? globalWpConfig.blur : 0;
    const globalScale = globalWpConfig ? globalWpConfig.scale : 100;
    const globalPosX = globalWpConfig ? globalWpConfig.posX : 0;
    const globalPosY = globalWpConfig ? globalWpConfig.posY : 0;

    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-[#19191A] p-6 select-none relative overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: isGlobalSolidColor ? globalBgColor : '#EDEEF0' }}
      >
        {!isGlobalSolidColor && globalBgUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-300"
            style={{
              backgroundImage: `url("${globalBgUrl}")`,
              filter: `brightness(${globalBrightness}%) blur(${globalBlur}px)`,
              transform: `scale(${Math.max(globalScale / 100, 1 + globalBlur * 0.012)}) translate(${globalPosX}%, ${globalPosY}%)`,
            }}
          />
        )}
        {globalWpConfig && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{ backgroundColor: `rgba(237, 238, 240, ${globalDimming / 100})` }}
          />
        )}

        <div className="relative z-10 flex flex-col items-center max-w-sm text-center bg-white border border-[#E1E3E6] rounded-2xl p-7 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#0077FF]/10 text-[#0077FF] flex items-center justify-center mb-4">
            <Smile className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#19191A] mb-1.5">Выберите чат или начните диалог</h3>
          <p className="text-xs text-[#818C99] mb-5 leading-relaxed">
            Общайтесь в личных сообщениях, создавайте беседы и каналы или настройте фоны чатов.
          </p>
          <div className="v7-btn-list">
            <button
              type="button"
              onClick={() => setShowNewDirectModal(true)}
              className="v7-btn"
            >
              <span>+ Начать диалог</span>
            </button>
            <button
              type="button"
              onClick={() => setShowWallpaperModal(true)}
              className="v7-btn-secondary"
            >
              <Sparkles className="w-4 h-4 text-[#0077FF] shrink-0" />
              <span>Фоны чатов (Mender)</span>
            </button>
          </div>
        </div>
        {showNewDirectModal && (
          <CreateGroupModal defaultType="direct" onClose={() => setShowNewDirectModal(false)} />
        )}
        {showWallpaperModal && <WallpaperStudioModal onClose={() => setShowWallpaperModal(false)} />}
      </div>
    );
  }

  const myMemberRecord = activeChatMembers.find(m => m.userId === profile?.uid);
  const isOwnerOrAdmin =
    myMemberRecord?.role === 'owner' ||
    myMemberRecord?.role === 'admin' ||
    activeChat.ownerId === profile?.uid;
  const isModerator = myMemberRecord?.role === 'moderator';
  const canManageMembers = isOwnerOrAdmin || isModerator;
  const canPostInChannel = activeChat.type !== 'channel' || isOwnerOrAdmin || isModerator;
  const isMember =
    Boolean(myMemberRecord) ||
    activeChat.ownerId === profile?.uid ||
    activeChat.peerUserId === profile?.uid;

  // Other participant in direct chat
  const otherPeerId =
    activeChat.ownerId === profile?.uid ? activeChat.peerUserId : activeChat.ownerId;
  const otherUser =
    activeChat.type === 'direct'
      ? usersDirectory.find(u => u.uid === otherPeerId)
      : undefined;
  const blockedOtherUser = otherUser ? isUserBlocked(otherUser.uid) : false;

  // Candidates from usersDirectory not yet in this group/channel
  const memberIdsSet = new Set(activeChatMembers.map(m => m.userId));
  const candidateUsersToAdd = usersDirectory.filter(
    u => u.uid !== profile?.uid && !memberIdsSet.has(u.uid) && !isUserBlocked(u.uid)
  );

  // Effective Wallpaper Config for this Chat
  const effectiveWallpaper = getEffectiveWallpaper(activeChat.chatId);
  const builtinPreset =
    effectiveWallpaper?.sourceType === 'builtin'
      ? MENDER_WALLPAPERS.find(w => w.id === effectiveWallpaper.wallpaperId) || MENDER_WALLPAPERS[0]
      : MENDER_WALLPAPERS[0];

  const openMessageContextMenu = (clientX: number, clientY: number, msg: Message) => {
    const menuWidth = 248;
    const menuHeight = 310;
    const clampedX = Math.max(12, Math.min(clientX, window.innerWidth - menuWidth - 12));
    const clampedY = Math.max(12, Math.min(clientY, window.innerHeight - menuHeight - 12));
    setContextMenu({ msg, x: clampedX, y: clampedY });
  };

  const handleMessageContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    e.stopPropagation();
    openMessageContextMenu(e.clientX, e.clientY, msg);
  };

  const handleMessageTouchStart = (e: React.TouchEvent, msg: Message) => {
    const touch = e.touches[0];
    if (!touch) return;
    const x = touch.clientX;
    const y = touch.clientY;
    touchStartPosRef.current = { x, y };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      try {
        navigator.vibrate?.(15);
      } catch {
        // ignore vibration unsupported
      }
      openMessageContextMenu(x, y, msg);
    }, 450);
  };

  const handleMessageTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || blockedOtherUser) return;
    const text = inputText.trim();
    setInputText('');

    if (editingMessage) {
      const targetMsg = editingMessage;
      setEditingMessage(null);
      await editMessage(targetMsg.messageId, text);
      return;
    }

    const replyTarget = replyingToMessage;
    setReplyingToMessage(null);

    await sendMessage({
      content: text,
      type: 'text',
      replyTo: replyTarget
        ? {
            messageId: replyTarget.messageId,
            senderName: replyTarget.senderName,
            content: replyTarget.content,
          }
        : null,
    });
  };

  const handleStartEditMessage = (msg: Message) => {
    if (msg.senderId !== profile?.uid) return;
    setReplyingToMessage(null);
    setEditingMessage(msg);
    setInputText(msg.content);
    setTimeout(() => textInputRef.current?.focus(), 50);
  };

  const handleStartReplyMessage = (msg: Message) => {
    setEditingMessage(null);
    setReplyingToMessage(msg);
    setTimeout(() => textInputRef.current?.focus(), 50);
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberInput.trim() || addingMember) return;
    setAddingMember(true);
    setAddMemberFeedback(null);
    try {
      await addMemberToChat(activeChat.chatId, newMemberInput.trim(), newMemberRole);
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
      await addMemberToChat(activeChat.chatId, userObj, newMemberRole);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    setShowAttachmentsMenu(false);
    try {
      const isVideo = file.type.startsWith('video/');
      await sendMessage({
        content: isVideo ? 'Видеозапись' : 'Фотография',
        type: isVideo ? 'video' : 'image',
        mediaBlobOrFile: file,
      });
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Real Voice Recording via MediaRecorder
  const startVoiceRecording = async () => {
    setRecordingError(null);
    setShowAttachmentsMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.start();
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch {
      setRecordingError('Доступ к микрофону отклонён браузером или устройство не найдено.');
    }
  };

  // Real Circular Video Recording via MediaRecorder
  const startVideoCircleRecording = async () => {
    setRecordingError(null);
    setShowAttachmentsMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: 'user' },
        audio: true,
      });
      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.start();
      setIsRecordingVideoCircle(true);
      setRecordingSeconds(0);
      setTimeout(() => {
        if (liveVideoPreviewRef.current) {
          liveVideoPreviewRef.current.srcObject = stream;
        }
      }, 50);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch {
      setRecordingError('Доступ к камере/микрофону отклонён браузером.');
    }
  };

  const stopAndSendRecording = async (cancel = false) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    const isVideo = isRecordingVideoCircle;
    const duration = Math.max(1, recordingSeconds);

    setIsRecordingVoice(false);
    setIsRecordingVideoCircle(false);
    setRecordingSeconds(0);

    if (!recorder) return;

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve();
    });

    recordingStreamRef.current?.getTracks().forEach(t => t.stop());
    recordingStreamRef.current = null;

    if (cancel || recordedChunksRef.current.length === 0) return;

    setUploadingMedia(true);
    try {
      const mimeType = isVideo ? 'video/webm' : 'audio/webm';
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      await sendMessage({
        content: isVideo ? 'Видеокружочек' : 'Голосовое сообщение',
        type: isVideo ? 'video_circle' : 'voice',
        mediaBlobOrFile: blob,
        duration,
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const togglePlayVoice = async (msgId: string, mediaUrl?: string) => {
    if (!mediaUrl) return;
    if (playingVoiceId === msgId) {
      audioPlayerRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    const resolved = await resolvePlayableMediaUrl(mediaUrl);
    if (!resolved) return;
    const audio = new Audio(resolved);
    audioPlayerRef.current = audio;
    audio.onended = () => setPlayingVoiceId(null);
    audio.play().catch(() => setPlayingVoiceId(null));
    setPlayingVoiceId(msgId);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    await submitReport(
      otherUser ? otherUser.uid : activeChat.chatId,
      otherUser ? 'user' : 'chat',
      reportReason.trim()
    );
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
      setReportReason('');
    }, 1500);
  };

  const formatTime = (ts?: any) => {
    if (!ts) return '';
    try {
      const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const wpImageUrl =
    effectiveWallpaper?.sourceType === 'custom'
      ? effectiveWallpaper.imageUrl
      : effectiveWallpaper?.sourceType === 'builtin'
      ? effectiveWallpaper.imageUrl || builtinPreset.svgDataUrl
      : '';

  return (
    <div className="flex-1 bg-[#EBEDF0] flex flex-col h-full relative select-none overflow-hidden">
      {/* Dynamic Mender Wallpaper Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {!effectiveWallpaper ? null : effectiveWallpaper.sourceType === 'color' ? (
          <div
            className="w-full h-full transition-all duration-300"
            style={{
              backgroundColor: effectiveWallpaper.backgroundColor,
              filter: `brightness(${effectiveWallpaper.brightness}%)`,
            }}
          />
        ) : (
          <div
            className="w-full h-full bg-no-repeat bg-cover bg-center transition-all duration-300"
            style={{
              backgroundImage: `url("${wpImageUrl}")`,
              backgroundColor: effectiveWallpaper.backgroundColor || '#EBEDF0',
              filter: `brightness(${effectiveWallpaper.brightness}%) blur(${effectiveWallpaper.blur}px)`,
              transform: `translate(${effectiveWallpaper.posX}px, ${effectiveWallpaper.posY}px) scale(${
                effectiveWallpaper.scale / 100
              })`,
            }}
          />
        )}

        {/* Dimming Overlay */}
        {effectiveWallpaper && (
          <div
            className="absolute inset-0 bg-[#000000] transition-opacity duration-300"
            style={{ opacity: (effectiveWallpaper.dimming || 0) / 100 }}
          />
        )}
      </div>

      {/* Top Chat Header */}
      <div className="h-14 bg-white border-b border-[#E1E3E6] px-3 md:px-5 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setActiveChatId(null)}
            className="p-1.5 rounded-lg bg-[#EDEFEF] text-[#2C3138] hover:bg-[#E5E7E8] cursor-pointer shrink-0"
            title="Назад к списку чатов"
          >
            <ArrowLeft className="w-4 h-4 text-[#0077FF]" />
          </button>
          <img
            src={activeChat.avatarUrl}
            alt={activeChat.name}
            onClick={() => {
              if (activeChat.type === 'direct' && otherUser) {
                openUserProfile(otherUser);
              } else {
                setShowInfoDrawer(true);
              }
            }}
            className="w-9 h-9 rounded-full object-cover cursor-pointer shrink-0"
            title={activeChat.type === 'direct' ? 'Открыть профиль собеседника' : 'Информация о чате'}
          />
          <div
            onClick={() => {
              if (activeChat.type === 'direct' && otherUser) {
                openUserProfile(otherUser);
              } else {
                setShowInfoDrawer(true);
              }
            }}
            className="cursor-pointer min-w-0 group"
            title={activeChat.type === 'direct' ? 'Нажмите, чтобы открыть профиль пользователя' : 'Открыть меню группы'}
          >
            <h3 className="text-sm font-semibold text-[#19191A] group-hover:text-[#0077FF] flex items-center gap-1.5 truncate transition-colors">
              <span className="truncate">{activeChat.name}</span>
              {activeChat.isPinned && <Pin className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />}
            </h3>
            <p className="text-[11px] truncate">
              {activeChat.type === 'group' ? (
                <span className="text-[#818C99]">
                  Беседа · {Math.max(activeChat.membersCount || 1, activeChatMembers.length)} участников
                </span>
              ) : activeChat.type === 'channel' ? (
                <span className="text-[#818C99]">
                  Канал · {Math.max(activeChat.membersCount || 1, activeChatMembers.length)} подписчиков
                </span>
              ) : otherUser?.privacyLastSeen === 'nobody' ? (
                <span className="text-[#818C99]">статус скрыт</span>
              ) : otherUser?.status === 'online' ? (
                <span className="text-[#4BB34B] font-medium">в сети</span>
              ) : (
                <span className="text-[#818C99]">был(а) недавно</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {activeChat.type !== 'channel' && (
            <>
              <button
                onClick={() => startCall('audio', activeChat)}
                className="p-2 rounded-lg bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138] transition-colors cursor-pointer"
                title={
                  activeChat.type === 'group'
                    ? 'Групповой аудиозвонок'
                    : 'Аудиозвонок'
                }
              >
                <Phone className="w-4 h-4 text-[#0077FF]" />
              </button>
              <button
                onClick={() => startCall('video', activeChat)}
                className="p-2 rounded-lg bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138] transition-colors cursor-pointer"
                title={
                  activeChat.type === 'group'
                    ? 'Групповой видеозвонок'
                    : 'Видеозвонок'
                }
              >
                <Video className="w-4 h-4 text-[#0077FF]" />
              </button>
            </>
          )}

          <button
            onClick={() => setShowInfoDrawer(!showInfoDrawer)}
            className="p-2 rounded-lg bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138] transition-colors cursor-pointer"
            title="Меню чата: участники, роли, фон и настройки"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recording / Media Error Banner */}
      {recordingError && (
        <div className="bg-red-950/90 border-b border-red-800 px-4 py-2 text-xs text-red-200 flex items-center justify-between z-10">
          <span>{recordingError}</span>
          <button
            onClick={() => setRecordingError(null)}
            className="text-red-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Video Circle Recording Modal */}
      {isRecordingVideoCircle && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6">
          <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-indigo-500 shadow-2xl shadow-indigo-600/40 mb-6">
            <video
              ref={liveVideoPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-mono px-3 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>0:{recordingSeconds.toString().padStart(2, '0')}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => stopAndSendRecording(true)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium cursor-pointer"
            >
              Отмена
            </button>
            <button
              onClick={() => stopAndSendRecording(false)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Отправить кружочек</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3.5 z-10">
        {(() => {
          const visibleMessages = messages.filter(
            m =>
              !deletedForMeMessageIds[m.messageId] &&
              !(profile?.uid && m.deletedForUserIds?.includes(profile.uid))
          );

          if (visibleMessages.length === 0) {
            return (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="bg-white border border-[#E1E3E6] rounded-2xl px-6 py-5 max-w-sm shadow-xs">
                  <h4 className="text-sm font-bold text-[#19191A] mb-1">Сообщений пока нет</h4>
                  <p className="text-xs text-[#818C99]">
                    Отправьте первое сообщение, фото, голосовое или видеокружочек. Нажмите правой кнопкой (или зажмите на телефоне) для меню действий.
                  </p>
                </div>
              </div>
            );
          }

          return visibleMessages.map((msg: Message) => {
            const isMe = Boolean(profile?.uid && msg.senderId === profile.uid);
            const isLikedByMe =
              messageLikesByMe[msg.messageId] !== undefined
                ? messageLikesByMe[msg.messageId]
                : (msg.likesCount || 0) > 0;
            const displayLikes = isLikedByMe
              ? Math.min(1, Math.max(1, msg.likesCount || 1))
              : msg.likesCount > 0
              ? 1
              : 0;
            const activeReactionEmoji =
              msg.reactionEmoji || messageReactions[msg.messageId] || '❤️';

            return (
              <div
                key={msg.messageId}
                id={`msg-item-${msg.messageId}`}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && activeChat.type !== 'direct' && (
                  <span
                    onClick={() => openUserProfile(msg.senderId)}
                    className="text-[11px] font-semibold text-[#2A5885] hover:underline mb-1 px-1 cursor-pointer"
                    title="Открыть профиль автора сообщения"
                  >
                    {msg.senderName}
                  </span>
                )}
                <div
                  onContextMenu={e => handleMessageContextMenu(e, msg)}
                  onTouchStart={e => handleMessageTouchStart(e, msg)}
                  onTouchMove={handleMessageTouchMove}
                  onTouchEnd={handleMessageTouchEnd}
                  onTouchCancel={handleMessageTouchEnd}
                  title="Нажмите ПКМ или удерживайте на телефоне для открытия меню сообщения"
                  className={`max-w-[85%] sm:max-w-md lg:max-w-xl rounded-[14px] px-3.5 py-2.5 relative cursor-context-menu transition-transform active:scale-[0.99] ${
                    isMe
                      ? 'bg-[#CCE4FF] text-[#000000] border border-[#B8D7FC] rounded-br-[2px] shadow-xs'
                      : 'bg-white text-[#19191A] border border-[#E1E3E6] rounded-bl-[2px] shadow-xs'
                  }`}
                >
                  {/* Переслано от */}
                  {msg.forwardedFromName && (
                    <div
                      className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 pb-1 border-b ${
                        isMe
                          ? 'text-[#0077FF] border-[#0077FF]/20'
                          : 'text-[#2A5885] border-[#E1E3E6]'
                      }`}
                    >
                      <Forward className="w-3 h-3 shrink-0" />
                      <span className="truncate">Переслано от {msg.forwardedFromName}</span>
                    </div>
                  )}

                  {/* Цитата ответа (Reply) */}
                  {msg.replyToText && (
                    <div
                      onClick={e => {
                        e.stopPropagation();
                        if (msg.replyToId) {
                          const el = document.getElementById(`msg-item-${msg.replyToId}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className={`mb-2 pl-2.5 pr-2 py-1 rounded-r-lg border-l-2 border-[#0077FF] text-xs cursor-pointer ${
                        isMe
                          ? 'bg-white/60 text-[#19191A]'
                          : 'bg-[#F2F3F5] text-[#19191A]'
                      }`}
                    >
                      <div className="font-bold text-[11px] text-[#2A5885] truncate">
                        {msg.replyToSender || 'Сообщение'}
                      </div>
                      <div className="opacity-85 truncate text-[11px]">{msg.replyToText}</div>
                    </div>
                  )}

                  {/* Text */}
                  {msg.type === 'text' && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}

                  {/* Image */}
                  {msg.type === 'image' && (
                    <div className="space-y-2">
                      <img
                        src={getSyncCachedMediaUrl(msg.mediaUrl)}
                        alt="media"
                        className="rounded-lg max-h-72 object-cover w-full"
                      />
                      {msg.content && msg.content !== 'Фотография' && (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                  )}

                  {/* Video */}
                  {msg.type === 'video' && (
                    <div className="space-y-2">
                      <video
                        src={getSyncCachedMediaUrl(msg.mediaUrl)}
                        controls
                        className="rounded-lg max-h-72 w-full bg-black"
                      />
                    </div>
                  )}

                  {/* Voice */}
                  {msg.type === 'voice' && (
                    <div className="flex items-center gap-3 py-1 min-w-[190px]">
                      <button
                        onClick={() => togglePlayVoice(msg.messageId, msg.mediaUrl)}
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer bg-[#0077FF] text-white"
                      >
                        {playingVoiceId === msg.messageId ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-1 h-4">
                          {[45, 75, 35, 95, 60, 85, 100, 65, 40, 80, 50, 70].map((h, i) => (
                            <div
                              key={i}
                              className={`w-1 rounded-full ${
                                isMe ? 'bg-[#0077FF]' : 'bg-[#818C99]'
                              }`}
                              style={{ height: `${h}%` }}
                            />
                          ))}
                        </div>
                        <span
                          className={`text-[10px] font-mono ${
                            isMe ? 'text-[#528FCC]' : 'text-[#818C99]'
                          }`}
                        >
                          Голосовое · 0:{(msg.duration || 1).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Video Circle */}
                  {msg.type === 'video_circle' && (
                    <div className="relative w-48 h-48">
                      <div className="w-full h-full rounded-full overflow-hidden border-[3px] border-white shadow-md bg-black relative">
                        <video
                          src={getSyncCachedMediaUrl(msg.mediaUrl)}
                          controls
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono px-2.5 py-0.5 rounded-full pointer-events-none">
                          0:{(msg.duration || 10).toString().padStart(2, '0')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timestamp & Status */}
                  <div
                    className={`flex items-center gap-1 mt-1 justify-end text-[10px] ${
                      isMe ? 'text-[#528FCC]' : 'text-[#818C99]'
                    }`}
                  >
                    <span>{formatTime(msg.createdAt)}</span>
                    {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#0077FF]" />}
                  </div>
                </div>

                {/* Отображение поставленной реакции под сообщением */}
                {displayLikes > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <button
                      type="button"
                      onClick={() => reactToMessage(msg, activeReactionEmoji)}
                      className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border bg-white border-[#E1E3E6] text-[#19191A] shadow-xs hover:bg-[#F2F3F5]"
                      title="Нажмите, чтобы убрать реакцию"
                    >
                      <span>{activeReactionEmoji}</span>
                      <span className="text-[11px]">{displayLikes}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          });
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bottom Bar */}
      <div className="p-2.5 md:p-3 bg-white border-t border-[#E1E3E6] relative z-10">
        {replyingToMessage && (
          <div className="mb-2 px-3 py-1.5 rounded-r-lg bg-[#F2F3F5] border-l-3 border-[#0077FF] flex items-center justify-between text-xs text-[#19191A]">
            <div className="flex items-center gap-2 truncate">
              <Reply className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-[#2A5885] mr-1.5">
                  Ответ {replyingToMessage.senderName}:
                </span>
                <span className="opacity-80">«{replyingToMessage.content}»</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMessage(null)}
              className="p-1 text-[#818C99] hover:text-[#19191A] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {editingMessage && (
          <div className="mb-2 px-3 py-1.5 rounded-r-lg bg-[#F2F3F5] border-l-3 border-[#0077FF] flex items-center justify-between text-xs text-[#19191A]">
            <div className="flex items-center gap-2 truncate">
              <Pencil className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
              <span className="truncate">Редактирование: «{editingMessage.content}»</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                setInputText('');
              }}
              className="p-1 text-[#818C99] hover:text-[#19191A] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isMember && activeChat.visibility === 'public' ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-[#818C99]">
              Подпишитесь, чтобы писать сообщения в этом канале
            </span>
            <button
              onClick={() => joinPublicChat(activeChat)}
              className="px-4 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              Подписаться
            </button>
          </div>
        ) : blockedOtherUser ? (
          <div className="flex items-center justify-between text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-lg">
            <span>Вы заблокировали этого пользователя</span>
            {otherUser && (
              <button
                onClick={() => unblockUser(otherUser.uid)}
                className="px-3 py-1 rounded-md bg-red-100 hover:bg-red-200 text-red-700 font-semibold cursor-pointer"
              >
                Разблокировать
              </button>
            )}
          </div>
        ) : !canPostInChannel ? (
          <div className="text-center py-2 text-xs text-[#818C99]">
            Только авторы и администраторы канала могут публиковать сообщения
          </div>
        ) : isRecordingVoice ? (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <div className="flex items-center gap-2.5 text-red-600 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
              <span>Запись голосового: 0:{recordingSeconds.toString().padStart(2, '0')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stopAndSendRecording(true)}
                className="px-3 py-1.5 rounded-lg bg-[#EDEFEF] text-[#2C3138] text-xs cursor-pointer hover:bg-[#E5E7E8]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => stopAndSendRecording(false)}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Отправить</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {showAttachmentsMenu && (
              <div className="absolute bottom-16 left-3 bg-white border border-[#E1E3E6] rounded-2xl p-1.5 shadow-xl flex flex-col gap-1 z-20 w-64">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#19191A] hover:bg-[#F2F3F5] transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#0077FF]" />
                  <span>Фото или видео</span>
                </button>
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#19191A] hover:bg-[#F2F3F5] transition-colors cursor-pointer"
                >
                  <Mic className="w-4 h-4 text-[#4BB34B]" />
                  <span>Голосовое сообщение</span>
                </button>
                <button
                  type="button"
                  onClick={startVideoCircleRecording}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#19191A] hover:bg-[#F2F3F5] transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#0077FF]" />
                  <span>Видеокружочек</span>
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <form onSubmit={handleSendText} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAttachmentsMenu(!showAttachmentsMenu)}
                disabled={uploadingMedia}
                className="p-2 rounded-full text-[#818C99] hover:text-[#0077FF] hover:bg-[#F2F3F5] transition-colors cursor-pointer shrink-0"
                title="Прикрепить файл, фото, голосовое или кружочек"
              >
                {uploadingMedia ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#0077FF]" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>

              <input
                ref={textInputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={
                  editingMessage
                    ? 'Введите новый текст сообщения...'
                    : replyingToMessage
                    ? `Ответить ${replyingToMessage.senderName}...`
                    : 'Написать сообщение...'
                }
                className="flex-1 min-w-0 bg-[#F2F3F5] focus:bg-white border border-[#E1E3E6] rounded-full py-2 px-4 text-[#19191A] placeholder-[#818C99] text-sm focus:outline-none focus:border-[#0077FF] transition-colors"
              />

              <button
                type="button"
                onClick={startVoiceRecording}
                className="hidden sm:flex p-2 rounded-full text-[#818C99] hover:text-[#0077FF] hover:bg-[#F2F3F5] transition-colors cursor-pointer shrink-0"
                title="Записать голосовое сообщение"
              >
                <Mic className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={startVideoCircleRecording}
                className="hidden sm:flex p-2 rounded-full text-[#818C99] hover:text-[#0077FF] hover:bg-[#F2F3F5] transition-colors cursor-pointer shrink-0"
                title="Записать видеокружочек"
              >
                <Camera className="w-5 h-5" />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-full bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-40 text-white shadow-xs transition-colors cursor-pointer shrink-0"
                title={editingMessage ? 'Сохранить изменения' : 'Отправить'}
              >
                {editingMessage ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Chat Info, Add Members & Moderator Roles Drawer */}
      {showInfoDrawer && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-[#E1E3E6] shadow-2xl z-50 flex flex-col overflow-hidden text-[#19191A]">
          {/* Верхняя закреплённая панель со стрелочкой возврата к чату */}
          <div className="sticky top-0 z-20 bg-white border-b border-[#E1E3E6] px-4 py-3 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => setShowInfoDrawer(false)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] text-xs font-semibold transition-colors cursor-pointer"
              title="Вернуться к чату"
            >
              <ArrowLeft className="w-4 h-4 text-[#0077FF]" />
              <span>Назад к чату</span>
            </button>
            <h3 className="text-sm font-bold text-[#19191A] truncate px-2">Информация о чате</h3>
            <button
              type="button"
              onClick={() => setShowInfoDrawer(false)}
              className="p-1.5 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#F2F3F5] cursor-pointer"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="relative flex flex-col items-center text-center mb-5">
              {/* Стрелочка возврата к чату в левом верхнем углу карточки */}
              <button
                type="button"
                onClick={() => setShowInfoDrawer(false)}
                className="absolute top-0 left-0 p-2 rounded-full bg-[#F0F2F5] hover:bg-[#E5E7EB] text-[#19191A] shadow-xs transition-colors cursor-pointer"
                title="Вернуться к чату"
              >
                <ArrowLeft className="w-5 h-5 text-[#0077FF]" />
              </button>
              <img
                src={activeChat.avatarUrl}
                alt={activeChat.name}
                className="w-18 h-18 rounded-full object-cover border-2 border-[#0077FF] mb-2.5 shadow-sm"
              />
              <h4 className="text-base font-bold text-[#19191A]">{activeChat.name}</h4>
              <p className="text-xs text-[#818C99] mt-0.5">
                {activeChat.description || 'Описание отсутствует'}
              </p>
            </div>

          {/* ДОБАВЛЕНИЕ ЛЮДЕЙ В ГРУППУ И НАЗНАЧЕНИЕ ПРАВ МОДЕРАТОРА */}
          {activeChat.type !== 'direct' && (
            <div className="mb-5 p-4 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0077FF]">
                <UserPlus className="w-3.5 h-3.5 text-[#0077FF]" />
                <span>Добавить участников в беседу</span>
              </div>

              <form onSubmit={handleAddMemberSubmit} className="space-y-2.5">
                <input
                  type="text"
                  value={newMemberInput}
                  onChange={e => setNewMemberInput(e.target.value)}
                  placeholder="Почта, @username или имя пользователя..."
                  className="v7-input text-xs py-2"
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#656565]">Назначить права:</span>
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

              {/* Быстрое добавление из списка зарегистрированных пользователей */}
              {candidateUsersToAdd.length > 0 && (
                <div className="pt-2 border-t border-[#E1E3E6] space-y-2">
                  <div className="text-[11px] font-semibold text-[#818C99]">
                    Быстро добавить из людей:
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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

          {/* Members & Role Management */}
          {activeChat.type !== 'direct' && (
            <div className="mb-5">
              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#818C99]">
                <Users className="w-3.5 h-3.5 text-[#0077FF]" />
                <span>Участники беседы ({activeChatMembers.length})</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {activeChatMembers.map((member: ChatMember) => (
                  <div
                    key={member.userId}
                    className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center justify-between gap-2"
                  >
                    <div
                      onClick={() => openUserProfile(member.userId)}
                      className="flex items-center gap-2.5 overflow-hidden cursor-pointer group"
                      title={`Открыть профиль ${member.displayName}`}
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
                      member.userId !== profile?.uid &&
                      member.role !== 'owner' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOwnerOrAdmin && (
                            <select
                              value={member.role}
                              onChange={e =>
                                updateMemberRole(
                                  activeChat.chatId,
                                  member.userId,
                                  e.target.value as 'admin' | 'moderator' | 'member'
                                )
                              }
                              className="bg-white border border-[#E1E3E6] rounded-lg text-[11px] text-[#19191A] px-2 py-1 focus:outline-none focus:border-[#0077FF]"
                              title="Изменить роль участника"
                            >
                              <option value="member">Участник</option>
                              <option value="moderator">Модератор</option>
                              <option value="admin">Администратор</option>
                            </select>
                          )}
                          <button
                            onClick={() =>
                              removeMemberFromChat(activeChat.chatId, member.userId)
                            }
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

          {/* Кнопки управления чатом по списку */}
          <div className="v7-btn-list mb-5">
            {otherUser && (
              <button
                type="button"
                onClick={() => {
                  setShowInfoDrawer(false);
                  openUserProfile(otherUser);
                }}
                className="v7-btn text-xs"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Открыть профиль пользователя</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setShowInfoDrawer(false);
                setShowWallpaperModal(true);
              }}
              className="v7-btn text-xs"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Фон этого чата</span>
            </button>

            <button
              type="button"
              onClick={() => togglePinChat(activeChat.chatId)}
              className="v7-btn-secondary text-xs"
            >
              <Pin className="w-4 h-4 text-[#0077FF] shrink-0" />
              <span>{activeChat.isPinned ? 'Открепить чат' : 'Закрепить чат'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleMuteChat(activeChat.chatId)}
              className="v7-btn-secondary text-xs"
            >
              <VolumeX className="w-4 h-4 text-[#818C99] shrink-0" />
              <span>
                {activeChat.isMuted ? 'Включить уведомления' : 'Без звука'}
              </span>
            </button>
          </div>

          {/* Block & Abuse Report */}
          <div className="mt-auto pt-4 border-t border-[#E1E3E6] v7-btn-list">
            {otherUser && (
              <button
                type="button"
                onClick={() =>
                  blockedOtherUser ? unblockUser(otherUser.uid) : blockUser(otherUser.uid)
                }
                className="v7-btn-danger text-xs"
              >
                <Ban className="w-4 h-4 shrink-0" />
                <span>
                  {blockedOtherUser ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="v7-btn-secondary text-xs"
            >
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Пожаловаться</span>
            </button>
          </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white border border-[#E1E3E6] rounded-2xl p-6 text-[#19191A] shadow-xl">
            <h4 className="text-base font-bold mb-1.5">Отправить жалобу</h4>
            <p className="text-xs text-[#818C99] mb-4">
              Укажите причину обращения для проверки модерацией.
            </p>
            {reportSubmitted ? (
              <div className="p-4 rounded-xl bg-[#E8F9E8] border border-[#C8E6C9] text-[#2E7D32] text-xs font-medium text-center">
                Жалоба успешно отправлена!
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <textarea
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="Опишите причину жалобы (спам, оскорбления, мошенничество)..."
                  rows={3}
                  className="w-full bg-[#F2F3F5] border border-[#DCE1E6] rounded-xl p-3 text-xs text-[#19191A] focus:outline-none focus:border-[#0077FF] focus:bg-white"
                  required
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 rounded-lg text-xs text-[#656565] hover:bg-[#EDEFEF] cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold cursor-pointer"
                  >
                    Отправить жалобу
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Mender Wallpapers Studio Modal for this chat */}
      {showWallpaperModal && (
        <WallpaperStudioModal
          onClose={() => setShowWallpaperModal(false)}
          targetChatId={activeChat.chatId}
          targetChatName={activeChat.name}
        />
      )}

      {/* Контекстное меню сообщения (ПКМ на компьютере / долгое нажатие на телефоне) */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={e => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={e => e.stopPropagation()}
            className="fixed w-60 bg-white border border-[#E1E3E6] rounded-2xl shadow-xl p-2 text-[#19191A] space-y-1 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* 1. Быстрые реакции */}
            <div className="flex items-center justify-between gap-1 px-1.5 py-1.5 bg-[#F2F3F5] rounded-xl border border-[#E1E3E6] mb-1">
              {QUICK_REACTIONS.map(emoji => {
                const currentEmoji =
                  contextMenu.msg.reactionEmoji ||
                  messageReactions[contextMenu.msg.messageId] ||
                  (contextMenu.msg.likesCount > 0 ? '❤️' : '');
                const isSelected =
                  Boolean(currentEmoji === emoji) &&
                  ((messageLikesByMe[contextMenu.msg.messageId] ??
                    contextMenu.msg.likesCount > 0) === true);

                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      reactToMessage(contextMenu.msg, emoji);
                      setContextMenu(null);
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-base hover:scale-125 transition-transform cursor-pointer ${
                      isSelected ? 'bg-[#0077FF]/20 ring-1 ring-[#0077FF]' : 'hover:bg-white'
                    }`}
                    title={`Реакция ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* 2. Ответить */}
            <button
              type="button"
              onClick={() => {
                handleStartReplyMessage(contextMenu.msg);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#19191A] hover:bg-[#F2F3F5] hover:text-[#0077FF] transition-colors cursor-pointer"
            >
              <Reply className="w-4 h-4 text-[#0077FF] shrink-0" />
              <span>Ответить</span>
            </button>

            {/* 3. Переслать */}
            <button
              type="button"
              onClick={() => {
                setForwardingMessage(contextMenu.msg);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#19191A] hover:bg-[#F2F3F5] hover:text-[#0077FF] transition-colors cursor-pointer"
            >
              <Forward className="w-4 h-4 text-[#0077FF] shrink-0" />
              <span>Переслать</span>
            </button>

            {/* 4. Изменить (для своих текстовых сообщений) */}
            {contextMenu.msg.senderId === profile?.uid && contextMenu.msg.type === 'text' && (
              <button
                type="button"
                onClick={() => {
                  handleStartEditMessage(contextMenu.msg);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#19191A] hover:bg-[#F2F3F5] hover:text-[#0077FF] transition-colors cursor-pointer"
              >
                <Pencil className="w-4 h-4 text-[#0077FF] shrink-0" />
                <span>Изменить</span>
              </button>
            )}

            <div className="my-1 border-t border-[#E1E3E6]" />

            {/* 5. Удалить у себя */}
            <button
              type="button"
              onClick={() => {
                deleteMessageForMe(contextMenu.msg);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#818C99] hover:bg-[#F2F3F5] hover:text-[#19191A] transition-colors cursor-pointer"
            >
              <EyeOff className="w-4 h-4 text-[#818C99] shrink-0" />
              <span>Удалить у себя</span>
            </button>

            {/* 6. Удалить у двоих (у всех) */}
            <button
              type="button"
              onClick={() => {
                deleteMessageForEveryone(contextMenu.msg.messageId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
              <span>Удалить у двоих</span>
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно «Переслать сообщение» */}
      {forwardingMessage && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setForwardingMessage(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#E1E3E6] rounded-2xl p-5 text-[#19191A] shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Forward className="w-4 h-4 text-[#0077FF]" />
                <h4 className="text-sm font-bold text-[#19191A]">Переслать сообщение</h4>
              </div>
              <button
                type="button"
                onClick={() => setForwardingMessage(null)}
                className="p-1.5 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#EDEFEF] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F5F6F8] border border-[#E1E3E6] text-xs text-[#2C3138] truncate">
              «{forwardingMessage.content}»
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {chats.map((c: Chat) => (
                <button
                  key={c.chatId}
                  type="button"
                  onClick={async () => {
                    const targetMsg = forwardingMessage;
                    setForwardingMessage(null);
                    await forwardMessageToTarget(targetMsg, c);
                  }}
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#F7F8FA] hover:bg-[#EDEFEF] border border-[#E1E3E6] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={c.avatarUrl}
                      alt={c.name}
                      className="w-9 h-9 rounded-full object-cover bg-[#EDEFEF] border border-[#E1E3E6] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#19191A] truncate">{c.name}</div>
                      <div className="text-[10px] text-[#818C99] truncate">
                        {c.type === 'direct' ? 'Личный чат' : c.type === 'group' ? 'Беседа' : 'Сообщество'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#0077FF] text-white text-[11px] font-semibold shrink-0">
                    Отправить
                  </span>
                </button>
              ))}

              {usersDirectory
                .filter(u => u.uid !== profile?.uid && !isUserBlocked(u.uid))
                .map(userObj => (
                  <button
                    key={userObj.uid}
                    type="button"
                    onClick={async () => {
                      const targetMsg = forwardingMessage;
                      setForwardingMessage(null);
                      await forwardMessageToTarget(targetMsg, userObj);
                    }}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#F7F8FA] hover:bg-[#EDEFEF] border border-[#E1E3E6] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={userObj.avatarUrl}
                        alt={userObj.displayName}
                        className="w-9 h-9 rounded-full object-cover bg-[#EDEFEF] border border-[#E1E3E6] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#19191A] truncate">
                          {userObj.displayName}
                        </div>
                        <div className="text-[10px] text-[#818C99] truncate">
                          @{userObj.username}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[#E5EBF1] text-[#0077FF] text-[11px] font-semibold shrink-0">
                      В личку
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
