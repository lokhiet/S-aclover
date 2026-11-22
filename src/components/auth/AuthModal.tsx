import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  RefreshCw,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  checkGoogleOAuthStatus,
  type GoogleOAuthStatus,
} from '../../lib/supabase';
import {
  getDefaultAuthRedirectUrl,
  isRunningInIframe,
} from '../../services/authService';
import type { AuthModalMode } from '../../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthModalMode;
  onModeChange: (mode: AuthModalMode) => void;
  onClose: () => void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_DISPLAY_NAME_LENGTH = 80;
const RESEND_COOLDOWN_SECONDS = 60;

const GoogleBrandIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

export default function AuthModal({
  isOpen,
  mode,
  onModeChange,
  onClose,
  onToast,
}: AuthModalProps) {
  const {
    isConfigured,
    isRecoveryMode,
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    updatePassword,
    resendVerification,
    clearRecoveryMode,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showResendPrompt, setShowResendPrompt] = useState(false);

  const [googleStatus, setGoogleStatus] = useState<GoogleOAuthStatus>({
    ready: false,
    checked: false,
    reason: isConfigured ? 'network_error' : 'not_configured',
    message: isConfigured
      ? 'Đang kiểm tra trạng thái đăng nhập Google...'
      : 'Chưa cấu hình biến môi trường Supabase.',
  });
  const [showIframeGoogleGuide, setShowIframeGoogleGuide] = useState(false);

  const isEmbeddedIframe = isRunningInIframe();
  const currentAppUrl = getDefaultAuthRedirectUrl() ?? '';

  // Xóa thông báo lỗi/tạm khi chuyển chế độ hoặc mở/đóng modal
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setShowResendPrompt(false);
    setShowIframeGoogleGuide(false);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [isOpen, mode]);

  // Kiểm tra trạng thái sẵn sàng của Google OAuth trên Supabase khi mở modal đăng nhập/đăng ký
  useEffect(() => {
    if (!isOpen || (mode !== 'login' && mode !== 'register')) return;

    let isMounted = true;
    setGoogleStatus((prev) => ({ ...prev, checked: false }));

    void (async () => {
      const status = await checkGoogleOAuthStatus();
      if (!isMounted) return;
      setGoogleStatus(status);
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, isConfigured]);

  // Đếm ngược cooldown gửi lại email xác minh
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  // Đếm ngược cooldown gửi email quên mật khẩu
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  // Đóng bằng phím Escape khi không đang gửi yêu cầu
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting && !isGoogleLoading) {
        if (isRecoveryMode) {
          clearRecoveryMode();
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isSubmitting,
    isGoogleLoading,
    isRecoveryMode,
    clearRecoveryMode,
    onClose,
  ]);

  if (!isOpen) return null;

  const isBusy = isSubmitting || isGoogleLoading;

  const handleClose = () => {
    if (isBusy) return;
    if (isRecoveryMode) {
      clearRecoveryMode();
    }
    onClose();
  };

  const handleCopyAppUrl = async () => {
    if (!currentAppUrl) return;
    try {
      await navigator.clipboard.writeText(currentAppUrl);
      onToast('Đã sao chép liên kết ứng dụng! Hãy mở ở tab mới.', 'success');
    } catch {
      onToast('Không thể sao chép tự động trên trình duyệt này.', 'error');
    }
  };

  const handleGoogleSignIn = async () => {
    if (isBusy || !isConfigured) return;

    setErrorMessage(null);
    setInfoMessage(null);
    setShowResendPrompt(false);

    // Xác minh lại trạng thái sẵn sàng của Google OAuth (không giả lập thành công nếu chưa cấu hình)
    let currentStatus = googleStatus;
    if (!currentStatus.checked) {
      setIsGoogleLoading(true);
      currentStatus = await checkGoogleOAuthStatus();
      setGoogleStatus(currentStatus);
      setIsGoogleLoading(false);
    }

    if (!currentStatus.ready) {
      setErrorMessage(currentStatus.message);
      return;
    }

    // Trong môi trường AI Studio Preview (iframe), Google chặn tải accounts.google.com trong iframe
    // và trình duyệt cô lập bộ nhớ PKCE giữa iframe với tab độc lập -> không ép OAuth trong iframe.
    if (isEmbeddedIframe) {
      setShowIframeGoogleGuide(true);
      return;
    }

    setIsGoogleLoading(true);
    try {
      const redirectTo = getDefaultAuthRedirectUrl();
      const result = await signInWithGoogle({ redirectTo });

      if (!result.ok) {
        setErrorMessage(
          result.error?.message ||
            'Không thể khởi tạo đăng nhập Google. Vui lòng thử lại.',
        );
        return;
      }

      if (result.data?.isEmbeddedIframe && !result.data.redirected) {
        setShowIframeGoogleGuide(true);
        return;
      }

      setInfoMessage('Đang chuyển hướng sang trang đăng nhập Google...');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleResendVerification = async (targetEmail: string) => {
    if (isResending || resendCooldown > 0) return;
    const normalized = targetEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setErrorMessage('Vui lòng nhập đúng địa chỉ email để gửi lại thư xác minh.');
      return;
    }

    setIsResending(true);
    setErrorMessage(null);
    try {
      const result = await resendVerification(normalized);
      if (result.ok) {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        const msg =
          result.message ||
          'Đã gửi lại email xác minh. Vui lòng kiểm tra hộp thư đến và mục Spam.';
        setInfoMessage(msg);
        onToast(msg, 'success');
      } else {
        setErrorMessage(
          result.error?.message || 'Không thể gửi lại email xác minh lúc này.',
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy || !isConfigured) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    setShowResendPrompt(false);

    try {
      const result = await signIn({ email: trimmedEmail, password });
      if (result.ok) {
        onToast('Đăng nhập thành công! 🍀', 'success');
        onClose();
      } else {
        setErrorMessage(
          result.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.',
        );
        if (result.error?.code === 'EMAIL_NOT_CONFIRMED') {
          setPendingVerifyEmail(trimmedEmail);
          setShowResendPrompt(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy || !isConfigured) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
      setErrorMessage(
        `Tên hiển thị không được vượt quá ${MAX_DISPLAY_NAME_LENGTH} ký tự.`,
      );
      return;
    }
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await signUp({
        email: trimmedEmail,
        password,
        displayName: trimmedName || undefined,
      });

      if (result.ok && result.data) {
        if (result.data.needsEmailVerification) {
          setPendingVerifyEmail(trimmedEmail);
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
          onToast('Đã gửi email xác minh tài khoản! 🍀', 'success');
          onModeChange('verify-email');
        } else {
          onToast('Đăng ký và đăng nhập thành công! 🍀', 'success');
          onClose();
        }
      } else {
        setErrorMessage(
          result.error?.message || 'Đăng ký thất bại. Vui lòng thử lại.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy || !isConfigured || resetCooldown > 0) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await sendPasswordReset(trimmedEmail);
      if (result.ok) {
        setResetCooldown(RESEND_COOLDOWN_SECONDS);
        const msg =
          result.message ||
          'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi.';
        setInfoMessage(msg);
        onToast('Đã gửi yêu cầu khôi phục mật khẩu.', 'info');
      } else {
        setErrorMessage(
          result.error?.message ||
            'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy || !isConfigured) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await updatePassword(password);
      if (result.ok) {
        onToast('Cập nhật mật khẩu thành công! 🍀', 'success');
        onClose();
      } else {
        setErrorMessage(
          result.error?.message ||
            'Không thể cập nhật mật khẩu. Vui lòng thử lại.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getHeaderMeta = () => {
    switch (mode) {
      case 'register':
        return {
          title: 'Tạo tài khoản SéaClover',
          subtitle: 'Đăng ký miễn phí bằng email hoặc Google',
        };
      case 'forgot-password':
        return {
          title: 'Quên mật khẩu',
          subtitle: 'Nhận liên kết đặt lại mật khẩu qua email',
        };
      case 'reset-password':
        return {
          title: isRecoveryMode ? 'Đặt lại mật khẩu mới' : 'Đổi mật khẩu',
          subtitle: 'Nhập mật khẩu mới tối thiểu 6 ký tự',
        };
      case 'verify-email':
        return {
          title: 'Xác minh địa chỉ email',
          subtitle: 'Hoàn tất kích hoạt tài khoản của bạn',
        };
      case 'login':
      default:
        return {
          title: 'Đăng nhập SéaClover',
          subtitle: 'Sử dụng tài khoản email hoặc Google',
        };
    }
  };

  const headerMeta = getHeaderMeta();

  const renderGoogleOAuthSection = () => {
    const isGoogleDisabled =
      isBusy ||
      !isConfigured ||
      (googleStatus.checked && !googleStatus.ready);

    return (
      <div className="space-y-3 pt-1">
        <div className="relative flex items-center">
          <div className="flex-1 border-t border-slate-200 dark:border-zinc-800" />
          <span className="px-3 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
            hoặc
          </span>
          <div className="flex-1 border-t border-slate-200 dark:border-zinc-800" />
        </div>

        <button
          type="button"
          disabled={isGoogleDisabled}
          onClick={handleGoogleSignIn}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/60 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-slate-700 dark:text-zinc-100 text-xs font-bold flex items-center justify-center gap-2.5 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isGoogleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
          ) : (
            <GoogleBrandIcon className="w-4 h-4 flex-shrink-0" />
          )}
          <span>
            {isGoogleLoading
              ? 'Đang kết nối Google...'
              : 'Tiếp tục với Google'}
          </span>
          {googleStatus.checked && !googleStatus.ready && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
              Chưa sẵn sàng
            </span>
          )}
        </button>

        {/* Thông báo rõ ràng khi Google OAuth chưa được kích hoạt trên Supabase / Google Cloud */}
        {isConfigured && googleStatus.checked && !googleStatus.ready && (
          <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2 leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{googleStatus.message}</span>
          </div>
        )}

        {/* Hướng dẫn mở tab độc lập khi chạy trong khung Preview iframe của AI Studio */}
        {showIframeGoogleGuide && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-emerald-200 dark:border-emerald-900/50 text-xs text-slate-700 dark:text-zinc-300 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Ứng dụng đang chạy trong khung xem trước (iframe). Google chặn
                đăng nhập OAuth bên trong iframe — hãy mở ứng dụng ở{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  tab trình duyệt riêng
                </strong>{' '}
                rồi chọn <strong>Tiếp tục với Google</strong> để xác thực PKCE
                an toàn.
              </p>
            </div>

            {currentAppUrl && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={currentAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[150px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở ứng dụng ở tab mới
                </a>
                <button
                  type="button"
                  onClick={handleCopyAppUrl}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Sao chép URL
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 dark:bg-zinc-950/80 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-emerald-100 dark:border-zinc-800 w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl relative z-10 animate-fade-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-emerald-50/40 dark:bg-zinc-950/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-lg shadow-sm shadow-emerald-500/20 flex-shrink-0">
              🍀
            </div>
            <div className="min-w-0">
              <h3
                id="auth-modal-title"
                className="text-sm font-extrabold text-emerald-950 dark:text-zinc-100 truncate"
              >
                {headerMeta.title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {headerMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            aria-label="Đóng hộp thoại tài khoản"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 bg-white dark:bg-zinc-950 transition disabled:opacity-50 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs for Login / Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="px-5 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onModeChange('login')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition ${
                  mode === 'login'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onModeChange('register')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition ${
                  mode === 'register'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Đăng ký
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!isConfigured && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Chưa cấu hình kết nối Supabase</p>
                <p className="mt-0.5 opacity-90">
                  Vui lòng cấu hình biến môi trường Supabase để sử dụng tài khoản.
                  Bạn vẫn có thể dùng toàn bộ ứng dụng bình thường ở chế độ khách.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>

              {showResendPrompt && (
                <button
                  type="button"
                  disabled={isResending || resendCooldown > 0}
                  onClick={() =>
                    handleResendVerification(pendingVerifyEmail || email)
                  }
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300 hover:bg-red-100/60 dark:hover:bg-red-950/50 text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                >
                  {isResending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {resendCooldown > 0
                    ? `Gửi lại email xác minh (${resendCooldown}s)`
                    : 'Gửi lại email xác minh'}
                </button>
              )}
            </div>
          )}

          {infoMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{infoMessage}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-login-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-login-email"
                    type="email"
                    autoComplete="email"
                    disabled={isBusy || !isConfigured}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="auth-login-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onModeChange('forgot-password')}
                    className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    disabled={isBusy || !isConfigured}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusy || !isConfigured}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>

              {renderGoogleOAuthSection()}

              <p className="text-[11px] text-center text-slate-500 dark:text-zinc-400 pt-1">
                Dữ liệu cục bộ trên trình duyệt của bạn không bị thay đổi khi đăng
                nhập hay đăng xuất.
              </p>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form
              onSubmit={handleRegisterSubmit}
              className="space-y-3.5"
              noValidate
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-register-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Tên hiển thị{' '}
                  <span className="text-slate-400 dark:text-zinc-500 font-normal">
                    (không bắt buộc)
                  </span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-register-name"
                    type="text"
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    autoComplete="name"
                    disabled={isBusy || !isConfigured}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ví dụ: Nhi Séa"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-register-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-register-email"
                    type="email"
                    autoComplete="email"
                    disabled={isBusy || !isConfigured}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-register-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isBusy || !isConfigured}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-register-confirm"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-register-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isBusy || !isConfigured}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword
                        ? 'Ẩn mật khẩu xác nhận'
                        : 'Hiện mật khẩu xác nhận'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusy || !isConfigured}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
              </button>

              {renderGoogleOAuthSection()}
            </form>
          )}

          {/* VERIFY EMAIL VIEW */}
          {mode === 'verify-email' && (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <MailCheck className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  Kiểm tra hộp thư của bạn
                </h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Chúng tôi đã gửi liên kết xác minh tới{' '}
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 break-all">
                    {pendingVerifyEmail || email}
                  </span>
                  . Hãy nhấn vào liên kết trong email (kiểm tra cả mục Thư rác /
                  Spam) để kích hoạt tài khoản.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isResending || resendCooldown > 0 || !isConfigured}
                  onClick={() =>
                    handleResendVerification(pendingVerifyEmail || email)
                  }
                  className="w-full py-2.5 px-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {isResending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {resendCooldown > 0
                    ? `Gửi lại email xác minh (${resendCooldown}s)`
                    : 'Gửi lại email xác minh'}
                </button>

                <button
                  type="button"
                  onClick={() => onModeChange('login')}
                  className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Quay lại đăng nhập
                </button>
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot-password' && (
            <form
              onSubmit={handleForgotPasswordSubmit}
              className="space-y-3.5"
              noValidate
            >
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Nhập email đã đăng ký. Hệ thống sẽ gửi liên kết để bạn đặt lại
                mật khẩu mới.
              </p>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-forgot-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Email tài khoản
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-forgot-email"
                    type="email"
                    autoComplete="email"
                    disabled={isBusy || !isConfigured}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusy || !isConfigured || resetCooldown > 0}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting
                  ? 'Đang gửi yêu cầu...'
                  : resetCooldown > 0
                    ? `Gửi lại sau ${resetCooldown}s`
                    : 'Gửi liên kết đặt lại mật khẩu'}
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => onModeChange('login')}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Quay lại đăng nhập
              </button>
            </form>
          )}

          {/* RESET / UPDATE PASSWORD FORM */}
          {mode === 'reset-password' && (
            <form
              onSubmit={handleResetPasswordSubmit}
              className="space-y-3.5"
              noValidate
            >
              <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs text-slate-600 dark:text-zinc-300 flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  {isRecoveryMode
                    ? 'Liên kết khôi phục hợp lệ. Hãy nhập mật khẩu mới cho tài khoản của bạn.'
                    : 'Nhập mật khẩu mới bạn muốn sử dụng cho tài khoản đang đăng nhập.'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-reset-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-reset-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isBusy || !isConfigured}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-reset-confirm"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-reset-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isBusy || !isConfigured}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword
                        ? 'Ẩn mật khẩu xác nhận'
                        : 'Hiện mật khẩu xác nhận'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusy || !isConfigured}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
