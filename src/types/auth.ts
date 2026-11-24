import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'user' | 'admin';

export type AuthModalMode =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password';

export type AuthErrorCode =
  | 'NOT_CONFIGURED'
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'USER_ALREADY_EXISTS'
  | 'WEAK_PASSWORD'
  | 'SAME_PASSWORD'
  | 'RATE_LIMITED'
  | 'TOKEN_EXPIRED'
  | 'SESSION_EXPIRED'
  | 'SIGNUP_DISABLED'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'PROFILE_NOT_FOUND'
  | 'UNKNOWN_ERROR';

export interface AuthServiceError {
  code: AuthErrorCode;
  message: string;
  status?: number;
}

export interface AuthResult<T = void> {
  ok: boolean;
  data: T | null;
  error: AuthServiceError | null;
  message?: string;
}

/**
 * Bản ghi hồ sơ người dùng từ bảng public.profiles (liên kết 1-1 với auth.users qua UUID).
 * Các trường id, email, role, created_at, updated_at do hệ thống quản lý.
 */
export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

/**
 * Chỉ các trường hồ sơ cá nhân được phép chỉnh sửa từ phía client.
 * Tuyệt đối không cho phép truyền id, role, email hoặc created_at.
 */
export interface UpdateProfileInput {
  display_name?: string;
  avatar_url?: string | null;
  bio?: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpResultData {
  user: User | null;
  session: Session | null;
  autoSignedIn: boolean;
}

export interface SignInResultData {
  user: User;
  session: Session;
}

/**
 * Trạng thái tổng hợp dùng cho AuthContext ở Bước 3,
 * thiết kế theo userId (UUID) để sẵn sàng hỗ trợ nhiều tài khoản trên cùng thiết bị.
 */
export interface AuthStateSnapshot {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  userId: string | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isLoading: boolean;
  isRecoveryMode: boolean;
}
