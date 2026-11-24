import { supabase } from '../lib/supabase';
import type { SharedTag } from '../types';
import { dedupeTags, normalizeTagDisplay, toTagSlug } from '../utils/tagSystem';

export interface TagAdminResult<T = void> {
  ok: boolean;
  data?: T;
  schemaMissing?: boolean;
  error?: string;
}

interface SharedTagRow {
  slug: string;
  label: string;
  aliases: string[] | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
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

export async function adminUpsertSharedTag(params: {
  label: string;
  aliases?: string[];
  description?: string;
  slug?: string;
}): Promise<TagAdminResult<SharedTag>> {
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
    if (isMissingTagSchemaError(error)) {
      return {
        ok: false,
        schemaMissing: true,
        error: 'Cơ sở dữ liệu chưa chạy migration 006_shared_tags.sql.',
      };
    }
    return { ok: false, error: error.message || 'Không thể lưu tag chung.' };
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
    if (isMissingTagSchemaError(error)) {
      return {
        ok: false,
        schemaMissing: true,
        error: 'Cần chạy migration 006_shared_tags.sql trên Supabase để đổi tên tag chung.',
      };
    }
    return { ok: false, error: error.message || 'Không thể đổi tên tag chung.' };
  }

  return { ok: true, data: Number(data || 0) };
}

export async function adminMergeSharedTags(
  sourceLabels: string[],
  targetLabel: string,
): Promise<TagAdminResult<number>> {
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
    if (isMissingTagSchemaError(error)) {
      return {
        ok: false,
        schemaMissing: true,
        error: 'Cần chạy migration 006_shared_tags.sql trên Supabase để gộp tag chung.',
      };
    }
    return { ok: false, error: error.message || 'Không thể gộp tag chung.' };
  }

  return { ok: true, data: Number(data || 0) };
}

export async function adminDeleteSharedTag(label: string): Promise<TagAdminResult<number>> {
  const clean = normalizeTagDisplay(label);
  if (!clean) {
    return { ok: false, error: 'Tên tag cần xóa không hợp lệ.' };
  }

  const { data, error } = await supabase.rpc('admin_delete_shared_tag', {
    p_label: clean,
  });

  if (error) {
    if (isMissingTagSchemaError(error)) {
      return {
        ok: false,
        schemaMissing: true,
        error: 'Cần chạy migration 006_shared_tags.sql trên Supabase để xóa tag chung.',
      };
    }
    return { ok: false, error: error.message || 'Không thể xóa tag chung.' };
  }

  return { ok: true, data: Number(data || 0) };
}
