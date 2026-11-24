import type { Character, SortOrder } from '../types';

export type CharacterDateFilterMode =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'thisMonth'
  | 'custom';

export interface CharacterDateFilter {
  mode: CharacterDateFilterMode;
  /** YYYY-MM-DD in user's local timezone (used when mode === 'custom') */
  customDateKey?: string;
}

export interface SavedDateEntry {
  dateKey: string;
  label: string;
  count: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Chuyển một timestamp bất kỳ sang khóa ngày YYYY-MM-DD theo đúng múi giờ địa phương của người dùng.
 * Trả về null nếu dữ liệu ngày không hợp lệ (không tự bịa ngày hiện tại).
 */
export function toLocalDateKey(input?: string | Date | null): string | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return `${input.getFullYear()}-${pad2(input.getMonth() + 1)}-${pad2(input.getDate())}`;
  }
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  // Nếu chuỗi chỉ là YYYY-MM-DD (không có giờ/múi giờ), giữ nguyên ngày lịch địa phương
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1]);
    const m = Number(dateOnlyMatch[2]);
    const d = Number(dateOnlyMatch[3]);
    const local = new Date(y, m - 1, d);
    if (local.getFullYear() === y && local.getMonth() === m - 1 && local.getDate() === d) {
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

export function formatLocalDateLabel(dateKey: string): string {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatCreatedDateShort(iso?: string | null): string | null {
  const key = toLocalDateKey(iso);
  if (!key) return null;
  return formatLocalDateLabel(key);
}

export function getLocalTodayDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function getOffsetLocalDateKey(daysOffset: number, now: Date = new Date()): string {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOffset);
  return `${target.getFullYear()}-${pad2(target.getMonth() + 1)}-${pad2(target.getDate())}`;
}

export function matchesCharacterDateFilter(
  createdAt: string | undefined | null,
  filter: CharacterDateFilter,
  now: Date = new Date(),
): boolean {
  if (!filter || filter.mode === 'all') return true;
  const itemKey = toLocalDateKey(createdAt);
  if (!itemKey) return false;

  const todayKey = getLocalTodayDateKey(now);
  if (filter.mode === 'today') {
    return itemKey === todayKey;
  }
  if (filter.mode === 'yesterday') {
    return itemKey === getOffsetLocalDateKey(-1, now);
  }
  if (filter.mode === 'last7days') {
    const startKey = getOffsetLocalDateKey(-6, now);
    return itemKey >= startKey && itemKey <= todayKey;
  }
  if (filter.mode === 'thisMonth') {
    return itemKey.slice(0, 7) === todayKey.slice(0, 7);
  }
  if (filter.mode === 'custom') {
    if (!filter.customDateKey) return true;
    return itemKey === filter.customDateKey;
  }
  return true;
}

export function getCharacterDateFilterBadgeLabel(
  filter: CharacterDateFilter,
  now: Date = new Date(),
): string | null {
  if (filter.mode === 'all') return null;
  if (filter.mode === 'today') return 'Hôm nay';
  if (filter.mode === 'yesterday') return 'Hôm qua';
  if (filter.mode === 'last7days') return '7 ngày qua';
  if (filter.mode === 'thisMonth') {
    return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  }
  if (filter.mode === 'custom' && filter.customDateKey) {
    return `Ngày ${formatLocalDateLabel(filter.customDateKey)}`;
  }
  return null;
}

/**
 * Tổng hợp danh sách các ngày đã lưu từ danh sách nhân vật đang hiển thị cho người dùng hiện tại.
 * Sắp xếp giảm dần theo ngày mới nhất.
 */
export function buildSavedCharacterDatesList(characters: Character[]): SavedDateEntry[] {
  const counts = new Map<string, number>();
  for (const ch of characters) {
    const key = toLocalDateKey(ch.createdAt);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, count]) => ({
      dateKey,
      label: formatLocalDateLabel(dateKey),
      count,
    }));
}

export interface SortableItemInfo {
  id: string;
  ownerId?: string;
  createdAt?: string;
}

function parseTrailingNumericId(id: string): number | null {
  const m = id.match(/(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Xác định thứ tự sắp xếp ổn định theo thời điểm tạo (`createdAt`):
 * - Nội dung có mốc thời gian thực (từ cloud hoặc do người dùng tự tạo) luôn giữ nguyên timestamp thực.
 * - Nội dung mặc định tích hợp sẵn (lib-1..lib-22, rp-1..rp-160 khi chưa lưu cloud) không dùng
 *   thời gian reload trình duyệt làm ngày tạo giả, mà giữ thứ tự cố định ổn định.
 */
export function sortItemsByCreatedOrder<T extends SortableItemInfo>(
  items: T[],
  order: SortOrder,
  builtinSeedIds?: Set<string>,
): T[] {
  const decorated = items.map((item, idx) => {
    const isUnpersistedBuiltin = Boolean(
      !item.ownerId && builtinSeedIds && builtinSeedIds.has(item.id),
    );
    const parsedTime =
      !isUnpersistedBuiltin && item.createdAt ? Date.parse(item.createdAt) : NaN;
    const hasRealTimestamp = Number.isFinite(parsedTime) && !isUnpersistedBuiltin;
    const seedNum = isUnpersistedBuiltin ? parseTrailingNumericId(item.id) : null;

    return {
      item,
      idx,
      isUnpersistedBuiltin,
      timestamp: hasRealTimestamp ? parsedTime : 0,
      seedNum,
    };
  });

  decorated.sort((a, b) => {
    // 1. Phân tách nội dung có mốc thời gian thực vs seed mặc định không có mốc tạo thực
    if (a.isUnpersistedBuiltin !== b.isUnpersistedBuiltin) {
      if (order === 'newest') {
        // Mới nhất: bài mới/có ngày tạo thực đứng trên seed mặc định
        return a.isUnpersistedBuiltin ? 1 : -1;
      }
      // Cũ nhất: seed mặc định là dữ liệu nền ban đầu -> đứng trước bài mới tạo sau
      return a.isUnpersistedBuiltin ? -1 : 1;
    }

    // 2. Cùng là seed mặc định -> thứ tự ổn định theo ID số (không đổi khi reload)
    if (a.isUnpersistedBuiltin && b.isUnpersistedBuiltin) {
      if (a.seedNum !== null && b.seedNum !== null && a.seedNum !== b.seedNum) {
        return order === 'newest' ? a.seedNum - b.seedNum : a.seedNum - b.seedNum;
      }
      return a.idx - b.idx;
    }

    // 3. Cùng có timestamp thực -> so sánh strictly theo createdAt
    if (a.timestamp !== b.timestamp) {
      return order === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    }

    // 4. Tie-breaker ổn định
    return a.idx - b.idx;
  });

  return decorated.map((d) => d.item);
}
