import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  ensureUserProfile,
  getCurrentSession,
  normalizeAuthError,
  resendVerificationEmail,
  sendPasswordResetEmail,
  signInWithEmail,
  signInWithGoogle as signInWithGoogleService,
  signOut as signOutService,
  signUpWithEmail,
  updatePassword as updatePasswordService,
  updateUserProfile,
} from '../services/authService';
import type {
  AuthResult,
  AuthStateSnapshot,
  GoogleOAuthOptions,
  GoogleOAuthResultData,
  SignInInput,
  SignInResultData,
  SignUpInput,
  SignUpResultData,
  UpdateProfileInput,
  UserProfile,
} from '../types/auth';

export interface AuthContextValue extends AuthStateSnapshot {
  isAdmin: boolean;
  isAuthReady: boolean;
  isProfileLoading: boolean;
  authError: string | null;
  signUp: (input: SignUpInput) => Promise<AuthResult<SignUpResultData>>;
  signIn: (input: SignInInput) => Promise<AuthResult<SignInResultData>>;
  signInWithGoogle: (
    options?: GoogleOAuthOptions,
  ) => Promise<AuthResult<GoogleOAuthResultData>>;
  signOut: () => Promise<AuthResult<void>>;
  sendPasswordReset: (
    email: string,
    redirectTo?: string,
  ) => Promise<AuthResult<void>>;
  updatePassword: (newPassword: string) => Promise<AuthResult<User>>;
  resendVerification: (
    email: string,
    emailRedirectTo?: string,
  ) => Promise<AuthResult<void>>;
  refreshProfile: () => Promise<AuthResult<UserProfile> | null>;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthResult<UserProfile>>;
  clearRecoveryMode: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface UrlAuthState {
  isRecoveryUrl: boolean;
  hasPkceCode: boolean;
  urlErrorMessage: string | null;
}

function mapOAuthCallbackError(
  errorCode: string | null,
  errorDescription: string | null,
): string {
  const codeLower = (errorCode ?? '').toLowerCase();
  const descLower = (errorDescription ?? '').toLowerCase();

  if (codeLower === 'access_denied' || descLower.includes('access_denied')) {
    return 'Bạn đã hủy đăng nhập bằng Google.';
  }

  if (
    codeLower === 'bad_oauth_state' ||
    codeLower === 'bad_code_verifier' ||
    descLower.includes('code verifier') ||
    descLower.includes('oauth state')
  ) {
    return 'Phiên xác thực Google đã hết hạn hoặc không cùng tab khởi tạo. Vui lòng thử đăng nhập lại trên tab này.';
  }

  if (
    descLower.includes('unable to exchange external code') ||
    descLower.includes('invalid_client') ||
    descLower.includes('redirect_uri_mismatch')
  ) {
    return 'Cấu hình Google OAuth chưa khớp (Client Secret hoặc Redirect URI). Vui lòng kiểm tra lại Google Cloud Console và Supabase Dashboard.';
  }

  return normalizeAuthError({
    code: errorCode ?? undefined,
    message: errorDescription ?? errorCode ?? undefined,
  }).message;
}

function cleanAuthParamsFromUrl(options: { removeCode?: boolean } = {}): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) {
    return;
  }

  try {
    const url = new URL(window.location.href);
    const paramsToRemove = [
      'error',
      'error_code',
      'error_description',
      ...(options.removeCode ? ['code', 'state'] : []),
    ];

    let changed = false;
    for (const key of paramsToRemove) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (
      url.hash &&
      (url.hash.includes('error=') ||
        url.hash.includes('error_code=') ||
        url.hash.includes('error_description='))
    ) {
      url.hash = '';
      changed = true;
    }

    if (changed) {
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  } catch {
    // Bỏ qua an toàn nếu trình duyệt hạn chế history.replaceState
  }
}

function detectUrlAuthState(): UrlAuthState {
  if (typeof window === 'undefined') {
    return { isRecoveryUrl: false, hasPkceCode: false, urlErrorMessage: null };
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hashRaw = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hashRaw);

    const typeParam = searchParams.get('type') ?? hashParams.get('type');
    const hasPkceCode = Boolean(searchParams.get('code')?.trim());
    const errorCode =
      searchParams.get('error_code') ??
      hashParams.get('error_code') ??
      searchParams.get('error') ??
      hashParams.get('error');
    const errorDescription =
      searchParams.get('error_description') ?? hashParams.get('error_description');

    let urlErrorMessage: string | null = null;
    if (errorCode || errorDescription) {
      urlErrorMessage = mapOAuthCallbackError(errorCode, errorDescription);
      cleanAuthParamsFromUrl();
    }

    return {
      isRecoveryUrl: typeParam === 'recovery',
      hasPkceCode,
      urlErrorMessage,
    };
  } catch {
    return { isRecoveryUrl: false, hasPkceCode: false, urlErrorMessage: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(!isSupabaseConfigured);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Refs tránh race-condition khi đổi tài khoản và phân biệt đăng xuất chủ động với hết phiên.
  const hadAuthenticatedUserRef = useRef<boolean>(false);
  const isManualSignOutRef = useRef<boolean>(false);
  const profileRequestIdRef = useRef<number>(0);

  // 1. Khởi tạo phiên và lắng nghe sự kiện onAuthStateChange (chỉ đăng ký 1 lần khi mount)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsRecoveryMode(false);
      setIsLoading(false);
      setIsAuthReady(true);
      return;
    }

    let isMounted = true;
    let hasReceivedAuthEvent = false;
    const { isRecoveryUrl, hasPkceCode, urlErrorMessage } = detectUrlAuthState();

    if (isRecoveryUrl) {
      setIsRecoveryMode(true);
    }
    if (urlErrorMessage) {
      setAuthError(urlErrorMessage);
    }

    // Đăng ký listener TRƯỚC để không bỏ lỡ INITIAL_SESSION hoặc PASSWORD_RECOVERY.
    // Lưu ý: chỉ cập nhật state đồng bộ trong callback để tránh deadlock lock nội bộ của Supabase Auth v2.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      hasReceivedAuthEvent = true;
      const nextUser = nextSession?.user ?? null;

      setSession((prev) => {
        if (
          prev?.access_token === nextSession?.access_token &&
          prev?.refresh_token === nextSession?.refresh_token &&
          prev?.expires_at === nextSession?.expires_at
        ) {
          return prev;
        }
        return nextSession;
      });

      setUser((prev) => {
        if (
          prev?.id === nextUser?.id &&
          prev?.email === nextUser?.email &&
          prev?.updated_at === nextUser?.updated_at
        ) {
          return prev;
        }
        return nextUser;
      });

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setAuthError(null);
      } else if (event === 'SIGNED_IN') {
        hadAuthenticatedUserRef.current = true;
        isManualSignOutRef.current = false;
        setAuthError(null);
        cleanAuthParamsFromUrl({ removeCode: true });
      } else if (event === 'SIGNED_OUT') {
        const wasLoggedIn = hadAuthenticatedUserRef.current;
        const wasManual = isManualSignOutRef.current;

        hadAuthenticatedUserRef.current = false;
        isManualSignOutRef.current = false;
        profileRequestIdRef.current += 1;

        setProfile(null);
        setIsProfileLoading(false);
        setIsRecoveryMode(false);

        if (wasLoggedIn && !wasManual) {
          setAuthError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        } else {
          setAuthError(null);
        }
      } else if (event === 'USER_UPDATED') {
        setAuthError(null);
      } else if (event === 'INITIAL_SESSION') {
        if (nextUser) {
          hadAuthenticatedUserRef.current = true;
          if (hasPkceCode) {
            cleanAuthParamsFromUrl({ removeCode: true });
          }
        } else if (hasPkceCode && !urlErrorMessage) {
          // Có ?code=... PKCE trên URL nhưng sau khi khởi tạo vẫn không nhận được phiên
          setAuthError(
            'Không thể hoàn tất đăng nhập từ liên kết xác thực (mã PKCE đã hết hạn hoặc không cùng tab khởi tạo). Vui lòng thử lại.',
          );
          cleanAuthParamsFromUrl({ removeCode: true });
        }
      }

      setIsLoading(false);
      setIsAuthReady(true);
    });

    // Khôi phục phiên dự phòng khi tải lại trang (đảm bảo luôn kết thúc trạng thái loading ngay cả khi mất mạng).
    void (async () => {
      try {
        const result = await getCurrentSession();
        if (!isMounted) return;

        if (!hasReceivedAuthEvent) {
          if (result.ok) {
            const restoredSession = result.data ?? null;
            const restoredUser = restoredSession?.user ?? null;
            setSession(restoredSession);
            setUser(restoredUser);
            if (restoredUser) {
              hadAuthenticatedUserRef.current = true;
              if (hasPkceCode) {
                cleanAuthParamsFromUrl({ removeCode: true });
              }
            } else if (hasPkceCode && !urlErrorMessage) {
              setAuthError(
                'Không thể hoàn tất đăng nhập từ liên kết xác thực (mã PKCE đã hết hạn hoặc không cùng tab khởi tạo). Vui lòng thử lại.',
              );
              cleanAuthParamsFromUrl({ removeCode: true });
            }
          } else if (result.error) {
            setAuthError(result.error.message);
          }
          setIsLoading(false);
          setIsAuthReady(true);
        }
      } catch (err) {
        if (!isMounted) return;
        const normalized = normalizeAuthError(err);
        setAuthError(normalized.message);
        setIsLoading(false);
        setIsAuthReady(true);
      }
    })();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Tự động đồng bộ hồ sơ từ public.profiles theo user.id (tách khỏi onAuthStateChange để tránh deadlock & vòng lặp)
  const activeUserId = user?.id ?? null;

  useEffect(() => {
    if (!isSupabaseConfigured || !user || !activeUserId) {
      profileRequestIdRef.current += 1;
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    let isMounted = true;
    const currentRequestId = ++profileRequestIdRef.current;
    setIsProfileLoading(true);

    void (async () => {
      const result = await ensureUserProfile(user);
      if (!isMounted || currentRequestId !== profileRequestIdRef.current) {
        return;
      }

      if (result.ok && result.data) {
        setProfile(result.data);
      } else if (result.error) {
        // Không xóa phiên khi mất mạng tạm thời; chỉ ghi nhận lỗi hồ sơ an toàn.
        setAuthError(result.error.message);
      }
      setIsProfileLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [activeUserId, user]);

  // 3. Các hành động xác thực ủy quyền trực tiếp cho authService (không trùng lặp logic Bước 2)
  const signUp = useCallback(async (input: SignUpInput) => {
    setAuthError(null);
    return signUpWithEmail(input);
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    setAuthError(null);
    return signInWithEmail(input);
  }, []);

  const signInWithGoogle = useCallback(async (options?: GoogleOAuthOptions) => {
    setAuthError(null);
    return signInWithGoogleService(options);
  }, []);

  const signOut = useCallback(async () => {
    isManualSignOutRef.current = true;
    setAuthError(null);

    const result = await signOutService();
    if (result.ok) {
      profileRequestIdRef.current += 1;
      hadAuthenticatedUserRef.current = false;
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsRecoveryMode(false);
    } else {
      isManualSignOutRef.current = false;
    }
    return result;
  }, []);

  const sendPasswordReset = useCallback(
    async (email: string, redirectTo?: string) => {
      setAuthError(null);
      return sendPasswordResetEmail(email, redirectTo);
    },
    [],
  );

  const updatePassword = useCallback(async (newPassword: string) => {
    setAuthError(null);
    const result = await updatePasswordService(newPassword);
    if (result.ok) {
      setIsRecoveryMode(false);
    }
    return result;
  }, []);

  const resendVerification = useCallback(
    async (email: string, emailRedirectTo?: string) => {
      setAuthError(null);
      return resendVerificationEmail(email, emailRedirectTo);
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return null;
    }

    const currentRequestId = ++profileRequestIdRef.current;
    setIsProfileLoading(true);

    const result = await ensureUserProfile(user);
    if (currentRequestId === profileRequestIdRef.current) {
      if (result.ok && result.data) {
        setProfile(result.data);
      } else if (result.error) {
        setAuthError(result.error.message);
      }
      setIsProfileLoading(false);
    }
    return result;
  }, [user]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput): Promise<AuthResult<UserProfile>> => {
      if (!user) {
        return {
          ok: false,
          data: null,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Bạn cần đăng nhập để cập nhật hồ sơ.',
          },
          message: 'Bạn cần đăng nhập để cập nhật hồ sơ.',
        };
      }

      const result = await updateUserProfile(user.id, input);
      if (result.ok && result.data) {
        setProfile(result.data);
      }
      return result;
    },
    [user],
  );

  const clearRecoveryMode = useCallback(() => {
    setIsRecoveryMode(false);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      userId: user?.id ?? null,
      isAuthenticated: Boolean(user && session),
      isAdmin: Boolean(user && session && profile?.role === 'admin'),
      isConfigured: isSupabaseConfigured,
      isLoading,
      isAuthReady,
      isProfileLoading,
      isRecoveryMode,
      authError,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      sendPasswordReset,
      updatePassword,
      resendVerification,
      refreshProfile,
      updateProfile,
      clearRecoveryMode,
      clearAuthError,
    }),
    [
      user,
      session,
      profile,
      isLoading,
      isAuthReady,
      isProfileLoading,
      isRecoveryMode,
      authError,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      sendPasswordReset,
      updatePassword,
      resendVerification,
      refreshProfile,
      updateProfile,
      clearRecoveryMode,
      clearAuthError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  }
  return context;
}
