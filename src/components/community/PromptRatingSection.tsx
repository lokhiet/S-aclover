import React, { useEffect, useState } from 'react';
import {
  Star,
  Loader2,
  Trash2,
  ShieldCheck,
  Clock,
  Lock,
  Check,
} from 'lucide-react';
import type { LibraryPrompt, Note, PromptRatingSummary } from '../../types';
import {
  deletePromptRating,
  fetchPromptRatings,
  savePromptRating,
} from '../../services/communityService';
import { AuthorAvatar } from '../common/AuthorAvatar';

interface PromptRatingSectionProps {
  targetType: 'library_prompt' | 'note';
  item: LibraryPrompt | Note;
  isAuthenticated: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  onRequireAuth: () => void;
  onToast: (message: string) => void;
  profileRevision?: string;
}

function formatRatingTime(iso: string): string {
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

export function PromptRatingSection({
  targetType,
  item,
  isAuthenticated,
  currentUserId,
  isAdmin,
  onRequireAuth,
  onToast,
  profileRevision,
}: PromptRatingSectionProps) {
  const [summary, setSummary] = useState<PromptRatingSummary>({
    average: 0,
    count: 0,
    userRating: null,
    ratings: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [selectedScore, setSelectedScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number>(0);
  const [reviewDraft, setReviewDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isInteractable =
    Boolean(item.isPublic || item.isSystem) ||
    (!item.ownerId && targetType === 'library_prompt');

  const loadRatings = async () => {
    if (!isInteractable) {
      setSummary({ average: 0, count: 0, userRating: null, ratings: [] });
      return;
    }

    setIsLoading(true);
    const res = await fetchPromptRatings(
      targetType,
      item.ownerId ?? null,
      item.id,
      currentUserId,
    );
    setIsLoading(false);

    if (res.ok && res.data) {
      setSummary(res.data);
      setSchemaReady(res.schemaReady !== false);
      if (res.data.userRating) {
        setSelectedScore(res.data.userRating.score);
        setReviewDraft(res.data.userRating.review || '');
      } else {
        setSelectedScore(5);
        setReviewDraft('');
      }
    }
  };

  useEffect(() => {
    loadRatings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, item.ownerId, item.id, item.isPublic, item.isSystem, currentUserId, profileRevision]);

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInteractable) return;
    if (!isAuthenticated || !currentUserId) {
      onRequireAuth();
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    const res = await savePromptRating({
      existingRatingId: summary.userRating?.id ?? null,
      userId: currentUserId,
      targetType,
      targetOwnerId: item.ownerId ?? null,
      targetItemId: item.id,
      score: selectedScore,
      review: reviewDraft,
    });
    setIsSaving(false);

    if (!res.ok) {
      onToast(res.error?.message || 'Không thể lưu đánh giá câu lệnh.');
      return;
    }

    onToast(
      summary.userRating
        ? 'Đã cập nhật đánh giá hiệu quả câu lệnh!'
        : 'Cảm ơn bạn đã đánh giá hiệu quả câu lệnh!',
    );
    await loadRatings();
  };

  const handleDeleteRating = async (ratingId: string) => {
    if (deletingId) return;
    setDeletingId(ratingId);
    const res = await deletePromptRating(ratingId);
    setDeletingId(null);

    if (!res.ok) {
      onToast(res.error?.message || 'Không thể xóa đánh giá.');
      return;
    }

    onToast('Đã xóa đánh giá.');
    await loadRatings();
  };

  return (
    <section className="retro-window overflow-hidden mt-4">
      <div className="retro-window-header px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-xs sm:text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-2">
          <Star className="w-4 h-4 text-[#B58C36] dark:text-[#D5B97A]" />
          Đánh Giá Hiệu Quả Câu Lệnh
        </h3>
        {isInteractable && schemaReady && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-[#8A6D2F] dark:text-[#D5B97A] tabular-nums-mono">
              {summary.count > 0 ? `${summary.average.toFixed(1)} / 5` : 'Chưa có đánh giá'}
            </span>
            {summary.count > 0 && (
              <span className="text-[11px] text-[#5B776A] dark:text-[#B8BDB5] tabular-nums-mono">
                ({summary.count} lượt)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {!isInteractable ? (
          <div className="retro-callout-warm px-3.5 py-3 flex items-start gap-2.5 text-xs text-[#594B2B] dark:text-[#B8BDB5]">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#8A6D2F] dark:text-[#D5B97A]" />
            <p className="leading-relaxed">
              Câu lệnh này đang ở chế độ <strong>Riêng tư</strong>. Bật <strong>Công khai</strong>{' '}
              để cộng đồng có thể dùng thử và đánh giá hiệu quả.
            </p>
          </div>
        ) : !schemaReady ? (
          <p className="text-xs text-[#5B776A] dark:text-[#B8BDB5]">
            Tính năng đánh giá câu lệnh sẽ tự động kích hoạt sau khi chạy migration 003 trên Supabase.
          </p>
        ) : (
          <>
            {isAuthenticated ? (
              <form onSubmit={handleSubmitRating} className="retro-callout-mint p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8]">
                    {summary.userRating ? 'Đánh giá của bạn (có thể cập nhật)' : 'Chấm điểm câu lệnh này'}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverScore || selectedScore) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverScore(star)}
                          onMouseLeave={() => setHoverScore(0)}
                          onClick={() => setSelectedScore(star)}
                          className="p-0.5 cursor-pointer transition-transform hover:scale-110"
                          aria-label={`${star} sao`}
                        >
                          <Star
                            className={`w-5 h-5 ${
                              active
                                ? 'fill-[#D4A742] text-[#B58C36] dark:fill-[#D5B97A] dark:text-[#D5B97A]'
                                : 'text-[#A6BEB1] dark:text-[#5B6860]'
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="ml-1 text-xs font-bold text-[#8A6D2F] dark:text-[#D5B97A] tabular-nums-mono">
                      {selectedScore}/5
                    </span>
                  </div>
                </div>

                <textarea
                  rows={2}
                  maxLength={500}
                  value={reviewDraft}
                  onChange={(e) => setReviewDraft(e.target.value)}
                  placeholder="Nhận xét ngắn về độ hiệu quả khi dùng với AI (không bắt buộc)..."
                  className="retro-input w-full px-3 py-1.5 text-xs leading-relaxed resize-y"
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6B877B] dark:text-[#B8BDB5] tabular-nums-mono">
                    {reviewDraft.trim().length}/500
                  </span>
                  <div className="flex items-center gap-1.5">
                    {summary.userRating && (
                      <button
                        type="button"
                        disabled={deletingId === summary.userRating.id}
                        onClick={() => handleDeleteRating(summary.userRating!.id)}
                        className="retro-btn-danger px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Xóa đánh giá
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="retro-btn-primary px-3 py-1 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      {summary.userRating ? 'Cập nhật' : 'Gửi đánh giá'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="retro-callout-mint px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#3C584C] dark:text-[#B8BDB5]">
                  Đăng nhập để chấm điểm và chia sẻ độ hiệu quả của câu lệnh này.
                </p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="retro-btn-primary px-3 py-1 text-xs font-semibold cursor-pointer"
                >
                  Đăng nhập để đánh giá
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="py-5 flex items-center justify-center gap-2 text-xs text-[#5B776A] dark:text-[#B8BDB5]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tải đánh giá...
              </div>
            ) : summary.ratings.length === 0 ? (
              <p className="text-xs text-[#6B877B] dark:text-[#B8BDB5] py-3 text-center">
                Chưa có đánh giá nào từ cộng đồng.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.ratings.map((rating) => {
                  const canDelete = Boolean(
                    isAdmin || (currentUserId && rating.userId === currentUserId),
                  );
                  return (
                    <div
                      key={rating.id}
                      className="p-3 rounded-md border border-[#D4E5DA] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#242926] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <AuthorAvatar
                            name={rating.authorDisplayName}
                            avatarUrl={rating.authorAvatarUrl}
                            size="sm"
                          />
                          <span className="text-xs font-bold text-[#1E3B2E] dark:text-[#E4E1D8] truncate">
                            {rating.authorDisplayName}
                          </span>
                          {rating.authorRole === 'admin' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#1F533E] dark:text-[#A3BDA8] text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                          <span className="inline-flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= rating.score
                                    ? 'fill-[#D4A742] text-[#B58C36] dark:fill-[#D5B97A] dark:text-[#D5B97A]'
                                    : 'text-[#C6D8CE] dark:text-[#4B5750]'
                                }`}
                              />
                            ))}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#6B877B] dark:text-[#B8BDB5]">
                            <Clock className="w-3 h-3" />
                            {formatRatingTime(rating.updatedAt)}
                          </span>
                        </div>

                        {canDelete && (
                          <button
                            type="button"
                            disabled={deletingId === rating.id}
                            onClick={() => handleDeleteRating(rating.id)}
                            className="retro-btn-danger p-1 cursor-pointer shrink-0"
                            title="Xóa đánh giá"
                          >
                            {deletingId === rating.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {rating.review && (
                        <p className="text-xs text-[#284237] dark:text-[#E4E1D8] whitespace-pre-wrap break-words leading-relaxed">
                          {rating.review}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
