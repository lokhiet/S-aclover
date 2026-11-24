import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDefaultAuthRedirectUrl } from '../../services/authService';
import type { AuthModalMode } from '../../types/auth';
import {
  checkSignupRateLimit,
  getRemainingCooldownSeconds,
  RESET_COOLDOWN_KEY,
  RESET_COOLDOWN_SECONDS,
  setCooldownSeconds,
  validateEmailFormat,
  validatePassword,
} from '../../utils/authValidation';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthModalMode;
  onModeChange: (mode: AuthModalMode) => void;
  onClose: () => void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

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
    signOut,
    sendPasswordReset,
    updatePassword,
    clearRecoveryMode,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const pendingPostResetNoticeRef = useRef<string | null>(null);

  // Làm mới trạng thái form khi mở hoặc đổi chế độ (giữ lại thông báo vừa đặt lại mật khẩu nếu có)
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    if (pendingPostResetNoticeRef.current) {
      setInfoMessage(pendingPostResetNoticeRef.current);
      pendingPostResetNoticeRef.current = null;
    } else {
      setInfoMessage(null);
    }
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);

    const signupWait = checkSignupRateLimit().waitSeconds;
    setSignupCooldown(signupWait);
    setResetCooldown(getRemainingCooldownSeconds(RESET_COOLDOWN_KEY));
  }, [isOpen, mode]);

  // Đếm ngược cooldown đăng ký chống spam
  useEffect(() => {
    if (signupCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setSignupCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [signupCooldown]);

  // Đếm ngược cooldown gửi email quên mật khẩu
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  // Đóng bằng phím Escape khi không đang xử lý
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        if (isRecoveryMode) {
          clearRecoveryMode();
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isRecoveryMode, clearRecoveryMode, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    if (isRecoveryMode) {
      clearRecoveryMode();
    }
    onClose();
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !isConfigured) return;

    const emailError = validateEmailFormat(email);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await signIn({
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.ok) {
        onToast('Đăng nhập thành công! 🍀', 'success');
        onClose();
      } else {
        setErrorMessage(
          result.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !isConfigured) return;

    const rateCheck = checkSignupRateLimit();
    if (!rateCheck.allowed) {
      setSignupCooldown(rateCheck.waitSeconds);
      setErrorMessage(
        rateCheck.message ||
          `Vui lòng chờ ${rateCheck.waitSeconds} giây trước khi đăng ký tiếp.`,
      );
      return;
    }

    const emailError = validateEmailFormat(email);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu nhập lại không khớp.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      const nextWait = checkSignupRateLimit().waitSeconds;
      if (nextWait > 0) {
        setSignupCooldown(nextWait);
      }

      if (result.ok && result.data?.autoSignedIn) {
        onToast('Đăng ký và đăng nhập thành công! 🍀', 'success');
        onClose();
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
    if (isSubmitting || !isConfigured || resetCooldown > 0) return;

    const emailError = validateEmailFormat(email);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const redirectTo = getDefaultAuthRedirectUrl();
      const result = await sendPasswordReset(
        email.trim().toLowerCase(),
        redirectTo,
      );
      if (result.ok) {
        setCooldownSeconds(RESET_COOLDOWN_KEY, RESET_COOLDOWN_SECONDS);
        setResetCooldown(RESET_COOLDOWN_SECONDS);
        const msg =
          result.message ||
          'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư (kể cả mục Spam).';
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
    if (isSubmitting || !isConfigured) return;

    const passwordError = validatePassword(password, 'Mật khẩu mới');
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu nhập lại không khớp.');
      return;
    }

    const wasRecovery = isRecoveryMode;

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await updatePassword(password);
      if (result.ok) {
        if (wasRecovery) {
          const recoveredEmail = result.data?.email ?? '';
          await signOut();
          if (recoveredEmail) {
            setEmail(recoveredEmail);
          }
          pendingPostResetNoticeRef.current =
            'Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.';
          onToast('Đặt lại mật khẩu thành công! 🍀', 'success');
          onModeChange('login');
        } else {
          onToast('Cập nhật mật khẩu thành công! 🍀', 'success');
          onClose();
        }
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
          title: 'Đăng ký tài khoản SéaClover',
          subtitle: 'Tạo tài khoản nhanh bằng email và mật khẩu',
        };
      case 'forgot-password':
        return {
          title: 'Quên mật khẩu',
          subtitle: 'Nhận liên kết đặt lại mật khẩu qua email',
        };
      case 'reset-password':
        return {
          title: isRecoveryMode ? 'Đặt lại mật khẩu mới' : 'Đổi mật khẩu',
          subtitle: 'Mật khẩu tối thiểu 6 ký tự',
        };
      case 'login':
      default:
        return {
          title: 'Đăng nhập SéaClover',
          subtitle: 'Sử dụng email và mật khẩu của bạn',
        };
    }
  };

  const headerMeta = getHeaderMeta();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#14221B]/55 dark:bg-[#141716]/75 backdrop-blur-[2px] transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="bg-[#FFF9EA] dark:bg-[#292E2B] rounded-lg border border-[#9FC4AF] dark:border-[#49554D] w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden shadow-lg dark:shadow-none relative z-10 animate-fade-in">
        {/* Header */}
        <div className="retro-titlebar px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md overflow-hidden bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] flex-shrink-0 p-0.5">
              <img
                src="/app-icon.jpg"
                alt="SéaClover"
                className="w-full h-full object-cover rounded-[3px]"
              />
            </div>
            <div className="min-w-0">
              <h3
                id="auth-modal-title"
                className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] truncate"
              >
                {headerMeta.title}
              </h3>
              <p className="text-[11px] text-[#527062] dark:text-[#B8BDB5] truncate">
                {headerMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Đóng hộp thoại tài khoản"
            className="retro-btn p-1.5 text-[#39755D] dark:text-[#A3BDA8] disabled:opacity-50 flex-shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs for Login / Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="px-5 pt-4">
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-md bg-[#E2F3E8]/70 dark:bg-[#202423] border border-[#B8D7C5] dark:border-[#49554D]">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onModeChange('login')}
                className={`py-1.5 px-3 rounded text-xs font-bold transition cursor-pointer ${
                  mode === 'login'
                    ? 'retro-btn-primary'
                    : 'text-[#4E6E60] dark:text-[#B8BDB5] hover:text-[#20372D] dark:hover:text-[#E4E1D8]'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onModeChange('register')}
                className={`py-1.5 px-3 rounded text-xs font-bold transition cursor-pointer ${
                  mode === 'register'
                    ? 'retro-btn-primary'
                    : 'text-[#4E6E60] dark:text-[#B8BDB5] hover:text-[#20372D] dark:hover:text-[#E4E1D8]'
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
            <div className="retro-callout-warm p-3 text-[#6E5120] dark:text-[#D5B97A] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Chưa cấu hình kết nối Supabase</p>
                <p className="mt-0.5 opacity-90">
                  Vui lòng cấu hình biến môi trường Supabase để sử dụng tài khoản.
                  Bạn vẫn có thể xem nội dung công khai và bình luận ẩn danh ở chế độ khách.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-md bg-[#FBECEE] dark:bg-[#292E2B] border border-[#E5B8BF] dark:border-[#6B4A4D] text-[#8E3240] dark:text-[#E4A6AA] text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div className="retro-callout-mint p-3 text-[#224C3B] dark:text-[#A3BDA8] text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{infoMessage}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-login-email"
                  className="block text-xs font-semibold text-[#294B3D] dark:text-[#E4E1D8]"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5B7A6C] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-login-email"
                    type="email"
                    autoComplete="email"
                    disabled={isSubmitting || !isConfigured}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="retro-input w-full pl-9 pr-3.5 py-2 text-xs disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="auth-login-password"
                    className="block text-xs font-semibold text-[#294B3D] dark:text-[#E4E1D8]"
                  >
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onModeChange('forgot-password')}
                    className="text-[11px] font-semibold text-[#39755D] dark:text-[#A3BDA8] hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5B7A6C] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    disabled={isSubmitting || !isConfigured}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="retro-input w-full pl-9 pr-10 py-2 text-xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5B7A6C] hover:text-[#224C3B] dark:text-[#B8BDB5] dark:hover:text-[#E4E1D8] transition cursor-pointer"
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
                disabled={isSubmitting || !isConfigured}
                className="retro-btn-primary w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>

              <div className="pt-1 text-center text-xs text-[#4C6A5C] dark:text-[#B8BDB5]">
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onModeChange('register')}
                  className="font-bold text-[#2B5A47] dark:text-[#A3BDA8] hover:underline cursor-pointer"
                >
                  Đăng ký tài khoản
                </button>
              </div>

              <p className="text-[11px] text-center text-[#5B7A6C] dark:text-[#B8BDB5] leading-relaxed">
                Từng dùng Google ở phiên bản trước? Chọn{' '}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onModeChange('forgot-password')}
                  className="font-semibold text-[#39755D] dark:text-[#A3BDA8] hover:underline cursor-pointer"
                >
                  Quên mật khẩu?
                </button>{' '}
                để đặt mật khẩu cho email cũ và giữ nguyên dữ liệu.
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
                  htmlFor="auth-register-email"
                  className="block text-xs font-semibold text-[#294B3D] dark:text-[#E4E1D8]"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5B7A6C] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-register-email"
                    type="email"
                    autoComplete="email"
                    disabled={isSubmitting || !isConfigured}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="retro-input w-full pl-9 pr-3.5 py-2 text-xs disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-register-password"
                  className="block text-xs font-semibold text-[#294B3D] dark:text-[#E4E1D8]"
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5B7A6C] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isSubmitting || !isConfigured}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mật khẩu tối thiểu 6 ký tự"
                    className="retro-input w-full pl-9 pr-10 py-2 text-xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5B7A6C] hover:text-[#224C3B] dark:text-[#B8BDB5] dark:hover:text-[#E4E1D8] transition cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-[#5B7A6C] dark:text-[#B8BDB5]">
                  Mật khẩu tối thiểu 6 ký tự
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-register-confirm"
                  className="block text-xs font-semibold text-[#294B3D] dark:text-[#E4E1D8]"
                >
                  Nhập lại mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5B7A6C] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-register-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isSubmitting || !isConfigured}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    className="retro-input w-full pl-9 pr-10 py-2 text-xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword
                        ? 'Ẩn mật khẩu nhập lại'
                        : 'Hiện mật khẩu nhập lại'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5B7A6C] hover:text-[#224C3B] dark:text-[#B8BDB5] dark:hover:text-[#E4E1D8] transition cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="retro-callout-warm px-3 py-2 text-[11px] text-[#594B2B] dark:text-[#D5B97A] flex items-start gap-2 leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#8A6D2F] dark:text-[#D5B97A]" />
                <span>
                  Vui lòng sử dụng email chính xác để có thể khôi phục mật khẩu khi cần.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isConfigured || signupCooldown > 0}
                className="retro-btn-primary w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting
                  ? 'Đang tạo tài khoản...'
                  : signupCooldown > 0
                    ? `Vui lòng chờ (${signupCooldown}s)`
                    : 'Đăng ký'}
              </button>

              <div className="pt-1 text-center text-xs text-[#4C6A5C] dark:text-[#B8BDB5]">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onModeChange('login')}
                  className="font-bold text-[#2B5A47] dark:text-[#A3BDA8] hover:underline cursor-pointer"
                >
                  Đăng nhập
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot-password' && (
            <form
              onSubmit={handleForgotPasswordSubmit}
              className="space-y-3.5"
              noValidate
            >
              <p className="text-xs text-[#4C6A5C] dark:text-[#B8BDB5] leading-relaxed">
                Nhập email đã đăng ký. Hệ thống sẽ gửi liên kết để bạn đặt lại
                mật khẩu mới.
              </p>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-forgot-email"
                  className="block text-xs font-semibold text-[#294B3D] dark:text-[#E4E1D8]"
                >
                  Email tài khoản
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5B7A6C] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-forgot-email"
                    type="email"
                    autoComplete="email"
                    disabled={isSubmitting || !isConfigured}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="retro-input w-full pl-9 pr-3.5 py-2 text-xs disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="retro-callout-mint px-3 py-2 text-[11px] text-[#2B463A] dark:text-[#B8BDB5] leading-relaxed">
                Tài khoản từng đăng nhập bằng Google trước đây vẫn được bảo toàn ID và dữ liệu — chỉ cần nhập đúng email đó tại đây để tạo mật khẩu mới.
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isConfigured || resetCooldown > 0}
                className="retro-btn-primary w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
                disabled={isSubmitting}
                onClick={() => onModeChange('login')}
                className="retro-btn w-full py-2 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
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
              <div className="retro-callout-mint p-3 text-xs text-[#2B463A] dark:text-[#E4E1D8] flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0 mt-0.5" />
                <span>
                  {isRecoveryMode
                    ? 'Liên kết khôi phục hợp lệ. Hãy nhập mật khẩu mới cho tài khoản của bạn.'
                    : 'Nhập mật khẩu mới bạn muốn sử dụng cho tài khoản đang đăng nhập.'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-reset-password"
                  className="block text-xs font-semibold text-[#294B3D] dark:text-[#E4E1D8]"
                >
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5B7A6C] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-reset-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isSubmitting || !isConfigured}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mật khẩu tối thiểu 6 ký tự"
                    className="retro-input w-full pl-9 pr-10 py-2 text-xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5B7A6C] hover:text-[#224C3B] dark:text-[#B8BDB5] dark:hover:text-[#E4E1D8] transition cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-[#5B7A6C] dark:text-[#B8BDB5]">
                  Mật khẩu tối thiểu 6 ký tự
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="auth-reset-confirm"
                  className="block text-xs font-semibold text-[#294B3D] dark:text-[#E4E1D8]"
                >
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5B7A6C] dark:text-[#B8BDB5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-reset-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isSubmitting || !isConfigured}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="retro-input w-full pl-9 pr-10 py-2 text-xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword
                        ? 'Ẩn mật khẩu xác nhận'
                        : 'Hiện mật khẩu xác nhận'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5B7A6C] hover:text-[#224C3B] dark:text-[#B8BDB5] dark:hover:text-[#E4E1D8] transition cursor-pointer"
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
                disabled={isSubmitting || !isConfigured}
                className="retro-btn-primary w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
