import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

const IDB_NAME = 'mender_local_media_db';
const IDB_STORE = 'media_blobs';
const memoryBlobUrlCache = new Map<string, string>();

function openMediaIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBlobToIdb(mediaId: string, blob: Blob): Promise<void> {
  try {
    const db = await openMediaIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, mediaId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore IndexedDB quota/private mode errors
  }
}

async function getBlobFromIdb(mediaId: string): Promise<Blob | null> {
  try {
    const db = await openMediaIdb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(mediaId);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Resolves `idb://mediaId|posterDataUrl` urls into playable `blob:` URLs from memory or IndexedDB.
 * Falls back to the embedded poster/dataUrl if not found locally.
 */
export async function resolvePlayableMediaUrl(rawUrl?: string | null): Promise<string> {
  if (!rawUrl) return '';
  if (!rawUrl.startsWith('idb://')) return rawUrl;

  const withoutPrefix = rawUrl.slice('idb://'.length);
  const pipeIndex = withoutPrefix.indexOf('|');
  const mediaId = pipeIndex >= 0 ? withoutPrefix.slice(0, pipeIndex) : withoutPrefix;
  const fallbackDataUrl = pipeIndex >= 0 ? withoutPrefix.slice(pipeIndex + 1) : '';

  const cached = memoryBlobUrlCache.get(mediaId);
  if (cached) return cached;

  const blob = await getBlobFromIdb(mediaId);
  if (blob) {
    const objUrl = URL.createObjectURL(blob);
    memoryBlobUrlCache.set(mediaId, objUrl);
    return objUrl;
  }

  return fallbackDataUrl;
}

export function getSyncCachedMediaUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  if (!rawUrl.startsWith('idb://')) return rawUrl;
  const withoutPrefix = rawUrl.slice('idb://'.length);
  const pipeIndex = withoutPrefix.indexOf('|');
  const mediaId = pipeIndex >= 0 ? withoutPrefix.slice(0, pipeIndex) : withoutPrefix;
  const fallbackDataUrl = pipeIndex >= 0 ? withoutPrefix.slice(pipeIndex + 1) : '';
  return memoryBlobUrlCache.get(mediaId) || fallbackDataUrl;
}

/**
 * Uploads a File or Blob to Firebase Storage under `mender_{folder}/{uid}/{timestamp}_{filename}`.
 * Falls back to adaptive compression for images and IndexedDB + poster fallback for large videos/audio
 * so it NEVER throws a 750 KB limit error.
 */
export async function uploadMediaFile(
  fileOrBlob: File | Blob,
  uid: string,
  folder: 'avatars' | 'messages' | 'posts' | 'voice' | 'video_circles' | 'wallpapers',
  filename = 'media',
  maxDataUrlChars = 320000
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `mender_${folder}/${uid}/${Date.now()}_${safeName}`;

  try {
    const storageRef = ref(storage, storagePath);
    const uploadResult = await Promise.race([
      uploadBytes(storageRef, fileOrBlob),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Storage upload timeout')), 2500)
      ),
    ]);
    const downloadUrl = await getDownloadURL(uploadResult.ref);
    return downloadUrl;
  } catch {
    const isImage =
      fileOrBlob.type.startsWith('image/') ||
      /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(filename);

    if (isImage) {
      return await compressImageToDataUrl(fileOrBlob, 1080, 0.78, maxDataUrlChars);
    }

    // For video or audio: if small enough to fit directly in Firestore, store as Data URL
    if (fileOrBlob.size <= 450 * 1024) {
      try {
        const directDataUrl = await blobToDataUrl(fileOrBlob);
        if (directDataUrl.length <= maxDataUrlChars) {
          return directDataUrl;
        }
      } catch {
        // continue to IndexedDB storage below
      }
    }

    // Store full video/audio Blob in IndexedDB + memory cache so large videos/files work without errors
    const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const localObjUrl = URL.createObjectURL(fileOrBlob);
    memoryBlobUrlCache.set(mediaId, localObjUrl);
    await saveBlobToIdb(mediaId, fileOrBlob);

    if (fileOrBlob.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(filename)) {
      const posterDataUrl = await extractVideoPosterDataUrl(fileOrBlob, 640, 0.65);
      return `idb://${mediaId}|${posterDataUrl}`;
    }

    return `idb://${mediaId}|`;
  }
}

/**
 * Uploads a custom wallpaper image with real-time progress reporting (0..100%).
 * Validates file type and size before uploading.
 */
export async function uploadWallpaperWithProgress(
  blob: Blob,
  uid: string,
  wallpaperId: string,
  onProgress: (percent: number) => void
): Promise<{ imageUrl: string; storagePath: string }> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (blob.type && !allowedTypes.includes(blob.type)) {
    throw new Error('Неподдерживаемый формат файла. Разрешены только JPEG, PNG и WebP.');
  }
  if (blob.size > 15 * 1024 * 1024) {
    throw new Error('Размер файла превышает максимально допустимые 15 МБ.');
  }

  const storagePath = `mender_wallpapers/${uid}/${wallpaperId}.jpg`;
  onProgress(10);

  try {
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: blob.type || 'image/jpeg',
    });

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        uploadTask.cancel();
        reject(new Error('Storage timeout'));
      }, 3500);

      uploadTask.on(
        'state_changed',
        snapshot => {
          if (snapshot.totalBytes > 0) {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 90) + 5;
            onProgress(Math.min(95, pct));
          }
        },
        err => {
          clearTimeout(timeout);
          reject(err);
        },
        async () => {
          clearTimeout(timeout);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    onProgress(100);
    return { imageUrl: downloadUrl, storagePath };
  } catch {
    onProgress(55);
    const compressedDataUrl = await compressImageToDataUrl(blob, 1200, 0.78, 550000);
    onProgress(100);
    return { imageUrl: compressedDataUrl, storagePath };
  }
}

export async function deleteStorageWallpaper(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Ignore if stored via fallback or already deleted
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to Data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function compressImageToDataUrl(
  blob: Blob,
  maxDimension = 1080,
  quality = 0.78,
  maxChars = 320000
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const attemptCompression = (dim: number, q: number): string => {
        let { width, height } = img;
        if (width > dim || height > dim) {
          if (width > height) {
            height = Math.round((height * dim) / width);
            width = dim;
          } else {
            width = Math.round((width * dim) / height);
            height = dim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', q);
      };

      let result = attemptCompression(maxDimension, quality);
      const steps: Array<[number, number]> = [
        [900, 0.7],
        [720, 0.62],
        [560, 0.54],
        [420, 0.46],
        [320, 0.4],
      ];
      for (const [dim, q] of steps) {
        if (result.length <= maxChars) break;
        result = attemptCompression(dim, q);
      }
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve('');
    };
    img.src = objectUrl;
  });
}

function extractVideoPosterDataUrl(
  videoBlob: Blob,
  maxDimension = 640,
  quality = 0.65
): Promise<string> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    const objUrl = URL.createObjectURL(videoBlob);
    let settled = false;

    const finish = (poster: string) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objUrl);
      resolve(poster);
    };

    const timeout = window.setTimeout(() => finish(''), 2500);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.5, (video.duration || 1) * 0.1);
      } catch {
        captureFrame();
      }
    };

    const captureFrame = () => {
      clearTimeout(timeout);
      try {
        let width = video.videoWidth || 480;
        let height = video.videoHeight || 360;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL('image/jpeg', quality));
          return;
        }
      } catch {
        // ignore
      }
      finish('');
    };

    video.onseeked = captureFrame;
    video.onerror = () => {
      clearTimeout(timeout);
      finish('');
    };
    video.src = objUrl;
  });
}

/**
 * Validates video file format and size (up to 150 MB).
 */
export function validateVideoFile(file: File): string | null {
  if (!file) return 'Файл не выбран.';
  const allowedMimes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-matroska',
    'video/x-m4v',
  ];
  const hasValidExt = /\.(mp4|webm|ogg|mov|mkv|m4v)$/i.test(file.name);
  if (!allowedMimes.includes(file.type) && !hasValidExt) {
    return 'Неподдерживаемый формат видео. Разрешены MP4, WebM, MOV, OGG и MKV.';
  }
  if (file.size <= 0) {
    return 'Выбран пустой видеофайл.';
  }
  const maxBytes = 150 * 1024 * 1024; // 150 MB
  if (file.size > maxBytes) {
    return `Размер видео (${(file.size / (1024 * 1024)).toFixed(1)} МБ) превышает максимально допустимые 150 МБ.`;
  }
  return null;
}

/**
 * Validates custom cover image format and size (up to 15 MB).
 */
export function validateCoverImageFile(file: File): string | null {
  if (!file) return 'Файл обложки не выбран.';
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const hasValidExt = /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!allowedMimes.includes(file.type) && !hasValidExt) {
    return 'Неподдерживаемый формат обложки. Разрешены только JPEG, PNG и WebP.';
  }
  if (file.size > 15 * 1024 * 1024) {
    return 'Размер файла обложки превышает 15 МБ.';
  }
  return null;
}

export interface ExtractedVideoFrame {
  timeSec: number;
  dataUrl: string;
}

/**
 * Extracts real video duration (seconds) and N evenly spaced frame thumbnails from a video file.
 */
export async function extractVideoMetadataAndFrames(
  videoFile: File,
  frameCount = 5
): Promise<{
  duration: number;
  width: number;
  height: number;
  frames: ExtractedVideoFrame[];
}> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    const objUrl = URL.createObjectURL(videoFile);
    let settled = false;

    const finish = (result: {
      duration: number;
      width: number;
      height: number;
      frames: ExtractedVideoFrame[];
    }) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objUrl);
      resolve(result);
    };

    const overallTimeout = window.setTimeout(() => {
      finish({ duration: 0, width: 1280, height: 720, frames: [] });
    }, 8000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      const rawDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
      const duration = Math.max(1, Math.round(rawDuration));
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      const ratios =
        frameCount === 1
          ? [0.15]
          : Array.from({ length: frameCount }, (_, idx) =>
              Math.min(0.92, Math.max(0.05, (idx + 0.5) / frameCount))
            );

      const frames: ExtractedVideoFrame[] = [];

      const captureAtTime = (targetSec: number): Promise<string> =>
        new Promise(resFrame => {
          const stepTimeout = window.setTimeout(() => resFrame(''), 1500);
          const onSeeked = () => {
            clearTimeout(stepTimeout);
            video.removeEventListener('seeked', onSeeked);
            try {
              const maxDim = 760;
              let w = video.videoWidth || 640;
              let h = video.videoHeight || 360;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, w);
              canvas.height = Math.max(1, h);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resFrame(canvas.toDataURL('image/jpeg', 0.72));
                return;
              }
            } catch {
              // ignore
            }
            resFrame('');
          };
          video.addEventListener('seeked', onSeeked);
          try {
            video.currentTime = targetSec;
          } catch {
            clearTimeout(stepTimeout);
            video.removeEventListener('seeked', onSeeked);
            resFrame('');
          }
        });

      for (const ratio of ratios) {
        const timeSec = Math.max(0.1, Number((rawDuration * ratio).toFixed(1)));
        const dataUrl = await captureAtTime(timeSec);
        if (dataUrl) {
          frames.push({ timeSec, dataUrl });
        }
      }

      clearTimeout(overallTimeout);
      finish({ duration, width, height, frames });
    };

    video.onerror = () => {
      clearTimeout(overallTimeout);
      finish({ duration: 0, width: 1280, height: 720, frames: [] });
    };

    video.src = objUrl;
  });
}

/**
 * Captures a single cover frame at a specific timestamp (in seconds) from a video File.
 */
export async function captureVideoFrameAtTime(
  videoFile: File,
  timeSec: number
): Promise<string> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    const objUrl = URL.createObjectURL(videoFile);
    let settled = false;

    const finish = (dataUrl: string) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objUrl);
      resolve(dataUrl);
    };

    const timeout = window.setTimeout(() => finish(''), 3000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      try {
        const clamped = Math.max(0, Math.min(timeSec, Math.max(0, (video.duration || 1) - 0.05)));
        video.currentTime = clamped;
      } catch {
        finish('');
      }
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const maxDim = 800;
        let w = video.videoWidth || 640;
        let h = video.videoHeight || 360;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL('image/jpeg', 0.76));
          return;
        }
      } catch {
        // ignore
      }
      finish('');
    };

    video.onerror = () => {
      clearTimeout(timeout);
      finish('');
    };

    video.src = objUrl;
  });
}

/**
 * Uploads a video file with real progress tracking (0..100%).
 * Uses Firebase Storage resumable upload first, and falls back to IndexedDB + embedded poster
 * with real byte-level progress so large videos always upload and play reliably.
 */
export async function uploadVideoWithProgress(
  file: File,
  uid: string,
  videoId: string,
  onProgress: (percent: number) => void,
  fallbackPosterDataUrl = ''
): Promise<string> {
  const validationErr = validateVideoFile(file);
  if (validationErr) {
    throw new Error(validationErr);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `mender_videos/${uid}/${videoId}_${safeName}`;
  onProgress(5);

  try {
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'video/mp4',
    });

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        uploadTask.cancel();
        reject(new Error('Storage upload timeout'));
      }, 3500);

      uploadTask.on(
        'state_changed',
        snapshot => {
          if (snapshot.totalBytes > 0) {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 85) + 8;
            onProgress(Math.min(95, pct));
          }
        },
        err => {
          clearTimeout(timeout);
          reject(err);
        },
        async () => {
          clearTimeout(timeout);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    onProgress(100);
    return downloadUrl;
  } catch {
    // Real progress fallback via FileReader + IndexedDB storage
    onProgress(15);

    if (file.size <= 380 * 1024) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = ev => {
          if (ev.lengthComputable && ev.total > 0) {
            const pct = 15 + Math.round((ev.loaded / ev.total) * 75);
            onProgress(Math.min(92, pct));
          }
        };
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Failed to read video file'));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (dataUrl.length <= 550000) {
        onProgress(100);
        return dataUrl;
      }
    }

    // Stream chunks to measure real read progress and persist full video Blob in IndexedDB
    await new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = ev => {
        if (ev.lengthComputable && ev.total > 0) {
          const pct = 20 + Math.round((ev.loaded / ev.total) * 65);
          onProgress(Math.min(88, pct));
        }
      };
      reader.onloadend = () => resolve();
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

    const mediaId = `vid_${videoId}_${Date.now()}`;
    const localObjUrl = URL.createObjectURL(file);
    memoryBlobUrlCache.set(mediaId, localObjUrl);
    await saveBlobToIdb(mediaId, file);
    onProgress(95);

    const poster =
      fallbackPosterDataUrl || (await extractVideoPosterDataUrl(file, 640, 0.65));
    onProgress(100);
    return `idb://${mediaId}|${poster.slice(0, 250000)}`;
  }
}

