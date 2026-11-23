import React from 'react';
import {
  AlertTriangle,
  Copy,
  CopyPlus,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import type { Character, Idea, LibraryPrompt, Note } from '../../types';
import type { ConflictDetail } from '../../services/userDataService';

interface ConflictResolutionModalProps {
  conflict: ConflictDetail | null;
  isResolving: boolean;
  onKeepServer: () => void;
  onOverwriteServer: () => void;
  onSaveAsCopy: () => void;
  onCopyLocalDraft: (text: string) => void;
  onCancel: () => void;
}

function formatTime(iso?: string): string {
  if (!iso) return 'Không rõ thời gian';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function summarizeItem(kind: ConflictDetail['kind'], item: unknown): { title: string; preview: string; copyText: string } {
  if (!item) {
    return {
      title: '(Đã bị xóa trên thiết bị khác)',
      preview: 'Mục này không còn tồn tại trên máy chủ.',
      copyText: '',
    };
  }
  if (kind === 'character') {
    const c = item as Character;
    return {
      title: `${c.avatar || '🍀'} ${c.name}`,
      preview: c.description || c.role || c.prompt || '(Không có mô tả)',
      copyText: [c.name, c.role, c.description, c.backstoryUser, c.backstoryChar, c.prompt]
        .filter(Boolean)
        .join('\n\n'),
    };
  }
  if (kind === 'note') {
    const n = item as Note;
    return {
      title: `${n.icon || '☘️'} ${n.title}`,
      preview: n.command || n.content || '(Trống)',
      copyText: `${n.title}\n\n${n.command}\n\n${n.content}`,
    };
  }
  if (kind === 'library_prompt') {
    const p = item as LibraryPrompt;
    return {
      title: `${p.icon || '📚'} ${p.title}`,
      preview: p.description || p.steps?.[0]?.content || '(Trống)',
      copyText: [p.title, p.description, p.howToUse, ...(p.steps || []).map((s) => `${s.label}\n${s.content}`)]
        .filter(Boolean)
        .join('\n\n'),
    };
  }
  const i = item as Idea;
  return {
    title: i.title,
    preview: i.content || '(Trống)',
    copyText: `${i.title}\n\n${i.content}`,
  };
}

export default function ConflictResolutionModal({
  conflict,
  isResolving,
  onKeepServer,
  onOverwriteServer,
  onSaveAsCopy,
  onCopyLocalDraft,
  onCancel,
}: ConflictResolutionModalProps) {
  if (!conflict) return null;

  const localSummary = summarizeItem(conflict.kind, conflict.localItem);
  const serverSummary = summarizeItem(conflict.kind, conflict.serverItem);

  const kindText =
    conflict.kind === 'character'
      ? 'nhân vật'
      : conflict.kind === 'note'
        ? 'ghi chú'
        : conflict.kind === 'library_prompt'
          ? 'câu lệnh thư viện'
          : 'ý tưởng';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#14221B]/55 dark:bg-[#141716]/75 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="w-full max-w-xl max-h-[92vh] bg-[#FFF9EA] dark:bg-[#292E2B] border border-[#9FC4AF] dark:border-[#49554D] rounded-lg shadow-lg dark:shadow-none overflow-hidden flex flex-col">
        {/* Header */}
        <div className="retro-titlebar px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[#F7E8C3] dark:bg-[#292E2B] border border-[#DEC07D] dark:border-[#49554D] text-[#8E6418] dark:text-[#D5B97A] flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="conflict-modal-title"
                className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8]"
              >
                Phát hiện xung đột chỉnh sửa giữa các thiết bị
              </h2>
              <p className="text-[11px] text-[#527062] dark:text-[#B8BDB5]">
                {conflict.serverDeleted
                  ? `Một trình duyệt hoặc thiết bị khác vừa xóa ${kindText} này.`
                  : `Một trình duyệt hoặc thiết bị khác vừa cập nhật ${kindText} này trong lúc bạn đang sửa.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isResolving}
            onClick={onCancel}
            className="retro-btn p-1.5 text-[#39755D] dark:text-[#A3BDA8] disabled:opacity-40 cursor-pointer flex-shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <p className="text-xs text-[#3C5C4E] dark:text-[#E4E1D8] leading-relaxed">
            Nội dung bạn đang soạn <strong>vẫn được giữ nguyên trong biểu mẫu</strong>. Hãy chọn cách
            xử lý để không bị mất dữ liệu ở bất kỳ thiết bị nào:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Local draft */}
            <div className="retro-callout-mint p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#255442] dark:text-[#A3BDA8]">
                  Bản trên thiết bị này
                </span>
                <button
                  type="button"
                  onClick={() => onCopyLocalDraft(localSummary.copyText)}
                  className="text-[10px] font-semibold text-[#39755D] dark:text-[#A3BDA8] hover:underline flex items-center gap-1 cursor-pointer"
                  title="Sao chép nhanh nội dung bạn đang soạn"
                >
                  <Copy className="w-3 h-3" />
                  Sao chép
                </button>
              </div>
              <p className="text-xs font-bold text-[#20372D] dark:text-[#E4E1D8] truncate">
                {localSummary.title}
              </p>
              <p className="text-[11px] text-[#4C6A5C] dark:text-[#B8BDB5] line-clamp-4 whitespace-pre-wrap">
                {localSummary.preview}
              </p>
            </div>

            {/* Latest server version */}
            <div className="retro-callout-warm p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#6E5120] dark:text-[#D5B97A]">
                  Bản mới nhất trên máy chủ
                </span>
                {conflict.serverVersion > 0 && (
                  <span className="text-[10px] font-mono text-[#6B5A3A] dark:text-[#B8BDB5]">
                    v{conflict.serverVersion}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-[#20372D] dark:text-[#E4E1D8] truncate">
                {serverSummary.title}
              </p>
              <p className="text-[10px] font-mono text-[#6B5A3A] dark:text-[#B8BDB5]">
                Cập nhật lúc: {formatTime(conflict.serverUpdatedAt)}
              </p>
              <p className="text-[11px] text-[#4C4535] dark:text-[#E4E1D8] line-clamp-3 whitespace-pre-wrap">
                {serverSummary.preview}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={isResolving}
              onClick={onSaveAsCopy}
              className="retro-btn-primary w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isResolving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CopyPlus className="w-4 h-4" />
              )}
              Lưu thành bản sao mới (Giữ cả hai phiên bản — Khuyên dùng)
            </button>

            <button
              type="button"
              disabled={isResolving}
              onClick={onOverwriteServer}
              className="retro-btn w-full py-2.5 px-4 text-xs font-bold text-[#7A5416] dark:text-[#D5B97A] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              {conflict.serverDeleted
                ? 'Khôi phục và lưu bản trên thiết bị này'
                : 'Ghi đè lên máy chủ bằng bản trên thiết bị này'}
            </button>

            <button
              type="button"
              disabled={isResolving}
              onClick={onKeepServer}
              className="retro-btn w-full py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
              Tải bản mới nhất từ máy chủ (Hủy chỉnh sửa hiện tại)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
