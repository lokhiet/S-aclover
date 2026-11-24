import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ImageOff,
  Loader2,
  Maximize2,
} from 'lucide-react';
import type { CharacterImage } from '../../types';
import { resolveCharacterImageUrl } from '../../services/mediaService';
import { copyCharacterImageAsPng } from '../../utils/imageClipboard';
import { ImageLightboxModal } from './ImageLightboxModal';

interface CharacterAvatarThumbProps {
  firstImage?: CharacterImage;
  totalImages: number;
  emojiFallback: string;
  name: string;
  isSelected?: boolean;
}

/**
 * Thumbnail danh sách nhân vật: CHỈ tải đúng ảnh đầu tiên (images[0]) với loading="lazy",
 * không bao giờ tải trước các ảnh 2..5 khi duyệt danh sách.
 */
export function CharacterAvatarThumb({
  firstImage,
  totalImages,
  emojiFallback,
  name,
  isSelected = false,
}: CharacterAvatarThumbProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const imageKey = firstImage
    ? `${firstImage.id}:${firstImage.localId || ''}:${firstImage.storagePath || ''}:${firstImage.url || ''}`
    : '';

  useEffect(() => {
    setFailed(false);
    setResolvedUrl(null);
    if (!firstImage) return;
    let active = true;
    void resolveCharacterImageUrl(firstImage).then((res) => {
      if (!active) return;
      if (res.ok && res.objectUrl) {
        setResolvedUrl(res.objectUrl);
      } else {
        setFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [imageKey, firstImage]);

  if (!firstImage || failed || !resolvedUrl) {
    return (
      <div
        className={`relative w-10 h-10 rounded-md flex items-center justify-center text-lg border transition-colors shrink-0 ${
          isSelected
            ? 'bg-[#FFFDF7] dark:bg-[#292E2B] border-[#9FC4AF] dark:border-[#63806E]'
            : 'bg-[#F4FAF6] dark:bg-[#202423] border-[#D8E9DF] dark:border-[#49554D]'
        }`}
      >
        <span>{emojiFallback || '🍀'}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative w-10 h-10 rounded-md overflow-hidden border shrink-0 bg-[#F4FAF6] dark:bg-[#202423] ${
        isSelected
          ? 'border-[#39755D] dark:border-[#A3BDA8]'
          : 'border-[#B8D7C5] dark:border-[#49554D]'
      }`}
    >
      <img
        src={resolvedUrl}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
      {totalImages > 1 && (
        <span
          className="absolute bottom-0 right-0 px-1 rounded-tl bg-[#182921]/85 text-[9px] font-mono font-bold text-[#FFF9EA] leading-tight"
          title={`${totalImages} ảnh`}
        >
          {totalImages}
        </span>
      )}
    </div>
  );
}

interface CharacterDetailGalleryProps {
  images: CharacterImage[];
  characterName: string;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export function CharacterDetailGallery({
  images,
  characterName,
  onToast,
}: CharacterDetailGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const signature = images
    .map((img) => `${img.id}:${img.localId || ''}:${img.storagePath || ''}:${img.url || ''}`)
    .join('|');

  useEffect(() => {
    setActiveIndex(0);
    setCopyDone(false);
    setResolvedUrls({});
    setFailedIds({});
  }, [signature]);

  useEffect(() => {
    if (images.length === 0) return;
    let active = true;
    const boundedIdx = Math.max(0, Math.min(activeIndex, images.length - 1));
    const current = images[boundedIdx];
    if (!current || resolvedUrls[current.id] || failedIds[current.id]) return;

    setLoadingIds((prev) => ({ ...prev, [current.id]: true }));
    void resolveCharacterImageUrl(current).then((res) => {
      if (!active) return;
      setLoadingIds((prev) => ({ ...prev, [current.id]: false }));
      if (res.ok && res.objectUrl) {
        setResolvedUrls((prev) => ({ ...prev, [current.id]: res.objectUrl! }));
      } else {
        setFailedIds((prev) => ({ ...prev, [current.id]: true }));
      }
    });

    return () => {
      active = false;
    };
  }, [activeIndex, images, resolvedUrls, failedIds]);

  if (images.length === 0) return null;

  const total = images.length;
  const boundedIndex = Math.max(0, Math.min(activeIndex, total - 1));
  const activeImage = images[boundedIndex];
  const activeUrl = resolvedUrls[activeImage.id];
  const isBroken = Boolean(failedIds[activeImage.id]);
  const isLoading = Boolean(loadingIds[activeImage.id]) && !activeUrl && !isBroken;

  const handleCopyImage = async () => {
    if (isCopying) return;
    setIsCopying(true);
    try {
      const res = await copyCharacterImageAsPng(activeImage);
      if (res.ok) {
        setCopyDone(true);
        onToast?.('Đã sao chép ảnh PNG vào Clipboard! 📋', 'success');
        setTimeout(() => setCopyDone(false), 1800);
      } else {
        onToast?.(res.error || 'Không thể sao chép ảnh.', 'error');
      }
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="retro-callout-mint p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] uppercase tracking-wider">
            Thư Viện Ảnh Nhân Vật
          </h4>
          <span className="px-1.5 py-0.5 rounded bg-[#FFFDF7] dark:bg-[#202423] border border-[#B8D7C5] dark:border-[#49554D] text-[10px] font-mono font-bold text-[#2B5A47] dark:text-[#A3BDA8] tabular-nums-mono">
            {boundedIndex + 1}/{total}
          </span>
          {boundedIndex === 0 && (
            <span className="px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] text-[10px] font-semibold text-[#1F533E] dark:text-[#A3BDA8]">
              Ảnh đại diện
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isCopying || isBroken}
            onClick={() => void handleCopyImage()}
            className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Chép ảnh hiện tại (định dạng PNG) vào Clipboard"
          >
            {isCopying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#39755D] dark:text-[#A3BDA8]" />
            ) : copyDone ? (
              <Check className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
            )}
            <span>{copyDone ? 'Đã chép ảnh' : 'Chép ảnh'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            title="Phóng to toàn màn hình"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
            <span>Phóng to</span>
          </button>
        </div>
      </div>

      {/* Main Image Frame */}
      <div className="relative rounded-md border border-[#B8D7C5] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#202423] overflow-hidden flex items-center justify-center min-h-[200px] max-h-[420px]">
        {total > 1 && (
          <button
            type="button"
            onClick={() => setActiveIndex((prev) => (prev - 1 + total) % total)}
            className="absolute left-2 z-10 p-1.5 rounded-full bg-[#FFF9EA]/90 dark:bg-[#202423]/90 hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] text-[#224C3B] dark:text-[#E4E1D8] shadow-sm cursor-pointer"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {isLoading ? (
          <div className="py-16 flex flex-col items-center gap-2 text-[#5B786B] dark:text-[#B8BDB5]">
            <Loader2 className="w-6 h-6 animate-spin text-[#39755D] dark:text-[#A3BDA8]" />
            <span className="text-xs">Đang tải ảnh...</span>
          </div>
        ) : isBroken || !activeUrl ? (
          <div className="py-12 px-4 text-center flex flex-col items-center gap-2">
            <ImageOff className="w-7 h-7 text-[#A35461] dark:text-[#E4A6AA]" />
            <p className="text-xs font-semibold text-[#5B4146] dark:text-[#E4A6AA]">
              Không tải được ảnh {boundedIndex + 1}/{total}.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="w-full flex items-center justify-center cursor-zoom-in group"
            title="Nhấn để phóng to & kéo xem chi tiết"
          >
            <img
              src={activeUrl}
              alt={activeImage.name || `${characterName} - ảnh ${boundedIndex + 1}`}
              loading="lazy"
              onError={() =>
                setFailedIds((prev) => ({ ...prev, [activeImage.id]: true }))
              }
              className="max-h-[400px] w-auto max-w-full object-contain transition-transform duration-150 group-hover:scale-[1.01]"
            />
          </button>
        )}

        {total > 1 && (
          <button
            type="button"
            onClick={() => setActiveIndex((prev) => (prev + 1) % total)}
            className="absolute right-2 z-10 p-1.5 rounded-full bg-[#FFF9EA]/90 dark:bg-[#202423]/90 hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] text-[#224C3B] dark:text-[#E4E1D8] shadow-sm cursor-pointer"
            aria-label="Ảnh tiếp theo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Thumbnails Strip */}
      {total > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {images.map((img, idx) => (
            <div key={img.id} className="contents">
              <GalleryMiniThumb
                image={img}
                index={idx}
                isActive={idx === boundedIndex}
                preloadedUrl={resolvedUrls[img.id]}
                onClick={() => setActiveIndex(idx)}
              />
            </div>
          ))}
        </div>
      )}

      <ImageLightboxModal
        isOpen={isLightboxOpen}
        images={images}
        initialIndex={boundedIndex}
        characterName={characterName}
        onClose={() => setIsLightboxOpen(false)}
        onToast={onToast}
      />
    </div>
  );
}

function GalleryMiniThumb({
  image,
  index,
  isActive,
  preloadedUrl,
  onClick,
}: {
  image: CharacterImage;
  index: number;
  isActive: boolean;
  preloadedUrl?: string;
  onClick: () => void;
}) {
  const [url, setUrl] = useState<string | undefined>(preloadedUrl);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (preloadedUrl) {
      setUrl(preloadedUrl);
      return;
    }
    let active = true;
    void resolveCharacterImageUrl(image).then((res) => {
      if (!active) return;
      if (res.ok && res.objectUrl) setUrl(res.objectUrl);
      else setBroken(true);
    });
    return () => {
      active = false;
    };
  }, [image, preloadedUrl]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-14 h-14 rounded-md overflow-hidden border-2 shrink-0 flex items-center justify-center bg-[#FFFDF7] dark:bg-[#202423] transition cursor-pointer ${
        isActive
          ? 'border-[#39755D] dark:border-[#A3BDA8]'
          : 'border-[#CFE2D6] dark:border-[#49554D] opacity-75 hover:opacity-100'
      }`}
      aria-label={`Xem ảnh ${index + 1}`}
    >
      {broken || !url ? (
        <span className="text-[11px] font-mono text-[#5B786B] dark:text-[#B8BDB5]">
          {index + 1}
        </span>
      ) : (
        <img
          src={url}
          alt={`Ảnh ${index + 1}`}
          loading="lazy"
          onError={() => setBroken(true)}
          className="w-full h-full object-cover"
        />
      )}
      {index === 0 && (
        <span className="absolute bottom-0 inset-x-0 bg-[#2B5A47]/85 text-[8px] font-bold text-[#FFF9EA] text-center py-0.5 leading-none">
          Đại diện
        </span>
      )}
    </button>
  );
}
