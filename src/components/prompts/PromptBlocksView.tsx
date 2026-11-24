import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Image as ImageIcon,
  Info,
  Terminal,
} from 'lucide-react';
import type { PromptBlock } from '../../types';
import {
  collectPromptTextsForCopyAll,
  computeBlockStepNumbers,
} from '../../utils/contentBlocks';
import { PromptImageViewer } from '../common/PromptImageViewer';

interface PromptBlocksViewProps {
  postKey: string;
  title?: string;
  description?: string;
  howToUse?: string;
  blocks: PromptBlock[];
  autoNumberSteps?: boolean;
  defaultPromptsExpanded?: boolean;
  onCopyText: (text: string, label: string) => void;
}

export function PromptBlocksView({
  postKey,
  title,
  description,
  howToUse,
  blocks,
  autoNumberSteps = false,
  defaultPromptsExpanded = false,
  onCopyText,
}: PromptBlocksViewProps) {
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setVisibleMap({});
  }, [postKey]);

  const stepNumbers = computeBlockStepNumbers(blocks, autoNumberSteps);
  const promptBlocks = blocks.filter(
    (b) => (b.type || 'prompt') === 'prompt' && b.content.trim().length > 0,
  );
  const copyAllText = collectPromptTextsForCopyAll(blocks);

  const isBlockVisible = (blockKey: string) => {
    if (blockKey in visibleMap) return visibleMap[blockKey];
    return defaultPromptsExpanded;
  };

  const toggleBlockVisibility = (blockKey: string) => {
    setVisibleMap((prev) => ({
      ...prev,
      [blockKey]: !isBlockVisible(blockKey),
    }));
  };

  const allPromptsVisible =
    promptBlocks.length > 0 &&
    promptBlocks.every((b, idx) => {
      const key = b.id || `block-${idx}`;
      return isBlockVisible(key);
    });

  const handleToggleAllPrompts = () => {
    const nextOpen = !allPromptsVisible;
    const nextMap: Record<string, boolean> = {};
    blocks.forEach((b, idx) => {
      if ((b.type || 'prompt') === 'prompt') {
        nextMap[b.id || `block-${idx}`] = nextOpen;
      }
    });
    setVisibleMap(nextMap);
  };

  return (
    <div className="space-y-3.5 min-w-0">
      {/* Overview Description */}
      {description?.trim() && (
        <div className="retro-callout-mint p-4 space-y-1.5">
          <h4 className="text-xs font-bold text-[#255442] dark:text-[#A3BDA8] flex items-center gap-1.5 uppercase tracking-wide">
            <Info className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
            <span>Mô tả tổng quan</span>
          </h4>
          <p className="text-xs sm:text-sm text-[#2A4539] dark:text-[#E4E1D8] leading-relaxed whitespace-pre-wrap break-words">
            {description.trim()}
          </p>
        </div>
      )}

      {/* Legacy How To Use (preserved for built-in library prompts) */}
      {howToUse?.trim() && (
        <div className="retro-callout-warm p-4 space-y-1.5">
          <h4 className="text-xs font-bold text-[#6E5120] dark:text-[#D5B97A] flex items-center gap-1.5 uppercase tracking-wide">
            <BookOpen className="w-3.5 h-3.5 text-[#9C742E] dark:text-[#D5B97A] flex-shrink-0" />
            <span>Hướng dẫn sử dụng</span>
          </h4>
          <p className="text-xs sm:text-sm text-[#3A3528] dark:text-[#E4E1D8] leading-relaxed whitespace-pre-wrap break-words">
            {howToUse.trim()}
          </p>
        </div>
      )}

      {/* Quick Action Bar for Prompts (Copy All + Expand/Collapse All) */}
      {promptBlocks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-0.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#224C3B] dark:text-[#A3BDA8] uppercase tracking-wider">
            <Terminal className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
            <span>
              Nội dung bài đăng ({blocks.length} khối
              {promptBlocks.length > 0 ? ` • ${promptBlocks.length} câu lệnh` : ''})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleAllPrompts}
              className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {allPromptsVisible ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                  <span>Ẩn tất cả lệnh</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                  <span>Hiện tất cả lệnh</span>
                </>
              )}
            </button>

            {copyAllText && (
              <button
                type="button"
                onClick={() =>
                  onCopyText(
                    copyAllText,
                    title
                      ? `Tất cả câu lệnh (${title})`
                      : 'Tất cả câu lệnh',
                  )
                }
                className="retro-btn-primary px-3 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>
                  {promptBlocks.length > 1
                    ? `Copy tất cả câu lệnh (${promptBlocks.length})`
                    : 'Copy câu lệnh'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ordered Content Blocks */}
      {blocks.length === 0 ? (
        <div className="retro-window p-5 text-center text-xs text-[#587568] dark:text-[#B8BDB5]">
          Bài đăng này chưa có khối nội dung nào.
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, index) => {
            const type = block.type || 'prompt';
            const stepNum = stepNumbers[index];
            const blockKey = block.id || `block-${index}`;

            if (type === 'heading') {
              return (
                <div
                  key={blockKey}
                  className="pt-2 pb-1"
                >
                  <div className="rounded-md border border-[#A8CEB8] dark:border-[#49554D] border-l-4 border-l-[#39755D] dark:border-l-[#A3BDA8] bg-[#E8F5ED] dark:bg-[#292E2B] px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
                      <h3 className="text-sm font-bold text-[#1F4A39] dark:text-[#E4E1D8] break-words">
                        {block.label || 'Phân mục'}
                      </h3>
                    </div>
                    {block.content?.trim() && (
                      <p className="mt-1 text-xs text-[#4C6A5C] dark:text-[#B8BDB5] whitespace-pre-wrap break-words leading-relaxed">
                        {block.content.trim()}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            if (type === 'guide') {
              return (
                <div key={blockKey} className="retro-callout-mint p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {stepNum !== null ? (
                        <span className="w-5 h-5 rounded bg-[#39755D] dark:bg-[#343D37] text-[#FFF9EA] dark:text-[#A3BDA8] dark:border dark:border-[#49554D] text-[10px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                          {stepNum}
                        </span>
                      ) : (
                        <BookOpen className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
                      )}
                      <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#A3BDA8] uppercase tracking-wide break-words">
                        {stepNum !== null && !block.label.trim().toLowerCase().startsWith('bước')
                          ? `Bước ${stepNum}: ${block.label || 'Hướng dẫn'}`
                          : block.label || 'Hướng dẫn'}
                      </h4>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FFF9EA] dark:bg-[#202423] text-[#39755D] dark:text-[#A3BDA8] border border-[#B8D7C5] dark:border-[#49554D] shrink-0">
                      Hướng dẫn
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-[#294338] dark:text-[#E4E1D8] leading-relaxed whitespace-pre-wrap break-words">
                    {block.content}
                  </div>
                </div>
              );
            }

            if (type === 'note') {
              return (
                <div key={blockKey} className="retro-callout-warm p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#9C742E] dark:text-[#D5B97A] flex-shrink-0" />
                      <h4 className="text-xs font-bold text-[#6E5120] dark:text-[#D5B97A] uppercase tracking-wide break-words">
                        {block.label || 'Lưu ý quan trọng'}
                      </h4>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FFFDF6] dark:bg-[#202423] text-[#7D5C22] dark:text-[#D5B97A] border border-[#DECBA4] dark:border-[#49554D] shrink-0">
                      Lưu ý
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-[#3A3528] dark:text-[#E4E1D8] leading-relaxed whitespace-pre-wrap break-words">
                    {block.content}
                  </div>
                </div>
              );
            }

            if (type === 'example') {
              return (
                <div key={blockKey} className="retro-callout-blush p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-[#934D67] dark:text-[#D9A7B8] flex-shrink-0" />
                      <h4 className="text-xs font-bold text-[#7A3B53] dark:text-[#D9A7B8] uppercase tracking-wide break-words">
                        {block.label || 'Ví dụ minh họa'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FFFDF8] dark:bg-[#202423] text-[#7A3B53] dark:text-[#D9A7B8] border border-[#E4BECB] dark:border-[#49554D]">
                        Ví dụ
                      </span>
                      {block.content.trim() && (
                        <button
                          type="button"
                          onClick={() => onCopyText(block.content, block.label || 'Ví dụ minh họa')}
                          className="retro-btn px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-[#39755D] dark:text-[#A3BDA8]" />
                          <span>Copy</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="rounded border border-[#E4BECB] dark:border-[#49554D] bg-[#FFFDF9]/85 dark:bg-[#202423] p-3 text-xs sm:text-[13px] text-[#3B262F] dark:text-[#E4E1D8] leading-relaxed whitespace-pre-wrap break-words">
                    {block.content}
                  </div>
                </div>
              );
            }

            if (type === 'image') {
              return (
                <div key={blockKey} className="retro-window overflow-hidden">
                  <div className="retro-window-header px-4 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ImageIcon className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
                      <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] truncate">
                        {block.label || 'Hình ảnh minh họa'}
                      </h4>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FFF9EA] dark:bg-[#202423] text-[#39755D] dark:text-[#A3BDA8] border border-[#B8D7C5] dark:border-[#49554D]">
                      Hình ảnh
                    </span>
                  </div>
                  <div className="p-3.5">
                    <PromptImageViewer
                      imagePath={block.imagePath}
                      imageUrl={block.imageUrl}
                      caption={block.imageCaption || block.content}
                      alt={block.imageAlt || block.label}
                    />
                  </div>
                </div>
              );
            }

            // Default: 'prompt' block
            const isOpen = isBlockVisible(blockKey);
            const displayTitle =
              stepNum !== null && !block.label.trim().toLowerCase().startsWith('bước')
                ? `Bước ${stepNum}: ${block.label || 'Câu lệnh'}`
                : block.label || 'Khối câu lệnh';

            return (
              <div key={blockKey} className="retro-window overflow-hidden">
                <div className="retro-window-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {stepNum !== null ? (
                      <span className="w-5 h-5 rounded bg-[#39755D] dark:bg-[#343D37] text-[#FFF9EA] dark:text-[#A3BDA8] dark:border dark:border-[#49554D] text-[10px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                        {stepNum}
                      </span>
                    ) : (
                      <Terminal className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
                    )}
                    <span className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] break-words">
                      {displayTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBlockVisibility(blockKey)}
                      className={`retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                        isOpen ? 'retro-btn-active' : ''
                      }`}
                      title={isOpen ? 'Ẩn nội dung câu lệnh' : 'Hiện nội dung câu lệnh'}
                    >
                      {isOpen ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                          <span>Ẩn lệnh</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                          <span>Hiện lệnh</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onCopyText(block.content, displayTitle)}
                      className="retro-btn-primary px-2.5 py-1 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                      title="Sao chép riêng khối câu lệnh này"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy lệnh</span>
                    </button>
                  </div>
                </div>

                {!isOpen && (
                  <div className="px-4 py-2 bg-[#FAF6EA]/80 dark:bg-[#202423] flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-[#668476] dark:text-[#B8BDB5]">
                      Bấm “Hiện lệnh” để xem chi tiết hoặc “Copy lệnh” để sao chép ngay
                    </span>
                  </div>
                )}

                {isOpen && (
                  <div className="p-3.5 space-y-2.5">
                    {block.note?.trim() && (
                      <div className="rounded border border-[#DECBA4] dark:border-[#49554D] bg-[#FDF6E4] dark:bg-[#202423] px-3 py-1.5 text-[11px] text-[#6E5120] dark:text-[#D5B97A]">
                        <strong>Gợi ý:</strong> {block.note.trim()}
                      </div>
                    )}
                    <pre className="retro-code-box p-3.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words select-all m-0">
                      {block.content}
                    </pre>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onCopyText(block.content, displayTitle)}
                        className="retro-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy câu lệnh này</span>
                      </button>
                    </div>
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
