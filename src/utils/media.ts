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
