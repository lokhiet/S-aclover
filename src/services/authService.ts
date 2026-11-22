import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseConfigStatus, supabase } from '../lib/supabase';
import type {
  AuthErrorCode,
  AuthResult,
  AuthServiceError,
  GoogleOAuthOptions,
  GoogleOAuthResultData,
  SignInInput,
  SignInResultData,
  SignUpInput,
  SignUpResultData,
  UpdateProfileInput,
  UserProfile,
} from '../types/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_BIO_LENGTH = 500;
const MAX_AVATAR_URL_LENGTH = 2048;

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return 'Vui lòng nhập địa chỉ email.';
  }
  if (!EMAIL_REGEX.test(normalized)) {
    return 'Địa chỉ email không đúng định dạng.';
  }
  return null;
}

function validatePassword(password: string, fieldLabel = 'Mật khẩu'): string | null {
  if (!password) {
    return `Vui lòng nhập ${fieldLabel.toLowerCase()}.`;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `${fieldLabel} phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `${fieldLabel} không được vượt quá ${MAX_PASSWORD_LENGTH} ký tự.`;
  }
  return null;
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

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
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
        'Email chưa được xác minh. Vui lòng kiểm tra hộp thư hoặc yêu cầu gửi lại email xác minh.',
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
      message: `Mật khẩu chưa đủ mạnh. Vui lòng sử dụng ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
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
        'Bạn thao tác quá nhanh hoặc đã chạm giới hạn gửi email. Vui lòng chờ một lát rồi thử lại.',
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
        'Liên kết xác minh hoặc đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu gửi lại.',
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
    rawCode === 'provider_disabled' ||
    rawMessage.includes('unsupported provider') ||
    rawMessage.includes('provider is not enabled')
  ) {
    return {
      code: 'PROVIDER_DISABLED',
      message: 'Đăng nhập bằng Google chưa được kích hoạt trên Supabase Dashboard.',
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
 * Đăng ký tài khoản công khai bằng Email + Mật khẩu.
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

  try {
    const normalizedEmail = normalizeEmail(input.email);
    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password: input.password,
      options: {
        emailRedirectTo: input.emailRedirectTo ?? getDefaultAuthRedirectUrl(),
        data: trimmedDisplayName ? { display_name: trimmedDisplayName } : undefined,
      },
    });

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    // Trường hợp Supabase ẩn lỗi trùng email khi bật Confirm Email: identities trả về mảng rỗng.
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      return errorResult(
        'USER_ALREADY_EXISTS',
        'Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng chức năng quên mật khẩu.',
      );
    }

    const needsEmailVerification = !data.session;
    return okResult(
      {
        user: data.user,
        session: data.session,
        needsEmailVerification,
      },
      needsEmailVerification
        ? 'Đăng ký thành công! Vui lòng kiểm tra hộp thư để xác minh email trước khi đăng nhập.'
        : 'Đăng ký và đăng nhập thành công!',
    );
  } catch (err) {
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
 * Đăng nhập bằng Google OAuth (PKCE).
 * - Dùng `prompt: 'select_account'` để dễ chọn/chuyển nhiều tài khoản Google trên cùng thiết bị.
 * - Tự nhận biết khi ứng dụng đang chạy trong iframe (ví dụ khung preview AI Studio) để tránh
 *   lỗi Google chặn hiển thị trong iframe; trả về URL OAuth để UI xử lý mở tab phù hợp.
 */
export async function signInWithGoogle(
  options?: GoogleOAuthOptions,
): Promise<AuthResult<GoogleOAuthResultData>> {
  const { client, error: clientError } = getClientOrError<GoogleOAuthResultData>();
  if (clientError) return clientError;

  const embedded = isRunningInIframe();
  const shouldSkipRedirect = embedded && !options?.forceRedirect;

  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: options?.redirectTo ?? getDefaultAuthRedirectUrl(),
        skipBrowserRedirect: shouldSkipRedirect,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    return okResult(
      {
        url: data?.url ?? null,
        redirected: !shouldSkipRedirect,
        isEmbeddedIframe: embedded,
      },
      shouldSkipRedirect
        ? 'Ứng dụng đang chạy trong khung nhúng (iframe). Vui lòng mở ứng dụng ở tab độc lập để tiếp tục đăng nhập Google.'
        : 'Đang chuyển hướng sang trang đăng nhập Google...',
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
 * Gửi lại email xác minh tài khoản sau khi đăng ký.
 */
export async function resendVerificationEmail(
  email: string,
  emailRedirectTo?: string,
): Promise<AuthResult<void>> {
  const { client, error: clientError } = getClientOrError<void>();
  if (clientError) return clientError;

  const emailError = validateEmail(email);
  if (emailError) {
    return errorResult('VALIDATION_ERROR', emailError);
  }

  try {
    const { error } = await client.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
      options: {
        emailRedirectTo: emailRedirectTo ?? getDefaultAuthRedirectUrl(),
      },
    });

    if (error) {
      const normalized = normalizeAuthError(error);
      return errorResult(normalized.code, normalized.message, normalized.status);
    }

    return okResult(
      undefined,
      'Đã gửi lại email xác minh. Vui lòng kiểm tra hộp thư đến và thư rác.',
    );
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
 * Trao đổi mã PKCE (`?code=...`) lấy phiên đăng nhập khi quay về từ OAuth hoặc liên kết email.
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

    return okResult(data as UserProfile, 'Đã cập nhật hồ sơ thành công!');
  } catch (err) {
    const normalized = normalizeAuthError(err);
    return errorResult(normalized.code, normalized.message, normalized.status);
  }
}
