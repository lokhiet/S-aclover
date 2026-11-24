import type { Character, Idea, LibraryPrompt, Note, SharedTag } from '../types';
import { getNoteDescriptionAndBlocks } from './contentBlocks';

export interface TagCatalogEntry {
  label: string;
  key: string;
  slug: string;
  count: number;
  aliases: string[];
  description?: string;
  isShared?: boolean;
}

export interface TagSuggestionMatch {
  entry: TagCatalogEntry;
  matchType: 'exact' | 'alias' | 'synonym' | 'partial';
  matchedHint?: string;
}

/**
 * Chuẩn hóa hình thức hiển thị tag (xóa # đầu, gộp khoảng trắng thừa, giới hạn 50 ký tự).
 */
export function normalizeTagDisplay(raw: string): string {
  return raw
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

/**
 * Khóa so sánh chuẩn hóa không phân biệt hoa/thường, dấu tiếng Việt và khoảng trắng.
 */
export function toTagComparisonKey(raw: string): string {
  return normalizeTagDisplay(raw)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toTagSlug(raw: string): string {
  const base = toTagComparisonKey(raw)
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'tag';
}

/**
 * Các nhóm từ đồng nghĩa / song ngữ phổ biến trong cộng đồng SéaClover.
 * Chỉ dùng để GỢI Ý tái sử dụng tag sẵn có hoặc đối chiếu tìm kiếm —
 * tuyệt đối không tự ý gộp các khái niệm khác nhau (ví dụ Yandere vs BDSM, Ngọt ngào vs Ngược).
 */
const SEMANTIC_SYNONYM_GROUPS: string[][] = [
  ['cot truyen', 'story', 'plot', 'dan truyen', 'day cot truyen'],
  ['drama', 'kich tinh', 'twist', 'giong bao', 'cao trao'],
  ['mau cho', 'cau huyet', 'dogblood'],
  ['hai huoc', 'hai', 'funny', 'comedy', 'vui nhon'],
  ['troll', 'treu choc', 'choc pha', 'bay'],
  ['ngot ngao', 'ngot', 'sweet', 'nuong chieu', 'lang man', 'tinh cam'],
  ['nhay cam', 'nsfw', '18+', 'r18', 'canh nong', 'h scene', 'adult', 'nguoi lon'],
  ['ghen tuong', 'ghen', 'chiem huu', 'possessive'],
  ['chong godmode', 'anti godmode', 'chong quyen than', 'tu do thoai', 'chong khong che'],
  ['sua loi ooc', 'ooc', 'chinh don tinh cach', 'lech tinh cach'],
  ['chong lap tu', 'anti repetition', 'lap tu'],
  ['hud', 'bang chi so', 'chi so', 'trang thai'],
  ['mang xa hoi', 'social', 'tiktok', 'weibo', 'dien dan', 'forum'],
  ['sao luu', 'bao luu', 'backup', 'tom tat', 'quet 100 turn', 'ngu canh'],
  ['bypass', 'vuot rao', 'bo qua bo loc', 'mo khoa'],
  ['minigame', 'tro choi', 'truth or dare', 'that hay thach', 'xoay chai'],
  ['doi thuong', 'slice of life', 'sinh hoat', 'gia dinh', 'cham soc'],
  ['nau an', 'gian bep', 'am thuc', 'lam banh'],
  ['tong tai', 'ceo', 'cong so', 'sep'],
  ['hien dai', 'modern', 'do thi'],
  ['co dai', 'co trang', 'cung dau', 'kiem hiep'],
  ['fantasy', 'gia tuong', 'di gioi', 'phep thuat'],
  ['tu dong', 'auto play', 'ranh tay', 'sieu toc', 'luoi'],
  ['trinh duyet', 'web', 'luot web', 'browser'],
  ['suc khoe', 'om benh', 'benh tat', 'cham om'],
  ['hen ho', 'to tinh', 'dating', 'yeu duong'],
  ['quyến ru', 'quyen ru', 'goi cam', 'me hoac'],
  ['say xin', 'say ruou', 'uong ruou'],
  ['thu cung', 'pet', 'meo', 'cun'],
];

const SYNONYM_GROUP_BY_KEY = new Map<string, Set<string>>();
for (const group of SEMANTIC_SYNONYM_GROUPS) {
  const normalizedKeys = group.map((g) => toTagComparisonKey(g)).filter(Boolean);
  const groupSet = new Set(normalizedKeys);
  for (const key of normalizedKeys) {
    const existing = SYNONYM_GROUP_BY_KEY.get(key);
    if (existing) {
      for (const k of groupSet) existing.add(k);
    } else {
      SYNONYM_GROUP_BY_KEY.set(key, new Set(groupSet));
    }
  }
}

export function getSemanticSiblingKeys(rawTag: string, sharedTags: SharedTag[] = []): Set<string> {
  const key = toTagComparisonKey(rawTag);
  const out = new Set<string>(key ? [key] : []);
  if (!key) return out;

  const builtInGroup = SYNONYM_GROUP_BY_KEY.get(key);
  if (builtInGroup) {
    for (const k of builtInGroup) out.add(k);
  }

  for (const st of sharedTags) {
    const labelKey = toTagComparisonKey(st.label);
    const aliasKeys = (st.aliases || []).map((a) => toTagComparisonKey(a)).filter(Boolean);
    const allKeys = [labelKey, ...aliasKeys];
    if (allKeys.includes(key)) {
      for (const k of allKeys) out.add(k);
    }
  }

  return out;
}

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const display = normalizeTagDisplay(raw);
    if (!display) continue;
    const key = toTagComparisonKey(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(display);
  }
  return result;
}

export function getCharacterTags(char?: Partial<Character> | null): string[] {
  if (!char) return [];
  if (Array.isArray(char.tags) && char.tags.length > 0) {
    return dedupeTags(char.tags);
  }
  if (!char.role || typeof char.role !== 'string') return [];
  return dedupeTags(char.role.split(/[/,|]/));
}

export function applyTagsToCharacterFields(tags: string[]): {
  tags: string[];
  role: string;
} {
  const clean = dedupeTags(tags);
  return {
    tags: clean,
    role: clean.join(' / '),
  };
}

export function getNoteTags(note?: Partial<Note> | null): string[] {
  if (!note) return [];
  if (Array.isArray(note.tags) && note.tags.length > 0) {
    return dedupeTags(note.tags);
  }
  return dedupeTags(getNoteDescriptionAndBlocks(note).tags);
}

export function getIdeaTags(idea?: Partial<Idea> | null): string[] {
  if (!idea || !Array.isArray(idea.tags)) return [];
  return dedupeTags(idea.tags);
}

export function getLibraryPromptTags(prompt?: Partial<LibraryPrompt> | null): string[] {
  if (!prompt || !Array.isArray(prompt.tags)) return [];
  return dedupeTags(prompt.tags);
}

/**
 * Xây dựng danh mục tag CHỈ từ các mục đang hiển thị hợp lệ cho người xem hiện tại
 * (không bao giờ đếm hoặc rò rỉ dữ liệu riêng tư của người dùng khác).
 */
export function buildTagCatalogFromTagLists(
  tagLists: string[][],
  sharedTags: SharedTag[] = [],
  options: { includeZeroShared?: boolean } = {},
): TagCatalogEntry[] {
  const map = new Map<string, TagCatalogEntry>();

  const sharedByKey = new Map<string, SharedTag>();
  for (const st of sharedTags) {
    const label = normalizeTagDisplay(st.label);
    const key = toTagComparisonKey(label);
    if (!key) continue;
    sharedByKey.set(key, st);
    if (options.includeZeroShared) {
      map.set(key, {
        label,
        key,
        slug: st.slug || toTagSlug(label),
        count: 0,
        aliases: dedupeTags(st.aliases || []),
        description: st.description,
        isShared: true,
      });
    }
  }

  for (const list of tagLists) {
    const perItemUniqueKeys = new Set<string>();
    for (const raw of list) {
      const display = normalizeTagDisplay(raw);
      const key = toTagComparisonKey(display);
      if (!display || !key || perItemUniqueKeys.has(key)) continue;
      perItemUniqueKeys.add(key);

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        const shared = sharedByKey.get(key);
        map.set(key, {
          label: shared ? normalizeTagDisplay(shared.label) : display,
          key,
          slug: shared?.slug || toTagSlug(display),
          count: 1,
          aliases: shared ? dedupeTags(shared.aliases || []) : [],
          description: shared?.description,
          isShared: Boolean(shared),
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label, 'vi');
  });
}

/**
 * Tìm gợi ý các tag đã tồn tại có tên hoặc ý nghĩa tương tự với chuỗi người dùng đang gõ.
 */
export function findMatchingExistingTags(
  rawQuery: string,
  catalog: TagCatalogEntry[],
  sharedTags: SharedTag[] = [],
  excludeLabels: string[] = [],
  limit = 8,
): TagSuggestionMatch[] {
  const excludedKeys = new Set(excludeLabels.map((l) => toTagComparisonKey(l)));
  const qNorm = normalizeTagDisplay(rawQuery);
  const qKey = toTagComparisonKey(qNorm);

  if (!qKey) {
    return catalog
      .filter((entry) => !excludedKeys.has(entry.key))
      .slice(0, limit)
      .map((entry) => ({ entry, matchType: 'partial' }));
  }

  const siblingKeys = getSemanticSiblingKeys(qNorm, sharedTags);
  const scored: Array<{ match: TagSuggestionMatch; score: number }> = [];

  for (const entry of catalog) {
    if (excludedKeys.has(entry.key)) continue;

    if (entry.key === qKey) {
      scored.push({ match: { entry, matchType: 'exact' }, score: 1000 + entry.count });
      continue;
    }

    const aliasMatch = entry.aliases.find((a) => toTagComparisonKey(a) === qKey);
    if (aliasMatch) {
      scored.push({
        match: { entry, matchType: 'alias', matchedHint: aliasMatch },
        score: 850 + entry.count,
      });
      continue;
    }

    if (siblingKeys.has(entry.key)) {
      scored.push({
        match: { entry, matchType: 'synonym', matchedHint: 'Cùng ý nghĩa' },
        score: 700 + entry.count,
      });
      continue;
    }

    const entrySiblings = getSemanticSiblingKeys(entry.label, sharedTags);
    const aliasPartial = entry.aliases.find((a) => {
      const ak = toTagComparisonKey(a);
      return ak.includes(qKey) || qKey.includes(ak);
    });
    const isPrefix = entry.key.startsWith(qKey);
    const isSubstr = entry.key.includes(qKey) || qKey.includes(entry.key);
    const isSiblingPartial = Array.from(entrySiblings).some((sk) => sk.includes(qKey));

    if (isPrefix || isSubstr || aliasPartial || isSiblingPartial) {
      const base = isPrefix ? 550 : isSubstr ? 450 : 350;
      scored.push({
        match: {
          entry,
          matchType: 'partial',
          matchedHint: aliasPartial || undefined,
        },
        score: base + Math.min(entry.count, 50),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.match);
}

/**
 * Tìm tag sẵn có khớp tốt nhất để gợi ý chuẩn hóa (KHÔNG ép ghi đè lựa chọn của người dùng).
 */
export function findNormalizationSuggestion(
  rawTag: string,
  catalog: TagCatalogEntry[],
  sharedTags: SharedTag[] = [],
): TagSuggestionMatch | null {
  const clean = normalizeTagDisplay(rawTag);
  const key = toTagComparisonKey(clean);
  if (!key) return null;

  const exactCase = catalog.find((c) => c.label === clean);
  if (exactCase) return null;

  // 1) Khớp đúng ý nghĩa chỉ khác hoa/thường/dấu/khoảng trắng
  const sameKey = catalog.find((c) => c.key === key);
  if (sameKey) {
    return { entry: sameKey, matchType: 'exact' };
  }

  // 2) Khớp alias hoặc từ đồng nghĩa
  const siblingKeys = getSemanticSiblingKeys(clean, sharedTags);
  for (const entry of catalog) {
    if (entry.aliases.some((a) => toTagComparisonKey(a) === key)) {
      return { entry, matchType: 'alias', matchedHint: clean };
    }
    if (siblingKeys.has(entry.key)) {
      return { entry, matchType: 'synonym', matchedHint: 'Cùng ý nghĩa' };
    }
  }

  return null;
}

/**
 * Lọc theo nhiều tag (AND): mục phải chứa tất cả các tag đang chọn.
 */
export function itemMatchesSelectedTags(
  itemTags: string[],
  selectedTags: string[],
  sharedTags: SharedTag[] = [],
): boolean {
  if (selectedTags.length === 0) return true;
  if (itemTags.length === 0) return false;

  const itemKeys = new Set(itemTags.map((t) => toTagComparisonKey(t)).filter(Boolean));
  const sharedAliasMap = new Map<string, Set<string>>();
  for (const st of sharedTags) {
    const lk = toTagComparisonKey(st.label);
    if (!lk) continue;
    const set = new Set<string>([
      lk,
      ...(st.aliases || []).map((a) => toTagComparisonKey(a)).filter(Boolean),
    ]);
    for (const k of set) {
      sharedAliasMap.set(k, set);
    }
  }

  return selectedTags.every((sel) => {
    const sk = toTagComparisonKey(sel);
    if (!sk) return true;
    if (itemKeys.has(sk)) return true;
    const aliases = sharedAliasMap.get(sk);
    if (aliases) {
      for (const ak of aliases) {
        if (itemKeys.has(ak)) return true;
      }
    }
    return false;
  });
}

/**
 * Kiểm tra xem danh sách tag của bài viết (hoặc alias của các tag đó trong sharedTags)
 * có khớp với từ khóa tìm kiếm hay không. Hỗ trợ tìm kiếm lại theo tên tag cũ sau khi Admin gộp tag.
 */
export function itemHasTagMatchingQuery(
  itemTags: string[],
  rawQuery: string,
  sharedTags: SharedTag[] = [],
): boolean {
  const queryLower = rawQuery.trim().toLowerCase();
  if (!queryLower) return true;
  if (itemTags.length === 0) return false;

  const queryKey = toTagComparisonKey(rawQuery);
  const sharedByKey = new Map<string, SharedTag>();
  for (const st of sharedTags) {
    const lk = toTagComparisonKey(st.label);
    if (lk) sharedByKey.set(lk, st);
  }

  return itemTags.some((tag) => {
    if (tag.toLowerCase().includes(queryLower)) return true;
    const key = toTagComparisonKey(tag);
    if (queryKey && key.includes(queryKey)) return true;
    const shared = sharedByKey.get(key);
    if (shared && Array.isArray(shared.aliases)) {
      return shared.aliases.some((alias) => {
        if (alias.toLowerCase().includes(queryLower)) return true;
        const aliasKey = toTagComparisonKey(alias);
        return Boolean(queryKey && aliasKey.includes(queryKey));
      });
    }
    return false;
  });
}

/**
 * Tạo danh sách nhãn tag hiện có (ưu tiên các tag đang dùng phổ biến + sharedTags)
 * để làm ngữ cảnh tái sử dụng tag cho bộ phân tích từ khóa.
 */
export function getAvailableTagLabels(
  availableCatalog: TagCatalogEntry[],
  sharedTags: SharedTag[] = [],
  limit = 120,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of availableCatalog) {
    const label = normalizeTagDisplay(entry.label);
    const key = toTagComparisonKey(label);
    if (!label || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) return out;
  }

  for (const st of sharedTags) {
    const label = normalizeTagDisplay(st.label);
    const key = toTagComparisonKey(label);
    if (!label || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) return out;
  }

  return out;
}

/**
 * Chuẩn hóa danh sách tag được đề xuất:
 * 1) Ưu tiên tái sử dụng đúng nhãn tag hiện có trong catalog/sharedTags nếu trùng khóa, alias hoặc đồng nghĩa.
 * 2) Chỉ giữ tag mới khi chưa có tag phù hợp về ngữ nghĩa.
 * 3) Giữ tối đa maxTags (mặc định 5) tag sạch và không trùng lặp.
 */
export function canonicalizeAiSuggestedTags(
  suggestedTags: string[],
  availableCatalog: TagCatalogEntry[],
  sharedTags: SharedTag[] = [],
  maxTags = 5,
): string[] {
  const catalogByKey = new Map<string, TagCatalogEntry>();
  for (const entry of availableCatalog) {
    if (entry.key && !catalogByKey.has(entry.key)) {
      catalogByKey.set(entry.key, entry);
    }
  }

  const sharedByKey = new Map<string, SharedTag>();
  for (const st of sharedTags) {
    const label = normalizeTagDisplay(st.label);
    const key = toTagComparisonKey(label);
    if (label && key && !sharedByKey.has(key)) {
      sharedByKey.set(key, st);
    }
  }

  const mapped: string[] = [];

  for (const raw of suggestedTags) {
    const clean = normalizeTagDisplay(raw);
    const key = toTagComparisonKey(clean);
    if (!clean || !key) continue;

    // 1. Trùng chính xác (không phân biệt hoa/thường/dấu) với tag trong catalog hoặc sharedTags
    const exactCatalog = catalogByKey.get(key);
    if (exactCatalog) {
      mapped.push(exactCatalog.label);
      continue;
    }

    const exactShared = sharedByKey.get(key);
    if (exactShared) {
      mapped.push(normalizeTagDisplay(exactShared.label));
      continue;
    }

    // 2. Khớp alias hoặc nhóm từ đồng nghĩa trong catalog hiện có
    const normMatch = findNormalizationSuggestion(clean, availableCatalog, sharedTags);
    if (normMatch) {
      mapped.push(normMatch.entry.label);
      continue;
    }

    // 3. Khớp alias hoặc nhóm từ đồng nghĩa với sharedTags chưa có bài nào dùng
    const siblingKeys = getSemanticSiblingKeys(clean, sharedTags);
    const matchedShared = sharedTags.find((st) => {
      const sk = toTagComparisonKey(st.label);
      if (siblingKeys.has(sk)) return true;
      return (st.aliases || []).some((a) => {
        const ak = toTagComparisonKey(a);
        return ak === key || siblingKeys.has(ak);
      });
    });
    if (matchedShared) {
      mapped.push(normalizeTagDisplay(matchedShared.label));
      continue;
    }

    // 4. Chỉ tạo tag mới khi chưa có tag phù hợp về ngữ nghĩa
    mapped.push(clean);
  }

  return dedupeTags(mapped).slice(0, maxTags);
}

