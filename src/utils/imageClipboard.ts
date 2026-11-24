import type { CharacterImage } from '../types';
import { resolveCharacterImageBlob } from '../services/mediaService';

async function convertBlobToPngBlob(sourceBlob: Blob): Promise<Blob> {
  if (sourceBlob.type === 'image/png') {
    return sourceBlob;
  }

  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('Trình duyệt không hỗ trợ chuyển đổi ảnh sang PNG.');
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(sourceBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Không thể khởi tạo canvas chuyển đổi ảnh PNG.');
    }
    ctx.drawImage(bitmap, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
    if (!pngBlob) {
      throw new Error('Không thể xuất ảnh định dạng PNG.');
    }
    return pngBlob;
  } finally {
    bitmap?.close();
  }
}

export async function copyCharacterImageAsPng(
  image: CharacterImage,
  sourceBlobOverride?: Blob | null,
): Promise<{ ok: boolean; error?: string }> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    return {
      ok: false,
      error:
        'Trình duyệt hiện tại chưa hỗ trợ sao chép ảnh trực tiếp vào Clipboard. Hãy thử Chrome, Edge hoặc Safari phiên bản mới.',
    };
  }

  try {
    // Truyền Promise<Blob> trực tiếp vào ClipboardItem để giữ user activation gesture trên Safari/Chrome
    const pngBlobPromise = (async (): Promise<Blob> => {
      let sourceBlob = sourceBlobOverride ?? null;
      if (!sourceBlob) {
        try {
          sourceBlob = await resolveCharacterImageBlob(image);
        } catch {
          sourceBlob = null;
        }
      }
      if (!sourceBlob) {
        if (image.url && !image.localId && !image.storagePath) {
          throw new Error(
            'Không thể chép ảnh từ liên kết ngoài vì máy chủ ảnh chặn truy cập CORS.',
          );
        }
        throw new Error('Không thể tải dữ liệu ảnh để chép vào Clipboard.');
      }
      return convertBlobToPngBlob(sourceBlob);
    })();

    const item = new ClipboardItem({ 'image/png': pngBlobPromise });
    await navigator.clipboard.write([item]);
    return { ok: true };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : '';
    if (name === 'NotAllowedError') {
      return {
        ok: false,
        error:
          'Trình duyệt chưa cấp quyền ghi ảnh vào Clipboard. Vui lòng cho phép quyền Clipboard và thử lại.',
      };
    }
    if (message.includes('CORS') || message.toLowerCase().includes('failed to fetch')) {
      return {
        ok: false,
        error:
          'Không thể chép ảnh từ liên kết ngoài vì nguồn ảnh không cho phép CORS. Hãy tải lên trực tiếp để chép ảnh bất kỳ lúc nào.',
      };
    }
    return {
      ok: false,
      error: message || 'Không thể sao chép ảnh vào Clipboard.',
    };
  }
}
