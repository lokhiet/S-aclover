import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Send,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  ShieldCheck,
  Clock,
  Loader2,
  Lock,
  Check,
  X,
} from 'lucide-react';
import type { Character, CharacterComment } from '../../types';
import {
  createCharacterComment,
  deleteCharacterComment,
  fetchCharacterComments,
  moderateCharacterComment,
  updateCharacterComment,
} from '../../services/communityService';

interface CharacterCommentsSectionProps {
  character: Character;
  isAuthenticated: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  onRequireAuth: () => void;
  onToast: (message: string) => void;
}

function formatCommentTime(iso: string): string {
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

export function CharacterCommentsSection({
  character,
  isAuthenticated,
  currentUserId,
  isAdmin,
  onRequireAuth,
  onToast,
}: CharacterCommentsSectionProps) {
  const [comments, setComments] = useState<CharacterComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [hideReasonDraft, setHideReasonDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const canCommentTarget = Boolean(
    character.ownerId && (character.isPublic || character.isSystem),
  );

  const loadComments = async () => {
    if (!canCommentTarget || !character.ownerId) {
      setComments([]);
      return;
    }
    setIsLoading(true);
    const res = await fetchCharacterComments(character.ownerId, character.id);
    setIsLoading(false);
    if (res.ok && res.data) {
      setComments(res.data);
      setSchemaReady(res.schemaReady !== false);
    }
  };

  useEffect(() => {
    loadComments();
    setEditingId(null);
    setModeratingId(null);
    setNewContent('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.ownerId, character.id, character.isPublic, character.isSystem]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCommentTarget || !character.ownerId) return;
    if (!isAuthenticated || !currentUserId) {
      onRequireAuth();
      return;
    }
    if (!newContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const res = await createCharacterComment(
      currentUserId,
      character.ownerId,
      character.id,
      newContent,
    );
    setIsSubmitting(false);

    if (!res.ok || !res.data) {
      onToast(res.error?.message || 'Không thể gửi bình luận.');
      return;
    }

    setComments((prev) => [res.data!, ...prev]);
    setNewContent('');
    onToast('Đã đăng bình luận!');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editDraft.trim() || busyId) return;
    setBusyId(commentId);
    const res = await updateCharacterComment(commentId, editDraft);
    setBusyId(null);
    if (!res.ok || !res.data) {
      onToast(res.error?.message || 'Không thể cập nhật bình luận.');
      return;
    }
    setComments((prev) => prev.map((c) => (c.id === commentId ? res.data! : c)));
    setEditingId(null);
    onToast('Đã cập nhật bình luận!');
  };

  const handleDelete = async (commentId: string) => {
    if (busyId) return;
    setBusyId(commentId);
    const res = await deleteCharacterComment(commentId);
    setBusyId(null);
    if (!res.ok) {
      onToast(res.error?.message || 'Không thể xóa bình luận.');
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onToast('Đã xóa bình luận.');
  };

  const handleToggleHide = async (comment: CharacterComment, reason?: string) => {
    if (!isAdmin || busyId) return;
    setBusyId(comment.id);
    const res = await moderateCharacterComment(comment.id, !comment.isHidden, reason);
    setBusyId(null);
    if (!res.ok || !res.data) {
      onToast(res.error?.message || 'Không thể cập nhật kiểm duyệt bình luận.');
      return;
    }
    setComments((prev) => prev.map((c) => (c.id === comment.id ? res.data! : c)));
    setModeratingId(null);
    setHideReasonDraft('');
    onToast(res.data.isHidden ? 'Đã ẩn bình luận vi phạm.' : 'Đã bỏ ẩn bình luận.');
  };

  return (
    <section className="retro-window overflow-hidden mt-4">
      <div className="retro-window-header px-4 py-2.5 flex items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
          Bình Luận Cộng Đồng
          {canCommentTarget && (
            <span className="tabular-nums-mono text-[11px] font-semibold text-[#587568] dark:text-[#B8BDB5]">
              ({comments.length})
            </span>
          )}
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {!canCommentTarget ? (
          <div className="retro-callout-warm px-3.5 py-3 flex items-start gap-2.5 text-xs text-[#594B2B] dark:text-[#B8BDB5]">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#8A6D2F] dark:text-[#D5B97A]" />
            <p className="leading-relaxed">
              Nhân vật này hiện đang ở chế độ <strong>Riêng tư</strong> (hoặc lưu cục bộ). Khi tác
              giả bật <strong>Công khai</strong>, cộng đồng sẽ có thể xem và để lại bình luận tại
              đây.
            </p>
          </div>
        ) : !schemaReady ? (
          <p className="text-xs text-[#5B776A] dark:text-[#B8BDB5]">
            Tính năng bình luận sẽ tự động kích hoạt sau khi chạy migration 003 trên Supabase.
          </p>
        ) : (
          <>
            {isAuthenticated ? (
              <form onSubmit={handlePostComment} className="space-y-2">
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={`Viết cảm nhận hoặc góp ý của bạn về ${character.name}...`}
                  className="retro-input w-full px-3 py-2 text-xs sm:text-sm leading-relaxed resize-y"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6B877B] dark:text-[#B8BDB5] tabular-nums-mono">
                    {newContent.trim().length}/1500
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newContent.trim()}
                    className="retro-btn-primary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Gửi bình luận
                  </button>
                </div>
              </form>
            ) : (
              <div className="retro-callout-mint px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#3C584C] dark:text-[#B8BDB5]">
                  Khách chưa đăng nhập có thể đọc bình luận. Đăng nhập để tham gia thảo luận nhé!
                </p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="retro-btn-primary px-3 py-1 text-xs font-semibold cursor-pointer"
                >
                  Đăng nhập để bình luận
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#5B776A] dark:text-[#B8BDB5]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tải bình luận...
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-[#6B877B] dark:text-[#B8BDB5] py-4 text-center">
                Chưa có bình luận nào cho nhân vật này. Hãy là người đầu tiên chia sẻ cảm nhận!
              </p>
            ) : (
              <div className="space-y-2.5">
                {comments.map((comment) => {
                  const isOwn = Boolean(currentUserId && comment.userId === currentUserId);
                  const isEditing = editingId === comment.id;
                  const isModerating = moderatingId === comment.id;
                  const isBusy = busyId === comment.id;

                  return (
                    <div
                      key={comment.id}
                      className={`p-3 rounded-md border transition-theme space-y-2 ${
                        comment.isHidden
                          ? 'bg-[#FAF3F4] dark:bg-[#2B2627] border-[#E3BDC5] dark:border-[#6B4A4D]'
                          : 'bg-[#FFFDF7] dark:bg-[#242926] border-[#D4E5DA] dark:border-[#49554D]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="text-xs font-bold text-[#1E3B2E] dark:text-[#E4E1D8] truncate">
                            {comment.authorDisplayName}
                          </span>
                          {comment.authorRole === 'admin' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#1F533E] dark:text-[#A3BDA8] text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#6B877B] dark:text-[#B8BDB5]">
                            <Clock className="w-3 h-3" />
                            {formatCommentTime(comment.createdAt)}
                          </span>
                          {comment.isHidden && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#DFB4BD] dark:border-[#6B4A4D] text-[10px] font-semibold text-[#9B485A] dark:text-[#E4A6AA]">
                              <EyeOff className="w-3 h-3" />
                              Đã bị Admin ẩn
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isOwn && !comment.isHidden && !isEditing && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditDraft(comment.content);
                              }}
                              className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
                              title="Sửa bình luận"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                if (comment.isHidden) {
                                  handleToggleHide(comment);
                                } else {
                                  setModeratingId(isModerating ? null : comment.id);
                                  setHideReasonDraft(comment.hiddenReason || '');
                                }
                              }}
                              className="retro-btn p-1 text-[#7D632B] dark:text-[#D5B97A] cursor-pointer"
                              title={comment.isHidden ? 'Bỏ ẩn bình luận' : 'Ẩn bình luận vi phạm'}
                            >
                              {comment.isHidden ? (
                                <Eye className="w-3 h-3" />
                              ) : (
                                <EyeOff className="w-3 h-3" />
                              )}
                            </button>
                          )}

                          {(isOwn || isAdmin) && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(comment.id)}
                              className="retro-btn-danger p-1 cursor-pointer"
                              title="Xóa bình luận"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {comment.isHidden && comment.hiddenReason && (
                        <p className="text-[11px] text-[#9B485A] dark:text-[#E4A6AA] italic">
                          Lý do ẩn: {comment.hiddenReason}
                        </p>
                      )}

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            maxLength={1500}
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="retro-input w-full px-2.5 py-1.5 text-xs leading-relaxed resize-y"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                              Hủy
                            </button>
                            <button
                              type="button"
                              disabled={isBusy || !editDraft.trim()}
                              onClick={() => handleSaveEdit(comment.id)}
                              className="retro-btn-primary px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              Lưu
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs sm:text-[13px] text-[#284237] dark:text-[#E4E1D8] whitespace-pre-wrap break-words leading-relaxed">
                          {comment.content}
                        </p>
                      )}

                      {isAdmin && isModerating && !comment.isHidden && (
                        <div className="pt-2 border-t border-[#DFB4BD]/60 dark:border-[#49554D] flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            maxLength={300}
                            value={hideReasonDraft}
                            onChange={(e) => setHideReasonDraft(e.target.value)}
                            placeholder="Nhập lý do ẩn bình luận (tùy chọn)..."
                            className="retro-input flex-1 px-2.5 py-1 text-xs"
                          />
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setModeratingId(null)}
                              className="retro-btn px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleHide(comment, hideReasonDraft)}
                              className="retro-btn-danger px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                            >
                              Xác nhận ẩn
                            </button>
                          </div>
                        </div>
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
