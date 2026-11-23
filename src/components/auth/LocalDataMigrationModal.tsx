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
      className="fixed inset-0 z-50 bg-[#14221B]/55 dark:bg-[#141716]/75 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-modal-title"
    >
      <div className="w-full max-w-xl max-h-[92vh] bg-[#FFF9EA] dark:bg-[#292E2B] border border-[#9FC4AF] dark:border-[#49554D] rounded-lg shadow-lg dark:shadow-none overflow-hidden flex flex-col">
        {/* Header */}
        <div className="retro-titlebar px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[#39755D] dark:bg-[#343D37] text-[#FFF9EA] dark:text-[#A3BDA8] border border-[#2B5A47] dark:border-[#49554D] flex items-center justify-center flex-shrink-0">
              {isLocalMode ? <CloudUpload className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2
                id="migration-modal-title"
                className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] truncate"
              >
                {isLocalMode
                  ? 'Phát hiện dữ liệu cũ trên thiết bị này'
                  : 'Nhập tệp JSON vào tài khoản Supabase'}
              </h2>
              <p className="text-[11px] text-[#527062] dark:text-[#B8BDB5] truncate">
                {userEmail ? `Tài khoản đích: ${userEmail}` : 'Đồng bộ an toàn lên đám mây'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => onClose(false)}
            className="retro-btn p-1.5 text-[#39755D] dark:text-[#A3BDA8] disabled:opacity-40 cursor-pointer flex-shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Safety banner */}
          <div className="retro-callout-mint p-3.5 flex items-start gap-2.5 text-xs text-[#224C3B] dark:text-[#E4E1D8]">
            <ShieldCheck className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isLocalMode
                ? 'Dữ liệu cũ trong trình duyệt sẽ không bao giờ bị tự động xóa hay ghi đè. Bạn có thể sao lưu trước rồi chọn cách đưa lên tài khoản.'
                : 'Dữ liệu nhập sẽ được kiểm tra xung đột và lưu từng lô an toàn lên tài khoản Supabase của riêng bạn.'}
            </p>
          </div>

          {/* Resumable interrupted job state */}
          {hasUnfinishedJob && (
            <div className="retro-callout-warm p-3.5 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#9C742E] dark:text-[#D5B97A] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-[#4C3B19] dark:text-[#E4E1D8] space-y-1">
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

              <div className="w-full h-2 rounded bg-[#E6D5AD] dark:bg-[#202423] overflow-hidden">
                <div
                  className="h-full bg-[#39755D] dark:bg-[#A3BDA8] transition-all duration-300"
                  style={{ width: `${progressInfo.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Completed state */}
          {isCompleted && (
            <div className="retro-callout-mint p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
              <div className="text-xs text-[#224C3B] dark:text-[#E4E1D8]">
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
                <div className="p-3 rounded-md bg-[#FAF6EA] dark:bg-[#202423] border border-[#CBE0D3] dark:border-[#49554D] text-center">
                  <div className="text-lg font-extrabold font-mono text-[#39755D] dark:text-[#A3BDA8]">
                    {summary.newData.characters.length + summary.conflictData.characters.length}
                  </div>
                  <div className="text-[11px] font-semibold text-[#547264] dark:text-[#B8BDB5]">
                    Nhân vật
                  </div>
                </div>
                <div className="p-3 rounded-md bg-[#FAF6EA] dark:bg-[#202423] border border-[#CBE0D3] dark:border-[#49554D] text-center">
                  <div className="text-lg font-extrabold font-mono text-[#39755D] dark:text-[#A3BDA8]">
                    {summary.newData.notes.length + summary.conflictData.notes.length}
                  </div>
                  <div className="text-[11px] font-semibold text-[#547264] dark:text-[#B8BDB5]">
                    Ghi chú / Lệnh
                  </div>
                </div>
                <div className="p-3 rounded-md bg-[#FAF6EA] dark:bg-[#202423] border border-[#CBE0D3] dark:border-[#49554D] text-center">
                  <div className="text-lg font-extrabold font-mono text-[#39755D] dark:text-[#A3BDA8]">
                    {summary.newData.ideas.length + summary.conflictData.ideas.length}
                  </div>
                  <div className="text-[11px] font-semibold text-[#547264] dark:text-[#B8BDB5]">
                    Ý tưởng
                  </div>
                </div>
                <div className="p-3 rounded-md bg-[#FAF6EA] dark:bg-[#202423] border border-[#CBE0D3] dark:border-[#49554D] text-center">
                  <div className="text-lg font-extrabold font-mono text-[#39755D] dark:text-[#A3BDA8]">
                    {summary.newData.libraryPrompts.length +
                      summary.conflictData.libraryPrompts.length}
                  </div>
                  <div className="text-[11px] font-semibold text-[#547264] dark:text-[#B8BDB5]">
                    Prompt thư viện
                  </div>
                </div>
              </div>

              <div className="text-xs text-[#4C6A5C] dark:text-[#B8BDB5] flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
                <span>
                  Mục mới: <strong className="text-[#2B5A47] dark:text-[#A3BDA8]">{summary.totalNewCount}</strong>
                </span>
                <span>
                  Trùng ID khác nội dung:{' '}
                  <strong className={hasConflicts ? 'text-[#8E6418] dark:text-[#D5B97A]' : ''}>
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
                <div className="retro-callout-warm p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#6E5120] dark:text-[#D5B97A]">
                      Có {summary.totalConflictCount} mục trùng mã với tài khoản hiện tại
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowConflictDetails((prev) => !prev)}
                      className="text-[11px] font-semibold text-[#8E6418] dark:text-[#D5B97A] hover:underline cursor-pointer"
                    >
                      {showConflictDetails ? 'Ẩn danh sách' : 'Xem chi tiết'}
                    </button>
                  </div>

                  {showConflictDetails && (
                    <ul className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-[#4C3B19] dark:text-[#E4E1D8] pr-1">
                      {summary.conflicts.map((item) => (
                        <li
                          key={`${item.kind}:${item.id}`}
                          className="flex items-center justify-between gap-2 py-1 border-t border-[#E6D5AD] dark:border-[#49554D]"
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
                <p className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8]">
                  Chọn cách nhập dữ liệu:
                </p>

                <label
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${
                    strategy === 'clone-copy'
                      ? 'border-[#39755D] bg-[#E2F3E8] dark:border-[#A3BDA8] dark:bg-[#343D37]'
                      : 'border-[#CFE2D6] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#202423] hover:border-[#7AA994]'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    checked={strategy === 'clone-copy'}
                    onChange={() => setStrategy('clone-copy')}
                    disabled={isRunning}
                    className="mt-0.5 accent-[#39755D]"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-[#20372D] dark:text-[#E4E1D8]">
                      Hợp nhất an toàn — Giữ cả hai nếu trùng (Khuyên dùng)
                    </div>
                    <div className="text-[#547264] dark:text-[#B8BDB5] mt-0.5">
                      Thêm tất cả mục mới; mục trùng ID sẽ tự động tạo thêm &ldquo;(Bản sao)&rdquo;
                      để không mất bất kỳ nội dung nào.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${
                    strategy === 'keep-cloud'
                      ? 'border-[#39755D] bg-[#E2F3E8] dark:border-[#A3BDA8] dark:bg-[#343D37]'
                      : 'border-[#CFE2D6] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#202423] hover:border-[#7AA994]'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    checked={strategy === 'keep-cloud'}
                    onChange={() => setStrategy('keep-cloud')}
                    disabled={isRunning}
                    className="mt-0.5 accent-[#39755D]"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-[#20372D] dark:text-[#E4E1D8]">
                      Chỉ thêm mục mới — Giữ nguyên mục đã có trên tài khoản
                    </div>
                    <div className="text-[#547264] dark:text-[#B8BDB5] mt-0.5">
                      Chỉ tải lên các mục chưa có trên máy chủ, bỏ qua toàn bộ mục trùng ID.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${
                    strategy === 'overwrite-cloud'
                      ? 'border-[#B88B36] bg-[#FDF6E3] dark:border-[#A3BDA8] dark:bg-[#292E2B]'
                      : 'border-[#CFE2D6] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#202423] hover:border-[#7AA994]'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-strategy"
                    checked={strategy === 'overwrite-cloud'}
                    onChange={() => setStrategy('overwrite-cloud')}
                    disabled={isRunning}
                    className="mt-0.5 accent-[#9C742E]"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-[#20372D] dark:text-[#E4E1D8]">
                      Nhập và ghi đè các mục trùng ID
                    </div>
                    <div className="text-[#547264] dark:text-[#B8BDB5] mt-0.5">
                      Thêm mục mới và cập nhật các mục trùng ID trên tài khoản theo dữ liệu nhập.
                    </div>
                  </div>
                </label>
              </div>
            </>
          )}

          {/* Active running progress */}
          {isRunning && activeJob && (
            <div className="retro-callout-mint p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#224C3B] dark:text-[#E4E1D8]">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#39755D] dark:text-[#A3BDA8]" />
                  Đang đồng bộ lên Supabase...
                </span>
                <span className="font-mono">
                  {progressInfo.confirmedItems}/{progressInfo.totalItems} mục ({progressInfo.percent}%)
                </span>
              </div>
              <div className="w-full h-2 rounded bg-[#CBE0D3] dark:bg-[#202423] overflow-hidden">
                <div
                  className="h-full bg-[#39755D] dark:bg-[#A3BDA8] transition-all duration-300"
                  style={{ width: `${progressInfo.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="p-3.5 rounded-md bg-[#FBECEE] dark:bg-[#292E2B] border border-[#E5B8BF] dark:border-[#6B4A4D] text-xs text-[#8E3240] dark:text-[#E4A6AA] leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* Backup button */}
          {backupPayload && !isCompleted && (
            <button
              type="button"
              disabled={isRunning}
              onClick={handleDownloadBackup}
              className="retro-btn w-full py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
              Tải tệp sao lưu JSON về máy trước khi nhập
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-[#F1F8F3] dark:bg-[#202423] border-t border-[#CBE0D3] dark:border-[#49554D] flex flex-wrap items-center justify-between gap-2">
          {isCompleted ? (
            <button
              type="button"
              onClick={() => onClose(true)}
              className="retro-btn-primary ml-auto px-5 py-2 text-xs font-bold cursor-pointer"
            >
              Hoàn tất
            </button>
          ) : hasUnfinishedJob ? (
            <>
              <button
                type="button"
                disabled={isRunning}
                onClick={handleDiscardJob}
                className="retro-btn px-3.5 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                Để sau
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={handleResumeJob}
                className="retro-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
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
                className="retro-btn px-3.5 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isLocalMode ? 'Bỏ qua (Giữ dữ liệu tài khoản)' : 'Hủy bỏ'}
              </button>
              <button
                type="button"
                disabled={isRunning || !summary || summary.totalActionableCount === 0}
                onClick={handleStartNewImport}
                className="retro-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
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
