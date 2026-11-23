import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  MailWarning,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSafeHttpsUrl } from '../../services/authService';
import type { AuthModalMode } from '../../types/auth';

interface AccountButtonProps {
  onOpenAuth: (mode: AuthModalMode) => void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  compact?: boolean;
  isSyncing?: boolean;
  hasLocalDataToImport?: boolean;
  hasPendingImportJob?: boolean;
  onSyncNow?: () => void;
  onOpenLocalMigration?: () => void;
}

export default function AccountButton({
  onOpenAuth,
  onToast,
  compact = false,
  isSyncing = false,
  hasLocalDataToImport = false,
  hasPendingImportJob = false,
  onSyncNow,
  onOpenLocalMigration,
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
        className="retro-btn px-2.5 py-1.5 flex items-center gap-1.5 text-xs select-none opacity-80"
        aria-label="Đang kiểm tra phiên đăng nhập"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#39755D] dark:text-[#7BC4A4]" />
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
        className={`retro-btn text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-1.5'
        }`}
      >
        <LogIn className="w-3.5 h-3.5 flex-shrink-0 text-[#39755D] dark:text-[#7BC4A4]" />
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
        className={`retro-btn retro-btn-active text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
        }`}
      >
        {safeAvatarUrl ? (
          <img
            src={safeAvatarUrl}
            alt={displayName}
            onError={() => setAvatarFailed(true)}
            className="w-4 h-4 rounded object-cover border border-[#39755D]/40 dark:border-[#7BC4A4]/50 flex-shrink-0"
          />
        ) : (
          <span className="w-4 h-4 rounded bg-[#39755D] text-[#FFF9EA] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
            {initial}
          </span>
        )}
        <span
          className="max-w-[90px] truncate text-[#23503E] dark:text-[#D9F3E6] hidden sm:inline"
        >
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#39755D] dark:text-[#9AD8BD] transition-transform ${
            isMenuOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg bg-[#FFF9EA] dark:bg-[#172620] border border-[#9FC4AF] dark:border-[#335243] shadow-lg shadow-[#20372D]/12 dark:shadow-black/45 overflow-hidden z-50 animate-fade-in"
        >
          {/* Active account summary */}
          <div className="p-3.5 border-b border-[#CFE2D5] dark:border-[#2A4437] bg-[#E2F3E8]/70 dark:bg-[#1E3229]">
            <div className="flex items-center gap-2.5">
              {safeAvatarUrl ? (
                <img
                  src={safeAvatarUrl}
                  alt={displayName}
                  onError={() => setAvatarFailed(true)}
                  className="w-9 h-9 rounded-md object-cover border border-[#39755D]/35 dark:border-[#7BC4A4]/40 flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-md bg-[#39755D] text-[#FFF9EA] text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#20372D] dark:text-[#F4EDDC] truncate">
                  {displayName}
                </p>
                {user.email && (
                  <p className="text-[11px] text-[#527062] dark:text-[#A4BFB2] truncate font-mono">
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold">
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFF9EA] dark:bg-[#16241E] text-[#39755D] dark:text-[#8CD2B3] border border-[#9FC4AF] dark:border-[#355748]">
                  <CheckCircle2 className="w-3 h-3" />
                  Email đã xác minh
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/50">
                  <MailWarning className="w-3 h-3" />
                  Chưa xác minh email
                </span>
              )}
            </div>
          </div>

          {/* Menu actions */}
          <div className="p-1.5 space-y-1">
            {onSyncNow && (
              <button
                type="button"
                role="menuitem"
                disabled={isSyncing}
                onClick={() => {
                  setIsMenuOpen(false);
                  onSyncNow();
                }}
                className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-[#20372D] dark:text-[#EAF3EC] hover:bg-[#E2F3E8] dark:hover:bg-[#233B30] disabled:opacity-60 flex items-center gap-2 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#39755D] dark:text-[#7BC4A4] ${
                    isSyncing ? 'animate-spin' : ''
                  }`}
                />
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu ngay'}
              </button>
            )}

            {onOpenLocalMigration && (hasLocalDataToImport || hasPendingImportJob) && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenLocalMigration();
                }}
                className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-[#39755D] dark:text-[#8CD2B3] hover:bg-[#E2F3E8] dark:hover:bg-[#233B30] flex items-center justify-between gap-2 transition"
              >
                <span className="flex items-center gap-2 truncate">
                  <CloudUpload className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {hasPendingImportJob
                      ? 'Tiếp tục đồng bộ bị gián đoạn'
                      : 'Nhập dữ liệu cục bộ lên tài khoản'}
                  </span>
                </span>
                {hasPendingImportJob && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                )}
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenAuth('reset-password');
              }}
              className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-[#20372D] dark:text-[#EAF3EC] hover:bg-[#E2F3E8] dark:hover:bg-[#233B30] flex items-center gap-2 transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#39755D] dark:text-[#7BC4A4]" />
              Đổi mật khẩu
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={isSigningOut}
              onClick={handleSignOut}
              className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 flex items-center gap-2 transition"
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
