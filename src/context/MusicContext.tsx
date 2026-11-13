import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
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
  MenderMusicTrack,
  MenderMusicPlaylist,
  MenderMusicAlbum,
  MenderMusicArtist,
  MusicRepeatMode,
  VisibilityType,
} from '../types';
import {
  BUILTIN_MUSIC_TRACKS,
  BUILTIN_MUSIC_ALBUMS,
  BUILTIN_MUSIC_ARTISTS,
  BUILTIN_MUSIC_COVERS,
  resolveSynthAudioUrl,
} from '../utils/musicAudioGenerator';
import {
  resolvePlayableMediaUrl,
  uploadAudioTrackWithProgress,
  uploadMediaFile,
  validateCoverImageFile,
} from '../utils/media';
import { sanitizeId } from '../utils/crypto';

export type MusicSubView =
  | 'home'
  | 'library'
  | 'search'
  | 'genres'
  | 'albums'
  | 'album_detail'
  | 'artists'
  | 'artist_detail'
  | 'playlists'
  | 'playlist_detail'
  | 'favorites'
  | 'history'
  | 'my_uploads'
  | 'upload';

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

interface MusicContextType {
  // Catalog
  allTracks: MenderMusicTrack[];
  uploadedTracks: MenderMusicTrack[];
  myUploadedTracks: MenderMusicTrack[];
  albums: MenderMusicAlbum[];
  artists: MenderMusicArtist[];
  playlists: MenderMusicPlaylist[];
  myPlaylists: MenderMusicPlaylist[];
  officialMenderPlaylist: MenderMusicPlaylist;
  favoriteTrackIds: Record<string, boolean>;
  favoriteTracks: MenderMusicTrack[];
  recentlyPlayedTracks: MenderMusicTrack[];
  // Navigation inside Mender Music
  musicSubView: MusicSubView;
  setMusicSubView: (view: MusicSubView) => void;
  selectedGenre: string;
  setSelectedGenre: (genre: string) => void;
  selectedAlbumId: string | null;
  selectedArtistId: string | null;
  selectedPlaylistId: string | null;
  openAlbum: (albumId: string) => void;
  openArtist: (artistId: string) => void;
  openPlaylist: (playlistId: string) => void;
  openUploadTrackStudio: () => void;
  // Audio Player State
  currentTrack: MenderMusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: MusicRepeatMode;
  queue: MenderMusicTrack[];
  isFullScreenPlayerOpen: boolean;
  setIsFullScreenPlayerOpen: (open: boolean) => void;
  // Audio Player Controls
  playTrack: (track: MenderMusicTrack, customQueue?: MenderMusicTrack[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pauseMusic: () => void;
  resumeMusic: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  addToQueue: (track: MenderMusicTrack) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  closePlayer: () => void;
  // Library & Playlists Actions
  toggleFavoriteTrack: (track: MenderMusicTrack) => Promise<void>;
  clearListeningHistory: () => void;
  createMusicPlaylist: (params: {
    title: string;
    description: string;
    visibility: VisibilityType;
    coverUrl?: string;
    initialTrackId?: string;
  }) => Promise<MenderMusicPlaylist>;
  deleteMusicPlaylist: (playlistId: string) => Promise<void>;
  toggleTrackInPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  // Upload & Management
  uploadMusicTrack: (params: {
    audioFile: File;
    coverFile?: File | null;
    coverUrl?: string;
    title: string;
    artist: string;
    albumTitle: string;
    genre: string;
    releaseYear: number;
    lyrics: string;
    visibility: VisibilityType;
    duration: number;
    onProgress?: (pct: number) => void;
  }) => Promise<MenderMusicTrack>;
  deleteUploadedTrack: (track: MenderMusicTrack) => Promise<void>;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, profile, isAuthReady } = useAuth();

  const [publicUploadedTracks, setPublicUploadedTracks] = useState<MenderMusicTrack[]>([]);
  const [myUploadedTracks, setMyUploadedTracks] = useState<MenderMusicTrack[]>([]);
  const [publicPlaylists, setPublicPlaylists] = useState<MenderMusicPlaylist[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<MenderMusicPlaylist[]>([]);

  const [favoriteTrackIds, setFavoriteTrackIds] = useState<Record<string, boolean>>({});
  const [localBuiltinStats, setLocalBuiltinStats] = useState<
    Record<string, { playsDelta: number; likesDelta: number }>
  >({});
  const [recentlyPlayedIds, setRecentlyPlayedIds] = useState<string[]>([]);

  // Navigation state inside Mender Music
  const [musicSubView, setMusicSubView] = useState<MusicSubView>('home');
  const [selectedGenre, setSelectedGenre] = useState<string>('Все жанры');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isFullScreenPlayerOpen, setIsFullScreenPlayerOpen] = useState(false);

  // Player state
  const [currentTrack, setCurrentTrack] = useState<MenderMusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const v = localStorage.getItem('mender_music_volume');
      return v ? Math.max(0, Math.min(1, Number(v))) : 0.85;
    } catch {
      return 0.85;
    }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<MusicRepeatMode>('off');
  const [queue, setQueue] = useState<MenderMusicTrack[]>(BUILTIN_MUSIC_TRACKS);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackReqIdRef = useRef<number>(0);
  const checkedTrackLikesRef = useRef<Set<string>>(new Set());

  // Load user-specific favorites, history, and built-in track counters from localStorage
  useEffect(() => {
    const uid = firebaseUser?.uid || 'guest';
    try {
      const savedFavs = localStorage.getItem(`mender_music_favs_${uid}`);
      if (savedFavs) {
        setFavoriteTrackIds(JSON.parse(savedFavs));
      } else {
        setFavoriteTrackIds({});
      }
      const savedHist = localStorage.getItem(`mender_music_history_${uid}`);
      if (savedHist) {
        setRecentlyPlayedIds(JSON.parse(savedHist));
      } else {
        setRecentlyPlayedIds([]);
      }
      const savedStats = localStorage.getItem(`mender_music_builtin_stats_${uid}`);
      if (savedStats) {
        setLocalBuiltinStats(JSON.parse(savedStats));
      }
    } catch {
      // ignore storage errors
    }
  }, [firebaseUser?.uid]);

  // Subscribe to Firestore music tracks and playlists
  useEffect(() => {
    if (!isAuthReady || !firebaseUser || !profile) {
      setPublicUploadedTracks([]);
      setMyUploadedTracks([]);
      setPublicPlaylists([]);
      setMyPlaylists([]);
      checkedTrackLikesRef.current.clear();
      return;
    }

    const uid = firebaseUser.uid;

    // 1. Public tracks in Firestore
    const pubTracksQuery = query(
      collection(db, 'mender_music_tracks'),
      where('visibility', '==', 'public')
    );
    const unsubPubTracks = onSnapshot(
      pubTracksQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as MenderMusicTrack)
          .sort((a, b) => extractTsMs(b.createdAt, b.trackId) - extractTsMs(a.createdAt, a.trackId));
        setPublicUploadedTracks(list);

        list.forEach(t => {
          if (!checkedTrackLikesRef.current.has(t.trackId)) {
            checkedTrackLikesRef.current.add(t.trackId);
            getDoc(doc(db, 'mender_music_tracks', t.trackId, 'likes', uid))
              .then(likeSnap => {
                if (likeSnap.exists()) {
                  setFavoriteTrackIds(prev => ({ ...prev, [t.trackId]: true }));
                }
              })
              .catch(() => {});
          }
        });
      },
      err => handleFirestoreError(err, OperationType.LIST, 'mender_music_tracks (public)')
    );

    // 2. User's own uploaded tracks
    const myTracksQuery = query(
      collection(db, 'mender_music_tracks'),
      where('uploaderId', '==', uid)
    );
    const unsubMyTracks = onSnapshot(
      myTracksQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as MenderMusicTrack)
          .sort((a, b) => extractTsMs(b.createdAt, b.trackId) - extractTsMs(a.createdAt, a.trackId));
        setMyUploadedTracks(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'mender_music_tracks (uploaderId)')
    );

    // 3. Public music playlists
    const pubPlaylistsQuery = query(
      collection(db, 'mender_music_playlists'),
      where('visibility', '==', 'public')
    );
    const unsubPubPlaylists = onSnapshot(
      pubPlaylistsQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as MenderMusicPlaylist)
          .sort(
            (a, b) =>
              extractTsMs(b.updatedAt, b.playlistId) - extractTsMs(a.updatedAt, a.playlistId)
          );
        setPublicPlaylists(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'mender_music_playlists (public)')
    );

    // 4. User's own music playlists
    const myPlaylistsQuery = query(
      collection(db, 'mender_music_playlists'),
      where('ownerId', '==', uid)
    );
    const unsubMyPlaylists = onSnapshot(
      myPlaylistsQuery,
      snap => {
        const list = snap.docs
          .map(d => d.data() as MenderMusicPlaylist)
          .sort(
            (a, b) =>
              extractTsMs(b.updatedAt, b.playlistId) - extractTsMs(a.updatedAt, a.playlistId)
          );
        setMyPlaylists(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'mender_music_playlists (ownerId)')
    );

    return () => {
      unsubPubTracks();
      unsubMyTracks();
      unsubPubPlaylists();
      unsubMyPlaylists();
    };
  }, [isAuthReady, firebaseUser, profile]);

  // Combine uploaded tracks and built-in tracks
  const uploadedTracks = useMemo(() => {
    const map = new Map<string, MenderMusicTrack>();
    publicUploadedTracks.forEach(t => map.set(t.trackId, t));
    myUploadedTracks.forEach(t => map.set(t.trackId, t));
    return Array.from(map.values()).sort(
      (a, b) => extractTsMs(b.createdAt, b.trackId) - extractTsMs(a.createdAt, a.trackId)
    );
  }, [publicUploadedTracks, myUploadedTracks]);

  const allTracks = useMemo(() => {
    const builtinWithStats = BUILTIN_MUSIC_TRACKS.map(t => {
      const delta = localBuiltinStats[t.trackId];
      if (!delta) return t;
      return {
        ...t,
        playsCount: Math.max(0, t.playsCount + (delta.playsDelta || 0)),
        likesCount: Math.max(0, t.likesCount + (delta.likesDelta || 0)),
      };
    });
    return [...uploadedTracks, ...builtinWithStats];
  }, [uploadedTracks, localBuiltinStats]);

  // Keep currentTrack metadata synced if likes/plays update
  useEffect(() => {
    if (!currentTrack) return;
    const updated = allTracks.find(t => t.trackId === currentTrack.trackId);
    if (updated && (updated.likesCount !== currentTrack.likesCount || updated.playsCount !== currentTrack.playsCount)) {
      setCurrentTrack(updated);
    }
  }, [allTracks, currentTrack]);

  // Dynamic albums & artists including user uploads
  const albums = useMemo(() => {
    const list: MenderMusicAlbum[] = BUILTIN_MUSIC_ALBUMS.map(a => ({ ...a, trackIds: [...a.trackIds] }));
    const byId = new Map<string, MenderMusicAlbum>(list.map(a => [a.albumId, a]));

    uploadedTracks.forEach(t => {
      const existing = byId.get(t.albumId);
      if (existing) {
        if (!existing.trackIds.includes(t.trackId)) {
          existing.trackIds.unshift(t.trackId);
        }
      } else {
        const newAlb: MenderMusicAlbum = {
          albumId: t.albumId,
          title: t.albumTitle || 'Сингл',
          artist: t.artist,
          artistId: t.artistId,
          genre: t.genre,
          releaseYear: t.releaseYear || 2026,
          coverUrl: t.coverUrl || BUILTIN_MUSIC_COVERS.aurora,
          description: `Альбом / релиз исполнителя ${t.artist} в Mender Music.`,
          trackIds: [t.trackId],
        };
        byId.set(newAlb.albumId, newAlb);
        list.unshift(newAlb);
      }
    });
    return list;
  }, [uploadedTracks]);

  const artists = useMemo(() => {
    const list: MenderMusicArtist[] = [...BUILTIN_MUSIC_ARTISTS];
    const byId = new Map<string, MenderMusicArtist>(list.map(a => [a.artistId, a]));

    uploadedTracks.forEach(t => {
      if (!byId.has(t.artistId)) {
        const newArt: MenderMusicArtist = {
          artistId: t.artistId,
          name: t.artist,
          genre: t.genre,
          avatarUrl: t.coverUrl || t.uploaderAvatar || BUILTIN_MUSIC_COVERS.aurora,
          coverBannerUrl: t.coverUrl || BUILTIN_MUSIC_COVERS.aurora,
          bio: `Исполнитель на платформе Mender Music (@${t.uploaderUsername}).`,
          monthlyListeners: Math.max(120, (t.playsCount || 1) * 45),
          verified: true,
        };
        byId.set(newArt.artistId, newArt);
        list.push(newArt);
      }
    });
    return list;
  }, [uploadedTracks]);

  const officialMenderPlaylist: MenderMusicPlaylist = useMemo(
    () => ({
      playlistId: 'mpl_mender_official',
      ownerId: 'mender_official',
      ownerName: 'Mender',
      ownerUsername: 'mender_official',
      ownerAvatar: BUILTIN_MUSIC_COVERS.aurora,
      title: 'Общий плейлист от Mender',
      description:
        'Единый официальный плейлист Mender Music: фирменные мелодии Mender и все публичные треки сообщества.',
      visibility: 'public',
      trackIds: allTracks.map(t => t.trackId),
      coverUrl: BUILTIN_MUSIC_COVERS.aurora,
    }),
    [allTracks]
  );

  const playlists = useMemo(() => {
    const map = new Map<string, MenderMusicPlaylist>();
    map.set(officialMenderPlaylist.playlistId, officialMenderPlaylist);
    publicPlaylists.forEach(p => map.set(p.playlistId, p));
    myPlaylists.forEach(p => map.set(p.playlistId, p));
    return Array.from(map.values());
  }, [officialMenderPlaylist, publicPlaylists, myPlaylists]);

  const favoriteTracks = useMemo(
    () => allTracks.filter(t => Boolean(favoriteTrackIds[t.trackId])),
    [allTracks, favoriteTrackIds]
  );

  const recentlyPlayedTracks = useMemo(() => {
    const trackMap = new Map(allTracks.map(t => [t.trackId, t]));
    return recentlyPlayedIds
      .map(id => trackMap.get(id))
      .filter((t): t is MenderMusicTrack => Boolean(t));
  }, [allTracks, recentlyPlayedIds]);

  const recordTrackPlay = useCallback(
    async (track: MenderMusicTrack) => {
      const uid = firebaseUser?.uid || 'guest';
      setRecentlyPlayedIds(prev => {
        const next = [track.trackId, ...prev.filter(id => id !== track.trackId)].slice(0, 40);
        try {
          localStorage.setItem(`mender_music_history_${uid}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      if (track.isBuiltIn) {
        setLocalBuiltinStats(prev => {
          const cur = prev[track.trackId] || { playsDelta: 0, likesDelta: 0 };
          const next = {
            ...prev,
            [track.trackId]: { ...cur, playsDelta: cur.playsDelta + 1 },
          };
          try {
            localStorage.setItem(`mender_music_builtin_stats_${uid}`, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      } else if (firebaseUser) {
        try {
          await updateDoc(doc(db, 'mender_music_tracks', track.trackId), {
            playsCount: (track.playsCount || 0) + 1,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // ignore permission or offline delay
        }
      }
    },
    [firebaseUser]
  );

  // Initialize the persistent HTML5 Audio element
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = volume;
      audioRef.current = audio;
    }
  }, []);

  const resolveTrackAudioSrc = useCallback(async (track: MenderMusicTrack): Promise<string> => {
    if (track.audioUrl.startsWith('synth://') || track.synthPreset) {
      return resolveSynthAudioUrl(track.synthPreset || track.audioUrl);
    }
    return await resolvePlayableMediaUrl(track.audioUrl);
  }, []);

  const playTrack = useCallback(
    async (track: MenderMusicTrack, customQueue?: MenderMusicTrack[]) => {
      const audio = audioRef.current;
      if (!audio) return;

      const reqId = ++playbackReqIdRef.current;

      if (customQueue && customQueue.length > 0) {
        if (isShuffle) {
          const others = customQueue.filter(t => t.trackId !== track.trackId);
          for (let i = others.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [others[i], others[j]] = [others[j], others[i]];
          }
          setQueue([track, ...others]);
        } else {
          setQueue(customQueue);
        }
      } else if (!queue.some(t => t.trackId === track.trackId)) {
        setQueue(prev => [track, ...prev]);
      }

      // If clicking the already loaded track, toggle play/pause or restart if ended
      if (currentTrack?.trackId === track.trackId && audio.src) {
        if (audio.paused) {
          try {
            await audio.play();
            if (reqId === playbackReqIdRef.current) {
              setIsPlaying(true);
            }
          } catch {
            setIsPlaying(false);
          }
        } else {
          audio.pause();
          setIsPlaying(false);
        }
        return;
      }

      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(track.duration || 36);

      const playableSrc = await resolveTrackAudioSrc(track);
      if (!playableSrc || reqId !== playbackReqIdRef.current) return;

      audio.pause();
      audio.src = playableSrc;
      audio.currentTime = 0;
      audio.volume = isMuted ? 0 : volume;

      try {
        await audio.play();
        if (reqId !== playbackReqIdRef.current) {
          audio.pause();
          return;
        }
        setIsPlaying(true);
        void recordTrackPlay(track);
      } catch {
        setIsPlaying(false);
      }
    },
    [currentTrack, isMuted, isShuffle, queue, recordTrackPlay, resolveTrackAudioSrc, volume]
  );

  const pauseMusic = useCallback(() => {
    ++playbackReqIdRef.current;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    setIsPlaying(false);
  }, []);

  const resumeMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      const first = queue[0] || allTracks[0];
      if (first) {
        await playTrack(first, allTracks);
      }
      return;
    }

    const reqId = ++playbackReqIdRef.current;
    if (!audio.src) {
      const src = await resolveTrackAudioSrc(currentTrack);
      if (reqId !== playbackReqIdRef.current) return;
      audio.src = src;
    }

    audio.volume = isMuted ? 0 : volume;
    try {
      await audio.play();
      if (reqId !== playbackReqIdRef.current) {
        audio.pause();
        return;
      }
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [allTracks, currentTrack, isMuted, playTrack, queue, resolveTrackAudioSrc, volume]);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      const first = queue[0] || allTracks[0];
      if (first) {
        await playTrack(first, allTracks);
      }
      return;
    }

    if (isPlaying && !audio.paused) {
      pauseMusic();
    } else {
      await resumeMusic();
    }
  }, [allTracks, currentTrack, isPlaying, pauseMusic, playTrack, queue, resumeMusic]);

  const nextTrack = useCallback(async () => {
    const activeList = queue.length > 0 ? queue : allTracks;
    if (activeList.length === 0) return;

    if (!currentTrack) {
      await playTrack(activeList[0], activeList);
      return;
    }

    const idx = activeList.findIndex(t => t.trackId === currentTrack.trackId);
    if (idx < 0) {
      await playTrack(activeList[0], activeList);
      return;
    }

    if (idx + 1 < activeList.length) {
      const nextItem = activeList[idx + 1];
      const audio = audioRef.current;
      if (audio) {
        const reqId = ++playbackReqIdRef.current;
        const src = await resolveTrackAudioSrc(nextItem);
        if (reqId !== playbackReqIdRef.current) return;
        setCurrentTrack(nextItem);
        setCurrentTime(0);
        setDuration(nextItem.duration || 36);
        audio.src = src;
        audio.currentTime = 0;
        try {
          await audio.play();
          if (reqId !== playbackReqIdRef.current) {
            audio.pause();
            return;
          }
          setIsPlaying(true);
          void recordTrackPlay(nextItem);
        } catch {
          setIsPlaying(false);
        }
      }
    } else if (repeatMode === 'all') {
      const firstItem = activeList[0];
      const audio = audioRef.current;
      if (audio && firstItem) {
        const reqId = ++playbackReqIdRef.current;
        const src = await resolveTrackAudioSrc(firstItem);
        if (reqId !== playbackReqIdRef.current) return;
        setCurrentTrack(firstItem);
        setCurrentTime(0);
        setDuration(firstItem.duration || 36);
        audio.src = src;
        audio.currentTime = 0;
        try {
          await audio.play();
          if (reqId !== playbackReqIdRef.current) {
            audio.pause();
            return;
          }
          setIsPlaying(true);
          void recordTrackPlay(firstItem);
        } catch {
          setIsPlaying(false);
        }
      }
    } else {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [allTracks, currentTrack, playTrack, queue, recordTrackPlay, repeatMode, resolveTrackAudioSrc]);

  const prevTrack = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const activeList = queue.length > 0 ? queue : allTracks;
    if (activeList.length === 0 || !currentTrack) return;

    const idx = activeList.findIndex(t => t.trackId === currentTrack.trackId);
    const targetIdx = idx > 0 ? idx - 1 : activeList.length - 1;
    const prevItem = activeList[targetIdx];
    if (!prevItem || !audio) return;

    const reqId = ++playbackReqIdRef.current;
    const src = await resolveTrackAudioSrc(prevItem);
    if (reqId !== playbackReqIdRef.current) return;
    setCurrentTrack(prevItem);
    setCurrentTime(0);
    setDuration(prevItem.duration || 36);
    audio.src = src;
    audio.currentTime = 0;
    try {
      await audio.play();
      if (reqId !== playbackReqIdRef.current) {
        audio.pause();
        return;
      }
      setIsPlaying(true);
      void recordTrackPlay(prevItem);
    } catch {
      setIsPlaying(false);
    }
  }, [allTracks, currentTrack, queue, recordTrackPlay, resolveTrackAudioSrc]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, duration || audio.duration || 0));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    try {
      localStorage.setItem('mender_music_volume', String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      setIsMuted(false);
      audio.volume = volume > 0 ? volume : 0.75;
    } else {
      setIsMuted(true);
      audio.volume = 0;
    }
  }, [isMuted, volume]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => {
      const nextShuffle = !prev;
      if (nextShuffle && queue.length > 1) {
        const current = currentTrack;
        const others = queue.filter(t => t.trackId !== current?.trackId);
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        setQueue(current ? [current, ...others] : others);
      } else if (!nextShuffle) {
        setQueue(allTracks);
      }
      return nextShuffle;
    });
  }, [allTracks, currentTrack, queue]);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode(prev => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  const addToQueue = useCallback((track: MenderMusicTrack) => {
    setQueue(prev => {
      if (prev.some(t => t.trackId === track.trackId)) return prev;
      return [...prev, track];
    });
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue(prev => prev.filter(t => t.trackId !== trackId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue(currentTrack ? [currentTrack] : []);
  }, [currentTrack]);

  const closePlayer = useCallback(() => {
    ++playbackReqIdRef.current;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch {
        // ignore
      }
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setIsFullScreenPlayerOpen(false);
    setCurrentTrack(null);
  }, []);

  // Attach HTML5 Audio listeners for timeupdate, loadedmetadata, and ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if ('mediaSession' in navigator && typeof navigator.mediaSession.setPositionState === 'function') {
        const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
        if (dur > 0 && audio.currentTime <= dur) {
          try {
            navigator.mediaSession.setPositionState({
              duration: dur,
              playbackRate: audio.playbackRate || 1,
              position: audio.currentTime,
            });
          } catch {
            // ignore
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
      } else {
        void nextTrack();
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [duration, nextTrack, repeatMode]);

  // Lock screen & system media controls via MediaSession API
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.albumTitle || 'Mender Music',
        artwork: currentTrack.coverUrl
          ? [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/png' }]
          : [],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        void resumeMusic();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        pauseMusic();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        closePlayer();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        void prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        void nextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', details => {
        if (typeof details.seekTime === 'number') {
          seekTo(details.seekTime);
        }
      });
    } catch {
      // ignore unsupported MediaSession handlers
    }
  }, [closePlayer, currentTrack, isPlaying, nextTrack, pauseMusic, prevTrack, resumeMusic, seekTo]);

  // Toggle favorite / like on a track
  const toggleFavoriteTrack = useCallback(
    async (track: MenderMusicTrack) => {
      const uid = firebaseUser?.uid || 'guest';
      const isFav = Boolean(favoriteTrackIds[track.trackId]);

      setFavoriteTrackIds(prev => {
        const next = { ...prev, [track.trackId]: !isFav };
        try {
          localStorage.setItem(`mender_music_favs_${uid}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      if (track.isBuiltIn) {
        setLocalBuiltinStats(prev => {
          const cur = prev[track.trackId] || { playsDelta: 0, likesDelta: 0 };
          const next = {
            ...prev,
            [track.trackId]: {
              ...cur,
              likesDelta: cur.likesDelta + (isFav ? -1 : 1),
            },
          };
          try {
            localStorage.setItem(`mender_music_builtin_stats_${uid}`, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        return;
      }

      if (!firebaseUser) return;

      const likeRef = doc(db, 'mender_music_tracks', track.trackId, 'likes', firebaseUser.uid);
      const trackRef = doc(db, 'mender_music_tracks', track.trackId);

      try {
        const batch = writeBatch(db);
        if (isFav) {
          batch.delete(likeRef);
          batch.update(trackRef, {
            likesCount: Math.max(0, (track.likesCount || 1) - 1),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(likeRef, {
            trackId: track.trackId,
            userId: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
          batch.update(trackRef, {
            likesCount: (track.likesCount || 0) + 1,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mender_music_tracks/${track.trackId}/likes`);
      }
    },
    [favoriteTrackIds, firebaseUser]
  );

  const clearListeningHistory = useCallback(() => {
    const uid = firebaseUser?.uid || 'guest';
    setRecentlyPlayedIds([]);
    try {
      localStorage.removeItem(`mender_music_history_${uid}`);
    } catch {
      // ignore
    }
  }, [firebaseUser?.uid]);

  // Create a playlist in Firestore
  const createMusicPlaylist = useCallback(
    async (params: {
      title: string;
      description: string;
      visibility: VisibilityType;
      coverUrl?: string;
      initialTrackId?: string;
    }): Promise<MenderMusicPlaylist> => {
      if (!firebaseUser || !profile) {
        throw new Error('Необходима авторизация');
      }
      const playlistId = sanitizeId(
        `mpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      );
      const trackIds = params.initialTrackId ? [params.initialTrackId] : [];
      const coverUrl =
        (params.coverUrl || BUILTIN_MUSIC_COVERS.aurora).slice(0, 900000);

      const newPl: MenderMusicPlaylist = {
        playlistId,
        ownerId: firebaseUser.uid,
        ownerName: profile.displayName.slice(0, 80),
        ownerUsername: profile.username.slice(0, 40),
        ownerAvatar: (profile.avatarUrl || '').slice(0, 2000),
        title: params.title.trim().slice(0, 120) || 'Мой плейлист',
        description: params.description.trim().slice(0, 1000),
        visibility: params.visibility,
        trackIds,
        coverUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'mender_music_playlists', playlistId), newPl);
        return newPl;
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `mender_music_playlists/${playlistId}`
        );
        throw err;
      }
    },
    [firebaseUser, profile]
  );

  const deleteMusicPlaylist = useCallback(
    async (playlistId: string) => {
      try {
        await deleteDoc(doc(db, 'mender_music_playlists', playlistId));
        if (selectedPlaylistId === playlistId) {
          setSelectedPlaylistId(null);
          setMusicSubView('playlists');
        }
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `mender_music_playlists/${playlistId}`
        );
      }
    },
    [selectedPlaylistId]
  );

  const toggleTrackInPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      const target = playlists.find(p => p.playlistId === playlistId);
      if (!target) return;

      const exists = target.trackIds.includes(trackId);
      const nextTrackIds = exists
        ? target.trackIds.filter(id => id !== trackId)
        : [...target.trackIds, trackId].slice(0, 500);

      try {
        await updateDoc(doc(db, 'mender_music_playlists', playlistId), {
          trackIds: nextTrackIds,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `mender_music_playlists/${playlistId}`
        );
      }
    },
    [playlists]
  );

  // Upload a new audio track to Storage/IndexedDB and save metadata to Firestore
  const uploadMusicTrack = useCallback(
    async (params: {
      audioFile: File;
      coverFile?: File | null;
      coverUrl?: string;
      title: string;
      artist: string;
      albumTitle: string;
      genre: string;
      releaseYear: number;
      lyrics: string;
      visibility: VisibilityType;
      duration: number;
      onProgress?: (pct: number) => void;
    }): Promise<MenderMusicTrack> => {
      if (!firebaseUser || !profile) {
        throw new Error('Необходима авторизация для загрузки музыки');
      }

      const trackId = sanitizeId(
        `mtrk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      );

      let finalCoverUrl = params.coverUrl || BUILTIN_MUSIC_COVERS.aurora;
      if (params.coverFile) {
        const coverErr = validateCoverImageFile(params.coverFile);
        if (coverErr) throw new Error(coverErr);
        finalCoverUrl = await uploadMediaFile(
          params.coverFile,
          firebaseUser.uid,
          'posts',
          params.coverFile.name,
          450000
        );
      }

      const audioUrl = await uploadAudioTrackWithProgress(
        params.audioFile,
        firebaseUser.uid,
        trackId,
        pct => params.onProgress?.(pct)
      );

      const cleanTitle = params.title.trim().slice(0, 140) || 'Без названия';
      const cleanArtist =
        params.artist.trim().slice(0, 100) || profile.displayName || 'Исполнитель Mender';
      const cleanAlbum = params.albumTitle.trim().slice(0, 120) || 'Сингл';
      const artistId = sanitizeId(
        `art_${cleanArtist.toLowerCase().replace(/[^a-z0-9]/g, '_') || firebaseUser.uid}`
      );
      const albumId = sanitizeId(
        `alb_${cleanAlbum.toLowerCase().replace(/[^a-z0-9]/g, '_') || trackId}`
      );

      const newTrack: MenderMusicTrack = {
        trackId,
        uploaderId: firebaseUser.uid,
        uploaderName: profile.displayName.slice(0, 80),
        uploaderUsername: profile.username.slice(0, 40),
        uploaderAvatar: (profile.avatarUrl || '').slice(0, 2000),
        title: cleanTitle,
        artist: cleanArtist,
        artistId,
        albumTitle: cleanAlbum,
        albumId,
        genre: params.genre.slice(0, 60) || 'Электроника',
        releaseYear: Math.min(2100, Math.max(1900, Math.round(params.releaseYear || 2026))),
        audioUrl: audioUrl.slice(0, 1950000),
        coverUrl: finalCoverUrl.slice(0, 950000),
        duration: Math.max(1, Math.round(params.duration || 180)),
        sizeBytes: Math.max(0, params.audioFile.size || 0),
        mimeType: (params.audioFile.type || 'audio/mpeg').slice(0, 64),
        visibility: params.visibility,
        playsCount: 0,
        likesCount: 0,
        lyrics: (params.lyrics || '').trim().slice(0, 5000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'mender_music_tracks', trackId), newTrack);
        return newTrack;
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `mender_music_tracks/${trackId}`
        );
        throw err;
      }
    },
    [firebaseUser, profile]
  );

  const deleteUploadedTrack = useCallback(
    async (track: MenderMusicTrack) => {
      if (track.isBuiltIn) return;
      try {
        if (currentTrack?.trackId === track.trackId) {
          closePlayer();
        }
        await deleteDoc(doc(db, 'mender_music_tracks', track.trackId));
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `mender_music_tracks/${track.trackId}`
        );
      }
    },
    [closePlayer, currentTrack]
  );

  const openAlbum = useCallback((albumId: string) => {
    setSelectedAlbumId(albumId);
    setMusicSubView('album_detail');
  }, []);

  const openArtist = useCallback((artistId: string) => {
    setSelectedArtistId(artistId);
    setMusicSubView('artist_detail');
  }, []);

  const openPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setMusicSubView('playlist_detail');
  }, []);

  const openUploadTrackStudio = useCallback(() => {
    setMusicSubView('upload');
  }, []);

  return (
    <MusicContext.Provider
      value={{
        allTracks,
        uploadedTracks,
        myUploadedTracks,
        albums,
        artists,
        playlists,
        myPlaylists,
        officialMenderPlaylist,
        favoriteTrackIds,
        favoriteTracks,
        recentlyPlayedTracks,
        musicSubView,
        setMusicSubView,
        selectedGenre,
        setSelectedGenre,
        selectedAlbumId,
        selectedArtistId,
        selectedPlaylistId,
        openAlbum,
        openArtist,
        openPlaylist,
        openUploadTrackStudio,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        queue,
        isFullScreenPlayerOpen,
        setIsFullScreenPlayerOpen,
        playTrack,
        togglePlayPause,
        pauseMusic,
        resumeMusic,
        nextTrack,
        prevTrack,
        seekTo,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeatMode,
        addToQueue,
        removeFromQueue,
        clearQueue,
        closePlayer,
        toggleFavoriteTrack,
        clearListeningHistory,
        createMusicPlaylist,
        deleteMusicPlaylist,
        toggleTrackInPlaylist,
        uploadMusicTrack,
        deleteUploadedTrack,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = (): MusicContextType => {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return ctx;
};
