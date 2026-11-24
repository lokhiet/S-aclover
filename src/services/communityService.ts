import { supabase } from '../lib/supabase';
import type {
  AnnouncementTone,
  CharacterComment,
  ContentTargetType,
  LikeSummary,
  PromptRating,
  PromptRatingSummary,
  PublicProfile,
  SystemAnnouncement,
} from '../types';

export interface CommunityServiceError {
  code: string;
  message: string;
  isMissingSchema?: boolean;
  isAuthError?: boolean;
  isNetworkError?: boolean;
}

export interface CommunityResult<T> {
  ok: boolean;
  data?: T;
  schemaReady?: boolean;
  error?: CommunityServiceError;
}

export function buildTargetScope(ownerId?: string | null): string {
  return ownerId && ownerId.trim() ? ownerId.trim() : 'builtin';
}

export function isMissingCommunitySchemaError(error: unknown): boolean {
  const errObj = error as { code?: string; message?: string } | null;
  const code = String(errObj?.code || '');
  const msg = String(errObj?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the') ||
    msg.includes('does not exist')
  );
}

export function normalizeCommunityError(
  error: unknown,
  fallbackMessage: string,
): CommunityServiceError {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      code: 'OFFLINE',
      message: 'Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng rồi thử lại.',
      isNetworkError: true,
    };
  }

  const errObj = error as { code?: string; message?: string; status?: number } | null;
  const code = String(errObj?.code || '');
  const rawMessage = String(errObj?.message || '');
  const lower = rawMessage.toLowerCase();

  if (isMissingCommunitySchemaError(error)) {
    return {
      code: code || 'SCHEMA_MISSING',
      message:
        'Chức năng Cộng đồng & Admin cần chạy tệp SQL migration 003 trên Supabase trước khi sử dụng.',
      isMissingSchema: true,
    };
  }

  if (
    errObj?.status === 401 ||
    code === 'PGRST301' ||
    lower.includes('jwt') ||
    lower.includes('session')
  ) {
    return {
      code: code || 'AUTH_EXPIRED',
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
      isAuthError: true,
    };
  }

  if (code === '42501' || errObj?.status === 403 || lower.includes('row-level security')) {
    return {
      code: code || 'FORBIDDEN',
      message:
        rawMessage && /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(rawMessage)
          ? rawMessage
          : 'Bạn không có quyền thực hiện thao tác này hoặc nội dung không ở trạng thái công khai.',
      isAuthError: true,
    };
  }

  if (code === '23514' || lower.includes('check constraint')) {
    return {
      code,
      message: 'Nội dung gửi lên không hợp lệ hoặc vượt quá giới hạn ký tự cho phép.',
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('timeout')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Mất kết nối tới máy chủ Supabase. Vui lòng kiểm tra mạng và thử lại.',
      isNetworkError: true,
    };
  }

  return {
    code: code || 'UNKNOWN_ERROR',
    message: fallbackMessage,
  };
}

// ----------------------------------------------------------------------------
// Public Profiles Lookup (không bao giờ đọc email)
// ----------------------------------------------------------------------------

export async function fetchPublicProfilesMap(
  userIds: string[],
): Promise<Record<string, PublicProfile>> {
  if (!supabase) return {};
  const uniqueIds = Array.from(new Set(userIds.filter((id) => Boolean(id && id.trim()))));
  if (uniqueIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, display_name, avatar_url, role, updated_at')
      .in('id', uniqueIds);

    if (error || !data) {
      return {};
    }

    const map: Record<string, PublicProfile> = {};
    for (const row of data as PublicProfile[]) {
      map[row.id] = row;
    }
    return map;
  } catch {
    return {};
  }
}

// ----------------------------------------------------------------------------
// System Announcements (Admin manages; everyone reads active announcements)
// ----------------------------------------------------------------------------

interface SystemAnnouncementRow {
  id: string;
  title: string;
  content: string;
  tone: AnnouncementTone;
  is_pinned: boolean;
  is_active: boolean;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export async function fetchSystemAnnouncements(
  includeInactive = false,
): Promise<CommunityResult<SystemAnnouncement[]>> {
  if (!supabase) {
    return { ok: true, data: [], schemaReady: false };
  }

  try {
    let query = supabase
      .from('system_announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingCommunitySchemaError(error) || error.code === '42501') {
        return { ok: true, data: [], schemaReady: false };
      }
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể tải thông báo hệ thống.'),
      };
    }

    const rows = (data ?? []) as SystemAnnouncementRow[];
    const profilesMap = await fetchPublicProfilesMap(rows.map((r) => r.author_id));

    const items: SystemAnnouncement[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tone: row.tone,
      isPinned: row.is_pinned,
      isActive: row.is_active,
      authorId: row.author_id,
      authorDisplayName: profilesMap[row.author_id]?.display_name || 'Admin SéaClover',
      authorAvatarUrl: profilesMap[row.author_id]?.avatar_url ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { ok: true, data: items, schemaReady: true };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể tải thông báo hệ thống.'),
    };
  }
}

export interface SaveAnnouncementInput {
  title: string;
  content: string;
  tone: AnnouncementTone;
  isPinned: boolean;
  isActive: boolean;
}

export async function createSystemAnnouncement(
  authorId: string,
  input: SaveAnnouncementInput,
): Promise<CommunityResult<SystemAnnouncement>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || title.length > 200) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'Tiêu đề thông báo cần từ 1 đến 200 ký tự.' },
    };
  }
  if (!content || content.length > 3000) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'Nội dung thông báo cần từ 1 đến 3000 ký tự.' },
    };
  }

  try {
    const { data, error } = await supabase
      .from('system_announcements')
      .insert({
        title,
        content,
        tone: input.tone,
        is_pinned: input.isPinned,
        is_active: input.isActive,
        author_id: authorId,
      })
      .select('*')
      .single();

    if (error) {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể đăng thông báo hệ thống.'),
      };
    }

    const row = data as SystemAnnouncementRow;
    const profilesMap = await fetchPublicProfilesMap([row.author_id]);
    return {
      ok: true,
      data: {
        id: row.id,
        title: row.title,
        content: row.content,
        tone: row.tone,
        isPinned: row.is_pinned,
        isActive: row.is_active,
        authorId: row.author_id,
        authorDisplayName: profilesMap[row.author_id]?.display_name || 'Admin SéaClover',
        authorAvatarUrl: profilesMap[row.author_id]?.avatar_url ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể đăng thông báo hệ thống.'),
    };
  }
}

export async function updateSystemAnnouncement(
  id: string,
  input: SaveAnnouncementInput,
): Promise<CommunityResult<SystemAnnouncement>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || title.length > 200) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'Tiêu đề thông báo cần từ 1 đến 200 ký tự.' },
    };
  }
  if (!content || content.length > 3000) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'Nội dung thông báo cần từ 1 đến 3000 ký tự.' },
    };
  }

  try {
    const { data, error } = await supabase
      .from('system_announcements')
      .update({
        title,
        content,
        tone: input.tone,
        is_pinned: input.isPinned,
        is_active: input.isActive,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể cập nhật thông báo hệ thống.'),
      };
    }

    const row = data as SystemAnnouncementRow;
    const profilesMap = await fetchPublicProfilesMap([row.author_id]);
    return {
      ok: true,
      data: {
        id: row.id,
        title: row.title,
        content: row.content,
        tone: row.tone,
        isPinned: row.is_pinned,
        isActive: row.is_active,
        authorId: row.author_id,
        authorDisplayName: profilesMap[row.author_id]?.display_name || 'Admin SéaClover',
        authorAvatarUrl: profilesMap[row.author_id]?.avatar_url ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể cập nhật thông báo hệ thống.'),
    };
  }
}

export async function deleteSystemAnnouncement(id: string): Promise<CommunityResult<{ id: string }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  try {
    const { error } = await supabase.from('system_announcements').delete().eq('id', id);
    if (error) {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể xóa thông báo hệ thống.'),
      };
    }
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể xóa thông báo hệ thống.'),
    };
  }
}

// ----------------------------------------------------------------------------
// Character Comments & Admin Moderation
// ----------------------------------------------------------------------------

interface CharacterCommentRow {
  id: string;
  character_owner_id: string;
  character_item_id: string;
  user_id: string;
  content: string;
  is_hidden: boolean;
  hidden_by: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchCharacterComments(
  characterOwnerId: string,
  characterItemId: string,
): Promise<CommunityResult<CharacterComment[]>> {
  if (!supabase) {
    return { ok: true, data: [], schemaReady: false };
  }

  try {
    const { data, error } = await supabase
      .from('character_comments')
      .select('*')
      .eq('character_owner_id', characterOwnerId)
      .eq('character_item_id', characterItemId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingCommunitySchemaError(error)) {
        return { ok: true, data: [], schemaReady: false };
      }
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể tải danh sách bình luận.'),
      };
    }

    const rows = (data ?? []) as CharacterCommentRow[];
    const profilesMap = await fetchPublicProfilesMap(rows.map((r) => r.user_id));

    const comments: CharacterComment[] = rows.map((row) => ({
      id: row.id,
      characterOwnerId: row.character_owner_id,
      characterItemId: row.character_item_id,
      userId: row.user_id,
      authorDisplayName: profilesMap[row.user_id]?.display_name || 'Thành viên SéaClover',
      authorAvatarUrl: profilesMap[row.user_id]?.avatar_url ?? null,
      authorRole: profilesMap[row.user_id]?.role || 'user',
      content: row.content,
      isHidden: row.is_hidden,
      hiddenBy: row.hidden_by,
      hiddenAt: row.hidden_at,
      hiddenReason: row.hidden_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { ok: true, data: comments, schemaReady: true };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể tải danh sách bình luận.'),
    };
  }
}

export async function createCharacterComment(
  userId: string,
  characterOwnerId: string,
  characterItemId: string,
  rawContent: string,
): Promise<CommunityResult<CharacterComment>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const content = rawContent.trim();
  if (!content) {
    return { ok: false, error: { code: 'VALIDATION', message: 'Vui lòng nhập nội dung bình luận.' } };
  }
  if (content.length > 1500) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'Bình luận tối đa 1500 ký tự.' },
    };
  }

  try {
    // Tuyệt đối không gửi các trường kiểm duyệt khi tạo bình luận mới
    const { data, error } = await supabase
      .from('character_comments')
      .insert({
        character_owner_id: characterOwnerId,
        character_item_id: characterItemId,
        user_id: userId,
        content,
      })
      .select('*')
      .single();

    if (error) {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể gửi bình luận lúc này.'),
      };
    }

    const row = data as CharacterCommentRow;
    const profilesMap = await fetchPublicProfilesMap([row.user_id]);
    return {
      ok: true,
      data: {
        id: row.id,
        characterOwnerId: row.character_owner_id,
        characterItemId: row.character_item_id,
        userId: row.user_id,
        authorDisplayName: profilesMap[row.user_id]?.display_name || 'Thành viên SéaClover',
        authorAvatarUrl: profilesMap[row.user_id]?.avatar_url ?? null,
        authorRole: profilesMap[row.user_id]?.role || 'user',
        content: row.content,
        isHidden: row.is_hidden,
        hiddenBy: row.hidden_by,
        hiddenAt: row.hidden_at,
        hiddenReason: row.hidden_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể gửi bình luận lúc này.'),
    };
  }
}

export async function updateCharacterComment(
  commentId: string,
  rawContent: string,
): Promise<CommunityResult<CharacterComment>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const content = rawContent.trim();
  if (!content || content.length > 1500) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'Nội dung bình luận cần từ 1 đến 1500 ký tự.' },
    };
  }

  try {
    const { data, error } = await supabase
      .from('character_comments')
      .update({ content })
      .eq('id', commentId)
      .select('*')
      .single();

    if (error) {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể cập nhật bình luận.'),
      };
    }

    const row = data as CharacterCommentRow;
    const profilesMap = await fetchPublicProfilesMap([row.user_id]);
    return {
      ok: true,
      data: {
        id: row.id,
        characterOwnerId: row.character_owner_id,
        characterItemId: row.character_item_id,
        userId: row.user_id,
        authorDisplayName: profilesMap[row.user_id]?.display_name || 'Thành viên SéaClover',
        authorAvatarUrl: profilesMap[row.user_id]?.avatar_url ?? null,
        authorRole: profilesMap[row.user_id]?.role || 'user',
        content: row.content,
        isHidden: row.is_hidden,
        hiddenBy: row.hidden_by,
        hiddenAt: row.hidden_at,
        hiddenReason: row.hidden_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể cập nhật bình luận.'),
    };
  }
}

export async function moderateCharacterComment(
  commentId: string,
  isHidden: boolean,
  hiddenReason?: string,
): Promise<CommunityResult<CharacterComment>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const trimmedReason = hiddenReason?.trim() ? hiddenReason.trim().slice(0, 300) : null;

  try {
    const { data, error } = await supabase
      .from('character_comments')
      .update({
        is_hidden: isHidden,
        hidden_reason: isHidden ? trimmedReason : null,
      })
      .eq('id', commentId)
      .select('*')
      .single();

    if (error) {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể cập nhật trạng thái ẩn bình luận.'),
      };
    }

    const row = data as CharacterCommentRow;
    const profilesMap = await fetchPublicProfilesMap([row.user_id]);
    return {
      ok: true,
      data: {
        id: row.id,
        characterOwnerId: row.character_owner_id,
        characterItemId: row.character_item_id,
        userId: row.user_id,
        authorDisplayName: profilesMap[row.user_id]?.display_name || 'Thành viên SéaClover',
        authorAvatarUrl: profilesMap[row.user_id]?.avatar_url ?? null,
        authorRole: profilesMap[row.user_id]?.role || 'user',
        content: row.content,
        isHidden: row.is_hidden,
        hiddenBy: row.hidden_by,
        hiddenAt: row.hidden_at,
        hiddenReason: row.hidden_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể cập nhật trạng thái ẩn bình luận.'),
    };
  }
}

export async function deleteCharacterComment(
  commentId: string,
): Promise<CommunityResult<{ id: string }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  try {
    const { error } = await supabase.from('character_comments').delete().eq('id', commentId);
    if (error) {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể xóa bình luận.'),
      };
    }
    return { ok: true, data: { id: commentId } };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể xóa bình luận.'),
    };
  }
}

// ----------------------------------------------------------------------------
// Prompt Effectiveness Ratings
// ----------------------------------------------------------------------------

interface PromptRatingRow {
  id: string;
  target_type: 'library_prompt' | 'note';
  target_scope: string;
  target_owner_id: string | null;
  target_item_id: string;
  user_id: string;
  score: number;
  review: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchPromptRatings(
  targetType: 'library_prompt' | 'note',
  targetOwnerId: string | null,
  targetItemId: string,
  currentUserId: string | null,
): Promise<CommunityResult<PromptRatingSummary>> {
  if (!supabase) {
    return {
      ok: true,
      data: { average: 0, count: 0, userRating: null, ratings: [] },
      schemaReady: false,
    };
  }

  const targetScope = buildTargetScope(targetOwnerId);

  try {
    const { data, error } = await supabase
      .from('prompt_ratings')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_scope', targetScope)
      .eq('target_item_id', targetItemId)
      .order('updated_at', { ascending: false });

    if (error) {
      if (isMissingCommunitySchemaError(error)) {
        return {
          ok: true,
          data: { average: 0, count: 0, userRating: null, ratings: [] },
          schemaReady: false,
        };
      }
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể tải đánh giá câu lệnh.'),
      };
    }

    const rows = (data ?? []) as PromptRatingRow[];
    const profilesMap = await fetchPublicProfilesMap(rows.map((r) => r.user_id));

    const ratings: PromptRating[] = rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetScope: row.target_scope,
      targetOwnerId: row.target_owner_id,
      targetItemId: row.target_item_id,
      userId: row.user_id,
      authorDisplayName: profilesMap[row.user_id]?.display_name || 'Thành viên SéaClover',
      authorAvatarUrl: profilesMap[row.user_id]?.avatar_url ?? null,
      authorRole: profilesMap[row.user_id]?.role || 'user',
      score: row.score,
      review: row.review,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const count = ratings.length;
    const sum = ratings.reduce((acc, r) => acc + r.score, 0);
    const average = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    const userRating = currentUserId
      ? ratings.find((r) => r.userId === currentUserId) ?? null
      : null;

    return {
      ok: true,
      data: { average, count, userRating, ratings },
      schemaReady: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể tải đánh giá câu lệnh.'),
    };
  }
}

export async function savePromptRating(params: {
  existingRatingId?: string | null;
  userId: string;
  targetType: 'library_prompt' | 'note';
  targetOwnerId: string | null;
  targetItemId: string;
  score: number;
  review?: string;
}): Promise<CommunityResult<PromptRating>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const score = Math.round(params.score);
  if (score < 1 || score > 5) {
    return { ok: false, error: { code: 'VALIDATION', message: 'Vui lòng chọn điểm từ 1 đến 5 sao.' } };
  }
  const cleanReview = params.review?.trim() ? params.review.trim() : null;
  if (cleanReview && cleanReview.length > 500) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'Nhận xét đánh giá tối đa 500 ký tự.' },
    };
  }

  const targetScope = buildTargetScope(params.targetOwnerId);

  try {
    let row: PromptRatingRow | null = null;

    if (params.existingRatingId) {
      // Cập nhật hẹp chỉ score & review kèm khóa user_id để tuân thủ chặt trigger & RLS
      const { data, error } = await supabase
        .from('prompt_ratings')
        .update({ score, review: cleanReview })
        .eq('id', params.existingRatingId)
        .eq('user_id', params.userId)
        .select('*')
        .single();

      if (error) {
        return {
          ok: false,
          error: normalizeCommunityError(error, 'Không thể cập nhật đánh giá câu lệnh.'),
        };
      }
      row = data as PromptRatingRow;
    } else {
      const { data, error } = await supabase
        .from('prompt_ratings')
        .insert({
          target_type: params.targetType,
          target_scope: targetScope,
          target_owner_id: params.targetOwnerId,
          target_item_id: params.targetItemId,
          user_id: params.userId,
          score,
          review: cleanReview,
        })
        .select('*')
        .single();

      if (error) {
        // Nếu người dùng đã đánh giá từ thiết bị khác (trùng unique 23505), chuyển sang cập nhật bản ghi của chính họ
        if (error.code === '23505') {
          const { data: updated, error: updateErr } = await supabase
            .from('prompt_ratings')
            .update({ score, review: cleanReview })
            .eq('target_type', params.targetType)
            .eq('target_scope', targetScope)
            .eq('target_item_id', params.targetItemId)
            .eq('user_id', params.userId)
            .select('*')
            .single();

          if (updateErr) {
            return {
              ok: false,
              error: normalizeCommunityError(updateErr, 'Không thể cập nhật đánh giá câu lệnh.'),
            };
          }
          row = updated as PromptRatingRow;
        } else {
          return {
            ok: false,
            error: normalizeCommunityError(error, 'Không thể gửi đánh giá câu lệnh.'),
          };
        }
      } else {
        row = data as PromptRatingRow;
      }
    }

    const profilesMap = await fetchPublicProfilesMap([row.user_id]);
    return {
      ok: true,
      data: {
        id: row.id,
        targetType: row.target_type,
        targetScope: row.target_scope,
        targetOwnerId: row.target_owner_id,
        targetItemId: row.target_item_id,
        userId: row.user_id,
        authorDisplayName: profilesMap[row.user_id]?.display_name || 'Thành viên SéaClover',
        authorAvatarUrl: profilesMap[row.user_id]?.avatar_url ?? null,
        authorRole: profilesMap[row.user_id]?.role || 'user',
        score: row.score,
        review: row.review,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể lưu đánh giá câu lệnh.'),
    };
  }
}

export async function deletePromptRating(
  ratingId: string,
): Promise<CommunityResult<{ id: string }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  try {
    const { error } = await supabase.from('prompt_ratings').delete().eq('id', ratingId);
    if (error) {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể xóa đánh giá.'),
      };
    }
    return { ok: true, data: { id: ratingId } };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể xóa đánh giá.'),
    };
  }
}

// ----------------------------------------------------------------------------
// Content Likes (Thả tim)
// ----------------------------------------------------------------------------

export async function fetchContentLikes(
  targetType: ContentTargetType,
  targetOwnerId: string | null,
  targetItemId: string,
  currentUserId: string | null,
): Promise<CommunityResult<LikeSummary>> {
  if (!supabase) {
    return { ok: true, data: { count: 0, likedByMe: false }, schemaReady: false };
  }

  const targetScope = buildTargetScope(targetOwnerId);

  try {
    const { data, error } = await supabase
      .from('content_likes')
      .select('user_id')
      .eq('target_type', targetType)
      .eq('target_scope', targetScope)
      .eq('target_item_id', targetItemId);

    if (error) {
      if (isMissingCommunitySchemaError(error)) {
        return { ok: true, data: { count: 0, likedByMe: false }, schemaReady: false };
      }
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể tải lượt thả tim.'),
      };
    }

    const rows = (data ?? []) as Array<{ user_id: string }>;
    const likedByMe = currentUserId ? rows.some((r) => r.user_id === currentUserId) : false;

    return {
      ok: true,
      data: { count: rows.length, likedByMe },
      schemaReady: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể tải lượt thả tim.'),
    };
  }
}

export async function toggleContentLike(params: {
  userId: string;
  targetType: ContentTargetType;
  targetOwnerId: string | null;
  targetItemId: string;
  currentlyLiked: boolean;
}): Promise<CommunityResult<{ likedByMe: boolean }>> {
  if (!supabase) {
    return { ok: false, error: { code: 'NOT_CONFIGURED', message: 'Supabase chưa được cấu hình.' } };
  }

  const targetScope = buildTargetScope(params.targetOwnerId);

  try {
    if (params.currentlyLiked) {
      const { error } = await supabase
        .from('content_likes')
        .delete()
        .eq('target_type', params.targetType)
        .eq('target_scope', targetScope)
        .eq('target_item_id', params.targetItemId)
        .eq('user_id', params.userId);

      if (error) {
        return {
          ok: false,
          error: normalizeCommunityError(error, 'Không thể bỏ thả tim lúc này.'),
        };
      }
      return { ok: true, data: { likedByMe: false } };
    }

    const { error } = await supabase.from('content_likes').insert({
      target_type: params.targetType,
      target_scope: targetScope,
      target_owner_id: params.targetOwnerId,
      target_item_id: params.targetItemId,
      user_id: params.userId,
    });

    if (error && error.code !== '23505') {
      return {
        ok: false,
        error: normalizeCommunityError(error, 'Không thể thả tim lúc này.'),
      };
    }

    return { ok: true, data: { likedByMe: true } };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể thực hiện thao tác thả tim.'),
    };
  }
}

// ----------------------------------------------------------------------------
// Batch Community Stats cho Kho Nội Dung Của Tôi
// ----------------------------------------------------------------------------

export interface VaultItemCommunityStats {
  likes: number;
  comments: number;
  ratingCount: number;
  ratingAverage: number;
}

export function buildVaultStatsKey(
  targetType: ContentTargetType,
  ownerId: string | null | undefined,
  itemId: string,
): string {
  return `${targetType}:${buildTargetScope(ownerId)}:${itemId}`;
}

export async function fetchVaultCommunityStats(
  items: Array<{ targetType: ContentTargetType; ownerId?: string | null; itemId: string }>,
): Promise<CommunityResult<Record<string, VaultItemCommunityStats>>> {
  if (!supabase || items.length === 0) {
    return { ok: true, data: {}, schemaReady: Boolean(supabase) };
  }

  const allItemIds = Array.from(new Set(items.map((i) => i.itemId).filter(Boolean)));
  const charItemIds = Array.from(
    new Set(items.filter((i) => i.targetType === 'character').map((i) => i.itemId).filter(Boolean)),
  );
  const promptItemIds = Array.from(
    new Set(
      items
        .filter((i) => i.targetType === 'note' || i.targetType === 'library_prompt')
        .map((i) => i.itemId)
        .filter(Boolean),
    ),
  );

  const statsMap: Record<string, VaultItemCommunityStats> = {};
  const ensureEntry = (key: string): VaultItemCommunityStats => {
    if (!statsMap[key]) {
      statsMap[key] = { likes: 0, comments: 0, ratingCount: 0, ratingAverage: 0 };
    }
    return statsMap[key];
  };

  try {
    const chunkIds = (arr: string[], size = 80): string[][] => {
      const out: string[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
      }
      return out;
    };

    const likeQueries = chunkIds(allItemIds).map((ids) =>
      supabase!
        .from('content_likes')
        .select('target_type, target_scope, target_item_id')
        .in('target_item_id', ids),
    );
    const commentQueries = chunkIds(charItemIds).map((ids) =>
      supabase!
        .from('character_comments')
        .select('character_owner_id, character_item_id, is_hidden')
        .in('character_item_id', ids)
        .eq('is_hidden', false),
    );
    const ratingQueries = chunkIds(promptItemIds).map((ids) =>
      supabase!
        .from('prompt_ratings')
        .select('target_type, target_scope, target_item_id, score')
        .in('target_item_id', ids),
    );

    const [likeResults, commentResults, ratingResults] = await Promise.all([
      Promise.all(likeQueries),
      Promise.all(commentQueries),
      Promise.all(ratingQueries),
    ]);

    const firstError =
      likeResults.find((r) => r.error)?.error ||
      commentResults.find((r) => r.error)?.error ||
      ratingResults.find((r) => r.error)?.error;

    if (firstError) {
      if (isMissingCommunitySchemaError(firstError)) {
        return { ok: true, data: {}, schemaReady: false };
      }
      return {
        ok: false,
        error: normalizeCommunityError(firstError, 'Không thể tải thống kê tương tác.'),
      };
    }

    for (const res of likeResults) {
      for (const row of (res.data ?? []) as Array<{
        target_type: ContentTargetType;
        target_scope: string;
        target_item_id: string;
      }>) {
        const key = `${row.target_type}:${row.target_scope}:${row.target_item_id}`;
        ensureEntry(key).likes += 1;
      }
    }

    for (const res of commentResults) {
      for (const row of (res.data ?? []) as Array<{
        character_owner_id: string;
        character_item_id: string;
      }>) {
        const key = `character:${row.character_owner_id}:${row.character_item_id}`;
        ensureEntry(key).comments += 1;
      }
    }

    const ratingSums: Record<string, { sum: number; count: number }> = {};
    for (const res of ratingResults) {
      for (const row of (res.data ?? []) as Array<{
        target_type: 'library_prompt' | 'note';
        target_scope: string;
        target_item_id: string;
        score: number;
      }>) {
        const key = `${row.target_type}:${row.target_scope}:${row.target_item_id}`;
        if (!ratingSums[key]) {
          ratingSums[key] = { sum: 0, count: 0 };
        }
        ratingSums[key].sum += Number(row.score || 0);
        ratingSums[key].count += 1;
      }
    }

    for (const [key, agg] of Object.entries(ratingSums)) {
      const entry = ensureEntry(key);
      entry.ratingCount = agg.count;
      entry.ratingAverage = agg.count > 0 ? Math.round((agg.sum / agg.count) * 10) / 10 : 0;
    }

    return { ok: true, data: statsMap, schemaReady: true };
  } catch (err) {
    return {
      ok: false,
      error: normalizeCommunityError(err, 'Không thể tải thống kê tương tác.'),
    };
  }
}

