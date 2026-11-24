import { supabase } from '../lib/supabase';
import { isSafeImageUrl } from '../utils/contentBlocks';

export const PROMPT_IMAGES_BUCKET = 'prompt-images';
const MAX_PROMPT_IMAGE_INPUT_BYTES = 12 * 1024 * 1024; // 12 MB trước tối ưu
const MAX_PROMPT_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB (khớp migration 005)

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

export async function detectRasterImageMime(file: File): Promise<string | null> {
  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
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
