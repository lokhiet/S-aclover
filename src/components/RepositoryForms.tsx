import React, { useState, useEffect } from 'react';
import { Character, Note, Idea } from '../types';
import { Plus, Check, X, Sparkles, Loader2 } from 'lucide-react';

interface CharacterFormProps {
  initialData?: Character;
  onSave: (data: Omit<Character, 'id' | 'createdAt'> & { id?: string }) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

const PRESET_EMOJIS = ['☘️', '🍀', '✍️', '💻', '🎨', '🌱', '🧙', '🦾', '🎓', '💼', '🚀', '🦊', '🦉', '🦁', '🌟', '🧩'];

export function CharacterForm({ initialData, onSave, onCancel, isSaving = false }: CharacterFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [role, setRole] = useState(initialData?.role || '');
  const [avatar, setAvatar] = useState(initialData?.avatar || '🍀');
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
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900/40 p-6 rounded-2xl shadow-sm animate-fade-in max-h-[85vh] overflow-y-auto pr-2">
      <div className="flex items-center justify-between pb-3 border-b border-emerald-50 dark:border-emerald-900/20">
        <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          {initialData ? 'Chỉnh Sửa Nhân Vật' : 'Tạo Nhân Vật Mới'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg text-emerald-600 dark:text-emerald-400 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Tên Nhân Vật *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Cố Kình Thương, Cố vấn Tài chính..."
            className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Tag (Chủ đề / Vai trò)</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ví dụ: Papa, Thao túng, Chiều chuộng... (Để trống sẽ tự định dạng)"
            className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Tác Giả / Người Sáng Tạo</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Ví dụ: Tinh Âm"
            className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Google AI Studio Prompt Link (GGAI)</label>
          <input
            type="text"
            value={ggai}
            onChange={(e) => setGgai(e.target.value)}
            placeholder="Dán link GGAI tại đây..."
            className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition text-xs font-mono"
          />
        </div>
      </div>

      <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-4">
        <h4 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Mạng Xã Hội Liên Kết</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">Facebook (Tên Hiển Thị)</label>
            <input
              type="text"
              value={fbName}
              onChange={(e) => setFbName(e.target.value)}
              placeholder="Góc Tam Quan Lệch Của Tinh Âm"
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
            />
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">Facebook (Link URL)</label>
            <input
              type="text"
              value={fbUrl}
              onChange={(e) => setFbUrl(e.target.value)}
              placeholder="https://facebook.com/..."
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">Discord (Tên Hiển Thị)</label>
            <input
              type="text"
              value={discordName}
              onChange={(e) => setDiscordName(e.target.value)}
              placeholder="🌸Vườn Nhỏ Dưới Tán Anh Đào🌸"
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
            />
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">Discord (Link URL)</label>
            <input
              type="text"
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.com/..."
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none font-mono"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Nhóm Emoji Đại Diện</label>
        <div className="flex flex-wrap gap-2 p-3 bg-emerald-50/50 dark:bg-zinc-950/50 rounded-xl border border-emerald-100/60 dark:border-emerald-900/20">
          {PRESET_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setAvatar(emoji)}
              className={`text-2xl p-2 rounded-xl transition-all ${
                avatar === emoji
                  ? 'bg-emerald-500 text-white scale-110 shadow-md shadow-emerald-500/20'
                  : 'hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 text-zinc-800 dark:text-zinc-300'
              }`}
            >
              {emoji}
            </button>
          ))}
          <input
            type="text"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value.substring(0, 4))}
            placeholder="Icon..."
            className="w-16 px-2 py-1.5 text-center text-xl rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            title="Nhập emoji tùy chọn"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Mô Tả / Giới Thiệu Ngắn (Tự động điền)</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Hãy mô tả nhiệm vụ cốt lõi mà AI này đảm nhiệm... (Để trống hệ thống sẽ tự sinh mô tả phù hợp)"
          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
            <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300">𝑩𝑨𝑪𝑲 𝑺𝑻𝑶𝑹𝒀 (User / Bạn)</label>
            <input
              type="text"
              value={backstoryUserTitle}
              onChange={(e) => setBackstoryUserTitle(e.target.value)}
              placeholder="Tiêu đề tùy chọn (Mặc định: 📖 BACKSTORY (user))"
              className="text-[9px] px-2 py-0.5 w-full sm:w-auto sm:max-w-[200px] border border-emerald-100 dark:border-emerald-900/50 rounded-md bg-stone-50 text-stone-600 dark:bg-stone-900 dark:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            />
          </div>
          <textarea
            rows={6}
            value={backstoryUser}
            onChange={(e) => setBackstoryUser(e.target.value)}
            placeholder="Bối cảnh của User như thế nào với nhân vật..."
            className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition resize-y text-xs leading-relaxed font-sans"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
            <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300">𝑩𝑨𝑪𝑲 𝑺𝑻𝑶𝑹𝒀 (Character / Nhân Vật)</label>
            <input
              type="text"
              value={backstoryCharTitle}
              onChange={(e) => setBackstoryCharTitle(e.target.value)}
              placeholder="Tiêu đề tùy chọn (Mặc định: 👤 BAGKSTORY)"
              className="text-[9px] px-2 py-0.5 w-full sm:w-auto sm:max-w-[200px] border border-emerald-100 dark:border-emerald-900/50 rounded-md bg-stone-50 text-stone-600 dark:bg-stone-900 dark:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            />
          </div>
          <textarea
            rows={6}
            value={backstoryChar}
            onChange={(e) => setBackstoryChar(e.target.value)}
            placeholder="Bối cảnh riêng của nhân vật, trải nghiệm quá khứ..."
            className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition resize-y text-xs leading-relaxed font-sans"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">
          📄 Prompt Nhập Vai / Hệ Thống Tùy Chỉnh (Optional)
        </label>
        <textarea
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Nếu để trống, hệ thống sẽ tự động tạo một prompt nhập vai hoàn chỉnh dựa trên Tên, Tags và Bối cảnh (Backstory) của nhân vật..."
          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition resize-y text-xs leading-relaxed font-mono"
        />
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
          Phần prompt này sẽ được hiển thị kèm nút sao chép nhanh tại trang chi tiết để bạn dễ dàng dán vào các mô hình AI chat nhập vai (như Gemini, ChatGPT, Claude).
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
          <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300">👤 𝑯𝑶̂̀ 𝑺𝑶̛ 𝑵𝑯𝑨̂𝑵 𝑽𝑨̂𝑻 (User / Bạn) (Optional)</label>
          <input
            type="text"
            value={userProfileTitle}
            onChange={(e) => setUserProfileTitle(e.target.value)}
            placeholder="Tiêu đề tùy chọn (Mặc định: 👤 HỒ SƠ NHÂN VẬT: {{USER}})"
            className="text-[9px] px-2 py-0.5 w-full sm:w-auto sm:max-w-[250px] border border-emerald-100 dark:border-emerald-900/50 rounded-md bg-stone-50 text-stone-600 dark:bg-stone-900 dark:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
          />
        </div>
        <textarea
          rows={6}
          value={userProfile}
          onChange={(e) => setUserProfile(e.target.value)}
          placeholder="Mô tả danh tính, ngoại hình, tính cách riêng biệt của bạn để nhân vật đối xử cá nhân hóa..."
          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition resize-y text-xs leading-relaxed font-sans"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-emerald-50 dark:border-emerald-900/20">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium transition disabled:opacity-50"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 shadow-md shadow-emerald-600/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Đang lưu...' : 'Lưu Lại'}
        </button>
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
}

export function NoteForm({ initialData, characters, onSave, onCancel, isSaving = false }: NoteFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [command, setCommand] = useState(initialData?.command || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [characterId, setCharacterId] = useState(initialData?.characterId || '');
  const [icon, setIcon] = useState(initialData?.icon || '☘️');
  const [error, setError] = useState('');

  useEffect(() => {
    // Select first character available if none selected
    if (!characterId && characters.length > 0) {
      setCharacterId(characters[0].id);
    }
  }, [characters, characterId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề ghi chú');
    if (!command.trim()) return setError('Vui lòng điền nội dung câu lệnh (Prompt)');
    if (!content.trim()) return setError('Vui lòng cung cấp nội dung ghi chú');
    if (!characterId) return setError('Vui lòng chọn một nhân vật cho prompt này');

    onSave({
      id: initialData?.id,
      title: title.trim(),
      command: command.trim(),
      content: content.trim(),
      characterId,
      icon,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-emerald-950/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-emerald-50 dark:border-emerald-900/20">
        <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          {initialData ? 'Chỉnh Sửa Ghi Chú/Prompt' : 'Tạo Prompt/Lệnh Mới'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 rounded-lg text-emerald-600 dark:text-emerald-400 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Tiêu đề Ghi chú *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Kịch bản video Tiktok, Sửa lỗi rò rỉ bộ nhớ..."
          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Nhân Vật Đảm Nhiệm (Character) *</label>
        {characters.length === 0 ? (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-xl">
            Không tìm thấy nhân vật nào. Hãy sang kho nhân vật thêm trước để chọn liên kết prompt nhé!
          </div>
        ) : (
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition"
          >
            {characters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.avatar} {char.name} ({char.role})
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Icon/Emoji Đại Diện Câu Lệnh</label>
        <div className="flex flex-wrap gap-2 p-3 bg-emerald-50/50 dark:bg-zinc-900/60 rounded-xl border border-emerald-100/60 dark:border-emerald-900/20">
          {['☘️', '📝', '💡', '🤖', '👑', '🔑', '🎯', '🔥', '🛡️', '⚙️', '💬', '📢', '📌', '📈', '🚀', '🔮'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setIcon(emoji)}
              className={`text-2xl p-2 rounded-xl transition-all ${
                icon === emoji
                  ? 'bg-emerald-500 text-white scale-110 shadow-md shadow-emerald-500/20'
                  : 'hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 text-zinc-800 dark:text-zinc-300'
              }`}
            >
              {emoji}
            </button>
          ))}
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value.substring(0, 4))}
            placeholder="Custom..."
            className="w-16 px-2 py-1.5 text-center text-xl rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            title="Nhập emoji tùy chọn"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Prompt Cần Nhập (Lệnh) *</label>
        <textarea
          rows={3}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Đây là phần câu lệnh chính để copy dán trực tiếp vào AI (e.g. Hãy đóng vai là chuyên gia marketing...)"
          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition resize-y font-mono text-sm leading-relaxed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Nội dung lệnh/Nêu chi tiết kèm dữ liệu mẫu *</label>
        <textarea
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nêu cụ thể dữ liệu mẫu, thông tin sản phẩm, kịch bản gốc hoặc các quy tắc cụ thể cho khối nhiệm vụ này..."
          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition resize-y leading-relaxed"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-emerald-50 dark:border-emerald-900/20">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium transition disabled:opacity-50"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 shadow-md shadow-emerald-600/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Đang lưu...' : 'Lưu Lại'}
        </button>
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
}

export function IdeaForm({ initialData, onSave, onCancel, isSaving = false }: IdeaFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!title.trim()) return setError('Vui lòng cung cấp tiêu đề ý tưởng');
    if (!content.trim()) return setError('Vui lòng viết chi tiết ý tưởng');

    onSave({
      id: initialData?.id,
      title: title.trim(),
      content: content.trim(),
      tags: initialData?.tags || [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-emerald-950/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-emerald-50 dark:border-emerald-900/20">
        <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          {initialData ? 'Cập Nhật Ý Tưởng' : 'Gieo Ý Tưởng Mới'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 rounded-lg text-emerald-600 dark:text-emerald-400 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Tiêu Đề Ý Tưởng *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Tắt bật hiệu ứng tuyết rơi, Phát hành bản mobile..."
          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-2">Chi Tiết Ý Tưởng Sáng Tạo *</label>
        <textarea
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Viết tất cả những suy tư ngắn, mục tiêu phát triển, kịch bản nảy sinh trong ngày..."
          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition resize-y leading-relaxed"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-emerald-50 dark:border-emerald-900/20">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium transition disabled:opacity-50"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 shadow-md shadow-emerald-600/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {isSaving ? 'Đang lưu...' : 'Lưu Ý Tưởng'}
        </button>
      </div>
    </form>
  );
}
