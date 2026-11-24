import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  CloudUpload,
  FolderOpen,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserCog,
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
  onOpenProfile?: () => void;
  onOpenMyVault?: () => void;
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
  onOpenProfile,
  onOpenMyVault,
}: AccountButtonProps) {
  const {
    user,
    profile,
    isAuthenticated,
    isAdmin,
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
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#39755D] dark:text-[#A3BDA8]" />
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
        <LogIn className="w-3.5 h-3.5 flex-shrink-0 text-[#39755D] dark:text-[#A3BDA8]" />
        <span className={compact ? 'inline' : 'hidden sm:inline'}>Đăng nhập</span>
      </button>
    );
  }

  const displayName =
    profile?.display_name?.trim() ||
    (user.email ? user.email.split('@')[0] : 'Tài khoản');
  const initial = displayName.charAt(0).toUpperCase() || 'S';

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
            className="w-4 h-4 rounded object-cover border border-[#39755D]/40 dark:border-[#A3BDA8]/50 flex-shrink-0"
          />
        ) : (
          <span className="w-4 h-4 rounded bg-[#39755D] dark:bg-[#A3BDA8] text-[#FFF9EA] dark:text-[#202423] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
            {initial}
          </span>
        )}
        <span
          className="max-w-[90px] truncate text-[#23503E] dark:text-[#E4E1D8] hidden sm:inline"
        >
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] transition-transform ${
            isMenuOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg bg-[#FFF9EA] dark:bg-[#292E2B] border border-[#9FC4AF] dark:border-[#49554D] shadow-lg shadow-[#20372D]/12 dark:shadow-none overflow-hidden z-50 animate-fade-in"
        >
          {/* Active account summary */}
          <div className="p-3.5 border-b border-[#CFE2D5] dark:border-[#49554D] bg-[#E2F3E8]/70 dark:bg-[#292E2B]">
            <div className="flex items-center gap-2.5">
              {safeAvatarUrl ? (
                <img
                  src={safeAvatarUrl}
                  alt={displayName}
                  onError={() => setAvatarFailed(true)}
                  className="w-9 h-9 rounded-md object-cover border border-[#39755D]/35 dark:border-[#A3BDA8]/50 flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-md bg-[#39755D] dark:bg-[#A3BDA8] text-[#FFF9EA] dark:text-[#202423] text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#20372D] dark:text-[#E4E1D8] truncate">
                  {displayName}
                </p>
                {user.email && (
                  <p className="text-[11px] text-[#527062] dark:text-[#B8BDB5] truncate font-mono">
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="mt-2.5 flex items-center flex-wrap gap-1.5 text-[10px] font-semibold">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#1F533E] dark:text-[#A3BDA8] border border-[#8FC3A9] dark:border-[#63806E] font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  Admin
                </span>
              </div>
            )}
          </div>

          {/* Menu actions */}
          <div className="p-1.5 space-y-1">
            {onOpenProfile && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenProfile();
                }}
                className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-[#20372D] dark:text-[#E4E1D8] hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] flex items-center gap-2 transition"
              >
                <UserCog className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                Chỉnh sửa hồ sơ
              </button>
            )}

            {onOpenMyVault && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenMyVault();
                }}
                className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-[#20372D] dark:text-[#E4E1D8] hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] flex items-center gap-2 transition"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                Kho nội dung của tôi
              </button>
            )}

            {onSyncNow && (
              <button
                type="button"
                role="menuitem"
                disabled={isSyncing}
                onClick={() => {
                  setIsMenuOpen(false);
                  onSyncNow();
                }}
                className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-[#20372D] dark:text-[#E4E1D8] hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] disabled:opacity-60 flex items-center gap-2 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] ${
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
                className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-[#39755D] dark:text-[#A3BDA8] hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] flex items-center justify-between gap-2 transition"
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
              className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-[#20372D] dark:text-[#E4E1D8] hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] flex items-center gap-2 transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
              Đổi mật khẩu
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={isSigningOut}
              onClick={handleSignOut}
              className="w-full px-3 py-2 rounded-md text-left text-xs font-semibold text-red-700 dark:text-[#E4A6AA] hover:bg-red-50 dark:hover:bg-[#35292A] disabled:opacity-60 flex items-center gap-2 transition"
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
