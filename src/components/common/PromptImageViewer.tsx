import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { downloadPromptIllustrationObjectUrl } from '../../services/mediaService';
import { isSafeImageUrl } from '../../utils/contentBlocks';

interface PromptImageViewerProps {
  imagePath?: string;
  imageUrl?: string;
  caption?: string;
  alt?: string;
  className?: string;
}

export function PromptImageViewer({
  imagePath,
  imageUrl,
  caption,
  alt,
  className = '',
}: PromptImageViewerProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const safeExternalUrl = imageUrl && isSafeImageUrl(imageUrl) ? imageUrl.trim() : '';

  useEffect(() => {
    let active = true;
    let createdObjectUrl: string | null = null;

    if (!imagePath?.trim()) {
      setResolvedSrc(safeExternalUrl || null);
      setIsLoading(false);
      setLoadError(null);
      return undefined;
    }

    setIsLoading(true);
    setLoadError(null);

    void (async () => {
      const res = await downloadPromptIllustrationObjectUrl(imagePath);
      if (!active) {
        if (res.objectUrl) URL.revokeObjectURL(res.objectUrl);
        return;
      }
      if (res.ok && res.objectUrl) {
        createdObjectUrl = res.objectUrl;
        setResolvedSrc(res.objectUrl);
        setLoadError(null);
      } else if (safeExternalUrl) {
        setResolvedSrc(safeExternalUrl);
        setLoadError(null);
      } else {
        setResolvedSrc(null);
        setLoadError(res.error || 'Không thể tải hình ảnh minh họa.');
      }
      setIsLoading(false);
    })();

    return () => {
      active = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [imagePath, safeExternalUrl]);

  return (
    <figure className={`space-y-2 ${className}`}>
      <div className="rounded-md border border-[#C3DDCD] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#202423] p-2 sm:p-3 flex items-center justify-center min-h-[120px] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#547264] dark:text-[#B8BDB5] py-6">
            <Loader2 className="w-4 h-4 animate-spin text-[#39755D] dark:text-[#A3BDA8]" />
            <span>Đang tải hình ảnh minh họa...</span>
          </div>
        ) : resolvedSrc && !loadError ? (
          <img
            src={resolvedSrc}
            alt={alt?.trim() || caption?.trim() || 'Hình ảnh minh họa'}
            loading="lazy"
            onError={() => {
              setLoadError('Không thể hiển thị hình ảnh từ nguồn này.');
              setResolvedSrc(null);
            }}
            className="max-h-[440px] w-auto max-w-full rounded object-contain mx-auto"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-5 px-3 text-center text-xs text-[#5B786B] dark:text-[#B8BDB5]">
            <ImageIcon className="w-6 h-6 text-[#789789] dark:text-[#A3BDA8] opacity-75" />
            <span>{loadError || 'Chưa có hình ảnh minh họa hợp lệ.'}</span>
          </div>
        )}
      </div>

      {caption?.trim() && (
        <figcaption className="text-xs text-center text-[#527062] dark:text-[#B8BDB5] italic leading-relaxed break-words px-1">
          {caption.trim()}
        </figcaption>
      )}
    </figure>
  );
}
