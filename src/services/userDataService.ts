import { supabase } from '../lib/supabase';
import type { Character, Idea, LibraryPrompt, Note, PromptStep, PublicProfile } from '../types';
import { initialCharacters, initialIdeas } from '../initialData';
import { defaultLibraryPrompts } from '../promptsData';
import type { ImportChunk, ImportJobPlan } from '../utils/localDataDiff';
import { fetchPublicProfilesMap, isMissingCommunitySchemaError } from './communityService';

export type DataEntityKind = 'character' | 'note' | 'idea' | 'library_prompt';

export interface SyncedVersionEntry {
  version: number;
  updatedAt: string;
}

export type SyncedVersionMap = Record<string, SyncedVersionEntry>;

export interface CloudUserDataSnapshot {
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
  deletedIds: {
    characters: Set<string>;
    ideas: Set<string>;
    libraryPrompts: Set<string>;
  };
  versions: SyncedVersionMap;
}

export interface PublicCommunitySnapshot {
  characters: Character[];
  notes: Note[];
  ideas: Idea[];
  libraryPrompts: LibraryPrompt[];
  versions: SyncedVersionMap;
  schemaReady: boolean;
}

export interface DataServiceError {
  code: string;
  message: string;
  isMissingTable?: boolean;
  isMissingMigration003?: boolean;
  isNetworkError?: boolean;
  isAuthError?: boolean;
}

export interface ConflictDetail<T = Character | Note | Idea | LibraryPrompt> {
  kind: DataEntityKind;
  itemId: string;
  ownerId?: string;
  localItem: T;
  serverItem: T | null;
  serverDeleted: boolean;
  serverVersion: number;
  serverUpdatedAt: string;
}

export interface DataServiceResult<T> {
  ok: boolean;
  data?: T;
  version?: number;
  updatedAt?: string;
  conflict?: ConflictDetail<any>;
  error?: DataServiceError;
}

export interface SaveOptions {
  expectedVersion?: number;
  isFirstOverride?: boolean;
  forceOverwrite?: boolean;
  isPublic?: boolean;
  isSystem?: boolean;
}

export function versionKey(kind: DataEntityKind, itemId: string, ownerId?: string): string {
  return ownerId ? `${kind}:${ownerId}:${itemId}` : `${kind}:${itemId}`;
}

export function buildCloudKey(ownerId: string | undefined, itemId: string): string {
  return ownerId ? `${ownerId}:${itemId}` : `local:${itemId}`;
}

function toSafeIsoTimestamp(value?: string | null): string {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

type SocialLinkValue = { name: string; url: string } | string;

function sanitizeSocialLink(value: unknown): SocialLinkValue | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (value && typeof value === 'object') {
    const obj = value as { name?: unknown; url?: unknown };
    const url = typeof obj.url === 'string' ? obj.url.trim() : '';
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!url && !name) return null;
    return { name: name || 'Link', url };
  }
  return null;
}

function parseSocialLink(value: unknown): SocialLinkValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as { name?: unknown; url?: unknown };
    if (typeof obj.url === 'string') {
      return {
        name: typeof obj.name === 'string' ? obj.name : 'Link',
        url: obj.url,
      };
    }
  }
  return undefined;
}

function parsePromptSteps(value: unknown): PromptStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((step) => step && typeof step === 'object')
    .map((step) => {
      const s = step as { label?: unknown; content?: unknown; note?: unknown };
      const parsed: PromptStep = {
        label: typeof s.label === 'string' ? s.label : '',
        content: typeof s.content === 'string' ? s.content : '',
      };
      if (typeof s.note === 'string' && s.note.length > 0) {
        parsed.note = s.note;
      }
      return parsed;
    });
}

function isMissingVisibilityColumnError(error: unknown): boolean {
  const errObj = error as { code?: string; message?: string } | null;
  const code = String(errObj?.code || '');
  const lower = String(errObj?.message || '').toLowerCase();
  return (
    (code === '42703' || code === 'PGRST204') &&
    (lower.includes('is_public') || lower.includes('is_system') || lower.includes('published_at'))
  );
}

// ----------------------------------------------------------------------------
// Row <-> TypeScript Mappers (100% lossless round-trip + visibility metadata)
// ----------------------------------------------------------------------------

interface VisibilityColumns {
  is_public?: boolean;
  is_system?: boolean;
  published_at?: string | null;
}

interface CharacterRow extends VisibilityColumns {
  user_id: string;
  item_id: string;
  name: string;
  role: string;
  avatar: string;
  description: string | null;
  author: string | null;
  fb: SocialLinkValue | null;
  discord: SocialLinkValue | null;
  discord2: SocialLinkValue | null;
  web: SocialLinkValue | null;
  other: SocialLinkValue | null;
  ggai: string | null;
  backstory_user: string | null;
  backstory_char: string | null;
  backstory_user_title: string | null;
  backstory_char_title: string | null;
  user_profile: string | null;
  user_profile_title: string | null;
  prompt: string | null;
  item_created_at: string;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface NoteRow extends VisibilityColumns {
  user_id: string;
  item_id: string;
  title: string;
  command: string;
  content: string;
  character_id: string;
  category_offline: string | null;
  icon: string | null;
  item_created_at: string;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface IdeaRow extends VisibilityColumns {
  user_id: string;
  item_id: string;
  title: string;
  content: string;
  tags: string[] | null;
  item_created_at: string;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface LibraryPromptRow extends VisibilityColumns {
  user_id: string;
  item_id: string;
  title: string;
  description: string;
  how_to_use: string;
  author: string;
  tags: string[];
  icon: string | null;
  steps: PromptStep[];
  item_created_at: string;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

function attachAuthorMeta(
  row: { user_id: string; item_id: string } & VisibilityColumns,
  profilesMap?: Record<string, PublicProfile>,
) {
  const profile = profilesMap?.[row.user_id];
  return {
    ownerId: row.user_id,
    isPublic: Boolean(row.is_public || row.is_system),
    isSystem: Boolean(row.is_system),
    publishedAt: nullToUndefined(row.published_at),
    authorDisplayName: profile?.display_name || undefined,
    authorRole: profile?.role || (row.is_system ? ('admin' as const) : undefined),
    cloudKey: buildCloudKey(row.user_id, row.item_id),
  };
}

function characterToRowPayload(
  userId: string,
  char: Character,
  isDeleted = false,
  visibility?: { isPublic?: boolean; isSystem?: boolean; omitVisibility?: boolean },
) {
  const base: Record<string, unknown> = {
    user_id: userId,
    item_id: char.id,
    name: char.name,
    role: char.role ?? '',
    avatar: char.avatar || '🍀',
    description: char.description ?? null,
    author: char.author ?? null,
    fb: sanitizeSocialLink(char.fb),
    discord: sanitizeSocialLink(char.discord),
    discord2: sanitizeSocialLink(char.discord2),
    web: sanitizeSocialLink(char.web),
    other: sanitizeSocialLink(char.other),
    ggai: char.ggai ?? null,
    backstory_user: char.backstoryUser ?? null,
    backstory_char: char.backstoryChar ?? null,
    backstory_user_title: char.backstoryUserTitle ?? null,
    backstory_char_title: char.backstoryCharTitle ?? null,
    user_profile: char.userProfile ?? null,
    user_profile_title: char.userProfileTitle ?? null,
    prompt: char.prompt ?? null,
    item_created_at: toSafeIsoTimestamp(char.createdAt),
    is_deleted: isDeleted,
  };

  if (!visibility?.omitVisibility) {
    const isSystem = Boolean(visibility?.isSystem ?? char.isSystem ?? false);
    const isPublic = isSystem ? true : Boolean(visibility?.isPublic ?? char.isPublic ?? false);
    if (isSystem || isPublic || visibility?.isPublic !== undefined || visibility?.isSystem !== undefined) {
      base.is_system = isSystem;
      base.is_public = isDeleted ? false : isPublic;
    }
  }

  return base;
}

function rowToCharacter(
  row: CharacterRow,
  profilesMap?: Record<string, PublicProfile>,
): Character {
  return {
    id: row.item_id,
    name: row.name,
    role: row.role ?? '',
    avatar: row.avatar || '🍀',
    description: nullToUndefined(row.description),
    createdAt: row.item_created_at || row.created_at,
    author: nullToUndefined(row.author),
    fb: parseSocialLink(row.fb),
    discord: parseSocialLink(row.discord),
    discord2: parseSocialLink(row.discord2),
    web: parseSocialLink(row.web),
    other: parseSocialLink(row.other),
    ggai: nullToUndefined(row.ggai),
    backstoryUser: nullToUndefined(row.backstory_user),
    backstoryChar: nullToUndefined(row.backstory_char),
    backstoryUserTitle: nullToUndefined(row.backstory_user_title),
    backstoryCharTitle: nullToUndefined(row.backstory_char_title),
    userProfile: nullToUndefined(row.user_profile),
    userProfileTitle: nullToUndefined(row.user_profile_title),
    prompt: nullToUndefined(row.prompt),
    ...attachAuthorMeta(row, profilesMap),
  };
}

function noteToRowPayload(
  userId: string,
  note: Note,
  isDeleted = false,
  visibility?: { isPublic?: boolean; isSystem?: boolean; omitVisibility?: boolean },
) {
  const base: Record<string, unknown> = {
    user_id: userId,
    item_id: note.id,
    title: note.title,
    command: note.command ?? '',
    content: note.content ?? '',
    character_id: note.characterId ?? '',
    category_offline: note.categoryOffline ?? null,
    icon: note.icon ?? null,
    item_created_at: toSafeIsoTimestamp(note.createdAt),
    is_deleted: isDeleted,
  };

  if (!visibility?.omitVisibility) {
    const isSystem = Boolean(visibility?.isSystem ?? note.isSystem ?? false);
    const isPublic = isSystem ? true : Boolean(visibility?.isPublic ?? note.isPublic ?? false);
    if (isSystem || isPublic || visibility?.isPublic !== undefined || visibility?.isSystem !== undefined) {
      base.is_system = isSystem;
      base.is_public = isDeleted ? false : isPublic;
    }
  }

  return base;
}

function rowToNote(row: NoteRow, profilesMap?: Record<string, PublicProfile>): Note {
  return {
    id: row.item_id,
    title: row.title,
    command: row.command ?? '',
    content: row.content ?? '',
    characterId: row.character_id ?? '',
    categoryOffline: nullToUndefined(row.category_offline),
    icon: nullToUndefined(row.icon),
    createdAt: row.item_created_at || row.created_at,
    updatedAt: row.updated_at || row.item_created_at || row.created_at,
    ...attachAuthorMeta(row, profilesMap),
  };
}

function ideaToRowPayload(
  userId: string,
  idea: Idea,
  isDeleted = false,
  visibility?: { isPublic?: boolean; isSystem?: boolean; omitVisibility?: boolean },
) {
  const base: Record<string, unknown> = {
    user_id: userId,
    item_id: idea.id,
    title: idea.title,
    content: idea.content ?? '',
    tags: Array.isArray(idea.tags) ? idea.tags : null,
    item_created_at: toSafeIsoTimestamp(idea.createdAt),
    is_deleted: isDeleted,
  };

  if (!visibility?.omitVisibility) {
    const isSystem = Boolean(visibility?.isSystem ?? idea.isSystem ?? false);
    const isPublic = isSystem ? true : Boolean(visibility?.isPublic ?? idea.isPublic ?? false);
    if (isSystem || isPublic || visibility?.isPublic !== undefined || visibility?.isSystem !== undefined) {
      base.is_system = isSystem;
      base.is_public = isDeleted ? false : isPublic;
    }
  }

  return base;
}

function rowToIdea(row: IdeaRow, profilesMap?: Record<string, PublicProfile>): Idea {
  return {
    id: row.item_id,
    title: row.title,
    content: row.content ?? '',
    tags: row.tags === null ? undefined : row.tags,
    createdAt: row.item_created_at || row.created_at,
    updatedAt: row.updated_at || row.item_created_at || row.created_at,
    ...attachAuthorMeta(row, profilesMap),
  };
}

function libraryPromptToRowPayload(
  userId: string,
  prompt: LibraryPrompt,
  isDeleted = false,
  visibility?: { isPublic?: boolean; isSystem?: boolean; omitVisibility?: boolean },
) {
  const base: Record<string, unknown> = {
    user_id: userId,
    item_id: prompt.id,
    title: prompt.title,
    description: prompt.description ?? '',
    how_to_use: prompt.howToUse ?? '',
    author: prompt.author ?? '',
    tags: Array.isArray(prompt.tags) ? prompt.tags : [],
    icon: prompt.icon ?? null,
    steps: Array.isArray(prompt.steps) ? prompt.steps : [],
    item_created_at: toSafeIsoTimestamp(prompt.createdAt),
    is_deleted: isDeleted,
  };

  if (!visibility?.omitVisibility) {
    const isSystem = Boolean(visibility?.isSystem ?? prompt.isSystem ?? false);
    const isPublic = isSystem ? true : Boolean(visibility?.isPublic ?? prompt.isPublic ?? false);
    if (isSystem || isPublic || visibility?.isPublic !== undefined || visibility?.isSystem !== undefined) {
      base.is_system = isSystem;
      base.is_public = isDeleted ? false : isPublic;
    }
  }

  return base;
}

function rowToLibraryPrompt(
  row: LibraryPromptRow,
  profilesMap?: Record<string, PublicProfile>,
): LibraryPrompt {
  return {
    id: row.item_id,
    title: row.title,
    description: row.description ?? '',
    howToUse: row.how_to_use ?? '',
    author: row.author ?? '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    icon: nullToUndefined(row.icon),
    steps: parsePromptSteps(row.steps),
    createdAt: row.item_created_at || row.created_at,
    ...attachAuthorMeta(row, profilesMap),
  };
}

// ----------------------------------------------------------------------------
// Vietnamese Error Normalization
// ----------------------------------------------------------------------------

export function normalizeDataError(error: unknown, fallbackMessage: string): DataServiceError {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      code: 'OFFLINE',
      message: 'Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng rồi thử lại.',
      isNetworkError: true,
    };
  }

  const errObj = error as { code?: string; message?: string; status?: number; details?: string } | null;
  const code = String(errObj?.code || '');
  const rawMessage = String(errObj?.message || '');
  const lower = rawMessage.toLowerCase();

  if (isMissingVisibilityColumnError(error)) {
    return {
      code: code || 'MIGRATION_003_REQUIRED',
      message:
        'Cơ sở dữ liệu chưa chạy migration 003. Vui lòng chạy tệp 003_admin_and_community.sql trên Supabase để bật Công khai / Hệ thống.',
      isMissingMigration003: true,
    };
  }

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    lower.includes('could not find the table') ||
    lower.includes('relation "public.user_') ||
    lower.includes('does not exist')
  ) {
    return {
      code: code || 'TABLE_MISSING',
      message:
        'Các bảng lưu dữ liệu trên Supabase chưa được khởi tạo. Vui lòng chạy tệp SQL migration 002 trong Supabase Dashboard rồi tải lại trang.',
      isMissingTable: true,
    };
  }

  if (
    errObj?.status === 401 ||
    code === 'PGRST301' ||
    lower.includes('jwt') ||
    lower.includes('invalid refresh token') ||
    lower.includes('session')
  ) {
    return {
      code: code || 'AUTH_EXPIRED',
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục lưu dữ liệu.',
      isAuthError: true,
    };
  }

  if (code === '42501' || errObj?.status === 403 || lower.includes('row-level security')) {
    return {
      code: code || 'FORBIDDEN',
      message:
        rawMessage && /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(rawMessage)
          ? rawMessage
          : 'Bạn không có quyền thực hiện thao tác này trên tài khoản hiện tại.',
      isAuthError: true,
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('fetch') ||
    lower.includes('timeout') ||
    lower.includes('abort')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Mất kết nối tới máy chủ Supabase. Dữ liệu chưa được lưu, vui lòng kiểm tra mạng và thử lại.',
      isNetworkError: true,
    };
  }

  if (errObj?.status === 413 || lower.includes('payload too large')) {
    return {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Nội dung gửi lên quá lớn. Vui lòng rút gọn hoặc chia nhỏ nội dung rồi thử lại.',
    };
  }

  if (code === '23514' || lower.includes('check constraint')) {
    return {
      code,
      message: 'Dữ liệu không hợp lệ (kiểm tra tiêu đề/tên không được để trống hoặc quá giới hạn).',
    };
  }

  return {
    code: code || 'UNKNOWN_ERROR',
    message: fallbackMessage,
  };
}

// ----------------------------------------------------------------------------
// Fetch Own User Data (User-Wins Merge with Built-in Defaults)
// ----------------------------------------------------------------------------

export async function fetchUserData(
  userId: string,
): Promise<DataServiceResult<CloudUserDataSnapshot>> {
  if (!supabase) {
    return {
      ok: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'Supabase chưa được cấu hình.',
      },
    };
  }

  try {
    const [charRes, noteRes, ideaRes, promptRes] = await Promise.all([
      supabase
        .from('user_characters')
        .select('*')
        .eq('user_id', userId)
        .order('item_created_at', { ascending: true }),
      supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId)
        .order('item_created_at', { ascending: true }),
      supabase
        .from('user_ideas')
        .select('*')
        .eq('user_id', userId)
        .order('item_created_at', { ascending: true }),
      supabase
        .from('user_library_prompts')
        .select('*')
        .eq('user_id', userId)
        .order('item_created_at', { ascending: true }),
    ]);

    const firstError = charRes.error || noteRes.error || ideaRes.error || promptRes.error;
    if (firstError) {
      return {
        ok: false,
        error: normalizeDataError(
          firstError,
          'Không thể tải dữ liệu tài khoản từ Supabase. Vui lòng thử lại.',
        ),
      };
    }

    const profilesMap = await fetchPublicProfilesMap([userId]);
    const versions: SyncedVersionMap = {};
    const cloudItemIds = {
      characters: new Set<string>(),
      notes: new Set<string>(),
      ideas: new Set<string>(),
      libraryPrompts: new Set<string>(),
    };
    const deletedIds = {
      characters: new Set<string>(),
      ideas: new Set<string>(),
      libraryPrompts: new Set<string>(),
    };

    // 1. Characters
    const cloudCharRows = (charRes.data ?? []) as CharacterRow[];
    const cloudCharMap = new Map<string, Character>();
    for (const row of cloudCharRows) {
      const entry = { version: row.version, updatedAt: row.updated_at };
      versions[versionKey('character', row.item_id)] = entry;
      versions[versionKey('character', row.item_id, row.user_id)] = entry;
      if (row.is_deleted) {
        deletedIds.characters.add(row.item_id);
      } else {
        cloudItemIds.characters.add(row.item_id);
        cloudCharMap.set(row.item_id, rowToCharacter(row, profilesMap));
      }
    }

    const mergedCharacters: Character[] = [];
    const seenCharIds = new Set<string>();
    for (const builtin of initialCharacters) {
      if (deletedIds.characters.has(builtin.id)) continue;
      const override = cloudCharMap.get(builtin.id);
      mergedCharacters.push(override ?? builtin);
      seenCharIds.add(builtin.id);
    }
    for (const row of cloudCharRows) {
      if (row.is_deleted || seenCharIds.has(row.item_id)) continue;
      const mapped = cloudCharMap.get(row.item_id);
      if (mapped) {
        mergedCharacters.push(mapped);
        seenCharIds.add(row.item_id);
      }
    }

    // 2. Notes
    const cloudNoteRows = (noteRes.data ?? []) as NoteRow[];
    const mergedNotes: Note[] = [];
    for (const row of cloudNoteRows) {
      const entry = { version: row.version, updatedAt: row.updated_at };
      versions[versionKey('note', row.item_id)] = entry;
      versions[versionKey('note', row.item_id, row.user_id)] = entry;
      if (!row.is_deleted) {
        cloudItemIds.notes.add(row.item_id);
        mergedNotes.push(rowToNote(row, profilesMap));
      }
    }

    // 3. Ideas
    const cloudIdeaRows = (ideaRes.data ?? []) as IdeaRow[];
    const cloudIdeaMap = new Map<string, Idea>();
    for (const row of cloudIdeaRows) {
      const entry = { version: row.version, updatedAt: row.updated_at };
      versions[versionKey('idea', row.item_id)] = entry;
      versions[versionKey('idea', row.item_id, row.user_id)] = entry;
      if (row.is_deleted) {
        deletedIds.ideas.add(row.item_id);
      } else {
        cloudItemIds.ideas.add(row.item_id);
        cloudIdeaMap.set(row.item_id, rowToIdea(row, profilesMap));
      }
    }

    const mergedIdeas: Idea[] = [];
    for (const row of cloudIdeaRows) {
      if (row.is_deleted) continue;
      if (!initialIdeas.some((b) => b.id === row.item_id)) {
        const mapped = cloudIdeaMap.get(row.item_id);
        if (mapped) {
          mergedIdeas.push(mapped);
        }
      }
    }
    for (const builtin of initialIdeas) {
      if (deletedIds.ideas.has(builtin.id)) continue;
      const override = cloudIdeaMap.get(builtin.id);
      mergedIdeas.push(override ?? builtin);
    }

    // 4. Library Prompts
    const cloudPromptRows = (promptRes.data ?? []) as LibraryPromptRow[];
    const cloudPromptMap = new Map<string, LibraryPrompt>();
    for (const row of cloudPromptRows) {
      const entry = { version: row.version, updatedAt: row.updated_at };
      versions[versionKey('library_prompt', row.item_id)] = entry;
      versions[versionKey('library_prompt', row.item_id, row.user_id)] = entry;
      if (row.is_deleted) {
        deletedIds.libraryPrompts.add(row.item_id);
      } else {
        cloudItemIds.libraryPrompts.add(row.item_id);
        cloudPromptMap.set(row.item_id, rowToLibraryPrompt(row, profilesMap));
      }
    }

    const mergedLibraryPrompts: LibraryPrompt[] = [];
    const seenPromptIds = new Set<string>();
    for (const builtin of defaultLibraryPrompts) {
      if (deletedIds.libraryPrompts.has(builtin.id)) continue;
      const override = cloudPromptMap.get(builtin.id);
      mergedLibraryPrompts.push(override ?? builtin);
      seenPromptIds.add(builtin.id);
    }
    for (const row of cloudPromptRows) {
      if (row.is_deleted || seenPromptIds.has(row.item_id)) continue;
      const mapped = cloudPromptMap.get(row.item_id);
      if (mapped) {
        mergedLibraryPrompts.push(mapped);
        seenPromptIds.add(row.item_id);
      }
    }

    return {
      ok: true,
      data: {
        characters: mergedCharacters,
        notes: mergedNotes,
        ideas: mergedIdeas,
        libraryPrompts: mergedLibraryPrompts,
        cloudItemIds,
        deletedIds,
        versions,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeDataError(
        err,
        'Không thể tải dữ liệu tài khoản từ Supabase. Vui lòng thử lại.',
      ),
    };
  }
}

// ----------------------------------------------------------------------------
// Fetch System & Public Community Content (cho cả Khách chưa đăng nhập & User)
// ----------------------------------------------------------------------------

export async function fetchPublicAndSystemSnapshot(): Promise<
  DataServiceResult<PublicCommunitySnapshot>
> {
  const empty: PublicCommunitySnapshot = {
    characters: [],
    notes: [],
    ideas: [],
    libraryPrompts: [],
    versions: {},
    schemaReady: false,
  };

  if (!supabase) {
    return { ok: true, data: empty };
  }

  try {
    const [charRes, noteRes, ideaRes, promptRes] = await Promise.all([
      supabase
        .from('user_characters')
        .select('*')
        .eq('is_deleted', false)
        .or('is_system.eq.true,is_public.eq.true')
        .order('is_system', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('user_notes')
        .select('*')
        .eq('is_deleted', false)
        .or('is_system.eq.true,is_public.eq.true')
        .order('is_system', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('user_ideas')
        .select('*')
        .eq('is_deleted', false)
        .or('is_system.eq.true,is_public.eq.true')
        .order('is_system', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('user_library_prompts')
        .select('*')
        .eq('is_deleted', false)
        .or('is_system.eq.true,is_public.eq.true')
        .order('is_system', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false }),
    ]);

    const firstError = charRes.error || noteRes.error || ideaRes.error || promptRes.error;
    if (firstError) {
      if (isMissingCommunitySchemaError(firstError) || firstError.code === '42501') {
        // Migration 003 chưa chạy — giữ nguyên hoạt động bình thường mà không báo lỗi phá UI
        return { ok: true, data: empty };
      }
      return {
        ok: false,
        error: normalizeDataError(firstError, 'Không thể tải dữ liệu cộng đồng từ Supabase.'),
      };
    }

    const charRows = (charRes.data ?? []) as CharacterRow[];
    const noteRows = (noteRes.data ?? []) as NoteRow[];
    const ideaRows = (ideaRes.data ?? []) as IdeaRow[];
    const promptRows = (promptRes.data ?? []) as LibraryPromptRow[];

    const authorIds = [
      ...charRows.map((r) => r.user_id),
      ...noteRows.map((r) => r.user_id),
      ...ideaRows.map((r) => r.user_id),
      ...promptRows.map((r) => r.user_id),
    ];
    const profilesMap = await fetchPublicProfilesMap(authorIds);

    const versions: SyncedVersionMap = {};
    for (const r of charRows) {
      versions[versionKey('character', r.item_id, r.user_id)] = {
        version: r.version,
        updatedAt: r.updated_at,
      };
    }
    for (const r of noteRows) {
      versions[versionKey('note', r.item_id, r.user_id)] = {
        version: r.version,
        updatedAt: r.updated_at,
      };
    }
    for (const r of ideaRows) {
      versions[versionKey('idea', r.item_id, r.user_id)] = {
        version: r.version,
        updatedAt: r.updated_at,
      };
    }
    for (const r of promptRows) {
      versions[versionKey('library_prompt', r.item_id, r.user_id)] = {
        version: r.version,
        updatedAt: r.updated_at,
      };
    }

    return {
      ok: true,
      data: {
        characters: charRows.map((r) => rowToCharacter(r, profilesMap)),
        notes: noteRows.map((r) => rowToNote(r, profilesMap)),
        ideas: ideaRows.map((r) => rowToIdea(r, profilesMap)),
        libraryPrompts: promptRows.map((r) => rowToLibraryPrompt(r, profilesMap)),
        versions,
        schemaReady: true,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeDataError(err, 'Không thể tải dữ liệu cộng đồng từ Supabase.'),
    };
  }
}

// ----------------------------------------------------------------------------
// OCC Single-Item Save, Public Toggle & Delete Operations
// ----------------------------------------------------------------------------

async function fetchLatestSingleRow<RowT>(
  table: string,
  ownerId: string,
  itemId: string,
): Promise<RowT | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', ownerId)
    .eq('item_id', itemId)
    .maybeSingle();
  return (data as RowT | null) ?? null;
}

const TABLE_BY_KIND: Record<DataEntityKind, string> = {
  character: 'user_characters',
  note: 'user_notes',
  idea: 'user_ideas',
  library_prompt: 'user_library_prompts',
};

/**
 * Bật / Tắt trạng thái Công khai (is_public) cho một mục cá nhân bằng cập nhật hẹp
 * kèm kiểm tra version (OCC) để bảo đảm không mất nội dung và không ghi đè chỉnh sửa từ thiết bị khác.
 */
export async function toggleItemPublicStatus(
  kind: DataEntityKind,
  ownerId: string,
  itemId: string,
  nextIsPublic: boolean,
  expectedVersion: number,
): Promise<DataServiceResult<{ isPublic: boolean; publishedAt?: string }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const table = TABLE_BY_KIND[kind];

  try {
    const { data, error } = await supabase
      .from(table)
      .update({ is_public: nextIsPublic })
      .eq('user_id', ownerId)
      .eq('item_id', itemId)
      .eq('version', expectedVersion)
      .eq('is_deleted', false)
      .eq('is_system', false)
      .select('is_public, published_at, version, updated_at')
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        error: normalizeDataError(
          error,
          'Không thể cập nhật trạng thái Công khai/Riêng tư cho mục này.',
        ),
      };
    }

    if (!data) {
      const latest = await fetchLatestSingleRow<
        CharacterRow | NoteRow | IdeaRow | LibraryPromptRow
      >(table, ownerId, itemId);

      const mappedServer =
        latest && !latest.is_deleted
          ? kind === 'character'
            ? rowToCharacter(latest as CharacterRow)
            : kind === 'note'
              ? rowToNote(latest as NoteRow)
              : kind === 'idea'
                ? rowToIdea(latest as IdeaRow)
                : rowToLibraryPrompt(latest as LibraryPromptRow)
          : null;

      return {
        ok: false,
        conflict: {
          kind,
          itemId,
          ownerId,
          localItem: mappedServer as any,
          serverItem: mappedServer as any,
          serverDeleted: !latest || latest.is_deleted,
          serverVersion: latest?.version ?? 0,
          serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
        },
        error: {
          code: 'VERSION_CONFLICT',
          message:
            'Mục này vừa được chỉnh sửa trên trình duyệt/thiết bị khác. Dữ liệu đã được làm mới để tránh mất thay đổi.',
        },
      };
    }

    const row = data as {
      is_public: boolean;
      published_at: string | null;
      version: number;
      updated_at: string;
    };

    return {
      ok: true,
      data: {
        isPublic: Boolean(row.is_public),
        publishedAt: row.published_at ?? undefined,
      },
      version: row.version,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeDataError(err, 'Không thể thay đổi trạng thái Công khai lúc này.'),
    };
  }
}

export async function saveCharacterToCloud(
  ownerId: string,
  character: Character,
  options: SaveOptions = {},
): Promise<DataServiceResult<Character>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const wantsVisibility = Boolean(
    options.isPublic || options.isSystem || character.isPublic || character.isSystem,
  );
  const runWrite = async (omitVisibility: boolean) => {
    const payload = characterToRowPayload(ownerId, character, false, {
      isPublic: options.isPublic,
      isSystem: options.isSystem,
      omitVisibility,
    });

    if (options.forceOverwrite) {
      return supabase!
        .from('user_characters')
        .upsert(payload, { onConflict: 'user_id,item_id' })
        .select('*')
        .single();
    }

    if (typeof options.expectedVersion === 'number') {
      return supabase!
        .from('user_characters')
        .update(payload)
        .eq('user_id', ownerId)
        .eq('item_id', character.id)
        .eq('version', options.expectedVersion)
        .eq('is_deleted', false)
        .select('*')
        .maybeSingle();
    }

    return supabase!.from('user_characters').insert(payload).select('*').single();
  };

  try {
    let { data, error } = await runWrite(false);

    // Nếu chưa chạy migration 003 và người dùng chỉ lưu riêng tư -> tự lùi an toàn không gửi cột mới
    if (error && isMissingVisibilityColumnError(error) && !wantsVisibility) {
      const retry = await runWrite(true);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === '23505' && typeof options.expectedVersion !== 'number' && !options.forceOverwrite) {
        const latest = await fetchLatestSingleRow<CharacterRow>('user_characters', ownerId, character.id);
        return {
          ok: false,
          conflict: {
            kind: 'character',
            itemId: character.id,
            ownerId,
            localItem: character,
            serverItem: latest && !latest.is_deleted ? rowToCharacter(latest) : null,
            serverDeleted: !latest || latest.is_deleted,
            serverVersion: latest?.version ?? 0,
            serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
          },
        };
      }
      return { ok: false, error: normalizeDataError(error, 'Không thể lưu nhân vật lên máy chủ.') };
    }

    if (!data && typeof options.expectedVersion === 'number') {
      const latest = await fetchLatestSingleRow<CharacterRow>('user_characters', ownerId, character.id);
      return {
        ok: false,
        conflict: {
          kind: 'character',
          itemId: character.id,
          ownerId,
          localItem: character,
          serverItem: latest && !latest.is_deleted ? rowToCharacter(latest) : null,
          serverDeleted: !latest || latest.is_deleted,
          serverVersion: latest?.version ?? 0,
          serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
        },
      };
    }

    const row = data as CharacterRow;
    const profilesMap = await fetchPublicProfilesMap([row.user_id]);
    return {
      ok: true,
      data: rowToCharacter(row, profilesMap),
      version: row.version,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    return { ok: false, error: normalizeDataError(err, 'Không thể lưu nhân vật lên máy chủ.') };
  }
}

export async function deleteCharacterFromCloud(
  ownerId: string,
  characterId: string,
  isBuiltin: boolean,
  actingUserId?: string,
): Promise<DataServiceResult<{ id: string }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  try {
    if (isBuiltin) {
      const { error } = await supabase.from('user_characters').upsert(
        {
          user_id: ownerId,
          item_id: characterId,
          name: '[Đã ẩn]',
          role: '',
          avatar: '🍀',
          is_deleted: true,
        },
        { onConflict: 'user_id,item_id' },
      );
      if (error) {
        return { ok: false, error: normalizeDataError(error, 'Không thể ẩn nhân vật mặc định.') };
      }
    } else {
      const { error } = await supabase
        .from('user_characters')
        .delete()
        .eq('user_id', ownerId)
        .eq('item_id', characterId);
      if (error) {
        return { ok: false, error: normalizeDataError(error, 'Không thể xóa nhân vật trên máy chủ.') };
      }
    }

    // Chỉ gỡ liên kết trong user_notes của chính người thao tác (tránh vi phạm RLS nếu Admin xóa char hệ thống của Admin khác)
    const unlinkTargetUserId = actingUserId || ownerId;
    const { error: unlinkErr } = await supabase
      .from('user_notes')
      .update({ character_id: '' })
      .eq('user_id', unlinkTargetUserId)
      .eq('character_id', characterId);

    if (unlinkErr) {
      return {
        ok: false,
        error: normalizeDataError(
          unlinkErr,
          'Đã xóa nhân vật nhưng chưa thể gỡ liên kết ở các ghi chú. Vui lòng đồng bộ lại.',
        ),
      };
    }

    return { ok: true, data: { id: characterId } };
  } catch (err) {
    return { ok: false, error: normalizeDataError(err, 'Không thể xóa nhân vật trên máy chủ.') };
  }
}

export async function saveNoteToCloud(
  ownerId: string,
  note: Note,
  options: SaveOptions = {},
): Promise<DataServiceResult<Note>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const wantsVisibility = Boolean(
    options.isPublic || options.isSystem || note.isPublic || note.isSystem,
  );
  const runWrite = async (omitVisibility: boolean) => {
    const payload = noteToRowPayload(ownerId, note, false, {
      isPublic: options.isPublic,
      isSystem: options.isSystem,
      omitVisibility,
    });

    if (options.forceOverwrite) {
      return supabase!
        .from('user_notes')
        .upsert(payload, { onConflict: 'user_id,item_id' })
        .select('*')
        .single();
    }

    if (typeof options.expectedVersion === 'number') {
      return supabase!
        .from('user_notes')
        .update(payload)
        .eq('user_id', ownerId)
        .eq('item_id', note.id)
        .eq('version', options.expectedVersion)
        .eq('is_deleted', false)
        .select('*')
        .maybeSingle();
    }

    return supabase!.from('user_notes').insert(payload).select('*').single();
  };

  try {
    let { data, error } = await runWrite(false);
    if (error && isMissingVisibilityColumnError(error) && !wantsVisibility) {
      const retry = await runWrite(true);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === '23505' && typeof options.expectedVersion !== 'number' && !options.forceOverwrite) {
        const latest = await fetchLatestSingleRow<NoteRow>('user_notes', ownerId, note.id);
        return {
          ok: false,
          conflict: {
            kind: 'note',
            itemId: note.id,
            ownerId,
            localItem: note,
            serverItem: latest && !latest.is_deleted ? rowToNote(latest) : null,
            serverDeleted: !latest || latest.is_deleted,
            serverVersion: latest?.version ?? 0,
            serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
          },
        };
      }
      return { ok: false, error: normalizeDataError(error, 'Không thể lưu ghi chú lên máy chủ.') };
    }

    if (!data && typeof options.expectedVersion === 'number') {
      const latest = await fetchLatestSingleRow<NoteRow>('user_notes', ownerId, note.id);
      return {
        ok: false,
        conflict: {
          kind: 'note',
          itemId: note.id,
          ownerId,
          localItem: note,
          serverItem: latest && !latest.is_deleted ? rowToNote(latest) : null,
          serverDeleted: !latest || latest.is_deleted,
          serverVersion: latest?.version ?? 0,
          serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
        },
      };
    }

    const row = data as NoteRow;
    const profilesMap = await fetchPublicProfilesMap([row.user_id]);
    return {
      ok: true,
      data: rowToNote(row, profilesMap),
      version: row.version,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    return { ok: false, error: normalizeDataError(err, 'Không thể lưu ghi chú lên máy chủ.') };
  }
}

export async function deleteNoteFromCloud(
  ownerId: string,
  noteId: string,
): Promise<DataServiceResult<{ id: string }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  try {
    const { error } = await supabase
      .from('user_notes')
      .delete()
      .eq('user_id', ownerId)
      .eq('item_id', noteId);

    if (error) {
      return { ok: false, error: normalizeDataError(error, 'Không thể xóa ghi chú trên máy chủ.') };
    }

    return { ok: true, data: { id: noteId } };
  } catch (err) {
    return { ok: false, error: normalizeDataError(err, 'Không thể xóa ghi chú trên máy chủ.') };
  }
}

export async function saveIdeaToCloud(
  ownerId: string,
  idea: Idea,
  options: SaveOptions = {},
): Promise<DataServiceResult<Idea>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const wantsVisibility = Boolean(
    options.isPublic || options.isSystem || idea.isPublic || idea.isSystem,
  );
  const runWrite = async (omitVisibility: boolean) => {
    const payload = ideaToRowPayload(ownerId, idea, false, {
      isPublic: options.isPublic,
      isSystem: options.isSystem,
      omitVisibility,
    });

    if (options.forceOverwrite) {
      return supabase!
        .from('user_ideas')
        .upsert(payload, { onConflict: 'user_id,item_id' })
        .select('*')
        .single();
    }

    if (typeof options.expectedVersion === 'number') {
      return supabase!
        .from('user_ideas')
        .update(payload)
        .eq('user_id', ownerId)
        .eq('item_id', idea.id)
        .eq('version', options.expectedVersion)
        .eq('is_deleted', false)
        .select('*')
        .maybeSingle();
    }

    return supabase!.from('user_ideas').insert(payload).select('*').single();
  };

  try {
    let { data, error } = await runWrite(false);
    if (error && isMissingVisibilityColumnError(error) && !wantsVisibility) {
      const retry = await runWrite(true);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === '23505' && typeof options.expectedVersion !== 'number' && !options.forceOverwrite) {
        const latest = await fetchLatestSingleRow<IdeaRow>('user_ideas', ownerId, idea.id);
        return {
          ok: false,
          conflict: {
            kind: 'idea',
            itemId: idea.id,
            ownerId,
            localItem: idea,
            serverItem: latest && !latest.is_deleted ? rowToIdea(latest) : null,
            serverDeleted: !latest || latest.is_deleted,
            serverVersion: latest?.version ?? 0,
            serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
          },
        };
      }
      return { ok: false, error: normalizeDataError(error, 'Không thể lưu ý tưởng lên máy chủ.') };
    }

    if (!data && typeof options.expectedVersion === 'number') {
      const latest = await fetchLatestSingleRow<IdeaRow>('user_ideas', ownerId, idea.id);
      return {
        ok: false,
        conflict: {
          kind: 'idea',
          itemId: idea.id,
          ownerId,
          localItem: idea,
          serverItem: latest && !latest.is_deleted ? rowToIdea(latest) : null,
          serverDeleted: !latest || latest.is_deleted,
          serverVersion: latest?.version ?? 0,
          serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
        },
      };
    }

    const row = data as IdeaRow;
    const profilesMap = await fetchPublicProfilesMap([row.user_id]);
    return {
      ok: true,
      data: rowToIdea(row, profilesMap),
      version: row.version,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    return { ok: false, error: normalizeDataError(err, 'Không thể lưu ý tưởng lên máy chủ.') };
  }
}

export async function deleteIdeaFromCloud(
  ownerId: string,
  ideaId: string,
  isBuiltin: boolean,
): Promise<DataServiceResult<{ id: string }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  try {
    if (isBuiltin) {
      const { error } = await supabase.from('user_ideas').upsert(
        {
          user_id: ownerId,
          item_id: ideaId,
          title: '[Đã ẩn]',
          content: '',
          is_deleted: true,
        },
        { onConflict: 'user_id,item_id' },
      );
      if (error) {
        return { ok: false, error: normalizeDataError(error, 'Không thể ẩn ý tưởng mặc định.') };
      }
    } else {
      const { error } = await supabase
        .from('user_ideas')
        .delete()
        .eq('user_id', ownerId)
        .eq('item_id', ideaId);
      if (error) {
        return { ok: false, error: normalizeDataError(error, 'Không thể xóa ý tưởng trên máy chủ.') };
      }
    }

    return { ok: true, data: { id: ideaId } };
  } catch (err) {
    return { ok: false, error: normalizeDataError(err, 'Không thể xóa ý tưởng trên máy chủ.') };
  }
}

export async function saveLibraryPromptToCloud(
  ownerId: string,
  prompt: LibraryPrompt,
  options: SaveOptions = {},
): Promise<DataServiceResult<LibraryPrompt>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const wantsVisibility = Boolean(
    options.isPublic || options.isSystem || prompt.isPublic || prompt.isSystem,
  );
  const runWrite = async (omitVisibility: boolean) => {
    const payload = libraryPromptToRowPayload(ownerId, prompt, false, {
      isPublic: options.isPublic,
      isSystem: options.isSystem,
      omitVisibility,
    });

    if (options.forceOverwrite) {
      return supabase!
        .from('user_library_prompts')
        .upsert(payload, { onConflict: 'user_id,item_id' })
        .select('*')
        .single();
    }

    if (typeof options.expectedVersion === 'number') {
      return supabase!
        .from('user_library_prompts')
        .update(payload)
        .eq('user_id', ownerId)
        .eq('item_id', prompt.id)
        .eq('version', options.expectedVersion)
        .eq('is_deleted', false)
        .select('*')
        .maybeSingle();
    }

    return supabase!.from('user_library_prompts').insert(payload).select('*').single();
  };

  try {
    let { data, error } = await runWrite(false);
    if (error && isMissingVisibilityColumnError(error) && !wantsVisibility) {
      const retry = await runWrite(true);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === '23505' && typeof options.expectedVersion !== 'number' && !options.forceOverwrite) {
        const latest = await fetchLatestSingleRow<LibraryPromptRow>(
          'user_library_prompts',
          ownerId,
          prompt.id,
        );
        return {
          ok: false,
          conflict: {
            kind: 'library_prompt',
            itemId: prompt.id,
            ownerId,
            localItem: prompt,
            serverItem: latest && !latest.is_deleted ? rowToLibraryPrompt(latest) : null,
            serverDeleted: !latest || latest.is_deleted,
            serverVersion: latest?.version ?? 0,
            serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
          },
        };
      }
      return {
        ok: false,
        error: normalizeDataError(error, 'Không thể lưu câu lệnh thư viện lên máy chủ.'),
      };
    }

    if (!data && typeof options.expectedVersion === 'number') {
      const latest = await fetchLatestSingleRow<LibraryPromptRow>(
        'user_library_prompts',
        ownerId,
        prompt.id,
      );
      return {
        ok: false,
        conflict: {
          kind: 'library_prompt',
          itemId: prompt.id,
          ownerId,
          localItem: prompt,
          serverItem: latest && !latest.is_deleted ? rowToLibraryPrompt(latest) : null,
          serverDeleted: !latest || latest.is_deleted,
          serverVersion: latest?.version ?? 0,
          serverUpdatedAt: latest?.updated_at ?? new Date().toISOString(),
        },
      };
    }

    const row = data as LibraryPromptRow;
    const profilesMap = await fetchPublicProfilesMap([row.user_id]);
    return {
      ok: true,
      data: rowToLibraryPrompt(row, profilesMap),
      version: row.version,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeDataError(err, 'Không thể lưu câu lệnh thư viện lên máy chủ.'),
    };
  }
}

export async function deleteLibraryPromptFromCloud(
  ownerId: string,
  promptId: string,
  isBuiltin: boolean,
): Promise<DataServiceResult<{ id: string }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  try {
    if (isBuiltin) {
      const { error } = await supabase.from('user_library_prompts').upsert(
        {
          user_id: ownerId,
          item_id: promptId,
          title: '[Đã ẩn]',
          description: '',
          how_to_use: '',
          author: '',
          tags: [],
          steps: [],
          is_deleted: true,
        },
        { onConflict: 'user_id,item_id' },
      );
      if (error) {
        return { ok: false, error: normalizeDataError(error, 'Không thể ẩn câu lệnh mặc định.') };
      }
    } else {
      const { error } = await supabase
        .from('user_library_prompts')
        .delete()
        .eq('user_id', ownerId)
        .eq('item_id', promptId);
      if (error) {
        return {
          ok: false,
          error: normalizeDataError(error, 'Không thể xóa câu lệnh thư viện trên máy chủ.'),
        };
      }
    }
    return { ok: true, data: { id: promptId } };
  } catch (err) {
    return {
      ok: false,
      error: normalizeDataError(err, 'Không thể xóa câu lệnh thư viện trên máy chủ.'),
    };
  }
}

// ----------------------------------------------------------------------------
// Idempotent Chunk Upsert & Resumable Import Job Persistence (sessionStorage)
// Bảo đảm dữ liệu nhập từ localStorage luôn ở trạng thái riêng tư (omitVisibility: true)
// ----------------------------------------------------------------------------

export async function upsertImportChunk(
  userId: string,
  chunk: ImportChunk,
): Promise<DataServiceResult<{ count: number }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  try {
    if (chunk.kind === 'character') {
      const rows = (chunk.items as Character[]).map((c) =>
        characterToRowPayload(userId, c, false, { omitVisibility: true }),
      );
      const { error } = await supabase
        .from('user_characters')
        .upsert(rows, { onConflict: 'user_id,item_id' });
      if (error) {
        return { ok: false, error: normalizeDataError(error, 'Lỗi khi tải lên nhóm nhân vật.') };
      }
      return { ok: true, data: { count: rows.length } };
    }

    if (chunk.kind === 'note') {
      const rows = (chunk.items as Note[]).map((n) =>
        noteToRowPayload(userId, n, false, { omitVisibility: true }),
      );
      const { error } = await supabase
        .from('user_notes')
        .upsert(rows, { onConflict: 'user_id,item_id' });
      if (error) {
        return { ok: false, error: normalizeDataError(error, 'Lỗi khi tải lên nhóm ghi chú.') };
      }
      return { ok: true, data: { count: rows.length } };
    }

    if (chunk.kind === 'idea') {
      const rows = (chunk.items as Idea[]).map((i) =>
        ideaToRowPayload(userId, i, false, { omitVisibility: true }),
      );
      const { error } = await supabase
        .from('user_ideas')
        .upsert(rows, { onConflict: 'user_id,item_id' });
      if (error) {
        return { ok: false, error: normalizeDataError(error, 'Lỗi khi tải lên nhóm ý tưởng.') };
      }
      return { ok: true, data: { count: rows.length } };
    }

    const rows = (chunk.items as LibraryPrompt[]).map((p) =>
      libraryPromptToRowPayload(userId, p, false, { omitVisibility: true }),
    );
    const { error } = await supabase
      .from('user_library_prompts')
      .upsert(rows, { onConflict: 'user_id,item_id' });
    if (error) {
      return { ok: false, error: normalizeDataError(error, 'Lỗi khi tải lên nhóm thư viện prompt.') };
    }
    return { ok: true, data: { count: rows.length } };
  } catch (err) {
    return { ok: false, error: normalizeDataError(err, 'Lỗi mạng khi đang đồng bộ dữ liệu.') };
  }
}

const IMPORT_JOB_PREFIX = 'seaclover_import_job_';
const MIGRATION_DISMISSED_PREFIX = 'seaclover_migration_dismissed_';

export function saveResumableImportJob(userId: string, plan: ImportJobPlan): void {
  try {
    sessionStorage.setItem(`${IMPORT_JOB_PREFIX}${userId}`, JSON.stringify(plan));
  } catch {
    // Ignore storage quota issues for transient session job cache
  }
}

export function loadResumableImportJob(userId: string): ImportJobPlan | null {
  try {
    const raw = sessionStorage.getItem(`${IMPORT_JOB_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportJobPlan;
    if (!parsed || !Array.isArray(parsed.chunks) || !Array.isArray(parsed.confirmedChunkIds)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearResumableImportJob(userId: string): void {
  try {
    sessionStorage.removeItem(`${IMPORT_JOB_PREFIX}${userId}`);
  } catch {
    // Ignore
  }
}

export function isMigrationPromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${MIGRATION_DISMISSED_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

export function setMigrationPromptDismissed(userId: string, dismissed: boolean): void {
  try {
    if (dismissed) {
      localStorage.setItem(`${MIGRATION_DISMISSED_PREFIX}${userId}`, '1');
    } else {
      localStorage.removeItem(`${MIGRATION_DISMISSED_PREFIX}${userId}`);
    }
  } catch {
    // Ignore
  }
}
