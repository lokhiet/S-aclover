import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  ImagePlus,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { MAX_CHARACTER_IMAGES, type CharacterImage } from '../../types';
import { createCharacterImageId, isSafeImageUrl } from '../../utils/contentBlocks';
import {
  processCharacterImageForUpload,
  resolveCharacterImageUrl,
} from '../../services/mediaService';

export interface DraftCharacterImage {
  id: string;
  image: CharacterImage;
  pendingBlob?: Blob;
  previewUrl?: string;
}

interface CharacterImageManagerProps {
  items: DraftCharacterImage[];
  onChange: (nextItems: DraftCharacterImage[]) => void;
  disabled?: boolean;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export function buildInitialDraftImages(images: CharacterImage[]): DraftCharacterImage[] {
  return images.slice(0, MAX_CHARACTER_IMAGES).map((img) => ({
    id: img.id || createCharacterImageId(),
    image: img,
  }));
}

export function CharacterImageManager({
  items,
  onChange,
  disabled = false,
  onToast,
}: CharacterImageManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Thu hồi objectURL tạm khi component unmount
  const createdPreviewUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      for (const url of createdPreviewUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      createdPreviewUrlsRef.current = [];
    };
  }, []);

  const createTrackedPreviewUrl = (blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    createdPreviewUrlsRef.current.push(url);
    return url;
  };

  const appendBlobs = useCallback(
    async (rawFiles: Array<{ blob: Blob; name?: string }>) => {
      if (disabled || rawFiles.length === 0) return;
      setLocalError('');

      const currentItems = itemsRef.current;
      const remainingSlots = MAX_CHARACTER_IMAGES - currentItems.length;
      if (remainingSlots <= 0) {
        const msg = `Nhân vật đã đạt tối đa ${MAX_CHARACTER_IMAGES}/${MAX_CHARACTER_IMAGES} ảnh. Hãy xóa hoặc thay thế ảnh hiện có.`;
        setLocalError(msg);
        onToast?.(msg, 'error');
        return;
      }

      if (rawFiles.length > remainingSlots) {
        const msg = `Chỉ còn ${remainingSlots} ô trống (tối đa ${MAX_CHARACTER_IMAGES} ảnh/nhân vật). Vui lòng chọn tối đa ${remainingSlots} ảnh để không ghi đè ảnh cũ.`;
        setLocalError(msg);
        onToast?.(msg, 'error');
        return;
      }

      setIsProcessing(true);
      try {
        const additions: DraftCharacterImage[] = [];
        for (const entry of rawFiles) {
          const processed = await processCharacterImageForUpload(entry.blob);
          if (!processed.ok || !processed.blob || !processed.mimeType) {
            const errMsg = processed.error || 'Ảnh không hợp lệ hoặc vượt quá giới hạn.';
            setLocalError(errMsg);
            onToast?.(errMsg, 'error');
            return;
          }

          const newId = createCharacterImageId();
          const previewUrl = createTrackedPreviewUrl(processed.blob);
          additions.push({
            id: newId,
            pendingBlob: processed.blob,
            previewUrl,
            image: {
              id: newId,
              mimeType: processed.mimeType,
              width: processed.width,
              height: processed.height,
              name: entry.name?.slice(0, 120),
            },
          });
        }

        if (additions.length > 0) {
          const merged = [...itemsRef.current, ...additions].slice(0, MAX_CHARACTER_IMAGES);
          onChange(merged);
          onToast?.(`Đã thêm ${additions.length} ảnh (${merged.length}/${MAX_CHARACTER_IMAGES}).`, 'success');
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [disabled, onChange, onToast],
  );

  // Scoped Ctrl+V / Cmd+V listener chỉ hoạt động khi CharacterForm đang mở
  useEffect(() => {
    if (disabled) return;
    const handleWindowPaste = (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const imageFiles: Array<{ blob: Blob; name?: string }> = [];
      for (const item of Array.from(clipboardData.items || [])) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push({
              blob: file,
              name: file.name || `pasted-${Date.now()}.png`,
            });
          }
        }
      }

      // Nếu người dùng đang dán chữ bình thường trong input/textarea và không có file ảnh -> KHÔNG can thiệp!
      const target = e.target as HTMLElement | null;
      const isTextInput = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable),
      );
      if (imageFiles.length === 0) {
        return;
      }

      // Nếu clipboard thực sự chứa ảnh, chặn hành vi mặc định nếu ngoài ô chữ (hoặc kể cả khi focus vùng ảnh)
      if (!isTextInput || clipboardData.getData('text/plain') === '') {
        e.preventDefault();
        void appendBlobs(imageFiles);
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [appendBlobs, disabled]);

  const handleExplicitPasteButton = async () => {
    if (disabled || isProcessing) return;
    setLocalError('');

    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.read !== 'function'
    ) {
      const msg =
        'Trình duyệt không hỗ trợ nút "Dán ảnh" trực tiếp. Bạn hãy nhấn Ctrl + V (hoặc Cmd + V trên Mac) để dán ảnh.';
      setLocalError(msg);
      onToast?.(msg, 'info');
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      const imageBlobs: Array<{ blob: Blob; name?: string }> = [];
      for (const clipItem of clipboardItems) {
        const imgType = clipItem.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await clipItem.getType(imgType);
          imageBlobs.push({
            blob,
            name: `pasted-${Date.now()}.${imgType.split('/')[1] || 'png'}`,
          });
        }
      }

      if (imageBlobs.length === 0) {
        const msg = 'Clipboard hiện không có dữ liệu hình ảnh. Hãy sao chép ảnh hoặc chụp màn hình trước.';
        setLocalError(msg);
        onToast?.(msg, 'info');
        return;
      }

      await appendBlobs(imageBlobs);
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg =
        name === 'NotAllowedError'
          ? 'Trình duyệt chưa cấp quyền đọc Clipboard. Vui lòng cấp quyền hoặc bấm Ctrl + V / Cmd + V.'
          : 'Không thể đọc ảnh từ Clipboard. Hãy thử nhấn Ctrl + V / Cmd + V.';
      setLocalError(msg);
      onToast?.(msg, 'error');
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList: File[] = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    e.target.value = '';
    if (fileList.length === 0) return;
    await appendBlobs(fileList.map((f) => ({ blob: f, name: f.name })));
  };

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = replaceTargetId;
    e.target.value = '';
    setReplaceTargetId(null);
    if (!file || !targetId) return;

    setLocalError('');
    setIsProcessing(true);
    try {
      const processed = await processCharacterImageForUpload(file);
      if (!processed.ok || !processed.blob || !processed.mimeType) {
        const errMsg = processed.error || 'Ảnh thay thế không hợp lệ.';
        setLocalError(errMsg);
        onToast?.(errMsg, 'error');
        return;
      }

      const newId = createCharacterImageId();
      const previewUrl = createTrackedPreviewUrl(processed.blob);
      const next = items.map((entry) =>
        entry.id === targetId
          ? {
              id: newId,
              pendingBlob: processed.blob,
              previewUrl,
              image: {
                id: newId,
                mimeType: processed.mimeType,
                width: processed.width,
                height: processed.height,
                name: file.name?.slice(0, 120),
              },
            }
          : entry,
      );
      onChange(next);
      onToast?.('Đã thay thế ảnh nhân vật.', 'success');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    if (items.length >= MAX_CHARACTER_IMAGES) {
      setLocalError(`Đã đạt tối đa ${MAX_CHARACTER_IMAGES} ảnh.`);
      return;
    }
    if (!isSafeImageUrl(trimmed)) {
      setLocalError('Liên kết ảnh phải bắt đầu bằng https:// hợp lệ.');
      return;
    }
    const newId = createCharacterImageId();
    onChange([
      ...items,
      {
        id: newId,
        image: {
          id: newId,
          url: trimmed,
        },
      },
    ]);
    setUrlValue('');
    setShowUrlInput(false);
    setLocalError('');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const droppedFiles = Array.from(e.dataTransfer.files || []) as File[];
    const dropped = droppedFiles.filter(
      (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name),
    );
    if (dropped.length === 0) {
      setLocalError('Vui lòng kéo thả tệp ảnh định dạng PNG, JPG, WebP hoặc GIF.');
      return;
    }
    void appendBlobs(dropped.map((f) => ({ blob: f, name: f.name })));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const next = [...items];
    const [removed] = next.splice(index, 1);
    next.splice(targetIdx, 0, removed);
    onChange(next);
  };

  const removeItem = (id: string) => {
    onChange(items.filter((entry) => entry.id !== id));
    setLocalError('');
  };

  const isFull = items.length >= MAX_CHARACTER_IMAGES;

  return (
    <div className="retro-callout-mint p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] uppercase tracking-wider">
            Ảnh Nhân Vật (0–{MAX_CHARACTER_IMAGES} ảnh)
          </h4>
          <span className="px-1.5 py-0.5 rounded bg-[#FFFDF7] dark:bg-[#202423] border border-[#9FC4AF] dark:border-[#49554D] text-[10px] font-mono font-bold text-[#224C3B] dark:text-[#A3BDA8] tabular-nums-mono">
            {items.length}/{MAX_CHARACTER_IMAGES} ảnh
          </span>
        </div>

        <span className="text-[11px] text-[#587568] dark:text-[#B8BDB5]">
          Ảnh đầu tiên là ảnh đại diện • Có thể Ctrl+V / Cmd+V để dán
        </span>
      </div>

      {localError && (
        <p className="px-2.5 py-1.5 rounded border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-[11px] font-semibold">
          {localError}
        </p>
      )}

      {/* Thumbnail Strip (0..5 compact slots) */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {items.map((entry, idx) => (
            <div key={entry.id} className="contents">
              <DraftImageCard
                entry={entry}
                index={idx}
                total={items.length}
                disabled={disabled || isProcessing}
                onMoveLeft={() => moveItem(idx, -1)}
                onMoveRight={() => moveItem(idx, 1)}
                onReplace={() => {
                  setReplaceTargetId(entry.id);
                  replaceInputRef.current?.click();
                }}
                onRemove={() => removeItem(entry.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Shared Dropzone (ẩn khi đã đủ 5/5 ảnh) */}
      {!isFull ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-md border-2 border-dashed px-3 py-3.5 text-center transition-colors ${
            isDragging
              ? 'border-[#39755D] bg-[#E2F3E8] dark:border-[#A3BDA8] dark:bg-[#343D37]'
              : 'border-[#B7D6C4] dark:border-[#49554D] bg-[#FFFDF7]/80 dark:bg-[#202423]/75'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2B5A47] dark:text-[#E4E1D8]">
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#39755D] dark:text-[#A3BDA8]" />
              ) : (
                <ImagePlus className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
              )}
              <span>
                {isProcessing
                  ? 'Đang kiểm tra & tối ưu ảnh...'
                  : 'Kéo thả nhiều ảnh vào đây, dán từ Ctrl+V hoặc chọn tệp'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                disabled={disabled || isProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                <span>Chọn ảnh</span>
              </button>

              <button
                type="button"
                disabled={disabled || isProcessing}
                onClick={() => void handleExplicitPasteButton()}
                className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                <span>Dán ảnh</span>
              </button>

              <button
                type="button"
                disabled={disabled || isProcessing}
                onClick={() => setShowUrlInput((prev) => !prev)}
                className={`retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                  showUrlInput ? 'retro-btn-active' : ''
                }`}
              >
                <Link2 className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                <span>Link HTTPS</span>
              </button>
            </div>

            <p className="text-[10px] text-[#5B786B] dark:text-[#B8BDB5]">
              Hỗ trợ PNG, JPG, WebP, GIF (giữ nguyên độ nét chữ nhỏ trong ảnh chụp màn hình).
            </p>
          </div>

          {showUrlInput && (
            <div className="mt-2.5 pt-2.5 border-t border-[#D6E7DC] dark:border-[#343D37] flex flex-col sm:flex-row gap-1.5">
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                placeholder="https://example.com/character.png"
                className="retro-input flex-1 px-2.5 py-1 text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="retro-btn-primary px-3 py-1 text-[11px] font-bold cursor-pointer shrink-0"
              >
                Thêm link
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-[#2B5A47] dark:text-[#A3BDA8] text-center py-1">
          Đã đạt đủ {MAX_CHARACTER_IMAGES}/{MAX_CHARACTER_IMAGES} ảnh. Bạn có thể sắp xếp lại, thay thế hoặc xóa bớt ảnh.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        onChange={(e) => void handleFileInputChange(e)}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => void handleReplaceFileChange(e)}
        className="hidden"
      />
    </div>
  );
}

function DraftImageCard({
  entry,
  index,
  total,
  disabled,
  onMoveLeft,
  onMoveRight,
  onReplace,
  onRemove,
}: {
  entry: DraftCharacterImage;
  index: number;
  total: number;
  disabled: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(entry.previewUrl || null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (entry.previewUrl) {
      setUrl(entry.previewUrl);
      setBroken(false);
      return;
    }
    let active = true;
    void resolveCharacterImageUrl(entry.image).then((res) => {
      if (!active) return;
      if (res.ok && res.objectUrl) {
        setUrl(res.objectUrl);
        setBroken(false);
      } else {
        setBroken(true);
      }
    });
    return () => {
      active = false;
    };
  }, [entry]);

  return (
    <div className="rounded-md border border-[#B8D7C5] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#202423] overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-[#F4FAF6] dark:bg-[#191D1B] flex items-center justify-center overflow-hidden">
        {broken || !url ? (
          <span className="text-[11px] font-mono text-[#7C8E85]">Ảnh {index + 1}</span>
        ) : (
          <img
            src={url}
            alt={`Ảnh ${index + 1}`}
            className="w-full h-full object-cover"
            onError={() => setBroken(true)}
          />
        )}

        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#182921]/85 text-[9px] font-mono font-bold text-[#FFF9EA]">
          #{index + 1}
        </span>

        {index === 0 && (
          <span className="absolute bottom-1 left-1 right-1 text-center px-1 py-0.5 rounded bg-[#2B5A47]/90 text-[9px] font-bold text-[#FFF9EA] truncate">
            Ảnh đại diện
          </span>
        )}
      </div>

      <div className="p-1 flex items-center justify-between gap-0.5 border-t border-[#DCEBE2] dark:border-[#343D37] bg-[#F7FCF9] dark:bg-[#242926]">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={disabled || index === 0}
            onClick={onMoveLeft}
            className="p-1 rounded hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] text-[#39755D] dark:text-[#A3BDA8] disabled:opacity-30 cursor-pointer"
            title="Chuyển sang trái"
            aria-label="Chuyển ảnh sang trái"
          >
            <ArrowLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled={disabled || index >= total - 1}
            onClick={onMoveRight}
            className="p-1 rounded hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] text-[#39755D] dark:text-[#A3BDA8] disabled:opacity-30 cursor-pointer"
            title="Chuyển sang phải"
            aria-label="Chuyển ảnh sang phải"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={onReplace}
            className="p-1 rounded hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] text-[#39755D] dark:text-[#A3BDA8] disabled:opacity-40 cursor-pointer"
            title="Thay ảnh này"
            aria-label="Thay ảnh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            className="p-1 rounded hover:bg-[#FBECEE] dark:hover:bg-[#3B292C] text-[#A24057] dark:text-[#E4A6AA] disabled:opacity-40 cursor-pointer"
            title="Xóa ảnh này"
            aria-label="Xóa ảnh"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
