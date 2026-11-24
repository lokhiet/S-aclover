import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  deleteUserAvatarObject,
  isSafeHttpsUrl,
  uploadUserAvatar,
} from '../../services/authService';
import type { UserProfile } from '../../types/auth';
import { AuthorAvatar } from '../common/AuthorAvatar';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedProfile: UserProfile) => Promise<void> | void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const MAX_DISPLAY_NAME = 80;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

export default function ProfileEditModal({
  isOpen,
  onClose,
  onSaved,
  onToast,
}: ProfileEditModalProps) {
  const { user, profile, isAdmin, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const initialName =
      profile?.display_name?.trim() ||
      (user?.email ? user.email.split('@')[0] : '') ||
      '';
    setDisplayName(initialName);
    setPendingFile(null);
    setRemoveAvatar(false);
    setErrorMsg('');
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [isOpen, profile?.display_name, user?.email]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  if (!isOpen || !user) return null;

  const existingAvatarUrl =
    profile?.avatar_url && isSafeHttpsUrl(profile.avatar_url) ? profile.avatar_url : null;
  const hasVisibleAvatar = Boolean(previewObjectUrl || (!removeAvatar && existingAvatarUrl));

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isAllowedExt =
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.gif');

    const isAllowedMime = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
    ].includes(file.type);

    if (!isAllowedMime && !isAllowedExt) {
      setErrorMsg('Chỉ hỗ trợ ảnh định dạng PNG, JPG, WebP hoặc GIF.');
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg('Ảnh chọn từ thiết bị quá lớn (tối đa 12 MB). Vui lòng chọn ảnh khác.');
      return;
    }

    setErrorMsg('');
    setRemoveAvatar(false);
    setPendingFile(file);
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleRemoveAvatar = () => {
    setErrorMsg('');
    setPendingFile(null);
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRemoveAvatar(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setErrorMsg('Vui lòng nhập tên hiển thị của bạn.');
      return;
    }
    if (trimmedName.length > MAX_DISPLAY_NAME) {
      setErrorMsg(`Tên hiển thị tối đa ${MAX_DISPLAY_NAME} ký tự.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    let uploadedUrl: string | null = null;
    const previousAvatarUrl = profile?.avatar_url ?? null;

    try {
      if (pendingFile) {
        const uploadRes = await uploadUserAvatar(user.id, pendingFile);
        if (!uploadRes.ok || !uploadRes.data) {
          setErrorMsg(uploadRes.error?.message || 'Không thể tải ảnh đại diện lên.');
          return;
        }
        uploadedUrl = uploadRes.data.publicUrl;
      }

      const nextAvatarUrl =
        uploadedUrl !== null
          ? uploadedUrl
          : removeAvatar
            ? null
            : undefined;

      const updateRes = await updateProfile({
        display_name: trimmedName,
        ...(nextAvatarUrl !== undefined ? { avatar_url: nextAvatarUrl } : {}),
      });

      if (!updateRes.ok || !updateRes.data) {
        if (uploadedUrl) {
          void deleteUserAvatarObject(user.id, uploadedUrl);
        }
        setErrorMsg(updateRes.error?.message || 'Không thể lưu thay đổi hồ sơ.');
        return;
      }

      if (previousAvatarUrl && (uploadedUrl !== null || removeAvatar)) {
        void deleteUserAvatarObject(user.id, previousAvatarUrl);
      }

      await onSaved(updateRes.data);
      onToast('Đã cập nhật tên hiển thị & ảnh đại diện trên toàn hệ thống! 🍀', 'success');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#17221D]/55 dark:bg-[#141716]/75 backdrop-blur-[2px]"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-edit-title"
        className="retro-window w-full max-w-md overflow-hidden relative z-10 animate-fade-in"
      >
        <div className="retro-titlebar px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCog className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8] shrink-0" />
            <h3
              id="profile-edit-title"
              className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] truncate"
            >
              Chỉnh sửa hồ sơ
            </h3>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="px-3 py-2 rounded-md border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Avatar Picker */}
          <div className="retro-callout-mint p-3.5 space-y-3">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#2B5A47] dark:text-[#A3BDA8]">
              Ảnh đại diện
            </span>

            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                {previewObjectUrl ? (
                  <img
                    src={previewObjectUrl}
                    alt={displayName || 'Ảnh đại diện mới'}
                    className="w-16 h-16 rounded-lg object-cover border border-[#39755D]/40 dark:border-[#A3BDA8]/60 bg-[#FFF9EA] dark:bg-[#292E2B]"
                  />
                ) : (
                  <AuthorAvatar
                    name={displayName || 'S'}
                    avatarUrl={removeAvatar ? null : existingAvatarUrl}
                    size="lg"
                  />
                )}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                  title="Chọn ảnh từ thiết bị"
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-md bg-[#FFF9EA] dark:bg-[#292E2B] border border-[#9FC4AF] dark:border-[#49554D] flex items-center justify-center text-[#39755D] dark:text-[#A3BDA8] shadow-sm hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => fileInputRef.current?.click()}
                    className="retro-btn px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                    <span>{hasVisibleAvatar ? 'Đổi ảnh' : 'Tải ảnh từ thiết bị'}</span>
                  </button>

                  {hasVisibleAvatar && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleRemoveAvatar}
                      className="retro-btn-danger px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa ảnh</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#587568] dark:text-[#B8BDB5] leading-snug">
                  Hỗ trợ PNG, JPG, WebP, GIF (tối đa 2 MB). Đồng bộ tức thì trên bài đăng, bình luận và đánh giá.
                </p>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="profile-display-name"
                className="text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8]"
              >
                Tên hiển thị *
              </label>
              <span className="text-[10px] font-mono text-[#6B877B] dark:text-[#B8BDB5] tabular-nums-mono">
                {displayName.trim().length}/{MAX_DISPLAY_NAME}
              </span>
            </div>
            <input
              id="profile-display-name"
              type="text"
              maxLength={MAX_DISPLAY_NAME}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên bạn muốn hiển thị công khai..."
              className="retro-input w-full px-3 py-2 text-xs sm:text-sm font-medium"
              disabled={isSubmitting}
            />
          </div>

          {/* Private Email Guarantee + Role */}
          <div className="retro-callout-warm px-3.5 py-2.5 space-y-1.5 text-[11px] text-[#594B2B] dark:text-[#B8BDB5]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-bold text-[#2B5A47] dark:text-[#E4E1D8]">
                <Lock className="w-3.5 h-3.5 text-[#8A6D2F] dark:text-[#D5B97A]" />
                Quyền riêng tư tài khoản
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#1F533E] dark:text-[#A3BDA8] text-[10px] font-bold">
                {isAdmin && <ShieldCheck className="w-3 h-3" />}
                {isAdmin ? 'Admin' : 'Thành viên'}
              </span>
            </div>
            <p className="leading-relaxed">
              Email <span className="font-mono font-semibold">{user.email}</span> chỉ hiển thị riêng cho bạn và không bao giờ công khai ở bài đăng, bình luận hay đánh giá.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#CBE0D3] dark:border-[#49554D]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="retro-btn px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="retro-btn-primary px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
