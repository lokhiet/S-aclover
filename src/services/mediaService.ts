import { supabase } from '../lib/supabase';
import type { CharacterImage } from '../types';
import { isSafeDataImageUrl, isSafeImageUrl } from '../utils/contentBlocks';
import { getLocalImageBlob, getLocalImageObjectUrl } from './localImageStore';

export const PROMPT_IMAGES_BUCKET = 'prompt-images';
export const CHARACTER_IMAGES_BUCKET = 'character-images';
const MAX_PROMPT_IMAGE_INPUT_BYTES = 12 * 1024 * 1024; // 12 MB trước tối ưu
const MAX_PROMPT_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB (khớp migration 005 & 009)
const MAX_CHARACTER_IMAGE_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB trước nén
const MAX_CHARACTER_IMAGE_DIMENSION = 2048; // Giữ sắc nét cho screenshot có chữ nhỏ

const ALLOWED_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface MediaUploadResult {
  ok: boolean;
  storagePath?: string;
  error?: string;
}

export interface MediaDownloadResult {
  ok: boolean;
  objectUrl?: string;
  error?: string;
}

export interface ProcessedCharacterImage {
  ok: boolean;
  blob?: Blob;
  mimeType?: string;
  width?: number;
  height?: number;
  error?: string;
}

const characterSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const characterSignedUrlPromises = new Map<string, Promise<MediaDownloadResult>>();

export async function detectRasterImageMime(blobOrFile: Blob): Promise<string | null> {
  try {
    const header = new Uint8Array(await blobOrFile.slice(0, 16).arrayBuffer());
    // PNG: 89 50 4E 47
    if (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    ) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return 'image/jpeg';
    }
    // GIF: GIF87a / GIF89a
    if (
      header.length >= 6 &&
      header[0] === 0x47 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x38
    ) {
      return 'image/gif';
    }
    // WebP: RIFF....WEBP
    if (
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    ) {
      return 'image/webp';
    }
  } catch {
    return null;
  }
  return null;
}

async function optimizeIllustrationIfNeeded(
  file: File,
  detectedMime: string,
): Promise<{ blob: Blob; mime: string }> {
  if (
    detectedMime === 'image/gif' ||
    (file.size <= 1.2 * 1024 * 1024 && detectedMime !== 'image/png')
  ) {
    return { blob: file, mime: detectedMime };
  }

  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return { blob: file, mime: detectedMime };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size <= MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
      return { blob: file, mime: detectedMime };
    }

    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: file, mime: detectedMime };
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    const outputMime = detectedMime === 'image/png' ? 'image/webp' : detectedMime;
    const encoded = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), outputMime, 0.88);
    });

    if (encoded && encoded.size > 0 && encoded.size < file.size) {
      return { blob: encoded, mime: outputMime };
    }
    if (encoded && encoded.size > 0 && file.size > MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
      return { blob: encoded, mime: outputMime };
    }
  } catch {
    // Giữ nguyên file gốc nếu trình duyệt không hỗ trợ tối ưu canvas
  } finally {
    bitmap?.close();
  }

  return { blob: file, mime: detectedMime };
}

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'item';
}

/**
 * Tải hình ảnh minh họa lên bucket riêng tư `prompt-images` theo cấu trúc `<userId>/<targetType>/<itemId>/<filename>`.
 * Quyền xem sẽ tự động đồng bộ theo trạng thái Riêng tư / Công khai / Hệ thống của bài đăng qua RLS.
 */
export async function uploadPromptIllustration(
  userId: string,
  targetType: 'note' | 'library_prompt',
  itemId: string,
  file: File,
): Promise<MediaUploadResult> {
  if (!supabase) {
    return { ok: false, error: 'Supabase chưa được cấu hình.' };
  }

  if (!file) {
    return { ok: false, error: 'Vui lòng chọn tệp ảnh hợp lệ.' };
  }

  if (file.size > MAX_PROMPT_IMAGE_INPUT_BYTES) {
    return {
      ok: false,
      error: 'Ảnh quá lớn (tối đa 12 MB trước nén). Vui lòng chọn ảnh nhẹ hơn.',
    };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) {
    return {
      ok: false,
      error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tải ảnh.',
    };
  }

  if (sessionData.session.user.id !== userId) {
    return {
      ok: false,
      error: 'Bạn chỉ được tải ảnh lên thư mục thuộc tài khoản của mình.',
    };
  }

  const detectedMime = await detectRasterImageMime(file);
  if (!detectedMime || !ALLOWED_IMAGE_MIME_TO_EXT[detectedMime]) {
    return {
      ok: false,
      error: 'Chỉ hỗ trợ ảnh PNG, JPG, WebP hoặc GIF an toàn.',
    };
  }

  const optimized = await optimizeIllustrationIfNeeded(file, detectedMime);
  const ext = ALLOWED_IMAGE_MIME_TO_EXT[optimized.mime];
  if (!ext) {
    return { ok: false, error: 'Không thể xác định định dạng ảnh hợp lệ.' };
  }

  if (optimized.blob.size > MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      error: 'Ảnh sau tối ưu vẫn vượt quá 5 MB. Vui lòng chọn ảnh nhẹ hơn.',
    };
  }

  const safeItemId = sanitizePathSegment(itemId);
  const randomSuffix = Math.random().toString(36).slice(2, 9);
  const storagePath = `${userId}/${targetType}/${safeItemId}/img-${Date.now()}-${randomSuffix}.${ext}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(PROMPT_IMAGES_BUCKET)
      .upload(storagePath, optimized.blob, {
        contentType: optimized.mime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      const msgLower = String(uploadError.message || '').toLowerCase();
      if (msgLower.includes('bucket') && msgLower.includes('not found')) {
        return {
          ok: false,
          error:
            'Kho ảnh minh họa chưa được kích hoạt. Vui lòng chạy migration 005_prompt_images_storage.sql trên Supabase.',
        };
      }
      if (msgLower.includes('row-level security') || msgLower.includes('permission')) {
        return {
          ok: false,
          error:
            'Chưa có quyền tải ảnh minh họa. Vui lòng kiểm tra migration 005_prompt_images_storage.sql.',
        };
      }
      return { ok: false, error: uploadError.message || 'Không thể tải ảnh minh họa.' };
    }

    return { ok: true, storagePath };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Lỗi kết nối khi tải ảnh minh họa.',
    };
  }
}

export async function downloadPromptIllustrationObjectUrl(
  storagePath: string,
): Promise<MediaDownloadResult> {
  if (!supabase) {
    return { ok: false, error: 'Supabase chưa được cấu hình.' };
  }

  const cleanPath = storagePath.trim();
  if (!cleanPath || cleanPath.includes('..')) {
    return { ok: false, error: 'Đường dẫn ảnh không hợp lệ.' };
  }

  try {
    const { data, error } = await supabase.storage
      .from(PROMPT_IMAGES_BUCKET)
      .download(cleanPath);

    if (error || !data) {
      const msgLower = String(error?.message || '').toLowerCase();
      if (msgLower.includes('bucket') && msgLower.includes('not found')) {
        return {
          ok: false,
          error: 'Chưa khởi tạo kho ảnh minh họa (migration 005).',
        };
      }
      return {
        ok: false,
        error: 'Ảnh đang ở chế độ riêng tư hoặc không khả dụng.',
      };
    }

    const objectUrl = URL.createObjectURL(data);
    return { ok: true, objectUrl };
  } catch {
    return { ok: false, error: 'Không thể tải ảnh minh họa.' };
  }
}

export async function deletePromptIllustrationPaths(
  userId: string,
  paths: string[],
): Promise<void> {
  if (!supabase || !userId || paths.length === 0) return;
  const ownPaths = Array.from(
    new Set(
      paths
        .map((p) => p.trim())
        .filter((p) => p.startsWith(`${userId}/`) && !p.includes('..')),
    ),
  );
  if (ownPaths.length === 0) return;

  try {
    await supabase.storage.from(PROMPT_IMAGES_BUCKET).remove(ownPaths);
  } catch {
    // Dọn dẹp best-effort, không chặn luồng lưu/hủy
  }
}

export function isValidOptionalImageUrl(url?: string): boolean {
  if (!url || !url.trim()) return true;
  return isSafeImageUrl(url);
}

// ----------------------------------------------------------------------------
// Character Image Processing, Upload, Signed URL Cache & Resolver (0..5 ảnh)
// ----------------------------------------------------------------------------

function canvasToBlobAsync(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Kiểm tra magic bytes, kích thước, và tối ưu ảnh nhân vật:
 * - Bảo toàn tỉ lệ gốc, giữ độ nét chữ nhỏ trong screenshot (tối đa 2048px).
 * - PNG <= 1.2 MB & <= 2048px được giữ nguyên lossless.
 * - Ảnh lớn hơn được nén nhẹ WebP 0.92 (hoặc PNG/JPEG tương ứng) <= 5 MB.
 * - GIF động <= 5 MB được giữ nguyên.
 */
export async function processCharacterImageForUpload(
  blobOrFile: Blob,
): Promise<ProcessedCharacterImage> {
  if (!blobOrFile || blobOrFile.size === 0) {
    return { ok: false, error: 'Tệp ảnh trống hoặc không hợp lệ.' };
  }

  if (blobOrFile.size > MAX_CHARACTER_IMAGE_INPUT_BYTES) {
    return {
      ok: false,
      error: 'Ảnh quá lớn (tối đa 15 MB trước xử lý). Vui lòng chọn ảnh nhẹ hơn.',
    };
  }

  const detectedMime = await detectRasterImageMime(blobOrFile);
  if (!detectedMime || !ALLOWED_IMAGE_MIME_TO_EXT[detectedMime]) {
    return {
      ok: false,
      error: 'Chỉ hỗ trợ ảnh định dạng PNG, JPG, WebP hoặc GIF hợp lệ.',
    };
  }

  if (detectedMime === 'image/gif') {
    if (blobOrFile.size > MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
      return {
        ok: false,
        error: 'Ảnh GIF vượt quá giới hạn 5 MB. Vui lòng chọn tệp nhẹ hơn.',
      };
    }
    return { ok: true, blob: blobOrFile, mimeType: detectedMime };
  }

  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    if (blobOrFile.size > MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
      return { ok: false, error: 'Ảnh vượt quá 5 MB.' };
    }
    return { ok: true, blob: blobOrFile, mimeType: detectedMime };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blobOrFile);
    const origWidth = bitmap.width;
    const origHeight = bitmap.height;
    const scale = Math.min(1, MAX_CHARACTER_IMAGE_DIMENSION / Math.max(origWidth, origHeight));

    // Giữ nguyên PNG/WebP/JPG nhỏ dưới 1.2 MB và không vượt quá 2048px để giữ chữ sắc nét tuyệt đối
    if (scale === 1 && blobOrFile.size <= 1.2 * 1024 * 1024) {
      return {
        ok: true,
        blob: blobOrFile,
        mimeType: detectedMime,
        width: origWidth,
        height: origHeight,
      };
    }

    const targetWidth = Math.max(1, Math.round(origWidth * scale));
    const targetHeight = Math.max(1, Math.round(origHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (blobOrFile.size <= MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
        return {
          ok: true,
          blob: blobOrFile,
          mimeType: detectedMime,
          width: origWidth,
          height: origHeight,
        };
      }
      return { ok: false, error: 'Trình duyệt không thể khởi tạo bộ xử lý ảnh.' };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const candidateMime =
      detectedMime === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    let encoded = await canvasToBlobAsync(canvas, candidateMime, 0.92);

    // Fallback về PNG nếu trình duyệt không hỗ trợ WebP encode
    if (!encoded && candidateMime === 'image/webp') {
      encoded = await canvasToBlobAsync(canvas, 'image/png');
    }

    // Nếu ảnh PNG thu nhỏ hoặc WebP 0.92 vẫn > 5MB, giảm chất lượng từng bước nhẹ
    if (encoded && encoded.size > MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
      const retry = await canvasToBlobAsync(canvas, candidateMime, 0.82);
      if (retry) encoded = retry;
    }

    // Với ảnh nhỏ hơn file gốc hoặc cần nén để đạt <= 5 MB
    if (
      encoded &&
      encoded.size > 0 &&
      encoded.size <= MAX_PROMPT_IMAGE_UPLOAD_BYTES &&
      (encoded.size < blobOrFile.size ||
        scale < 1 ||
        blobOrFile.size > MAX_PROMPT_IMAGE_UPLOAD_BYTES)
    ) {
      return {
        ok: true,
        blob: encoded,
        mimeType: encoded.type || candidateMime,
        width: targetWidth,
        height: targetHeight,
      };
    }

    if (scale === 1 && blobOrFile.size <= MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
      return {
        ok: true,
        blob: blobOrFile,
        mimeType: detectedMime,
        width: origWidth,
        height: origHeight,
      };
    }

    if (encoded && encoded.size <= MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
      return {
        ok: true,
        blob: encoded,
        mimeType: encoded.type || candidateMime,
        width: targetWidth,
        height: targetHeight,
      };
    }

    return {
      ok: false,
      error: 'Ảnh sau tối ưu vẫn vượt quá 5 MB. Vui lòng chọn ảnh có độ phân giải nhỏ hơn.',
    };
  } catch {
    if (blobOrFile.size <= MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
      return { ok: true, blob: blobOrFile, mimeType: detectedMime };
    }
    return { ok: false, error: 'Không thể giải mã tệp ảnh này.' };
  } finally {
    bitmap?.close();
  }
}

export async function uploadCharacterImageBlob(
  userId: string,
  characterId: string,
  blob: Blob,
  mimeTypeHint?: string,
): Promise<MediaUploadResult> {
  if (!supabase) {
    return { ok: false, error: 'Supabase chưa được cấu hình.' };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) {
    return {
      ok: false,
      error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tải ảnh nhân vật.',
    };
  }
  if (sessionData.session.user.id !== userId) {
    return {
      ok: false,
      error: 'Bạn chỉ được tải ảnh lên thư mục thuộc tài khoản của mình.',
    };
  }

  const detectedMime = (await detectRasterImageMime(blob)) || mimeTypeHint || blob.type;
  const ext = ALLOWED_IMAGE_MIME_TO_EXT[detectedMime];
  if (!ext) {
    return { ok: false, error: 'Định dạng ảnh nhân vật không được hỗ trợ (PNG/JPG/WebP/GIF).' };
  }
  if (blob.size > MAX_PROMPT_IMAGE_UPLOAD_BYTES) {
    return { ok: false, error: 'Ảnh nhân vật vượt quá 5 MB.' };
  }

  const safeCharId = sanitizePathSegment(characterId);
  const randomUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const storagePath = `${userId}/character/${safeCharId}/${randomUuid}.${ext}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(CHARACTER_IMAGES_BUCKET)
      .upload(storagePath, blob, {
        contentType: detectedMime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      const msgLower = String(uploadError.message || '').toLowerCase();
      if (msgLower.includes('bucket') && msgLower.includes('not found')) {
        return {
          ok: false,
          error:
            'Kho ảnh nhân vật chưa được kích hoạt. Vui lòng chạy migration 009_character_images.sql trên Supabase.',
        };
      }
      if (msgLower.includes('row-level security') || msgLower.includes('permission')) {
        return {
          ok: false,
          error:
            'Chưa có quyền tải ảnh nhân vật. Vui lòng kiểm tra migration 009_character_images.sql.',
        };
      }
      return { ok: false, error: uploadError.message || 'Không thể tải ảnh nhân vật.' };
    }

    return { ok: true, storagePath };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Lỗi kết nối khi tải ảnh nhân vật.',
    };
  }
}

export async function getSignedCharacterImageUrl(
  storagePath: string,
): Promise<MediaDownloadResult> {
  if (!supabase) {
    return { ok: false, error: 'Supabase chưa được cấu hình.' };
  }
  const cleanPath = storagePath.trim();
  if (!cleanPath || cleanPath.includes('..')) {
    return { ok: false, error: 'Đường dẫn ảnh nhân vật không hợp lệ.' };
  }

  const now = Date.now();
  const cached = characterSignedUrlCache.get(cleanPath);
  if (cached && cached.expiresAt > now + 30_000) {
    return { ok: true, objectUrl: cached.url };
  }

  const inFlight = characterSignedUrlPromises.get(cleanPath);
  if (inFlight) return inFlight;

  const task = (async (): Promise<MediaDownloadResult> => {
    try {
      const { data, error } = await supabase.storage
        .from(CHARACTER_IMAGES_BUCKET)
        .createSignedUrl(cleanPath, 3600);

      if (error || !data?.signedUrl) {
        const msgLower = String(error?.message || '').toLowerCase();
        if (msgLower.includes('bucket') && msgLower.includes('not found')) {
          return {
            ok: false,
            error: 'Chưa khởi tạo kho ảnh nhân vật (migration 009).',
          };
        }
        return {
          ok: false,
          error: 'Ảnh nhân vật đang ở chế độ riêng tư hoặc không khả dụng.',
        };
      }

      characterSignedUrlCache.set(cleanPath, {
        url: data.signedUrl,
        expiresAt: Date.now() + 50 * 60 * 1000,
      });
      return { ok: true, objectUrl: data.signedUrl };
    } catch {
      return { ok: false, error: 'Không thể tải ảnh nhân vật.' };
    } finally {
      characterSignedUrlPromises.delete(cleanPath);
    }
  })();

  characterSignedUrlPromises.set(cleanPath, task);
  return task;
}

export function invalidateCharacterImageSignedCache(paths: string[]): void {
  for (const p of paths) {
    const clean = p.trim();
    if (clean) characterSignedUrlCache.delete(clean);
  }
}

export async function downloadCharacterImageBlob(storagePath: string): Promise<Blob | null> {
  if (!supabase) return null;
  const cleanPath = storagePath.trim();
  if (!cleanPath || cleanPath.includes('..')) return null;
  try {
    const { data, error } = await supabase.storage
      .from(CHARACTER_IMAGES_BUCKET)
      .download(cleanPath);
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function deleteCharacterImagePaths(
  userId: string,
  paths: string[],
): Promise<void> {
  if (!supabase || !userId || paths.length === 0) return;
  const ownPaths = Array.from(
    new Set(
      paths
        .map((p) => p.trim())
        .filter((p) => p.startsWith(`${userId}/`) && !p.includes('..')),
    ),
  );
  if (ownPaths.length === 0) return;
  invalidateCharacterImageSignedCache(ownPaths);
  try {
    await supabase.storage.from(CHARACTER_IMAGES_BUCKET).remove(ownPaths);
  } catch {
    // Dọn dẹp best-effort
  }
}

export async function resolveCharacterImageUrl(
  image: CharacterImage,
): Promise<MediaDownloadResult> {
  if (image.localId) {
    const localUrl = await getLocalImageObjectUrl(image.localId);
    if (localUrl) return { ok: true, objectUrl: localUrl };
  }
  if (image.storagePath) {
    return getSignedCharacterImageUrl(image.storagePath);
  }
  if (image.url && (isSafeImageUrl(image.url) || isSafeDataImageUrl(image.url))) {
    return { ok: true, objectUrl: image.url };
  }
  return { ok: false, error: 'Không tìm thấy nguồn ảnh nhân vật.' };
}

export async function resolveCharacterImageBlob(image: CharacterImage): Promise<Blob | null> {
  if (image.localId) {
    const localBlob = await getLocalImageBlob(image.localId);
    if (localBlob) return localBlob;
  }
  if (image.storagePath) {
    const cloudBlob = await downloadCharacterImageBlob(image.storagePath);
    if (cloudBlob) return cloudBlob;
  }
  if (image.url && (isSafeImageUrl(image.url) || isSafeDataImageUrl(image.url))) {
    const response = await fetch(image.url, { mode: 'cors' });
    if (!response.ok) return null;
    return await response.blob();
  }
  return null;
}

