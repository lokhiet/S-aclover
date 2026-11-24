import { supabase } from '../lib/supabase';
import type { SharedTag } from '../types';
import { dedupeTags, normalizeTagDisplay, toTagSlug } from '../utils/tagSystem';

export interface TagAdminResult<T = void> {
  ok: boolean;
  data?: T;
  schemaMissing?: boolean;
  error?: string;
}

export interface BuiltinTagOverridesMap {
  libraryPromptTags: Record<string, string[]>;
  ideaTags: Record<string, string[]>;
  characterTags: Record<string, string[]>;
  schemaReady: boolean;
}

export const EMPTY_BUILTIN_TAG_OVERRIDES: BuiltinTagOverridesMap = {
  libraryPromptTags: {},
  ideaTags: {},
  characterTags: {},
  schemaReady: false,
};

interface SharedTagRow {
  slug: string;
  label: string;
  aliases: string[] | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

interface BuiltinTagOverrideRow {
  target_type: 'library_prompt' | 'idea' | 'character';
  item_id: string;
  tags: string[] | null;
}

function isMissingTagSchemaError(err: unknown): boolean {
  const obj = err as { code?: string; message?: string } | null;
  const code = String(obj?.code || '');
  const lower = String(obj?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === '42883' ||
    code === 'PGRST202' ||
    lower.includes('shared_tags') ||
    lower.includes('builtin_tag_overrides') ||
    lower.includes('admin_rename_shared_tag') ||
    lower.includes('admin_upsert_shared_tag')
  );
}

function rowToSharedTag(row: SharedTagRow): SharedTag {
  return {
    slug: row.slug,
    label: normalizeTagDisplay(row.label),
    aliases: dedupeTags(Array.isArray(row.aliases) ? row.aliases : []),
    description: (row.description || '').trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchSharedTags(): Promise<TagAdminResult<SharedTag[]>> {
  try {
    const { data, error } = await supabase
      .from('shared_tags')
      .select('slug, label, aliases, description, created_at, updated_at')
      .order('label', { ascending: true });

    if (error) {
      if (isMissingTagSchemaError(error)) {
        return { ok: true, data: [], schemaMissing: true };
      }
      return { ok: false, error: error.message || 'Không thể tải danh mục tag chung.' };
    }

    const tags = ((data || []) as SharedTagRow[]).map(rowToSharedTag);
    return { ok: true, data: tags };
  } catch (err) {
    if (isMissingTagSchemaError(err)) {
      return { ok: true, data: [], schemaMissing: true };
    }
    return { ok: false, error: 'Lỗi mạng khi tải danh mục tag chung.' };
  }
}

export async function fetchBuiltinTagOverrides(): Promise<
  TagAdminResult<BuiltinTagOverridesMap>
> {
  try {
    const { data, error } = await supabase
      .from('builtin_tag_overrides')
      .select('target_type, item_id, tags')
      .range(0, 1999);

    if (error) {
      if (isMissingTagSchemaError(error)) {
        return {
          ok: true,
          data: { ...EMPTY_BUILTIN_TAG_OVERRIDES },
          schemaMissing: true,
        };
      }
      return {
        ok: false,
        error: error.message || 'Không thể tải cấu hình tag nội dung mặc định.',
      };
    }

    const result: BuiltinTagOverridesMap = {
      libraryPromptTags: {},
      ideaTags: {},
      characterTags: {},
      schemaReady: true,
    };

    for (const row of (data || []) as BuiltinTagOverrideRow[]) {
      const cleanTags = dedupeTags(Array.isArray(row.tags) ? row.tags : []);
      if (row.target_type === 'library_prompt') {
        result.libraryPromptTags[row.item_id] = cleanTags;
      } else if (row.target_type === 'idea') {
        result.ideaTags[row.item_id] = cleanTags;
      } else if (row.target_type === 'character') {
        result.characterTags[row.item_id] = cleanTags;
      }
    }

    return { ok: true, data: result };
  } catch (err) {
    if (isMissingTagSchemaError(err)) {
      return {
        ok: true,
        data: { ...EMPTY_BUILTIN_TAG_OVERRIDES },
        schemaMissing: true,
      };
    }
    return { ok: false, error: 'Lỗi mạng khi tải cấu hình tag nội dung mặc định.' };
  }
}

function formatTagRpcError(
  error: { code?: string; message?: string },
  missingMsg: string,
  fallbackMsg: string,
): TagAdminResult<never> {
  const msg = String(error.message || '');
  const lower = msg.toLowerCase();
  if (lower.includes('builtin_tag_overrides')) {
    return {
      ok: false,
      schemaMissing: true,
      error:
        'Cơ sở dữ liệu chưa chạy migration 008_builtin_tag_overrides.sql trên Supabase để đồng bộ tag của nội dung hệ thống mặc định.',
    };
  }
  if (isMissingTagSchemaError(error)) {
    return { ok: false, schemaMissing: true, error: missingMsg };
  }
  if (lower.includes('coalesce types text[] and jsonb')) {
    return {
      ok: false,
      error:
        'Cơ sở dữ liệu cần chạy thêm migration 007_fix_tag_management.sql (và 008_builtin_tag_overrides.sql) trên Supabase.',
    };
  }
  return { ok: false, error: msg || fallbackMsg };
}

async function ensureAuthenticatedForTagAdmin(): Promise<string | null> {
  if (!supabase) return 'Supabase chưa được cấu hình.';
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user?.id) {
      return 'Chỉ tài khoản quản trị viên (Admin) đã đăng nhập mới có quyền quản lý tag chung.';
    }
    return null;
  } catch {
    return 'Chỉ tài khoản quản trị viên (Admin) đã đăng nhập mới có quyền quản lý tag chung.';
  }
}

export async function adminUpsertSharedTag(params: {
  label: string;
  aliases?: string[];
  description?: string;
  slug?: string;
}): Promise<TagAdminResult<SharedTag>> {
  const authErr = await ensureAuthenticatedForTagAdmin();
  if (authErr) {
    return { ok: false, error: authErr };
  }
  const label = normalizeTagDisplay(params.label);
  if (!label) {
    return { ok: false, error: 'Vui lòng nhập tên tag hợp lệ.' };
  }
  const slug = params.slug ? toTagSlug(params.slug) : toTagSlug(label);
  const aliases = dedupeTags(params.aliases || []).filter(
    (a) => a.toLowerCase() !== label.toLowerCase(),
  );

  const { data, error } = await supabase.rpc('admin_upsert_shared_tag', {
    p_slug: slug,
    p_label: label,
    p_aliases: aliases,
    p_description: (params.description || '').trim(),
  });

  if (error) {
    return formatTagRpcError(
      error,
      'Cơ sở dữ liệu chưa chạy migration 006_shared_tags.sql.',
      'Không thể lưu tag chung.',
    );
  }

  return {
    ok: true,
    data: data ? rowToSharedTag(data as SharedTagRow) : { slug, label, aliases, description: params.description || '' },
  };
}

export async function adminRenameSharedTag(
  oldLabel: string,
  newLabel: string,
): Promise<TagAdminResult<number>> {
  const authErr = await ensureAuthenticatedForTagAdmin();
  if (authErr) {
    return { ok: false, error: authErr };
  }
  const oldClean = normalizeTagDisplay(oldLabel);
  const newClean = normalizeTagDisplay(newLabel);
  if (!oldClean || !newClean) {
    return { ok: false, error: 'Tên tag cũ và tên tag mới không được để trống.' };
  }

  const { data, error } = await supabase.rpc('admin_rename_shared_tag', {
    p_old_label: oldClean,
    p_new_label: newClean,
    p_new_slug: toTagSlug(newClean),
  });

  if (error) {
    return formatTagRpcError(
      error,
      'Cần chạy migration 007_fix_tag_management.sql và 008_builtin_tag_overrides.sql trên Supabase để đổi tên tag chung.',
      'Không thể đổi tên tag chung.',
    );
  }

  return { ok: true, data: Number(data || 0) };
}

export async function adminMergeSharedTags(
  sourceLabels: string[],
  targetLabel: string,
): Promise<TagAdminResult<number>> {
  const authErr = await ensureAuthenticatedForTagAdmin();
  if (authErr) {
    return { ok: false, error: authErr };
  }
  const cleanSources = dedupeTags(sourceLabels);
  const cleanTarget = normalizeTagDisplay(targetLabel);
  if (cleanSources.length === 0 || !cleanTarget) {
    return { ok: false, error: 'Hãy chọn ít nhất 1 tag nguồn và 1 tag đích.' };
  }

  const { data, error } = await supabase.rpc('admin_merge_shared_tags', {
    p_source_labels: cleanSources,
    p_target_label: cleanTarget,
    p_target_slug: toTagSlug(cleanTarget),
  });

  if (error) {
    return formatTagRpcError(
      error,
      'Cần chạy migration 007_fix_tag_management.sql và 008_builtin_tag_overrides.sql trên Supabase để gộp tag chung.',
      'Không thể gộp tag chung.',
    );
  }

  return { ok: true, data: Number(data || 0) };
}

export async function adminDeleteSharedTag(label: string): Promise<TagAdminResult<number>> {
  const authErr = await ensureAuthenticatedForTagAdmin();
  if (authErr) {
    return { ok: false, error: authErr };
  }
  const clean = normalizeTagDisplay(label);
  if (!clean) {
    return { ok: false, error: 'Tên tag cần xóa không hợp lệ.' };
  }

  const { data, error } = await supabase.rpc('admin_delete_shared_tag', {
    p_label: clean,
  });

  if (error) {
    return formatTagRpcError(
      error,
      'Cần chạy migration 007_fix_tag_management.sql và 008_builtin_tag_overrides.sql trên Supabase để xóa tag chung.',
      'Không thể xóa tag chung.',
    );
  }

  return { ok: true, data: Number(data || 0) };
}
