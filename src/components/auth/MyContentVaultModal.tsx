import React, { useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  Eye,
  FolderOpen,
  Globe,
  Heart,
  Loader2,
  Lock,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { Character, Idea, LibraryPrompt, Note } from '../../types';
import type { DataEntityKind } from '../../services/userDataService';
import {
  buildVaultStatsKey,
  fetchVaultCommunityStats,
  type VaultItemCommunityStats,
} from '../../services/communityService';
import { getNoteBlockSummaryLabel } from '../../utils/contentBlocks';

interface MyContentVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  isAdmin: boolean;
  characters: Character[];
  notes: Note[];
  ideas: Idea[];
  libraryPrompts: LibraryPrompt[];
  isTogglingPublic: boolean;
  isSavingItem: boolean;
  onViewItem: (kind: DataEntityKind, item: Character | Note | Idea | LibraryPrompt) => void;
  onEditItem: (kind: DataEntityKind, item: Character | Note | Idea | LibraryPrompt) => void;
  onDeleteItem: (kind: DataEntityKind, item: Character | Note | Idea | LibraryPrompt) => Promise<void> | void;
  onTogglePublic: (
    kind: DataEntityKind,
    item: Character | Note | Idea | LibraryPrompt,
    nextPublic: boolean,
  ) => Promise<void> | void;
}

type VisibilityFilter = 'all' | 'public' | 'private' | 'system';
type TypeFilter = 'all' | DataEntityKind;

interface VaultEntry {
  key: string;
  kind: DataEntityKind;
  id: string;
  ownerId: string;
  title: string;
  subtitle: string;
  icon: string;
  isPublic: boolean;
  isSystem: boolean;
  updatedAt: string;
  item: Character | Note | Idea | LibraryPrompt;
}

const KIND_LABELS: Record<DataEntityKind, string> = {
  character: 'Nhân Vật',
  note: 'Câu Lệnh',
  idea: 'Ý Tưởng',
  library_prompt: 'Kho Lệnh',
};

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function MyContentVaultModal({
  isOpen,
  onClose,
  userId,
  isAdmin,
  characters,
  notes,
  ideas,
  libraryPrompts,
  isTogglingPublic,
  isSavingItem,
  onViewItem,
  onEditItem,
  onDeleteItem,
  onTogglePublic,
}: MyContentVaultModalProps) {
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statsMap, setStatsMap] = useState<Record<string, VaultItemCommunityStats>>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsSchemaReady, setStatsSchemaReady] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Gom toàn bộ nội dung do tài khoản tạo (cộng thêm nội dung Hệ thống nếu là Admin)
  const vaultEntries = useMemo<VaultEntry[]>(() => {
    const seen = new Set<string>();
    const list: VaultEntry[] = [];

    const pushEntry = (
      kind: DataEntityKind,
      item: Character | Note | Idea | LibraryPrompt,
      title: string,
      subtitle: string,
      icon: string,
      updatedAt: string,
    ) => {
      if (!item.ownerId) return;
      const isOwnedByMe = item.ownerId === userId;
      const isSystemVisibleToAdmin = Boolean(isAdmin && item.isSystem);
      if (!isOwnedByMe && !isSystemVisibleToAdmin) return;

      const key = `${kind}:${item.ownerId}:${item.id}`;
      if (seen.has(key)) return;
      seen.add(key);

      list.push({
        key,
        kind,
        id: item.id,
        ownerId: item.ownerId,
        title,
        subtitle,
        icon,
        isPublic: Boolean(item.isPublic || item.isSystem),
        isSystem: Boolean(item.isSystem),
        updatedAt,
        item,
      });
    };

    for (const c of characters) {
      pushEntry('character', c, c.name, c.role || 'Nhân vật', c.avatar || '🍀', c.publishedAt || c.createdAt);
    }
    for (const n of notes) {
      pushEntry(
        'note',
        n,
        n.title,
        getNoteBlockSummaryLabel(n) || 'Bài đăng Kho Lệnh',
        n.icon || '☘️',
        n.updatedAt || n.createdAt,
      );
    }
    for (const i of ideas) {
      pushEntry('idea', i, i.title, i.content, '💡', i.updatedAt || i.createdAt);
    }
    for (const p of libraryPrompts) {
      pushEntry(
        'library_prompt',
        p,
        p.title,
        p.description || `${p.steps.length} khối lệnh`,
        p.icon || '📚',
        p.publishedAt || p.createdAt,
      );
    }

    list.sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''));
    return list;
  }, [characters, notes, ideas, libraryPrompts, userId, isAdmin]);

  const statsSignature = useMemo(
    () => vaultEntries.map((e) => e.key).join('|'),
    [vaultEntries],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (!isAdmin && visibilityFilter === 'system') {
      setVisibilityFilter('all');
    }
  }, [isOpen, isAdmin, visibilityFilter]);

  useEffect(() => {
    if (!isOpen) return;
    if (vaultEntries.length === 0) {
      setStatsMap({});
      return;
    }

    let active = true;
    setIsLoadingStats(true);
    void fetchVaultCommunityStats(
      vaultEntries.map((e) => ({
        targetType: e.kind,
        ownerId: e.ownerId,
        itemId: e.id,
      })),
    ).then((res) => {
      if (!active) return;
      setIsLoadingStats(false);
      if (res.ok && res.data) {
        setStatsMap(res.data);
        setStatsSchemaReady(res.schemaReady !== false);
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, statsSignature]);

  const counts = useMemo(() => {
    let publicCount = 0;
    let privateCount = 0;
    let systemCount = 0;
    const byType: Record<DataEntityKind, number> = {
      character: 0,
      note: 0,
      idea: 0,
      library_prompt: 0,
    };

    for (const e of vaultEntries) {
      byType[e.kind] += 1;
      if (e.isSystem) {
        systemCount += 1;
      } else if (e.isPublic) {
        publicCount += 1;
      } else {
        privateCount += 1;
      }
    }

    return {
      total: vaultEntries.length,
      publicCount,
      privateCount,
      systemCount,
      byType,
    };
  }, [vaultEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vaultEntries.filter((entry) => {
      if (visibilityFilter === 'system' && !entry.isSystem) return false;
      if (visibilityFilter === 'public' && (!entry.isPublic || entry.isSystem)) return false;
      if (visibilityFilter === 'private' && (entry.isPublic || entry.isSystem)) return false;
      if (typeFilter !== 'all' && entry.kind !== typeFilter) return false;
      if (q) {
        const hay = `${entry.title} ${entry.subtitle} ${KIND_LABELS[entry.kind]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vaultEntries, visibilityFilter, typeFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-[#17221D]/55 dark:bg-[#141716]/75 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-vault-title"
        className="retro-window w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden relative z-10 animate-fade-in"
      >
        {/* Header */}
        <div className="retro-titlebar px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] shrink-0" />
            <h3
              id="my-vault-title"
              className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] truncate"
            >
              Kho nội dung của tôi
            </h3>
            <span className="px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] text-[10px] font-mono font-bold text-[#224C3B] dark:text-[#A3BDA8] tabular-nums-mono">
              {counts.total} mục
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary & Filters Bar */}
        <div className="p-3.5 sm:p-4 border-b border-[#CBE0D3] dark:border-[#49554D] bg-[#F4FAF6] dark:bg-[#202423] space-y-3 shrink-0">
          {/* Search + Quick Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#587568] dark:text-[#B8BDB5] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tiêu đề, tên nhân vật hoặc nội dung..."
                className="retro-input w-full pl-8 pr-3 py-1.5 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold flex-wrap tabular-nums-mono">
              <span className="px-2 py-1 rounded border border-[#B8D7C5] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#292E2B] text-[#2B5A47] dark:text-[#A3BDA8]">
                Công khai: {counts.publicCount}
              </span>
              <span className="px-2 py-1 rounded border border-[#D4E2D9] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#292E2B] text-[#5B776A] dark:text-[#B8BDB5]">
                Riêng tư: {counts.privateCount}
              </span>
              {isAdmin && (
                <span className="px-2 py-1 rounded border border-[#8FC3A9] dark:border-[#63806E] bg-[#E2F3E8] dark:bg-[#343D37] text-[#1F533E] dark:text-[#A3BDA8]">
                  Hệ thống: {counts.systemCount}
                </span>
              )}
            </div>
          </div>

          {/* Visibility Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#4C6A5C] dark:text-[#B8BDB5] mr-1">
              Trạng thái:
            </span>
            {(
              [
                { id: 'all', label: `Tất cả (${counts.total})` },
                { id: 'public', label: `Công khai (${counts.publicCount})` },
                { id: 'private', label: `Riêng tư (${counts.privateCount})` },
                ...(isAdmin
                  ? [{ id: 'system' as const, label: `Hệ thống (${counts.systemCount})` }]
                  : []),
              ] as Array<{ id: VisibilityFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVisibilityFilter(opt.id)}
                className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition cursor-pointer ${
                  visibilityFilter === opt.id
                    ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#1F533E] dark:text-[#E4E1D8]'
                    : 'bg-[#FFFDF7] dark:bg-[#292E2B] border-[#CFE2D6] dark:border-[#49554D] text-[#527062] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/50 dark:hover:bg-[#343D37]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Content Type Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#4C6A5C] dark:text-[#B8BDB5] mr-1">
              Loại:
            </span>
            {(
              [
                { id: 'all', label: `Tất cả loại (${counts.total})` },
                { id: 'character', label: `Nhân Vật (${counts.byType.character})` },
                { id: 'note', label: `Câu Lệnh (${counts.byType.note})` },
                { id: 'idea', label: `Ý Tưởng (${counts.byType.idea})` },
                { id: 'library_prompt', label: `Kho Lệnh (${counts.byType.library_prompt})` },
              ] as Array<{ id: TypeFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition cursor-pointer ${
                  typeFilter === opt.id
                    ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#1F533E] dark:text-[#E4E1D8]'
                    : 'bg-[#FFFDF7] dark:bg-[#292E2B] border-[#CFE2D6] dark:border-[#49554D] text-[#527062] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/50 dark:hover:bg-[#343D37]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vault Item List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5 bg-[#FFF9EA]/55 dark:bg-[#292E2B]">
          {isLoadingStats && vaultEntries.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#5B776A] dark:text-[#B8BDB5] px-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Đang tải lượt tim, bình luận và đánh giá...</span>
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FolderOpen className="w-8 h-8 mx-auto text-[#8BAE9C] dark:text-[#6B7A70]" />
              <p className="text-xs sm:text-sm font-bold text-[#2E4F41] dark:text-[#E4E1D8]">
                {counts.total === 0
                  ? 'Bạn chưa tạo nội dung nào trên tài khoản đám mây.'
                  : 'Không có nội dung nào khớp với bộ lọc hiện tại.'}
              </p>
              <p className="text-xs text-[#6B877B] dark:text-[#B8BDB5] max-w-md mx-auto">
                {counts.total === 0
                  ? 'Hãy tạo mới nhân vật, câu lệnh hoặc ý tưởng (mặc định là Riêng tư) để quản lý và chia sẻ tại đây.'
                  : 'Thử đổi trạng thái, loại nội dung hoặc từ khóa tìm kiếm để xem các mục khác.'}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const statsKey = buildVaultStatsKey(entry.kind, entry.ownerId, entry.id);
              const stats = statsMap[statsKey];
              const isItemBusy = busyKey === entry.key;
              const canToggleVisibility = !entry.isSystem && entry.ownerId === userId;
              const canMutate = entry.ownerId === userId || (isAdmin && entry.isSystem);
              const showCommunityStats =
                statsSchemaReady && (entry.isPublic || entry.isSystem || (stats && (stats.likes > 0 || stats.comments > 0 || stats.ratingCount > 0)));

              return (
                <div
                  key={entry.key}
                  className="p-3 rounded-lg border border-[#CFE2D6] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#242926] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-theme"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base leading-none shrink-0">{entry.icon}</span>
                      <h4 className="text-xs sm:text-[13px] font-bold text-[#1E3B2E] dark:text-[#E4E1D8] truncate max-w-full">
                        {entry.title}
                      </h4>

                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F1F8F3] dark:bg-[#202423] text-[#4C6A5C] dark:text-[#B8BDB5] border border-[#CFE2D6] dark:border-[#49554D]">
                        {KIND_LABELS[entry.kind]}
                      </span>

                      {entry.isSystem ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E2F3E8] dark:bg-[#343D37] text-[#1F533E] dark:text-[#A3BDA8] border border-[#8FC3A9] dark:border-[#63806E]">
                          <ShieldCheck className="w-3 h-3" />
                          Hệ thống
                        </span>
                      ) : entry.isPublic ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E2F3E8]/70 dark:bg-[#343D37] text-[#2B5A47] dark:text-[#A3BDA8] border border-[#9FC4AF] dark:border-[#49554D]">
                          <Globe className="w-3 h-3" />
                          Công khai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FAF6EA] dark:bg-[#292E2B] text-[#5B776A] dark:text-[#B8BDB5] border border-[#D4E2D9] dark:border-[#49554D]">
                          <Lock className="w-3 h-3" />
                          Riêng tư
                        </span>
                      )}
                    </div>

                    {entry.subtitle && (
                      <p className="text-[11px] text-[#587568] dark:text-[#B8BDB5] line-clamp-1">
                        {entry.subtitle}
                      </p>
                    )}

                    {/* Date & Engagement Stats */}
                    <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-[#5B776A] dark:text-[#B8BDB5] tabular-nums-mono">
                      {entry.updatedAt && (
                        <span>Cập nhật: {formatShortDate(entry.updatedAt)}</span>
                      )}

                      {showCommunityStats && (
                        <>
                          <span className="inline-flex items-center gap-1 text-[#A24057] dark:text-[#E4A6AA]">
                            <Heart className="w-3 h-3" />
                            {stats?.likes ?? 0} tim
                          </span>

                          {entry.kind === 'character' && (
                            <span className="inline-flex items-center gap-1 text-[#2B5A47] dark:text-[#A3BDA8]">
                              <MessageSquare className="w-3 h-3" />
                              {stats?.comments ?? 0} bình luận
                            </span>
                          )}

                          {(entry.kind === 'note' || entry.kind === 'library_prompt') && (
                            <span className="inline-flex items-center gap-1 text-[#8A6D2F] dark:text-[#D5B97A]">
                              <Star className="w-3 h-3" />
                              {stats && stats.ratingCount > 0
                                ? `${stats.ratingAverage.toFixed(1)}/5 (${stats.ratingCount})`
                                : '0 đánh giá'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Direct Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                    <button
                      type="button"
                      onClick={() => onViewItem(entry.kind, entry.item)}
                      className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      title="Mở xem chi tiết"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                      <span>Xem</span>
                    </button>

                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => onEditItem(entry.kind, entry.item)}
                        className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        title="Chỉnh sửa nội dung"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                        <span>Sửa</span>
                      </button>
                    )}

                    {canToggleVisibility && (
                      <button
                        type="button"
                        disabled={isTogglingPublic || isSavingItem || isItemBusy}
                        onClick={async () => {
                          setBusyKey(entry.key);
                          try {
                            await onTogglePublic(entry.kind, entry.item, !entry.isPublic);
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        className={`${
                          entry.isPublic ? 'retro-btn-active' : 'retro-btn'
                        } px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-60`}
                        title={
                          entry.isPublic
                            ? 'Chuyển về Riêng tư'
                            : 'Bật Công khai cho cộng đồng xem'
                        }
                      >
                        {isItemBusy && isTogglingPublic ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : entry.isPublic ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Globe className="w-3.5 h-3.5" />
                        )}
                        <span>{entry.isPublic ? 'Ẩn riêng tư' : 'Công khai'}</span>
                      </button>
                    )}

                    {canMutate && (
                      <button
                        type="button"
                        disabled={isSavingItem || isItemBusy}
                        onClick={async () => {
                          setBusyKey(entry.key);
                          try {
                            await onDeleteItem(entry.kind, entry.item);
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        className="retro-btn-danger px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                        title="Xóa nội dung này"
                      >
                        {isItemBusy && isSavingItem ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
