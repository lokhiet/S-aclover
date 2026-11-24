import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Loader2,
  Merge,
  Plus,
  Search,
  ShieldCheck,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react';
import type { SharedTag } from '../../types';
import {
  dedupeTags,
  normalizeTagDisplay,
  toTagComparisonKey,
  type TagCatalogEntry,
} from '../../utils/tagSystem';
import {
  adminDeleteSharedTag,
  adminMergeSharedTags,
  adminRenameSharedTag,
  adminUpsertSharedTag,
} from '../../services/tagAdminService';

export type TagMutationEvent =
  | { type: 'delete'; label: string }
  | { type: 'rename'; oldLabel: string; newLabel: string }
  | { type: 'merge'; sourceLabels: string[]; targetLabel: string };

interface AllTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: TagCatalogEntry[];
  sharedTags: SharedTag[];
  selectedTags: string[];
  onToggleTag: (label: string) => void;
  onClearSelected: () => void;
  isAdmin: boolean;
  tabLabel: string;
  onRefreshTagsAndData: () => Promise<void> | void;
  onTagsMutated?: (event: TagMutationEvent) => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type AdminSubDialog =
  | {
      type: 'add';
      label: string;
      aliases: string;
      description: string;
    }
  | {
      type: 'edit';
      originalLabel: string;
      label: string;
      aliases: string;
      initialAliases: string;
      description: string;
      initialDescription: string;
      isShared: boolean;
    }
  | {
      type: 'delete';
      label: string;
      count: number;
    };

export function AllTagsModal({
  isOpen,
  onClose,
  catalog,
  sharedTags,
  selectedTags,
  onToggleTag,
  onClearSelected,
  isAdmin,
  tabLabel,
  onRefreshTagsAndData,
  onTagsMutated,
  onToast,
}: AllTagsModalProps) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'filter' | 'admin'>('filter');

  // Admin state
  const [adminActionBusy, setAdminActionBusy] = useState(false);
  const [adminNotice, setAdminNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Merge state (sticky bottom bar)
  const [mergeSources, setMergeSources] = useState<string[]>([]);
  const [mergeTargetLabel, setMergeTargetLabel] = useState('');

  // Dedicated single sub-dialog (Add / Edit / Delete)
  const [activeDialog, setActiveDialog] = useState<AdminSubDialog | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const selectedKeySet = useMemo(
    () => new Set(selectedTags.map((t) => toTagComparisonKey(t))),
    [selectedTags],
  );

  const sharedTagByKey = useMemo(() => {
    const map = new Map<string, SharedTag>();
    for (const st of sharedTags) {
      const k = toTagComparisonKey(st.label);
      if (k) map.set(k, st);
    }
    return map;
  }, [sharedTags]);

  const filteredCatalog = useMemo(() => {
    const q = toTagComparisonKey(search);
    if (!q) return catalog;
    return catalog.filter(
      (entry) =>
        entry.key.includes(q) ||
        entry.aliases.some((a) => toTagComparisonKey(a).includes(q)),
    );
  }, [catalog, search]);

  const allAdminTags = useMemo(() => {
    const map = new Map<
      string,
      { label: string; count: number; aliases: string[]; description: string; isShared: boolean }
    >();
    for (const c of catalog) {
      const sharedMeta = sharedTagByKey.get(c.key);
      map.set(c.key, {
        label: c.label,
        count: c.count,
        aliases: c.aliases,
        description: sharedMeta?.description || '',
        isShared: Boolean(c.isShared || sharedMeta),
      });
    }
    for (const st of sharedTags) {
      const k = toTagComparisonKey(st.label);
      if (!k) continue;
      if (!map.has(k)) {
        map.set(k, {
          label: st.label,
          count: 0,
          aliases: st.aliases || [],
          description: st.description || '',
          isShared: true,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'),
    );
  }, [catalog, sharedTags, sharedTagByKey]);

  const filteredAdminTags = useMemo(() => {
    const q = toTagComparisonKey(search);
    if (!q) return allAdminTags;
    return allAdminTags.filter(
      (item) =>
        toTagComparisonKey(item.label).includes(q) ||
        item.aliases.some((a) => toTagComparisonKey(a).includes(q)),
    );
  }, [allAdminTags, search]);

  useEffect(() => {
    if (!isAdmin && mode === 'admin') {
      setMode('filter');
      setActiveDialog(null);
      setDialogError(null);
    }
  }, [isAdmin, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeDialog && !adminActionBusy) {
        setActiveDialog(null);
        setDialogError(null);
        return;
      }
      if (!activeDialog) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeDialog, adminActionBusy, onClose]);

  if (!isOpen) return null;

  const openAddDialog = () => {
    setDialogError(null);
    setActiveDialog({
      type: 'add',
      label: '',
      aliases: '',
      description: '',
    });
  };

  const openEditDialog = (item: {
    label: string;
    aliases: string[];
    description: string;
    isShared: boolean;
  }) => {
    const aliasesText = item.aliases.join(', ');
    setDialogError(null);
    setActiveDialog({
      type: 'edit',
      originalLabel: item.label,
      label: item.label,
      aliases: aliasesText,
      initialAliases: aliasesText,
      description: item.description,
      initialDescription: item.description,
      isShared: item.isShared,
    });
  };

  const openDeleteDialog = (item: { label: string; count: number }) => {
    setDialogError(null);
    setActiveDialog({
      type: 'delete',
      label: item.label,
      count: item.count,
    });
  };

  const closeSubDialog = () => {
    if (adminActionBusy) return;
    setActiveDialog(null);
    setDialogError(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeDialog?.type !== 'add' || adminActionBusy) return;
    const cleanLabel = normalizeTagDisplay(activeDialog.label);
    if (!cleanLabel) {
      setDialogError('Vui lòng nhập tên tag hợp lệ.');
      return;
    }

    setAdminActionBusy(true);
    setDialogError(null);
    setAdminNotice(null);
    try {
      const aliases = activeDialog.aliases
        .split(',')
        .map((a) => normalizeTagDisplay(a))
        .filter(Boolean);
      const res = await adminUpsertSharedTag({
        label: cleanLabel,
        aliases,
        description: activeDialog.description,
      });
      if (!res.ok) {
        setDialogError(res.error || 'Không thể lưu tag chung.');
        return;
      }
      await onRefreshTagsAndData();
      setActiveDialog(null);
      const savedLabel = res.data?.label || cleanLabel;
      setAdminNotice({ type: 'ok', text: `Đã lưu tag chung #${savedLabel}.` });
      onToast?.(`Đã lưu tag chung #${savedLabel}`, 'success');
    } finally {
      setAdminActionBusy(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeDialog?.type !== 'edit' || adminActionBusy) return;

    const cleanOld = normalizeTagDisplay(activeDialog.originalLabel);
    const cleanNew = normalizeTagDisplay(activeDialog.label);
    if (!cleanNew) {
      setDialogError('Tên tag mới không được để trống.');
      return;
    }

    const labelChanged = cleanOld !== cleanNew;
    const aliasesChanged =
      activeDialog.aliases.trim() !== activeDialog.initialAliases.trim();
    const descriptionChanged =
      activeDialog.description.trim() !== activeDialog.initialDescription.trim();

    if (!labelChanged && !aliasesChanged && !descriptionChanged && activeDialog.isShared) {
      setActiveDialog(null);
      return;
    }

    setAdminActionBusy(true);
    setDialogError(null);
    setAdminNotice(null);

    try {
      let updatedCount = 0;

      if (labelChanged) {
        const renameRes = await adminRenameSharedTag(cleanOld, cleanNew);
        if (!renameRes.ok) {
          setDialogError(renameRes.error || 'Không thể đổi tên tag.');
          return;
        }
        updatedCount = renameRes.data ?? 0;

        if (aliasesChanged || descriptionChanged) {
          const existingTargetMeta = sharedTagByKey.get(toTagComparisonKey(cleanNew));
          const parsedAliases = dedupeTags([
            ...activeDialog.aliases
              .split(',')
              .map((a) => normalizeTagDisplay(a))
              .filter(Boolean),
            ...(existingTargetMeta?.aliases || []),
            cleanOld,
          ]).filter((a) => toTagComparisonKey(a) !== toTagComparisonKey(cleanNew));

          const upsertRes = await adminUpsertSharedTag({
            label: cleanNew,
            aliases: parsedAliases,
            description: activeDialog.description,
          });
          if (!upsertRes.ok) {
            setDialogError(upsertRes.error || 'Đã đổi tên nhưng chưa cập nhật được từ đồng nghĩa/mô tả.');
            return;
          }
        }
      } else {
        const parsedAliases = dedupeTags(
          activeDialog.aliases
            .split(',')
            .map((a) => normalizeTagDisplay(a))
            .filter(Boolean),
        ).filter((a) => toTagComparisonKey(a) !== toTagComparisonKey(cleanNew));

        const upsertRes = await adminUpsertSharedTag({
          label: cleanNew,
          aliases: parsedAliases,
          description: activeDialog.description,
        });
        if (!upsertRes.ok) {
          setDialogError(upsertRes.error || 'Không thể cập nhật thông tin tag chung.');
          return;
        }
      }

      if (labelChanged) {
        setMergeSources((prev) =>
          dedupeTags(prev.map((s) => (s === activeDialog.originalLabel ? cleanNew : s))),
        );
        onTagsMutated?.({
          type: 'rename',
          oldLabel: cleanOld,
          newLabel: cleanNew,
        });
      }

      await onRefreshTagsAndData();
      setActiveDialog(null);

      const noticeMsg = labelChanged
        ? `Đã đổi #${cleanOld} thành #${cleanNew} (${updatedCount} mục hệ thống/của bạn được cập nhật).`
        : `Đã cập nhật thông tin tag chung #${cleanNew}.`;
      setAdminNotice({ type: 'ok', text: noticeMsg });
      onToast?.(labelChanged ? 'Đã đổi tên tag chung thành công!' : `Đã cập nhật tag #${cleanNew}`, 'success');
    } finally {
      setAdminActionBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (activeDialog?.type !== 'delete' || adminActionBusy) return;
    const label = activeDialog.label;

    setAdminActionBusy(true);
    setDialogError(null);
    setAdminNotice(null);
    try {
      const res = await adminDeleteSharedTag(label);
      if (!res.ok) {
        setDialogError(res.error || 'Không thể xóa tag chung.');
        return;
      }
      setMergeSources((prev) => prev.filter((item) => item !== label));
      onTagsMutated?.({ type: 'delete', label });
      await onRefreshTagsAndData();
      setActiveDialog(null);
      setAdminNotice({
        type: 'ok',
        text: `Đã xóa tag chung #${label} (${res.data ?? 0} mục hệ thống/của bạn đã gỡ tag).`,
      });
      onToast?.(`Đã xóa tag #${label}`, 'info');
    } finally {
      setAdminActionBusy(false);
    }
  };

  const handleAdminMerge = async () => {
    const cleanTarget = normalizeTagDisplay(mergeTargetLabel);
    if (mergeSources.length === 0 || !cleanTarget || adminActionBusy) return;

    const isNoopSingleSelfMerge =
      mergeSources.length === 1 &&
      toTagComparisonKey(mergeSources[0]) === toTagComparisonKey(cleanTarget);
    if (isNoopSingleSelfMerge) return;

    const sourcesCopy = [...mergeSources];
    setAdminActionBusy(true);
    setAdminNotice(null);
    try {
      const res = await adminMergeSharedTags(sourcesCopy, cleanTarget);
      if (!res.ok) {
        setAdminNotice({ type: 'err', text: res.error || 'Không thể gộp tag.' });
        return;
      }
      onTagsMutated?.({
        type: 'merge',
        sourceLabels: sourcesCopy,
        targetLabel: cleanTarget,
      });
      await onRefreshTagsAndData();
      setAdminNotice({
        type: 'ok',
        text: `Đã gộp ${sourcesCopy.length} tag vào #${cleanTarget} (${res.data ?? 0} mục hệ thống/của bạn được cập nhật).`,
      });
      setMergeSources([]);
      setMergeTargetLabel('');
      onToast?.('Đã gộp tag chung thành công!', 'success');
    } finally {
      setAdminActionBusy(false);
    }
  };

  const toggleMergeSource = (label: string) => {
    setMergeSources((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  };

  const selectedQuickPickValue = allAdminTags.some(
    (item) => toTagComparisonKey(item.label) === toTagComparisonKey(mergeTargetLabel),
  )
    ? allAdminTags.find(
        (item) => toTagComparisonKey(item.label) === toTagComparisonKey(mergeTargetLabel),
      )?.label || ''
    : '';

  const isSingleSameTarget =
    mergeSources.length === 1 &&
    mergeTargetLabel.trim().length > 0 &&
    toTagComparisonKey(mergeSources[0]) === toTagComparisonKey(mergeTargetLabel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-stone-900/60 dark:bg-[#141716]/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="bg-[#FFF9EA] dark:bg-[#292E2B] rounded-lg border border-[#9FC4AF] dark:border-[#49554D] w-full max-w-2xl max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-lg dark:shadow-none relative z-10 animate-fade-in">
        {/* 1. Fixed Title Bar */}
        <div className="retro-titlebar px-3.5 sm:px-5 py-2.5 sm:py-3 flex justify-between items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <TagIcon className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] truncate">
                {mode === 'admin' && isAdmin
                  ? `Quản lý tag chung — ${tabLabel}`
                  : `Danh sách Tag — ${tabLabel}`}
              </h3>
              <p className="text-[10.5px] text-[#527062] dark:text-[#B8BDB5] truncate">
                {mode === 'admin' && isAdmin
                  ? 'Chọn nhiều tag để gộp, hoặc thêm, chỉnh sửa và xóa tag dùng chung'
                  : 'Chọn nhiều tag cùng lúc để thu hẹp kết quả tìm kiếm chính xác'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="retro-btn p-1.5 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Fixed Controls Toolbar (Mode Switcher + Search + "+ Thêm tag") */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-[#D5E6DC] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#202423] space-y-2 shrink-0">
          {isAdmin && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setMode('filter')}
                className={`px-3 py-1 rounded border text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                  mode === 'filter'
                    ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8]'
                    : 'bg-[#FFF9EA] dark:bg-[#292E2B] border-[#CFE2D6] dark:border-[#49554D] text-[#587568] dark:text-[#B8BDB5]'
                }`}
              >
                Lọc theo Tag ({catalog.filter((c) => c.count > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setMode('admin')}
                className={`px-3 py-1 rounded border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
                  mode === 'admin'
                    ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8]'
                    : 'bg-[#FFF9EA] dark:bg-[#292E2B] border-[#CFE2D6] dark:border-[#49554D] text-[#587568] dark:text-[#B8BDB5]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Quản lý tag chung (Admin)
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-[#587568] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên tag hoặc từ đồng nghĩa..."
                className="retro-input w-full pl-8 pr-7 py-1.5 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#587568] dark:text-[#B8BDB5] hover:text-[#224C3B] dark:hover:text-[#E4E1D8] cursor-pointer"
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isAdmin && mode === 'admin' && (
              <button
                type="button"
                onClick={openAddDialog}
                className="retro-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm tag
              </button>
            )}
          </div>

          {mode === 'admin' && adminNotice && (
            <div
              className={`px-3 py-1.5 rounded border text-xs font-medium flex items-center justify-between gap-2 ${
                adminNotice.type === 'err'
                  ? 'border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA]'
                  : 'border-[#9FC4AF] bg-[#E2F3E8] dark:bg-[#343D37] dark:border-[#49554D] text-[#224C3B] dark:text-[#E4E1D8]'
              }`}
            >
              <span className="min-w-0">{adminNotice.text}</span>
              <button
                type="button"
                onClick={() => setAdminNotice(null)}
                className="p-0.5 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                aria-label="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 3. ONLY Scrollable Region: Tag List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5">
          {mode === 'filter' ? (
            filteredCatalog.filter((c) => c.count > 0).length === 0 ? (
              <p className="text-center text-xs text-[#587568] dark:text-[#B8BDB5] py-8">
                Không tìm thấy tag nào khớp trong mục {tabLabel}.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredCatalog
                  .filter((c) => c.count > 0)
                  .map((entry) => {
                    const isChosen = selectedKeySet.has(entry.key);
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => onToggleTag(entry.label)}
                        className={`px-2.5 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                          isChosen
                            ? 'bg-[#39755D] border-[#2B5A47] text-[#FFF9EA] dark:bg-[#A3BDA8] dark:text-[#1D2421] dark:border-[#A3BDA8]'
                            : 'bg-[#FAF6EA] dark:bg-[#202423] border-[#CFE2D6] dark:border-[#49554D] text-[#284237] dark:text-[#E4E1D8] hover:border-[#39755D] dark:hover:border-[#A3BDA8]'
                        }`}
                      >
                        {isChosen && <Check className="w-3 h-3" />}
                        <span>#{entry.label}</span>
                        <span
                          className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                            isChosen
                              ? 'bg-black/15 dark:bg-black/15'
                              : 'bg-[#E2F3E8] dark:bg-[#343D37] text-[#2F634E] dark:text-[#A3BDA8]'
                          }`}
                        >
                          {entry.count}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )
          ) : filteredAdminTags.length === 0 ? (
            <div className="text-center py-8 space-y-2.5">
              <p className="text-xs text-[#587568] dark:text-[#B8BDB5]">
                Không tìm thấy tag nào khớp từ khóa “{search}”.
              </p>
              <button
                type="button"
                onClick={openAddDialog}
                className="retro-btn px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm tag mới
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAdminTags.map((item) => {
                const isInMerge = mergeSources.includes(item.label);
                return (
                  <div
                    key={item.label}
                    className={`p-2.5 rounded-md border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isInMerge
                        ? 'border-[#39755D] dark:border-[#A3BDA8] bg-[#EDF7F0] dark:bg-[#313A34]'
                        : 'border-[#CFE2D6] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#202423]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8]">
                          #{item.label}
                        </span>
                        <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#2F634E] dark:text-[#A3BDA8]">
                          {item.count} bài
                        </span>
                        {item.isShared && (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded border border-[#9FC4AF] dark:border-[#49554D] text-[#39755D] dark:text-[#A3BDA8]">
                            Tag chung
                          </span>
                        )}
                      </div>
                      {item.aliases.length > 0 && (
                        <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] mt-0.5 truncate">
                          Đồng nghĩa: {item.aliases.join(', ')}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-[10px] text-[#6A8579] dark:text-[#9CA59D] mt-0.5 truncate">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleMergeSource(item.label)}
                        className={`retro-btn px-2.5 py-1 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 whitespace-nowrap ${
                          isInMerge ? 'retro-btn-active' : ''
                        }`}
                        title={isInMerge ? 'Bỏ chọn gộp' : 'Chọn để gộp'}
                      >
                        {isInMerge && <Check className="w-3 h-3" />}
                        {isInMerge ? 'Đã chọn gộp' : 'Chọn gộp'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(item)}
                        className="retro-btn p-1.5 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
                        title="Chỉnh sửa tag"
                        aria-label={`Chỉnh sửa tag ${item.label}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteDialog(item)}
                        className="retro-btn-danger p-1.5 cursor-pointer"
                        title="Xóa tag chung"
                        aria-label={`Xóa tag ${item.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] leading-relaxed pt-2">
                Lưu ý: Đổi tên/gộp/xóa chỉ áp dụng lên danh mục tag chung và nội dung hệ thống/của bạn trên Supabase, không tự ý sửa tag cá nhân của người dùng khác.
              </p>
            </div>
          )}
        </div>

        {/* 4. Fixed Sticky Merge Action Bar (only shown in Admin mode when >= 1 tag is selected) */}
        {mode === 'admin' && isAdmin && mergeSources.length > 0 && (
          <div className="shrink-0 px-3.5 sm:px-5 py-2.5 sm:py-3 border-t border-[#DECBA4] dark:border-[#49554D] bg-[#FDF6E4] dark:bg-[#242A27] space-y-2 shadow-[0_-2px_8px_rgba(34,76,59,0.06)] dark:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#4A3B23] dark:text-[#E4E1D8] flex items-center gap-1.5 min-w-0">
                <Merge className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] shrink-0" />
                <span className="truncate tabular-nums">
                  Đã chọn {mergeSources.length} tag để gộp
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setMergeSources([]);
                  setMergeTargetLabel('');
                }}
                disabled={adminActionBusy}
                className="retro-btn px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                Bỏ chọn tất cả
              </button>
            </div>

            {/* Selected source tags with individual unselect buttons */}
            <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
              {mergeSources.map((src) => (
                <span
                  key={src}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#9FC4AF] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#292E2B] text-[11px] font-semibold text-[#224C3B] dark:text-[#E4E1D8]"
                >
                  <span>#{src}</span>
                  <button
                    type="button"
                    onClick={() => toggleMergeSource(src)}
                    disabled={adminActionBusy}
                    className="text-[#587568] hover:text-[#A63248] dark:text-[#B8BDB5] dark:hover:text-[#E4A6AA] cursor-pointer p-0.5"
                    aria-label={`Bỏ chọn tag ${src}`}
                    title={`Bỏ chọn #${src}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Target tag selector / input + Confirm Merge button */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <select
                value={selectedQuickPickValue}
                onChange={(e) => {
                  if (e.target.value) setMergeTargetLabel(e.target.value);
                }}
                disabled={adminActionBusy}
                aria-label="Chọn tag đích có sẵn"
                className="retro-input px-2.5 py-1.5 text-xs sm:w-44 shrink-0 cursor-pointer"
              >
                <option value="">Chọn tag đích...</option>
                {allAdminTags.map((t) => (
                  <option key={t.label} value={t.label}>
                    #{t.label} ({t.count})
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={mergeTargetLabel}
                onChange={(e) => setMergeTargetLabel(e.target.value)}
                placeholder="Hoặc nhập tên tag đích mới..."
                disabled={adminActionBusy}
                className="retro-input flex-1 min-w-0 px-2.5 py-1.5 text-xs"
              />

              <button
                type="button"
                onClick={handleAdminMerge}
                disabled={
                  !mergeTargetLabel.trim() || adminActionBusy || isSingleSameTarget
                }
                className="retro-btn-primary px-3.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {adminActionBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Merge className="w-3.5 h-3.5" />
                )}
                Xác nhận gộp
              </button>
            </div>

            {isSingleSameTarget && (
              <p className="text-[10.5px] text-[#A63248] dark:text-[#E4A6AA]">
                Vui lòng chọn thêm tag nguồn hoặc chọn tên tag đích khác với tag đang chọn.
              </p>
            )}
          </div>
        )}

        {/* 5. Fixed Modal Footer */}
        <div className="px-3.5 sm:px-5 py-2.5 bg-[#F1F8F3] dark:bg-[#202423] border-t border-[#CBE0D3] dark:border-[#49554D] flex justify-between items-center gap-2 shrink-0">
          {mode === 'filter' ? (
            <button
              type="button"
              onClick={onClearSelected}
              disabled={selectedTags.length === 0}
              className="retro-btn px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Xóa tag đang lọc ({selectedTags.length})
            </button>
          ) : (
            <span className="text-[11px] font-medium text-[#527062] dark:text-[#B8BDB5] tabular-nums">
              {filteredAdminTags.length === allAdminTags.length
                ? `Tổng cộng ${allAdminTags.length} tag`
                : `Hiển thị ${filteredAdminTags.length} / ${allAdminTags.length} tag`}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="retro-btn-primary px-4 py-1.5 text-xs font-semibold cursor-pointer"
          >
            Xong
          </button>
        </div>
      </div>

      {/* Dedicated Sub-Dialog: Add / Edit / Delete (max 1 open at any time) */}
      {activeDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-stone-950/55 dark:bg-black/65 backdrop-blur-xs"
            onClick={closeSubDialog}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="bg-[#FFF9EA] dark:bg-[#292E2B] rounded-lg border border-[#9FC4AF] dark:border-[#49554D] w-full max-w-md overflow-hidden shadow-xl dark:shadow-none relative z-10 animate-fade-in"
          >
            <div className="retro-titlebar px-4 py-2.5 flex items-center justify-between gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-1.5 truncate">
                {activeDialog.type === 'add' && (
                  <>
                    <Plus className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] shrink-0" />
                    Thêm tag chung mới
                  </>
                )}
                {activeDialog.type === 'edit' && (
                  <>
                    <Edit3 className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] shrink-0" />
                    Chỉnh sửa tag #{activeDialog.originalLabel}
                  </>
                )}
                {activeDialog.type === 'delete' && (
                  <>
                    <Trash2 className="w-4 h-4 text-[#A63248] dark:text-[#E4A6AA] shrink-0" />
                    Xóa tag chung #{activeDialog.label}
                  </>
                )}
              </h4>
              <button
                type="button"
                onClick={closeSubDialog}
                disabled={adminActionBusy}
                className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer disabled:opacity-50"
                aria-label="Đóng hộp thoại"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeDialog.type === 'add' && (
              <form onSubmit={handleAddSubmit} className="p-4 space-y-3">
                {dialogError && (
                  <p className="px-3 py-2 rounded border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#202423] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-medium">
                    {dialogError}
                  </p>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                    Tên tag chuẩn *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={activeDialog.label}
                    onChange={(e) =>
                      setActiveDialog({ ...activeDialog, label: e.target.value })
                    }
                    placeholder="Ví dụ: Cốt truyện"
                    className="retro-input w-full px-3 py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                    Từ đồng nghĩa (phân cách bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={activeDialog.aliases}
                    onChange={(e) =>
                      setActiveDialog({ ...activeDialog, aliases: e.target.value })
                    }
                    placeholder="Ví dụ: plot, story, dan truyen"
                    className="retro-input w-full px-3 py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                    Mô tả ngắn (không bắt buộc)
                  </label>
                  <input
                    type="text"
                    value={activeDialog.description}
                    onChange={(e) =>
                      setActiveDialog({ ...activeDialog, description: e.target.value })
                    }
                    placeholder="Ghi chú ngắn về phạm vi sử dụng tag..."
                    className="retro-input w-full px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#D5E6DC] dark:border-[#49554D]">
                  <button
                    type="button"
                    onClick={closeSubDialog}
                    disabled={adminActionBusy}
                    className="retro-btn px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!activeDialog.label.trim() || adminActionBusy}
                    className="retro-btn-primary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {adminActionBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Lưu tag chung
                  </button>
                </div>
              </form>
            )}

            {activeDialog.type === 'edit' && (
              <form onSubmit={handleEditSubmit} className="p-4 space-y-3">
                {dialogError && (
                  <p className="px-3 py-2 rounded border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#202423] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-medium">
                    {dialogError}
                  </p>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                    Tên tag *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={activeDialog.label}
                    onChange={(e) =>
                      setActiveDialog({ ...activeDialog, label: e.target.value })
                    }
                    placeholder="Nhập tên tag mới..."
                    className="retro-input w-full px-3 py-1.5 text-xs"
                  />
                  <p className="text-[10px] text-[#587568] dark:text-[#B8BDB5] mt-1">
                    Nếu đổi tên, tên cũ sẽ được tự động giữ làm từ đồng nghĩa để không gãy bộ lọc.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                    Từ đồng nghĩa (phân cách bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={activeDialog.aliases}
                    onChange={(e) =>
                      setActiveDialog({ ...activeDialog, aliases: e.target.value })
                    }
                    placeholder="Ví dụ: plot, story, dan truyen"
                    className="retro-input w-full px-3 py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                    Mô tả ngắn
                  </label>
                  <input
                    type="text"
                    value={activeDialog.description}
                    onChange={(e) =>
                      setActiveDialog({ ...activeDialog, description: e.target.value })
                    }
                    placeholder="Mô tả ngắn về tag..."
                    className="retro-input w-full px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#D5E6DC] dark:border-[#49554D]">
                  <button
                    type="button"
                    onClick={closeSubDialog}
                    disabled={adminActionBusy}
                    className="retro-btn px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!activeDialog.label.trim() || adminActionBusy}
                    className="retro-btn-primary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {adminActionBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            )}

            {activeDialog.type === 'delete' && (
              <div className="p-4 space-y-3">
                {dialogError && (
                  <p className="px-3 py-2 rounded border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#202423] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-medium">
                    {dialogError}
                  </p>
                )}

                <p className="text-xs text-[#284237] dark:text-[#E4E1D8] leading-relaxed">
                  Bạn có chắc muốn xóa tag chung{' '}
                  <strong className="text-[#A63248] dark:text-[#E4A6AA]">
                    #{activeDialog.label}
                  </strong>
                  ? Thao tác này sẽ xóa tag khỏi danh mục chung và gỡ khỏi các bài hệ thống/của bạn ({activeDialog.count} bài đang hiển thị ở mục hiện tại), không ảnh hưởng dữ liệu cá nhân của người dùng khác.
                </p>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#D5E6DC] dark:border-[#49554D]">
                  <button
                    type="button"
                    onClick={closeSubDialog}
                    disabled={adminActionBusy}
                    className="retro-btn px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={adminActionBusy}
                    className="retro-btn-danger px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {adminActionBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Xác nhận xóa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
