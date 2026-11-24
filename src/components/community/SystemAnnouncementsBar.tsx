import React, { useState } from 'react';
import {
  Megaphone,
  Pin,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  ShieldCheck,
  Info,
  Sparkles,
  AlertTriangle,
  EyeOff,
  Clock,
} from 'lucide-react';
import type { AnnouncementTone, SystemAnnouncement } from '../../types';
import {
  createSystemAnnouncement,
  deleteSystemAnnouncement,
  updateSystemAnnouncement,
} from '../../services/communityService';
import { AuthorAvatar } from '../common/AuthorAvatar';

function formatDateTime(iso: string): string {
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

function getToneClasses(tone: AnnouncementTone): string {
  if (tone === 'important') {
    return 'retro-callout-blush';
  }
  if (tone === 'update') {
    return 'retro-callout-warm';
  }
  return 'retro-callout-mint';
}

function getToneLabel(tone: AnnouncementTone): string {
  if (tone === 'important') return 'Quan trọng';
  if (tone === 'update') return 'Cập nhật';
  return 'Thông báo';
}

function ToneIcon({ tone }: { tone: AnnouncementTone }) {
  if (tone === 'important') {
    return <AlertTriangle className="w-3.5 h-3.5 text-[#9B485A] dark:text-[#E4A6AA] shrink-0" />;
  }
  if (tone === 'update') {
    return <Sparkles className="w-3.5 h-3.5 text-[#8A6D2F] dark:text-[#D5B97A] shrink-0" />;
  }
  return <Info className="w-3.5 h-3.5 text-[#2E6B53] dark:text-[#A3BDA8] shrink-0" />;
}

/* ---------------- COMPACT WELCOME BANNER ---------------- */

interface SystemAnnouncementsBannerProps {
  announcements: SystemAnnouncement[];
  isAdmin: boolean;
  onOpenModal: () => void;
}

export function SystemAnnouncementsBanner({
  announcements,
  isAdmin,
  onOpenModal,
}: SystemAnnouncementsBannerProps) {
  const activeAnnouncements = announcements.filter((a) => a.isActive);

  if (activeAnnouncements.length === 0 && !isAdmin) {
    return null;
  }

  const latest = activeAnnouncements[0];

  return (
    <div
      className={`${
        latest ? getToneClasses(latest.tone) : 'retro-callout-mint'
      } px-3.5 py-2.5 mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Megaphone className="w-3.5 h-3.5 text-[#2B5A47] dark:text-[#A3BDA8] shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2B5A47] dark:text-[#A3BDA8]">
            Thông báo hệ thống
          </span>
          {latest && (
            <>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#BBD5C4] dark:border-[#49554D] bg-[#FFFDF7] dark:bg-[#292E2B] text-[#396A55] dark:text-[#B8BDB5]">
                {getToneLabel(latest.tone)}
              </span>
              {latest.isPinned && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#8A6D2F] dark:text-[#D5B97A]">
                  <Pin className="w-3 h-3" />
                  Ghim
                </span>
              )}
              {activeAnnouncements.length > 1 && (
                <span className="text-[10px] font-mono text-[#5B776A] dark:text-[#B8BDB5]">
                  +{activeAnnouncements.length - 1} tin khác
                </span>
              )}
            </>
          )}
        </div>

        {latest ? (
          <>
            <p className="text-xs sm:text-[13px] font-bold text-[#1E3B2E] dark:text-[#E4E1D8] leading-snug">
              {latest.title}
            </p>
            <p className="text-xs text-[#3C584C] dark:text-[#B8BDB5] whitespace-pre-wrap break-words leading-relaxed line-clamp-3">
              {latest.content}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-[#5B776A] dark:text-[#B8BDB5] pt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 font-semibold">
                <AuthorAvatar
                  name={latest.authorDisplayName}
                  avatarUrl={latest.authorAvatarUrl}
                  size="xs"
                />
                <ShieldCheck className="w-3 h-3 text-[#39755D] dark:text-[#A3BDA8]" />
                {latest.authorDisplayName}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(latest.createdAt)}
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-[#4C6B5E] dark:text-[#B8BDB5]">
            Chưa có thông báo hệ thống nào đang hiển thị. Bạn có thể đăng thông báo mới cho cộng đồng.
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-start">
        <button
          type="button"
          onClick={onOpenModal}
          className="retro-btn px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
        >
          {isAdmin ? 'Quản lý thông báo' : activeAnnouncements.length > 1 ? 'Xem tất cả' : 'Chi tiết'}
        </button>
      </div>
    </div>
  );
}

/* ---------------- FULL MODAL (VIEW + ADMIN CRUD) ---------------- */

interface SystemAnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: SystemAnnouncement[];
  isAdmin: boolean;
  currentUserId: string | null;
  onChanged: () => Promise<void> | void;
  onToast: (message: string) => void;
}

export function SystemAnnouncementsModal({
  isOpen,
  onClose,
  announcements,
  isAdmin,
  currentUserId,
  onChanged,
  onToast,
}: SystemAnnouncementsModalProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tone, setTone] = useState<AnnouncementTone>('info');
  const [isPinned, setIsPinned] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const visibleList = isAdmin ? announcements : announcements.filter((a) => a.isActive);

  const openCreateForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setTone('info');
    setIsPinned(false);
    setIsActive(true);
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const openEditForm = (item: SystemAnnouncement) => {
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setTone(item.tone);
    setIsPinned(item.isPinned);
    setIsActive(item.isActive);
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentUserId || isSubmitting) return;

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề thông báo.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập nội dung thông báo.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const payload = {
      title: title.trim(),
      content: content.trim(),
      tone,
      isPinned,
      isActive,
    };

    const result = editingId
      ? await updateSystemAnnouncement(editingId, payload)
      : await createSystemAnnouncement(currentUserId, payload);

    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.error?.message || 'Không thể lưu thông báo hệ thống.');
      return;
    }

    setIsFormOpen(false);
    setEditingId(null);
    onToast(editingId ? 'Đã cập nhật thông báo hệ thống!' : 'Đã đăng thông báo hệ thống!');
    await onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || deletingId) return;
    setDeletingId(id);
    const result = await deleteSystemAnnouncement(id);
    setDeletingId(null);

    if (!result.ok) {
      setErrorMsg(result.error?.message || 'Không thể xóa thông báo hệ thống.');
      return;
    }

    onToast('Đã xóa thông báo hệ thống.');
    await onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17221D]/45 backdrop-blur-[2px]">
      <div className="retro-window w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
        <div className="retro-window-header px-4 py-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone className="w-4 h-4 text-[#2B5A47] dark:text-[#A3BDA8] shrink-0" />
            <h3 className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] truncate">
              Thông Báo Hệ Thống SéaClover
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && !isFormOpen && (
              <button
                type="button"
                onClick={openCreateForm}
                className="retro-btn-primary px-2.5 py-1 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Đăng thông báo
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="px-3 py-2 rounded-md border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {isAdmin && isFormOpen && (
            <form
              onSubmit={handleSubmit}
              className="retro-callout-mint p-3.5 sm:p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8]">
                  {editingId ? 'Chỉnh sửa thông báo hệ thống' : 'Tạo thông báo hệ thống mới'}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-[#4E6E60] dark:text-[#B8BDB5] hover:underline cursor-pointer"
                >
                  Đóng biểu mẫu
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                  Tiêu đề thông báo *
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Cập nhật Kho Lệnh & tính năng cộng đồng mới..."
                  className="retro-input w-full px-3 py-1.5 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1">
                  Nội dung chi tiết *
                </label>
                <textarea
                  rows={4}
                  maxLength={3000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung thông báo gửi tới toàn bộ người dùng SéaClover..."
                  className="retro-input w-full px-3 py-2 text-xs sm:text-sm leading-relaxed resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[#4E6E60] dark:text-[#B8BDB5]">
                    Phân loại:
                  </span>
                  {(['info', 'update', 'important'] as AnnouncementTone[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold cursor-pointer ${
                        tone === t
                          ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8]'
                          : 'bg-[#FFFDF7] dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#5B776A] dark:text-[#B8BDB5]'
                      }`}
                    >
                      {getToneLabel(t)}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2B5A47] dark:text-[#E4E1D8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="accent-[#39755D]"
                  />
                  Ghim lên đầu
                </label>

                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2B5A47] dark:text-[#E4E1D8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="accent-[#39755D]"
                  />
                  Hiển thị công khai
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#CBE0D3] dark:border-[#49554D]">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsFormOpen(false)}
                  className="retro-btn px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="retro-btn-primary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {editingId ? 'Lưu cập nhật' : 'Đăng thông báo'}
                </button>
              </div>
            </form>
          )}

          {visibleList.length === 0 ? (
            <div className="py-10 text-center space-y-1.5">
              <Megaphone className="w-7 h-7 mx-auto text-[#8BAE9C] dark:text-[#6B7A70]" />
              <p className="text-xs sm:text-sm font-semibold text-[#3C584C] dark:text-[#E4E1D8]">
                Hiện chưa có thông báo hệ thống nào.
              </p>
              <p className="text-xs text-[#6B877B] dark:text-[#B8BDB5]">
                Các cập nhật mới từ Admin SéaClover sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleList.map((item) => (
                <article
                  key={item.id}
                  className={`${getToneClasses(item.tone)} p-3.5 space-y-2 ${
                    !item.isActive ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ToneIcon tone={item.tone} />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#2B5A47] dark:text-[#A3BDA8]">
                          {getToneLabel(item.tone)}
                        </span>
                        {item.isPinned && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#8A6D2F] dark:text-[#D5B97A]">
                            <Pin className="w-3 h-3" />
                            Ghim
                          </span>
                        )}
                        {!item.isActive && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[#C9DFD1] dark:border-[#49554D] text-[10px] font-semibold text-[#6B877B] dark:text-[#B8BDB5]">
                            <EyeOff className="w-3 h-3" />
                            Đang ẩn
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-[#1E3B2E] dark:text-[#E4E1D8] break-words">
                        {item.title}
                      </h4>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          className="retro-btn p-1.5 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
                          title="Chỉnh sửa thông báo"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="retro-btn-danger p-1.5 cursor-pointer disabled:opacity-50"
                          title="Xóa thông báo"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs sm:text-[13px] text-[#2B4339] dark:text-[#E4E1D8] whitespace-pre-wrap break-words leading-relaxed">
                    {item.content}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-[#5B776A] dark:text-[#B8BDB5] pt-1 border-t border-[#D2E4D9]/70 dark:border-[#49554D]/70 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <AuthorAvatar
                        name={item.authorDisplayName}
                        avatarUrl={item.authorAvatarUrl}
                        size="xs"
                      />
                      <ShieldCheck className="w-3 h-3 text-[#39755D] dark:text-[#A3BDA8]" />
                      {item.authorDisplayName}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
