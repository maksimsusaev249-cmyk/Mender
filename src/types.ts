export type UserStatus = 'online' | 'offline' | 'busy';
export type PrivacyLevel = 'everyone' | 'contacts' | 'nobody';
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';
export type ChatType = 'direct' | 'group' | 'channel';
export type VisibilityType = 'public' | 'private';
export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'video_circle';

export type WallpaperCategory =
  | 'space'
  | 'neon'
  | 'abstract'
  | 'liquid_glass'
  | 'nature'
  | 'minimal'
  | 'geometry'
  | 'gradients'
  | 'pastel'
  | 'dark';

export interface BuiltinWallpaper {
  id: string;
  name: string;
  subtitle: string;
  category: WallpaperCategory;
  svgDataUrl: string;
  accentColor: string;
}

export interface WallpaperConfig {
  scopeId: string; // 'global' or chatId
  userId: string;
  wallpaperId: string;
  sourceType: 'builtin' | 'custom' | 'color';
  imageUrl: string;
  backgroundColor: string;
  dimming: number; // 0..90
  brightness: number; // 50..150
  blur: number; // 0..30
  scale: number; // 100..300
  posX: number; // -100..100
  posY: number; // -100..100
  updatedAt?: any;
}

export interface CustomWallpaper {
  wallpaperId: string;
  userId: string;
  name: string;
  imageUrl: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: any;
}

export interface UserPublic {
  uid: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  bio: string;
  status: UserStatus;
  privacyLastSeen: PrivacyLevel;
  privacyPhoto: PrivacyLevel;
  privacyCalls: PrivacyLevel;
  followersCount: number;
  followingCount: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserPrivate {
  uid: string;
  email: string;
  phone: string;
  pinHash: string;
  pinSalt: string;
  passwordHash?: string;
  passwordSalt?: string;
  darkMode: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  twoFactorEnabled: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserBlock {
  blockerId: string;
  blockedUserId: string;
  reason: string;
  createdAt?: any;
}

export interface Subscription {
  subscriberId: string;
  targetId: string;
  targetType: 'user' | 'channel';
  createdAt?: any;
}

export interface UserMembership {
  userId: string;
  chatId: string;
  role: MemberRole;
  isPinned: boolean;
  isMuted: boolean;
  isArchived?: boolean;
  isHidden?: boolean;
  clearedAtMs?: number;
  joinedAt?: any;
  updatedAt?: any;
}

export interface ChatMember {
  chatId: string;
  userId: string;
  role: MemberRole;
  displayName: string;
  avatarUrl: string;
  joinedAt?: any;
}

export interface Chat {
  chatId: string;
  type: ChatType;
  visibility: VisibilityType;
  name: string;
  description: string;
  avatarUrl: string;
  ownerId: string;
  peerUserId: string;
  membersCount: number;
  lastMessageText: string;
  lastMessageType: MessageType;
  lastMessageSenderId: string;
  createdAt?: any;
  updatedAt?: any;
  myRole?: MemberRole;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
}

export interface Message {
  messageId: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  chatVisibility: VisibilityType;
  type: MessageType;
  content: string;
  mediaUrl: string;
  duration: number;
  status: 'sent' | 'delivered' | 'read';
  likesCount: number;
  reactionEmoji?: string;
  replyToId?: string;
  replyToSender?: string;
  replyToText?: string;
  forwardedFromName?: string;
  deletedForUserIds?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface TypingStatus {
  chatId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
  updatedAt?: any;
}

export interface PostMediaItem {
  url: string;
  type: 'image' | 'video';
}

export interface Post {
  postId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  visibility: VisibilityType;
  content: string;
  mediaUrl: string;
  mediaType: 'none' | 'image' | 'video';
  mediaItems?: PostMediaItem[];
  mediaLayout?: 'carousel' | 'grid';
  likesCount: number;
  commentsCount: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface PostComment {
  commentId: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  postVisibility: VisibilityType;
  content: string;
  createdAt?: any;
}

export interface ScreenShareOptions {
  surface: 'monitor' | 'window' | 'browser';
  resolution: '1080p' | '720p';
  fps: 30 | 60;
  includeSystemAudio: boolean;
}

export interface CallSession {
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  calleeId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'ended';
  isScreenSharing: boolean;
  callerVideoEnabled?: boolean;
  calleeVideoEnabled?: boolean;
  callerAudioMuted?: boolean;
  calleeAudioMuted?: boolean;
  callerScreenSharing?: boolean;
  calleeScreenSharing?: boolean;
  offerSenderId?: string;
  screenShareSurface?: 'monitor' | 'window' | 'browser';
  offerSdp: string;
  offerType: string;
  answerSdp: string;
  answerType: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface IceCandidateDoc {
  candidateId: string;
  callId: string;
  senderId: string;
  recipientId: string;
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
  createdAt?: any;
}

export interface ReportDoc {
  reportId: string;
  reporterId: string;
  targetId: string;
  targetType: 'user' | 'chat' | 'post' | 'message' | 'video' | 'video_comment';
  reason: string;
  status: 'open' | 'resolved';
  createdAt?: any;
}

export interface ProfileFolder {
  folderId: string;
  userId: string;
  name: string;
  postIds: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface UserSessionDoc {
  sessionId: string;
  userId: string;
  device: string;
  ip: string;
  isCurrent?: boolean;
  status: 'active' | 'terminated';
  lastActiveAt?: any;
  createdAt?: any;
}

export type VideoCategory =
  | 'Технологии и IT'
  | 'Музыка'
  | 'Игры'
  | 'Образование'
  | 'Развлечения'
  | 'Спорт'
  | 'Наука'
  | 'Путешествия'
  | 'Творчество'
  | 'Блоги';

export interface MenderVideo {
  videoId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  title: string;
  description: string;
  category: string;
  hashtags: string[];
  videoUrl: string;
  thumbnailUrl: string;
  duration: number; // in seconds
  sizeBytes: number;
  mimeType: string;
  status: 'draft' | 'published';
  visibility: VisibilityType;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface MenderVideoView {
  videoId: string;
  viewerId: string;
  createdAt?: any;
}

export interface MenderVideoLike {
  videoId: string;
  userId: string;
  createdAt?: any;
}

export interface MenderVideoComment {
  commentId: string;
  videoId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  parentCommentId: string; // '' if top-level comment, otherwise parent commentId
  replyToAuthorName: string;
  likesCount: number;
  likedByUserIds: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface VideoPlaylist {
  playlistId: string;
  ownerId: string;
  ownerName: string;
  ownerUsername: string;
  ownerAvatar: string;
  title: string;
  description: string;
  visibility: VisibilityType;
  videoIds: string[];
  coverUrl: string;
  createdAt?: any;
  updatedAt?: any;
}

export type VideoNotificationType =
  | 'new_subscriber'
  | 'video_like'
  | 'new_comment'
  | 'comment_reply'
  | 'comment_like';

export interface VideoNotification {
  notificationId: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorAvatar: string;
  type: VideoNotificationType;
  videoId: string;
  videoTitle: string;
  commentText: string;
  isRead: boolean;
  createdAt?: any;
}

export type MusicGenre =
  | 'Электроника'
  | 'Lo-Fi & Chill'
  | 'Синтвейв'
  | 'Хип-Хоп & R&B'
  | 'Инди & Рок'
  | 'Эмбиент'
  | 'Неоклассика'
  | 'Поп';

export type MusicRepeatMode = 'off' | 'all' | 'one';

export interface MenderMusicTrack {
  trackId: string;
  uploaderId: string;
  uploaderName: string;
  uploaderUsername: string;
  uploaderAvatar: string;
  title: string;
  artist: string;
  artistId: string;
  albumTitle: string;
  albumId: string;
  genre: string;
  releaseYear: number;
  audioUrl: string;
  coverUrl: string;
  duration: number; // in seconds
  sizeBytes: number;
  mimeType: string;
  visibility: VisibilityType;
  playsCount: number;
  likesCount: number;
  lyrics: string;
  isBuiltIn?: boolean;
  synthPreset?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MenderMusicPlaylist {
  playlistId: string;
  ownerId: string;
  ownerName: string;
  ownerUsername: string;
  ownerAvatar: string;
  title: string;
  description: string;
  visibility: VisibilityType;
  trackIds: string[];
  coverUrl: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MenderMusicAlbum {
  albumId: string;
  title: string;
  artist: string;
  artistId: string;
  genre: string;
  releaseYear: number;
  coverUrl: string;
  description: string;
  trackIds: string[];
}

export interface MenderMusicArtist {
  artistId: string;
  name: string;
  genre: string;
  avatarUrl: string;
  coverBannerUrl: string;
  bio: string;
  monthlyListeners: number;
  verified: boolean;
}



