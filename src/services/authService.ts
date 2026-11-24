import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseConfigStatus, supabase } from '../lib/supabase';
import type {
  AuthErrorCode,
  AuthResult,
  AuthServiceError,
  SignInInput,
  SignInResultData,
  SignUpInput,
  SignUpResultData,
  UpdateProfileInput,
  UserProfile,
} from '../types/auth';
import {
  checkSignupRateLimit,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  recordSignupAttempt,
  validateEmailFormat,
  validatePassword,
} from '../utils/authValidation';

const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_BIO_LENGTH = 500;
const MAX_AVATAR_URL_LENGTH = 2048;
const MAX_AVATAR_FILE_BYTES = 2 * 1024 * 1024; // 2 MB khớp với migration 004
const MAX_AVATAR_INPUT_BYTES = 12 * 1024 * 1024; // Cho phép ảnh gốc tối đa 12 MB trước khi nén/resize
const AVATAR_BUCKET = 'avatars';
const ALLOWED_AVATAR_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const PROFILE_COLUMNS =
  'id, email, display_name, avatar_url, bio, role, created_at, updated_at';

function okResult<T>(data: T, message?: string): AuthResult<T> {
  return {
    ok: true,
    data,
    error: null,
    message,
  };
}

function errorResult<T = never>(
  code: AuthErrorCode,
  message: string,
  status?: number,
): AuthResult<T> {
  return {
    ok: false,
    data: null,
    error: { code, message, status },
    message,
  };
}

function getClientOrError<T>():
  | { client: NonNullable<typeof supabase>; error: null }
  | { client: null; error: AuthResult<T> } {
  if (!supabase) {
    const configStatus = getSupabaseConfigStatus();
    return {
      client: null,
      error: errorResult<T>('NOT_CONFIGURED', configStatus.message),
    };
  }
  return { client: supabase, error: null };
}

function validateEmail(email: string): string | null {
  return validateEmailFormat(email);
}

export function isSafeHttpsUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_AVATAR_URL_LENGTH) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getDefaultAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return undefined;
  }
  return window.location.origin;
}

/**
 * Chuẩn hóa lỗi từ Supabase Auth / PostgREST sang mã lỗi và thông báo tiếng Việt thân thiện.
 */
export function normalizeAuthError(rawError: unknown): AuthServiceError {
  if (!rawError) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.',
    };
  }

  const errObj = rawError as {
    code?: string;
    message?: string;
    status?: number;
    error_description?: string;
  };

  const rawCode = (errObj.code ?? '').toLowerCase();
  const rawMessage = (errObj.message ?? errObj.error_description ?? '').toLowerCase();
  const status = typeof errObj.status === 'number' ? errObj.status : undefined;

  if (
    rawCode === 'invalid_credentials' ||
    rawMessage.includes('invalid login credentials') ||
    rawMessage.includes('invalid email or password')
  ) {
    return {
      code: 'INVALID_CREDENTIALS',
      message: 'Email hoặc mật khẩu không chính xác.',
      status,
    };
  }

  if (
    rawCode === 'email_not_confirmed' ||
    rawMessage.includes('email not confirmed')
  ) {
    return {
      code: 'EMAIL_NOT_CONFIRMED',
      message:
        'Tài khoản này đang chờ xác nhận email trên máy chủ xác thực. Hãy tắt Confirm email trong Supabase Dashboard hoặc dùng Quên mật khẩu để kích hoạt đăng nhập.',
      status,
    };
  }

  if (
    rawCode === 'user_already_exists' ||
    rawCode === 'email_exists' ||
    rawMessage.includes('user already registered') ||
    rawMessage.includes('already been registered')
  ) {
    return {
      code: 'USER_ALREADY_EXISTS',
      message:
        'Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng chức năng quên mật khẩu.',
      status,
    };
  }

  if (
    rawCode === 'weak_password' ||
    rawMessage.includes('password should be at least') ||
    rawMessage.includes('weak password')
  ) {
    return {
      code: 'WEAK_PASSWORD',
      message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
      status,
    };
  }

  if (
    rawCode === 'same_password' ||
    rawMessage.includes('different from the old password')
  ) {
    return {
      code: 'SAME_PASSWORD',
      message: 'Mật khẩu mới phải khác với mật khẩu hiện tại.',
      status,
    };
  }

  if (
    status === 429 ||
    rawCode === 'over_email_send_rate_limit' ||
    rawCode === 'over_request_rate_limit' ||
    rawMessage.includes('rate limit') ||
    rawMessage.includes('too many requests') ||
    rawMessage.includes('for security purposes, you can only request this after')
  ) {
    return {
      code: 'RATE_LIMITED',
      message:
        'Bạn thao tác quá nhanh hoặc đã chạm giới hạn gửi yêu cầu. Vui lòng chờ một lát rồi thử lại.',
      status: status ?? 429,
    };
  }

  if (
    rawCode === 'otp_expired' ||
    rawCode === 'flow_state_expired' ||
    rawCode === 'flow_state_not_found' ||
    rawMessage.includes('token has expired') ||
    rawMessage.includes('invalid token') ||
    rawMessage.includes('link is invalid or has expired')
  ) {
    return {
      code: 'TOKEN_EXPIRED',
      message:
        'Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu gửi lại liên kết mới.',
      status,
    };
  }

  if (
    rawCode === 'session_not_found' ||
    rawCode === 'session_expired' ||
    rawCode === 'refresh_token_not_found' ||
    rawMessage.includes('auth session missing') ||
    rawMessage.includes('invalid refresh token') ||
    rawMessage.includes('jwt expired')
  ) {
    return {
      code: 'SESSION_EXPIRED',
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      status,
    };
  }

  if (
    rawCode === 'signup_disabled' ||
    rawMessage.includes('signups not allowed')
  ) {
    return {
      code: 'SIGNUP_DISABLED',
      message: 'Chức năng đăng ký tài khoản mới hiện đang tạm khóa trên hệ thống.',
      status,
    };
  }

  if (
    rawCode === '42501' ||
    rawMessage.includes('row-level security') ||
    rawMessage.includes('permission denied')
  ) {
    return {
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền thực hiện thao tác này.',
      status: status ?? 403,
    };
  }

  if (
    rawCode === '23514' ||
    rawMessage.includes('violates check constraint')
  ) {
    return {
      code: 'VALIDATION_ERROR',
      message:
        'Dữ liệu nhập vào không hợp lệ. Vui lòng kiểm tra lại độ dài hoặc định dạng liên kết (chỉ chấp nhận https://).',
      status: status ?? 400,
    };
  }

  if (
    rawMessage.includes('failed to fetch') ||
    rawMessage.includes('networkerror') ||
    rawMessage.includes('network request failed') ||
    rawMessage.includes('load failed')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message:
        'Không thể kết nối tới máy chủ Supabase. Vui lòng kiểm tra kết nối mạng và thử lại.',
      status,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Đã xảy ra lỗi trong quá trình xử lý xác thực. Vui lòng thử lại sau.',
    status,
  };
}

/**
 * Đăng ký tài khoản nhanh bằng Email + Mật khẩu (không bắt buộc xác minh email).
 * Tự động đăng nhập ngay sau khi tạo tài khoản nếu Confirm email đã được tắt trên Supabase.
 */
export async function signUpWithEmail(
  input: SignUpInput,
): Promise<AuthResult<SignUpResultData>> {
  const { client, error: clientError } = getClientOrError<SignUpResultData>();
  if (clientError) return clientError;

  const emailError = validateEmail(input.email);
  if (emailError) {
    return errorResult('VALIDATION_ERROR', emailError);
  }

  const passwordError = validatePassword(input.password);
  if (passwordError) {
    return errorResult('VALIDATION_ERROR', passwordError);
  }

  const trimmedDisplayName = input.displayName?.trim() ?? '';
  if (trimmedDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return errorResult(
      'VALIDATION_ERROR',
      `Tên hiển thị không được vượt quá ${MAX_DISPLAY_NAME_LENGTH} ký tự.`,
    );
  }

  const rateCheck = checkSignupRateLimit();
  if (!rateCheck.allowed) {
    return errorResult(
      'RATE_LIMITED',
      rateCheck.message || 'Bạn thao tác đăng ký quá nhanh. Vui lòng thử lại sau.',
      429,
    );
  }

  try {
    const normalizedEmail = normalizeEmail(input.email);
    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password: input.password,
      options: trimmedDisplayName
        ? { data: { display_name: trimmedDisplayName } }
        : undefined,
    });

    if (error) {
      recordSignupAttempt(false);
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      recordSignupAttempt(false);
      return errorResult(
        'USER_ALREADY_EXISTS',
        'Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng chức năng quên mật khẩu.',
      );
    }

    recordSignupAttempt(true);

    if (!data.session) {
      return errorResult(
        'EMAIL_NOT_CONFIRMED',
        'Tài khoản đã được tạo nhưng Supabase vẫn đang bật Confirm email nên chưa tự động đăng nhập. Vui lòng tắt Confirm email trong Supabase Dashboard.',
      );
    }

    return okResult(
      {
        user: data.user,
        session: data.session,
        autoSignedIn: true,
      },
      'Đăng ký và đăng nhập thành công!',
    );
  } catch (err) {
    recordSignupAttempt(false);
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Đăng nhập bằng Email + Mật khẩu.
 */
export async function signInWithEmail(
  input: SignInInput,
): Promise<AuthResult<SignInResultData>> {
  const { client, error: clientError } = getClientOrError<SignInResultData>();
  if (clientError) return clientError;

  const emailError = validateEmail(input.email);
  if (emailError) {
    return errorResult('VALIDATION_ERROR', emailError);
  }

  if (!input.password) {
    return errorResult('VALIDATION_ERROR', 'Vui lòng nhập mật khẩu.');
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(input.email),
      password: input.password,
    });

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    if (!data.user || !data.session) {
      return errorResult(
        'UNKNOWN_ERROR',
        'Không thể khởi tạo phiên đăng nhập. Vui lòng thử lại.',
      );
    }

    return okResult(
      { user: data.user, session: data.session },
      'Đăng nhập thành công!',
    );
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Đăng xuất an toàn phiên hiện tại.
 * - Chỉ kết thúc phiên Supabase Auth (`scope: 'local'`), không làm ảnh hưởng phiên trên thiết bị khác.
 * - Tuyệt đối KHÔNG gọi localStorage.clear() và KHÔNG chạm vào khóa `seaclover_state`.
 */
export async function signOut(): Promise<AuthResult<void>> {
  const { client, error: clientError } = getClientOrError<void>();
  if (clientError) return clientError;

  try {
    const { error } = await client.auth.signOut({ scope: 'local' });

    if (error) {
      const normalized = normalizeAuthError(error);
      if (normalized.code === 'SESSION_EXPIRED') {
        return okResult(undefined, 'Đã đăng xuất khỏi phiên hiện tại.');
      }
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    return okResult(undefined, 'Đã đăng xuất an toàn.');
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Gửi email yêu cầu đặt lại mật khẩu (Quên mật khẩu).
 * Luôn trả về thông báo trung tính khi gửi thành công để tránh lộ danh sách email đã đăng ký.
 */
export async function sendPasswordResetEmail(
  email: string,
  redirectTo?: string,
): Promise<AuthResult<void>> {
  const { client, error: clientError } = getClientOrError<void>();
  if (clientError) return clientError;

  const emailError = validateEmail(email);
  if (emailError) {
    return errorResult('VALIDATION_ERROR', emailError);
  }

  try {
    const { error } = await client.auth.resetPasswordForEmail(
      normalizeEmail(email),
      {
        redirectTo: redirectTo ?? getDefaultAuthRedirectUrl(),
      },
    );

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    return okResult(
      undefined,
      'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư (kể cả mục Spam).',
    );
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Cập nhật mật khẩu mới (dùng cho cả luồng đặt lại mật khẩu sau PASSWORD_RECOVERY và đổi mật khẩu).
 */
export async function updatePassword(newPassword: string): Promise<AuthResult<User>> {
  const { client, error: clientError } = getClientOrError<User>();
  if (clientError) return clientError;

  const passwordError = validatePassword(newPassword, 'Mật khẩu mới');
  if (passwordError) {
    return errorResult('VALIDATION_ERROR', passwordError);
  }

  try {
    const { data, error } = await client.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    if (!data.user) {
      return errorResult(
        'SESSION_EXPIRED',
        'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu liên kết mới.',
      );
    }

    return okResult(data.user, 'Cập nhật mật khẩu thành công!');
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Lấy phiên đăng nhập hiện tại từ Supabase Auth (không ảnh hưởng chế độ Guest-first).
 */
export async function getCurrentSession(): Promise<AuthResult<Session | null>> {
  const { client, error: clientError } = getClientOrError<Session | null>();
  if (clientError) return clientError;

  try {
    const { data, error } = await client.auth.getSession();

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    return okResult(data.session ?? null);
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Xác thực và lấy thông tin người dùng hiện tại từ máy chủ Supabase Auth.
 */
export async function getCurrentUser(): Promise<AuthResult<User | null>> {
  const { client, error: clientError } = getClientOrError<User | null>();
  if (clientError) return clientError;

  try {
    const { data, error } = await client.auth.getUser();

    if (error) {
      const normalized = normalizeAuthError(error);
      if (normalized.code === 'SESSION_EXPIRED') {
        return okResult(null);
      }
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    return okResult(data.user ?? null);
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Trao đổi mã PKCE (`?code=...`) lấy phiên xác thực khi quay về từ liên kết khôi phục mật khẩu qua email.
 */
export async function exchangeAuthCodeForSession(
  authCode: string,
): Promise<AuthResult<Session>> {
  const { client, error: clientError } = getClientOrError<Session>();
  if (clientError) return clientError;

  const trimmedCode = authCode.trim();
  if (!trimmedCode) {
    return errorResult('VALIDATION_ERROR', 'Mã xác thực không hợp lệ.');
  }

  try {
    const { data, error } = await client.auth.exchangeCodeForSession(trimmedCode);

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    if (!data.session) {
      return errorResult(
        'TOKEN_EXPIRED',
        'Không thể xác thực phiên từ liên kết. Vui lòng thử lại.',
      );
    }

    return okResult(data.session, 'Xác thực phiên thành công!');
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Đọc hồ sơ của người dùng theo UUID từ bảng public.profiles (bảo vệ bởi RLS auth.uid() = id).
 */
export async function getUserProfile(
  userId: string,
): Promise<AuthResult<UserProfile | null>> {
  const { client, error: clientError } = getClientOrError<UserProfile | null>();
  if (clientError) return clientError;

  if (!userId.trim()) {
    return errorResult('VALIDATION_ERROR', 'Mã định danh người dùng không hợp lệ.');
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    return okResult((data as UserProfile | null) ?? null);
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Đảm bảo người dùng đã đăng nhập luôn có bản ghi hồ sơ trong public.profiles.
 * - Ưu tiên đọc bản ghi do trigger `on_auth_user_created` tạo sẵn.
 * - Dự phòng: nếu chưa tồn tại, chỉ chèn các trường cá nhân được phép (không gửi role/email/created_at).
 */
export async function ensureUserProfile(
  user: User,
): Promise<AuthResult<UserProfile>> {
  const existing = await getUserProfile(user.id);
  if (!existing.ok) {
    return errorResult(
      existing.error?.code ?? 'UNKNOWN_ERROR',
      existing.error?.message ?? 'Không thể tải hồ sơ người dùng.',
      existing.error?.status,
    );
  }

  if (existing.data) {
    return okResult(existing.data);
  }

  const { client, error: clientError } = getClientOrError<UserProfile>();
  if (clientError) return clientError;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const rawName =
    (typeof meta.display_name === 'string' && meta.display_name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (user.email ? user.email.split('@')[0] : '') ||
    '';

  const safeDisplayName = rawName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

  const rawAvatar =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    '';
  const safeAvatarUrl = isSafeHttpsUrl(rawAvatar) ? rawAvatar.trim() : null;

  try {
    const { data, error } = await client
      .from('profiles')
      .insert({
        id: user.id,
        display_name: safeDisplayName,
        avatar_url: safeAvatarUrl,
        bio: '',
      })
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    return okResult(data as UserProfile);
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Cập nhật thông tin hồ sơ cá nhân của người dùng hiện tại.
 * - Chỉ cho phép cập nhật display_name, avatar_url, bio.
 * - Không bao giờ cho phép gửi id, role, email, created_at, updated_at.
 * - Xác minh userId khớp với phiên hiện tại trước khi gửi lên Supabase.
 */
export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<AuthResult<UserProfile>> {
  const { client, error: clientError } = getClientOrError<UserProfile>();
  if (clientError) return clientError;

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session?.user) {
    return errorResult(
      'SESSION_EXPIRED',
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để cập nhật hồ sơ.',
    );
  }

  if (sessionData.session.user.id !== userId) {
    return errorResult(
      'FORBIDDEN',
      'Bạn chỉ được phép chỉnh sửa hồ sơ của chính tài khoản đang đăng nhập.',
    );
  }

  const payload: {
    display_name?: string;
    avatar_url?: string | null;
    bio?: string;
  } = {};

  if (input.display_name !== undefined) {
    const trimmedName = input.display_name.trim();
    if (!trimmedName) {
      return errorResult(
        'VALIDATION_ERROR',
        'Tên hiển thị không được để trống.',
      );
    }
    if (trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
      return errorResult(
        'VALIDATION_ERROR',
        `Tên hiển thị không được vượt quá ${MAX_DISPLAY_NAME_LENGTH} ký tự.`,
      );
    }
    payload.display_name = trimmedName;
  }

  if (input.bio !== undefined) {
    const trimmedBio = input.bio.trim();
    if (trimmedBio.length > MAX_BIO_LENGTH) {
      return errorResult(
        'VALIDATION_ERROR',
        `Giới thiệu không được vượt quá ${MAX_BIO_LENGTH} ký tự.`,
      );
    }
    payload.bio = trimmedBio;
  }

  if (input.avatar_url !== undefined) {
    if (input.avatar_url === null || input.avatar_url.trim() === '') {
      payload.avatar_url = null;
    } else {
      const trimmedUrl = input.avatar_url.trim();
      if (!isSafeHttpsUrl(trimmedUrl)) {
        return errorResult(
          'VALIDATION_ERROR',
          'Liên kết ảnh đại diện không hợp lệ (chỉ chấp nhận URL bắt đầu bằng https://).',
        );
      }
      payload.avatar_url = trimmedUrl;
    }
  }

  if (Object.keys(payload).length === 0) {
    return errorResult(
      'VALIDATION_ERROR',
      'Không có thông tin hồ sơ nào cần cập nhật.',
    );
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    if (!data) {
      return errorResult('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ người dùng.');
    }

    // Đồng bộ best-effort sang auth user_metadata (không làm gián đoạn nếu chậm mạng)
    const updatedProfile = data as UserProfile;
    void client.auth
      .updateUser({
        data: {
          display_name: updatedProfile.display_name,
          full_name: updatedProfile.display_name,
          avatar_url: updatedProfile.avatar_url ?? '',
        },
      })
      .catch(() => undefined);

    return okResult(updatedProfile, 'Đã cập nhật hồ sơ thành công!');
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

async function detectRasterImageMime(file: File): Promise<string | null> {
  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    ) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return 'image/jpeg';
    }
    // GIF: GIF87a / GIF89a
    if (
      header.length >= 6 &&
      header[0] === 0x47 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x38
    ) {
      return 'image/gif';
    }
    // WebP: RIFF....WEBP
    if (
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    ) {
      return 'image/webp';
    }
  } catch {
    return null;
  }
  return null;
}

async function optimizeAvatarImageIfNeeded(
  file: File,
  detectedMime: string,
): Promise<{ blob: Blob; mime: string }> {
  // Giữ nguyên GIF (tránh mất ảnh động) hoặc ảnh nhỏ gọn đã hợp lệ
  if (detectedMime === 'image/gif' || (file.size <= 700 * 1024 && detectedMime !== 'image/png')) {
    return { blob: file, mime: detectedMime };
  }

  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return { blob: file, mime: detectedMime };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxDimension = 512;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size <= MAX_AVATAR_FILE_BYTES) {
      return { blob: file, mime: detectedMime };
    }

    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: file, mime: detectedMime };
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const outputMime = detectedMime === 'image/png' ? 'image/webp' : detectedMime;
    const encoded = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), outputMime, 0.88);
    });

    if (encoded && encoded.size > 0 && encoded.size <= file.size) {
      return { blob: encoded, mime: outputMime };
    }
    if (encoded && encoded.size > 0 && file.size > MAX_AVATAR_FILE_BYTES) {
      return { blob: encoded, mime: outputMime };
    }
  } catch {
    // Dự phòng trả về tệp gốc để tầng kiểm tra kích thước xử lý tiếp
  } finally {
    bitmap?.close();
  }

  return { blob: file, mime: detectedMime };
}

export function extractOwnAvatarStoragePath(
  avatarUrl: string | null | undefined,
  userId: string,
): string | null {
  if (!avatarUrl || !userId || !isSafeHttpsUrl(avatarUrl)) {
    return null;
  }

  try {
    const parsed = new URL(avatarUrl.trim());
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;

    const rawPath = decodeURIComponent(parsed.pathname.slice(idx + marker.length));
    if (!rawPath.startsWith(`${userId}/`) || rawPath.includes('..')) {
      return null;
    }
    return rawPath;
  } catch {
    return null;
  }
}

/**
 * Tải ảnh đại diện từ thiết bị lên Supabase Storage (bucket `avatars`).
 * - Kiểm tra chữ ký byte thực tế của tệp (PNG/JPEG/WebP/GIF), chặn SVG/HTML.
 * - Tự động thu gọn kích thước ảnh lớn trước khi tải lên, bảo đảm <= 2 MB.
 * - Lưu trong thư mục riêng `<userId>/avatar-...` khớp chính xác RLS migration 004.
 */
export async function uploadUserAvatar(
  userId: string,
  file: File,
): Promise<AuthResult<{ publicUrl: string; storagePath: string }>> {
  const { client, error: clientError } = getClientOrError<{
    publicUrl: string;
    storagePath: string;
  }>();
  if (clientError) return clientError;

  if (!file) {
    return errorResult('VALIDATION_ERROR', 'Vui lòng chọn một tệp ảnh hợp lệ.');
  }

  if (file.size > MAX_AVATAR_INPUT_BYTES) {
    return errorResult(
      'VALIDATION_ERROR',
      'Ảnh chọn từ thiết bị quá lớn (tối đa 12 MB). Vui lòng chọn ảnh nhẹ hơn.',
    );
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session?.user) {
    return errorResult(
      'SESSION_EXPIRED',
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi tải ảnh đại diện.',
    );
  }

  if (sessionData.session.user.id !== userId) {
    return errorResult(
      'FORBIDDEN',
      'Bạn chỉ được phép tải ảnh đại diện cho chính tài khoản của mình.',
    );
  }

  const detectedMime = await detectRasterImageMime(file);
  if (!detectedMime || !ALLOWED_AVATAR_MIME_TO_EXT[detectedMime]) {
    return errorResult(
      'VALIDATION_ERROR',
      'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận ảnh PNG, JPG, WebP hoặc GIF.',
    );
  }

  const optimized = await optimizeAvatarImageIfNeeded(file, detectedMime);
  const ext = ALLOWED_AVATAR_MIME_TO_EXT[optimized.mime];
  if (!ext) {
    return errorResult(
      'VALIDATION_ERROR',
      'Không thể xác định định dạng ảnh hợp lệ để tải lên.',
    );
  }

  if (optimized.blob.size > MAX_AVATAR_FILE_BYTES) {
    return errorResult(
      'VALIDATION_ERROR',
      'Ảnh đại diện sau tối ưu vẫn vượt quá giới hạn 2 MB. Vui lòng chọn ảnh khác nhỏ hơn.',
    );
  }

  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const storagePath = `${userId}/avatar-${Date.now()}-${randomSuffix}.${ext}`;

  try {
    const { error: uploadError } = await client.storage
      .from(AVATAR_BUCKET)
      .upload(storagePath, optimized.blob, {
        contentType: optimized.mime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      const msgLower = String(uploadError.message || '').toLowerCase();
      if (msgLower.includes('bucket') && msgLower.includes('not found')) {
        return errorResult(
          'UNKNOWN_ERROR',
          'Kho lưu trữ ảnh đại diện chưa được khởi tạo. Vui lòng chạy migration 004_profile_avatars_storage.sql trên Supabase.',
        );
      }
      if (msgLower.includes('row-level security') || msgLower.includes('permission')) {
        return errorResult(
          'FORBIDDEN',
          'Chưa có quyền tải ảnh lên bucket avatars. Vui lòng kiểm tra migration 004 trên Supabase.',
          403,
        );
      }
      const normalized = normalizeAuthError(uploadError);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    const { data: urlData } = client.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl?.trim() ?? '';

    if (!isSafeHttpsUrl(publicUrl)) {
      return errorResult(
        'UNKNOWN_ERROR',
        'Không thể tạo liên kết HTTPS hợp lệ cho ảnh đại diện vừa tải lên.',
      );
    }

    return okResult({ publicUrl, storagePath }, 'Đã tải ảnh đại diện lên thành công!');
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Xóa tệp ảnh đại diện cũ thuộc chính user trong Supabase Storage (best-effort).
 */
export async function deleteUserAvatarObject(
  userId: string,
  avatarUrl: string | null | undefined,
): Promise<void> {
  if (!supabase) return;
  const storagePath = extractOwnAvatarStoragePath(avatarUrl, userId);
  if (!storagePath) return;

  try {
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
  } catch {
    // Bỏ qua an toàn nếu tệp không còn tồn tại hoặc chưa cấp bucket
  }
}

