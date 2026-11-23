import React, { useEffect, useState } from 'react';
import {
  Globe,
  Lock,
  ShieldCheck,
  Heart,
  Clock,
  User,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { CloudContentMeta, ContentTargetType } from '../../types';
import { fetchContentLikes, toggleContentLike } from '../../services/communityService';

interface ContentInteractionBarProps {
  targetType: ContentTargetType;
  item: CloudContentMeta & { id: string; createdAt: string; updatedAt?: string; author?: string };
  isAuthenticated: boolean;
  currentUserId: string | null;
  isTogglingPublic?: boolean;
  onTogglePublic?: (nextPublic: boolean) => void | Promise<void>;
  onRequireAuth: () => void;
  onToast: (message: string) => void;
}

function formatPublishedDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ContentInteractionBar({
  targetType,
  item,
  isAuthenticated,
  currentUserId,
  isTogglingPublic = false,
  onTogglePublic,
  onRequireAuth,
  onToast,
}: ContentInteractionBarProps) {
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);

  const isOwnCloudItem = Boolean(isAuthenticated && currentUserId && item.ownerId === currentUserId);
  const isSystem = Boolean(item.isSystem);
  const isPublic = Boolean(item.isPublic || item.isSystem);
  const isBuiltinInteractable =
    !item.ownerId && (targetType === 'library_prompt' || targetType === 'idea');
  const canInteract = isSystem || isPublic || isBuiltinInteractable;

  useEffect(() => {
    let active = true;
    if (!canInteract) {
      setLikeCount(0);
      setLikedByMe(false);
      return;
    }

    setIsLoadingLike(true);
    fetchContentLikes(targetType, item.ownerId ?? null, item.id, currentUserId).then((res) => {
      if (!active) return;
      setIsLoadingLike(false);
      if (res.ok && res.data) {
        setLikeCount(res.data.count);
        setLikedByMe(res.data.likedByMe);
        setSchemaReady(res.schemaReady !== false);
      }
    });

    return () => {
      active = false;
    };
  }, [targetType, item.ownerId, item.id, currentUserId, canInteract]);

  const handleLikeClick = async () => {
    if (!canInteract) return;
    if (!isAuthenticated || !currentUserId) {
      onRequireAuth();
      return;
    }
    if (isUpdatingLike) return;

    const prevLiked = likedByMe;
    const prevCount = likeCount;
    setIsUpdatingLike(true);
    setLikedByMe(!prevLiked);
    setLikeCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));

    const res = await toggleContentLike({
      userId: currentUserId,
      targetType,
      targetOwnerId: item.ownerId ?? null,
      targetItemId: item.id,
      currentlyLiked: prevLiked,
    });

    setIsUpdatingLike(false);

    if (!res.ok) {
      setLikedByMe(prevLiked);
      setLikeCount(prevCount);
      onToast(res.error?.message || 'Không thể thả tim lúc này.');
      return;
    }

    // Đồng bộ lại tổng lượt tim mới nhất
    const refreshed = await fetchContentLikes(targetType, item.ownerId ?? null, item.id, currentUserId);
    if (refreshed.ok && refreshed.data) {
      setLikeCount(refreshed.data.count);
      setLikedByMe(refreshed.data.likedByMe);
    }
  };

  const authorName =
    item.authorDisplayName ||
    (item.author && item.author.trim()) ||
    (isBuiltinInteractable ? 'SéaClover' : item.ownerId ? 'Thành viên SéaClover' : 'Bản cục bộ');
  const displayTime = formatPublishedDate(item.publishedAt || item.createdAt);

  return (
    <div className="retro-callout-mint px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs min-w-0">
        {isSystem ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#8FC3A9] dark:border-[#63806E] bg-[#E2F3E8] dark:bg-[#343D37] text-[#1F533E] dark:text-[#A3BDA8] text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Hệ thống (Admin)
          </span>
        ) : isPublic ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#9FC4AF] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#292E2B] text-[#2B5A47] dark:text-[#A3BDA8] text-[11px] font-bold">
            <Globe className="w-3 h-3" />
            Công khai
          </span>
        ) : item.ownerId ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#D4E2D9] dark:border-[#49554D] bg-[#F7FBF8] dark:bg-[#292E2B] text-[#5B776A] dark:text-[#B8BDB5] text-[11px] font-semibold">
            <Lock className="w-3 h-3" />
            Riêng tư
          </span>
        ) : isBuiltinInteractable ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#D9CFAF] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#292E2B] text-[#7D632B] dark:text-[#D5B97A] text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" />
            Mặc định
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#D4E2D9] dark:border-[#49554D] bg-[#F7FBF8] dark:bg-[#292E2B] text-[#5B776A] dark:text-[#B8BDB5] text-[11px] font-semibold">
            <Lock className="w-3 h-3" />
            Lưu trên máy
          </span>
        )}

        <span className="inline-flex items-center gap-1 text-[#2E4F41] dark:text-[#E4E1D8] font-medium truncate max-w-[220px]">
          <User className="w-3.5 h-3.5 text-[#587568] dark:text-[#B8BDB5] shrink-0" />
          <span className="truncate">{authorName}</span>
          {item.authorRole === 'admin' && !isSystem && (
            <span className="px-1 py-0.2 rounded text-[10px] font-bold bg-[#E2F3E8] dark:bg-[#343D37] text-[#2B5A47] dark:text-[#A3BDA8]">
              Admin
            </span>
          )}
        </span>

        {displayTime && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#5B776A] dark:text-[#B8BDB5]">
            <Clock className="w-3 h-3 shrink-0" />
            {displayTime}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {isOwnCloudItem && !isSystem && onTogglePublic && (
          <button
            type="button"
            disabled={isTogglingPublic}
            onClick={() => onTogglePublic(!isPublic)}
            className={`${
              isPublic ? 'retro-btn-active' : 'retro-btn'
            } px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60`}
            title={
              isPublic
                ? 'Chuyển về riêng tư (chỉ mình bạn xem được)'
                : 'Bật công khai để cộng đồng xem và tương tác'
            }
          >
            {isTogglingPublic ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPublic ? (
              <Globe className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            <span>{isPublic ? 'Đang Công khai' : 'Đang Riêng tư'}</span>
          </button>
        )}

        {canInteract && schemaReady && (
          <button
            type="button"
            disabled={isLoadingLike || isUpdatingLike}
            onClick={handleLikeClick}
            className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
              likedByMe
                ? 'bg-[#FFEFF2] dark:bg-[#3B2E32] border-[#DFA8B6] dark:border-[#7B525C] text-[#A24057] dark:text-[#E4A6AA]'
                : 'retro-btn text-[#3C584C] dark:text-[#E4E1D8]'
            }`}
            title={
              isAuthenticated
                ? likedByMe
                  ? 'Bỏ thả tim'
                  : 'Thả tim ủng hộ nội dung này'
                : 'Đăng nhập để thả tim'
            }
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                likedByMe ? 'fill-[#C85A72] text-[#C85A72] dark:fill-[#E4A6AA] dark:text-[#E4A6AA]' : ''
              }`}
            />
            <span className="tabular-nums-mono">{likeCount}</span>
          </button>
        )}
      </div>
    </div>
  );
}
