import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Plus,
  Sparkles,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import type { SharedTag } from '../../types';
import {
  dedupeTags,
  findMatchingExistingTags,
  findNormalizationSuggestion,
  normalizeTagDisplay,
  toTagComparisonKey,
  type TagCatalogEntry,
  type TagSuggestionMatch,
} from '../../utils/tagSystem';
import { analyzeSmartTagsClient, type SmartTagAnalysisResult } from '../../utils/smartTagEngine';

interface TagInputEditorProps {
  tags: string[];
  onChange: (nextTags: string[]) => void;
  availableCatalog: TagCatalogEntry[];
  sharedTags?: SharedTag[];
  aiContext: {
    targetType: 'character' | 'note' | 'library_prompt' | 'idea';
    title: string;
    description?: string;
    content: string;
  };
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
}

export function TagInputEditor({
  tags,
  onChange,
  availableCatalog,
  sharedTags = [],
  aiContext,
  onToast,
  label = 'Tags phân loại (Khuyến nghị 3–5 tag)',
  placeholder = 'Nhập tag rồi nhấn Enter hoặc dấu phẩy...',
  helperText,
}: TagInputEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [normHint, setNormHint] = useState<{
    enteredTag: string;
    suggestion: TagSuggestionMatch;
  } | null>(null);

  const [suggestMessage, setSuggestMessage] = useState<string | null>(null);
  const [suggestResult, setSuggestResult] = useState<SmartTagAnalysisResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => findMatchingExistingTags(inputValue, availableCatalog, sharedTags, tags, 8),
    [inputValue, availableCatalog, sharedTags, tags],
  );

  const addTag = (raw: string, opts: { checkSuggestion?: boolean } = { checkSuggestion: true }) => {
    const clean = normalizeTagDisplay(raw);
    if (!clean) return;

    const cleanKey = toTagComparisonKey(clean);
    if (!cleanKey) return;

    if (tags.some((t) => toTagComparisonKey(t) === cleanKey)) {
      setInputValue('');
      return;
    }

    const next = dedupeTags([...tags, clean]);
    onChange(next);
    setInputValue('');

    if (opts.checkSuggestion) {
      const suggestion = findNormalizationSuggestion(clean, availableCatalog, sharedTags);
      if (suggestion && suggestion.entry.label !== clean) {
        setNormHint({ enteredTag: clean, suggestion });
      } else {
        setNormHint(null);
      }
    } else {
      setNormHint(null);
    }
  };

  const removeTag = (target: string) => {
    const targetKey = toTagComparisonKey(target);
    onChange(tags.filter((t) => toTagComparisonKey(t) !== targetKey));
    if (normHint && toTagComparisonKey(normHint.enteredTag) === targetKey) {
      setNormHint(null);
    }
  };

  const handleApplyNormalization = () => {
    if (!normHint) return;
    const { enteredTag, suggestion } = normHint;
    const enteredKey = toTagComparisonKey(enteredTag);
    const replaced = dedupeTags(
      tags.map((t) => (toTagComparisonKey(t) === enteredKey ? suggestion.entry.label : t)),
    );
    onChange(replaced);
    setNormHint(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleTriggerSmartSuggest = () => {
    setSuggestMessage(null);
    const combinedText = `${aiContext.title} ${aiContext.description || ''} ${aiContext.content}`.trim();
    if (combinedText.length < 6) {
      setSuggestResult(null);
      setSuggestMessage('Hãy nhập tiêu đề hoặc một ít nội dung trước khi gợi ý tag tự động.');
      return;
    }

    const analysis = analyzeSmartTagsClient({
      title: aiContext.title,
      description: aiContext.description,
      content: aiContext.content,
      targetType: aiContext.targetType,
      availableCatalog,
      sharedTags,
      currentTags: tags,
      maxTags: 5,
    });

    if (!analysis.hasEnoughEvidence || analysis.suggestedTags.length === 0) {
      setSuggestResult(null);
      setSuggestMessage(
        'Chưa đủ từ khóa đặc trưng để gợi ý tag tự động (hệ thống không gắn tag tùy tiện). Bạn có thể tự nhập tag ở ô bên dưới.',
      );
      return;
    }

    setSuggestResult(analysis);
  };

  const applyAllSuggestedTags = () => {
    if (!suggestResult) return;
    const merged = dedupeTags([...tags, ...suggestResult.suggestedTags]);
    onChange(merged);
    onToast?.('Đã thêm các tag phù hợp (vẫn giữ nguyên tag bạn đã chọn).', 'success');
  };

  const countStatus =
    tags.length === 0
      ? 'Chưa gắn tag'
      : tags.length <= 5
        ? `${tags.length}/5 tag (tối ưu)`
        : `${tags.length} tag (nên gọn còn 3–5 tag)`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8] flex items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-mono text-[#587568] dark:text-[#B8BDB5]">
            {countStatus}
          </span>
          <button
            type="button"
            onClick={handleTriggerSmartSuggest}
            className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            title="Phân tích từ khóa & đồng nghĩa từ tiêu đề, mô tả, nội dung để gợi ý tag sẵn có"
          >
            <Sparkles className="w-3 h-3 text-[#39755D] dark:text-[#A3BDA8]" />
            <span>Gợi ý tag tự động</span>
          </button>
        </div>
      </div>

      {/* Selected Tags + Input Box */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="retro-callout-mint p-2.5 space-y-2 cursor-text"
      >
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#9FC4AF] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#292E2B] text-[#224C3B] dark:text-[#E4E1D8] text-xs font-semibold"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="text-[#587568] hover:text-red-600 dark:text-[#B8BDB5] dark:hover:text-[#E4A6AA] cursor-pointer"
                  aria-label={`Xóa tag ${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 180)}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="retro-input flex-1 px-2.5 py-1.5 text-xs font-medium"
          />
          <button
            type="button"
            onClick={() => {
              if (inputValue.trim()) addTag(inputValue);
            }}
            disabled={!inputValue.trim()}
            className="retro-btn px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-45"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>

          {/* Live Autocomplete Dropdown */}
          {isFocused && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#FFF9EA] dark:bg-[#292E2B] border border-[#9FC4AF] dark:border-[#49554D] rounded-md shadow-md max-h-52 overflow-y-auto">
              <div className="px-2.5 py-1 border-b border-[#DCECE2] dark:border-[#49554D] bg-[#EEF7F1] dark:bg-[#202423] text-[10px] font-semibold text-[#4B6C5E] dark:text-[#B8BDB5]">
                {inputValue.trim()
                  ? 'Gợi ý tag sẵn có (ưu tiên tái sử dụng)'
                  : 'Tag phổ biến sẵn có'}
              </div>
              {suggestions.map(({ entry, matchType, matchedHint }) => (
                <button
                  key={entry.key}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(entry.label, { checkSuggestion: false });
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <span className="font-semibold text-[#224C3B] dark:text-[#E4E1D8] truncate">
                    #{entry.label}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0 text-[10px] text-[#587568] dark:text-[#B8BDB5]">
                    {matchType === 'exact' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#285B47] dark:text-[#A3BDA8]">
                        Sẵn có
                      </span>
                    )}
                    {matchType === 'alias' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#285B47] dark:text-[#A3BDA8]">
                        Khớp: {matchedHint}
                      </span>
                    )}
                    {matchType === 'synonym' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#F2CDDA]/50 dark:bg-[#343D37] text-[#7A3F55] dark:text-[#D9A7B8]">
                        Cùng ý nghĩa
                      </span>
                    )}
                    <span className="tabular-nums-mono opacity-80">({entry.count})</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gentle Non-destructive Normalization Suggestion */}
      {normHint && (
        <div className="retro-callout-warm px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-[#4A3B23] dark:text-[#E4E1D8]">
            Tag <strong>#{normHint.enteredTag}</strong> gần nghĩa với tag sẵn có{' '}
            <strong>#{normHint.suggestion.entry.label}</strong> ({normHint.suggestion.entry.count} bài). Bạn muốn chuẩn hóa không?
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleApplyNormalization}
              className="retro-btn-primary px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              Dùng #{normHint.suggestion.entry.label}
            </button>
            <button
              type="button"
              onClick={() => setNormHint(null)}
              className="retro-btn px-2 py-0.5 text-[11px] font-semibold cursor-pointer"
            >
              Giữ nguyên
            </button>
          </div>
        </div>
      )}

      {suggestMessage && (
        <p className="retro-callout-warm px-3 py-2 text-[#5F4D31] dark:text-[#E4E1D8] text-[11px] font-medium">
          {suggestMessage}
        </p>
      )}

      {/* Client-side Suggested Tags Preview */}
      {suggestResult && suggestResult.suggestedTags.length > 0 && (
        <div className="retro-callout-mint p-2.5 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-[#224C3B] dark:text-[#A3BDA8] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Tag gợi ý từ nội dung &amp; từ khóa
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={applyAllSuggestedTags}
                className="retro-btn-primary px-2 py-0.5 text-[10.5px] font-semibold cursor-pointer"
              >
                Thêm tất cả
              </button>
              <button
                type="button"
                onClick={() => setSuggestResult(null)}
                className="retro-btn px-1.5 py-0.5 text-[10.5px] cursor-pointer"
                aria-label="Đóng gợi ý tag"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {suggestResult.suggestedTags.map((st) => {
              const alreadyAdded = tags.some(
                (t) => toTagComparisonKey(t) === toTagComparisonKey(st),
              );
              return (
                <button
                  key={st}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addTag(st, { checkSuggestion: false })}
                  className={`px-2 py-0.5 rounded border text-[11px] font-semibold flex items-center gap-1 transition ${
                    alreadyAdded
                      ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#9FC4AF] dark:border-[#49554D] text-[#39755D] dark:text-[#A3BDA8] opacity-75 cursor-default'
                      : 'bg-[#FFF9EA] dark:bg-[#292E2B] border-[#39755D] dark:border-[#A3BDA8] text-[#224C3B] dark:text-[#E4E1D8] hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] cursor-pointer'
                  }`}
                >
                  {alreadyAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  <span>#{st}</span>
                </button>
              );
            })}
          </div>

          {suggestResult.reasons.length > 0 && (
            <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] leading-snug">
              Khớp từ khóa:{' '}
              {suggestResult.reasons
                .map((r) => `#${r.tag} (${r.matchedTerms.join(', ')})`)
                .join(' • ')}
            </p>
          )}
        </div>
      )}

      <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] leading-relaxed">
        {helperText ||
          'Khuyến nghị 3–5 tag thực sự liên quan. Nếu để trống khi lưu, hệ thống sẽ tự phân tích từ khóa để gắn 3–5 tag phù hợp nếu đủ căn cứ.'}
      </p>
    </div>
  );
}
