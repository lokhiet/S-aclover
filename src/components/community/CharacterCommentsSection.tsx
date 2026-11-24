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
  User,
} from 'lucide-react';
import type { Character, CharacterComment } from '../../types';
import {
  createAnonymousCharacterComment,
  createCharacterComment,
  deleteCharacterComment,
  fetchCharacterComments,
  moderateCharacterComment,
  updateCharacterComment,
} from '../../services/communityService';
import {
  GUEST_CUSTOM_NAME_MAX_LENGTH,
  GUEST_DISPLAY_PREFIX,
  loadGuestCommentIdentity,
  normalizeGuestCustomName,
  resolveGuestIdentityForSubmission,
  saveGuestCustomName,
} from '../../utils/guestCommentIdentity';
import { AuthorAvatar } from '../common/AuthorAvatar';

interface CharacterCommentsSectionProps {
  character: Character;
  isAuthenticated: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  onRequireAuth: () => void;
  onToast: (message: string) => void;
  profileRevision?: string;
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
  profileRevision,
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

  const [guestNameInput, setGuestNameInput] = useState<string>(
    () => loadGuestCommentIdentity().customName,
  );
  const [guestRandomCode, setGuestRandomCode] = useState<string | null>(
    () => loadGuestCommentIdentity().randomCode,
  );

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
  }, [character.ownerId, character.id, character.isPublic, character.isSystem, profileRevision]);

  useEffect(() => {
    if (!isAuthenticated) {
      const saved = loadGuestCommentIdentity();
      setGuestNameInput(saved.customName);
      setGuestRandomCode(saved.randomCode);
    }
  }, [isAuthenticated]);

  const handleGuestNameChange = (value: string) => {
    setGuestNameInput(value);
    const saved = saveGuestCustomName(value);
    setGuestRandomCode(saved.randomCode);
  };

  const handleClearGuestName = () => {
    setGuestNameInput('');
    const saved = saveGuestCustomName('');
    setGuestRandomCode(saved.randomCode);
  };

  const normalizedPreviewName = normalizeGuestCustomName(guestNameInput);
  const guestPreviewDisplayName = normalizedPreviewName
    ? `${GUEST_DISPLAY_PREFIX} (${normalizedPreviewName})`
    : guestRandomCode
      ? `${GUEST_DISPLAY_PREFIX} (${guestRandomCode})`
      : `${GUEST_DISPLAY_PREFIX} (Số ngẫu nhiên 4 chữ số)`;

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCommentTarget || !character.ownerId) return;
    if (!newContent.trim() || isSubmitting) return;

    if (!isAuthenticated || !currentUserId) {
      const identity = resolveGuestIdentityForSubmission(guestNameInput);
      setGuestNameInput(identity.state.customName);
      setGuestRandomCode(identity.state.randomCode);

      setIsSubmitting(true);
      const res = await createAnonymousCharacterComment({
        characterOwnerId: character.ownerId,
        characterItemId: character.id,
        guestName: identity.label,
        content: newContent,
        clientToken: identity.state.clientToken,
      });
      setIsSubmitting(false);

      if (!res.ok || !res.data) {
        onToast(res.error?.message || 'Không thể gửi bình luận ẩn danh.');
        return;
      }

      setComments((prev) => [res.data!, ...prev]);
      setNewContent('');
      onToast('Đã đăng bình luận ẩn danh!');
      return;
    }

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
    if (!isAuthenticated || !currentUserId) {
      onRequireAuth();
      return;
    }
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
    if (!isAuthenticated || !currentUserId) {
      onRequireAuth();
      return;
    }
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
    if (!isAuthenticated || !isAdmin || busyId) return;
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
              <form onSubmit={handlePostComment} className="retro-callout-mint p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                    Bình luận ẩn danh
                  </span>
                  <span className="text-[11px] text-[#3C584C] dark:text-[#B8BDB5]">
                    Hiển thị:{' '}
                    <strong className="text-[#1F533E] dark:text-[#E4E1D8]">
                      {guestPreviewDisplayName}
                    </strong>
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={GUEST_CUSTOM_NAME_MAX_LENGTH}
                      value={guestNameInput}
                      onChange={(e) => handleGuestNameChange(e.target.value)}
                      placeholder="Tên của bạn (không bắt buộc)"
                      className="retro-input w-full px-3 py-1.5 pr-8 text-xs sm:text-sm"
                    />
                    {guestNameInput && (
                      <button
                        type="button"
                        onClick={handleClearGuestName}
                        title="Xóa tên tự đặt để dùng số ngẫu nhiên"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#587568] dark:text-[#B8BDB5] hover:text-[#224C3B] dark:hover:text-[#E4E1D8] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5B776A] dark:text-[#B8BDB5]">
                    Nếu không đặt tên, SéaClover sẽ tự tạo một số ngẫu nhiên cho bạn.
                  </p>
                </div>

                <textarea
                  rows={3}
                  maxLength={1500}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={`Viết bình luận ẩn danh về ${character.name}...`}
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
                  const isAnonymousComment = Boolean(
                    comment.isAnonymous || comment.authorRole === 'guest' || !comment.userId,
                  );
                  const isOwn = Boolean(
                    isAuthenticated &&
                      currentUserId &&
                      !isAnonymousComment &&
                      comment.userId === currentUserId,
                  );
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
                          {isAnonymousComment ? (
                            <span
                              className="w-6 h-6 rounded-full bg-[#EDF6F0] dark:bg-[#2F3933] border border-[#9FC4AF] dark:border-[#4E6155] flex items-center justify-center text-[#39755D] dark:text-[#A3BDA8] shrink-0"
                              aria-hidden="true"
                            >
                              <User className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <AuthorAvatar
                              name={comment.authorDisplayName}
                              avatarUrl={comment.authorAvatarUrl}
                              size="sm"
                            />
                          )}
                          <span className="text-xs font-bold text-[#1E3B2E] dark:text-[#E4E1D8] truncate">
                            {comment.authorDisplayName}
                          </span>
                          {isAnonymousComment ? (
                            <span className="px-1.5 py-0.5 rounded bg-[#FAF6EA] dark:bg-[#292E2B] border border-[#D4E2D9] dark:border-[#49554D] text-[#5B776A] dark:text-[#B8BDB5] text-[10px] font-semibold">
                              Ẩn danh
                            </span>
                          ) : (
                            comment.authorRole === 'admin' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#1F533E] dark:text-[#A3BDA8] text-[10px] font-bold">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            )
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
