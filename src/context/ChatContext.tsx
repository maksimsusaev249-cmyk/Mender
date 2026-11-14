import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import {
  Chat,
  ChatMember,
  Message,
  MessageType,
  TypingStatus,
  Post,
  PostMediaItem,
  PostComment,
  UserPublic,
  UserMembership,
  CallSession,
  ScreenShareOptions,
  IceCandidateDoc,
  VisibilityType,
  WallpaperConfig,
  CustomWallpaper,
  ProfileFolder,
} from '../types';
import { sanitizeId, deriveUidFromEmail } from '../utils/crypto';
import {
  uploadMediaFile,
  uploadWallpaperWithProgress,
  deleteStorageWallpaper,
} from '../utils/media';

const FALLBACK_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

async function getDynamicRtcConfig(): Promise<RTCConfiguration> {
  try {
    const idToken = await auth.currentUser?.getIdToken?.();
    if (!idToken) return FALLBACK_RTC_CONFIG;

    const res = await fetch('/api/turn-credentials', {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return FALLBACK_RTC_CONFIG;

    const data = (await res.json()) as { iceServers?: RTCIceServer[] };
    if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      return {
        iceServers: data.iceServers,
        iceCandidatePoolSize: 10,
      };
    }
  } catch {
    // Fallback gracefully to STUN when offline or endpoint unavailable
  }
  return FALLBACK_RTC_CONFIG;
}

function extractTimestampMs(ts: any, idWithTimestamp?: string): number {
  if (ts) {
    if (typeof ts.seconds === 'number') {
      return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
    }
    if (typeof ts.toMillis === 'function') {
      return ts.toMillis();
    }
    if (typeof ts === 'number') {
      return ts;
    }
  }
  if (idWithTimestamp) {
    const match = idWithTimestamp.match(/_(\d{12,14})_/);
    if (match) {
      return Number(match[1]);
    }
  }
  return Date.now();
}

export interface GroupCallParticipant {
  uid: string;
  displayName: string;
  avatarUrl: string;
  status: 'ringing' | 'connected' | 'ended';
  callId: string;
}

interface ChatContextType {
  usersDirectory: UserPublic[];
  chats: Chat[];
  publicChannelsAndGroups: Chat[];
  activeChatId: string | null;
  activeChat: Chat | null;
  activeChatMembers: ChatMember[];
  messages: Message[];
  typingUsersByChat: Record<string, TypingStatus[]>;
  messageLikesByMe: Record<string, boolean>;
  messageReactions: Record<string, string>;
  deletedForMeMessageIds: Record<string, boolean>;
  posts: Post[];
  postLikesByMe: Record<string, boolean>;
  postComments: Record<string, PostComment[]>;
  commentLikesByMe: Record<string, boolean>;
  commentLikesCount: Record<string, number>;
  activeTab: 'chats' | 'feed' | 'people' | 'video' | 'music' | 'calls' | 'channels' | 'settings' | 'menu';
  searchQuery: string;
  // Wallpapers state & actions
  wallpaperConfigs: Record<string, WallpaperConfig>;
  customWallpapers: CustomWallpaper[];
  getEffectiveWallpaper: (chatId?: string | null) => WallpaperConfig | null;
  saveWallpaperConfig: (
    scopeId: string,
    config: Omit<WallpaperConfig, 'scopeId' | 'userId' | 'updatedAt'>
  ) => Promise<void>;
  resetWallpaperConfig: (scopeId: string) => Promise<void>;
  uploadCustomWallpaper: (
    blob: Blob,
    name: string,
    onProgress: (pct: number) => void
  ) => Promise<CustomWallpaper>;
  deleteCustomWallpaper: (wallpaper: CustomWallpaper) => Promise<void>;
  // Call state
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  callHistory: CallSession[];
  localStream: MediaStream | null;
  localCameraStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isSpeakerOn: boolean;
  cameraFacingMode: 'user' | 'environment';
  availableCameras: MediaDeviceInfo[];
  selectedCameraId: string;
  groupCallParticipants: GroupCallParticipant[];
  // Actions
  setActiveTab: (tab: 'chats' | 'feed' | 'people' | 'video' | 'music' | 'calls' | 'channels' | 'settings' | 'menu') => void;
  setActiveChatId: (chatId: string | null) => void;
  setSearchQuery: (q: string) => void;
  startDirectChatWithUser: (peerUser: UserPublic) => Promise<string>;
  startDirectChatByContact: (emailOrUsername: string, customName?: string) => Promise<string>;
  createGroupOrChannel: (params: {
    type: 'group' | 'channel';
    visibility: VisibilityType;
    name: string;
    description: string;
    memberUsers: UserPublic[];
    avatarFile?: File | null;
  }) => Promise<string>;
  joinPublicChat: (chat: Chat) => Promise<void>;
  leaveChat: (chatId: string) => Promise<void>;
  addMemberToChat: (
    chatId: string,
    contactOrUser: UserPublic | string,
    role?: 'admin' | 'moderator' | 'member'
  ) => Promise<void>;
  updateMemberRole: (
    chatId: string,
    memberUid: string,
    newRole: 'admin' | 'moderator' | 'member'
  ) => Promise<void>;
  removeMemberFromChat: (chatId: string, memberUid: string) => Promise<void>;
  togglePinChat: (chatId: string) => Promise<void>;
  toggleMuteChat: (chatId: string) => Promise<void>;
  toggleArchiveChat: (chatId: string) => Promise<void>;
  deleteChatForMe: (chatId: string) => Promise<void>;
  deleteChatForBoth: (chatId: string) => Promise<void>;
  setChatTyping: (chatId: string, isTyping: boolean) => Promise<void>;
  sendMessage: (params: {
    content: string;
    type?: MessageType;
    mediaBlobOrFile?: Blob | File | null;
    duration?: number;
    replyTo?: { messageId: string; senderName: string; content: string } | null;
    forwardedFromName?: string;
  }) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  deleteMessageForMe: (msg: Message) => Promise<void>;
  deleteMessageForEveryone: (messageId: string) => Promise<void>;
  likeMessage: (msg: Message) => Promise<void>;
  reactToMessage: (msg: Message, emoji: string) => Promise<void>;
  forwardMessageToTarget: (msg: Message, target: Chat | UserPublic) => Promise<void>;
  // Feed & Profile Folders actions
  myProfileFolders: ProfileFolder[];
  viewedUserProfile: UserPublic | null;
  viewedUserFolders: ProfileFolder[];
  openUserProfile: (userOrUid: UserPublic | string) => Promise<void>;
  closeUserProfile: () => void;
  createProfileFolder: (name: string) => Promise<string>;
  deleteProfileFolder: (folderId: string) => Promise<void>;
  togglePostInFolder: (folderId: string, postId: string) => Promise<void>;
  createPost: (params: {
    content: string;
    visibility?: VisibilityType;
    mediaFile?: File | null;
    mediaFiles?: File[];
    mediaLayout?: 'carousel' | 'grid';
    folderId?: string | null;
  }) => Promise<void>;
  editPost: (postId: string, newContent: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  toggleLikePost: (post: Post) => Promise<void>;
  loadCommentsForPost: (postId: string, postVisibility: VisibilityType) => void;
  addCommentToPost: (post: Post, content: string) => Promise<void>;
  editComment: (post: Post, comment: PostComment, newContent: string) => Promise<void>;
  deleteComment: (post: Post, comment: PostComment) => Promise<void>;
  toggleLikeComment: (commentId: string) => void;
  // Real WebRTC Call actions
  startCall: (type: 'audio' | 'video', targetChat?: Chat | null) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  declineOrEndCall: () => Promise<void>;
  toggleMuteAudio: () => void;
  toggleMuteVideo: () => Promise<void>;
  toggleScreenShare: (options?: ScreenShareOptions) => Promise<void>;
  startScreenShare: (options?: ScreenShareOptions) => Promise<boolean>;
  stopScreenShare: () => Promise<void>;
  switchCamera: (targetDeviceId?: string) => Promise<void>;
  refreshAvailableCameras: () => Promise<void>;
  toggleSpeakerphone: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, profile, isAuthReady } = useAuth();

  const [usersDirectory, setUsersDirectory] = useState<UserPublic[]>([]);
  const [memberships, setMemberships] = useState<Record<string, UserMembership>>({});
  const [ownedChatsMap, setOwnedChatsMap] = useState<Record<string, Chat>>({});
  const [peerChatsMap, setPeerChatsMap] = useState<Record<string, Chat>>({});
  const [publicChatsMap, setPublicChatsMap] = useState<Record<string, Chat>>({});
  const [memberFetchedChatsMap, setMemberFetchedChatsMap] = useState<Record<string, Chat>>({});

  const [wallpaperConfigs, setWallpaperConfigs] = useState<Record<string, WallpaperConfig>>({});
  const [customWallpapers, setCustomWallpapers] = useState<CustomWallpaper[]>([]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatMembers, setActiveChatMembers] = useState<ChatMember[]>([]);
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [rawTypingMap, setRawTypingMap] = useState<Record<string, TypingStatus[]>>({});
  const [typingNowMs, setTypingNowMs] = useState<number>(() => Date.now());
  const [chatPrefs, setChatPrefs] = useState<
    Record<
      string,
      {
        isPinned?: boolean;
        isMuted?: boolean;
        isArchived?: boolean;
        isHidden?: boolean;
        clearedAtMs?: number;
      }
    >
  >({});
  const [messageLikesByMe, setMessageLikesByMe] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mender_message_likes_me') || '{}');
    } catch {
      return {};
    }
  });
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mender_message_reactions') || '{}');
    } catch {
      return {};
    }
  });
  const [deletedForMeMessageIds, setDeletedForMeMessageIds] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mender_deleted_msgs_for_me') || '{}');
    } catch {
      return {};
    }
  });

  const [posts, setPosts] = useState<Post[]>([]);
  const [postLikesByMe, setPostLikesByMe] = useState<Record<string, boolean>>({});
  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [commentLikesByMe, setCommentLikesByMe] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mender_comment_likes_me') || '{}');
    } catch {
      return {};
    }
  });
  const [commentLikesCount, setCommentLikesCount] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mender_comment_likes_count') || '{}');
    } catch {
      return {};
    }
  });

  const [activeTab, setActiveTab] = useState<'chats' | 'feed' | 'people' | 'video' | 'music' | 'calls' | 'channels' | 'settings' | 'menu'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [myProfileFolders, setMyProfileFolders] = useState<ProfileFolder[]>([]);
  const [viewedUserProfile, setViewedUserProfile] = useState<UserPublic | null>(null);
  const [viewedUserFolders, setViewedUserFolders] = useState<ProfileFolder[]>([]);

  // WebRTC Call State
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [groupCallParticipants, setGroupCallParticipants] = useState<GroupCallParticipant[]>([]);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);
  const isAudioMutedRef = useRef<boolean>(false);
  const isVideoMutedRef = useRef<boolean>(false);
  const isScreenSharingRef = useRef<boolean>(false);
  const commentUnsubsRef = useRef<Record<string, () => void>>({});
  const callUnsubRef = useRef<(() => void) | null>(null);
  const candidatesUnsubRef = useRef<(() => void) | null>(null);
  const groupCallUnsubsRef = useRef<(() => void)[]>([]);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  useEffect(() => {
    isVideoMutedRef.current = isVideoMuted;
  }, [isVideoMuted]);

  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setChatPrefs({});
      return;
    }
    try {
      const saved = localStorage.getItem(`mender_chat_prefs_${firebaseUser.uid}`);
      setChatPrefs(saved ? JSON.parse(saved) : {});
    } catch {
      setChatPrefs({});
    }
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!isAuthReady || !firebaseUser || !profile) {
      setUsersDirectory([]);
      setMemberships({});
      setOwnedChatsMap({});
      setPeerChatsMap({});
      setPublicChatsMap({});
      setMemberFetchedChatsMap({});
      setWallpaperConfigs({});
      setCustomWallpapers([]);
      setPosts([]);
      setCallHistory([]);
      return;
    }

    const uid = firebaseUser.uid;

    // Users Directory (deduplicated so only one real entry per user is shown)
    const usersQuery = query(
      collection(db, 'users'),
      where('status', 'in', ['online', 'offline', 'busy'])
    );
    const unsubUsers = onSnapshot(
      usersQuery,
      snap => {
        const rawUsers = snap.docs.map(d => d.data() as UserPublic);
        const myUname = (profile.username || '').trim().toLowerCase();
        const myName = (profile.displayName || '').trim().toLowerCase();
        const seenUsernames = new Set<string>();
        const seenNames = new Set<string>();

        if (myUname) seenUsernames.add(myUname);
        if (myName) seenNames.add(myName);

        const uniqueOthers: UserPublic[] = [];
        for (const u of rawUsers) {
          if (u.uid === uid) continue;
          const uname = (u.username || '').trim().toLowerCase();
          const dname = (u.displayName || '').trim().toLowerCase();
          // Skip duplicate documents of the current user or already added users
          if ((uname && seenUsernames.has(uname)) || (dname && seenNames.has(dname))) {
            continue;
          }
          if (uname) seenUsernames.add(uname);
          if (dname) seenNames.add(dname);
          uniqueOthers.push(u);
        }

        setUsersDirectory([profile, ...uniqueOthers]);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    // User's own memberships
    const memQuery = query(
      collection(db, 'users', uid, 'memberships'),
      where('userId', '==', uid)
    );
    const unsubMem = onSnapshot(
      memQuery,
      snap => {
        const map: Record<string, UserMembership> = {};
        snap.docs.forEach(d => {
          const data = d.data() as UserMembership;
          map[data.chatId] = data;
        });
        setMemberships(map);
      },
      err => handleFirestoreError(err, OperationType.LIST, `users/${uid}/memberships`)
    );

    // User's wallpaper configs
    const wpConfigQuery = query(
      collection(db, 'users', uid, 'wallpaper_configs'),
      where('userId', '==', uid)
    );
    const unsubWpConfig = onSnapshot(
      wpConfigQuery,
      snap => {
        const map: Record<string, WallpaperConfig> = {};
        snap.docs.forEach(d => {
          const data = d.data() as WallpaperConfig;
          map[data.scopeId] = data;
        });
        setWallpaperConfigs(map);
      },
      err => handleFirestoreError(err, OperationType.LIST, `users/${uid}/wallpaper_configs`)
    );

    // User's custom wallpapers
    const customWpQuery = query(
      collection(db, 'users', uid, 'custom_wallpapers'),
      where('userId', '==', uid)
    );
    const unsubCustomWp = onSnapshot(
      customWpQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as CustomWallpaper)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setCustomWallpapers(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, `users/${uid}/custom_wallpapers`)
    );

    // Owned chats
    const ownedQuery = query(collection(db, 'chats'), where('ownerId', '==', uid));
    const unsubOwned = onSnapshot(
      ownedQuery,
      snap => {
        const map: Record<string, Chat> = {};
        snap.docs.forEach(d => {
          const data = d.data() as Chat;
          map[data.chatId] = data;
        });
        setOwnedChatsMap(map);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'chats (ownerId)')
    );

    // Direct peer chats
    const peerQuery = query(collection(db, 'chats'), where('peerUserId', '==', uid));
    const unsubPeer = onSnapshot(
      peerQuery,
      snap => {
        const map: Record<string, Chat> = {};
        snap.docs.forEach(d => {
          const data = d.data() as Chat;
          map[data.chatId] = data;
        });
        setPeerChatsMap(map);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'chats (peerUserId)')
    );

    // Public channels & groups
    const publicQuery = query(collection(db, 'chats'), where('visibility', '==', 'public'));
    const unsubPublic = onSnapshot(
      publicQuery,
      snap => {
        const map: Record<string, Chat> = {};
        snap.docs.forEach(d => {
          const data = d.data() as Chat;
          map[data.chatId] = data;
        });
        setPublicChatsMap(map);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'chats (public)')
    );

    // Real-time automatic posts feed (public posts + user's own posts)
    const publicPostsQuery = query(collection(db, 'posts'), where('visibility', '==', 'public'));
    const myPostsQuery = query(collection(db, 'posts'), where('authorId', '==', uid));

    let pubPostsList: Post[] = [];
    let ownPostsList: Post[] = [];
    const checkedLikesSet = new Set<string>();

    const syncMergedPosts = () => {
      const mergedMap = new Map<string, Post>();
      [...pubPostsList, ...ownPostsList].forEach(p => {
        mergedMap.set(p.postId, p);
      });
      const sorted = Array.from(mergedMap.values()).sort((a, b) => {
        const ta = extractTimestampMs(a.createdAt, a.postId);
        const tb = extractTimestampMs(b.createdAt, b.postId);
        return tb - ta;
      });
      setPosts(sorted);

      sorted.forEach(post => {
        if (!checkedLikesSet.has(post.postId)) {
          checkedLikesSet.add(post.postId);
          getDoc(doc(db, 'posts', post.postId, 'likes', uid))
            .then(likeSnap => {
              setPostLikesByMe(prev => ({ ...prev, [post.postId]: likeSnap.exists() }));
            })
            .catch(() => {});
        }
      });
    };

    const unsubPosts = onSnapshot(
      publicPostsQuery,
      { includeMetadataChanges: true },
      snap => {
        pubPostsList = snap.docs.map(d => d.data() as Post);
        syncMergedPosts();
      },
      err => handleFirestoreError(err, OperationType.LIST, 'posts')
    );

    const unsubMyPosts = onSnapshot(
      myPostsQuery,
      { includeMetadataChanges: true },
      snap => {
        ownPostsList = snap.docs.map(d => d.data() as Post);
        syncMergedPosts();
      },
      () => {}
    );

    // Outgoing & incoming calls
    const callerCallsQuery = query(collection(db, 'calls'), where('callerId', '==', uid));
    const calleeCallsQuery = query(collection(db, 'calls'), where('calleeId', '==', uid));

    let callerCalls: CallSession[] = [];
    let calleeCalls: CallSession[] = [];

    const syncCalls = () => {
      const mergedMap = new Map<string, CallSession>();
      [...callerCalls, ...calleeCalls].forEach(c => mergedMap.set(c.callId, c));
      const allCalls = Array.from(mergedMap.values()).sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setCallHistory(allCalls);

      const ringingIncoming = calleeCalls.find(
        c => c.calleeId === uid && c.callerId !== uid && c.status === 'ringing'
      );
      setIncomingCall(ringingIncoming || null);
    };

    const unsubCallerCalls = onSnapshot(
      callerCallsQuery,
      snap => {
        callerCalls = snap.docs.map(d => d.data() as CallSession);
        syncCalls();
      },
      err => handleFirestoreError(err, OperationType.LIST, 'calls (caller)')
    );

    const unsubCalleeCalls = onSnapshot(
      calleeCallsQuery,
      snap => {
        calleeCalls = snap.docs.map(d => d.data() as CallSession);
        syncCalls();
      },
      err => handleFirestoreError(err, OperationType.LIST, 'calls (callee)')
    );

    // User's own profile folders
    const foldersQuery = query(
      collection(db, 'users', uid, 'profile_folders'),
      where('userId', '==', uid)
    );
    const unsubFolders = onSnapshot(
      foldersQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as ProfileFolder)
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        setMyProfileFolders(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, `users/${uid}/profile_folders`)
    );

    return () => {
      unsubUsers();
      unsubMem();
      unsubWpConfig();
      unsubCustomWp();
      unsubOwned();
      unsubPeer();
      unsubPublic();
      unsubPosts();
      unsubMyPosts();
      unsubCallerCalls();
      unsubCalleeCalls();
      unsubFolders();
    };
  }, [isAuthReady, firebaseUser, profile]);

  // Fetch private group chats from memberships
  useEffect(() => {
    if (!firebaseUser || !profile) return;
    const unsubs: (() => void)[] = [];

    Object.keys(memberships).forEach(chatId => {
      if (!ownedChatsMap[chatId] && !peerChatsMap[chatId] && !publicChatsMap[chatId]) {
        const unsub = onSnapshot(
          doc(db, 'chats', chatId),
          snap => {
            if (snap.exists()) {
              setMemberFetchedChatsMap(prev => ({
                ...prev,
                [chatId]: snap.data() as Chat,
              }));
            } else {
              setMemberFetchedChatsMap(prev => {
                if (!(chatId in prev)) return prev;
                const next = { ...prev };
                delete next[chatId];
                return next;
              });
            }
          },
          () => {}
        );
        unsubs.push(unsub);
      }
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [memberships, ownedChatsMap, peerChatsMap, publicChatsMap, firebaseUser, profile]);

  const chats: Chat[] = React.useMemo(() => {
    const merged = new Map<string, Chat>();
    const addChat = (c: Chat) => {
      const mem = memberships[c.chatId];
      const localPref = chatPrefs[c.chatId];
      const isHidden = Boolean(localPref?.isHidden ?? mem?.isHidden);
      const clearedAtMs = Number(localPref?.clearedAtMs ?? mem?.clearedAtMs ?? 0);
      if (isHidden) {
        const chatUpdatedMs = c.updatedAt ? extractTimestampMs(c.updatedAt, c.chatId) : 0;
        if (!chatUpdatedMs || chatUpdatedMs <= clearedAtMs) {
          return;
        }
      }

      let resolvedName = c.name;
      let resolvedAvatar = c.avatarUrl;

      if (c.type === 'direct') {
        const otherUid = c.ownerId === firebaseUser?.uid ? c.peerUserId : c.ownerId;
        const peerObj = usersDirectory.find(u => u.uid === otherUid);
        if (peerObj) {
          resolvedName = peerObj.displayName;
          resolvedAvatar = peerObj.avatarUrl;
        } else if (resolvedName.includes(' & ')) {
          const parts = resolvedName.split(' & ').map(s => s.trim()).filter(Boolean);
          const otherPart = parts.find(p => p !== profile?.displayName) || parts[parts.length - 1];
          if (otherPart) {
            resolvedName = otherPart;
          }
        }
      }

      merged.set(c.chatId, {
        ...c,
        name: resolvedName,
        avatarUrl: resolvedAvatar,
        myRole: mem?.role || (c.ownerId === firebaseUser?.uid ? 'owner' : 'member'),
        isPinned: Boolean(localPref?.isPinned ?? mem?.isPinned),
        isMuted: Boolean(localPref?.isMuted ?? mem?.isMuted),
        isArchived: Boolean(localPref?.isArchived ?? mem?.isArchived),
      });
    };

    Object.values(ownedChatsMap).forEach(addChat);
    Object.values(peerChatsMap).forEach(addChat);
    Object.values(memberFetchedChatsMap).forEach(addChat);
    Object.keys(memberships).forEach(chatId => {
      if (publicChatsMap[chatId]) {
        addChat(publicChatsMap[chatId]);
      }
    });

    if (firebaseUser?.uid) {
      const secChatId = `chat_system_security_${firebaseUser.uid}`;
      const secPref = chatPrefs[secChatId];
      const secHidden = Boolean(secPref?.isHidden);
      if (!merged.has(secChatId) && !secHidden) {
        merged.set(secChatId, {
          chatId: secChatId,
          type: 'direct',
          visibility: 'private',
          name: 'Mender Безопасность',
          description: 'Системные уведомления о безопасности, новых входах и защите аккаунта',
          avatarUrl: '/icon.svg',
          ownerId: firebaseUser.uid,
          peerUserId: 'mender_security_bot',
          membersCount: 2,
          lastMessageText: 'Системные уведомления о входе и защите аккаунта',
          lastMessageType: 'text',
          lastMessageSenderId: 'mender_security_bot',
          myRole: 'owner',
          isPinned: secPref?.isPinned ?? true,
          isMuted: secPref?.isMuted ?? false,
          isArchived: secPref?.isArchived ?? false,
        });
      }
    }

    return Array.from(merged.values()).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ta = a.updatedAt?.seconds || 0;
      const tb = b.updatedAt?.seconds || 0;
      return tb - ta;
    });
  }, [
    ownedChatsMap,
    peerChatsMap,
    memberFetchedChatsMap,
    publicChatsMap,
    memberships,
    chatPrefs,
    firebaseUser,
    profile?.displayName,
    usersDirectory,
  ]);

  const messages: Message[] = React.useMemo(() => {
    if (!activeChatId) return rawMessages;
    const mem = memberships[activeChatId];
    const pref = chatPrefs[activeChatId];
    const clearedAtMs = Number(pref?.clearedAtMs ?? mem?.clearedAtMs ?? 0);
    if (!clearedAtMs) return rawMessages;
    return rawMessages.filter(m => extractTimestampMs(m.createdAt, m.messageId) > clearedAtMs);
  }, [rawMessages, activeChatId, memberships, chatPrefs]);

  const publicChannelsAndGroups: Chat[] = React.useMemo(() => {
    return Object.values(publicChatsMap).sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0));
  }, [publicChatsMap]);

  const activeChat: Chat | null = React.useMemo(() => {
    if (!activeChatId) return null;
    return (
      chats.find(c => c.chatId === activeChatId) ||
      publicChatsMap[activeChatId] ||
      null
    );
  }, [activeChatId, chats, publicChatsMap]);

  // Wallpaper helpers
  const getEffectiveWallpaper = useCallback(
    (chatId?: string | null): WallpaperConfig | null => {
      if (chatId && wallpaperConfigs[chatId]) {
        return wallpaperConfigs[chatId];
      }
      return wallpaperConfigs['global'] || null;
    },
    [wallpaperConfigs]
  );

  const saveWallpaperConfig = async (
    scopeId: string,
    config: Omit<WallpaperConfig, 'scopeId' | 'userId' | 'updatedAt'>
  ) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const cleanScope = sanitizeId(scopeId);
    const docRef = doc(db, 'users', uid, 'wallpaper_configs', cleanScope);

    const payload: WallpaperConfig = {
      scopeId: cleanScope,
      userId: uid,
      wallpaperId: sanitizeId(config.wallpaperId),
      sourceType: config.sourceType,
      imageUrl: (config.imageUrl || '').slice(0, 800000),
      backgroundColor: (config.backgroundColor || '#020617').slice(0, 32),
      dimming: Math.max(0, Math.min(90, Math.round(config.dimming))),
      brightness: Math.max(50, Math.min(150, Math.round(config.brightness))),
      blur: Math.max(0, Math.min(30, Math.round(config.blur))),
      scale: Math.max(100, Math.min(300, Math.round(config.scale))),
      posX: Math.max(-100, Math.min(100, Math.round(config.posX))),
      posY: Math.max(-100, Math.min(100, Math.round(config.posY))),
      updatedAt: serverTimestamp(),
    };

    // Optimistically apply wallpaper config immediately in UI
    setWallpaperConfigs(prev => ({
      ...prev,
      [cleanScope]: payload,
    }));

    try {
      const existing = wallpaperConfigs[cleanScope];
      if (existing) {
        await updateDoc(docRef, {
          wallpaperId: payload.wallpaperId,
          sourceType: payload.sourceType,
          imageUrl: payload.imageUrl,
          backgroundColor: payload.backgroundColor,
          dimming: payload.dimming,
          brightness: payload.brightness,
          blur: payload.blur,
          scale: payload.scale,
          posX: payload.posX,
          posY: payload.posY,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(docRef, payload);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/wallpaper_configs/${cleanScope}`);
    }
  };

  const resetWallpaperConfig = async (scopeId: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const cleanScope = sanitizeId(scopeId);
    if (!wallpaperConfigs[cleanScope]) return;
    setWallpaperConfigs(prev => {
      const next = { ...prev };
      delete next[cleanScope];
      return next;
    });
    try {
      await deleteDoc(doc(db, 'users', uid, 'wallpaper_configs', cleanScope));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/wallpaper_configs/${cleanScope}`);
    }
  };

  const uploadCustomWallpaper = async (
    blob: Blob,
    name: string,
    onProgress: (pct: number) => void
  ): Promise<CustomWallpaper> => {
    if (!firebaseUser) throw new Error('Необходима авторизация');
    const uid = firebaseUser.uid;
    const wallpaperId = sanitizeId(`cwp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    const { imageUrl, storagePath } = await uploadWallpaperWithProgress(
      blob,
      uid,
      wallpaperId,
      onProgress
    );

    const newWp: CustomWallpaper = {
      wallpaperId,
      userId: uid,
      name: (name || 'Мой фон').trim().slice(0, 80),
      imageUrl: imageUrl.slice(0, 800000),
      storagePath: storagePath.slice(0, 500),
      mimeType: (blob.type || 'image/jpeg').slice(0, 40),
      sizeBytes: Math.min(10485760, blob.size),
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', uid, 'custom_wallpapers', wallpaperId), newWp);
      return newWp;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}/custom_wallpapers/${wallpaperId}`);
    }
  };

  const deleteCustomWallpaper = async (wallpaper: CustomWallpaper) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    await deleteStorageWallpaper(wallpaper.storagePath);
    try {
      await deleteDoc(doc(db, 'users', uid, 'custom_wallpapers', wallpaper.wallpaperId));
      // Also reset any config that was using this deleted custom wallpaper
      for (const [scopeId, cfg] of Object.entries(wallpaperConfigs)) {
        if (cfg.wallpaperId === wallpaper.wallpaperId) {
          await deleteDoc(doc(db, 'users', uid, 'wallpaper_configs', scopeId));
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/custom_wallpapers/${wallpaper.wallpaperId}`);
    }
  };

  // Listen to activeChat members and messages in real-time
  useEffect(() => {
    if (!activeChat || !firebaseUser || !profile) {
      setActiveChatMembers([]);
      setRawMessages([]);
      return;
    }

    const chatId = activeChat.chatId;
    const uid = firebaseUser.uid;

    const membersQuery = query(
      collection(db, 'chats', chatId, 'members'),
      where('chatId', '==', chatId),
      where('role', 'in', ['owner', 'admin', 'moderator', 'member'])
    );
    const unsubMembers = onSnapshot(
      membersQuery,
      snap => {
        setActiveChatMembers(snap.docs.map(d => d.data() as ChatMember));
      },
      err => handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/members`)
    );

    let unsubMessages1: (() => void) | null = null;
    let unsubMessages2: (() => void) | null = null;

    if (activeChat.visibility === 'public') {
      const pubMsgQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('chatId', '==', chatId),
        where('chatVisibility', '==', 'public')
      );
      unsubMessages1 = onSnapshot(
        pubMsgQuery,
        snap => {
          const list = snap.docs
            .map(d => d.data() as Message)
            .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
          setRawMessages(list);
        },
        err => handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/messages`)
      );
    } else {
      let sentMsgs: Message[] = [];
      let receivedMsgs: Message[] = [];

      const mergePrivateMsgs = () => {
        const map = new Map<string, Message>();
        [...sentMsgs, ...receivedMsgs].forEach(m => map.set(m.messageId, m));
        const sorted = Array.from(map.values()).sort(
          (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        );
        setRawMessages(sorted);
      };

      const sentQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('chatId', '==', chatId),
        where('senderId', '==', uid)
      );
      const recQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('chatId', '==', chatId),
        where('recipientId', '==', uid)
      );

      unsubMessages1 = onSnapshot(
        sentQuery,
        snap => {
          sentMsgs = snap.docs.map(d => d.data() as Message);
          mergePrivateMsgs();
        },
        err => handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/messages (sent)`)
      );

      unsubMessages2 = onSnapshot(
        recQuery,
        snap => {
          receivedMsgs = snap.docs.map(d => d.data() as Message);
          mergePrivateMsgs();
        },
        err => handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/messages (received)`)
      );
    }

    return () => {
      unsubMembers();
      if (unsubMessages1) unsubMessages1();
      if (unsubMessages2) unsubMessages2();
    };
  }, [activeChat?.chatId, activeChat?.visibility, firebaseUser, profile]);

  const watchTypingIdsKey = React.useMemo(() => {
    if (!firebaseUser || !profile) return '';
    const ids = new Set<string>();
    if (activeChatId && !activeChatId.startsWith('chat_system_security_')) {
      ids.add(activeChatId);
    }
    for (const c of chats) {
      if (ids.size >= 12) break;
      if (!c.isArchived && !c.chatId.startsWith('chat_system_security_')) {
        ids.add(c.chatId);
      }
    }
    return Array.from(ids).sort().join('|');
  }, [activeChatId, chats, firebaseUser, profile]);

  useEffect(() => {
    if (!watchTypingIdsKey || !firebaseUser?.uid) {
      setRawTypingMap({});
      return;
    }
    const uid = firebaseUser.uid;
    const chatIds = watchTypingIdsKey.split('|').filter(Boolean);
    const unsubs: (() => void)[] = [];

    chatIds.forEach(chatId => {
      const typingQuery = query(
        collection(db, 'chats', chatId, 'typing'),
        where('chatId', '==', chatId),
        where('isTyping', '==', true)
      );
      const unsub = onSnapshot(
        typingQuery,
        snap => {
          const others = snap.docs
            .map(d => d.data() as TypingStatus)
            .filter(t => t.userId !== uid && t.isTyping);
          setRawTypingMap(prev => {
            if (others.length === 0 && !(chatId in prev)) return prev;
            const next = { ...prev };
            if (others.length === 0) {
              delete next[chatId];
            } else {
              next[chatId] = others;
            }
            return next;
          });
        },
        () => {}
      );
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [watchTypingIdsKey, firebaseUser?.uid]);

  const hasAnyRawTyping = React.useMemo(
    () => Object.values(rawTypingMap).some(list => list.length > 0),
    [rawTypingMap]
  );

  useEffect(() => {
    if (!hasAnyRawTyping) return;
    setTypingNowMs(Date.now());
    const timer = window.setInterval(() => {
      setTypingNowMs(Date.now());
    }, 1500);
    return () => window.clearInterval(timer);
  }, [hasAnyRawTyping]);

  const typingUsersByChat: Record<string, TypingStatus[]> = React.useMemo(() => {
    const out: Record<string, TypingStatus[]> = {};
    for (const [chatId, list] of Object.entries(rawTypingMap)) {
      const fresh = list.filter(item => {
        if (!item.isTyping) return false;
        if (!item.updatedAt) return true;
        const updatedMs = extractTimestampMs(item.updatedAt);
        return typingNowMs - updatedMs < 7000;
      });
      if (fresh.length > 0) {
        out[chatId] = fresh;
      }
    }
    return out;
  }, [rawTypingMap, typingNowMs]);

  const setChatTyping = useCallback(
    async (chatId: string, isTyping: boolean) => {
      if (!firebaseUser || !profile || !chatId) return;
      if (chatId.startsWith('chat_system_security_')) return;
      const uid = firebaseUser.uid;
      const cleanChatId = sanitizeId(chatId);
      const displayName = (profile.displayName || profile.username || 'Пользователь')
        .trim()
        .slice(0, 80);
      try {
        await setDoc(doc(db, 'chats', cleanChatId, 'typing', uid), {
          chatId: cleanChatId,
          userId: uid,
          displayName: displayName || 'Пользователь',
          isTyping,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore transient typing sync failures (offline / permissions on virtual/readonly chats)
      }
    },
    [firebaseUser, profile]
  );

  const startDirectChatWithUser = async (peerUser: UserPublic): Promise<string> => {
    if (!firebaseUser || !profile) throw new Error('Необходима авторизация');
    const myUid = firebaseUser.uid;
    const peerUid = peerUser.uid;

    const sortedPair = [myUid, peerUid].sort();
    const chatId = sanitizeId(`dm_${sortedPair[0].slice(0, 20)}_${sortedPair[1].slice(0, 20)}`);

    const existing = chats.find(c => c.chatId === chatId);
    if (existing) {
      setActiveChatId(chatId);
      setActiveTab('chats');
      return chatId;
    }

    // Unhide if this direct chat was previously deleted only for current user
    if (chatPrefs[chatId]?.isHidden || memberships[chatId]?.isHidden) {
      await upsertChatPreference(chatId, { isHidden: false });
    }

    try {
      const chatRef = doc(db, 'chats', chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        const batch = writeBatch(db);
        const newChat: Chat = {
          chatId,
          type: 'direct',
          visibility: 'private',
          name: peerUser.displayName.slice(0, 100),
          description: `Личный диалог с @${peerUser.username}`.slice(0, 500),
          avatarUrl: peerUser.avatarUrl.slice(0, 2000),
          ownerId: myUid,
          peerUserId: peerUid,
          membersCount: 2,
          lastMessageText: 'Диалог создан',
          lastMessageType: 'text',
          lastMessageSenderId: myUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        batch.set(chatRef, newChat);
        batch.set(doc(db, 'chats', chatId, 'members', myUid), {
          chatId,
          userId: myUid,
          role: 'owner',
          displayName: profile.displayName.slice(0, 80),
          avatarUrl: profile.avatarUrl.slice(0, 2000),
          joinedAt: serverTimestamp(),
        });
        if (peerUid !== myUid) {
          batch.set(doc(db, 'chats', chatId, 'members', peerUid), {
            chatId,
            userId: peerUid,
            role: 'member',
            displayName: peerUser.displayName.slice(0, 80),
            avatarUrl: peerUser.avatarUrl.slice(0, 2000),
            joinedAt: serverTimestamp(),
          });
        }
        batch.set(doc(db, 'users', myUid, 'memberships', chatId), {
          userId: myUid,
          chatId,
          role: 'owner',
          isPinned: false,
          isMuted: false,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (peerUid !== myUid) {
          batch.set(doc(db, 'users', peerUid, 'memberships', chatId), {
            userId: peerUid,
            chatId,
            role: 'member',
            isPinned: false,
            isMuted: false,
            joinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        setOwnedChatsMap(prev => ({
          ...prev,
          [chatId]: {
            ...newChat,
            name: peerUser.displayName,
            avatarUrl: peerUser.avatarUrl,
          },
        }));
      } else {
        const existingData = snap.data() as Chat;
        setOwnedChatsMap(prev => ({
          ...prev,
          [chatId]: {
            ...existingData,
            name: peerUser.displayName,
            avatarUrl: peerUser.avatarUrl,
          },
        }));
      }
      setActiveChatId(chatId);
      setActiveTab('chats');
      return chatId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}`);
    }
  };

  const startDirectChatByContact = async (
    emailOrUsername: string,
    customName?: string
  ): Promise<string> => {
    if (!firebaseUser || !profile) throw new Error('Необходима авторизация');
    const cleanInput = emailOrUsername.trim().toLowerCase().replace(/^@/, '');
    if (!cleanInput) throw new Error('Введите почту или @username собеседника');

    // 1. Check if user already exists in usersDirectory by username or displayName
    const existingByUsername = usersDirectory.find(
      u =>
        u.uid !== firebaseUser.uid &&
        (u.username.toLowerCase() === cleanInput ||
          u.displayName.toLowerCase() === cleanInput)
    );
    if (existingByUsername) {
      return await startDirectChatWithUser(existingByUsername);
    }

    // 2. Derive deterministic UID from email (or username@mender.app)
    const normalizedEmail = cleanInput.includes('@') ? cleanInput : `${cleanInput}@mender.app`;
    const peerUid = await deriveUidFromEmail(normalizedEmail);

    if (peerUid === firebaseUser.uid) {
      throw new Error('Нельзя создать личный чат со своим собственным адресом');
    }

    const peerRef = doc(db, 'users', peerUid);
    const peerSnap = await getDoc(peerRef);

    let peerUser: UserPublic;
    if (peerSnap.exists()) {
      peerUser = peerSnap.data() as UserPublic;
    } else {
      const prefix = normalizedEmail.split('@')[0] || 'contact';
      const cleanUname = prefix.replace(/[^a-z0-9_]/g, '_');
      const validUsername = (cleanUname.length >= 3 ? cleanUname : `user_${cleanUname}`).slice(0, 40);
      const resolvedDisplayName = (customName?.trim() || prefix).slice(0, 80);
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        resolvedDisplayName
      )}&background=6366f1&color=fff&bold=true`;

      peerUser = {
        uid: peerUid,
        displayName: resolvedDisplayName,
        username: validUsername,
        avatarUrl,
        bio: `Контакт ${normalizedEmail}`,
        status: 'online',
        privacyLastSeen: 'everyone',
        privacyPhoto: 'everyone',
        privacyCalls: 'everyone',
        followersCount: 0,
        followingCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    }

    return await startDirectChatWithUser(peerUser);
  };

  const createGroupOrChannel = async (params: {
    type: 'group' | 'channel';
    visibility: VisibilityType;
    name: string;
    description: string;
    memberUsers: UserPublic[];
    avatarFile?: File | null;
  }): Promise<string> => {
    if (!firebaseUser || !profile) throw new Error('Необходима авторизация');
    const myUid = firebaseUser.uid;
    const chatId = sanitizeId(`${params.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      params.name.trim()
    )}&background=6366f1&color=fff&bold=true`;

    if (params.avatarFile) {
      avatarUrl = await uploadMediaFile(params.avatarFile, myUid, 'avatars', params.avatarFile.name);
    }

    const uniqueMembers = params.memberUsers.filter(u => u.uid !== myUid);
    const totalMembers = 1 + uniqueMembers.length;

    try {
      const batch = writeBatch(db);
      const chatDoc: Chat = {
        chatId,
        type: params.type,
        visibility: params.visibility,
        name: params.name.trim().slice(0, 100),
        description: (params.description || '').trim().slice(0, 500),
        avatarUrl: avatarUrl.slice(0, 2000),
        ownerId: myUid,
        peerUserId: uniqueMembers[0]?.uid || myUid,
        membersCount: totalMembers,
        lastMessageText: params.type === 'channel' ? 'Канал создан' : 'Группа создана',
        lastMessageType: 'text',
        lastMessageSenderId: myUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.set(doc(db, 'chats', chatId), chatDoc);
      batch.set(doc(db, 'chats', chatId, 'members', myUid), {
        chatId,
        userId: myUid,
        role: 'owner',
        displayName: profile.displayName.slice(0, 80),
        avatarUrl: profile.avatarUrl.slice(0, 2000),
        joinedAt: serverTimestamp(),
      });

      uniqueMembers.forEach(member => {
        batch.set(doc(db, 'chats', chatId, 'members', member.uid), {
          chatId,
          userId: member.uid,
          role: 'member',
          displayName: member.displayName.slice(0, 80),
          avatarUrl: member.avatarUrl.slice(0, 2000),
          joinedAt: serverTimestamp(),
        });
      });

      batch.set(doc(db, 'users', myUid, 'memberships', chatId), {
        userId: myUid,
        chatId,
        role: 'owner',
        isPinned: false,
        isMuted: false,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      for (const member of uniqueMembers) {
        try {
          await setDoc(doc(db, 'users', member.uid, 'memberships', chatId), {
            userId: member.uid,
            chatId,
            role: 'member',
            isPinned: false,
            isMuted: false,
            joinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch {
          // ignore
        }
      }

      setActiveChatId(chatId);
      setActiveTab('chats');
      return chatId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}`);
    }
  };

  const joinPublicChat = async (chat: Chat) => {
    if (!firebaseUser || !profile) return;
    const myUid = firebaseUser.uid;
    const chatId = chat.chatId;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'chats', chatId, 'members', myUid), {
        chatId,
        userId: myUid,
        role: 'member',
        displayName: profile.displayName.slice(0, 80),
        avatarUrl: profile.avatarUrl.slice(0, 2000),
        joinedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', myUid, 'memberships', chatId), {
        userId: myUid,
        chatId,
        role: 'member',
        isPinned: false,
        isMuted: false,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'chats', chatId), {
        lastMessageText: chat.lastMessageText,
        lastMessageType: chat.lastMessageType,
        lastMessageSenderId: myUid,
        membersCount: (chat.membersCount || 1) + 1,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setActiveChatId(chatId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}/members/${myUid}`);
    }
  };

  const leaveChat = async (chatId: string) => {
    if (!firebaseUser) return;
    const myUid = firebaseUser.uid;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'chats', chatId, 'members', myUid));
      batch.delete(doc(db, 'users', myUid, 'memberships', chatId));
      await batch.commit();
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${chatId}/members/${myUid}`);
    }
  };

  const addMemberToChat = async (
    chatId: string,
    contactOrUser: UserPublic | string,
    role: 'admin' | 'moderator' | 'member' = 'member'
  ) => {
    if (!firebaseUser || !profile) return;

    let targetUser: UserPublic;
    if (typeof contactOrUser === 'string') {
      const cleanInput = contactOrUser.trim().toLowerCase().replace(/^@/, '');
      if (!cleanInput) throw new Error('Введите почту или @username участника');

      const existingByUsername = usersDirectory.find(
        u =>
          u.username.toLowerCase() === cleanInput ||
          u.displayName.toLowerCase() === cleanInput
      );
      if (existingByUsername) {
        targetUser = existingByUsername;
      } else {
        const normalizedEmail = cleanInput.includes('@') ? cleanInput : `${cleanInput}@mender.app`;
        const peerUid = await deriveUidFromEmail(normalizedEmail);
        const peerRef = doc(db, 'users', peerUid);
        const peerSnap = await getDoc(peerRef);
        if (peerSnap.exists()) {
          targetUser = peerSnap.data() as UserPublic;
        } else {
          const prefix = normalizedEmail.split('@')[0] || 'member';
          const cleanUname = prefix.replace(/[^a-z0-9_]/g, '_');
          const validUsername = (cleanUname.length >= 3 ? cleanUname : `user_${cleanUname}`).slice(0, 40);
          const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            prefix
          )}&background=6366f1&color=fff&bold=true`;
          targetUser = {
            uid: peerUid,
            displayName: prefix.slice(0, 80),
            username: validUsername,
            avatarUrl,
            bio: `Участник Mender (${normalizedEmail})`,
            status: 'online',
            privacyLastSeen: 'everyone',
            privacyPhoto: 'everyone',
            privacyCalls: 'everyone',
            followersCount: 0,
            followingCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
        }
      }
    } else {
      targetUser = contactOrUser;
    }

    const alreadyInChat = activeChatMembers.some(m => m.userId === targetUser.uid);
    const chatDoc = chats.find(c => c.chatId === chatId) || activeChat;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'chats', chatId, 'members', targetUser.uid), {
        chatId,
        userId: targetUser.uid,
        role,
        displayName: targetUser.displayName.slice(0, 80),
        avatarUrl: targetUser.avatarUrl.slice(0, 2000),
        joinedAt: serverTimestamp(),
      });
      if (!alreadyInChat && chatDoc) {
        batch.update(doc(db, 'chats', chatId), {
          lastMessageText: `Добавлен участник ${targetUser.displayName}`.slice(0, 500),
          lastMessageType: 'text',
          lastMessageSenderId: firebaseUser.uid,
          membersCount: (chatDoc.membersCount || activeChatMembers.length || 1) + 1,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();

      try {
        await setDoc(doc(db, 'users', targetUser.uid, 'memberships', chatId), {
          userId: targetUser.uid,
          chatId,
          role,
          isPinned: false,
          isMuted: false,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore if cross-user membership write is restricted
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}/members/${targetUser.uid}`);
    }
  };

  const updateMemberRole = async (
    chatId: string,
    memberUid: string,
    newRole: 'admin' | 'moderator' | 'member'
  ) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'chats', chatId, 'members', memberUid), {
        role: newRole,
      });
      try {
        await updateDoc(doc(db, 'users', memberUid, 'memberships', chatId), {
          role: newRole,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore if membership doc does not exist yet
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/members/${memberUid}`);
    }
  };

  const removeMemberFromChat = async (chatId: string, memberUid: string) => {
    if (!firebaseUser) return;
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'members', memberUid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${chatId}/members/${memberUid}`);
    }
  };

  const upsertChatPreference = async (
    chatId: string,
    patch: Partial<{
      isPinned: boolean;
      isMuted: boolean;
      isArchived: boolean;
      isHidden: boolean;
      clearedAtMs: number;
    }>
  ) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const mem = memberships[chatId];
    const currentChat =
      chats.find(c => c.chatId === chatId) ||
      ownedChatsMap[chatId] ||
      peerChatsMap[chatId] ||
      memberFetchedChatsMap[chatId] ||
      publicChatsMap[chatId];

    const nextPref = {
      ...(chatPrefs[chatId] || {}),
      ...patch,
    };

    setChatPrefs(prev => {
      const updated = { ...prev, [chatId]: nextPref };
      try {
        localStorage.setItem(`mender_chat_prefs_${uid}`, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });

    const isVirtualSystemChat =
      chatId.startsWith('chat_system_security_') &&
      !ownedChatsMap[chatId] &&
      !mem;
    if (isVirtualSystemChat) {
      return;
    }

    const nextIsPinned = patch.isPinned ?? nextPref.isPinned ?? mem?.isPinned ?? false;
    const nextIsMuted = patch.isMuted ?? nextPref.isMuted ?? mem?.isMuted ?? false;
    const nextIsArchived = patch.isArchived ?? nextPref.isArchived ?? mem?.isArchived ?? false;
    const nextIsHidden = patch.isHidden ?? nextPref.isHidden ?? mem?.isHidden ?? false;
    const nextClearedAtMs = Number(
      patch.clearedAtMs ?? nextPref.clearedAtMs ?? mem?.clearedAtMs ?? 0
    );

    const memRef = doc(db, 'users', uid, 'memberships', chatId);
    try {
      if (mem) {
        const updatePayload: Record<string, any> = {
          isPinned: nextIsPinned,
          isMuted: nextIsMuted,
          isArchived: nextIsArchived,
          isHidden: nextIsHidden,
          updatedAt: serverTimestamp(),
        };
        if (nextClearedAtMs > 0) {
          updatePayload.clearedAtMs = Math.round(nextClearedAtMs);
        }
        await updateDoc(memRef, updatePayload);
      } else if (currentChat) {
        const role =
          currentChat.ownerId === uid
            ? 'owner'
            : currentChat.myRole || 'member';
        const createPayload: Record<string, any> = {
          userId: uid,
          chatId,
          role,
          isPinned: nextIsPinned,
          isMuted: nextIsMuted,
          isArchived: nextIsArchived,
          isHidden: nextIsHidden,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (nextClearedAtMs > 0) {
          createPayload.clearedAtMs = Math.round(nextClearedAtMs);
        }
        await setDoc(memRef, createPayload);
      }
    } catch {
      // Local state & localStorage already updated cleanly
    }
  };

  const togglePinChat = async (chatId: string) => {
    const current = chats.find(c => c.chatId === chatId);
    const currentPinned = Boolean(
      chatPrefs[chatId]?.isPinned ?? memberships[chatId]?.isPinned ?? current?.isPinned
    );
    await upsertChatPreference(chatId, { isPinned: !currentPinned });
  };

  const toggleMuteChat = async (chatId: string) => {
    const current = chats.find(c => c.chatId === chatId);
    const currentMuted = Boolean(
      chatPrefs[chatId]?.isMuted ?? memberships[chatId]?.isMuted ?? current?.isMuted
    );
    await upsertChatPreference(chatId, { isMuted: !currentMuted });
  };

  const toggleArchiveChat = async (chatId: string) => {
    const current = chats.find(c => c.chatId === chatId);
    const currentArchived = Boolean(
      chatPrefs[chatId]?.isArchived ?? memberships[chatId]?.isArchived ?? current?.isArchived
    );
    await upsertChatPreference(chatId, { isArchived: !currentArchived });
  };

  const deleteChatForMe = async (chatId: string) => {
    if (!firebaseUser) return;
    await upsertChatPreference(chatId, {
      isHidden: true,
      isArchived: false,
      isPinned: false,
      clearedAtMs: Date.now(),
    });
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };

  const deleteChatForBoth = async (chatId: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const targetChat =
      chats.find(c => c.chatId === chatId) ||
      ownedChatsMap[chatId] ||
      peerChatsMap[chatId] ||
      memberFetchedChatsMap[chatId] ||
      publicChatsMap[chatId];

    // Virtual system security chat has no shared peer: delete locally for user
    if (chatId.startsWith('chat_system_security_') && !ownedChatsMap[chatId]) {
      await deleteChatForMe(chatId);
      return;
    }

    try {
      // 1. Delete readable messages in the chat
      const messageRefsMap = new Map<string, ReturnType<typeof doc>>();
      if (targetChat?.visibility === 'public') {
        const pubSnap = await getDocs(
          query(
            collection(db, 'chats', chatId, 'messages'),
            where('chatId', '==', chatId),
            where('chatVisibility', '==', 'public')
          )
        );
        pubSnap.docs.forEach(d => messageRefsMap.set(d.id, d.ref));
      } else {
        const [sentSnap, recSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'chats', chatId, 'messages'),
              where('chatId', '==', chatId),
              where('senderId', '==', uid)
            )
          ),
          getDocs(
            query(
              collection(db, 'chats', chatId, 'messages'),
              where('chatId', '==', chatId),
              where('recipientId', '==', uid)
            )
          ),
        ]);
        sentSnap.docs.forEach(d => messageRefsMap.set(d.id, d.ref));
        recSnap.docs.forEach(d => messageRefsMap.set(d.id, d.ref));
      }

      const refs = Array.from(messageRefsMap.values());
      for (let i = 0; i < refs.length; i += 400) {
        const batch = writeBatch(db);
        refs.slice(i, i + 400).forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      // 2. Clean up own member + membership + typing records
      try {
        await deleteDoc(doc(db, 'chats', chatId, 'members', uid));
      } catch {
        // ignore if already missing
      }
      try {
        await deleteDoc(doc(db, 'chats', chatId, 'typing', uid));
      } catch {
        // ignore if already missing
      }
      try {
        const typingSnap = await getDocs(
          query(collection(db, 'chats', chatId, 'typing'), where('chatId', '==', chatId))
        );
        for (const d of typingSnap.docs) {
          await deleteDoc(d.ref).catch(() => {});
        }
      } catch {
        // ignore typing cleanup errors
      }
      try {
        await deleteDoc(doc(db, 'users', uid, 'memberships', chatId));
      } catch {
        // ignore if already missing
      }

      // 3. Delete chat document itself (allowed for owner or direct peer)
      await deleteDoc(doc(db, 'chats', chatId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${chatId}`);
    }

    // 4. Optimistically remove from local maps
    setOwnedChatsMap(prev => {
      if (!(chatId in prev)) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setPeerChatsMap(prev => {
      if (!(chatId in prev)) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setMemberFetchedChatsMap(prev => {
      if (!(chatId in prev)) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setPublicChatsMap(prev => {
      if (!(chatId in prev)) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setMemberships(prev => {
      if (!(chatId in prev)) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setChatPrefs(prev => {
      if (!(chatId in prev)) return prev;
      const next = { ...prev };
      delete next[chatId];
      try {
        localStorage.setItem(`mender_chat_prefs_${uid}`, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };

  const sendMessage = async (params: {
    content: string;
    type?: MessageType;
    mediaBlobOrFile?: Blob | File | null;
    duration?: number;
    replyTo?: { messageId: string; senderName: string; content: string } | null;
    forwardedFromName?: string;
  }) => {
    if (!firebaseUser || !profile || !activeChat) return;
    const myUid = firebaseUser.uid;
    const chatId = activeChat.chatId;
    const msgType: MessageType = params.type || 'text';

    const isAlreadyMember = activeChatMembers.some(m => m.userId === myUid) || Boolean(memberships[chatId]);
    if (!isAlreadyMember && activeChat.visibility === 'public') {
      await joinPublicChat(activeChat);
    }

    let mediaUrl = '';
    if (params.mediaBlobOrFile) {
      const folder =
        msgType === 'voice'
          ? 'voice'
          : msgType === 'video_circle'
          ? 'video_circles'
          : 'messages';
      const filename =
        params.mediaBlobOrFile instanceof File ? params.mediaBlobOrFile.name : `${msgType}_${Date.now()}.webm`;
      mediaUrl = await uploadMediaFile(params.mediaBlobOrFile, myUid, folder, filename);
    }

    const messageId = sanitizeId(`msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const recipientId =
      activeChat.ownerId === myUid ? activeChat.peerUserId || myUid : activeChat.ownerId;

    const cleanContent = (params.content || 'Медиасообщение').trim().slice(0, 4000);

    try {
      const batch = writeBatch(db);
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      const newMsg: Record<string, any> = {
        messageId,
        chatId,
        senderId: myUid,
        senderName: profile.displayName.slice(0, 80),
        senderAvatar: profile.avatarUrl.slice(0, 2000),
        recipientId: sanitizeId(recipientId),
        chatVisibility: activeChat.visibility,
        type: msgType,
        content: cleanContent,
        mediaUrl: mediaUrl.slice(0, 800000),
        duration: Math.max(0, Math.min(3600, Math.round(params.duration || 0))),
        status: 'sent',
        likesCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (params.replyTo?.messageId) {
        newMsg.replyToId = sanitizeId(params.replyTo.messageId);
        newMsg.replyToSender = (params.replyTo.senderName || 'Собеседник').slice(0, 80);
        newMsg.replyToText = (params.replyTo.content || 'Сообщение').slice(0, 500);
      }
      if (params.forwardedFromName) {
        newMsg.forwardedFromName = params.forwardedFromName.slice(0, 80);
      }

      batch.set(msgRef, newMsg);
      batch.update(doc(db, 'chats', chatId), {
        lastMessageText: cleanContent.slice(0, 500),
        lastMessageType: msgType,
        lastMessageSenderId: myUid,
        membersCount: activeChat.membersCount || 1,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}/messages/${messageId}`);
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!activeChat || !firebaseUser) return;
    const msg = messages.find(m => m.messageId === messageId);
    // Редактировать можно только свои собственные сообщения
    if (!msg || msg.senderId !== firebaseUser.uid) return;
    const cleanContent = newContent.trim().slice(0, 4000);
    if (!cleanContent) return;

    setRawMessages(prev =>
      prev.map(m => (m.messageId === messageId ? { ...m, content: cleanContent } : m))
    );

    try {
      await updateDoc(doc(db, 'chats', activeChat.chatId, 'messages', messageId), {
        content: cleanContent,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${activeChat.chatId}/messages/${messageId}`);
    }
  };

  const deleteMessageForMe = async (msg: Message) => {
    if (!firebaseUser) return;
    const myUid = firebaseUser.uid;
    const nextMap = { ...deletedForMeMessageIds, [msg.messageId]: true };
    setDeletedForMeMessageIds(nextMap);
    try {
      localStorage.setItem('mender_deleted_msgs_for_me', JSON.stringify(nextMap));
    } catch {
      // ignore storage errors
    }
    if (activeChat) {
      try {
        const nextList = Array.from(new Set([...(msg.deletedForUserIds || []), myUid]));
        await updateDoc(doc(db, 'chats', activeChat.chatId, 'messages', msg.messageId), {
          deletedForUserIds: nextList,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // local deletion for current user is already persisted
      }
    }
  };

  const deleteMessageForEveryone = async (messageId: string) => {
    if (!activeChat || !firebaseUser) return;
    const msg = messages.find(m => m.messageId === messageId);
    if (!msg) return;
    setRawMessages(prev => prev.filter(m => m.messageId !== messageId));
    try {
      await deleteDoc(doc(db, 'chats', activeChat.chatId, 'messages', messageId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${activeChat.chatId}/messages/${messageId}`);
    }
  };

  const deleteMessage = async (messageId: string) => {
    await deleteMessageForEveryone(messageId);
  };

  const reactToMessage = async (msg: Message, emoji: string) => {
    if (!activeChat) return;
    const currentEmoji = msg.reactionEmoji || messageReactions[msg.messageId] || (msg.likesCount > 0 ? '❤️' : '');
    const isSameReaction = Boolean(currentEmoji && currentEmoji === emoji && (messageLikesByMe[msg.messageId] ?? msg.likesCount > 0));
    const nextLiked = !isSameReaction;
    const nextEmoji = nextLiked ? emoji : '';
    const nextLikesCount = nextLiked ? 1 : 0;

    const updatedLikesMap = { ...messageLikesByMe, [msg.messageId]: nextLiked };
    const updatedReactionsMap = { ...messageReactions, [msg.messageId]: nextEmoji };
    setMessageLikesByMe(updatedLikesMap);
    setMessageReactions(updatedReactionsMap);
    setRawMessages(prev =>
      prev.map(m =>
        m.messageId === msg.messageId
          ? { ...m, likesCount: nextLikesCount, reactionEmoji: nextEmoji }
          : m
      )
    );

    try {
      localStorage.setItem('mender_message_likes_me', JSON.stringify(updatedLikesMap));
      localStorage.setItem('mender_message_reactions', JSON.stringify(updatedReactionsMap));
    } catch {
      // ignore storage errors
    }

    try {
      await updateDoc(doc(db, 'chats', activeChat.chatId, 'messages', msg.messageId), {
        status: msg.status,
        likesCount: nextLikesCount,
        reactionEmoji: nextEmoji,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${activeChat.chatId}/messages/${msg.messageId}`);
    }
  };

  const likeMessage = async (msg: Message) => {
    await reactToMessage(msg, '❤️');
  };

  const forwardMessageToTarget = async (msg: Message, target: Chat | UserPublic) => {
    if (!firebaseUser || !profile) return;
    const myUid = firebaseUser.uid;

    let targetChatId: string;
    let targetChatObj: Chat | undefined;

    if ('chatId' in target) {
      targetChatId = target.chatId;
      targetChatObj = target;
    } else {
      targetChatId = await startDirectChatWithUser(target);
      targetChatObj = chats.find(c => c.chatId === targetChatId) || {
        chatId: targetChatId,
        type: 'direct',
        visibility: 'private',
        name: target.displayName,
        description: '',
        avatarUrl: target.avatarUrl,
        ownerId: myUid,
        peerUserId: target.uid,
        membersCount: 2,
        lastMessageText: '',
        lastMessageType: 'text',
        lastMessageSenderId: myUid,
      };
    }

    const messageId = sanitizeId(`msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const recipientId =
      targetChatObj.ownerId === myUid
        ? targetChatObj.peerUserId || myUid
        : targetChatObj.ownerId;
    const cleanContent = (msg.content || 'Пересланное сообщение').trim().slice(0, 4000);

    try {
      const batch = writeBatch(db);
      const msgRef = doc(db, 'chats', targetChatId, 'messages', messageId);
      const forwardedMsg: Record<string, any> = {
        messageId,
        chatId: targetChatId,
        senderId: myUid,
        senderName: profile.displayName.slice(0, 80),
        senderAvatar: profile.avatarUrl.slice(0, 2000),
        recipientId: sanitizeId(recipientId),
        chatVisibility: targetChatObj.visibility || 'private',
        type: msg.type,
        content: cleanContent,
        mediaUrl: (msg.mediaUrl || '').slice(0, 800000),
        duration: Math.max(0, Math.min(3600, Math.round(msg.duration || 0))),
        status: 'sent',
        likesCount: 0,
        forwardedFromName: (msg.forwardedFromName || msg.senderName || 'Пользователь').slice(0, 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.set(msgRef, forwardedMsg);
      batch.update(doc(db, 'chats', targetChatId), {
        lastMessageText: `↪ ${cleanContent}`.slice(0, 500),
        lastMessageType: msg.type,
        lastMessageSenderId: myUid,
        membersCount: targetChatObj.membersCount || 1,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setActiveChatId(targetChatId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${targetChatId}/messages/${messageId}`);
    }
  };

  const openUserProfile = async (userOrUid: UserPublic | string) => {
    let targetUser: UserPublic | null = null;
    if (typeof userOrUid === 'string') {
      const uid = userOrUid.trim();
      if (!uid) return;
      const inDir = usersDirectory.find(u => u.uid === uid);
      if (inDir) {
        targetUser = inDir;
      } else {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            targetUser = snap.data() as UserPublic;
          }
        } catch {
          // ignore
        }
      }
    } else {
      targetUser = userOrUid;
    }

    if (!targetUser) return;
    setViewedUserProfile(targetUser);
    setViewedUserFolders([]);

    try {
      const qFolders = query(
        collection(db, 'users', targetUser.uid, 'profile_folders'),
        where('userId', '==', targetUser.uid)
      );
      onSnapshot(
        qFolders,
        snap => {
          const list = snap.docs
            .map(d => d.data() as ProfileFolder)
            .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
          setViewedUserFolders(list);
        },
        () => {}
      );
    } catch {
      // ignore
    }
  };

  const closeUserProfile = () => {
    setViewedUserProfile(null);
    setViewedUserFolders([]);
  };

  const createProfileFolder = async (name: string): Promise<string> => {
    if (!firebaseUser) throw new Error('Необходима авторизация');
    const cleanName = name.trim().slice(0, 60);
    if (!cleanName) throw new Error('Введите название папки');
    const uid = firebaseUser.uid;
    const folderId = sanitizeId(`fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

    try {
      await setDoc(doc(db, 'users', uid, 'profile_folders', folderId), {
        folderId,
        userId: uid,
        name: cleanName,
        postIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return folderId;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}/profile_folders/${folderId}`);
      throw err;
    }
  };

  const deleteProfileFolder = async (folderId: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    try {
      await deleteDoc(doc(db, 'users', uid, 'profile_folders', folderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/profile_folders/${folderId}`);
    }
  };

  const togglePostInFolder = async (folderId: string, postId: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const folder = myProfileFolders.find(f => f.folderId === folderId);
    if (!folder) return;

    const currentIds = Array.isArray(folder.postIds) ? folder.postIds : [];
    const exists = currentIds.includes(postId);
    const nextIds = exists ? currentIds.filter(id => id !== postId) : [...currentIds, postId];

    try {
      await updateDoc(doc(db, 'users', uid, 'profile_folders', folderId), {
        folderId: folder.folderId,
        userId: uid,
        name: folder.name,
        postIds: nextIds,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/profile_folders/${folderId}`);
    }
  };

  const createPost = async (params: {
    content: string;
    visibility?: VisibilityType;
    mediaFile?: File | null;
    mediaFiles?: File[];
    mediaLayout?: 'carousel' | 'grid';
    folderId?: string | null;
  }) => {
    if (!firebaseUser || !profile) return;
    const myUid = firebaseUser.uid;
    const postId = sanitizeId(`post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    const filesToUpload: File[] =
      params.mediaFiles && params.mediaFiles.length > 0
        ? params.mediaFiles.slice(0, 9)
        : params.mediaFile
        ? [params.mediaFile]
        : [];

    const maxCharsPerFile =
      filesToUpload.length > 1
        ? Math.floor(680000 / filesToUpload.length)
        : 340000;

    const uploadedItems: PostMediaItem[] = [];
    for (const file of filesToUpload) {
      const url = await uploadMediaFile(
        file,
        myUid,
        'posts',
        file.name,
        maxCharsPerFile
      );
      const isVid =
        file.type.startsWith('video/') ||
        /\.(mp4|webm|mov|mkv)$/i.test(file.name);
      const type: 'image' | 'video' = isVid ? 'video' : 'image';
      uploadedItems.push({ url: url.slice(0, 800000), type });
    }

    const primaryUrl =
      uploadedItems.length === 1 ? uploadedItems[0].url : '';
    const primaryType: 'none' | 'image' | 'video' =
      uploadedItems[0]?.type || 'none';
    const layout: 'carousel' | 'grid' = params.mediaLayout || 'carousel';

    const newPostObj: Post = {
      postId,
      authorId: myUid,
      authorName: profile.displayName.slice(0, 80),
      authorUsername: profile.username.slice(0, 40),
      authorAvatar: profile.avatarUrl.slice(0, 2000),
      visibility: params.visibility || 'public',
      content: (params.content.trim() || 'Медиапубликация').slice(0, 3000),
      mediaUrl: primaryUrl.slice(0, 800000),
      mediaType: primaryType,
      mediaItems: uploadedItems.length === 1 ? [] : uploadedItems,
      mediaLayout: layout,
      likesCount: 0,
      commentsCount: 0,
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      updatedAt: { seconds: Math.floor(Date.now() / 1000) },
    };

    // Immediately prepend to feed state so feed updates with zero delay
    setPosts(prev => [newPostObj, ...prev.filter(p => p.postId !== postId)]);

    try {
      await setDoc(doc(db, 'posts', postId), {
        ...newPostObj,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (params.folderId) {
        const targetFolder = myProfileFolders.find(f => f.folderId === params.folderId);
        if (targetFolder) {
          const nextIds = Array.from(new Set([...(targetFolder.postIds || []), postId]));
          await updateDoc(doc(db, 'users', myUid, 'profile_folders', targetFolder.folderId), {
            folderId: targetFolder.folderId,
            userId: myUid,
            name: targetFolder.name,
            postIds: nextIds,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${postId}`);
    }
  };

  const editPost = async (postId: string, newContent: string) => {
    if (!firebaseUser) return;
    const post = posts.find(p => p.postId === postId);
    // Редактировать можно только свои посты
    if (!post || post.authorId !== firebaseUser.uid) return;
    const cleanContent = newContent.trim().slice(0, 3000);
    if (!cleanContent) return;

    setPosts(prev =>
      prev.map(p => (p.postId === postId ? { ...p, content: cleanContent } : p))
    );

    try {
      await updateDoc(doc(db, 'posts', postId), {
        content: cleanContent,
        visibility: post.visibility,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const deletePost = async (postId: string) => {
    if (!firebaseUser) return;
    const post = posts.find(p => p.postId === postId);
    // Удалять можно только свои посты
    if (post && post.authorId !== firebaseUser.uid) return;
    setPosts(prev => prev.filter(p => p.postId !== postId));
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const toggleLikePost = async (post: Post) => {
    if (!firebaseUser) return;
    const myUid = firebaseUser.uid;
    const likeRef = doc(db, 'posts', post.postId, 'likes', myUid);
    const postRef = doc(db, 'posts', post.postId);
    const isLiked = Boolean(postLikesByMe[post.postId]);
    const nextLikesCount = isLiked
      ? Math.max(0, (post.likesCount || 1) - 1)
      : (post.likesCount || 0) + 1;

    setPostLikesByMe(prev => ({ ...prev, [post.postId]: !isLiked }));
    setPosts(prev =>
      prev.map(p => (p.postId === post.postId ? { ...p, likesCount: nextLikesCount } : p))
    );

    try {
      const batch = writeBatch(db);
      if (isLiked) {
        batch.delete(likeRef);
        batch.update(postRef, {
          likesCount: nextLikesCount,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(likeRef, {
          postId: post.postId,
          userId: myUid,
          createdAt: serverTimestamp(),
        });
        batch.update(postRef, {
          likesCount: nextLikesCount,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posts/${post.postId}/likes/${myUid}`);
    }
  };

  const loadCommentsForPost = useCallback(
    (postId: string, postVisibility: VisibilityType) => {
      if (!firebaseUser) return;
      if (commentUnsubsRef.current[postId]) return;
      const q = query(
        collection(db, 'posts', postId, 'comments'),
        where('postId', '==', postId),
        where('postVisibility', '==', postVisibility)
      );
      const unsub = onSnapshot(
        q,
        { includeMetadataChanges: true },
        snap => {
          const list = snap.docs
            .map(d => d.data() as PostComment)
            .sort(
              (a, b) =>
                extractTimestampMs(a.createdAt, a.commentId) -
                extractTimestampMs(b.createdAt, b.commentId)
            );
          setPostComments(prev => ({ ...prev, [postId]: list }));
        },
        err => handleFirestoreError(err, OperationType.LIST, `posts/${postId}/comments`)
      );
      commentUnsubsRef.current[postId] = unsub;
    },
    [firebaseUser]
  );

  const addCommentToPost = async (post: Post, content: string) => {
    if (!firebaseUser || !profile || !content.trim()) return;
    const myUid = firebaseUser.uid;
    const commentId = sanitizeId(`com_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const newComment: PostComment = {
      commentId,
      postId: post.postId,
      authorId: myUid,
      authorName: profile.displayName.slice(0, 80),
      authorAvatar: profile.avatarUrl.slice(0, 2000),
      postVisibility: post.visibility,
      content: content.trim().slice(0, 1000),
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
    };

    setPostComments(prev => ({
      ...prev,
      [post.postId]: [...(prev[post.postId] || []).filter(c => c.commentId !== commentId), newComment],
    }));
    setPosts(prev =>
      prev.map(p =>
        p.postId === post.postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
      )
    );

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'posts', post.postId, 'comments', commentId), {
        ...newComment,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'posts', post.postId), {
        commentsCount: (post.commentsCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${post.postId}/comments/${commentId}`);
    }
  };

  const editComment = async (post: Post, comment: PostComment, newContent: string) => {
    if (!firebaseUser) return;
    // Редактировать можно только свои комментарии
    if (comment.authorId !== firebaseUser.uid) return;
    const cleanContent = newContent.trim().slice(0, 1000);
    if (!cleanContent) return;

    setPostComments(prev => ({
      ...prev,
      [post.postId]: (prev[post.postId] || []).map(c =>
        c.commentId === comment.commentId ? { ...c, content: cleanContent } : c
      ),
    }));

    try {
      await updateDoc(doc(db, 'posts', post.postId, 'comments', comment.commentId), {
        content: cleanContent,
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `posts/${post.postId}/comments/${comment.commentId}`
      );
    }
  };

  const deleteComment = async (post: Post, comment: PostComment) => {
    if (!firebaseUser) return;
    // Удалять можно только свои комментарии
    if (comment.authorId !== firebaseUser.uid) return;

    setPostComments(prev => ({
      ...prev,
      [post.postId]: (prev[post.postId] || []).filter(c => c.commentId !== comment.commentId),
    }));
    setPosts(prev =>
      prev.map(p =>
        p.postId === post.postId
          ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 1) - 1) }
          : p
      )
    );

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'posts', post.postId, 'comments', comment.commentId));
      batch.update(doc(db, 'posts', post.postId), {
        commentsCount: Math.max(0, (post.commentsCount || 1) - 1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `posts/${post.postId}/comments/${comment.commentId}`
      );
    }
  };

  const toggleLikeComment = (commentId: string) => {
    const currentlyLiked = Boolean(commentLikesByMe[commentId]);
    const nextLiked = { ...commentLikesByMe, [commentId]: !currentlyLiked };
    const currentCount = commentLikesCount[commentId] || 0;
    const nextCount = {
      ...commentLikesCount,
      [commentId]: currentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
    };
    setCommentLikesByMe(nextLiked);
    setCommentLikesCount(nextCount);
    try {
      localStorage.setItem('mender_comment_likes_me', JSON.stringify(nextLiked));
      localStorage.setItem('mender_comment_likes_count', JSON.stringify(nextCount));
    } catch {
      // ignore storage errors
    }
  };

  // WebRTC Calls
  const refreshAvailableCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setAvailableCameras(videoInputs);
      const currentCamTrack = cameraStreamRef.current?.getVideoTracks()[0];
      const activeDeviceId = currentCamTrack?.getSettings?.().deviceId;
      if (activeDeviceId) {
        setSelectedCameraId(activeDeviceId);
      } else if (videoInputs[0]?.deviceId && !selectedCameraId) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
    } catch {
      // ignore enumeration errors
    }
  }, [selectedCameraId]);

  const cleanupCallResources = useCallback(() => {
    if (callUnsubRef.current) {
      callUnsubRef.current();
      callUnsubRef.current = null;
    }
    if (candidatesUnsubRef.current) {
      candidatesUnsubRef.current();
      candidatesUnsubRef.current = null;
    }
    if (groupCallUnsubsRef.current.length > 0) {
      groupCallUnsubsRef.current.forEach(u => u());
      groupCallUnsubsRef.current = [];
    }
    pendingCandidatesRef.current = [];
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {
        // ignore
      }
      peerConnectionRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => {
        t.onended = null;
        t.stop();
      });
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setLocalCameraStream(null);
    setLocalScreenStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    activeCallRef.current = null;
    setGroupCallParticipants([]);
    setIsAudioMuted(false);
    isAudioMutedRef.current = false;
    setIsVideoMuted(false);
    isVideoMutedRef.current = false;
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
  }, []);

  const acquireMediaStreamSafe = async (
    wantVideo: boolean,
    facingMode: 'user' | 'environment' = 'user',
    deviceId?: string
  ): Promise<MediaStream> => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const videoConstraints: MediaTrackConstraints | boolean = wantVideo
          ? deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              }
            : {
                facingMode: { ideal: facingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              }
          : false;

        const media = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: videoConstraints,
        });
        await refreshAvailableCameras();
        return media;
      }
    } catch {
      if (wantVideo && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch {
          // fallback below
        }
      }
    }

    // Fallback synthetic MediaStream when microphone/camera permission is denied in browser/iframe
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const dest = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0; // silent audio track
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      return dest.stream;
    } catch {
      return new MediaStream();
    }
  };

  const flushPendingIceCandidates = async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription || pendingCandidatesRef.current.length === 0) return;
    const queued = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // ignore invalid or duplicate candidate
      }
    }
  };

  const syncRemoteStreamFromPc = useCallback((pc: RTCPeerConnection, fallbackStream?: MediaStream) => {
    const receiverTracks = pc
      .getReceivers()
      .map(r => r.track)
      .filter((t): t is MediaStreamTrack => Boolean(t && t.readyState === 'live'));

    if (fallbackStream) {
      fallbackStream.getTracks().forEach(t => {
        if (t.readyState === 'live' && !receiverTracks.some(rt => rt.id === t.id)) {
          receiverTracks.push(t);
        }
      });
    }

    setRemoteStream(new MediaStream(receiverTracks));
  }, []);

  const attachPeerTrackListeners = useCallback(
    (pc: RTCPeerConnection, inboundStream: MediaStream) => {
      pc.ontrack = event => {
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach(track => {
            inboundStream.addTrack(track);
            track.onunmute = () => syncRemoteStreamFromPc(pc, inboundStream);
            track.onmute = () => syncRemoteStreamFromPc(pc, inboundStream);
            track.onended = () => syncRemoteStreamFromPc(pc, inboundStream);
          });
        } else if (event.track) {
          inboundStream.addTrack(event.track);
          event.track.onunmute = () => syncRemoteStreamFromPc(pc, inboundStream);
          event.track.onmute = () => syncRemoteStreamFromPc(pc, inboundStream);
          event.track.onended = () => syncRemoteStreamFromPc(pc, inboundStream);
        }
        syncRemoteStreamFromPc(pc, inboundStream);
      };
    },
    [syncRemoteStreamFromPc]
  );

  // Attach or replace outgoing video track (camera or screen) on the RTCPeerConnection
  const setOutgoingVideoTrack = async (
    pc: RTCPeerConnection,
    newVideoTrack: MediaStreamTrack | null,
    streamForAddTrack?: MediaStream
  ): Promise<boolean> => {
    let needsRenegotiation = false;
    const videoTransceiver = pc
      .getTransceivers()
      .find(
        t =>
          t.receiver.track?.kind === 'video' ||
          t.sender.track?.kind === 'video'
      );
    const existingVideoSender =
      pc.getSenders().find(s => s.track?.kind === 'video') || videoTransceiver?.sender;

    if (existingVideoSender) {
      await existingVideoSender.replaceTrack(newVideoTrack);
      if (videoTransceiver && newVideoTrack && videoTransceiver.direction !== 'sendrecv') {
        videoTransceiver.direction = 'sendrecv';
        needsRenegotiation = true;
      }
    } else if (newVideoTrack) {
      const targetStream = streamForAddTrack || localStreamRef.current || new MediaStream([newVideoTrack]);
      pc.addTrack(newVideoTrack, targetStream);
      needsRenegotiation = true;
    }

    return needsRenegotiation;
  };

  // Attach or replace outgoing audio track on the RTCPeerConnection
  const setOutgoingAudioTrack = async (
    pc: RTCPeerConnection,
    newAudioTrack: MediaStreamTrack | null
  ): Promise<void> => {
    const audioTransceiver = pc
      .getTransceivers()
      .find(
        t =>
          t.receiver.track?.kind === 'audio' ||
          t.sender.track?.kind === 'audio'
      );
    const existingAudioSender =
      pc.getSenders().find(s => s.track?.kind === 'audio') || audioTransceiver?.sender;

    if (existingAudioSender) {
      try {
        await existingAudioSender.replaceTrack(newAudioTrack);
      } catch {
        // ignore replaceTrack error
      }
    }
  };

  // Send SDP renegotiation offer or state update to Firestore so both caller and callee stay in sync
  const updateCallSignalingState = async (
    call: CallSession,
    options: {
      forceRenegotiate?: boolean;
      videoEnabled?: boolean;
      audioMuted?: boolean;
      screenSharing?: boolean;
      screenSurface?: 'monitor' | 'window' | 'browser';
    }
  ) => {
    if (!firebaseUser) return;
    const myUid = firebaseUser.uid;
    const isCaller = call.callerId === myUid;
    const pc = peerConnectionRef.current;

    const nextCallerVideo = isCaller
      ? (options.videoEnabled ?? !isVideoMutedRef.current)
      : (call.callerVideoEnabled ?? (call.type === 'video'));
    const nextCalleeVideo = !isCaller
      ? (options.videoEnabled ?? !isVideoMutedRef.current)
      : (call.calleeVideoEnabled ?? false);

    const nextCallerAudioMuted = isCaller
      ? (options.audioMuted ?? isAudioMutedRef.current)
      : (call.callerAudioMuted ?? false);
    const nextCalleeAudioMuted = !isCaller
      ? (options.audioMuted ?? isAudioMutedRef.current)
      : (call.calleeAudioMuted ?? false);

    const nextCallerScreen = isCaller
      ? (options.screenSharing ?? isScreenSharingRef.current)
      : (call.callerScreenSharing ?? false);
    const nextCalleeScreen = !isCaller
      ? (options.screenSharing ?? isScreenSharingRef.current)
      : (call.calleeScreenSharing ?? false);

    const anyScreenSharing = Boolean(nextCallerScreen || nextCalleeScreen);

    let nextOfferSdp = call.offerSdp;
    let nextOfferType = call.offerType;
    let nextAnswerSdp = call.answerSdp;
    let nextAnswerType = call.answerType;
    let nextOfferSenderId = call.offerSenderId || call.callerId;

    if (options.forceRenegotiate && pc && pc.signalingState === 'stable') {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        nextOfferSdp = (offer.sdp || '').slice(0, 30000);
        nextOfferType = offer.type;
        nextOfferSenderId = myUid;
        // Clear answerSdp so the remote peer knows to generate a fresh SDP answer
        nextAnswerSdp = '';
        nextAnswerType = '';
      } catch {
        // ignore offer error
      }
    }

    const updatePayload: Record<string, any> = {
      isScreenSharing: anyScreenSharing,
      callerVideoEnabled: nextCallerVideo,
      calleeVideoEnabled: nextCalleeVideo,
      callerAudioMuted: nextCallerAudioMuted,
      calleeAudioMuted: nextCalleeAudioMuted,
      callerScreenSharing: nextCallerScreen,
      calleeScreenSharing: nextCalleeScreen,
      offerSenderId: nextOfferSenderId,
      offerSdp: nextOfferSdp,
      offerType: nextOfferType,
      answerSdp: nextAnswerSdp,
      answerType: nextAnswerType,
      updatedAt: serverTimestamp(),
    };

    if (options.screenSurface) {
      updatePayload.screenShareSurface = options.screenSurface;
    }

    try {
      await updateDoc(doc(db, 'calls', call.callId), updatePayload);
    } catch {
      // ignore transient firestore update race
    }
  };

  const bindCallRealtimeSignaling = (
    callId: string,
    myUid: string,
    peerUid: string,
    pc: RTCPeerConnection,
    inboundStream: MediaStream,
    initialOfferSdp: string
  ) => {
    let lastHandledOfferSdp = initialOfferSdp;
    let lastHandledAnswerSdp = '';

    callUnsubRef.current = onSnapshot(doc(db, 'calls', callId), async snap => {
      if (!snap.exists()) return;
      const data = snap.data() as CallSession;
      setActiveCall(data);
      activeCallRef.current = data;

      setGroupCallParticipants(prev =>
        prev.map(item =>
          item.callId === callId ? { ...item, status: data.status } : item
        )
      );

      if (data.status === 'ended') {
        cleanupCallResources();
        return;
      }

      const offerSender = data.offerSenderId || data.callerId;

      // Case 1: The remote peer sent a new SDP Offer (initial or mid-call renegotiation)
      if (
        data.offerSdp &&
        data.offerSdp !== lastHandledOfferSdp &&
        offerSender !== myUid &&
        !data.answerSdp &&
        pc.signalingState === 'stable'
      ) {
        lastHandledOfferSdp = data.offerSdp;
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: 'offer',
              sdp: data.offerSdp,
            })
          );
          await flushPendingIceCandidates(pc);

          const videoTransceiver = pc
            .getTransceivers()
            .find(
              t =>
                t.receiver.track?.kind === 'video' ||
                t.sender.track?.kind === 'video'
            );
          if (videoTransceiver && videoTransceiver.direction !== 'sendrecv') {
            videoTransceiver.direction = 'sendrecv';
          }

          const newAnswer = await pc.createAnswer();
          await pc.setLocalDescription(newAnswer);
          lastHandledAnswerSdp = newAnswer.sdp || '';

          syncRemoteStreamFromPc(pc, inboundStream);

          await updateDoc(doc(db, 'calls', callId), {
            isScreenSharing: data.isScreenSharing,
            callerVideoEnabled: data.callerVideoEnabled ?? false,
            calleeVideoEnabled: data.calleeVideoEnabled ?? false,
            callerAudioMuted: data.callerAudioMuted ?? false,
            calleeAudioMuted: data.calleeAudioMuted ?? false,
            callerScreenSharing: data.callerScreenSharing ?? false,
            calleeScreenSharing: data.calleeScreenSharing ?? false,
            offerSenderId: offerSender,
            offerSdp: data.offerSdp,
            offerType: data.offerType,
            answerSdp: (newAnswer.sdp || '').slice(0, 30000),
            answerType: newAnswer.type,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('Error handling renegotiation offer:', err);
        }
      }

      // Case 2: The remote peer answered OUR SDP Offer (initial or mid-call renegotiation)
      if (
        data.answerSdp &&
        data.answerSdp !== lastHandledAnswerSdp &&
        offerSender === myUid &&
        pc.signalingState === 'have-local-offer'
      ) {
        lastHandledAnswerSdp = data.answerSdp;
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: 'answer',
              sdp: data.answerSdp,
            })
          );
          await flushPendingIceCandidates(pc);
          syncRemoteStreamFromPc(pc, inboundStream);
        } catch (err) {
          console.error('Error setting remote answer SDP:', err);
        }
      }

      // Always keep receiver tracks synced when signaling state changes
      syncRemoteStreamFromPc(pc, inboundStream);
    });

    const candQuery = query(
      collection(db, 'calls', callId, 'candidates'),
      where('callId', '==', callId),
      where('recipientId', '==', myUid)
    );
    candidatesUnsubRef.current = onSnapshot(candQuery, snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const candData = change.doc.data() as IceCandidateDoc;
          if (candData.senderId !== myUid) {
            const candidateInit: RTCIceCandidateInit = {
              candidate: candData.candidate,
              sdpMid: candData.sdpMid,
              sdpMLineIndex: candData.sdpMLineIndex,
            };
            if (pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(() => {});
            } else {
              pendingCandidatesRef.current.push(candidateInit);
            }
          }
        }
      });
    });
  };

  const startCall = async (type: 'audio' | 'video', targetChat?: Chat | null) => {
    if (!firebaseUser || !profile) return;
    const chat = targetChat || activeChat;
    if (!chat) {
      throw new Error('Выберите чат или собеседника для начала звонка');
    }

    cleanupCallResources();

    const myUid = firebaseUser.uid;
    const groupPeerMembers =
      chat.type === 'group'
        ? activeChatMembers.filter(m => m.userId !== myUid)
        : [];
    const primaryCalleeId =
      chat.type === 'group' && groupPeerMembers.length > 0
        ? groupPeerMembers[0].userId
        : chat.ownerId === myUid
        ? chat.peerUserId || myUid
        : chat.ownerId;

    const callId = sanitizeId(`call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    const stream = await acquireMediaStreamSafe(type === 'video', cameraFacingMode, selectedCameraId || undefined);
    localStreamRef.current = stream;
    cameraStreamRef.current = stream;
    setLocalStream(stream);
    setLocalCameraStream(stream);

    const hasInitialVideo = type === 'video' && stream.getVideoTracks().length > 0;
    setIsAudioMuted(false);
    setIsVideoMuted(!hasInitialVideo);
    isVideoMutedRef.current = !hasInitialVideo;

    const rtcConfig = await getDynamicRtcConfig();
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    const inboundStream = new MediaStream();
    setRemoteStream(inboundStream);
    attachPeerTrackListeners(pc, inboundStream);

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Pre-allocate a sendrecv video transceiver even on audio calls so turning on camera or screen share is instant
    if (stream.getVideoTracks().length === 0) {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    pc.onicecandidate = async event => {
      if (event.candidate) {
        const candId = sanitizeId(`cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        try {
          await setDoc(doc(db, 'calls', callId, 'candidates', candId), {
            candidateId: candId,
            callId,
            senderId: myUid,
            recipientId: primaryCalleeId,
            candidate: event.candidate.candidate.slice(0, 2000),
            sdpMid: (event.candidate.sdpMid || '0').slice(0, 64),
            sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
            createdAt: serverTimestamp(),
          });
        } catch {
          // ignore
        }
      }
    };

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);

    const callerTitle =
      chat.type === 'group'
        ? `${profile.displayName} (${chat.name})`.slice(0, 80)
        : profile.displayName.slice(0, 80);

    const callDoc: CallSession = {
      callId,
      chatId: chat.chatId,
      callerId: myUid,
      callerName: callerTitle,
      callerAvatar: (chat.type === 'group' ? chat.avatarUrl : profile.avatarUrl).slice(0, 2000),
      calleeId: primaryCalleeId,
      type,
      status: 'ringing',
      isScreenSharing: false,
      callerVideoEnabled: hasInitialVideo,
      calleeVideoEnabled: false,
      callerAudioMuted: false,
      calleeAudioMuted: false,
      callerScreenSharing: false,
      calleeScreenSharing: false,
      offerSenderId: myUid,
      offerSdp: (offer.sdp || '').slice(0, 30000),
      offerType: offer.type,
      answerSdp: '',
      answerType: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'calls', callId), callDoc);
      setActiveCall(callDoc);
      activeCallRef.current = callDoc;
    } catch (err) {
      cleanupCallResources();
      handleFirestoreError(err, OperationType.CREATE, `calls/${callId}`);
    }

    if (chat.type === 'group' && groupPeerMembers.length > 0) {
      const initialParticipants: GroupCallParticipant[] = groupPeerMembers.map((m, idx) => ({
        uid: m.userId,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        status: 'ringing',
        callId: idx === 0 ? callId : sanitizeId(`${callId}_${idx}`),
      }));
      setGroupCallParticipants(initialParticipants);

      for (let i = 1; i < initialParticipants.length; i++) {
        const p = initialParticipants[i];
        const extraDoc: CallSession = {
          ...callDoc,
          callId: p.callId,
          calleeId: p.uid,
        };
        setDoc(doc(db, 'calls', p.callId), extraDoc).catch(() => {});
        const unsubExtra = onSnapshot(
          doc(db, 'calls', p.callId),
          snap => {
            if (!snap.exists()) return;
            const d = snap.data() as CallSession;
            setGroupCallParticipants(prev =>
              prev.map(item =>
                item.callId === p.callId ? { ...item, status: d.status } : item
              )
            );
          },
          () => {}
        );
        groupCallUnsubsRef.current.push(unsubExtra);
      }
    }

    bindCallRealtimeSignaling(callId, myUid, primaryCalleeId, pc, inboundStream, offer.sdp || '');
  };

  const acceptIncomingCall = async () => {
    if (!firebaseUser || !incomingCall) return;
    const myUid = firebaseUser.uid;
    const call = incomingCall;
    const callId = call.callId;

    cleanupCallResources();

    const stream = await acquireMediaStreamSafe(call.type === 'video', cameraFacingMode, selectedCameraId || undefined);
    localStreamRef.current = stream;
    cameraStreamRef.current = stream;
    setLocalStream(stream);
    setLocalCameraStream(stream);

    const hasInitialVideo = call.type === 'video' && stream.getVideoTracks().length > 0;
    setIsAudioMuted(false);
    setIsVideoMuted(!hasInitialVideo);
    isVideoMutedRef.current = !hasInitialVideo;

    const rtcConfig = await getDynamicRtcConfig();
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    const inboundStream = new MediaStream();
    setRemoteStream(inboundStream);
    attachPeerTrackListeners(pc, inboundStream);

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = async event => {
      if (event.candidate) {
        const candId = sanitizeId(`cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        try {
          await setDoc(doc(db, 'calls', callId, 'candidates', candId), {
            candidateId: candId,
            callId,
            senderId: myUid,
            recipientId: call.callerId,
            candidate: event.candidate.candidate.slice(0, 2000),
            sdpMid: (event.candidate.sdpMid || '0').slice(0, 64),
            sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
            createdAt: serverTimestamp(),
          });
        } catch {
          // ignore
        }
      }
    };

    await pc.setRemoteDescription(
      new RTCSessionDescription({
        type: 'offer',
        sdp: call.offerSdp,
      })
    );
    await flushPendingIceCandidates(pc);

    // Ensure the video transceiver is sendrecv so callee can also turn on camera or share screen anytime
    const videoTransceiver = pc
      .getTransceivers()
      .find(
        t =>
          t.receiver.track?.kind === 'video' ||
          t.sender.track?.kind === 'video'
      );
    if (videoTransceiver) {
      const myVideoTrack = stream.getVideoTracks()[0];
      if (myVideoTrack && videoTransceiver.sender.track?.id !== myVideoTrack.id) {
        await videoTransceiver.sender.replaceTrack(myVideoTrack);
      }
      videoTransceiver.direction = 'sendrecv';
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    syncRemoteStreamFromPc(pc, inboundStream);

    try {
      const updatedCall: CallSession = {
        ...call,
        status: 'connected',
        callerVideoEnabled: call.callerVideoEnabled ?? (call.type === 'video'),
        calleeVideoEnabled: hasInitialVideo,
        callerAudioMuted: call.callerAudioMuted ?? false,
        calleeAudioMuted: false,
        callerScreenSharing: call.callerScreenSharing ?? call.isScreenSharing,
        calleeScreenSharing: false,
        offerSenderId: call.offerSenderId || call.callerId,
        answerSdp: (answer.sdp || '').slice(0, 30000),
        answerType: answer.type,
      };
      await updateDoc(doc(db, 'calls', callId), {
        answerSdp: updatedCall.answerSdp,
        answerType: updatedCall.answerType,
        status: 'connected',
        callerVideoEnabled: updatedCall.callerVideoEnabled,
        calleeVideoEnabled: updatedCall.calleeVideoEnabled,
        callerAudioMuted: updatedCall.callerAudioMuted,
        calleeAudioMuted: updatedCall.calleeAudioMuted,
        callerScreenSharing: updatedCall.callerScreenSharing,
        calleeScreenSharing: updatedCall.calleeScreenSharing,
        offerSenderId: updatedCall.offerSenderId,
        updatedAt: serverTimestamp(),
      });
      setIncomingCall(null);
      setActiveCall(updatedCall);
      activeCallRef.current = updatedCall;
    } catch (err) {
      cleanupCallResources();
      handleFirestoreError(err, OperationType.UPDATE, `calls/${callId}`);
    }

    bindCallRealtimeSignaling(callId, myUid, call.callerId, pc, inboundStream, call.offerSdp);
  };

  const declineOrEndCall = async () => {
    const targetCall = activeCallRef.current || activeCall || incomingCall;
    if (targetCall && targetCall.status !== 'ended') {
      try {
        await updateDoc(doc(db, 'calls', targetCall.callId), {
          status: 'ended',
          isScreenSharing: false,
          callerScreenSharing: false,
          calleeScreenSharing: false,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore
      }
    }
    for (const p of groupCallParticipants) {
      if (p.callId !== targetCall?.callId && p.status !== 'ended') {
        updateDoc(doc(db, 'calls', p.callId), {
          status: 'ended',
          isScreenSharing: false,
          callerScreenSharing: false,
          calleeScreenSharing: false,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
    setIncomingCall(null);
    cleanupCallResources();
  };

  const applyLocalAudioMuteState = async (targetMuted: boolean, syncToFirestore: boolean) => {
    const pc = peerConnectionRef.current;
    const currentCall = activeCallRef.current || activeCall;

    const allLocalAudioTracks = [
      ...(localStreamRef.current?.getAudioTracks() || []),
      ...(cameraStreamRef.current?.getAudioTracks() || []),
      ...(screenStreamRef.current?.getAudioTracks() || []),
    ];

    allLocalAudioTracks.forEach(track => {
      track.enabled = !targetMuted;
    });

    if (pc) {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = !targetMuted;
        }
      });

      const primaryAudioTrack =
        allLocalAudioTracks.find(t => t.readyState === 'live') || null;
      await setOutgoingAudioTrack(pc, targetMuted ? null : primaryAudioTrack);
    }

    isAudioMutedRef.current = targetMuted;
    setIsAudioMuted(targetMuted);

    if (syncToFirestore && currentCall) {
      await updateCallSignalingState(currentCall, {
        forceRenegotiate: false,
        audioMuted: targetMuted,
      });
    }
  };

  const toggleMuteAudio = () => {
    const nextMuted = !isAudioMutedRef.current;
    applyLocalAudioMuteState(nextMuted, true).catch(() => {});
  };

  const toggleMuteVideo = async () => {
    const currentCall = activeCallRef.current || activeCall;
    const pc = peerConnectionRef.current;

    // If camera is currently ON -> turn it OFF and also mute microphone so nothing is heard
    if (!isVideoMutedRef.current) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getVideoTracks().forEach(track => {
          track.enabled = false;
          track.stop();
          cameraStreamRef.current?.removeTrack(track);
        });
        setLocalCameraStream(new MediaStream(cameraStreamRef.current.getTracks()));
      }

      if (!isScreenSharingRef.current) {
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = false;
            track.stop();
            localStreamRef.current?.removeTrack(track);
          });
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        if (pc) {
          await setOutgoingVideoTrack(pc, null);
        }
      }

      setIsVideoMuted(true);
      isVideoMutedRef.current = true;

      // Also mute outgoing microphone audio when camera is switched off so peer hears nothing
      await applyLocalAudioMuteState(true, false);

      if (currentCall) {
        await updateCallSignalingState(currentCall, {
          forceRenegotiate: false,
          videoEnabled: false,
          audioMuted: true,
        });
      }
      return;
    }

    // Camera is currently OFF -> acquire fresh camera video stream and turn it ON
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      const videoConstraints: MediaTrackConstraints = selectedCameraId
        ? {
            deviceId: { exact: selectedCameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          }
        : {
            facingMode: { ideal: cameraFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          };

      const camVideoOnly = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      const newVideoTrack = camVideoOnly.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const existingAudioTracks =
        cameraStreamRef.current?.getAudioTracks() ||
        localStreamRef.current?.getAudioTracks() ||
        [];
      const updatedCameraStream = new MediaStream([...existingAudioTracks, newVideoTrack]);
      cameraStreamRef.current = updatedCameraStream;
      setLocalCameraStream(updatedCameraStream);

      await refreshAvailableCameras();

      setIsVideoMuted(false);
      isVideoMutedRef.current = false;

      // Restore microphone audio when turning camera back on
      await applyLocalAudioMuteState(false, false);

      // If not currently sharing screen, send the camera track over WebRTC and display in main localStream
      if (!isScreenSharingRef.current) {
        localStreamRef.current = updatedCameraStream;
        setLocalStream(updatedCameraStream);

        let needsRenegotiation = true;
        if (pc) {
          await setOutgoingVideoTrack(pc, newVideoTrack, updatedCameraStream);
          needsRenegotiation = true;
        }
        if (currentCall) {
          await updateCallSignalingState(currentCall, {
            forceRenegotiate: needsRenegotiation,
            videoEnabled: true,
            audioMuted: false,
          });
        }
      } else if (currentCall) {
        await updateCallSignalingState(currentCall, {
          forceRenegotiate: false,
          videoEnabled: true,
          audioMuted: false,
        });
      }
    } catch {
      // Fallback if exact deviceId failed
      try {
        const fallbackStream = await acquireMediaStreamSafe(true, cameraFacingMode);
        const newVideoTrack = fallbackStream.getVideoTracks()[0];
        if (!newVideoTrack) return;
        cameraStreamRef.current = fallbackStream;
        setLocalCameraStream(fallbackStream);
        setIsVideoMuted(false);
        isVideoMutedRef.current = false;
        await applyLocalAudioMuteState(false, false);

        if (!isScreenSharingRef.current) {
          localStreamRef.current = fallbackStream;
          setLocalStream(fallbackStream);
          if (pc) {
            await setOutgoingVideoTrack(pc, newVideoTrack, fallbackStream);
          }
        }
        if (currentCall) {
          await updateCallSignalingState(currentCall, {
            forceRenegotiate: true,
            videoEnabled: true,
            audioMuted: false,
          });
        }
      } catch {
        // ignore if camera hardware unavailable
      }
    }
  };

  const switchCamera = async (targetDeviceId?: string) => {
    const currentCall = activeCallRef.current || activeCall;
    if (!currentCall) return;

    const nextFacingMode: 'user' | 'environment' =
      cameraFacingMode === 'user' ? 'environment' : 'user';
    if (!targetDeviceId) {
      setCameraFacingMode(nextFacingMode);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setAvailableCameras(videoInputs);

      const currentVideoTrack = cameraStreamRef.current?.getVideoTracks()[0];
      const currentDeviceId = currentVideoTrack?.getSettings?.().deviceId || selectedCameraId;

      let chosenDeviceId = targetDeviceId || '';
      if (!chosenDeviceId && videoInputs.length > 1 && currentDeviceId) {
        const idx = videoInputs.findIndex(d => d.deviceId === currentDeviceId);
        const nextDevice = videoInputs[(idx + 1) % videoInputs.length];
        if (nextDevice?.deviceId) {
          chosenDeviceId = nextDevice.deviceId;
        }
      }

      const buildConstraints = (useExactDevice: boolean): MediaTrackConstraints => {
        if (useExactDevice && chosenDeviceId) {
          return {
            deviceId: { exact: chosenDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          };
        }
        return {
          facingMode: { ideal: nextFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        };
      };

      let newVideoStream: MediaStream;
      try {
        newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: buildConstraints(Boolean(chosenDeviceId)),
          audio: false,
        });
      } catch {
        newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: buildConstraints(false),
          audio: false,
        });
      }

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const resolvedSettings = newVideoTrack.getSettings?.();
      if (resolvedSettings?.deviceId) {
        setSelectedCameraId(resolvedSettings.deviceId);
      }
      if (resolvedSettings?.facingMode === 'environment' || resolvedSettings?.facingMode === 'user') {
        setCameraFacingMode(resolvedSettings.facingMode);
      }

      // Stop old camera video tracks cleanly
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getVideoTracks().forEach(t => {
          t.stop();
          cameraStreamRef.current?.removeTrack(t);
        });
      }

      const existingAudioTracks =
        cameraStreamRef.current?.getAudioTracks() ||
        localStreamRef.current?.getAudioTracks() ||
        [];
      const updatedCameraStream = new MediaStream([...existingAudioTracks, newVideoTrack]);
      cameraStreamRef.current = updatedCameraStream;
      setLocalCameraStream(updatedCameraStream);
      setIsVideoMuted(false);
      isVideoMutedRef.current = false;

      const pc = peerConnectionRef.current;
      if (!isScreenSharingRef.current) {
        localStreamRef.current = updatedCameraStream;
        setLocalStream(updatedCameraStream);
        if (pc) {
          await setOutgoingVideoTrack(pc, newVideoTrack, updatedCameraStream);
        }
        await updateCallSignalingState(currentCall, {
          forceRenegotiate: true,
          videoEnabled: true,
        });
      } else {
        await updateCallSignalingState(currentCall, {
          forceRenegotiate: false,
          videoEnabled: true,
        });
      }
    } catch {
      // Fallback if camera switch fails on single-camera device
    }
  };

  const toggleSpeakerphone = () => {
    setIsSpeakerOn(prev => !prev);
  };

  const stopScreenShare = useCallback(async () => {
    const currentCall = activeCallRef.current || activeCall;
    const pc = peerConnectionRef.current;

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => {
        t.onended = null;
        t.stop();
      });
      screenStreamRef.current = null;
    }
    setLocalScreenStream(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;

    const camVideoTrack =
      !isVideoMutedRef.current
        ? cameraStreamRef.current?.getVideoTracks().find(t => t.readyState === 'live') || null
        : null;

    const audioTracks =
      cameraStreamRef.current?.getAudioTracks() ||
      localStreamRef.current?.getAudioTracks() ||
      [];

    if (camVideoTrack) {
      const restoredStream = new MediaStream([...audioTracks, camVideoTrack]);
      localStreamRef.current = restoredStream;
      setLocalStream(restoredStream);
      if (pc) {
        await setOutgoingVideoTrack(pc, camVideoTrack, restoredStream);
      }
    } else {
      const audioOnlyStream = new MediaStream([...audioTracks]);
      localStreamRef.current = audioOnlyStream;
      setLocalStream(audioOnlyStream);
      if (pc) {
        await setOutgoingVideoTrack(pc, null);
      }
    }

    if (currentCall) {
      await updateCallSignalingState(currentCall, {
        forceRenegotiate: true,
        screenSharing: false,
        videoEnabled: Boolean(camVideoTrack),
      });
    }
  }, [activeCall]);

  const startScreenShare = async (options?: ScreenShareOptions): Promise<boolean> => {
    const currentCall = activeCallRef.current || activeCall;
    if (!currentCall) return false;
    const pc = peerConnectionRef.current;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        return false;
      }

      const targetWidth = options?.resolution === '720p' ? 1280 : 1920;
      const targetHeight = options?.resolution === '720p' ? 720 : 1080;
      const targetFps = options?.fps || 30;
      const surface = options?.surface || 'monitor';

      const displayMediaConstraints: DisplayMediaStreamOptions = {
        video: {
          displaySurface: surface,
          width: { ideal: targetWidth, max: 1920 },
          height: { ideal: targetHeight, max: 1080 },
          frameRate: { ideal: targetFps, max: 60 },
        } as MediaTrackConstraints,
        audio: options?.includeSystemAudio !== false,
      };

      const displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaConstraints);
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return false;

      if ('contentHint' in screenTrack) {
        try {
          screenTrack.contentHint = targetFps >= 60 ? 'motion' : 'detail';
        } catch {
          // ignore
        }
      }

      // Stop previous screen stream if switching screen source live
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => {
          t.onended = null;
          t.stop();
        });
      }

      screenStreamRef.current = displayStream;
      setLocalScreenStream(displayStream);

      const micAudioTracks =
        cameraStreamRef.current?.getAudioTracks() ||
        localStreamRef.current?.getAudioTracks() ||
        [];
      const combinedStream = new MediaStream([...micAudioTracks, screenTrack]);
      localStreamRef.current = combinedStream;
      setLocalStream(combinedStream);

      if (pc) {
        await setOutgoingVideoTrack(pc, screenTrack, combinedStream);
      }

      screenTrack.onended = () => {
        stopScreenShare().catch(() => {});
      };

      setIsScreenSharing(true);
      isScreenSharingRef.current = true;

      await updateCallSignalingState(currentCall, {
        forceRenegotiate: true,
        screenSharing: true,
        screenSurface: surface,
      });

      return true;
    } catch {
      // User canceled native screen picker or permission denied
      return false;
    }
  };

  const toggleScreenShare = async (options?: ScreenShareOptions) => {
    if (!isScreenSharingRef.current) {
      await startScreenShare(options);
    } else if (options) {
      // Switching screen source while already sharing
      await startScreenShare(options);
    } else {
      await stopScreenShare();
    }
  };

  return (
    <ChatContext.Provider
      value={{
        usersDirectory,
        chats,
        publicChannelsAndGroups,
        activeChatId,
        activeChat,
        activeChatMembers,
        messages,
        typingUsersByChat,
        messageLikesByMe,
        messageReactions,
        deletedForMeMessageIds,
        posts,
        postLikesByMe,
        postComments,
        commentLikesByMe,
        commentLikesCount,
        activeTab,
        searchQuery,
        wallpaperConfigs,
        customWallpapers,
        getEffectiveWallpaper,
        saveWallpaperConfig,
        resetWallpaperConfig,
        uploadCustomWallpaper,
        deleteCustomWallpaper,
        activeCall,
        incomingCall,
        callHistory,
        localStream,
        localCameraStream,
        localScreenStream,
        remoteStream,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
        isSpeakerOn,
        cameraFacingMode,
        availableCameras,
        selectedCameraId,
        groupCallParticipants,
        setActiveTab,
        setActiveChatId,
        setSearchQuery,
        startDirectChatWithUser,
        startDirectChatByContact,
        createGroupOrChannel,
        joinPublicChat,
        leaveChat,
        addMemberToChat,
        updateMemberRole,
        removeMemberFromChat,
        togglePinChat,
        toggleMuteChat,
        toggleArchiveChat,
        deleteChatForMe,
        deleteChatForBoth,
        setChatTyping,
        sendMessage,
        editMessage,
        deleteMessage,
        deleteMessageForMe,
        deleteMessageForEveryone,
        likeMessage,
        reactToMessage,
        forwardMessageToTarget,
        myProfileFolders,
        viewedUserProfile,
        viewedUserFolders,
        openUserProfile,
        closeUserProfile,
        createProfileFolder,
        deleteProfileFolder,
        togglePostInFolder,
        createPost,
        editPost,
        deletePost,
        toggleLikePost,
        loadCommentsForPost,
        addCommentToPost,
        editComment,
        deleteComment,
        toggleLikeComment,
        startCall,
        acceptIncomingCall,
        declineOrEndCall,
        toggleMuteAudio,
        toggleMuteVideo,
        toggleScreenShare,
        startScreenShare,
        stopScreenShare,
        switchCamera,
        refreshAvailableCameras,
        toggleSpeakerphone,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
