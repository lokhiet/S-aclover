import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  MailWarning,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSafeHttpsUrl } from '../../services/authService';
import type { AuthModalMode } from '../../types/auth';

interface AccountButtonProps {
  onOpenAuth: (mode: AuthModalMode) => void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  compact?: boolean;
}

export default function AccountButton({
  onOpenAuth,
  onToast,
  compact = false,
}: AccountButtonProps) {
  const {
    user,
    profile,
    isAuthenticated,
    isLoading,
    isAuthReady,
    signOut,
  } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const safeAvatarUrl =
    !avatarFailed && profile?.avatar_url && isSafeHttpsUrl(profile.avatar_url)
      ? profile.avatar_url
      : null;

  useEffect(() => {
    setAvatarFailed(false);
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsMenuOpen(false);
    }
  }, [isAuthenticated]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const result = await signOut();
      setIsMenuOpen(false);
      if (result.ok) {
        onToast(
          'Đã đăng xuất an toàn. Dữ liệu cục bộ vẫn được giữ nguyên.',
          'info',
        );
      } else {
        onToast(
          result.error?.message || 'Không thể đăng xuất. Vui lòng thử lại.',
          'error',
        );
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading && !isAuthReady) {
    return (
      <div
        className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 text-xs select-none"
        aria-label="Đang kiểm tra phiên đăng nhập"
      >
        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
        {!compact && <span className="hidden lg:inline">Tài khoản</span>}
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        onClick={() => onOpenAuth('login')}
        title="Đăng nhập hoặc đăng ký tài khoản SéaClover"
        className={`rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/45 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
        }`}
      >
        <LogIn className="w-4 h-4 flex-shrink-0" />
        <span className={compact ? 'inline' : 'hidden sm:inline'}>Đăng nhập</span>
      </button>
    );
  }

  const displayName =
    profile?.display_name?.trim() ||
    (user.email ? user.email.split('@')[0] : 'Tài khoản');
  const initial = displayName.charAt(0).toUpperCase() || 'S';
  const isEmailVerified = Boolean(user.email_confirmed_at);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        title={`Tài khoản: ${displayName}`}
        className={`rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
          compact ? 'px-2 py-1.5' : 'px-2.5 py-1.5'
        }`}
      >
        {safeAvatarUrl ? (
          <img
            src={safeAvatarUrl}
            alt={displayName}
            onError={() => setAvatarFailed(true)}
            className="w-5 h-5 rounded-lg object-cover border border-emerald-200 dark:border-emerald-800 flex-shrink-0"
          />
        ) : (
          <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
            {initial}
          </span>
        )}
        <span
          className="max-w-[90px] truncate text-emerald-800 dark:text-emerald-300 hidden sm:inline"
        >
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 transition-transform ${
            isMenuOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl shadow-slate-900/10 dark:shadow-black/30 overflow-hidden z-50 animate-fade-in"
        >
          {/* Active account summary */}
          <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40">
            <div className="flex items-center gap-2.5">
              {safeAvatarUrl ? (
                <img
                  src={safeAvatarUrl}
                  alt={displayName}
                  onError={() => setAvatarFailed(true)}
                  className="w-9 h-9 rounded-xl object-cover border border-emerald-200 dark:border-emerald-800 flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-600/20">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">
                  {displayName}
                </p>
                {user.email && (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold">
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Email đã xác minh
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <MailWarning className="w-3 h-3" />
                  Chưa xác minh email
                </span>
              )}
            </div>
          </div>

          {/* Menu actions */}
          <div className="p-1.5 space-y-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenAuth('reset-password');
              }}
              className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Đổi mật khẩu
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={isSigningOut}
              onClick={handleSignOut}
              className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 flex items-center gap-2 transition"
            >
              {isSigningOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              {isSigningOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
