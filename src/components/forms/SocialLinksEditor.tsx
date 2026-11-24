import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { CharacterSocialLink, SocialPlatform } from '../../types';
import {
  SOCIAL_PLATFORM_OPTIONS,
  createSocialLinkId,
  detectSocialPlatformFromUrl,
  isSafeExternalHttpUrl,
} from '../../utils/contentBlocks';
import { SocialPlatformIcon } from '../common/SocialPlatformIcon';

interface SocialLinksEditorProps {
  links: CharacterSocialLink[];
  onChange: (nextLinks: CharacterSocialLink[]) => void;
}

export function SocialLinksEditor({ links, onChange }: SocialLinksEditorProps) {
  const [expandedLabelIds, setExpandedLabelIds] = useState<Record<string, boolean>>({});
  const [manualPlatformIds, setManualPlatformIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAddLink = () => {
    const newId = createSocialLinkId();
    onChange([
      ...links,
      {
        id: newId,
        platform: 'website',
        url: '',
      },
    ]);
  };

  const handleUpdateLink = (
    id: string,
    patch: Partial<Pick<CharacterSocialLink, 'platform' | 'url' | 'label'>>,
  ) => {
    onChange(
      links.map((item) => {
        if (item.id !== id) return item;
        const next: CharacterSocialLink = { ...item, ...patch };
        if (typeof patch.url === 'string' && !manualPlatformIds[id]) {
          const detected = detectSocialPlatformFromUrl(patch.url, 'website');
          if (patch.url.trim()) {
            next.platform = detected;
          }
        }
        return next;
      }),
    );
  };

  const handleManualPlatformChange = (id: string, platform: SocialPlatform) => {
    setManualPlatformIds((prev) => ({ ...prev, [id]: true }));
    onChange(links.map((item) => (item.id === id ? { ...item, platform } : item)));
  };

  const handleRemoveLink = (id: string) => {
    setManualPlatformIds((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    onChange(links.filter((item) => item.id !== id));
  };

  const toggleCustomLabel = (id: string) => {
    setExpandedLabelIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyUrl = async (id: string, url: string) => {
    if (!url.trim() || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url.trim());
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1400);
    } catch {
      // Ignore clipboard write rejection
    }
  };

  return (
    <div className="retro-callout-mint p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] uppercase tracking-wider">
            Mạng Xã Hội Liên Kết (Tự nhận diện logo)
          </h4>
          <p className="text-[11px] text-[#587568] dark:text-[#B8BDB5] mt-0.5">
            Dán link để tự động nhận diện nền tảng hoặc chọn thủ công. Có thể để trống.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddLink}
          className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
          <span>Thêm liên kết</span>
        </button>
      </div>

      {links.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#B7D6C4] dark:border-[#49554D] bg-[#FFFDF7]/60 dark:bg-[#202423]/60 px-3 py-3 text-center text-xs text-[#5B786B] dark:text-[#B8BDB5]">
          Chưa có liên kết mạng xã hội nào. Bạn có thể lưu ngay hoặc bấm{' '}
          <button
            type="button"
            onClick={handleAddLink}
            className="font-semibold text-[#2E6B53] dark:text-[#A3BDA8] underline cursor-pointer"
          >
            + Thêm liên kết
          </button>
          .
        </div>
      ) : (
        <div className="space-y-2.5">
          {links.map((link) => {
            const platformMeta =
              SOCIAL_PLATFORM_OPTIONS.find((opt) => opt.id === link.platform) ||
              SOCIAL_PLATFORM_OPTIONS[SOCIAL_PLATFORM_OPTIONS.length - 1];
            const hasCustomLabel = Boolean(link.label && link.label.trim().length > 0);
            const isLabelExpanded = Boolean(expandedLabelIds[link.id] ?? hasCustomLabel);
            const trimmedUrl = link.url.trim();
            const isValidUrl = trimmedUrl.length > 0 && isSafeExternalHttpUrl(trimmedUrl);
            const hasInvalidUrl = trimmedUrl.length > 0 && !isValidUrl;

            return (
              <div
                key={link.id}
                className="rounded-md border border-[#C3DDCD] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#202423] p-2.5 space-y-2"
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Platform dropdown with live detected/selected logo */}
                  <div className="flex items-center gap-1.5 sm:w-44 shrink-0">
                    <div
                      className="w-8 h-8 rounded border border-[#C3DDCD] dark:border-[#49554D] bg-[#E2F3E8]/70 dark:bg-[#292E2B] flex items-center justify-center shrink-0"
                      title={`Nền tảng: ${platformMeta.label}`}
                    >
                      <SocialPlatformIcon platform={link.platform} className="w-4 h-4" />
                    </div>
                    <select
                      value={link.platform}
                      onChange={(e) =>
                        handleManualPlatformChange(link.id, e.target.value as SocialPlatform)
                      }
                      aria-label="Chọn loại mạng xã hội"
                      className="retro-input flex-1 h-8 px-2 text-xs font-semibold cursor-pointer min-w-0"
                    >
                      {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* URL Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => handleUpdateLink(link.id, { url: e.target.value })}
                      placeholder={platformMeta.placeholder}
                      aria-label={`URL ${platformMeta.label}`}
                      className={`retro-input w-full h-8 px-2.5 text-xs font-mono ${
                        hasInvalidUrl ? 'border-red-500 dark:border-[#9A666B]' : ''
                      }`}
                    />
                  </div>

                  {/* Action controls: copy, open, custom label toggle, delete */}
                  <div className="flex items-center justify-end gap-1.5 shrink-0">
                    {isValidUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleCopyUrl(link.id, trimmedUrl)}
                          className="retro-btn h-8 w-8 flex items-center justify-center cursor-pointer"
                          title="Sao chép liên kết"
                          aria-label="Sao chép liên kết"
                        >
                          {copiedId === link.id ? (
                            <Check className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-[#4E6E60] dark:text-[#B8BDB5]" />
                          )}
                        </button>
                        <a
                          href={trimmedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="retro-btn h-8 w-8 flex items-center justify-center cursor-pointer"
                          title="Mở liên kết trong tab mới"
                          aria-label="Mở liên kết"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#4E6E60] dark:text-[#B8BDB5]" />
                        </a>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleCustomLabel(link.id)}
                      className={`retro-btn h-8 px-2 text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                        isLabelExpanded ? 'retro-btn-active' : ''
                      }`}
                      title="Tên hiển thị tùy chỉnh (không bắt buộc)"
                    >
                      {isLabelExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>Tên hiển thị</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      className="retro-btn-danger h-8 w-8 flex items-center justify-center cursor-pointer"
                      title="Xóa liên kết này"
                      aria-label="Xóa liên kết"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {hasInvalidUrl && (
                  <p className="text-[11px] font-medium text-red-700 dark:text-[#E4A6AA]">
                    Vui lòng nhập đường dẫn hợp lệ bắt đầu bằng https:// hoặc http://.
                  </p>
                )}

                {isLabelExpanded && (
                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-1.5 border-t border-[#E1EFE6] dark:border-[#343D37]">
                    <label className="text-[11px] font-semibold text-[#4E6E60] dark:text-[#B8BDB5] shrink-0">
                      Tên hiển thị tùy chỉnh:
                    </label>
                    <input
                      type="text"
                      value={link.label || ''}
                      onChange={(e) => handleUpdateLink(link.id, { label: e.target.value })}
                      placeholder={`Mặc định: ${platformMeta.defaultDisplayName}`}
                      className="retro-input flex-1 h-7 px-2.5 text-xs"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
