const DB_NAME = 'seaclover_media_v1';
const DB_VERSION = 1;
const STORE_NAME = 'character_images';

export interface LocalImageRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: string;
}

const objectUrlCache = new Map<string, string>();
const inFlightUrlPromises = new Map<string, Promise<string | null>>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB để lưu ảnh cục bộ.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Không thể mở kho lưu ảnh cục bộ (IndexedDB).'));
  });
}

export function createLocalImageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `locimg-${crypto.randomUUID()}`;
  }
  return `locimg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    String(e.message || '').toLowerCase().includes('quota')
  );
}

export async function putLocalImageBlob(params: {
  id: string;
  blob: Blob;
  mimeType: string;
  width?: number;
  height?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!hasIndexedDb()) {
    return { ok: false, error: 'Trình duyệt không hỗ trợ lưu ảnh ngoại tuyến (IndexedDB).' };
  }
  let db: IDBDatabase | null = null;
  try {
    db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: LocalImageRecord = {
        id: params.id,
        blob: params.blob,
        mimeType: params.mimeType || params.blob.type || 'image/png',
        width: params.width,
        height: params.height,
        createdAt: new Date().toISOString(),
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Lỗi ghi ảnh vào IndexedDB.'));
      tx.onabort = () => reject(tx.error || new Error('Giao dịch ghi ảnh bị hủy.'));
    });

    // Cập nhật ngay ObjectURL cache nếu chưa có để hiển thị tức thì
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const prev = objectUrlCache.get(params.id);
      if (prev) URL.revokeObjectURL(prev);
      objectUrlCache.set(params.id, URL.createObjectURL(params.blob));
    }

    return { ok: true };
  } catch (err) {
    if (isQuotaError(err)) {
      return {
        ok: false,
        error:
          'Bộ nhớ trình duyệt đã đầy (QuotaExceeded). Vui lòng xóa bớt ảnh cũ hoặc đăng nhập tài khoản đám mây để lưu ảnh.',
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Không thể lưu ảnh vào bộ nhớ trình duyệt.',
    };
  } finally {
    db?.close();
  }
}

export async function getLocalImageBlob(id: string): Promise<Blob | null> {
  if (!id || !hasIndexedDb()) return null;
  let db: IDBDatabase | null = null;
  try {
    db = await openMediaDb();
    const record = await new Promise<LocalImageRecord | undefined>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as LocalImageRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    return record?.blob || null;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function getLocalImageObjectUrl(id: string): Promise<string | null> {
  if (!id) return null;
  const cached = objectUrlCache.get(id);
  if (cached) return cached;

  const existing = inFlightUrlPromises.get(id);
  if (existing) return existing;

  const promise = (async () => {
    const blob = await getLocalImageBlob(id);
    if (!blob || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return null;
    }
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(id, url);
    return url;
  })();

  inFlightUrlPromises.set(id, promise);
  try {
    return await promise;
  } finally {
    inFlightUrlPromises.delete(id);
  }
}

export async function deleteLocalImageBlob(id: string): Promise<void> {
  if (!id) return;
  const cached = objectUrlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(id);
  }
  if (!hasIndexedDb()) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best effort cleanup
  } finally {
    db?.close();
  }
}

/**
 * Thu gom rác cho IndexedDB: CHỈ xóa những localId không còn được tham chiếu bởi bất kỳ nhân vật nào.
 */
export async function garbageCollectLocalImages(referencedLocalIds: Set<string>): Promise<void> {
  if (!hasIndexedDb()) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openMediaDb();
    const keys = await new Promise<string[]>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () =>
        resolve(Array.isArray(req.result) ? req.result.map((k) => String(k)) : []);
      req.onerror = () => reject(req.error);
    });

    const staleIds = keys.filter((k) => !referencedLocalIds.has(k));
    if (staleIds.length === 0) return;

    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const id of staleIds) {
        const cached = objectUrlCache.get(id);
        if (cached) {
          URL.revokeObjectURL(cached);
          objectUrlCache.delete(id);
        }
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best effort GC
  } finally {
    db?.close();
  }
}

/**
 * Kiểm tra không phá hủy xem trình duyệt còn ảnh cục bộ (IndexedDB) từ phiên bản trước không.
 */
export async function hasIndexedDbStoredImages(): Promise<boolean> {
  if (!hasIndexedDb()) return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openMediaDb();
    const count = await new Promise<number>((resolve) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(typeof req.result === 'number' ? req.result : 0);
      req.onerror = () => resolve(0);
    });
    return count > 0;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}
