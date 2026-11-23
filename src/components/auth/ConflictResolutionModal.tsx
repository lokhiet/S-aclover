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
import type { Character, Idea, Note } from '../../types';
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
        : 'ý tưởng';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="w-full max-w-xl max-h-[92vh] bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-50/90 dark:bg-amber-950/35 border-b border-amber-200/70 dark:border-amber-900/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="conflict-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100"
              >
                Phát hiện xung đột chỉnh sửa giữa các thiết bị
              </h2>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
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
            className="p-1.5 rounded-xl text-slate-500 hover:bg-white/70 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            Nội dung bạn đang soạn <strong>vẫn được giữ nguyên trong biểu mẫu</strong>. Hãy chọn cách
            xử lý để không bị mất dữ liệu ở bất kỳ thiết bị nào:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Local draft */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  Bản trên thiết bị này
                </span>
                <button
                  type="button"
                  onClick={() => onCopyLocalDraft(localSummary.copyText)}
                  className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  title="Sao chép nhanh nội dung bạn đang soạn"
                >
                  <Copy className="w-3 h-3" />
                  Sao chép
                </button>
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">
                {localSummary.title}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-4 whitespace-pre-wrap">
                {localSummary.preview}
              </p>
            </div>

            {/* Latest server version */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                  Bản mới nhất trên máy chủ
                </span>
                {conflict.serverVersion > 0 && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                    v{conflict.serverVersion}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">
                {serverSummary.title}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                Cập nhật lúc: {formatTime(conflict.serverUpdatedAt)}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-3 whitespace-pre-wrap">
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
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-60 transition"
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
              className="w-full py-2.5 px-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/25 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition"
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
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition"
            >
              <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Tải bản mới nhất từ máy chủ (Hủy chỉnh sửa hiện tại)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
