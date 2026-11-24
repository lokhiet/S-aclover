import React, { useEffect, useState } from 'react';
import { isSafeHttpsUrl } from '../../services/authService';

interface AuthorAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AuthorAvatarProps['size']>, string> = {
  xs: 'w-4 h-4 text-[9px] rounded',
  sm: 'w-5 h-5 text-[10px] rounded',
  md: 'w-9 h-9 text-sm rounded-md',
  lg: 'w-16 h-16 text-2xl rounded-lg',
};

export function AuthorAvatar({
  name,
  avatarUrl,
  size = 'xs',
  className = '',
}: AuthorAvatarProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const safeUrl = !hasError && avatarUrl && isSafeHttpsUrl(avatarUrl) ? avatarUrl.trim() : null;
  const label = (name || 'S').trim();
  const initial = label.charAt(0).toUpperCase() || 'S';
  const sizeClass = SIZE_CLASSES[size];

  if (safeUrl) {
    return (
      <img
        src={safeUrl}
        alt={label}
        onError={() => setHasError(true)}
        className={`${sizeClass} object-cover border border-[#39755D]/35 dark:border-[#A3BDA8]/50 flex-shrink-0 bg-[#E2F3E8] dark:bg-[#343D37] ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} bg-[#39755D] dark:bg-[#A3BDA8] text-[#FFF9EA] dark:text-[#202423] font-bold inline-flex items-center justify-center flex-shrink-0 select-none ${className}`}
    >
      {initial}
    </span>
  );
}
