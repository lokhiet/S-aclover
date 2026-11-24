import type { AppState, Character, Idea, LibraryPrompt, Note } from '../types';
import { initialCharacters, initialIdeas } from '../initialData';
import { defaultLibraryPrompts } from '../promptsData';
import { readRawLocalStorageState } from '../utils';
import { getCharacterImages, getCharacterSocialLinks, getNoteDescriptionAndBlocks } from './contentBlocks';

export const BUILTIN_CHARACTER_MAP = new Map<string, Character>(
  initialCharacters.map((c) => [c.id, c]),
);
export const BUILTIN_IDEA_MAP = new Map<string, Idea>(
  initialIdeas.map((i) => [i.id, i]),
);
export const BUILTIN_LIBRARY_PROMPT_MAP = new Map<string, LibraryPrompt>(
  defaultLibraryPrompts.map((p) => [p.id, p]),
);

const REMOVED_LEGACY_NOTE_IDS = new Set(['note-1', 'note-2', 'note-3', 'note-4']);
const REMOVED_LEGACY_IDEA_IDS = new Set(['idea-1', 'idea-2']);
const REMOVED_LEGACY_CHAR_IDS = new Set([
  'char-1',
  'char-2',
  'char-3',
  'char-4',
  'char-truong-thua-vu',
  'char-co-kinh-thuong',
  'char-an-thua-hach',
  'char-ly-han-thu',
  'char-hoang-duy-khoa',
  'char-ky-tinh-an',
  'char-f4-dua-xe',
  'char-le-tham',
  'char-vu-co-sa',
  'char-ha-di-tru',
  'char-liam-lawrence',
  'char-ahmose',
  'char-co-lang-hien',
  'char-tan-triet',
  'char-ky-duc',
  'char-tham-tinh-hoi',
  'char-co-chau-hoanh',
  'char-tham-dien',
  'char-co-duc-lam',
  'char-co-vu-lam',
  'char-aoyagi-haru',
  'char-game-thuc-te-ao',
  'char-hoac-canh-chau',
  'char-bac-dinh-kieu',
]);

export interface PersonalDataBundle {
  characters: Character[];
  notes: Note[];
  ideas: Idea[];
  libraryPrompts: LibraryPrompt[];
}

export interface MigrationConflictItem {
  kind: 'character' | 'note' | 'idea' | 'library_prompt';
  id: string;
  label: string;
  cloudLabel: string;
}

export interface MigrationSummary {
  newData: PersonalDataBundle;
  conflictData: PersonalDataBundle;
  conflicts: MigrationConflictItem[];
  identicalCount: number;
  totalNewCount: number;
  totalConflictCount: number;
  totalActionableCount: number;
}

export type ImportConflictStrategy = 'keep-cloud' | 'clone-copy' | 'overwrite-cloud';

export interface ImportChunk {
  chunkId: string;
  kind: 'character' | 'note' | 'idea' | 'library_prompt';
  items: Array<Character | Note | Idea | LibraryPrompt>;
  approxBytes: number;
}

export interface ImportJobPlan {
  jobId: string;
  sourceLabel: 'local-migration' | 'json-import';
  strategy: ImportConflictStrategy;
  createdAt: string;
  chunks: ImportChunk[];
  totalItems: number;
  confirmedChunkIds: string[];
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function normStr(val?: string | null): string {
  return (val ?? '').trim();
}

export function isSameCharacterContent(a: Character, b: Character): boolean {
  const linksA = getCharacterSocialLinks(a).map((l) => ({
    platform: l.platform,
    url: l.url,
    label: l.label || '',
  }));
  const linksB = getCharacterSocialLinks(b).map((l) => ({
    platform: l.platform,
    url: l.url,
    label: l.label || '',
  }));
  const imgsA = getCharacterImages(a).map((img) => ({
    id: img.id,
    storagePath: img.storagePath || '',
    localId: img.localId || '',
    url: img.url || '',
  }));
  const imgsB = getCharacterImages(b).map((img) => ({
    id: img.id,
    storagePath: img.storagePath || '',
    localId: img.localId || '',
    url: img.url || '',
  }));

  return (
    normStr(a.name) === normStr(b.name) &&
    normStr(a.role) === normStr(b.role) &&
    normStr(a.avatar) === normStr(b.avatar) &&
    normStr(a.description) === normStr(b.description) &&
    normStr(a.author) === normStr(b.author) &&
    stableStringify(imgsA) === stableStringify(imgsB) &&
    stableStringify(linksA) === stableStringify(linksB) &&
    normStr(a.ggai) === normStr(b.ggai) &&
    normStr(a.backstoryUser) === normStr(b.backstoryUser) &&
    normStr(a.backstoryChar) === normStr(b.backstoryChar) &&
    normStr(a.backstoryUserTitle) === normStr(b.backstoryUserTitle) &&
    normStr(a.backstoryCharTitle) === normStr(b.backstoryCharTitle) &&
    normStr(a.userProfile) === normStr(b.userProfile) &&
    normStr(a.userProfileTitle) === normStr(b.userProfileTitle) &&
    normStr(a.prompt) === normStr(b.prompt)
  );
}

export function isSameNoteContent(a: Note, b: Note): boolean {
  const blocksA = getNoteDescriptionAndBlocks(a);
  const blocksB = getNoteDescriptionAndBlocks(b);
  return (
    normStr(a.title) === normStr(b.title) &&
    normStr(a.command) === normStr(b.command) &&
    normStr(a.content) === normStr(b.content) &&
    normStr(a.characterId) === normStr(b.characterId) &&
    normStr(a.categoryOffline) === normStr(b.categoryOffline) &&
    normStr(a.icon) === normStr(b.icon) &&
    stableStringify(blocksA) === stableStringify(blocksB)
  );
}

export function isSameIdeaContent(a: Idea, b: Idea): boolean {
  return (
    normStr(a.title) === normStr(b.title) &&
    normStr(a.content) === normStr(b.content) &&
    stableStringify(a.tags ?? []) === stableStringify(b.tags ?? [])
  );
}

export function isSameLibraryPromptContent(a: LibraryPrompt, b: LibraryPrompt): boolean {
  return (
    normStr(a.title) === normStr(b.title) &&
    normStr(a.description) === normStr(b.description) &&
    normStr(a.howToUse) === normStr(b.howToUse) &&
    normStr(a.author) === normStr(b.author) &&
    normStr(a.icon) === normStr(b.icon) &&
    stableStringify(a.tags ?? []) === stableStringify(b.tags ?? []) &&
    stableStringify(a.steps ?? []) === stableStringify(b.steps ?? [])
  );
}

/**
 * Lọc từ một nguồn dữ liệu (seaclover_state hoặc file JSON) ra CHỈ các mục cá nhân
 * hoặc mục mặc định đã thực sự bị người dùng chỉnh sửa nội dung (bỏ qua timestamp).
 */
export function extractPersonalDataFromSource(
  source: Partial<AppState> | null,
): PersonalDataBundle {
  if (!source) {
    return { characters: [], notes: [], ideas: [], libraryPrompts: [] };
  }

  const characters = (source.characters ?? []).filter((c) => {
    if (!c || !c.id || REMOVED_LEGACY_CHAR_IDS.has(c.id)) return false;
    const builtin = BUILTIN_CHARACTER_MAP.get(c.id);
    if (!builtin) return true;
    return !isSameCharacterContent(c, builtin);
  });

  const notes = (source.notes ?? []).filter(
    (n) => Boolean(n && n.id && !REMOVED_LEGACY_NOTE_IDS.has(n.id)),
  );

  const ideas = (source.ideas ?? []).filter((i) => {
    if (!i || !i.id || REMOVED_LEGACY_IDEA_IDS.has(i.id)) return false;
    const builtin = BUILTIN_IDEA_MAP.get(i.id);
    if (!builtin) return true;
    return !isSameIdeaContent(i, builtin);
  });

  const libraryPrompts = (source.libraryPrompts ?? []).filter((lp) => {
    if (!lp || !lp.id) return false;
    const builtin = BUILTIN_LIBRARY_PROMPT_MAP.get(lp.id);
    if (!builtin) return true;
    return !isSameLibraryPromptContent(lp, builtin);
  });

  return { characters, notes, ideas, libraryPrompts };
}

/**
 * Kiểm tra thuần (read-only) xem `seaclover_state` có dữ liệu cá nhân hay không.
 */
export function extractPersonalLocalData(): PersonalDataBundle {
  const raw = readRawLocalStorageState();
  return extractPersonalDataFromSource(raw);
}

/**
 * Đối chiếu nguồn cần nhập với dữ liệu hiện có trên tài khoản Supabase
 * để phân loại: mục mới, mục xung đột trùng ID, và mục đã giống hệt nhau.
 */
export function buildMigrationSummary(
  incoming: PersonalDataBundle,
  cloudCurrent: {
    characters: Character[];
    notes: Note[];
    ideas: Idea[];
    libraryPrompts: LibraryPrompt[];
    cloudItemIds: {
      characters: Set<string>;
      notes: Set<string>;
      ideas: Set<string>;
      libraryPrompts: Set<string>;
    };
  },
): MigrationSummary {
  const cloudCharMap = new Map(cloudCurrent.characters.map((c) => [c.id, c]));
  const cloudNoteMap = new Map(cloudCurrent.notes.map((n) => [n.id, n]));
  const cloudIdeaMap = new Map(cloudCurrent.ideas.map((i) => [i.id, i]));
  const cloudPromptMap = new Map(cloudCurrent.libraryPrompts.map((p) => [p.id, p]));

  const newData: PersonalDataBundle = {
    characters: [],
    notes: [],
    ideas: [],
    libraryPrompts: [],
  };
  const conflictData: PersonalDataBundle = {
    characters: [],
    notes: [],
    ideas: [],
    libraryPrompts: [],
  };
  const conflicts: MigrationConflictItem[] = [];
  let identicalCount = 0;

  for (const ch of incoming.characters) {
    const existingCloud = cloudCurrent.cloudItemIds.characters.has(ch.id)
      ? cloudCharMap.get(ch.id)
      : undefined;
    if (!existingCloud) {
      newData.characters.push(ch);
    } else if (isSameCharacterContent(ch, existingCloud)) {
      identicalCount += 1;
    } else {
      conflictData.characters.push(ch);
      conflicts.push({
        kind: 'character',
        id: ch.id,
        label: ch.name,
        cloudLabel: existingCloud.name,
      });
    }
  }

  for (const note of incoming.notes) {
    const existingCloud = cloudCurrent.cloudItemIds.notes.has(note.id)
      ? cloudNoteMap.get(note.id)
      : undefined;
    if (!existingCloud) {
      newData.notes.push(note);
    } else if (isSameNoteContent(note, existingCloud)) {
      identicalCount += 1;
    } else {
      conflictData.notes.push(note);
      conflicts.push({
        kind: 'note',
        id: note.id,
        label: note.title,
        cloudLabel: existingCloud.title,
      });
    }
  }

  for (const idea of incoming.ideas) {
    const existingCloud = cloudCurrent.cloudItemIds.ideas.has(idea.id)
      ? cloudIdeaMap.get(idea.id)
      : undefined;
    if (!existingCloud) {
      newData.ideas.push(idea);
    } else if (isSameIdeaContent(idea, existingCloud)) {
      identicalCount += 1;
    } else {
      conflictData.ideas.push(idea);
      conflicts.push({
        kind: 'idea',
        id: idea.id,
        label: idea.title,
        cloudLabel: existingCloud.title,
      });
    }
  }

  for (const lp of incoming.libraryPrompts) {
    const existingCloud = cloudCurrent.cloudItemIds.libraryPrompts.has(lp.id)
      ? cloudPromptMap.get(lp.id)
      : undefined;
    if (!existingCloud) {
      newData.libraryPrompts.push(lp);
    } else if (isSameLibraryPromptContent(lp, existingCloud)) {
      identicalCount += 1;
    } else {
      conflictData.libraryPrompts.push(lp);
      conflicts.push({
        kind: 'library_prompt',
        id: lp.id,
        label: lp.title,
        cloudLabel: existingCloud.title,
      });
    }
  }

  const totalNewCount =
    newData.characters.length +
    newData.notes.length +
    newData.ideas.length +
    newData.libraryPrompts.length;

  const totalConflictCount =
    conflictData.characters.length +
    conflictData.notes.length +
    conflictData.ideas.length +
    conflictData.libraryPrompts.length;

  return {
    newData,
    conflictData,
    conflicts,
    identicalCount,
    totalNewCount,
    totalConflictCount,
    totalActionableCount: totalNewCount + totalConflictCount,
  };
}

/**
 * Tạo mã băm ngắn xác định (FNV-1a kép 64-bit dạng hex 16 ký tự) từ nội dung.
 * Đảm bảo mọi lần thử lại (retry) sau rớt mạng đều trỏ vào CÙNG 1 item_id, không tạo bản trùng.
 */
function deterministicContentHash(payload: unknown): string {
  const input = stableStringify(payload);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + ((i & 0xff) << 1);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`;
}

export function computeDeterministicCopyId(originalId: string, payload: unknown): string {
  const hash = deterministicContentHash(payload).slice(0, 10);
  const safePrefix = originalId.slice(0, 170);
  return `${safePrefix}__copy_${hash}`;
}

const MAX_ITEMS_PER_CHUNK = 15;
const MAX_BYTES_PER_CHUNK = 350_000; // ~350 KB mỗi request để ổn định trên mạng yếu

function estimateUtf8Bytes(obj: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch {
    return JSON.stringify(obj).length * 2;
  }
}

function splitIntoChunks<T extends Character | Note | Idea | LibraryPrompt>(
  kind: ImportChunk['kind'],
  items: T[],
): ImportChunk[] {
  const chunks: ImportChunk[] = [];
  let currentItems: T[] = [];
  let currentBytes = 0;

  for (const item of items) {
    const itemBytes = estimateUtf8Bytes(item);
    const exceedsCount = currentItems.length >= MAX_ITEMS_PER_CHUNK;
    const exceedsBytes = currentItems.length > 0 && currentBytes + itemBytes > MAX_BYTES_PER_CHUNK;

    if (exceedsCount || exceedsBytes) {
      chunks.push({
        chunkId: `${kind}-${chunks.length + 1}`,
        kind,
        items: currentItems,
        approxBytes: currentBytes,
      });
      currentItems = [];
      currentBytes = 0;
    }

    currentItems.push(item);
    currentBytes += itemBytes;
  }

  if (currentItems.length > 0) {
    chunks.push({
      chunkId: `${kind}-${chunks.length + 1}`,
      kind,
      items: currentItems,
      approxBytes: currentBytes,
    });
  }

  return chunks;
}

/**
 * Khóa cứng kế hoạch nhập (ImportJobPlan) trước khi gửi request đầu tiên.
 * Đảm bảo idempotent tuyệt đối và có thể tiếp tục từ lô bị gián đoạn nếu mất mạng.
 */
export function buildImportJobPlan(
  summary: MigrationSummary,
  strategy: ImportConflictStrategy,
  sourceLabel: 'local-migration' | 'json-import',
): ImportJobPlan {
  const finalCharacters: Character[] = [...summary.newData.characters];
  const finalNotes: Note[] = [...summary.newData.notes];
  const finalIdeas: Idea[] = [...summary.newData.ideas];
  const finalLibraryPrompts: LibraryPrompt[] = [...summary.newData.libraryPrompts];

  const clonedCharIdMap = new Map<string, string>();

  if (strategy === 'overwrite-cloud') {
    finalCharacters.push(...summary.conflictData.characters);
    finalNotes.push(...summary.conflictData.notes);
    finalIdeas.push(...summary.conflictData.ideas);
    finalLibraryPrompts.push(...summary.conflictData.libraryPrompts);
  } else if (strategy === 'clone-copy') {
    for (const ch of summary.conflictData.characters) {
      const copyId = computeDeterministicCopyId(ch.id, ch);
      clonedCharIdMap.set(ch.id, copyId);
      finalCharacters.push({
        ...ch,
        id: copyId,
        name: ch.name.endsWith(' (Bản sao)') ? ch.name : `${ch.name} (Bản sao)`,
      });
    }

    for (const note of summary.conflictData.notes) {
      const remappedCharId = clonedCharIdMap.get(note.characterId) ?? note.characterId;
      const copyId = computeDeterministicCopyId(note.id, { ...note, characterId: remappedCharId });
      finalNotes.push({
        ...note,
        id: copyId,
        characterId: remappedCharId,
        title: note.title.endsWith(' (Bản sao)') ? note.title : `${note.title} (Bản sao)`,
      });
    }

    for (const idea of summary.conflictData.ideas) {
      const copyId = computeDeterministicCopyId(idea.id, idea);
      finalIdeas.push({
        ...idea,
        id: copyId,
        title: idea.title.endsWith(' (Bản sao)') ? idea.title : `${idea.title} (Bản sao)`,
      });
    }

    for (const lp of summary.conflictData.libraryPrompts) {
      const copyId = computeDeterministicCopyId(lp.id, lp);
      finalLibraryPrompts.push({
        ...lp,
        id: copyId,
        title: lp.title.endsWith(' (Bản sao)') ? lp.title : `${lp.title} (Bản sao)`,
      });
    }
  }

  // Remap notes in newData if they pointed to a character that was cloned during this merge
  const resolvedNotes =
    clonedCharIdMap.size > 0
      ? finalNotes.map((n) => ({
          ...n,
          characterId: clonedCharIdMap.get(n.characterId) ?? n.characterId,
        }))
      : finalNotes;

  const chunks: ImportChunk[] = [
    ...splitIntoChunks('character', finalCharacters),
    ...splitIntoChunks('note', resolvedNotes),
    ...splitIntoChunks('idea', finalIdeas),
    ...splitIntoChunks('library_prompt', finalLibraryPrompts),
  ];

  const totalItems =
    finalCharacters.length +
    resolvedNotes.length +
    finalIdeas.length +
    finalLibraryPrompts.length;

  const planHash = deterministicContentHash({
    sourceLabel,
    strategy,
    ids: chunks.flatMap((c) => c.items.map((it) => `${c.kind}:${it.id}`)),
  }).slice(0, 12);

  return {
    jobId: `${sourceLabel}_${planHash}`,
    sourceLabel,
    strategy,
    createdAt: new Date().toISOString(),
    chunks,
    totalItems,
    confirmedChunkIds: [],
  };
}

/**
 * Tải xuống bản sao lưu JSON trước khi nhập/hợp nhất.
 */
export function downloadBackupSnapshot(data: Partial<AppState>, filenamePrefix: string): void {
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
