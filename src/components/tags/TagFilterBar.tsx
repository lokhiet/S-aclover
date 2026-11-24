import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { toTagComparisonKey, type TagCatalogEntry } from '../../utils/tagSystem';

interface TagFilterBarProps {
  catalog: TagCatalogEntry[];
  selectedTags: string[];
  onToggleTag: (label: string) => void;
  onRemoveTag: (label: string) => void;
  onClearAll: () => void;
  onOpenAllTags: () => void;
  isAdmin?: boolean;
}

export function TagFilterBar({
  catalog,
  selectedTags,
  onToggleTag,
  onRemoveTag,
  onClearAll,
  onOpenAllTags,
  isAdmin = false,
}: TagFilterBarProps) {
  const popularTags = catalog.filter((c) => c.count > 0).slice(0, 7);
  const activeCount = catalog.filter((c) => c.count > 0).length;
  const selectedKeySet = new Set(selectedTags.map((t) => toTagComparisonKey(t)));

  return (
    <div className="px-2.5 py-2 border-b border-[#E3EFE7] dark:border-[#49554D] space-y-1.5 bg-[#FAF6EA]/60 dark:bg-[#292E2B]/60">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        <button
          type="button"
          onClick={onOpenAllTags}
          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition ${
            selectedTags.length > 0
              ? 'border-[#39755D] bg-[#E2F3E8] text-[#224C3B] dark:bg-[#343D37] dark:text-[#E4E1D8] dark:border-[#A3BDA8]'
              : 'border-[#9FC4AF] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#202423] text-[#2B5A47] dark:text-[#A3BDA8] hover:bg-[#E2F3E8]/60 dark:hover:bg-[#343D37]'
          }`}
          title="Mở toàn bộ danh sách tag & bộ lọc"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>{isAdmin ? 'Tất cả tag / QL' : 'Xem tất cả tag'}</span>
          <span className="text-[10px] opacity-80 tabular-nums-mono">({activeCount})</span>
        </button>

        {popularTags.map((entry) => {
          const isSelected = selectedKeySet.has(entry.key);
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => onToggleTag(entry.label)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                isSelected
                  ? 'border-[#39755D] bg-[#39755D] text-[#FFF9EA] dark:bg-[#A3BDA8] dark:text-[#1D2421] dark:border-[#A3BDA8]'
                  : 'border-[#CFE2D6] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#202423] text-[#4C6A5C] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/55 dark:hover:bg-[#343D37]'
              }`}
            >
              <span>#{entry.label}</span>
              <span className="text-[10px] opacity-80 tabular-nums-mono">({entry.count})</span>
            </button>
          );
        })}
      </div>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-semibold text-[#527062] dark:text-[#B8BDB5]">
            Đang lọc ({selectedTags.length}):
          </span>
          {selectedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onRemoveTag(tag)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#F2CDDA]/45 dark:bg-[#343D37] text-[#6B374B] dark:text-[#D9A7B8] rounded border border-[#E5B6C6] dark:border-[#49554D] hover:opacity-85 cursor-pointer transition text-[10px] font-semibold"
              title={`Bỏ lọc #${tag}`}
            >
              <span>#{tag}</span>
              <X className="w-2.5 h-2.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-[10px] font-semibold text-red-700 dark:text-[#E4A6AA] hover:underline cursor-pointer ml-1"
          >
            Xóa lọc
          </button>
        </div>
      )}
    </div>
  );
}
