// ══════════════════════════════════════════
//  VIDEO STORAGE via IndexedDB
//  Handles large video files (50MB+) that
//  exceed localStorage's ~5-10MB quota.
// ══════════════════════════════════════════

const DB_NAME = 'LensCoachVideos';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

interface VideoRecord {
  lutId: string;
  dataUrl: string;
  fileName: string;
  uploadedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'lutId' });
      }
    };
  });
}

/** Save a video (base64 data URL) to IndexedDB */
export async function saveVideoDB(lutId: string, dataUrl: string, fileName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: VideoRecord = { lutId, dataUrl, fileName, uploadedAt: new Date().toISOString() };
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get a single video by LUT id */
export async function getVideoDB(lutId: string): Promise<VideoRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(lutId);
    request.onsuccess = () => resolve(request.result as VideoRecord || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get all videos as a lookup map */
export async function getAllVideosDB(): Promise<Record<string, VideoRecord>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result as VideoRecord[];
      const map: Record<string, VideoRecord> = {};
      records.forEach((r) => { map[r.lutId] = r; });
      resolve(map);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Remove a video */
export async function removeVideoDB(lutId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(lutId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Check approx storage usage in MB */
export async function getVideoStorageSizeMB(): Promise<number> {
  try {
    const videos = await getAllVideosDB();
    let totalBytes = 0;
    Object.values(videos).forEach((v) => {
      // Approximate: base64 is ~4/3 the binary size
      totalBytes += v.dataUrl.length * 0.75;
    });
    return totalBytes / (1024 * 1024);
  } catch {
    return 0;
  }
}
