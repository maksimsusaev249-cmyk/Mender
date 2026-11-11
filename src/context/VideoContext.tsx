import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import {
  MenderVideo,
  MenderVideoComment,
  VideoPlaylist,
  VideoNotification,
  VisibilityType,
} from '../types';
import { sanitizeId } from '../utils/crypto';
import {
  uploadVideoWithProgress,
  uploadMediaFile,
  validateCoverImageFile,
} from '../utils/media';

function extractTsMs(ts: any, fallbackId?: string): number {
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
  if (fallbackId) {
    const m = fallbackId.match(/_(\d{12,14})/);
    if (m) return Number(m[1]);
  }
  return Date.now();
}

export type VideoSubView =
  | 'home'
  | 'watch'
  | 'upload'
  | 'author'
  | 'playlists'
  | 'analytics'
  | 'my_videos';

interface VideoContextType {
  publicVideos: MenderVideo[];
  myVideos: MenderVideo[];
  allAccessibleVideos: MenderVideo[];
  videoLikesByMe: Record<string, boolean>;
  videoCommentsMap: Record<string, MenderVideoComment[]>;
  publicPlaylists: VideoPlaylist[];
  myPlaylists: VideoPlaylist[];
  allAccessiblePlaylists: VideoPlaylist[];
  videoNotifications: VideoNotification[];
  unreadNotificationsCount: number;
  // Navigation state inside Mender Video
  videoSubView: VideoSubView;
  setVideoSubView: (view: VideoSubView) => void;
  activeVideoId: string | null;
  activePlaylistId: string | null;
  selectedAuthorId: string | null;
  editingVideo: MenderVideo | null;
  setEditingVideo: (video: MenderVideo | null) => void;
  openVideoPlayer: (videoId: string, playlistId?: string | null) => void;
  openAuthorProfile: (authorId: string) => void;
  openUploadStudio: (videoToEdit?: MenderVideo | null) => void;
  // Actions
  publishOrSaveVideo: (params: {
    file?: File | null;
    existingVideo?: MenderVideo | null;
    title: string;
    description: string;
    category: string;
    hashtags: string[];
    thumbnailUrl: string;
    customCoverFile?: File | null;
    duration: number;
    status: 'draft' | 'published';
    visibility: VisibilityType;
    onProgress?: (pct: number) => void;
  }) => Promise<MenderVideo>;
  updateVideoMetadata: (
    videoId: string,
    updates: {
      title: string;
      description: string;
      category: string;
      hashtags: string[];
      thumbnailUrl: string;
      status: 'draft' | 'published';
      visibility: VisibilityType;
    }
  ) => Promise<void>;
  deleteVideo: (videoId: string) => Promise<void>;
  recordUniqueVideoView: (video: MenderVideo) => Promise<void>;
  toggleLikeVideo: (video: MenderVideo) => Promise<void>;
  subscribeToVideoComments: (videoId: string) => () => void;
  addVideoComment: (
    video: MenderVideo,
    content: string,
    parentComment?: MenderVideoComment | null
  ) => Promise<void>;
  toggleLikeVideoComment: (video: MenderVideo, comment: MenderVideoComment) => Promise<void>;
  deleteVideoComment: (video: MenderVideo, comment: MenderVideoComment) => Promise<void>;
  // Playlists
  createPlaylist: (params: {
    title: string;
    description: string;
    visibility: VisibilityType;
    initialVideoId?: string;
    coverUrl?: string;
  }) => Promise<VideoPlaylist>;
  updatePlaylist: (
    playlistId: string,
    updates: {
      title?: string;
      description?: string;
      visibility?: VisibilityType;
      coverUrl?: string;
    }
  ) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  toggleVideoInPlaylist: (playlistId: string, video: MenderVideo) => Promise<void>;
  // Notifications
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export const VideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, profile, isAuthReady } = useAuth();

  const [publicVideos, setPublicVideos] = useState<MenderVideo[]>([]);
  const [myVideos, setMyVideos] = useState<MenderVideo[]>([]);
  const [videoLikesByMe, setVideoLikesByMe] = useState<Record<string, boolean>>({});
  const [videoCommentsMap, setVideoCommentsMap] = useState<Record<string, MenderVideoComment[]>>({});
  const [publicPlaylists, setPublicPlaylists] = useState<VideoPlaylist[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<VideoPlaylist[]>([]);
  const [videoNotifications, setVideoNotifications] = useState<VideoNotification[]>([]);

  const [videoSubView, setVideoSubView] = useState<VideoSubView>('home');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<MenderVideo | null>(null);

  const checkedLikesRef = useRef<Set<string>>(new Set());
  const inFlightViewSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthReady || !firebaseUser || !profile) {
      setPublicVideos([]);
      setMyVideos([]);
      setVideoLikesByMe({});
      setPublicPlaylists([]);
      setMyPlaylists([]);
      setVideoNotifications([]);
      checkedLikesRef.current.clear();
      return;
    }

    const uid = firebaseUser.uid;

    // 1. Public published videos
    const pubVideosQuery = query(
      collection(db, 'mender_videos'),
      where('visibility', '==', 'public')
    );
    const unsubPubVideos = onSnapshot(
      pubVideosQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as MenderVideo)
          .filter(v => v.status === 'published')
          .sort((a, b) => extractTsMs(b.createdAt, b.videoId) - extractTsMs(a.createdAt, a.videoId));
        setPublicVideos(list);

        list.forEach(v => {
          if (!checkedLikesRef.current.has(v.videoId)) {
            checkedLikesRef.current.add(v.videoId);
            getDoc(doc(db, 'mender_videos', v.videoId, 'likes', uid))
              .then(likeSnap => {
                setVideoLikesByMe(prev => ({ ...prev, [v.videoId]: likeSnap.exists() }));
              })
              .catch(() => {});
          }
        });
      },
      err => handleFirestoreError(err, OperationType.LIST, 'mender_videos (public)')
    );

    // 2. User's own videos (including drafts and private)
    const myVideosQuery = query(
      collection(db, 'mender_videos'),
      where('authorId', '==', uid)
    );
    const unsubMyVideos = onSnapshot(
      myVideosQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as MenderVideo)
          .sort((a, b) => extractTsMs(b.createdAt, b.videoId) - extractTsMs(a.createdAt, a.videoId));
        setMyVideos(list);

        list.forEach(v => {
          if (!checkedLikesRef.current.has(v.videoId)) {
            checkedLikesRef.current.add(v.videoId);
            getDoc(doc(db, 'mender_videos', v.videoId, 'likes', uid))
              .then(likeSnap => {
                setVideoLikesByMe(prev => ({ ...prev, [v.videoId]: likeSnap.exists() }));
              })
              .catch(() => {});
          }
        });
      },
      err => handleFirestoreError(err, OperationType.LIST, 'mender_videos (authorId)')
    );

    // 3. Public playlists
    const pubPlaylistsQuery = query(
      collection(db, 'video_playlists'),
      where('visibility', '==', 'public')
    );
    const unsubPubPlaylists = onSnapshot(
      pubPlaylistsQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as VideoPlaylist)
          .sort((a, b) => extractTsMs(b.updatedAt, b.playlistId) - extractTsMs(a.updatedAt, a.playlistId));
        setPublicPlaylists(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'video_playlists (public)')
    );

    // 4. User's own playlists (public & private)
    const myPlaylistsQuery = query(
      collection(db, 'video_playlists'),
      where('ownerId', '==', uid)
    );
    const unsubMyPlaylists = onSnapshot(
      myPlaylistsQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as VideoPlaylist)
          .sort((a, b) => extractTsMs(b.updatedAt, b.playlistId) - extractTsMs(a.updatedAt, a.playlistId));
        setMyPlaylists(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'video_playlists (ownerId)')
    );

    // 5. Real-time notifications for current user
    const notifQuery = query(
      collection(db, 'users', uid, 'video_notifications'),
      where('recipientId', '==', uid)
    );
    const unsubNotifs = onSnapshot(
      notifQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as VideoNotification)
          .sort((a, b) => extractTsMs(b.createdAt, b.notificationId) - extractTsMs(a.createdAt, a.notificationId));
        setVideoNotifications(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, `users/${uid}/video_notifications`)
    );

    return () => {
      unsubPubVideos();
      unsubMyVideos();
      unsubPubPlaylists();
      unsubMyPlaylists();
      unsubNotifs();
    };
  }, [isAuthReady, firebaseUser, profile]);

  const allAccessibleVideos: MenderVideo[] = React.useMemo(() => {
    const map = new Map<string, MenderVideo>();
    publicVideos.forEach(v => map.set(v.videoId, v));
    myVideos.forEach(v => map.set(v.videoId, v));
    return Array.from(map.values()).sort(
      (a, b) => extractTsMs(b.createdAt, b.videoId) - extractTsMs(a.createdAt, a.videoId)
    );
  }, [publicVideos, myVideos]);

  const allAccessiblePlaylists: VideoPlaylist[] = React.useMemo(() => {
    const map = new Map<string, VideoPlaylist>();
    publicPlaylists.forEach(p => map.set(p.playlistId, p));
    myPlaylists.forEach(p => map.set(p.playlistId, p));
    return Array.from(map.values()).sort(
      (a, b) => extractTsMs(b.updatedAt, b.playlistId) - extractTsMs(a.updatedAt, a.playlistId)
    );
  }, [publicPlaylists, myPlaylists]);

  const unreadNotificationsCount = React.useMemo(
    () => videoNotifications.filter(n => !n.isRead).length,
    [videoNotifications]
  );

  const openVideoPlayer = useCallback((videoId: string, playlistId: string | null = null) => {
    setActiveVideoId(videoId);
    setActivePlaylistId(playlistId);
    setVideoSubView('watch');
  }, []);

  const openAuthorProfile = useCallback((authorId: string) => {
    setSelectedAuthorId(authorId);
    setVideoSubView('author');
  }, []);

  const openUploadStudio = useCallback((videoToEdit: MenderVideo | null = null) => {
    setEditingVideo(videoToEdit);
    setVideoSubView('upload');
  }, []);

  const publishOrSaveVideo = async (params: {
    file?: File | null;
    existingVideo?: MenderVideo | null;
    title: string;
    description: string;
    category: string;
    hashtags: string[];
    thumbnailUrl: string;
    customCoverFile?: File | null;
    duration: number;
    status: 'draft' | 'published';
    visibility: VisibilityType;
    onProgress?: (pct: number) => void;
  }): Promise<MenderVideo> => {
    if (!firebaseUser || !profile) {
      throw new Error('Необходимо войти в аккаунт для загрузки видео.');
    }

    const uid = firebaseUser.uid;
    const cleanTitle = params.title.trim().slice(0, 150);
    if (!cleanTitle) {
      throw new Error('Укажите название видеоролика.');
    }

    if (params.existingVideo && params.existingVideo.authorId !== uid) {
      throw new Error('Отказано в доступе: вы можете редактировать только собственные видео.');
    }

    if (!params.existingVideo && !params.file) {
      throw new Error('Выберите видеофайл на устройстве для загрузки.');
    }

    const videoId = params.existingVideo
      ? params.existingVideo.videoId
      : sanitizeId(`vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    const reportProgress = (p: number) => {
      if (params.onProgress) params.onProgress(Math.max(0, Math.min(100, Math.round(p))));
    };

    let finalThumbnailUrl = (params.thumbnailUrl || '').slice(0, 750000);
    if (params.customCoverFile) {
      const coverErr = validateCoverImageFile(params.customCoverFile);
      if (coverErr) throw new Error(coverErr);
      finalThumbnailUrl = await uploadMediaFile(
        params.customCoverFile,
        uid,
        'posts',
        params.customCoverFile.name,
        280000
      );
    }

    let finalVideoUrl = params.existingVideo?.videoUrl || '';
    let sizeBytes = params.existingVideo?.sizeBytes || 0;
    let mimeType = params.existingVideo?.mimeType || 'video/mp4';

    if (params.file) {
      sizeBytes = Math.min(200000000, params.file.size);
      mimeType = (params.file.type || 'video/mp4').slice(0, 64);
      finalVideoUrl = await uploadVideoWithProgress(
        params.file,
        uid,
        videoId,
        pct => reportProgress(Math.round(pct * 0.9)),
        finalThumbnailUrl
      );
    } else {
      reportProgress(85);
    }

    const cleanTags = Array.from(
      new Set(
        params.hashtags
          .map(t => t.trim().replace(/^#/, '').toLowerCase())
          .filter(Boolean)
          .slice(0, 15)
          .map(t => `#${t.slice(0, 35)}`)
      )
    );

    const videoDoc: MenderVideo = {
      videoId,
      authorId: uid,
      authorName: profile.displayName.slice(0, 80),
      authorUsername: profile.username.slice(0, 40),
      authorAvatar: profile.avatarUrl.slice(0, 2000),
      title: cleanTitle,
      description: (params.description || '').trim().slice(0, 4000),
      category: (params.category || 'Технологии и IT').trim().slice(0, 60),
      hashtags: cleanTags,
      videoUrl: finalVideoUrl.slice(0, 900000),
      thumbnailUrl: finalThumbnailUrl.slice(0, 800000),
      duration: Math.max(1, Math.min(86400, Math.round(params.duration || 10))),
      sizeBytes,
      mimeType,
      status: params.status,
      visibility: params.visibility,
      viewsCount: params.existingVideo ? params.existingVideo.viewsCount : 0,
      likesCount: params.existingVideo ? params.existingVideo.likesCount : 0,
      commentsCount: params.existingVideo ? params.existingVideo.commentsCount : 0,
      createdAt: params.existingVideo ? params.existingVideo.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const videoRef = doc(db, 'mender_videos', videoId);
      if (params.existingVideo) {
        await updateDoc(videoRef, {
          title: videoDoc.title,
          description: videoDoc.description,
          category: videoDoc.category,
          hashtags: videoDoc.hashtags,
          videoUrl: videoDoc.videoUrl,
          thumbnailUrl: videoDoc.thumbnailUrl,
          duration: videoDoc.duration,
          sizeBytes: videoDoc.sizeBytes,
          mimeType: videoDoc.mimeType,
          status: videoDoc.status,
          visibility: videoDoc.visibility,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(videoRef, videoDoc);
      }
      reportProgress(100);
      return videoDoc;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `mender_videos/${videoId}`);
    }
  };

  const updateVideoMetadata = async (
    videoId: string,
    updates: {
      title: string;
      description: string;
      category: string;
      hashtags: string[];
      thumbnailUrl: string;
      status: 'draft' | 'published';
      visibility: VisibilityType;
    }
  ) => {
    if (!firebaseUser) throw new Error('Необходима авторизация');
    const target = allAccessibleVideos.find(v => v.videoId === videoId);
    if (!target || target.authorId !== firebaseUser.uid) {
      throw new Error('Вы можете редактировать только собственные видео.');
    }

    const cleanTags = Array.from(
      new Set(
        updates.hashtags
          .map(t => t.trim().replace(/^#/, '').toLowerCase())
          .filter(Boolean)
          .slice(0, 15)
          .map(t => `#${t.slice(0, 35)}`)
      )
    );

    try {
      await updateDoc(doc(db, 'mender_videos', videoId), {
        title: updates.title.trim().slice(0, 150),
        description: updates.description.trim().slice(0, 4000),
        category: updates.category.trim().slice(0, 60),
        hashtags: cleanTags,
        thumbnailUrl: updates.thumbnailUrl.slice(0, 800000),
        status: updates.status,
        visibility: updates.visibility,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `mender_videos/${videoId}`);
    }
  };

  const deleteVideo = async (videoId: string) => {
    if (!firebaseUser) throw new Error('Необходима авторизация');
    const target = allAccessibleVideos.find(v => v.videoId === videoId);
    if (!target || target.authorId !== firebaseUser.uid) {
      throw new Error('Удаление чужих видео запрещено.');
    }

    try {
      await deleteDoc(doc(db, 'mender_videos', videoId));
      // Remove deleted videoId from user's playlists
      for (const pl of myPlaylists) {
        if (pl.videoIds.includes(videoId)) {
          await updateDoc(doc(db, 'video_playlists', pl.playlistId), {
            videoIds: pl.videoIds.filter(id => id !== videoId),
            updatedAt: serverTimestamp(),
          });
        }
      }
      if (activeVideoId === videoId) {
        setActiveVideoId(null);
        setVideoSubView('home');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `mender_videos/${videoId}`);
    }
  };

  /**
   * Deduplicated view counter:
   * Checks both local storage and Firestore `/mender_videos/{videoId}/views/{uid}`.
   * Prevents duplicate view creation when refreshing the page or reopening the same video.
   */
  const recordUniqueVideoView = useCallback(
    async (video: MenderVideo) => {
      if (!firebaseUser || !video?.videoId) return;
      const uid = firebaseUser.uid;
      const viewKey = `${video.videoId}_${uid}`;

      if (inFlightViewSetRef.current.has(viewKey)) return;

      const localStorageKey = `mender_video_viewed_${viewKey}`;
      if (localStorage.getItem(localStorageKey) === '1') {
        return;
      }

      inFlightViewSetRef.current.add(viewKey);
      try {
        const viewRef = doc(db, 'mender_videos', video.videoId, 'views', uid);
        const existingSnap = await getDoc(viewRef);
        if (existingSnap.exists()) {
          localStorage.setItem(localStorageKey, '1');
          return;
        }

        const batch = writeBatch(db);
        batch.set(viewRef, {
          videoId: video.videoId,
          viewerId: uid,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, 'mender_videos', video.videoId), {
          viewsCount: (video.viewsCount || 0) + 1,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        localStorage.setItem(localStorageKey, '1');
      } catch {
        // ignore if already recorded
      } finally {
        inFlightViewSetRef.current.delete(viewKey);
      }
    },
    [firebaseUser]
  );

  const toggleLikeVideo = async (video: MenderVideo) => {
    if (!firebaseUser || !profile) return;
    const uid = firebaseUser.uid;
    const isLiked = Boolean(videoLikesByMe[video.videoId]);
    const likeRef = doc(db, 'mender_videos', video.videoId, 'likes', uid);
    const videoRef = doc(db, 'mender_videos', video.videoId);

    setVideoLikesByMe(prev => ({ ...prev, [video.videoId]: !isLiked }));

    try {
      const batch = writeBatch(db);
      if (isLiked) {
        batch.delete(likeRef);
        batch.update(videoRef, {
          likesCount: Math.max(0, (video.likesCount || 1) - 1),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(likeRef, {
          videoId: video.videoId,
          userId: uid,
          createdAt: serverTimestamp(),
        });
        batch.update(videoRef, {
          likesCount: (video.likesCount || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();

      if (!isLiked && video.authorId !== uid) {
        const notifId = sanitizeId(`vnotif_like_${video.videoId}_${uid}`);
        await setDoc(doc(db, 'users', video.authorId, 'video_notifications', notifId), {
          notificationId: notifId,
          recipientId: video.authorId,
          actorId: uid,
          actorName: profile.displayName.slice(0, 80),
          actorUsername: profile.username.slice(0, 40),
          actorAvatar: profile.avatarUrl.slice(0, 2000),
          type: 'video_like',
          videoId: video.videoId,
          videoTitle: video.title.slice(0, 150),
          commentText: '',
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch (err) {
      setVideoLikesByMe(prev => ({ ...prev, [video.videoId]: isLiked }));
      handleFirestoreError(err, OperationType.WRITE, `mender_videos/${video.videoId}/likes/${uid}`);
    }
  };

  const subscribeToVideoComments = useCallback((videoId: string) => {
    if (!videoId) return () => {};
    const commentsQuery = query(
      collection(db, 'mender_videos', videoId, 'comments'),
      where('videoId', '==', videoId)
    );
    const unsub = onSnapshot(
      commentsQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as MenderVideoComment)
          .sort((a, b) => extractTsMs(a.createdAt, a.commentId) - extractTsMs(b.createdAt, b.commentId));
        setVideoCommentsMap(prev => ({ ...prev, [videoId]: list }));
      },
      err => handleFirestoreError(err, OperationType.LIST, `mender_videos/${videoId}/comments`)
    );
    return unsub;
  }, []);

  const addVideoComment = async (
    video: MenderVideo,
    content: string,
    parentComment: MenderVideoComment | null = null
  ) => {
    if (!firebaseUser || !profile) return;
    const cleanText = content.trim().slice(0, 1500);
    if (!cleanText) return;

    const uid = firebaseUser.uid;
    const commentId = sanitizeId(`vcom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const commentRef = doc(db, 'mender_videos', video.videoId, 'comments', commentId);
    const videoRef = doc(db, 'mender_videos', video.videoId);

    const newComment: MenderVideoComment = {
      commentId,
      videoId: video.videoId,
      authorId: uid,
      authorName: profile.displayName.slice(0, 80),
      authorUsername: profile.username.slice(0, 40),
      authorAvatar: profile.avatarUrl.slice(0, 2000),
      content: cleanText,
      parentCommentId: parentComment ? parentComment.commentId : '',
      replyToAuthorName: parentComment ? parentComment.authorName.slice(0, 80) : '',
      likesCount: 0,
      likedByUserIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const batch = writeBatch(db);
      batch.set(commentRef, newComment);
      batch.update(videoRef, {
        commentsCount: (video.commentsCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      // Notify video author if someone else commented
      if (video.authorId !== uid) {
        const notifId = sanitizeId(`vnotif_com_${commentId}`);
        await setDoc(doc(db, 'users', video.authorId, 'video_notifications', notifId), {
          notificationId: notifId,
          recipientId: video.authorId,
          actorId: uid,
          actorName: profile.displayName.slice(0, 80),
          actorUsername: profile.username.slice(0, 40),
          actorAvatar: profile.avatarUrl.slice(0, 2000),
          type: 'new_comment',
          videoId: video.videoId,
          videoTitle: video.title.slice(0, 150),
          commentText: cleanText.slice(0, 300),
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }

      // Notify parent comment author if this is a reply to someone else
      if (parentComment && parentComment.authorId !== uid && parentComment.authorId !== video.authorId) {
        const replyNotifId = sanitizeId(`vnotif_rep_${commentId}`);
        await setDoc(doc(db, 'users', parentComment.authorId, 'video_notifications', replyNotifId), {
          notificationId: replyNotifId,
          recipientId: parentComment.authorId,
          actorId: uid,
          actorName: profile.displayName.slice(0, 80),
          actorUsername: profile.username.slice(0, 40),
          actorAvatar: profile.avatarUrl.slice(0, 2000),
          type: 'comment_reply',
          videoId: video.videoId,
          videoTitle: video.title.slice(0, 150),
          commentText: cleanText.slice(0, 300),
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `mender_videos/${video.videoId}/comments/${commentId}`
      );
    }
  };

  const toggleLikeVideoComment = async (video: MenderVideo, comment: MenderVideoComment) => {
    if (!firebaseUser || !profile) return;
    const uid = firebaseUser.uid;
    const existingList = Array.isArray(comment.likedByUserIds) ? comment.likedByUserIds : [];
    const alreadyLiked = existingList.includes(uid);
    const nextList = alreadyLiked
      ? existingList.filter(id => id !== uid)
      : [...existingList, uid].slice(0, 100);
    const nextCount = Math.max(0, nextList.length);

    try {
      await updateDoc(doc(db, 'mender_videos', video.videoId, 'comments', comment.commentId), {
        likedByUserIds: nextList,
        likesCount: nextCount,
        updatedAt: serverTimestamp(),
      });

      if (!alreadyLiked && comment.authorId !== uid) {
        const notifId = sanitizeId(`vnotif_clike_${comment.commentId}_${uid}`);
        await setDoc(doc(db, 'users', comment.authorId, 'video_notifications', notifId), {
          notificationId: notifId,
          recipientId: comment.authorId,
          actorId: uid,
          actorName: profile.displayName.slice(0, 80),
          actorUsername: profile.username.slice(0, 40),
          actorAvatar: profile.avatarUrl.slice(0, 2000),
          type: 'comment_like',
          videoId: video.videoId,
          videoTitle: video.title.slice(0, 150),
          commentText: comment.content.slice(0, 300),
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `mender_videos/${video.videoId}/comments/${comment.commentId}`
      );
    }
  };

  const deleteVideoComment = async (video: MenderVideo, comment: MenderVideoComment) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    if (comment.authorId !== uid && video.authorId !== uid) {
      throw new Error('Вы можете удалять только собственные комментарии.');
    }

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'mender_videos', video.videoId, 'comments', comment.commentId));
      batch.update(doc(db, 'mender_videos', video.videoId), {
        commentsCount: Math.max(0, (video.commentsCount || 1) - 1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `mender_videos/${video.videoId}/comments/${comment.commentId}`
      );
    }
  };

  // Playlists
  const createPlaylist = async (params: {
    title: string;
    description: string;
    visibility: VisibilityType;
    initialVideoId?: string;
    coverUrl?: string;
  }): Promise<VideoPlaylist> => {
    if (!firebaseUser || !profile) throw new Error('Необходима авторизация');
    const uid = firebaseUser.uid;
    const cleanTitle = params.title.trim().slice(0, 120);
    if (!cleanTitle) throw new Error('Введите название плейлиста');

    const playlistId = sanitizeId(`vpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const videoIds = params.initialVideoId ? [params.initialVideoId] : [];

    const newPlaylist: VideoPlaylist = {
      playlistId,
      ownerId: uid,
      ownerName: profile.displayName.slice(0, 80),
      ownerUsername: profile.username.slice(0, 40),
      ownerAvatar: profile.avatarUrl.slice(0, 2000),
      title: cleanTitle,
      description: (params.description || '').trim().slice(0, 1000),
      visibility: params.visibility,
      videoIds,
      coverUrl: (params.coverUrl || '').slice(0, 800000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'video_playlists', playlistId), newPlaylist);
      return newPlaylist;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `video_playlists/${playlistId}`);
    }
  };

  const updatePlaylist = async (
    playlistId: string,
    updates: {
      title?: string;
      description?: string;
      visibility?: VisibilityType;
      coverUrl?: string;
    }
  ) => {
    if (!firebaseUser) return;
    const existing = myPlaylists.find(p => p.playlistId === playlistId);
    if (!existing || existing.ownerId !== firebaseUser.uid) {
      throw new Error('Вы можете редактировать только свои плейлисты.');
    }

    try {
      await updateDoc(doc(db, 'video_playlists', playlistId), {
        title: (updates.title ?? existing.title).trim().slice(0, 120),
        description: (updates.description ?? existing.description).trim().slice(0, 1000),
        visibility: updates.visibility ?? existing.visibility,
        coverUrl: (updates.coverUrl ?? existing.coverUrl).slice(0, 800000),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `video_playlists/${playlistId}`);
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (!firebaseUser) return;
    const existing = myPlaylists.find(p => p.playlistId === playlistId);
    if (!existing || existing.ownerId !== firebaseUser.uid) {
      throw new Error('Удаление чужих плейлистов запрещено.');
    }

    try {
      await deleteDoc(doc(db, 'video_playlists', playlistId));
      if (activePlaylistId === playlistId) {
        setActivePlaylistId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `video_playlists/${playlistId}`);
    }
  };

  const toggleVideoInPlaylist = async (playlistId: string, video: MenderVideo) => {
    if (!firebaseUser) return;
    const existing = myPlaylists.find(p => p.playlistId === playlistId);
    if (!existing || existing.ownerId !== firebaseUser.uid) {
      throw new Error('Вы можете изменять только свои плейлисты.');
    }

    const hasVideo = existing.videoIds.includes(video.videoId);
    const nextVideoIds = hasVideo
      ? existing.videoIds.filter(id => id !== video.videoId)
      : [...existing.videoIds, video.videoId].slice(0, 100);

    const nextCover =
      existing.coverUrl || (!hasVideo && video.thumbnailUrl ? video.thumbnailUrl : existing.coverUrl);

    try {
      await updateDoc(doc(db, 'video_playlists', playlistId), {
        videoIds: nextVideoIds,
        coverUrl: (nextCover || '').slice(0, 800000),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `video_playlists/${playlistId}`);
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    try {
      await updateDoc(doc(db, 'users', uid, 'video_notifications', notificationId), {
        isRead: true,
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${uid}/video_notifications/${notificationId}`
      );
    }
  };

  const markAllNotificationsRead = async () => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const unread = videoNotifications.filter(n => !n.isRead);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'users', uid, 'video_notifications', n.notificationId), {
          isRead: true,
        });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/video_notifications`);
    }
  };

  return (
    <VideoContext.Provider
      value={{
        publicVideos,
        myVideos,
        allAccessibleVideos,
        videoLikesByMe,
        videoCommentsMap,
        publicPlaylists,
        myPlaylists,
        allAccessiblePlaylists,
        videoNotifications,
        unreadNotificationsCount,
        videoSubView,
        setVideoSubView,
        activeVideoId,
        activePlaylistId,
        selectedAuthorId,
        editingVideo,
        setEditingVideo,
        openVideoPlayer,
        openAuthorProfile,
        openUploadStudio,
        publishOrSaveVideo,
        updateVideoMetadata,
        deleteVideo,
        recordUniqueVideoView,
        toggleLikeVideo,
        subscribeToVideoComments,
        addVideoComment,
        toggleLikeVideoComment,
        deleteVideoComment,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        toggleVideoInPlaylist,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useVideo must be used within a VideoProvider');
  return ctx;
};
