import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  Pin,
  PinOff,
  Users,
  ShieldCheck,
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
  CheckCircle2,
  Search,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Download,
  Upload,
  MessageSquarePlus,
  VolumeX,
  Volume2,
  Archive,
  ArchiveRestore,
  Info,
} from 'lucide-react';
import { WallpaperStudioModal } from '../wallpapers/WallpaperStudioModal';
import { CreateGroupModal } from './CreateGroupModal';
import { ChatEmojiPicker } from './ChatEmojiPicker';
import { ChatInfoDrawer } from './ChatInfoDrawer';
import { Avatar } from '../common/Avatar';
import { TypingIndicatorText } from '../common/TypingIndicatorText';
import { MENDER_WALLPAPERS } from '../../data/menderWallpapers';
import { resolvePlayableMediaUrl, getSyncCachedMediaUrl } from '../../utils/media';
import { Message, Chat } from '../../types';

const QUICK_REACTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🎉'];

const getMessageDateMs = (ts?: any): number => {
  if (!ts) return 0;
  try {
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    const parsed = new Date(ts).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
};

const getDayKey = (ts?: any): string => {
  const ms = getMessageDateMs(ts);
  if (!ms) return 'today';
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const formatDayLabel = (ts?: any): string => {
  const ms = getMessageDateMs(ts);
  if (!ms) return 'Сегодня';
  const d = new Date(ms);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return 'Сегодня';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Вчера';

  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

export const ChatWindow: React.FC = () => {
  const {
    chats,
    activeChat,
    setActiveChatId,
    messages,
    typingUsersByChat,
    messageLikesByMe,
    messageReactions,
    deletedForMeMessageIds,
    activeChatMembers,
    usersDirectory,
    sendMessage,
    setChatTyping,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    reactToMessage,
    forwardMessageToTarget,
    startDirectChatWithUser,
    startCall,
    togglePinChat,
    toggleMuteChat,
    toggleArchiveChat,
    deleteChatForMe,
    deleteChatForBoth,
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [newModalType, setNewModalType] = useState<'direct' | 'group' | null>(null);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<{
    left: number;
    top: number;
    isDesktop: boolean;
  }>({ left: 12, top: 64, isDesktop: true });
  const [headerMenuBusy, setHeaderMenuBusy] = useState(false);
  const [headerMenuError, setHeaderMenuError] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [securityResponses, setSecurityResponses] = useState<Record<string, 'confirmed' | 'reported'>>({});
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // In-chat search
  const [isSearchingChat, setIsSearchingChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchIndex, setChatSearchIndex] = useState(0);

  // Per-chat pinned message (saved locally per chat)
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);

  // Scroll-to-bottom & Drag-drop
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const textInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);
  const lastTypingChatIdRef = useRef<string | null>(null);

  // Voice & Video Circle Recording States
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

  const visibleMessages = useMemo(() => {
    return messages.filter(
      m =>
        !deletedForMeMessageIds[m.messageId] &&
        !(profile?.uid && m.deletedForUserIds?.includes(profile.uid))
    );
  }, [messages, deletedForMeMessageIds, profile?.uid]);

  const searchMatches = useMemo(() => {
    const q = chatSearchQuery.trim().toLowerCase();
    if (!q) return [] as Message[];
    return visibleMessages.filter(
      m =>
        m.content?.toLowerCase().includes(q) ||
        m.senderName?.toLowerCase().includes(q)
    );
  }, [visibleMessages, chatSearchQuery]);

  const pinnedMessage = useMemo(() => {
    if (!pinnedMessageId) return null;
    return visibleMessages.find(m => m.messageId === pinnedMessageId) || null;
  }, [pinnedMessageId, visibleMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.chatId, visibleMessages.length]);

  useEffect(() => {
    setEditingMessage(null);
    setReplyingToMessage(null);
    setContextMenu(null);
    setShowEmojiPicker(false);
    setShowAttachmentsMenu(false);
    setShowHeaderMenu(false);
    setHeaderMenuError('');
    setIsSearchingChat(false);
    setChatSearchQuery('');
    setChatSearchIndex(0);
    setInputText('');
    setShowScrollBottom(false);

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (lastTypingSentAtRef.current > 0 && lastTypingChatIdRef.current) {
      const prevTypingChatId = lastTypingChatIdRef.current;
      lastTypingSentAtRef.current = 0;
      lastTypingChatIdRef.current = null;
      setChatTyping(prevTypingChatId, false);
    }

    if (activeChat?.chatId) {
      try {
        setPinnedMessageId(localStorage.getItem(`mender_pinned_msg_${activeChat.chatId}`));
      } catch {
        setPinnedMessageId(null);
      }
    } else {
      setPinnedMessageId(null);
    }
  }, [activeChat?.chatId, setChatTyping]);

  useEffect(() => {
    if (!showHeaderMenu) {
      setHeaderMenuError('');
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !headerMenuBusy) {
        setShowHeaderMenu(false);
      }
    };
    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setHeaderMenuAnchor(prev => ({
        left: Math.max(12, Math.min(prev.left, vw - 292)),
        top: Math.max(12, Math.min(prev.top, vh - 392)),
        isDesktop: vw >= 640,
      }));
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [showHeaderMenu, headerMenuBusy]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (lastTypingSentAtRef.current > 0 && lastTypingChatIdRef.current) {
        setChatTyping(lastTypingChatIdRef.current, false);
        lastTypingSentAtRef.current = 0;
        lastTypingChatIdRef.current = null;
      }
      recordingStreamRef.current?.getTracks().forEach(t => t.stop());
      audioPlayerRef.current?.pause();
    };
  }, [setChatTyping]);

  const jumpToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-item-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId(prev => (prev === messageId ? null : prev));
    }, 1600);
  };

  useEffect(() => {
    if (searchMatches.length > 0) {
      const clampedIndex = Math.min(chatSearchIndex, searchMatches.length - 1);
      if (clampedIndex !== chatSearchIndex) {
        setChatSearchIndex(clampedIndex);
      }
      const target = searchMatches[searchMatches.length - 1 - clampedIndex];
      if (target) {
        jumpToMessage(target.messageId);
      }
    }
  }, [chatSearchIndex, searchMatches.length]);

  const handleMessagesScroll = () => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBottom(distanceFromBottom > 220);
  };

  const quickContacts = useMemo(() => {
    const seen = new Set<string>();
    if (profile?.username) seen.add(profile.username.toLowerCase());
    return usersDirectory
      .filter(u => {
        if (u.uid === profile?.uid || isUserBlocked(u.uid)) return false;
        const uname = (u.username || '').toLowerCase();
        if (uname && seen.has(uname)) return false;
        if (uname) seen.add(uname);
        return true;
      })
      .slice(0, 6);
  }, [usersDirectory, profile?.uid, profile?.username, isUserBlocked]);

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

        <div className="relative z-10 w-full max-w-md bg-white border border-[#E1E3E6] rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#E5EBF1] text-[#0077FF] flex items-center justify-center shrink-0">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#19191A]">
                Выберите диалог слева
              </h3>
              <p className="text-xs text-[#818C99] mt-1 leading-relaxed">
                Отправляйте сообщения, фото, видеокружочки, голосовые или начните видеозвонок.
              </p>
            </div>
          </div>

          {quickContacts.length > 0 && (
            <div className="pt-3 border-t border-[#E1E3E6]">
              <div className="text-[11px] font-semibold text-[#818C99] mb-2">
                Быстро написать контакту
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickContacts.slice(0, 4).map(person => (
                  <button
                    key={person.uid}
                    type="button"
                    onClick={() => startDirectChatWithUser(person)}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-[#F7F8FA] hover:bg-[#EDEFEF] border border-[#E1E3E6] text-left transition-colors cursor-pointer"
                  >
                    <Avatar
                      src={person.avatarUrl}
                      name={person.displayName}
                      className="w-8 h-8 rounded-full shrink-0 border border-[#E1E3E6]"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#19191A] truncate">
                        {person.displayName}
                      </div>
                      <div className="text-[10px] text-[#818C99] truncate">
                        @{person.username}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setNewModalType('direct')}
              className="v7-btn text-xs justify-center"
            >
              <MessageSquarePlus className="w-4 h-4 shrink-0" />
              <span>Новый чат</span>
            </button>
            <button
              type="button"
              onClick={() => setShowWallpaperModal(true)}
              className="v7-btn-secondary text-xs justify-center"
            >
              <Sparkles className="w-4 h-4 text-[#0077FF] shrink-0" />
              <span>Фоны чатов</span>
            </button>
          </div>
        </div>

        {newModalType && (
          <CreateGroupModal
            defaultType={newModalType}
            onClose={() => setNewModalType(null)}
          />
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

  const otherPeerId =
    activeChat.ownerId === profile?.uid ? activeChat.peerUserId : activeChat.ownerId;
  const otherUser =
    activeChat.type === 'direct'
      ? usersDirectory.find(u => u.uid === otherPeerId)
      : undefined;
  const blockedOtherUser = otherUser ? isUserBlocked(otherUser.uid) : false;

  const memberIdsSet = new Set(activeChatMembers.map(m => m.userId));
  const candidateUsersToAdd = usersDirectory.filter(
    u => u.uid !== profile?.uid && !memberIdsSet.has(u.uid) && !isUserBlocked(u.uid)
  );

  const effectiveWallpaper = getEffectiveWallpaper(activeChat.chatId);
  const builtinPreset =
    effectiveWallpaper?.sourceType === 'builtin'
      ? MENDER_WALLPAPERS.find(w => w.id === effectiveWallpaper.wallpaperId) || MENDER_WALLPAPERS[0]
      : MENDER_WALLPAPERS[0];

  const openMessageContextMenu = (clientX: number, clientY: number, msg: Message) => {
    const menuWidth = 248;
    const menuHeight = 350;
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

  const handlePinMessage = (msg: Message) => {
    const nextId = pinnedMessageId === msg.messageId ? null : msg.messageId;
    setPinnedMessageId(nextId);
    try {
      const storageKey = `mender_pinned_msg_${activeChat.chatId}`;
      if (nextId) localStorage.setItem(storageKey, nextId);
      else localStorage.removeItem(storageKey);
    } catch {
      // ignore storage failure
    }
  };

  const stopTypingNow = () => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (lastTypingSentAtRef.current > 0 && lastTypingChatIdRef.current) {
      const targetId = lastTypingChatIdRef.current;
      lastTypingSentAtRef.current = 0;
      lastTypingChatIdRef.current = null;
      setChatTyping(targetId, false);
    }
  };

  const notifyTypingActivity = (hasText: boolean) => {
    if (!activeChat || isSystemChat || blockedOtherUser || !canPostInChannel) return;
    const chatId = activeChat.chatId;
    if (!hasText) {
      stopTypingNow();
      return;
    }
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = window.setTimeout(() => {
      typingStopTimerRef.current = null;
      lastTypingSentAtRef.current = 0;
      lastTypingChatIdRef.current = null;
      setChatTyping(chatId, false);
    }, 3000);

    const now = Date.now();
    if (now - lastTypingSentAtRef.current > 2400 || lastTypingChatIdRef.current !== chatId) {
      lastTypingSentAtRef.current = now;
      lastTypingChatIdRef.current = chatId;
      setChatTyping(chatId, true);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || blockedOtherUser) return;
    stopTypingNow();
    const text = inputText.trim();
    setInputText('');
    setShowEmojiPicker(false);

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

  const sendMediaFile = async (file: File) => {
    if (!file || uploadingMedia || blockedOtherUser || !canPostInChannel) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
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
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await sendMediaFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleComposerPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await sendMediaFile(file);
          return;
        }
      }
    }
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await sendMediaFile(file);
    }
  };

  const startVoiceRecording = async () => {
    setRecordingError(null);
    setShowAttachmentsMenu(false);
    setShowEmojiPicker(false);
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

  const startVideoCircleRecording = async () => {
    setRecordingError(null);
    setShowAttachmentsMenu(false);
    setShowEmojiPicker(false);
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

  const renderHighlightedText = (text: string) => {
    const q = chatSearchQuery.trim();
    if (!isSearchingChat || !q) return text;
    const lowerText = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    const idx = lowerText.indexOf(lowerQ);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return (
      <>
        {before}
        <mark className="bg-amber-300/70 text-[#19191A] rounded px-0.5">{match}</mark>
        {after}
      </>
    );
  };

  const wpImageUrl =
    effectiveWallpaper?.sourceType === 'custom'
      ? effectiveWallpaper.imageUrl
      : effectiveWallpaper?.sourceType === 'builtin'
      ? effectiveWallpaper.imageUrl || builtinPreset.svgDataUrl
      : '';

  const isSystemChat =
    activeChat.peerUserId === 'mender_security_bot' ||
    activeChat.chatId.startsWith('chat_system_security_');

  const activeChatTypingUsers = (typingUsersByChat[activeChat.chatId] || []).filter(
    t => !isUserBlocked(t.userId)
  );

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        if (!isDragOver) setIsDragOver(true);
      }}
      onDragLeave={e => {
        if (e.currentTarget === e.target) setIsDragOver(false);
      }}
      onDrop={handleDropFile}
      onClick={() => {
        if (showEmojiPicker) setShowEmojiPicker(false);
        if (showAttachmentsMenu) setShowAttachmentsMenu(false);
      }}
      className="flex-1 min-w-0 min-h-0 bg-[#EBEDF0] flex flex-col h-full relative select-none overflow-hidden"
    >
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

        {effectiveWallpaper && (
          <div
            className="absolute inset-0 bg-[#000000] transition-opacity duration-300"
            style={{ opacity: (effectiveWallpaper.dimming || 0) / 100 }}
          />
        )}
      </div>

      {/* Drag & Drop Media Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-[#0077FF]/15 backdrop-blur-xs border-2 border-dashed border-[#0077FF] m-3 rounded-2xl flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-white border border-[#E1E3E6] rounded-2xl px-6 py-4 shadow-lg flex items-center gap-3">
            <Upload className="w-5 h-5 text-[#0077FF]" />
            <span className="text-sm font-semibold text-[#19191A]">
              Отпустите фото или видео для отправки в чат
            </span>
          </div>
        </div>
      )}

      {/* Top Chat Header */}
      <div className="relative z-30 h-14 bg-white border-b border-[#E1E3E6] px-2.5 md:px-5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setActiveChatId(null)}
            className="min-h-[40px] min-w-[40px] p-1.5 rounded-xl bg-[#EDEFEF] text-[#2C3138] hover:bg-[#E5E7E8] cursor-pointer shrink-0 flex items-center justify-center md:hidden"
            title="Назад к списку чатов"
          >
            <ArrowLeft className="w-4 h-4 text-[#0077FF]" />
          </button>

          <Avatar
            src={activeChat.avatarUrl}
            name={activeChat.name}
            isSystemSecurity={isSystemChat}
            onClick={() => {
              if (activeChat.type === 'direct' && otherUser) {
                openUserProfile(otherUser);
              } else {
                setShowInfoDrawer(true);
              }
            }}
            className="w-9 h-9 rounded-full cursor-pointer shrink-0 border border-[#E1E3E6]"
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
          >
            <h3 className="text-sm font-bold text-[#19191A] group-hover:text-[#0077FF] flex items-center gap-1.5 truncate transition-colors">
              <span className="truncate">{activeChat.name}</span>
              {isSystemChat && <CheckCircle2 className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />}
              {activeChat.isPinned && <Pin className="w-3 h-3 text-[#0077FF] shrink-0" />}
            </h3>
            <p className="text-[11px] text-[#818C99] truncate">
              {activeChatTypingUsers.length > 0 ? (
                <TypingIndicatorText
                  typingUsers={activeChatTypingUsers}
                  isDirect={activeChat.type === 'direct'}
                  showPrefix={activeChat.type !== 'direct'}
                  className="text-[#0077FF] font-medium"
                />
              ) : isSystemChat ? (
                'Официальные оповещения безопасности'
              ) : activeChat.type === 'group' ? (
                <span className="tabular-nums">
                  Беседа · {Math.max(activeChat.membersCount || 1, activeChatMembers.length)} участников
                </span>
              ) : activeChat.type === 'channel' ? (
                <span className="tabular-nums">
                  Канал · {Math.max(activeChat.membersCount || 1, activeChatMembers.length)} подписчиков
                </span>
              ) : otherUser?.privacyLastSeen === 'nobody' ? (
                'статус скрыт'
              ) : otherUser?.status === 'online' ? (
                <span className="text-[#4BB34B] font-medium">в сети</span>
              ) : (
                'был(а) недавно'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              const next = !isSearchingChat;
              setIsSearchingChat(next);
              if (next) {
                setTimeout(() => searchInputRef.current?.focus(), 40);
              } else {
                setChatSearchQuery('');
                setChatSearchIndex(0);
              }
            }}
            className={`min-h-[40px] min-w-[40px] p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
              isSearchingChat
                ? 'bg-[#E5EBF1] text-[#0077FF]'
                : 'bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138]'
            }`}
            title="Поиск по сообщениям в чате"
          >
            <Search className="w-4 h-4" />
          </button>

          {activeChat.type !== 'channel' && !isSystemChat && (
            <>
              <button
                type="button"
                onClick={() => startCall('audio', activeChat)}
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138] transition-colors cursor-pointer flex items-center justify-center"
                title={activeChat.type === 'group' ? 'Групповой аудиозвонок' : 'Аудиозвонок'}
              >
                <Phone className="w-4 h-4 text-[#0077FF]" />
              </button>
              <button
                type="button"
                onClick={() => startCall('video', activeChat)}
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138] transition-colors cursor-pointer flex items-center justify-center"
                title={activeChat.type === 'group' ? 'Групповой видеозвонок' : 'Видеозвонок'}
              >
                <Video className="w-4 h-4 text-[#0077FF]" />
              </button>
            </>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (showHeaderMenu) {
                  setShowHeaderMenu(false);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const vw = window.innerWidth;
                  const vh = window.innerHeight;
                  const menuW = 280;
                  const menuH = 380;
                  const left = Math.max(12, Math.min(rect.right - menuW, vw - menuW - 12));
                  const top = Math.max(12, Math.min(rect.bottom + 8, vh - menuH - 12));
                  setHeaderMenuAnchor({ left, top, isDesktop: vw >= 640 });
                  setShowHeaderMenu(true);
                }
              }}
              className={`min-h-[40px] min-w-[40px] p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
                showHeaderMenu
                  ? 'bg-[#E5EBF1] text-[#0077FF]'
                  : 'bg-[#EDEFEF] hover:bg-[#E5E7E8] text-[#2C3138]'
              }`}
              title="Действия с чатом"
              aria-label="Действия с чатом"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showHeaderMenu &&
              typeof document !== 'undefined' &&
              createPortal(
                <div
                  className={`fixed inset-0 z-[120] ${
                    headerMenuAnchor.isDesktop
                      ? 'bg-black/10'
                      : 'bg-black/45 flex items-end justify-center'
                  }`}
                  onClick={() => {
                    if (!headerMenuBusy) {
                      setShowHeaderMenu(false);
                    }
                  }}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    style={
                      headerMenuAnchor.isDesktop
                        ? {
                            position: 'fixed',
                            left: headerMenuAnchor.left,
                            top: headerMenuAnchor.top,
                            width: 280,
                            maxHeight: 'calc(100dvh - 24px)',
                          }
                        : undefined
                    }
                    className={
                      headerMenuAnchor.isDesktop
                        ? 'bg-white border border-[#E1E3E6] rounded-2xl shadow-2xl overflow-y-auto text-[#19191A]'
                        : 'w-full max-w-lg bg-white border-t border-x border-[#E1E3E6] rounded-t-3xl shadow-2xl max-h-[82dvh] overflow-y-auto text-[#19191A] pb-[max(1.25rem,env(safe-area-inset-bottom))]'
                    }
                  >
                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      disabled={headerMenuBusy}
                      onClick={async () => {
                        await toggleMuteChat(activeChat.chatId);
                        setShowHeaderMenu(false);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-[#F5F6F8] flex items-center gap-3 text-left text-xs font-medium text-[#19191A] cursor-pointer transition-colors"
                    >
                      {activeChat.isMuted ? (
                        <Volume2 className="w-4 h-4 text-[#0077FF] shrink-0" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-[#626D7A] shrink-0" />
                      )}
                      <span>{activeChat.isMuted ? 'Включить звук' : 'Выключить звук'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={headerMenuBusy}
                      onClick={async () => {
                        await toggleArchiveChat(activeChat.chatId);
                        setShowHeaderMenu(false);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-[#F5F6F8] flex items-center gap-3 text-left text-xs font-medium text-[#19191A] cursor-pointer transition-colors"
                    >
                      {activeChat.isArchived ? (
                        <ArchiveRestore className="w-4 h-4 text-[#0077FF] shrink-0" />
                      ) : (
                        <Archive className="w-4 h-4 text-[#626D7A] shrink-0" />
                      )}
                      <span>{activeChat.isArchived ? 'Вернуть из архива' : 'В архив'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={headerMenuBusy}
                      onClick={async () => {
                        await togglePinChat(activeChat.chatId);
                        setShowHeaderMenu(false);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-[#F5F6F8] flex items-center gap-3 text-left text-xs font-medium text-[#19191A] cursor-pointer transition-colors"
                    >
                      {activeChat.isPinned ? (
                        <PinOff className="w-4 h-4 text-[#626D7A] shrink-0" />
                      ) : (
                        <Pin className="w-4 h-4 text-[#0077FF] shrink-0" />
                      )}
                      <span>{activeChat.isPinned ? 'Открепить' : 'Закрепить'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={headerMenuBusy}
                      onClick={() => {
                        setShowHeaderMenu(false);
                        setShowInfoDrawer(true);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-[#F5F6F8] flex items-center gap-3 text-left text-xs font-medium text-[#19191A] cursor-pointer transition-colors"
                    >
                      <Info className="w-4 h-4 text-[#0077FF] shrink-0" />
                      <span>Информация и медиа</span>
                    </button>

                    <div className="my-1.5 border-t border-[#E1E3E6]" />

                    <div className="px-2 pt-0.5 pb-1 flex items-center gap-1.5 text-[11px] font-semibold text-rose-500">
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Удалить чат</span>
                    </div>

                    {headerMenuError && (
                      <div className="mx-1.5 mb-1.5 px-2.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-500">
                        {headerMenuError}
                      </div>
                    )}

                    <div className="px-1 pb-1 space-y-1.5">
                      <button
                        type="button"
                        disabled={headerMenuBusy}
                        onClick={async () => {
                          setHeaderMenuBusy(true);
                          setHeaderMenuError('');
                          try {
                            await deleteChatForMe(activeChat.chatId);
                            setShowHeaderMenu(false);
                          } catch (err: any) {
                            setHeaderMenuError(err?.message || 'Не удалось удалить чат');
                          } finally {
                            setHeaderMenuBusy(false);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-[#F7F8FA] hover:bg-[#EDEFEF] border border-[#E1E3E6] text-left cursor-pointer disabled:opacity-50"
                      >
                        <div className="text-xs font-bold text-[#19191A]">Удалить у себя</div>
                        <div className="text-[10px] text-[#818C99]">
                          Чат исчезнет только у вас
                        </div>
                      </button>

                      {!isSystemChat &&
                        (activeChat.type === 'direct' ||
                          (Boolean(profile?.uid) && activeChat.ownerId === profile?.uid)) && (
                          <button
                            type="button"
                            disabled={headerMenuBusy}
                            onClick={async () => {
                              setHeaderMenuBusy(true);
                              setHeaderMenuError('');
                              try {
                                await deleteChatForBoth(activeChat.chatId);
                                setShowHeaderMenu(false);
                              } catch {
                                setHeaderMenuError('Не удалось удалить чат у всех участников');
                              } finally {
                                setHeaderMenuBusy(false);
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left cursor-pointer disabled:opacity-50"
                          >
                            <div className="text-xs font-bold text-rose-500">
                              {activeChat.type === 'direct' ? 'Удалить у двоих' : 'Удалить у всех'}
                            </div>
                            <div className="text-[10px] text-rose-500/80">
                              Удалит переписку для обеих сторон
                            </div>
                          </button>
                        )}
                    </div>
                  </div>
                </div>
                </div>,
                document.body
              )}
          </div>
        </div>
      </div>

      {/* Collapsible In-Chat Search Bar */}
      {isSearchingChat && (
        <div className="bg-white border-b border-[#E1E3E6] px-3 md:px-5 py-2 flex items-center gap-2 z-10">
          <Search className="w-4 h-4 text-[#818C99] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={chatSearchQuery}
            onChange={e => {
              setChatSearchQuery(e.target.value);
              setChatSearchIndex(0);
            }}
            placeholder="Найти сообщение в переписке..."
            className="flex-1 min-w-0 bg-transparent text-xs text-[#19191A] placeholder-[#818C99] focus:outline-none"
          />
          {chatSearchQuery.trim() && (
            <span className="text-[11px] text-[#818C99] tabular-nums shrink-0">
              {searchMatches.length === 0
                ? '0 совпадений'
                : `${chatSearchIndex + 1} / ${searchMatches.length}`}
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={searchMatches.length === 0}
              onClick={() =>
                setChatSearchIndex(prev => (prev + 1) % Math.max(1, searchMatches.length))
              }
              className="p-1 rounded-md hover:bg-[#EDEFEF] text-[#626D7A] disabled:opacity-40 cursor-pointer"
              title="Предыдущее сообщение"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={searchMatches.length === 0}
              onClick={() =>
                setChatSearchIndex(prev =>
                  (prev - 1 + Math.max(1, searchMatches.length)) %
                  Math.max(1, searchMatches.length)
                )
              }
              className="p-1 rounded-md hover:bg-[#EDEFEF] text-[#626D7A] disabled:opacity-40 cursor-pointer"
              title="Следующее сообщение"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSearchingChat(false);
                setChatSearchQuery('');
              }}
              className="p-1 rounded-md hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#19191A] cursor-pointer"
              title="Закрыть поиск"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pinned Message Banner */}
      {pinnedMessage && (
        <div
          onClick={() => jumpToMessage(pinnedMessage.messageId)}
          className="bg-white/95 border-b border-[#E1E3E6] px-3 md:px-5 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#F7F8FA] transition-colors z-10"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Pin className="w-4 h-4 text-[#0077FF] shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#0077FF]">
                Закреплённое сообщение · {pinnedMessage.senderName}
              </div>
              <div className="text-xs text-[#2C3138] truncate">{pinnedMessage.content}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              handlePinMessage(pinnedMessage);
            }}
            className="p-1.5 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#EDEFEF] cursor-pointer shrink-0"
            title="Открепить сообщение"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recording / Media Error Banner */}
      {recordingError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between z-10">
          <span>{recordingError}</span>
          <button
            type="button"
            onClick={() => setRecordingError(null)}
            className="text-red-500 hover:text-red-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Video Circle Recording Modal */}
      {isRecordingVideoCircle && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6">
          <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-[#0077FF] shadow-2xl mb-6">
            <video
              ref={liveVideoPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-mono px-3 py-0.5 rounded-full flex items-center gap-1.5 tabular-nums">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>0:{recordingSeconds.toString().padStart(2, '0')}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => stopAndSendRecording(true)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => stopAndSendRecording(false)}
              className="px-6 py-2.5 rounded-xl bg-[#0077FF] hover:bg-[#0066EA] text-white text-sm font-semibold shadow-lg cursor-pointer flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Отправить кружочек</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4 md:px-5 space-y-1 z-10 relative"
      >
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="bg-white border border-[#E1E3E6] rounded-2xl px-6 py-5 max-w-sm shadow-xs">
              <h4 className="text-sm font-bold text-[#19191A] mb-1">Сообщений пока нет</h4>
              <p className="text-xs text-[#818C99] leading-relaxed">
                Напишите первое сообщение, перетащите фото или запишите голосовое.
              </p>
            </div>
          </div>
        ) : (
          visibleMessages.map((msg: Message, index: number) => {
            const prevMsg = index > 0 ? visibleMessages[index - 1] : null;
            const nextMsg =
              index < visibleMessages.length - 1 ? visibleMessages[index + 1] : null;

            const currentDay = getDayKey(msg.createdAt);
            const prevDay = prevMsg ? getDayKey(prevMsg.createdAt) : null;
            const showDateDivider = currentDay !== prevDay;

            const isMe = Boolean(profile?.uid && msg.senderId === profile.uid);
            const isSameSenderAsPrev =
              Boolean(prevMsg) && !showDateDivider && prevMsg!.senderId === msg.senderId;
            const isSameSenderAsNext =
              Boolean(nextMsg) &&
              getDayKey(nextMsg!.createdAt) === currentDay &&
              nextMsg!.senderId === msg.senderId;

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

            const isHighlighted = highlightedMessageId === msg.messageId;
            const senderObj = usersDirectory.find(u => u.uid === msg.senderId);
            const senderAvatar = senderObj?.avatarUrl || msg.senderAvatar;

            return (
              <React.Fragment key={msg.messageId}>
                {showDateDivider && (
                  <div className="flex justify-center py-2.5">
                    <span className="px-3 py-1 rounded-lg bg-white/90 border border-[#E1E3E6] text-[11px] font-medium text-[#626D7A] shadow-2xs">
                      {formatDayLabel(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  id={`msg-item-${msg.messageId}`}
                  className={`group flex flex-col transition-colors duration-300 ${
                    isMe ? 'items-end' : 'items-start'
                  } ${isSameSenderAsPrev ? 'mt-0.5' : 'mt-2.5'} ${
                    isHighlighted ? 'bg-[#0077FF]/10 rounded-xl px-1.5 py-0.5' : ''
                  }`}
                >
                  <div
                    className={`flex items-end gap-2 max-w-[90%] sm:max-w-lg lg:max-w-xl ${
                      isMe ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Author avatar in groups/channels */}
                    {!isMe && activeChat.type !== 'direct' && (
                      <div className="w-7 shrink-0">
                        {!isSameSenderAsNext && (
                          <button
                            type="button"
                            onClick={() => openUserProfile(msg.senderId)}
                            className="w-7 h-7 rounded-full overflow-hidden border border-[#E1E3E6] cursor-pointer block"
                            title={msg.senderName}
                          >
                            <Avatar
                              src={senderAvatar}
                              name={msg.senderName}
                              className="w-7 h-7 rounded-full"
                            />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      onContextMenu={e => handleMessageContextMenu(e, msg)}
                      onTouchStart={e => handleMessageTouchStart(e, msg)}
                      onTouchMove={handleMessageTouchMove}
                      onTouchEnd={handleMessageTouchEnd}
                      onTouchCancel={handleMessageTouchEnd}
                      className={`rounded-2xl px-3.5 py-2 relative cursor-context-menu ${
                        isMe
                          ? `bg-[#CCE4FF] text-[#000000] border border-[#B8D7FC] shadow-2xs ${
                              isSameSenderAsNext ? '' : 'rounded-br-[4px]'
                            }`
                          : `bg-white text-[#19191A] border border-[#E1E3E6] shadow-2xs ${
                              isSameSenderAsNext ? '' : 'rounded-bl-[4px]'
                            }`
                      }`}
                    >
                      {/* Sender Name in Groups/Channels */}
                      {!isMe && activeChat.type !== 'direct' && !isSameSenderAsPrev && (
                        <button
                          type="button"
                          onClick={() => openUserProfile(msg.senderId)}
                          className="text-[11px] font-semibold text-[#0077FF] hover:underline mb-0.5 block text-left cursor-pointer"
                        >
                          {msg.senderName}
                        </button>
                      )}

                      {/* Forwarded label */}
                      {msg.forwardedFromName && (
                        <div
                          className={`flex items-center gap-1.5 text-[11px] font-medium mb-1 pb-1 border-b ${
                            isMe
                              ? 'text-[#0077FF] border-[#0077FF]/20'
                              : 'text-[#2A5885] border-[#E1E3E6]'
                          }`}
                        >
                          <Forward className="w-3 h-3 shrink-0" />
                          <span className="truncate">Переслано от {msg.forwardedFromName}</span>
                        </div>
                      )}

                      {/* Reply Quote */}
                      {msg.replyToText && (
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            if (msg.replyToId) jumpToMessage(msg.replyToId);
                          }}
                          className={`mb-1.5 px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                            isMe
                              ? 'bg-white/60 border-[#0077FF]/25 text-[#19191A] hover:bg-white/80'
                              : 'bg-[#F2F3F5] border-[#E1E3E6] text-[#19191A] hover:bg-[#EDEFEF]'
                          }`}
                        >
                          <div className="font-semibold text-[11px] text-[#0077FF] truncate">
                            {msg.replyToSender || 'Сообщение'}
                          </div>
                          <div className="opacity-85 truncate text-[11px]">{msg.replyToText}</div>
                        </div>
                      )}

                      {/* Text or System Security Alert Card */}
                      {msg.type === 'text' &&
                        (msg.senderId === 'mender_security_bot' ||
                        msg.content.includes('🔐 Вход в аккаунт') ||
                        msg.content.includes('Данные авторизации') ? (
                          (() => {
                            const deviceMatch = msg.content.match(/• Устройство: (.*)/);
                            const ipMatch = msg.content.match(/• IP-адрес: (.*)/);
                            const timeMatch = msg.content.match(/• Время входа: (.*)/);
                            const codeMatch = msg.content.match(/• Код подтверждения.*: (.*)/);

                            const device = deviceMatch
                              ? deviceMatch[1]
                              : 'Устройство авторизации';
                            const ip = ipMatch ? ipMatch[1] : '—';
                            const time = timeMatch ? timeMatch[1] : formatTime(msg.createdAt);
                            const code = codeMatch ? codeMatch[1].trim() : '';

                            const responseStatus = securityResponses[msg.messageId];

                            return (
                              <div className="p-3 rounded-xl bg-white border border-[#E1E3E6] space-y-2.5 text-[#19191A] select-none my-0.5 min-w-[240px]">
                                <div className="flex items-center gap-2 border-b border-[#E1E3E6] pb-2">
                                  <div className="w-7 h-7 rounded-lg bg-[#0077FF] flex items-center justify-center text-white shrink-0">
                                    <ShieldCheck className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-[#19191A] flex items-center gap-1">
                                      <span>Mender Безопасность</span>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
                                    </div>
                                    <div className="text-[11px] text-[#818C99]">
                                      Оповещение о входе
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1.5 text-xs text-[#2C3138]">
                                  <div className="flex items-center justify-between gap-3 bg-[#F7F8FA] px-2.5 py-1.5 rounded-lg border border-[#E1E3E6]">
                                    <span className="text-[#818C99] shrink-0">Устройство</span>
                                    <span className="font-semibold text-[#19191A] truncate text-right">
                                      {device}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 bg-[#F7F8FA] px-2.5 py-1.5 rounded-lg border border-[#E1E3E6]">
                                    <span className="text-[#818C99] shrink-0">IP-адрес</span>
                                    <span className="font-mono font-semibold text-[#0077FF] tabular-nums">
                                      {ip}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 bg-[#F7F8FA] px-2.5 py-1.5 rounded-lg border border-[#E1E3E6]">
                                    <span className="text-[#818C99] shrink-0">Время</span>
                                    <span className="font-medium text-[#19191A] truncate text-right tabular-nums">
                                      {time}
                                    </span>
                                  </div>

                                  {code && (
                                    <div className="p-2.5 rounded-xl bg-[#E5F1FF] border border-[#B8D9FF] flex items-center justify-between mt-1">
                                      <span className="text-xs font-semibold text-[#0077FF]">
                                        Код подтверждения
                                      </span>
                                      <span className="font-mono font-black text-base text-[#0077FF] tracking-widest bg-white px-2.5 py-0.5 rounded-lg border border-[#0077FF]/20 tabular-nums">
                                        {code}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {responseStatus === 'confirmed' ? (
                                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700 flex items-center justify-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Вход подтверждён</span>
                                  </div>
                                ) : responseStatus === 'reported' ? (
                                  <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center justify-center gap-1.5">
                                    <ShieldAlert className="w-4 h-4 shrink-0" />
                                    <span>Вход отмечен как подозрительный. Рекомендуем сменить пароль.</span>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSecurityResponses(prev => ({
                                          ...prev,
                                          [msg.messageId]: 'confirmed',
                                        }))
                                      }
                                      className="py-2 px-2.5 rounded-xl bg-[#4BB34B] hover:bg-[#3FA03F] text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Да, это я</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSecurityResponses(prev => ({
                                          ...prev,
                                          [msg.messageId]: 'reported',
                                        }))
                                      }
                                      className="py-2 px-2.5 rounded-xl bg-[#E64646] hover:bg-[#D33535] text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5" />
                                      <span>Это не я</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                            {renderHighlightedText(msg.content)}
                          </p>
                        ))}

                      {/* Image with Lightbox Click */}
                      {msg.type === 'image' && (
                        <div className="space-y-1.5">
                          <img
                            src={getSyncCachedMediaUrl(msg.mediaUrl)}
                            alt={msg.content || 'Фото'}
                            onClick={e => {
                              e.stopPropagation();
                              const url = getSyncCachedMediaUrl(msg.mediaUrl);
                              if (url) setLightboxImageUrl(url);
                            }}
                            className="rounded-xl max-h-72 object-cover w-full cursor-zoom-in hover:opacity-95 transition-opacity"
                          />
                          {msg.content && msg.content !== 'Фотография' && (
                            <p className="text-sm">{renderHighlightedText(msg.content)}</p>
                          )}
                        </div>
                      )}

                      {/* Video */}
                      {msg.type === 'video' && (
                        <div className="space-y-1.5">
                          <video
                            src={getSyncCachedMediaUrl(msg.mediaUrl)}
                            controls
                            className="rounded-xl max-h-72 w-full bg-black"
                          />
                        </div>
                      )}

                      {/* Voice */}
                      {msg.type === 'voice' && (
                        <div className="flex items-center gap-3 py-1 min-w-[200px]">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              togglePlayVoice(msg.messageId, msg.mediaUrl);
                            }}
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer bg-[#0077FF] text-white hover:bg-[#0066EA] transition-colors"
                          >
                            {playingVoiceId === msg.messageId ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-1 h-4">
                              {[45, 75, 35, 95, 60, 85, 100, 65, 40, 80, 50, 70].map((h, i) => (
                                <div
                                  key={i}
                                  className={`w-1 rounded-full transition-colors ${
                                    playingVoiceId === msg.messageId
                                      ? 'bg-[#0077FF]'
                                      : isMe
                                      ? 'bg-[#0077FF]/60'
                                      : 'bg-[#818C99]/60'
                                  }`}
                                  style={{ height: `${h}%` }}
                                />
                              ))}
                            </div>
                            <span
                              className={`text-[10px] font-mono tabular-nums ${
                                isMe ? 'text-[#2A5885]' : 'text-[#818C99]'
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
                            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono tabular-nums px-2.5 py-0.5 rounded-full pointer-events-none">
                              0:{(msg.duration || 10).toString().padStart(2, '0')}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Timestamp & Delivery Status */}
                      <div
                        className={`flex items-center gap-1 mt-1 justify-end text-[10px] tabular-nums ${
                          isMe ? 'text-[#2A5885]' : 'text-[#818C99]'
                        }`}
                      >
                        <span>{formatTime(msg.createdAt)}</span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#0077FF]" />}
                      </div>
                    </div>

                    {/* Desktop Quick Hover Actions */}
                    <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mb-1">
                      <button
                        type="button"
                        onClick={() => handleStartReplyMessage(msg)}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-white border border-[#E1E3E6] text-[#626D7A] hover:text-[#0077FF] cursor-pointer shadow-2xs"
                        title="Ответить"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => reactToMessage(msg, '❤️')}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-white border border-[#E1E3E6] text-[#626D7A] hover:text-red-500 cursor-pointer shadow-2xs"
                        title="Поставить реакцию"
                      >
                        <Heart className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          openMessageContextMenu(rect.left, rect.bottom + 4, msg);
                        }}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-white border border-[#E1E3E6] text-[#626D7A] hover:text-[#19191A] cursor-pointer shadow-2xs"
                        title="Все действия"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Reaction Pill under message */}
                  {displayLikes > 0 && (
                    <div
                      className={`flex items-center gap-1.5 mt-1 ${
                        !isMe && activeChat.type !== 'direct' ? 'pl-9' : 'px-1'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => reactToMessage(msg, activeReactionEmoji)}
                        className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border bg-white border-[#E1E3E6] text-[#19191A] shadow-2xs hover:bg-[#F2F3F5]"
                        title="Нажмите, чтобы убрать реакцию"
                      >
                        <span>{activeReactionEmoji}</span>
                        <span className="text-[11px] tabular-nums">{displayLikes}</span>
                      </button>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
        {activeChatTypingUsers.length > 0 && (
          <div className="flex items-end gap-2 mt-2.5">
            {activeChat.type !== 'direct' && (
              <div className="w-7 shrink-0">
                <Avatar
                  src={
                    usersDirectory.find(u => u.uid === activeChatTypingUsers[0].userId)?.avatarUrl
                  }
                  name={activeChatTypingUsers[0].displayName}
                  className="w-7 h-7 rounded-full border border-[#E1E3E6]"
                />
              </div>
            )}
            <div className="rounded-2xl rounded-bl-[4px] px-3.5 py-2 bg-white border border-[#E1E3E6] shadow-2xs inline-flex items-center gap-2">
              <TypingIndicatorText
                typingUsers={activeChatTypingUsers}
                isDirect={activeChat.type === 'direct'}
                showPrefix={activeChat.type !== 'direct'}
                className="text-xs font-medium text-[#0077FF]"
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-20 right-5 z-20 w-10 h-10 rounded-full bg-white border border-[#E1E3E6] text-[#0077FF] shadow-md hover:bg-[#F7F8FA] flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          title="Вниз к последним сообщениям"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Input Bottom Bar */}
      <div className="w-full min-w-0 shrink-0 px-2.5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:px-3 md:pt-3 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white border-t border-[#E1E3E6] relative z-20">
        {replyingToMessage && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center justify-between gap-2 text-xs text-[#19191A]">
            <div className="flex items-center gap-2 min-w-0">
              <Reply className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-[#0077FF] mr-1.5">
                  Ответ {replyingToMessage.senderName}:
                </span>
                <span className="text-[#626D7A]">{replyingToMessage.content}</span>
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
          <div className="mb-2 px-3 py-2 rounded-xl bg-[#F7F8FA] border border-[#E1E3E6] flex items-center justify-between gap-2 text-xs text-[#19191A]">
            <div className="flex items-center gap-2 min-w-0">
              <Pencil className="w-3.5 h-3.5 text-[#0077FF] shrink-0" />
              <span className="truncate text-[#626D7A]">
                Редактирование: <span className="text-[#19191A] font-medium">{editingMessage.content}</span>
              </span>
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
          <div className="flex items-center justify-between py-1 gap-3">
            <span className="text-xs text-[#818C99]">
              Подпишитесь, чтобы писать сообщения в этом канале
            </span>
            <button
              type="button"
              onClick={() => joinPublicChat(activeChat)}
              className="px-4 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              Подписаться
            </button>
          </div>
        ) : blockedOtherUser ? (
          <div className="flex items-center justify-between text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl">
            <span>Вы заблокировали этого пользователя</span>
            {otherUser && (
              <button
                type="button"
                onClick={() => unblockUser(otherUser.uid)}
                className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold cursor-pointer"
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
            <div className="flex items-center gap-2.5 text-red-600 text-xs font-mono tabular-nums">
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
              <div
                onClick={e => e.stopPropagation()}
                className="absolute bottom-full mb-2 left-2.5 sm:left-3 bg-white border border-[#E1E3E6] rounded-2xl p-1.5 shadow-xl flex flex-col gap-1 z-30 w-60 max-w-[calc(100vw-20px)]"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#19191A] hover:bg-[#F2F3F5] transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#0077FF]" />
                  <span>Фото или видео</span>
                </button>
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#19191A] hover:bg-[#F2F3F5] transition-colors cursor-pointer"
                >
                  <Mic className="w-4 h-4 text-[#4BB34B]" />
                  <span>Голосовое сообщение</span>
                </button>
                <button
                  type="button"
                  onClick={startVideoCircleRecording}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#19191A] hover:bg-[#F2F3F5] transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#0077FF]" />
                  <span>Видеокружочек</span>
                </button>
              </div>
            )}

            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 right-2.5 sm:right-14 z-30 max-w-[calc(100vw-20px)]">
                <ChatEmojiPicker
                  onSelect={emoji => {
                    setInputText(prev => `${prev}${emoji}`);
                    textInputRef.current?.focus();
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <form onSubmit={handleSendText} className="w-full min-w-0 flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setShowEmojiPicker(false);
                  setShowAttachmentsMenu(prev => !prev);
                }}
                disabled={uploadingMedia}
                className="w-10 h-10 rounded-full text-[#818C99] hover:text-[#0077FF] hover:bg-[#F2F3F5] transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                title="Прикрепить фото, видео, голосовое или кружочек"
              >
                {uploadingMedia ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#0077FF]" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>

              <div className="flex-1 min-w-0 relative flex items-center">
                <input
                  ref={textInputRef}
                  type="text"
                  value={inputText}
                  onChange={e => {
                    const nextVal = e.target.value;
                    setInputText(nextVal);
                    notifyTypingActivity(nextVal.trim().length > 0);
                  }}
                  onBlur={() => stopTypingNow()}
                  onPaste={handleComposerPaste}
                  placeholder={
                    editingMessage
                      ? 'Изменить текст сообщения...'
                      : replyingToMessage
                      ? `Ответить ${replyingToMessage.senderName}...`
                      : 'Написать сообщение...'
                  }
                  className="w-full min-w-0 h-10 bg-[#F2F3F5] focus:bg-white border border-[#E1E3E6] rounded-full py-2 pl-4 pr-10 text-[#19191A] placeholder-[#818C99] text-[16px] sm:text-sm focus:outline-none focus:border-[#0077FF] transition-colors"
                />
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setShowAttachmentsMenu(false);
                    setShowEmojiPicker(prev => !prev);
                  }}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    showEmojiPicker
                      ? 'text-[#0077FF] bg-[#E5EBF1]'
                      : 'text-[#818C99] hover:text-[#0077FF]'
                  }`}
                  title="Эмодзи"
                >
                  <Smile className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={startVoiceRecording}
                className="hidden sm:flex w-10 h-10 rounded-full text-[#818C99] hover:text-[#0077FF] hover:bg-[#F2F3F5] transition-colors cursor-pointer shrink-0 items-center justify-center"
                title="Записать голосовое сообщение"
              >
                <Mic className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={startVideoCircleRecording}
                className="hidden sm:flex w-10 h-10 rounded-full text-[#818C99] hover:text-[#0077FF] hover:bg-[#F2F3F5] transition-colors cursor-pointer shrink-0 items-center justify-center"
                title="Записать видеокружочек"
              >
                <Camera className="w-5 h-5" />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-full bg-[#0077FF] hover:bg-[#0066EA] disabled:opacity-40 text-white shadow-xs transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                title={editingMessage ? 'Сохранить' : 'Отправить'}
              >
                {editingMessage ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Modular Info Drawer with Shared Media Gallery */}
      {showInfoDrawer && (
        <ChatInfoDrawer
          activeChat={activeChat}
          otherUser={otherUser}
          blockedOtherUser={blockedOtherUser}
          myUid={profile?.uid}
          activeChatMembers={activeChatMembers}
          candidateUsersToAdd={candidateUsersToAdd}
          messages={visibleMessages}
          canManageMembers={canManageMembers}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onClose={() => setShowInfoDrawer(false)}
          onOpenUserProfile={openUserProfile}
          onStartCall={startCall}
          onOpenWallpaperModal={() => setShowWallpaperModal(true)}
          onTogglePinChat={togglePinChat}
          onToggleMuteChat={toggleMuteChat}
          onToggleArchiveChat={toggleArchiveChat}
          onDeleteChatForMe={deleteChatForMe}
          onDeleteChatForBoth={deleteChatForBoth}
          onBlockToggle={(uid, currentlyBlocked) =>
            currentlyBlocked ? unblockUser(uid) : blockUser(uid)
          }
          onOpenReportModal={() => setShowReportModal(true)}
          onOpenSearchInChat={() => {
            setIsSearchingChat(true);
            setTimeout(() => searchInputRef.current?.focus(), 60);
          }}
          onOpenLightbox={url => setLightboxImageUrl(url)}
          onAddMember={addMemberToChat}
          onUpdateMemberRole={updateMemberRole}
          onRemoveMember={removeMemberFromChat}
        />
      )}

      {/* Photo Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <a
              href={lightboxImageUrl}
              download="mender-image.jpg"
              onClick={e => e.stopPropagation()}
              className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors"
              title="Скачать изображение"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={lightboxImageUrl}
            alt="Просмотр фото"
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-xl object-contain shadow-2xl"
          />
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
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium text-center">
                Жалоба успешно отправлена!
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <textarea
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="Опишите причину жалобы..."
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

      {/* Wallpaper Modal for this chat */}
      {showWallpaperModal && (
        <WallpaperStudioModal
          onClose={() => setShowWallpaperModal(false)}
          targetChatId={activeChat.chatId}
          targetChatName={activeChat.name}
        />
      )}

      {/* Context Menu */}
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
            className="fixed w-60 bg-white border border-[#E1E3E6] rounded-2xl shadow-xl p-2 text-[#19191A] space-y-1"
          >
            {/* Quick Reactions */}
            <div className="flex items-center justify-between gap-1 px-1.5 py-1.5 bg-[#F2F3F5] rounded-xl border border-[#E1E3E6] mb-1">
              {QUICK_REACTIONS.map(emoji => {
                const currentEmoji =
                  contextMenu.msg.reactionEmoji ||
                  messageReactions[contextMenu.msg.messageId] ||
                  (contextMenu.msg.likesCount > 0 ? '❤️' : '');
                const isSelected =
                  Boolean(currentEmoji === emoji) &&
                  (messageLikesByMe[contextMenu.msg.messageId] ??
                    contextMenu.msg.likesCount > 0) === true;

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
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

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

            <button
              type="button"
              onClick={() => {
                handlePinMessage(contextMenu.msg);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#19191A] hover:bg-[#F2F3F5] hover:text-[#0077FF] transition-colors cursor-pointer"
            >
              {pinnedMessageId === contextMenu.msg.messageId ? (
                <>
                  <PinOff className="w-4 h-4 text-[#0077FF] shrink-0" />
                  <span>Открепить</span>
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 text-[#0077FF] shrink-0" />
                  <span>Закрепить</span>
                </>
              )}
            </button>

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

            <button
              type="button"
              onClick={() => {
                deleteMessageForEveryone(contextMenu.msg.messageId);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
              <span>Удалить у всех</span>
            </button>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {forwardingMessage && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={() => setForwardingMessage(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#E1E3E6] rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 text-[#19191A] shadow-xl space-y-4 max-h-[85dvh] flex flex-col"
          >
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Forward className="w-4 h-4 text-[#0077FF]" />
                <h4 className="text-sm font-bold text-[#19191A]">Переслать сообщение</h4>
              </div>
              <button
                type="button"
                onClick={() => setForwardingMessage(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#EDEFEF] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F5F6F8] border border-[#E1E3E6] text-xs text-[#2C3138] truncate shrink-0">
              {forwardingMessage.content}
            </div>

            <div className="flex-1 max-h-72 overflow-y-auto space-y-1.5 pr-1">
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
                    <Avatar
                      src={c.avatarUrl}
                      name={c.name}
                      isSystemSecurity={
                        c.peerUserId === 'mender_security_bot' ||
                        c.chatId.startsWith('chat_system_security_') ||
                        c.name === 'Mender Безопасность'
                      }
                      className="w-9 h-9 rounded-full border border-[#E1E3E6] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#19191A] truncate">{c.name}</div>
                      <div className="text-[10px] text-[#818C99] truncate">
                        {c.type === 'direct' ? 'Личный чат' : c.type === 'group' ? 'Беседа' : 'Сообщество'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1.5 rounded-lg bg-[#0077FF] text-white text-[11px] font-semibold shrink-0">
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
                      <Avatar
                        src={userObj.avatarUrl}
                        name={userObj.displayName}
                        className="w-9 h-9 rounded-full border border-[#E1E3E6] shrink-0"
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
                    <span className="px-2.5 py-1.5 rounded-lg bg-[#E5EBF1] text-[#0077FF] text-[11px] font-semibold shrink-0">
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
