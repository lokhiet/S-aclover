import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ImageOff,
  Loader2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CharacterImage } from '../../types';
import { resolveCharacterImageUrl } from '../../services/mediaService';
import { copyCharacterImageAsPng } from '../../utils/imageClipboard';

interface ImageLightboxModalProps {
  isOpen: boolean;
  images: CharacterImage[];
  initialIndex?: number;
  characterName?: string;
  onClose: () => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clampScale(val: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(val.toFixed(2))));
}

export function ImageLightboxModal({
  isOpen,
  images,
  initialIndex = 0,
  characterName,
  onClose,
  onToast,
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [isCopying, setIsCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; startScale: number } | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const resetZoomPan = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const bounded = Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1)));
    setCurrentIndex(bounded);
    resetZoomPan();
    setCopyDone(false);
  }, [isOpen, initialIndex, images.length, resetZoomPan]);

  // Lock body scroll while lightbox is open and restore faithfully
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Resolve URL for active image + preload neighbors cleanly
  useEffect(() => {
    if (!isOpen || images.length === 0) return;
    let active = true;
    const targets = [
      images[currentIndex],
      images[currentIndex - 1],
      images[currentIndex + 1],
    ].filter((img): img is CharacterImage => Boolean(img));

    for (const img of targets) {
      if (resolvedUrls[img.id] || failedIds[img.id]) continue;
      setLoadingIds((prev) => ({ ...prev, [img.id]: true }));
      void resolveCharacterImageUrl(img).then((res) => {
        if (!active) return;
        setLoadingIds((prev) => ({ ...prev, [img.id]: false }));
        if (res.ok && res.objectUrl) {
          setResolvedUrls((prev) => ({ ...prev, [img.id]: res.objectUrl! }));
        } else {
          setFailedIds((prev) => ({ ...prev, [img.id]: true }));
        }
      });
    }

    return () => {
      active = false;
    };
  }, [isOpen, currentIndex, images, resolvedUrls, failedIds]);

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    resetZoomPan();
  }, [images.length, resetZoomPan]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    resetZoomPan();
  }, [images.length, resetZoomPan]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => clampScale(prev + 0.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = clampScale(prev - 0.5);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Keyboard shortcuts isolated while Lightbox open
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoomPan();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose, goPrev, goNext, handleZoomIn, handleZoomOut, resetZoomPan]);

  if (!isOpen || images.length === 0) return null;

  const activeImage = images[currentIndex] || images[0];
  const activeUrl = resolvedUrls[activeImage.id];
  const isBroken = Boolean(failedIds[activeImage.id]);
  const isLoading = Boolean(loadingIds[activeImage.id]) && !activeUrl && !isBroken;
  const total = images.length;

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setScale((prev) => {
      const next = clampScale(prev + delta);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values()) as Array<{ x: number; y: number }>;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { distance: dist, startScale: scale };
      dragStateRef.current = null;
      return;
    }

    if (scale > 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStateRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: offset.x,
        originY: offset.y,
      };
    } else if (total > 1) {
      swipeStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(activePointersRef.current.values()) as Array<{ x: number; y: number }>;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchRef.current.distance > 0) {
        const nextScale = clampScale(
          pinchRef.current.startScale * (dist / pinchRef.current.distance),
        );
        setScale(nextScale);
        if (nextScale <= 1) setOffset({ x: 0, y: 0 });
      }
      return;
    }

    if (dragStateRef.current?.active && dragStateRef.current.pointerId === e.pointerId) {
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      setOffset({
        x: dragStateRef.current.originX + dx,
        y: dragStateRef.current.originY + dy,
      });
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
    }

    if (scale === 1 && swipeStartRef.current && total > 1) {
      const dx = e.clientX - swipeStartRef.current.x;
      const dy = e.clientY - swipeStartRef.current.y;
      if (Math.abs(dx) > 55 && Math.abs(dy) < 60) {
        if (dx > 0) goPrev();
        else goNext();
      }
    }
    swipeStartRef.current = null;
  };

  const handleCopyCurrentImage = async () => {
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
    <div
      className="fixed inset-0 z-[70] bg-[#0F1613]/92 flex flex-col select-none animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem ảnh nhân vật ${characterName || ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Toolbar */}
      <div className="px-3 sm:px-5 py-2.5 bg-[#161D1A]/90 border-b border-[#34423B] flex items-center justify-between gap-2 text-[#E4E1D8] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {characterName && (
            <span className="text-xs sm:text-sm font-bold truncate max-w-[180px] sm:max-w-xs">
              {characterName}
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-[#25302B] border border-[#3E5047] text-[11px] font-mono font-bold text-[#A3BDA8] tabular-nums-mono shrink-0">
            {currentIndex + 1}/{total}
          </span>
          {currentIndex === 0 && total > 1 && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#2B5A47]/60 border border-[#497B63] text-[10px] font-semibold text-[#D6EDE0]">
              Ảnh đại diện
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Zoom Controls */}
          <div className="flex items-center rounded border border-[#3E5047] bg-[#202724] overflow-hidden">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= MIN_SCALE}
              className="p-1.5 hover:bg-[#2F3B35] disabled:opacity-40 cursor-pointer"
              title="Thu nhỏ (-)"
              aria-label="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-mono font-semibold text-[#A3BDA8] tabular-nums-mono">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= MAX_SCALE}
              className="p-1.5 hover:bg-[#2F3B35] disabled:opacity-40 cursor-pointer"
              title="Phóng to (+)"
              aria-label="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetZoomPan}
              disabled={scale === 1 && offset.x === 0 && offset.y === 0}
              className="p-1.5 border-l border-[#3E5047] hover:bg-[#2F3B35] disabled:opacity-40 cursor-pointer"
              title="Khôi phục kích thước gốc (0)"
              aria-label="Đặt lại phóng to"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy PNG Button */}
          <button
            type="button"
            disabled={isCopying || isBroken}
            onClick={() => void handleCopyCurrentImage()}
            className="px-2.5 py-1.5 rounded border border-[#497B63] bg-[#2B5A47] hover:bg-[#356D56] text-xs font-bold text-[#FFF9EA] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title="Sao chép ảnh định dạng PNG vào Clipboard"
          >
            {isCopying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : copyDone ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copyDone ? 'Đã chép' : 'Chép ảnh'}</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded border border-[#3E5047] bg-[#202724] hover:bg-[#2F3B35] text-[#E4E1D8] cursor-pointer"
            title="Đóng (Esc)"
            aria-label="Đóng cửa sổ xem ảnh"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Stage */}
      <div
        ref={stageRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onClick={(e) => {
          if (e.target === stageRef.current && scale === 1) onClose();
        }}
        className={`relative flex-1 overflow-hidden flex items-center justify-center touch-none ${
          scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      >
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-2 sm:left-4 z-20 p-2 sm:p-2.5 rounded-full bg-[#18201C]/85 hover:bg-[#2B5A47] border border-[#496155] text-[#FFF9EA] cursor-pointer transition"
            title="Ảnh trước (←)"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-[#A3BDA8]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs font-medium">Đang tải ảnh {currentIndex + 1}/{total}...</span>
          </div>
        ) : isBroken || !activeUrl ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 rounded-lg bg-[#1A221E] border border-[#3E5047] text-center max-w-xs">
            <ImageOff className="w-8 h-8 text-[#9A666B]" />
            <p className="text-xs font-semibold text-[#E4E1D8]">
              Không thể hiển thị ảnh {currentIndex + 1}/{total}
            </p>
            <p className="text-[11px] text-[#9EA8A1]">
              Ảnh có thể đang ở chế độ riêng tư hoặc đường dẫn không khả dụng.
            </p>
          </div>
        ) : (
          <img
            src={activeUrl}
            alt={activeImage.name || `${characterName || 'Nhân vật'} - ảnh ${currentIndex + 1}`}
            draggable={false}
            onError={() =>
              setFailedIds((prev) => ({ ...prev, [activeImage.id]: true }))
            }
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (scale > 1) resetZoomPan();
              else setScale(2);
            }}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transformOrigin: 'center center',
            }}
            className="max-h-[82vh] max-w-[92vw] object-contain rounded shadow-2xl transition-transform duration-75 ease-out will-change-transform"
          />
        )}

        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-2 sm:right-4 z-20 p-2 sm:p-2.5 rounded-full bg-[#18201C]/85 hover:bg-[#2B5A47] border border-[#496155] text-[#FFF9EA] cursor-pointer transition"
            title="Ảnh tiếp theo (→)"
            aria-label="Ảnh tiếp theo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {total > 1 && (
        <div className="px-4 py-2.5 bg-[#161D1A]/90 border-t border-[#34423B] flex items-center justify-center gap-2 overflow-x-auto shrink-0">
          {images.map((img, idx) => (
            <div key={img.id} className="contents">
              <LightboxThumbItem
                image={img}
                index={idx}
                isActive={idx === currentIndex}
                resolvedUrl={resolvedUrls[img.id]}
                isBroken={Boolean(failedIds[img.id])}
                onSelect={() => {
                  setCurrentIndex(idx);
                  resetZoomPan();
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LightboxThumbItem({
  image,
  index,
  isActive,
  resolvedUrl,
  isBroken,
  onSelect,
}: {
  image: CharacterImage;
  index: number;
  isActive: boolean;
  resolvedUrl?: string;
  isBroken: boolean;
  onSelect: () => void;
}) {
  const [url, setUrl] = useState<string | undefined>(resolvedUrl);
  const [broken, setBroken] = useState(isBroken);

  useEffect(() => {
    if (resolvedUrl) {
      setUrl(resolvedUrl);
      return;
    }
    if (isBroken) {
      setBroken(true);
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
  }, [image, resolvedUrl, isBroken]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-12 h-12 rounded-md overflow-hidden border-2 transition cursor-pointer shrink-0 flex items-center justify-center bg-[#232B27] ${
        isActive
          ? 'border-[#A3BDA8] scale-105 shadow'
          : 'border-transparent opacity-65 hover:opacity-100'
      }`}
      aria-label={`Chọn ảnh ${index + 1}`}
    >
      {broken || !url ? (
        <span className="text-[10px] font-mono text-[#9EA8A1]">{index + 1}</span>
      ) : (
        <img
          src={url}
          alt={`Ảnh thu nhỏ ${index + 1}`}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
      {index === 0 && (
        <span className="absolute bottom-0 inset-x-0 bg-[#1B3A2C]/85 text-[8px] font-bold text-[#E2F3E8] text-center leading-tight py-0.5">
          Chính
        </span>
      )}
    </button>
  );
}
