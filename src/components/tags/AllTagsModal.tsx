import React, { useMemo, useState } from 'react';
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
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

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
  onToast,
}: AllTagsModalProps) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'filter' | 'admin'>('filter');

  // Admin state
  const [adminActionBusy, setAdminActionBusy] = useState(false);
  const [adminNotice, setAdminNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagAliases, setNewTagAliases] = useState('');

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameNewLabel, setRenameNewLabel] = useState('');

  const [mergeSources, setMergeSources] = useState<string[]>([]);
  const [mergeTargetLabel, setMergeTargetLabel] = useState('');

  const [confirmDeleteTag, setConfirmDeleteTag] = useState<string | null>(null);

  const selectedKeySet = useMemo(
    () => new Set(selectedTags.map((t) => toTagComparisonKey(t))),
    [selectedTags],
  );

  const filteredCatalog = useMemo(() => {
    const q = toTagComparisonKey(search);
    if (!q) return catalog;
    return catalog.filter(
      (entry) =>
        entry.key.includes(q) ||
        entry.aliases.some((a) => toTagComparisonKey(a).includes(q)),
    );
  }, [catalog, search]);

  const adminTagList = useMemo(() => {
    const map = new Map<string, { label: string; count: number; aliases: string[]; isShared: boolean }>();
    for (const c of catalog) {
      map.set(c.key, {
        label: c.label,
        count: c.count,
        aliases: c.aliases,
        isShared: Boolean(c.isShared),
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
          isShared: true,
        });
      }
    }
    const q = toTagComparisonKey(search);
    return Array.from(map.values())
      .filter((item) => {
        if (!q) return true;
        return (
          toTagComparisonKey(item.label).includes(q) ||
          item.aliases.some((a) => toTagComparisonKey(a).includes(q))
        );
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'));
  }, [catalog, sharedTags, search]);

  if (!isOpen) return null;

  const handleAdminUpsert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagLabel.trim() || adminActionBusy) return;
    setAdminActionBusy(true);
    setAdminNotice(null);
    try {
      const aliases = newTagAliases
        .split(',')
        .map((a) => normalizeTagDisplay(a))
        .filter(Boolean);
      const res = await adminUpsertSharedTag({
        label: newTagLabel,
        aliases,
      });
      if (!res.ok) {
        setAdminNotice({ type: 'err', text: res.error || 'Không thể lưu tag chung.' });
        return;
      }
      setNewTagLabel('');
      setNewTagAliases('');
      await onRefreshTagsAndData();
      setAdminNotice({ type: 'ok', text: `Đã lưu tag chung #${res.data?.label}.` });
      onToast?.(`Đã lưu tag chung #${res.data?.label}`, 'success');
    } finally {
      setAdminActionBusy(false);
    }
  };

  const handleAdminRename = async () => {
    if (!renameTarget || !renameNewLabel.trim() || adminActionBusy) return;
    setAdminActionBusy(true);
    setAdminNotice(null);
    try {
      const res = await adminRenameSharedTag(renameTarget, renameNewLabel);
      if (!res.ok) {
        setAdminNotice({ type: 'err', text: res.error || 'Không thể đổi tên tag.' });
        return;
      }
      await onRefreshTagsAndData();
      setAdminNotice({
        type: 'ok',
        text: `Đã đổi #${renameTarget} thành #${normalizeTagDisplay(renameNewLabel)} (${res.data ?? 0} bài cloud được cập nhật).`,
      });
      setRenameTarget(null);
      setRenameNewLabel('');
      onToast?.('Đã đổi tên tag chung thành công!', 'success');
    } finally {
      setAdminActionBusy(false);
    }
  };

  const handleAdminMerge = async () => {
    if (mergeSources.length === 0 || !mergeTargetLabel.trim() || adminActionBusy) return;
    setAdminActionBusy(true);
    setAdminNotice(null);
    try {
      const res = await adminMergeSharedTags(mergeSources, mergeTargetLabel);
      if (!res.ok) {
        setAdminNotice({ type: 'err', text: res.error || 'Không thể gộp tag.' });
        return;
      }
      await onRefreshTagsAndData();
      setAdminNotice({
        type: 'ok',
        text: `Đã gộp ${mergeSources.length} tag vào #${normalizeTagDisplay(mergeTargetLabel)} (${res.data ?? 0} bài cloud cập nhật).`,
      });
      setMergeSources([]);
      setMergeTargetLabel('');
      onToast?.('Đã gộp tag chung thành công!', 'success');
    } finally {
      setAdminActionBusy(false);
    }
  };

  const handleAdminDelete = async (label: string) => {
    if (adminActionBusy) return;
    setAdminActionBusy(true);
    setAdminNotice(null);
    try {
      const res = await adminDeleteSharedTag(label);
      if (!res.ok) {
        setAdminNotice({ type: 'err', text: res.error || 'Không thể xóa tag chung.' });
        return;
      }
      await onRefreshTagsAndData();
      setConfirmDeleteTag(null);
      setAdminNotice({
        type: 'ok',
        text: `Đã xóa tag chung #${label} (${res.data ?? 0} bài cloud đã gỡ tag).`,
      });
      onToast?.(`Đã xóa tag #${label}`, 'info');
    } finally {
      setAdminActionBusy(false);
    }
  };

  const toggleMergeSource = (label: string) => {
    setMergeSources((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/60 dark:bg-[#141716]/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="bg-[#FFF9EA] dark:bg-[#292E2B] rounded-lg border border-[#9FC4AF] dark:border-[#49554D] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-lg dark:shadow-none relative z-10 animate-fade-in">
        {/* Title Bar */}
        <div className="retro-titlebar px-4 sm:px-5 py-3 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TagIcon className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] truncate">
                Danh sách Tag — {tabLabel}
              </h3>
              <p className="text-[10.5px] text-[#527062] dark:text-[#B8BDB5]">
                Chọn nhiều tag cùng lúc để thu hẹp kết quả tìm kiếm chính xác
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="retro-btn p-1.5 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher (Admin vs Filter) + Search */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#D5E6DC] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#202423] space-y-2.5">
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMode('filter')}
                className={`px-3 py-1 rounded border text-xs font-semibold cursor-pointer transition ${
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
                className={`px-3 py-1 rounded border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
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

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#587568] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên tag hoặc từ đồng nghĩa..."
              className="retro-input w-full pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {mode === 'filter' ? (
            <>
              {filteredCatalog.filter((c) => c.count > 0).length === 0 ? (
                <p className="text-center text-xs text-[#587568] dark:text-[#B8BDB5] py-6">
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
                            className={`text-[10px] tabular-nums-mono px-1.5 py-0.5 rounded ${
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
              )}
            </>
          ) : (
            <div className="space-y-4">
              {adminNotice && (
                <p
                  className={`px-3 py-2 rounded border text-xs font-medium ${
                    adminNotice.type === 'err'
                      ? 'border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA]'
                      : 'border-[#9FC4AF] bg-[#E2F3E8] dark:bg-[#343D37] dark:border-[#49554D] text-[#224C3B] dark:text-[#E4E1D8]'
                  }`}
                >
                  {adminNotice.text}
                </p>
              )}

              {/* Add canonical shared tag */}
              <form onSubmit={handleAdminUpsert} className="retro-callout-mint p-3 space-y-2">
                <p className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Thêm / Cập nhật tag chung chuẩn hóa
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newTagLabel}
                    onChange={(e) => setNewTagLabel(e.target.value)}
                    placeholder="Tên tag chuẩn (vd: Cốt truyện)"
                    className="retro-input px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={newTagAliases}
                    onChange={(e) => setNewTagAliases(e.target.value)}
                    placeholder="Từ đồng nghĩa (phân cách dấu phẩy)"
                    className="retro-input px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newTagLabel.trim() || adminActionBusy}
                    className="retro-btn-primary px-3 py-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Lưu tag chung
                  </button>
                </div>
              </form>

              {/* Merge Selected Source Tags */}
              {mergeSources.length > 0 && (
                <div className="retro-callout-warm p-3 space-y-2">
                  <p className="text-xs font-bold text-[#4A3B23] dark:text-[#E4E1D8] flex items-center gap-1.5">
                    <Merge className="w-3.5 h-3.5" />
                    Gộp {mergeSources.length} tag đã chọn ({mergeSources.map((s) => `#${s}`).join(', ')})
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      value={mergeTargetLabel}
                      onChange={(e) => setMergeTargetLabel(e.target.value)}
                      placeholder="Nhập tên tag đích..."
                      className="retro-input flex-1 min-w-[180px] px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAdminMerge}
                      disabled={!mergeTargetLabel.trim() || adminActionBusy}
                      className="retro-btn-primary px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      Xác nhận gộp
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeSources([])}
                      className="retro-btn px-2.5 py-1.5 text-xs cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}

              {/* Rename Inline Box */}
              {renameTarget && (
                <div className="retro-callout-warm p-3 space-y-2">
                  <p className="text-xs font-bold text-[#4A3B23] dark:text-[#E4E1D8]">
                    Đổi tên tag #{renameTarget} (tự động giữ tên cũ làm alias để không gãy bộ lọc)
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      value={renameNewLabel}
                      onChange={(e) => setRenameNewLabel(e.target.value)}
                      placeholder="Tên tag mới..."
                      className="retro-input flex-1 min-w-[180px] px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAdminRename}
                      disabled={!renameNewLabel.trim() || adminActionBusy}
                      className="retro-btn-primary px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {adminActionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Lưu đổi tên'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenameTarget(null)}
                      className="retro-btn px-2.5 py-1.5 text-xs cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* List of all tags with Admin controls */}
              <div className="space-y-1.5">
                {adminTagList.map((item) => {
                  const isInMerge = mergeSources.includes(item.label);
                  const isDeleting = confirmDeleteTag === item.label;
                  return (
                    <div
                      key={item.label}
                      className="p-2.5 rounded-md border border-[#CFE2D6] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#202423] flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8]">
                            #{item.label}
                          </span>
                          <span className="text-[10px] tabular-nums-mono px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#2F634E] dark:text-[#A3BDA8]">
                            {item.count} bài
                          </span>
                          {item.isShared && (
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded border border-[#9FC4AF] dark:border-[#49554D] text-[#39755D] dark:text-[#A3BDA8]">
                              Tag chung
                            </span>
                          )}
                        </div>
                        {item.aliases.length > 0 && (
                          <p className="text-[10px] text-[#587568] dark:text-[#B8BDB5] mt-0.5 truncate">
                            Đồng nghĩa: {item.aliases.join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleMergeSource(item.label)}
                          className={`retro-btn px-2 py-1 text-[10.5px] font-semibold cursor-pointer ${
                            isInMerge ? 'retro-btn-active' : ''
                          }`}
                          title="Chọn để gộp"
                        >
                          {isInMerge ? '✓ Chọn gộp' : 'Gộp'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameTarget(item.label);
                            setRenameNewLabel(item.label);
                          }}
                          className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
                          title="Đổi tên tag"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isDeleting ? (
                          <button
                            type="button"
                            onClick={() => handleAdminDelete(item.label)}
                            disabled={adminActionBusy}
                            className="retro-btn-danger px-2 py-1 text-[10.5px] font-semibold cursor-pointer"
                          >
                            Xác nhận xóa
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTag(item.label)}
                            className="retro-btn-danger p-1 cursor-pointer"
                            title="Xóa tag chung"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] leading-relaxed">
                Lưu ý: Đổi tên/gộp/xóa chỉ áp dụng lên danh mục tag chung và nội dung hệ thống/của bạn trên Supabase, không tự ý sửa tag cá nhân của người dùng khác.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-[#F1F8F3] dark:bg-[#202423] border-t border-[#CBE0D3] dark:border-[#49554D] flex justify-between items-center gap-2">
          <button
            type="button"
            onClick={onClearSelected}
            disabled={selectedTags.length === 0}
            className="retro-btn px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Xóa tag đang lọc ({selectedTags.length})
          </button>
          <button
            type="button"
            onClick={onClose}
            className="retro-btn-primary px-4 py-1.5 text-xs font-semibold cursor-pointer"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
