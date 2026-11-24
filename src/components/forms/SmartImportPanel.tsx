import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Code2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import type { PromptBlockType, SharedTag } from '../../types';
import { parseRawContentClient, type SmartParsedDraft } from '../../utils/smartContentParser';
import { dedupeTags, normalizeTagDisplay, toTagComparisonKey, type TagCatalogEntry } from '../../utils/tagSystem';

interface SmartImportPanelProps {
  targetType: 'note' | 'library_prompt';
  availableCatalog: TagCatalogEntry[];
  sharedTags?: SharedTag[];
  onApplyDraft: (draft: SmartParsedDraft) => void;
  onSwitchToManual: () => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const BLOCK_TYPE_OPTIONS: Array<{ value: PromptBlockType; label: string }> = [
  { value: 'prompt', label: 'Câu lệnh (Prompt)' },
  { value: 'guide', label: 'Hướng dẫn' },
  { value: 'note', label: 'Lưu ý' },
  { value: 'example', label: 'Ví dụ' },
  { value: 'heading', label: 'Tiêu đề phân mục' },
];

export function SmartImportPanel({
  targetType,
  availableCatalog,
  sharedTags = [],
  onApplyDraft,
  onSwitchToManual,
  onToast,
}: SmartImportPanelProps) {
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SmartParsedDraft | null>(null);
  const [newTagInput, setNewTagInput] = useState('');

  const handleAnalyze = () => {
    setError(null);
    const trimmed = rawText.trim();
    if (trimmed.length < 4) {
      setError('Vui lòng dán nội dung vào ô bên trên để hệ thống nhận diện cấu trúc.');
      return;
    }

    const parsed = parseRawContentClient({
      rawText,
      targetType,
      availableCatalog,
      sharedTags,
    });

    setDraft(parsed);
    onToast?.('Đã phân tách cấu trúc & giữ nguyên nội dung gốc! Bạn có thể xem trước và chỉnh sửa trước khi áp dụng.', 'success');
  };

  const updateDraftField = <K extends keyof SmartParsedDraft>(
    key: K,
    value: SmartParsedDraft[K],
  ) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateBlock = (
    index: number,
    patch: Partial<SmartParsedDraft['blocks'][number]>,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextBlocks = prev.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b));
      return { ...prev, blocks: nextBlocks };
    });
  };

  const removeBlock = (index: number) => {
    setDraft((prev) => {
      if (!prev || prev.blocks.length <= 1) return prev;
      return {
        ...prev,
        blocks: prev.blocks.filter((_, i) => i !== index),
      };
    });
  };

  const removeDraftTag = (tagToRemove: string) => {
    if (!draft) return;
    const targetKey = toTagComparisonKey(tagToRemove);
    updateDraftField(
      'suggestedTags',
      draft.suggestedTags.filter((t) => toTagComparisonKey(t) !== targetKey),
    );
  };

  const addDraftTag = () => {
    if (!draft) return;
    const clean = normalizeTagDisplay(newTagInput);
    if (!clean) return;
    updateDraftField('suggestedTags', dedupeTags([...draft.suggestedTags, clean]));
    setNewTagInput('');
  };

  return (
    <div className="space-y-4">
      {/* Local Processing & Verbatim Guarantee Callout */}
      <div className="retro-callout-mint p-3 space-y-1.5 text-xs">
        <div className="flex items-start gap-2">
          <Code2 className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-[#224C3B] dark:text-[#E4E1D8]">
              Nhập thông minh trực tiếp trên trình duyệt — Bảo toàn 100% nội dung gốc
            </p>
            <p className="text-[11px] text-[#3E5A4E] dark:text-[#B8BDB5] leading-relaxed">
              Hệ thống tự động nhận diện tiêu đề, mô tả, các bước đánh số, đoạn code (<code className="font-mono">```</code>), câu lệnh, hướng dẫn, lưu ý, ví dụ và đối chiếu từ khóa để gợi ý tag từ bộ dữ liệu SéaClover. Toàn bộ xử lý diễn ra ngay trên máy bạn, giữ nguyên tuyệt đối nội dung gốc và không gửi dữ liệu ra ngoài.
            </p>
          </div>
        </div>
      </div>

      {/* Raw Text Paste Area */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <label className="text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8]">
            Dán toàn bộ nội dung thô (Prompt, đoạn code, hướng dẫn, lưu ý, ví dụ...)
          </label>
          <span className="font-mono text-[10.5px] text-[#587568] dark:text-[#B8BDB5]">
            Xử lý cục bộ • Miễn phí
          </span>
        </div>
        <textarea
          rows={9}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Dán vào đây bài đăng thô chưa định dạng...\nVí dụ:\nTiêu đề: Bộ lệnh nhập vai tổng tài\nMô tả: Giúp AI giữ đúng tính cách và nhịp độ chậm\nBước 1: Dán vào System Instruction\nPrompt:\n[SYSTEM COMMAND: ...]\nLưu ý: Không dùng chung với lệnh tua nhanh.`}
          className="retro-input w-full px-3 py-2.5 text-xs leading-relaxed font-mono resize-y"
        />
        <div className="flex items-center justify-between gap-2 mt-1 text-[10.5px] text-[#587568] dark:text-[#B8BDB5]">
          <span>{rawText.length.toLocaleString('vi-VN')} ký tự</span>
          <button
            type="button"
            onClick={onSwitchToManual}
            className="text-[#2B5A47] dark:text-[#A3BDA8] hover:underline font-semibold cursor-pointer"
          >
            Chuyển sang Soạn thủ công
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Action Button */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {rawText.trim() && (
          <button
            type="button"
            onClick={() => {
              setRawText('');
              setDraft(null);
              setError(null);
            }}
            className="retro-btn px-3 py-2 text-xs font-semibold cursor-pointer"
          >
            Xóa nội dung dán
          </button>
        )}
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!rawText.trim()}
          className="retro-btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Phân tích &amp; Xem trước</span>
        </button>
      </div>

      {/* Editable Preview Ready to Inspect & Apply */}
      {draft && (
        <div className="retro-callout-mint p-3.5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#CBE0D3] dark:border-[#49554D] pb-2">
            <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
              Xem trước &amp; chỉnh sửa kết quả (Chưa lưu)
            </h4>
            <span className="text-[10.5px] font-mono text-[#587568] dark:text-[#B8BDB5]">
              {draft.blocks.length} khối nội dung • {draft.suggestedTags.length} tag
              {draft.autoNumberSteps ? ' • Đánh số bước' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                Tiêu đề nhận diện
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateDraftField('title', e.target.value)}
                className="retro-input w-full px-2.5 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                Mô tả ngắn (tùy chọn)
              </label>
              <input
                type="text"
                value={draft.description}
                onChange={(e) => updateDraftField('description', e.target.value)}
                placeholder="Có thể để trống hoặc bổ sung thêm..."
                className="retro-input w-full px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          {targetType === 'library_prompt' && (
            <div>
              <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                Cách dùng ngắn (tùy chọn)
              </label>
              <input
                type="text"
                value={draft.howToUse}
                onChange={(e) => updateDraftField('howToUse', e.target.value)}
                placeholder="Ví dụ: Dán vào System Instruction..."
                className="retro-input w-full px-2.5 py-1.5 text-xs"
              />
            </div>
          )}

          {/* Auto-detected Tags (Editable) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Tag gợi ý từ từ khóa ({draft.suggestedTags.length > 0 ? `${draft.suggestedTags.length} tag` : 'Chưa đủ căn cứ từ khóa'})
              </span>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-[#3E5A4E] dark:text-[#B8BDB5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.autoNumberSteps}
                  onChange={(e) => updateDraftField('autoNumberSteps', e.target.checked)}
                  className="accent-[#39755D]"
                />
                <span>Đánh số bước tự động</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {draft.suggestedTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#9FC4AF] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#292E2B] text-[#224C3B] dark:text-[#E4E1D8] text-[11px] font-semibold"
                >
                  <span>#{t}</span>
                  <button
                    type="button"
                    onClick={() => removeDraftTag(t)}
                    className="text-[#587568] hover:text-red-600 dark:text-[#B8BDB5] dark:hover:text-[#E4A6AA] cursor-pointer"
                    aria-label={`Bỏ tag ${t}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDraftTag();
                    }
                  }}
                  placeholder="+ Thêm tag"
                  className="retro-input w-28 px-2 py-0.5 text-[11px]"
                />
                {newTagInput.trim() && (
                  <button
                    type="button"
                    onClick={addDraftTag}
                    className="retro-btn px-1.5 py-0.5 text-[11px] cursor-pointer"
                    aria-label="Thêm tag"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Editable Parsed Blocks */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {draft.blocks.map((block, idx) => (
              <div
                key={block.id || idx}
                className="p-2.5 rounded border border-[#CFE2D6] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#202423] space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={block.type || 'prompt'}
                    onChange={(e) =>
                      updateBlock(idx, { type: e.target.value as PromptBlockType })
                    }
                    className="retro-input px-2 py-1 text-[11px] font-semibold"
                  >
                    {BLOCK_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={block.label}
                    onChange={(e) => updateBlock(idx, { label: e.target.value })}
                    placeholder="Nhãn khối..."
                    className="retro-input flex-1 min-w-[140px] px-2 py-1 text-[11px] font-semibold"
                  />

                  {draft.blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBlock(idx)}
                      className="retro-btn p-1 text-red-600 dark:text-[#E4A6AA] cursor-pointer"
                      title="Xóa khối này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {(block.type || 'prompt') !== 'heading' && (
                  <textarea
                    rows={Math.min(7, Math.max(2, (block.content || '').split('\n').length))}
                    value={block.content || ''}
                    onChange={(e) => updateBlock(idx, { content: e.target.value })}
                    className="retro-input w-full px-2.5 py-1.5 text-[11px] font-mono leading-relaxed resize-y"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#CBE0D3] dark:border-[#49554D]">
            <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5]">
              Bấm áp dụng để đưa bản chỉnh sửa sang trình soạn thảo đầy đủ trước khi lưu (mặc định luôn là Riêng tư).
            </p>
            <button
              type="button"
              onClick={() => onApplyDraft(draft)}
              className="retro-btn-primary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span>Áp dụng vào trình soạn thảo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
