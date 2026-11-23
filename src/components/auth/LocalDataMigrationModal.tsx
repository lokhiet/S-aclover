import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileJson,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AppState } from '../../types';
import {
  buildImportJobPlan,
  downloadBackupSnapshot,
  type ImportConflictStrategy,
  type ImportJobPlan,
  type MigrationSummary,
} from '../../utils/localDataDiff';
import {
  clearResumableImportJob,
  saveResumableImportJob,
  upsertImportChunk,
} from '../../services/userDataService';

interface LocalDataMigrationModalProps {
  isOpen: boolean;
  mode: 'local-migration' | 'json-import';
  userId: string;
  userEmail?: string;
  summary: MigrationSummary | null;
  backupPayload: Partial<AppState> | null;
  resumableJob: ImportJobPlan | null;
  onClose: (markDismissed?: boolean) => void;
  onCompleted: () => Promise<void> | void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const KIND_LABELS: Record<'character' | 'note' | 'idea' | 'library_prompt', string> = {
  character: 'Nhân vật',
  note: 'Ghi chú/Lệnh',
  idea: 'Ý tưởng',
  library_prompt: 'Thư viện Prompt',
};

export default function LocalDataMigrationModal({
  isOpen,
  mode,
  userId,
  userEmail,
  summary,
  backupPayload,
  resumableJob,
  onClose,
  onCompleted,
  onToast,
}: LocalDataMigrationModalProps) {
  const [strategy, setStrategy] = useState<ImportConflictStrategy>('clone-copy');
  const [activeJob, setActiveJob] = useState<ImportJobPlan | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConflictDetails, setShowConflictDetails] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setIsCompleted(false);
    setShowConflictDetails(false);
    if (resumableJob && resumableJob.sourceLabel === mode) {
      setActiveJob(resumableJob);
      setStrategy(resumableJob.strategy);
    } else {
      setActiveJob(null);
      setStrategy('clone-copy');
    }
  }, [isOpen, mode, resumableJob]);

  const progressInfo = useMemo(() => {
    if (!activeJob) {
      return {
        confirmedChunks: 0,
        totalChunks: 0,
        confirmedItems: 0,
        totalItems: 0,
        percent: 0,
      };
    }
    const confirmedSet = new Set(activeJob.confirmedChunkIds);
    let confirmedItems = 0;
    for (const chunk of activeJob.chunks) {
      if (confirmedSet.has(chunk.chunkId)) {
        confirmedItems += chunk.items.length;
      }
    }
    const totalItems = activeJob.totalItems;
    const percent = totalItems > 0 ? Math.round((confirmedItems / totalItems) * 100) : 100;
    return {
      confirmedChunks: confirmedSet.size,
      totalChunks: activeJob.chunks.length,
      confirmedItems,
      totalItems,
      percent,
    };
  }, [activeJob]);

  if (!isOpen) return null;

  const isLocalMode = mode === 'local-migration';
  const hasConflicts = Boolean(summary && summary.totalConflictCount > 0);
  const hasUnfinishedJob =
    Boolean(activeJob) &&
    progressInfo.confirmedChunks < progressInfo.totalChunks &&
    progressInfo.totalChunks > 0;

  const handleDownloadBackup = () => {
    if (!backupPayload) return;
    downloadBackupSnapshot(
      backupPayload,
      isLocalMode ? 'seaclover_local_backup' : 'seaclover_import_backup',
    );
    onToast('Đã tải tệp sao lưu JSON an toàn về máy! 📥', 'success');
  };

  const executeJob = async (jobToRun: ImportJobPlan) => {
    if (isRunning) return;
    setIsRunning(true);
    setErrorMessage(null);

    let currentJob: ImportJobPlan = {
      ...jobToRun,
      confirmedChunkIds: [...jobToRun.confirmedChunkIds],
    };
    setActiveJob(currentJob);
    saveResumableImportJob(userId, currentJob);

    try {
      const confirmedSet = new Set(currentJob.confirmedChunkIds);

      for (let idx = 0; idx < currentJob.chunks.length; idx += 1) {
        const chunk = currentJob.chunks[idx];
        if (confirmedSet.has(chunk.chunkId)) continue;

        const res = await upsertImportChunk(userId, chunk);
        if (!res.ok) {
          const msg =
            res.error?.message ||
            `Mất kết nối ở lô ${idx + 1}/${currentJob.chunks.length}. Dữ liệu gốc vẫn nguyên vẹn, bạn có thể bấm thử lại.`;
          setErrorMessage(
            `Đã dừng ở lô ${idx + 1}/${currentJob.chunks.length}: ${msg}`,
          );
          saveResumableImportJob(userId, currentJob);
          return;
        }

        confirmedSet.add(chunk.chunkId);
        currentJob = {
          ...currentJob,
          confirmedChunkIds: Array.from(confirmedSet),
        };
        setActiveJob(currentJob);
        saveResumableImportJob(userId, currentJob);
      }

      // 100% các lô đã được Supabase xác nhận
      clearResumableImportJob(userId);
      setIsCompleted(true);
      await onCompleted();
      onToast(
        isLocalMode
          ? `Đã đồng bộ thành công ${currentJob.totalItems} mục lên tài khoản! Dữ liệu cục bộ vẫn được giữ nguyên.`
          : `Đã nhập và đồng bộ thành công ${currentJob.totalItems} mục vào tài khoản!`,
        'success',
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleStartNewImport = async () => {
    if (!summary) return;
    const plan = buildImportJobPlan(summary, strategy, mode);
    if (plan.totalItems === 0) {
      clearResumableImportJob(userId);
      onToast('Không có mục mới nào cần tải lên tài khoản.', 'info');
      onClose(true);
      return;
    }
    await executeJob(plan);
  };

  const handleResumeJob = async () => {
    if (!activeJob) return;
    await executeJob(activeJob);
  };

  const handleDiscardJob = () => {
    clearResumableImportJob(userId);
    setActiveJob(null);
    setErrorMessage(null);
    onClose(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-modal-title"
    >
      <div className="w-full max-w-xl max-h-[92vh] bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-50/90 to-teal-50/60 dark:from-emerald-950/40 dark:to-zinc-900 border-b border-emerald-100/80 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-600/20">
              {isLocalMode ? <CloudUpload className="w-5 h-5" /> : <FileJson className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2
                id="migration-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 truncate"
              >
                {isLocalMode
                  ? 'Phát hiện dữ liệu cũ trên thiết bị này'
                  : 'Nhập tệp JSON vào tài khoản Supabase'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {userEmail ? `Tài khoản đích: ${userEmail}` : 'Đồng bộ an toàn lên đám mây'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => onClose(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-white/70 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Safety banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-900/60 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isLocalMode
                ? 'Dữ liệu cũ trong trình duyệt sẽ không bao giờ bị tự động xóa hay ghi đè. Bạn có thể sao lưu trước rồi chọn cách đưa lên tài khoản.'
                : 'Dữ liệu nhập sẽ được kiểm tra xung đột và lưu từng lô an toàn lên tài khoản Supabase của riêng bạn.'}
            </p>
          </div>

          {/* Resumable interrupted job state */}
          {hasUnfinishedJob && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">Tiến trình đồng bộ trước đó bị gián đoạn</p>
                  <p className="leading-relaxed">
                    Đã xác nhận lưu{' '}
                    <span className="font-bold">
                      {progressInfo.confirmedItems}/{progressInfo.totalItems} mục
                    </span>{' '}
                    (lô {progressInfo.confirmedChunks}/{progressInfo.totalChunks}). Bấm{' '}
                    <strong>Thử lại phần còn lại</strong> để tiếp tục mà không tạo bản trùng.
                  </p>
                </div>
              </div>

              <div className="w-full h-2 rounded-full bg-amber-200/70 dark:bg-amber-900/50 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressInfo.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Completed state */}
          {isCompleted && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div className="text-xs text-emerald-900 dark:text-emerald-200">
                <p className="font-bold text-sm">Đồng bộ hoàn tất 100%!</p>
                <p className="mt-0.5">
                  Toàn bộ {progressInfo.totalItems} mục đã được Supabase xác nhận và lưu an toàn.
                </p>
              </div>
            </div>
          )}

          {/* Summary counts (when choosing new plan) */}
          {summary && !isCompleted && !hasUnfinishedJob && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800 text-center">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {summary.newData.characters.length + summary.conflictData.characters.length}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Nhân vật
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800 text-center">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {summary.newData.notes.length + summary.conflictData.notes.length}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Ghi chú / Lệnh
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800 text-center">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {summary.newData.ideas.length + summary.conflictData.ideas.length}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Ý tưởng
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800 text-center">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                    {summary.newData.libraryPrompts.length +
                      summary.conflictData.libraryPrompts.length}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Prompt thư viện
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-zinc-300 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
                <span>
                  Mục mới: <strong className="text-emerald-600 dark:text-emerald-400">{summary.totalNewCount}</strong>
                </span>
                <span>
                  Trùng ID khác nội dung:{' '}
                  <strong className={hasConflicts ? 'text-amber-600 dark:text-amber-400' : ''}>
                    {summary.totalConflictCount}
                  </strong>
                </span>
                {summary.identicalCount > 0 && (
                  <span>
                    Đã khớp sẵn (tự bỏ qua): <strong>{summary.identicalCount}</strong>
                  </span>
                )}
              </div>

              {/* Conflict preview list */}
              {hasConflicts && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Có {summary.totalConflictCount} mục trùng mã với tài khoản hiện tại
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowConflictDetails((prev) => !prev)}
                      className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                    >
                      {showConflictDetails ? 'Ẩn danh sách' : 'Xem chi tiết'}
                    </button>
                  </div>

                  {showConflictDetails && (
                    <ul className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-amber-900 dark:text-amber-200 pr-1">
                      {summary.conflicts.map((item) => (
                        <li
                          key={`${item.kind}:${item.id}`}
                          className="flex items-center justify-between gap-2 py-1 border-t border-amber-200/50 dark:border-amber-900/40"
                        >
                          <span className="truncate font-medium">
                            [{KIND_LABELS[item.kind]}] {item.label}
                          </span>
                          <span className="text-[10px] opacity-75 flex-shrink-0">
                            trùng với &ldquo;{item.cloudLabel}&rdquo;
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Strategy choices */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                  Chọn cách nhập dữ liệu:
                </p>

                <label
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                    strategy === 'clone-copy'
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/25'
                      : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    checked={strategy === 'clone-copy'}
                    onChange={() => setStrategy('clone-copy')}
                    disabled={isRunning}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-slate-800 dark:text-zinc-100">
                      Hợp nhất an toàn — Giữ cả hai nếu trùng (Khuyên dùng)
                    </div>
                    <div className="text-slate-500 dark:text-zinc-400 mt-0.5">
                      Thêm tất cả mục mới; mục trùng ID sẽ tự động tạo thêm &ldquo;(Bản sao)&rdquo;
                      để không mất bất kỳ nội dung nào.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                    strategy === 'keep-cloud'
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/25'
                      : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    checked={strategy === 'keep-cloud'}
                    onChange={() => setStrategy('keep-cloud')}
                    disabled={isRunning}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-slate-800 dark:text-zinc-100">
                      Chỉ thêm mục mới — Giữ nguyên mục đã có trên tài khoản
                    </div>
                    <div className="text-slate-500 dark:text-zinc-400 mt-0.5">
                      Chỉ tải lên các mục chưa có trên máy chủ, bỏ qua toàn bộ mục trùng ID.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                    strategy === 'overwrite-cloud'
                      ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/25'
                      : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    checked={strategy === 'overwrite-cloud'}
                    onChange={() => setStrategy('overwrite-cloud')}
                    disabled={isRunning}
                    className="mt-0.5 accent-amber-600"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-slate-800 dark:text-zinc-100">
                      Nhập và ghi đè các mục trùng ID
                    </div>
                    <div className="text-slate-500 dark:text-zinc-400 mt-0.5">
                      Thêm mục mới và cập nhật các mục trùng ID trên tài khoản theo dữ liệu nhập.
                    </div>
                  </div>
                </label>
              </div>
            </>
          )}

          {/* Active running progress */}
          {isRunning && activeJob && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-200">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  Đang đồng bộ lên Supabase...
                </span>
                <span>
                  {progressInfo.confirmedItems}/{progressInfo.totalItems} mục ({progressInfo.percent}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressInfo.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/70 text-xs text-red-700 dark:text-red-300 leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* Backup button */}
          {backupPayload && !isCompleted && (
            <button
              type="button"
              disabled={isRunning}
              onClick={handleDownloadBackup}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Tải tệp sao lưu JSON về máy trước khi nhập
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-zinc-950/50 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          {isCompleted ? (
            <button
              type="button"
              onClick={() => onClose(true)}
              className="ml-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              Hoàn tất
            </button>
          ) : hasUnfinishedJob ? (
            <>
              <button
                type="button"
                disabled={isRunning}
                onClick={handleDiscardJob}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
              >
                Để sau
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={handleResumeJob}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 transition"
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isRunning
                  ? 'Đang tiếp tục...'
                  : `Thử lại phần còn lại (${progressInfo.totalItems - progressInfo.confirmedItems} mục)`}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => onClose(isLocalMode)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
              >
                {isLocalMode ? 'Bỏ qua (Giữ dữ liệu tài khoản)' : 'Hủy bỏ'}
              </button>
              <button
                type="button"
                disabled={isRunning || !summary || summary.totalActionableCount === 0}
                onClick={handleStartNewImport}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 transition"
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                {isRunning ? 'Đang đồng bộ...' : 'Bắt đầu đồng bộ lên tài khoản'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
