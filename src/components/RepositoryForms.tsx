import React, { useState, useEffect } from 'react';
import { Character, Note, Idea, LibraryPrompt, PromptStep } from '../types';
import { Check, X, Sparkles, Loader2, Lock, Globe, ShieldCheck, Plus, Trash2 } from 'lucide-react';

type VisibilityMode = 'private' | 'public' | 'system';

interface VisibilitySelectorProps {
  mode: VisibilityMode;
  onChange: (mode: VisibilityMode) => void;
  isAdmin?: boolean;
  isEditingSystem?: boolean;
}

function VisibilitySelector({
  mode,
  onChange,
  isAdmin = false,
  isEditingSystem = false,
}: VisibilitySelectorProps) {
  return (
    <div className="retro-callout-mint p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#2B5A47] dark:text-[#A3BDA8]">
          Quyền Hiển Thị &amp; Chia Sẻ
        </span>
        <span className="text-[11px] text-[#5B776A] dark:text-[#B8BDB5]">
          Mặc định luôn là Riêng tư
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isEditingSystem && (
          <>
            <button
              type="button"
              onClick={() => onChange('private')}
              className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                mode === 'private'
                  ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#1F533E] dark:text-[#E4E1D8]'
                  : 'bg-[#FFFDF7] dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4E6E60] dark:text-[#B8BDB5]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Riêng tư (chỉ mình tôi)
            </button>

            <button
              type="button"
              onClick={() => onChange('public')}
              className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                mode === 'public'
                  ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#1F533E] dark:text-[#E4E1D8]'
                  : 'bg-[#FFFDF7] dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4E6E60] dark:text-[#B8BDB5]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Công khai (cộng đồng xem)
            </button>
          </>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => onChange('system')}
            className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              mode === 'system'
                ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#1F533E] dark:text-[#E4E1D8]'
                : 'bg-[#FFFDF7] dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4E6E60] dark:text-[#B8BDB5]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Nội dung Hệ thống (Admin)
          </button>
        )}
      </div>

      <p className="text-[11px] text-[#587568] dark:text-[#B8BDB5] leading-relaxed">
        {mode === 'system'
          ? 'Đồng bộ và hiển thị chính thức cho tất cả người dùng (kể cả khách chưa đăng nhập). Chỉ Admin mới được sửa hoặc xóa.'
          : mode === 'public'
            ? 'Mọi người truy cập đều có thể xem và tương tác. Chỉ bạn (tác giả) được quyền chỉnh sửa hoặc xóa.'
            : 'Chỉ hiển thị riêng trong tài khoản của bạn và đồng bộ giữa Edge, Chrome và các thiết bị bạn đăng nhập.'}
      </p>
    </div>
  );
}

interface CharacterFormProps {
  initialData?: Character;
  onSave: (data: Omit<Character, 'id' | 'createdAt'> & { id?: string }) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  canPublish?: boolean;
  isAdmin?: boolean;
}

const CHARACTER_EMOJI_GROUPS: Array<{ id: string; label: string; emojis: string[] }> = [
  {
    id: 'people',
    label: 'Nhân vật',
    emojis: ['🤵', '👰', '🤴', '👸', '🧛', '🧚', '🧜', '🧝', '🧙', '🥷', '🕵️', '👩‍⚕️', '👨‍⚖️', '👩‍🎨', '👩‍🎓', '🧑‍💻', '🦹', '🦸', '👼', '😈'],
  },
  {
    id: 'animals',
    label: 'Thú & Linh vật',
    emojis: ['🦊', '🐺', '🐱', '🐶', '🐰', '🐻', '🐼', '🦁', '🐯', '🦌', '🦢', '🦉', '🦋', '🐉', '🦄', '🐍', '🐈‍⬛', '🕊️', '🦈', '🦜'],
  },
  {
    id: 'mood',
    label: 'Cảm xúc & Tình cảm',
    emojis: ['🖤', '❤️‍🔥', '🥀', '🌹', '💔', '💘', '💌', '💋', '🥂', '💍', '🎀', '🕯️', '🎭', '👑', '💎', '⛓️', '🩸', '💫', '✨', '🌙'],
  },
  {
    id: 'nature',
    label: 'Thiên nhiên & Vũ trụ',
    emojis: ['🍀', '☘️', '🌸', '🌺', '🌻', '🌷', '🌿', '🍁', '❄️', '🌊', '🌌', '⭐', '☀️', '🌈', '🔥', '⚡', '🌧️', '☁️', '🪐', '🔮'],
  },
  {
    id: 'objects',
    label: 'Đồ vật & Sáng tạo',
    emojis: ['✍️', '📖', '📜', '✒️', '🎸', '🎻', '🎹', '🎧', '📷', '🎨', '⚔️', '🗡️', '🛡️', '🗝️', '⏳', '🧭', '☕', '🍵', '🧁', '🍰'],
  },
];

const NOTE_EMOJI_GROUPS: Array<{ id: string; label: string; emojis: string[] }> = [
  {
    id: 'popular',
    label: 'Phổ biến',
    emojis: ['☘️', '🍀', '📝', '💡', '🤖', '👑', '🔑', '🎯', '🔥', '🛡️', '⚙️', '💬', '📢', '📌', '📈', '🚀'],
  },
  {
    id: 'story',
    label: 'Kịch bản & Cảm xúc',
    emojis: ['🎭', '❤️‍🔥', '🥀', '💌', '📞', '📱', '🕯️', '🌙', '⚡', '💥', '🥀', '🦋', '💔', '🥂', '🎀', '🔮'].filter(
      (v, i, a) => a.indexOf(v) === i,
    ),
  },
  {
    id: 'tools',
    label: 'Hệ thống & HUD',
    emojis: ['📊', '🧠', '⏱️', '🧹', '🔓', '🔄', '🔍', '📥', '🧩', '🗂️', '🧭', '🛠️', '📡', '💻', '🧪', '🧾'],
  },
  {
    id: 'creative',
    label: 'Sáng tạo & Đời sống',
    emojis: ['✍️', '📖', '🎨', '🎬', '🎧', '📷', '🌸', '✨', '⭐', '🌈', '☕', '🍰', '🏫', '💘', '💎', '🌟'],
  },
];

function limitEmojiInput(raw: string): string {
  return Array.from(raw).slice(0, 8).join('');
}

const LABEL_CLASS = 'block text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8] mb-1.5';
const INPUT_CLASS = 'retro-input w-full px-3 py-2 text-xs sm:text-sm font-medium transition-theme';

export function CharacterForm({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  canPublish = false,
  isAdmin = false,
}: CharacterFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [role, setRole] = useState(initialData?.role || '');
  const [avatar, setAvatar] = useState(initialData?.avatar || '🍀');
  const [emojiCategory, setEmojiCategory] = useState(CHARACTER_EMOJI_GROUPS[0].id);
  const [description, setDescription] = useState(initialData?.description || '');
  
  const [author, setAuthor] = useState(initialData?.author || '');
  const [fbName, setFbName] = useState(() => {
    if (initialData?.fb && typeof initialData.fb === 'object') return initialData.fb.name;
    return '';
  });
  const [fbUrl, setFbUrl] = useState(() => {
    if (initialData?.fb && typeof initialData.fb === 'object') return initialData.fb.url;
    if (typeof initialData?.fb === 'string') return initialData.fb;
    return '';
  });
  const [discordName, setDiscordName] = useState(() => {
    if (initialData?.discord && typeof initialData.discord === 'object') return initialData.discord.name;
    return '';
  });
  const [discordUrl, setDiscordUrl] = useState(() => {
    if (initialData?.discord && typeof initialData.discord === 'object') return initialData.discord.url;
    if (typeof initialData?.discord === 'string') return initialData.discord;
    return '';
  });
  const [ggai, setGgai] = useState(initialData?.ggai || '');
  const [backstoryUser, setBackstoryUser] = useState(initialData?.backstoryUser || '');
  const [backstoryChar, setBackstoryChar] = useState(initialData?.backstoryChar || '');
  const [backstoryUserTitle, setBackstoryUserTitle] = useState(initialData?.backstoryUserTitle || '');
  const [backstoryCharTitle, setBackstoryCharTitle] = useState(initialData?.backstoryCharTitle || '');
  const [userProfile, setUserProfile] = useState(initialData?.userProfile || '');
  const [userProfileTitle, setUserProfileTitle] = useState(initialData?.userProfileTitle || '');
  const [prompt, setPrompt] = useState(initialData?.prompt || '');
  const [visibility, setVisibility] = useState<VisibilityMode>(() => {
    if (initialData?.isSystem) return 'system';
    if (initialData?.isPublic) return 'public';
    return 'private';
  });

  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) return setError('Vui lòng nhập tên nhân vật');

    let finalRole = role.trim();
    if (!finalRole) {
      finalRole = 'Độc lập / Tự do thoại / Nhập vai';
    }

    let finalDescription = description.trim();
    if (!finalDescription) {
      finalDescription = `Mô tả sự nghiệp, tính cách hoặc bối cảnh cốt truyện của ${name.trim()} chưa được thiết lập chi tiết. Nhân vật sẵn sàng đồng hành nhập vai cùng bạn.`;
    }

    const effectiveVisibility: VisibilityMode =
      visibility === 'system' && !isAdmin ? 'private' : visibility;

    onSave({
      id: initialData?.id,
      name: name.trim(),
      role: finalRole,
      avatar,
      description: finalDescription,
      author: author.trim() || undefined,
      fb: fbUrl.trim() ? { name: fbName.trim() || 'Facebook', url: fbUrl.trim() } : undefined,
      discord: discordUrl.trim() ? { name: discordName.trim() || 'Discord', url: discordUrl.trim() } : undefined,
      ggai: ggai.trim() || undefined,
      backstoryUser: backstoryUser.trim() || undefined,
      backstoryChar: backstoryChar.trim() || undefined,
      backstoryUserTitle: backstoryUserTitle.trim() || undefined,
      backstoryCharTitle: backstoryCharTitle.trim() || undefined,
      userProfile: userProfile.trim() || undefined,
      userProfileTitle: userProfileTitle.trim() || undefined,
      prompt: prompt.trim() || undefined,
      isSystem: canPublish ? effectiveVisibility === 'system' : undefined,
      isPublic: canPublish
        ? effectiveVisibility === 'public' || effectiveVisibility === 'system'
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="retro-window overflow-hidden animate-fade-in">
      <div className="retro-window-header px-4 py-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
          {initialData ? 'Chỉnh Sửa Nhân Vật' : 'Tạo Nhân Vật Mới'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {error && (
          <p className="px-3 py-2 rounded-md border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-semibold">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Tên Nhân Vật *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Cố Kình Thương, Cố vấn Tài chính..."
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Tag (Chủ đề / Vai trò)</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Ví dụ: Papa, Thao túng, Chiều chuộng... (Để trống sẽ tự định dạng)"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Tác Giả / Người Sáng Tạo</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ví dụ: Tinh Âm"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Google AI Studio Prompt Link (GGAI)</label>
            <input
              type="text"
              value={ggai}
              onChange={(e) => setGgai(e.target.value)}
              placeholder="Dán link GGAI tại đây..."
              className={`${INPUT_CLASS} font-mono text-xs`}
            />
          </div>
        </div>

        <div className="retro-callout-mint p-3.5 space-y-3">
          <h4 className="text-[11px] font-bold text-[#2B5A47] dark:text-[#A3BDA8] uppercase tracking-wider">
            Mạng Xã Hội Liên Kết
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[#4E6E60] dark:text-[#B8BDB5]">Facebook (Tên Hiển Thị)</label>
              <input
                type="text"
                value={fbName}
                onChange={(e) => setFbName(e.target.value)}
                placeholder="Góc Tam Quan Lệch Của Tinh Âm"
                className="retro-input w-full px-3 py-1.5 text-xs"
              />
              <label className="block text-[11px] font-semibold text-[#4E6E60] dark:text-[#B8BDB5] pt-1">Facebook (Link URL)</label>
              <input
                type="text"
                value={fbUrl}
                onChange={(e) => setFbUrl(e.target.value)}
                placeholder="https://facebook.com/..."
                className="retro-input w-full px-3 py-1.5 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[#4E6E60] dark:text-[#B8BDB5]">Discord (Tên Hiển Thị)</label>
              <input
                type="text"
                value={discordName}
                onChange={(e) => setDiscordName(e.target.value)}
                placeholder="🌸Vườn Nhỏ Dưới Tán Anh Đào🌸"
                className="retro-input w-full px-3 py-1.5 text-xs"
              />
              <label className="block text-[11px] font-semibold text-[#4E6E60] dark:text-[#B8BDB5] pt-1">Discord (Link URL)</label>
              <input
                type="text"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                placeholder="https://discord.com/..."
                className="retro-input w-full px-3 py-1.5 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <label className="block text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8]">
              Nhóm Emoji Đại Diện
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#587568] dark:text-[#B8BDB5]">Đang chọn:</span>
              <span className="w-7 h-7 rounded-md bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] flex items-center justify-center text-base">
                {avatar || '🍀'}
              </span>
            </div>
          </div>

          <div className="retro-callout-mint p-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#CBE0D3] dark:border-[#49554D]">
              {CHARACTER_EMOJI_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setEmojiCategory(group.id)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition cursor-pointer ${
                    emojiCategory === group.id
                      ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8]'
                      : 'bg-[#FFF9EA] dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4E6E60] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/60 dark:hover:bg-[#343D37]'
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(CHARACTER_EMOJI_GROUPS.find((g) => g.id === emojiCategory) ?? CHARACTER_EMOJI_GROUPS[0]).emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  className={`text-xl w-9 h-9 flex items-center justify-center rounded-md border transition cursor-pointer ${
                    avatar === emoji
                      ? 'bg-[#39755D] border-[#2B5A47] text-white'
                      : 'border-transparent hover:border-[#9FC4AF] hover:bg-[#FFF9EA] dark:hover:bg-[#343D37]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(limitEmojiInput(e.target.value))}
                placeholder="Tự nhập"
                className="retro-input w-20 h-9 px-2 text-center text-base"
                title="Nhập hoặc dán bất kỳ emoji nào bạn muốn"
              />
            </div>
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Mô Tả / Giới Thiệu Ngắn (Tự động điền)</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hãy mô tả nhiệm vụ cốt lõi mà AI này đảm nhiệm... (Để trống hệ thống sẽ tự sinh mô tả phù hợp)"
            className={`${INPUT_CLASS} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
              <label className="block text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8]">BACKSTORY (User / Bạn)</label>
              <input
                type="text"
                value={backstoryUserTitle}
                onChange={(e) => setBackstoryUserTitle(e.target.value)}
                placeholder="Tiêu đề tùy chọn"
                className="retro-input text-[10px] px-2 py-0.5 w-full sm:w-auto sm:max-w-[190px]"
              />
            </div>
            <textarea
              rows={5}
              value={backstoryUser}
              onChange={(e) => setBackstoryUser(e.target.value)}
              placeholder="Bối cảnh của User như thế nào với nhân vật..."
              className="retro-input w-full px-3 py-2 text-xs leading-relaxed resize-y"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
              <label className="block text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8]">BACKSTORY (Nhân Vật)</label>
              <input
                type="text"
                value={backstoryCharTitle}
                onChange={(e) => setBackstoryCharTitle(e.target.value)}
                placeholder="Tiêu đề tùy chọn"
                className="retro-input text-[10px] px-2 py-0.5 w-full sm:w-auto sm:max-w-[190px]"
              />
            </div>
            <textarea
              rows={5}
              value={backstoryChar}
              onChange={(e) => setBackstoryChar(e.target.value)}
              placeholder="Bối cảnh riêng của nhân vật, trải nghiệm quá khứ..."
              className="retro-input w-full px-3 py-2 text-xs leading-relaxed resize-y"
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Prompt Nhập Vai / Hệ Thống Tùy Chỉnh (Optional)</label>
          <textarea
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Nếu để trống, hệ thống sẽ tự động tạo một prompt nhập vai hoàn chỉnh dựa trên Tên, Tags và Bối cảnh (Backstory) của nhân vật..."
            className="retro-input w-full px-3 py-2 font-mono text-xs leading-relaxed resize-y"
          />
          <p className="text-[11px] text-[#587568] dark:text-[#B8BDB5] mt-1 leading-relaxed">
            Phần prompt này sẽ hiển thị kèm nút sao chép nhanh tại trang chi tiết để bạn dán vào các mô hình AI chat nhập vai.
          </p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
            <label className="block text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8]">HỒ SƠ NHÂN VẬT (User / Bạn) (Optional)</label>
            <input
              type="text"
              value={userProfileTitle}
              onChange={(e) => setUserProfileTitle(e.target.value)}
              placeholder="Tiêu đề tùy chọn"
              className="retro-input text-[10px] px-2 py-0.5 w-full sm:w-auto sm:max-w-[220px]"
            />
          </div>
          <textarea
            rows={5}
            value={userProfile}
            onChange={(e) => setUserProfile(e.target.value)}
            placeholder="Mô tả danh tính, ngoại hình, tính cách riêng biệt của bạn để nhân vật đối xử cá nhân hóa..."
            className="retro-input w-full px-3 py-2 text-xs leading-relaxed resize-y"
          />
        </div>

        {canPublish && (
          <VisibilitySelector
            mode={visibility}
            onChange={setVisibility}
            isAdmin={isAdmin}
            isEditingSystem={Boolean(initialData?.isSystem)}
          />
        )}

        <div className="flex gap-2.5 justify-end pt-3 border-t border-[#D4E5DA] dark:border-[#49554D]">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="retro-btn px-4 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="retro-btn-primary px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isSaving ? 'Đang lưu...' : 'Lưu Lại'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ----------------- NOTE FORM (KHO LỆNH) ----------------- */

interface NoteFormProps {
  initialData?: Note;
  characters: Character[];
  onSave: (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  canPublish?: boolean;
  isAdmin?: boolean;
}

export function NoteForm({
  initialData,
  characters,
  onSave,
  onCancel,
  isSaving = false,
  canPublish = false,
  isAdmin = false,
}: NoteFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [command, setCommand] = useState(initialData?.command || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [characterId, setCharacterId] = useState(initialData?.characterId || '');
  const [icon, setIcon] = useState(initialData?.icon || '☘️');
  const [noteEmojiCategory, setNoteEmojiCategory] = useState(NOTE_EMOJI_GROUPS[0].id);
  const [visibility, setVisibility] = useState<VisibilityMode>(() => {
    if (initialData?.isSystem) return 'system';
    if (initialData?.isPublic) return 'public';
    return 'private';
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialData && !characterId && characters.length > 0) {
      setCharacterId(characters[0].id);
    }
  }, [characters, characterId, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề ghi chú');
    if (!command.trim()) return setError('Vui lòng điền nội dung câu lệnh (Prompt)');
    if (!content.trim()) return setError('Vui lòng cung cấp nội dung ghi chú');

    const effectiveVisibility: VisibilityMode =
      visibility === 'system' && !isAdmin ? 'private' : visibility;

    onSave({
      id: initialData?.id,
      title: title.trim(),
      command: command.trim(),
      content: content.trim(),
      characterId: characterId || '',
      icon,
      isSystem: canPublish ? effectiveVisibility === 'system' : undefined,
      isPublic: canPublish
        ? effectiveVisibility === 'public' || effectiveVisibility === 'system'
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="retro-window overflow-hidden animate-fade-in">
      <div className="retro-window-header px-4 py-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
          {initialData ? 'Chỉnh Sửa Ghi Chú / Prompt' : 'Tạo Prompt / Lệnh Mới'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {error && (
          <p className="px-3 py-2 rounded-md border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-semibold">
            {error}
          </p>
        )}

        <div>
          <label className={LABEL_CLASS}>Tiêu đề Ghi chú *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Kịch bản video Tiktok, Sửa lỗi rò rỉ bộ nhớ..."
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Nhân Vật Liên Kết (Tùy chọn)</label>
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">-- Không gắn nhân vật cụ thể (Dùng chung) --</option>
            {characters.map((char) => (
              <option key={char.cloudKey || char.id} value={char.id}>
                {char.avatar} {char.name} ({char.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <label className="block text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8]">
              Icon / Emoji Đại Diện Câu Lệnh
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#587568] dark:text-[#B8BDB5]">Đang chọn:</span>
              <span className="w-7 h-7 rounded-md bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] flex items-center justify-center text-base">
                {icon || '☘️'}
              </span>
            </div>
          </div>

          <div className="retro-callout-mint p-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#CBE0D3] dark:border-[#49554D]">
              {NOTE_EMOJI_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setNoteEmojiCategory(group.id)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition cursor-pointer ${
                    noteEmojiCategory === group.id
                      ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8]'
                      : 'bg-[#FFF9EA] dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4E6E60] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/60 dark:hover:bg-[#343D37]'
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(NOTE_EMOJI_GROUPS.find((g) => g.id === noteEmojiCategory) ?? NOTE_EMOJI_GROUPS[0]).emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`text-xl w-9 h-9 flex items-center justify-center rounded-md border transition cursor-pointer ${
                    icon === emoji
                      ? 'bg-[#39755D] border-[#2B5A47] text-white'
                      : 'border-transparent hover:border-[#9FC4AF] hover:bg-[#FFF9EA] dark:hover:bg-[#343D37]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(limitEmojiInput(e.target.value))}
                placeholder="Tự nhập"
                className="retro-input w-20 h-9 px-2 text-center text-base"
                title="Nhập hoặc dán bất kỳ emoji nào bạn muốn"
              />
            </div>
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Prompt Cần Nhập (Lệnh) *</label>
          <textarea
            rows={4}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Đây là phần câu lệnh chính để copy dán trực tiếp vào AI..."
            className="retro-input w-full px-3 py-2 font-mono text-xs leading-relaxed resize-y"
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Nội dung lệnh / Chi tiết kèm dữ liệu mẫu *</label>
          <textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nêu cụ thể dữ liệu mẫu, thông tin, kịch bản gốc hoặc các quy tắc cụ thể..."
            className="retro-input w-full px-3 py-2 text-xs sm:text-sm leading-relaxed resize-y"
          />
        </div>

        {canPublish && (
          <VisibilitySelector
            mode={visibility}
            onChange={setVisibility}
            isAdmin={isAdmin}
            isEditingSystem={Boolean(initialData?.isSystem)}
          />
        )}

        <div className="flex gap-2.5 justify-end pt-3 border-t border-[#D4E5DA] dark:border-[#49554D]">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="retro-btn px-4 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="retro-btn-primary px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isSaving ? 'Đang lưu...' : 'Lưu Lại'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ----------------- IDEA FORM (KHO IDEA) ----------------- */

interface IdeaFormProps {
  initialData?: Idea;
  onSave: (data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  canPublish?: boolean;
  isAdmin?: boolean;
}

export function IdeaForm({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  canPublish = false,
  isAdmin = false,
}: IdeaFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [visibility, setVisibility] = useState<VisibilityMode>(() => {
    if (initialData?.isSystem) return 'system';
    if (initialData?.isPublic) return 'public';
    return 'private';
  });
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!title.trim()) return setError('Vui lòng cung cấp tiêu đề ý tưởng');
    if (!content.trim()) return setError('Vui lòng viết chi tiết ý tưởng');

    const effectiveVisibility: VisibilityMode =
      visibility === 'system' && !isAdmin ? 'private' : visibility;

    onSave({
      id: initialData?.id,
      title: title.trim(),
      content: content.trim(),
      tags: initialData?.tags || [],
      isSystem: canPublish ? effectiveVisibility === 'system' : undefined,
      isPublic: canPublish
        ? effectiveVisibility === 'public' || effectiveVisibility === 'system'
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="retro-window overflow-hidden animate-fade-in">
      <div className="retro-window-header px-4 py-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
          {initialData ? 'Cập Nhật Ý Tưởng' : 'Gieo Ý Tưởng Mới'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {error && (
          <p className="px-3 py-2 rounded-md border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-semibold">
            {error}
          </p>
        )}

        <div>
          <label className={LABEL_CLASS}>Tiêu Đề Ý Tưởng *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Tắt bật hiệu ứng tuyết rơi, Phát hành bản mobile..."
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Chi Tiết Ý Tưởng Sáng Tạo *</label>
          <textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Viết tất cả những suy tư ngắn, mục tiêu phát triển, kịch bản nảy sinh trong ngày..."
            className="retro-input w-full px-3 py-2 text-xs sm:text-sm leading-relaxed resize-y"
          />
        </div>

        {canPublish && (
          <VisibilitySelector
            mode={visibility}
            onChange={setVisibility}
            isAdmin={isAdmin}
            isEditingSystem={Boolean(initialData?.isSystem)}
          />
        )}

        <div className="flex gap-2.5 justify-end pt-3 border-t border-[#D4E5DA] dark:border-[#49554D]">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="retro-btn px-4 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="retro-btn-primary px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isSaving ? 'Đang lưu...' : 'Lưu Ý Tưởng'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ----------------- LIBRARY PROMPT FORM (ADMIN / KHO LỆNH THƯ VIỆN) ----------------- */

interface LibraryPromptFormProps {
  initialData?: LibraryPrompt;
  onSave: (data: Omit<LibraryPrompt, 'id' | 'createdAt'> & { id?: string }) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  isAdmin?: boolean;
}

export function LibraryPromptForm({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  isAdmin = false,
}: LibraryPromptFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [icon, setIcon] = useState(initialData?.icon || '📚');
  const [author, setAuthor] = useState(initialData?.author || 'Admin SéaClover');
  const [description, setDescription] = useState(initialData?.description || '');
  const [howToUse, setHowToUse] = useState(initialData?.howToUse || '');
  const [tagsInput, setTagsInput] = useState((initialData?.tags || []).join(', '));
  const [steps, setSteps] = useState<PromptStep[]>(() =>
    initialData?.steps && initialData.steps.length > 0
      ? initialData.steps.map((s) => ({ ...s }))
      : [{ label: 'Nội dung câu lệnh', content: '' }],
  );
  const [visibility, setVisibility] = useState<VisibilityMode>(() => {
    if (initialData?.isSystem) return 'system';
    if (initialData?.isPublic) return 'public';
    return isAdmin ? 'system' : 'private';
  });
  const [error, setError] = useState('');

  const handleStepChange = (index: number, field: keyof PromptStep, value: string) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  };

  const handleAddStep = () => {
    setSteps((prev) => [...prev, { label: `Phần ${prev.length + 1}`, content: '' }]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề câu lệnh thư viện');
    const cleanSteps = steps
      .map((s, idx) => ({
        label: s.label.trim() || `Phần ${idx + 1}`,
        content: s.content.trim(),
        ...(s.note?.trim() ? { note: s.note.trim() } : {}),
      }))
      .filter((s) => s.content.length > 0);

    if (cleanSteps.length === 0) {
      return setError('Vui lòng nhập ít nhất một khối câu lệnh có nội dung');
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const effectiveVisibility: VisibilityMode =
      visibility === 'system' && !isAdmin ? 'private' : visibility;

    onSave({
      id: initialData?.id,
      title: title.trim(),
      icon: icon.trim() || '📚',
      author: author.trim() || 'Admin SéaClover',
      description: description.trim() || 'Câu lệnh mẫu trong Kho Lệnh SéaClover.',
      howToUse: howToUse.trim() || 'Sao chép khối câu lệnh và dán vào cuộc trò chuyện AI.',
      tags,
      steps: cleanSteps,
      isSystem: effectiveVisibility === 'system',
      isPublic: effectiveVisibility === 'public' || effectiveVisibility === 'system',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="retro-window overflow-hidden animate-fade-in">
      <div className="retro-window-header px-4 py-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
          {initialData ? 'Chỉnh Sửa Câu Lệnh Hệ Thống (Kho Lệnh)' : 'Đăng Câu Lệnh Hệ Thống (Kho Lệnh)'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="retro-btn p-1 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {error && (
          <p className="px-3 py-2 rounded-md border border-[#dfb4bd] bg-[#fff3f5] dark:bg-[#292E2B] dark:border-[#6B4A4D] text-red-700 dark:text-[#E4A6AA] text-xs font-semibold">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={LABEL_CLASS}>Tiêu Đề Câu Lệnh *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Lệnh Thúc Đẩy Cốt Truyện, Lệnh HUD..."
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Icon Đại Diện</label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(limitEmojiInput(e.target.value))}
              placeholder="📚"
              className={`${INPUT_CLASS} text-center`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Tác Giả / Nguồn</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ví dụ: Nhi Séa / Admin SéaClover"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Tags (phân cách bởi dấu phẩy)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Ví dụ: cốt truyện, drama, hud"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>Thông Tin Công Cụ Lệnh (Mô tả)</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn gọn công dụng của bộ câu lệnh này..."
            className="retro-input w-full px-3 py-2 text-xs sm:text-sm leading-relaxed resize-y"
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Hướng Dẫn Sử Dụng (Cách dùng)</label>
          <textarea
            rows={2}
            value={howToUse}
            onChange={(e) => setHowToUse(e.target.value)}
            placeholder="Hướng dẫn người dùng cách copy và dán câu lệnh vào AI..."
            className="retro-input w-full px-3 py-2 text-xs sm:text-sm leading-relaxed resize-y"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#2B5A47] dark:text-[#A3BDA8]">
              Các Khối Câu Lệnh ({steps.length}) *
            </label>
            <button
              type="button"
              onClick={handleAddStep}
              className="retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm khối lệnh
            </button>
          </div>

          {steps.map((step, idx) => (
            <div key={idx} className="retro-callout-mint p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={step.label}
                  onChange={(e) => handleStepChange(idx, 'label', e.target.value)}
                  placeholder={`Tên khối lệnh ${idx + 1}`}
                  className="retro-input flex-1 px-2.5 py-1 text-xs font-semibold"
                />
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(idx)}
                    className="retro-btn-danger p-1.5 cursor-pointer"
                    title="Xóa khối này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={step.content}
                onChange={(e) => handleStepChange(idx, 'content', e.target.value)}
                placeholder="Nhập nguyên văn nội dung câu lệnh cần sao chép..."
                className="retro-input w-full px-3 py-2 font-mono text-xs leading-relaxed resize-y"
              />
            </div>
          ))}
        </div>

        <VisibilitySelector
          mode={visibility}
          onChange={setVisibility}
          isAdmin={isAdmin}
          isEditingSystem={Boolean(initialData?.isSystem)}
        />

        <div className="flex gap-2.5 justify-end pt-3 border-t border-[#D4E5DA] dark:border-[#49554D]">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="retro-btn px-4 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="retro-btn-primary px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isSaving ? 'Đang lưu...' : 'Lưu Câu Lệnh'}
          </button>
        </div>
      </div>
    </form>
  );
}
