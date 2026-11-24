import {
  MAX_CHARACTER_IMAGES,
  type Character,
  type CharacterImage,
  type CharacterSocialLink,
  type LibraryPrompt,
  type Note,
  type PromptBlock,
  type PromptBlockType,
  type PromptStep,
  type SocialPlatform,
} from '../types';

export const NOTE_V2_PREFIX = '__SEACLOVER_NOTE_V2__:';

export const SOCIAL_PLATFORM_OPTIONS: Array<{
  id: SocialPlatform;
  label: string;
  placeholder: string;
  defaultDisplayName: string;
}> = [
  {
    id: 'facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/...',
    defaultDisplayName: 'Facebook',
  },
  {
    id: 'discord',
    label: 'Discord',
    placeholder: 'https://discord.gg/... hoặc https://discord.com/...',
    defaultDisplayName: 'Discord',
  },
  {
    id: 'google_ai_studio',
    label: 'Google AI Studio',
    placeholder: 'https://aistudio.google.com/...',
    defaultDisplayName: 'Google AI Studio',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    placeholder: 'https://gemini.google.com/...',
    defaultDisplayName: 'Gemini',
  },
  {
    id: 'google_drive',
    label: 'Google Drive',
    placeholder: 'https://drive.google.com/...',
    defaultDisplayName: 'Google Drive',
  },
  {
    id: 'github',
    label: 'GitHub',
    placeholder: 'https://github.com/...',
    defaultDisplayName: 'GitHub',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@...',
    defaultDisplayName: 'TikTok',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/...',
    defaultDisplayName: 'Instagram',
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    placeholder: 'https://x.com/...',
    defaultDisplayName: 'X',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@...',
    defaultDisplayName: 'YouTube',
  },
  {
    id: 'weibo',
    label: 'Weibo',
    placeholder: 'https://weibo.com/...',
    defaultDisplayName: 'Weibo',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    placeholder: 'https://reddit.com/r/...',
    defaultDisplayName: 'Reddit',
  },
  {
    id: 'website',
    label: 'Website khác',
    placeholder: 'https://...',
    defaultDisplayName: 'Website',
  },
  {
    id: 'other',
    label: 'Khác',
    placeholder: 'https://...',
    defaultDisplayName: 'Liên kết',
  },
];

const VALID_PLATFORMS = new Set<SocialPlatform>([
  'facebook',
  'discord',
  'google_ai_studio',
  'gemini',
  'google_drive',
  'github',
  'tiktok',
  'instagram',
  'x',
  'youtube',
  'weibo',
  'reddit',
  'website',
  'other',
]);

export function createSocialLinkId(): string {
  return `soc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isSafeExternalHttpUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeImageUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSafeDataImageUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(rawUrl.trim());
}

export function getSocialPlatformLabel(platform: SocialPlatform): string {
  return SOCIAL_PLATFORM_OPTIONS.find((opt) => opt.id === platform)?.label || 'Khác';
}

function extractUrlHost(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0];
  }
}

function hostMatches(host: string, domains: string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function detectSocialPlatformFromUrl(
  url: string,
  fallback: SocialPlatform = 'website',
): SocialPlatform {
  const host = extractUrlHost(url);
  if (!host) return fallback;

  // Phân biệt rõ từng dịch vụ thuộc Google trước
  if (hostMatches(host, ['aistudio.google.com', 'makersuite.google.com'])) {
    return 'google_ai_studio';
  }
  if (hostMatches(host, ['gemini.google.com'])) {
    return 'gemini';
  }
  if (
    hostMatches(host, [
      'drive.google.com',
      'docs.google.com',
      'sheets.google.com',
      'slides.google.com',
      'forms.gle',
    ])
  ) {
    return 'google_drive';
  }

  if (hostMatches(host, ['facebook.com', 'fb.com', 'fb.watch', 'fb.me'])) {
    return 'facebook';
  }
  if (hostMatches(host, ['discord.com', 'discord.gg', 'discordapp.com'])) {
    return 'discord';
  }
  if (hostMatches(host, ['github.com', 'gist.github.com', 'github.io'])) {
    return 'github';
  }
  if (hostMatches(host, ['tiktok.com'])) {
    return 'tiktok';
  }
  if (hostMatches(host, ['instagram.com', 'instagr.am'])) {
    return 'instagram';
  }
  if (hostMatches(host, ['x.com', 'twitter.com', 't.co'])) {
    return 'x';
  }
  if (hostMatches(host, ['youtube.com', 'youtu.be'])) {
    return 'youtube';
  }
  if (hostMatches(host, ['weibo.com', 'weibo.cn'])) {
    return 'weibo';
  }
  if (hostMatches(host, ['reddit.com', 'redd.it'])) {
    return 'reddit';
  }
  return fallback;
}

function sanitizeSocialLinksArray(raw: unknown): CharacterSocialLink[] {
  if (!Array.isArray(raw)) return [];
  const result: CharacterSocialLink[] = [];
  raw.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const item = entry as {
      id?: unknown;
      platform?: unknown;
      url?: unknown;
      label?: unknown;
    };
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    if (!url) return;
    const platformRaw = typeof item.platform === 'string' ? item.platform : 'other';
    const platform: SocialPlatform = VALID_PLATFORMS.has(platformRaw as SocialPlatform)
      ? (platformRaw as SocialPlatform)
      : detectSocialPlatformFromUrl(url, 'other');
    const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : undefined;
    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : `soc-restored-${idx}`;
    result.push({ id, platform, url, label });
  });
  return result;
}

function extractLegacySlot(
  slot: { name: string; url: string } | string | undefined,
  defaultPlatform: SocialPlatform,
  defaultName: string,
  slotId: string,
): CharacterSocialLink | null {
  if (!slot) return null;
  if (typeof slot === 'string') {
    const trimmed = slot.trim();
    if (!trimmed) return null;
    return {
      id: slotId,
      platform: detectSocialPlatformFromUrl(trimmed, defaultPlatform),
      url: trimmed,
      label: defaultName,
    };
  }
  const url = typeof slot.url === 'string' ? slot.url.trim() : '';
  if (!url) return null;
  const label = typeof slot.name === 'string' && slot.name.trim() ? slot.name.trim() : undefined;
  return {
    id: slotId,
    platform: detectSocialPlatformFromUrl(url, defaultPlatform),
    url,
    label: label || defaultName,
  };
}

/**
 * Đọc danh sách mạng xã hội từ Character (tương thích ngược tuyệt đối cả dữ liệu cũ & mới).
 */
export function getCharacterSocialLinks(char?: Partial<Character> | null): CharacterSocialLink[] {
  if (!char) return [];

  if (Array.isArray(char.socialLinks)) {
    return sanitizeSocialLinksArray(char.socialLinks);
  }

  if (char.other && typeof char.other === 'object' && Array.isArray(char.other.links)) {
    return sanitizeSocialLinksArray(char.other.links);
  }

  const legacyLinks: CharacterSocialLink[] = [];
  const fbLink = extractLegacySlot(
    char.fb,
    'facebook',
    'Góc Tam Quan Lệch Của Tinh Âm',
    'legacy-fb',
  );
  if (fbLink) legacyLinks.push(fbLink);

  const discordLink = extractLegacySlot(
    char.discord,
    'discord',
    '🌸Vườn Nhỏ Dưới Tán Anh Đào🌸',
    'legacy-discord',
  );
  if (discordLink) legacyLinks.push(discordLink);

  const discord2Link = extractLegacySlot(char.discord2, 'discord', 'Discord', 'legacy-discord2');
  if (discord2Link) legacyLinks.push(discord2Link);

  const webLink = extractLegacySlot(char.web, 'website', 'Website', 'legacy-web');
  if (webLink) legacyLinks.push(webLink);

  const otherLink = extractLegacySlot(char.other, 'other', 'Website', 'legacy-other');
  if (otherLink) legacyLinks.push(otherLink);

  return legacyLinks;
}

/**
 * Đồng bộ danh sách mạng xã hội động về trường `socialLinks` và các cột legacy (`fb`, `discord`, `discord2`, `web`, `other`)
 * để lưu không cần chỉnh sửa schema bảng `user_characters` trên Supabase.
 */
export function applySocialLinksToCharacter<T extends Partial<Character>>(
  links: CharacterSocialLink[],
  base: T,
): T & Pick<Character, 'socialLinks' | 'fb' | 'discord' | 'discord2' | 'web' | 'other'> {
  const cleanLinks = sanitizeSocialLinksArray(links);

  if (cleanLinks.length === 0) {
    return {
      ...base,
      socialLinks: [],
      fb: undefined,
      discord: undefined,
      discord2: undefined,
      web: undefined,
      other: undefined,
    };
  }

  let fb: Character['fb'];
  let discord: Character['discord'];
  let discord2: Character['discord2'];
  let web: Character['web'];
  let primaryOther: { name: string; url: string } | null = null;

  for (const link of cleanLinks) {
    const displayName = link.label?.trim() || getSocialPlatformLabel(link.platform);
    const pair = { name: displayName, url: link.url };
    if (link.platform === 'facebook' && !fb) {
      fb = pair;
    } else if (link.platform === 'discord' && !discord) {
      discord = pair;
    } else if (link.platform === 'discord' && !discord2) {
      discord2 = pair;
    } else if (link.platform === 'website' && !web) {
      web = pair;
    } else if (!primaryOther) {
      primaryOther = pair;
    }
  }

  return {
    ...base,
    socialLinks: cleanLinks,
    fb,
    discord,
    discord2,
    web,
    other: {
      name: primaryOther?.name || '',
      url: primaryOther?.url || '',
      links: cleanLinks,
    },
  };
}

// ----------------------------------------------------------------------------
// Character Images Helpers (0..5 ảnh, tương thích ngược dữ liệu cũ)
// ----------------------------------------------------------------------------

export function createCharacterImageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cimg-${crypto.randomUUID()}`;
  }
  return `cimg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeCharacterImages(raw: unknown): CharacterImage[] {
  if (!Array.isArray(raw)) return [];
  const normalized: CharacterImage[] = [];
  const seenIds = new Set<string>();
  const seenSources = new Set<string>();

  for (let idx = 0; idx < raw.length; idx += 1) {
    if (normalized.length >= MAX_CHARACTER_IMAGES) break;
    const entry = raw[idx];

    // Tương thích chuỗi URL / data URL từ phiên bản cũ
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (!isSafeImageUrl(trimmed) && !isSafeDataImageUrl(trimmed)) continue;
      const srcKey = `url:${trimmed}`;
      if (seenSources.has(srcKey)) continue;
      seenSources.add(srcKey);
      normalized.push({
        id: `cimg-legacy-${idx}`,
        url: trimmed,
      });
      continue;
    }

    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const storagePath =
      typeof obj.storagePath === 'string' && obj.storagePath.trim()
        ? obj.storagePath.trim()
        : undefined;
    const localId =
      typeof obj.localId === 'string' && obj.localId.trim() ? obj.localId.trim() : undefined;
    const rawUrl = typeof obj.url === 'string' ? obj.url.trim() : undefined;
    const safeUrl =
      rawUrl && (isSafeImageUrl(rawUrl) || isSafeDataImageUrl(rawUrl)) ? rawUrl : undefined;

    if (!storagePath && !localId && !safeUrl) continue;

    const srcKey = storagePath
      ? `sp:${storagePath}`
      : localId
        ? `loc:${localId}`
        : `url:${safeUrl}`;
    if (seenSources.has(srcKey)) continue;
    seenSources.add(srcKey);

    let id =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim()
        : `cimg-restored-${idx}`;
    if (seenIds.has(id)) {
      id = `${id}-${idx}`;
    }
    seenIds.add(id);

    const img: CharacterImage = { id };
    if (storagePath) img.storagePath = storagePath;
    if (localId) img.localId = localId;
    if (safeUrl) img.url = safeUrl;
    if (typeof obj.mimeType === 'string' && obj.mimeType.trim()) {
      img.mimeType = obj.mimeType.trim();
    }
    if (typeof obj.width === 'number' && Number.isFinite(obj.width) && obj.width > 0) {
      img.width = Math.round(obj.width);
    }
    if (typeof obj.height === 'number' && Number.isFinite(obj.height) && obj.height > 0) {
      img.height = Math.round(obj.height);
    }
    if (typeof obj.name === 'string' && obj.name.trim()) {
      img.name = obj.name.trim().slice(0, 120);
    }
    normalized.push(img);
  }

  return normalized;
}

/**
 * Đọc danh sách 0..5 ảnh của nhân vật, hỗ trợ cả cấu trúc mới (`images`)
 * lẫn các trường legacy nếu tồn tại trong bản sao lưu cũ (`imageUrls`, `avatarImage`).
 */
export function getCharacterImages(
  char?: (Partial<Character> & { imageUrls?: unknown; avatarImage?: unknown }) | null,
): CharacterImage[] {
  if (!char) return [];
  if (Array.isArray(char.images) && char.images.length > 0) {
    return normalizeCharacterImages(char.images);
  }
  const fallbackList: unknown[] = [];
  if (typeof char.avatarImage === 'string' && char.avatarImage.trim()) {
    fallbackList.push(char.avatarImage);
  }
  if (Array.isArray(char.imageUrls)) {
    fallbackList.push(...char.imageUrls);
  }
  if (fallbackList.length > 0) {
    return normalizeCharacterImages(fallbackList);
  }
  return [];
}

// ----------------------------------------------------------------------------
// Flexible Kho Lệnh Block Helpers (Note & LibraryPrompt)
// ----------------------------------------------------------------------------

export const PROMPT_BLOCK_META: Record<
  PromptBlockType,
  {
    label: string;
    shortLabel: string;
    defaultTitle: string;
    description: string;
    contentPlaceholder: string;
    supportsAutoNumber: boolean;
  }
> = {
  prompt: {
    label: 'Câu lệnh (Prompt)',
    shortLabel: 'Câu lệnh',
    defaultTitle: 'Câu lệnh chính',
    description: 'Khối lệnh có nút Hiện/Ẩn và Sao chép riêng biệt.',
    contentPlaceholder: 'Nhập nguyên văn câu lệnh cần sao chép dán vào AI...',
    supportsAutoNumber: true,
  },
  guide: {
    label: 'Hướng dẫn',
    shortLabel: 'Hướng dẫn',
    defaultTitle: 'Hướng dẫn thực hiện',
    description: 'Trình bày cách dùng hoặc hướng dẫn từng bước.',
    contentPlaceholder: 'Viết hướng dẫn chi tiết cách sử dụng, thứ tự dán hoặc mẹo tùy chỉnh...',
    supportsAutoNumber: true,
  },
  note: {
    label: 'Lưu ý',
    shortLabel: 'Lưu ý',
    defaultTitle: 'Lưu ý quan trọng',
    description: 'Khối nhấn mạnh cảnh báo, điều kiện hoặc quy tắc cần nhớ.',
    contentPlaceholder: 'Ví dụ: Chỉ dán lệnh này sau khi nhân vật đã có ít nhất 3 lượt thoại...',
    supportsAutoNumber: false,
  },
  example: {
    label: 'Ví dụ',
    shortLabel: 'Ví dụ',
    defaultTitle: 'Ví dụ minh họa',
    description: 'Dữ liệu mẫu, đầu vào gợi ý hoặc kết quả trả về minh họa.',
    contentPlaceholder: 'Dán ví dụ đầu vào/đầu ra mẫu để người xem dễ hình dung...',
    supportsAutoNumber: false,
  },
  heading: {
    label: 'Tiêu đề phân mục',
    shortLabel: 'Phân mục',
    defaultTitle: 'Phân mục mới',
    description: 'Tiêu đề chia nhóm các khối nội dung trong bài dài.',
    contentPlaceholder: 'Mô tả ngắn cho phân mục này (không bắt buộc)...',
    supportsAutoNumber: false,
  },
  image: {
    label: 'Hình ảnh minh họa',
    shortLabel: 'Hình ảnh',
    defaultTitle: 'Hình ảnh minh họa',
    description: 'Tải ảnh từ thiết bị hoặc chèn URL ảnh HTTPS kèm chú thích.',
    contentPlaceholder: 'Chú thích ảnh (không bắt buộc)...',
    supportsAutoNumber: false,
  },
};

export const PROMPT_BLOCK_TYPE_ORDER: PromptBlockType[] = [
  'prompt',
  'guide',
  'note',
  'example',
  'heading',
  'image',
];

const VALID_BLOCK_TYPES = new Set<PromptBlockType>(PROMPT_BLOCK_TYPE_ORDER);

export function createPromptBlockId(): string {
  return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyPromptBlock(type: PromptBlockType = 'prompt'): PromptBlock {
  const meta = PROMPT_BLOCK_META[type];
  return {
    id: createPromptBlockId(),
    type,
    label: type === 'heading' ? '' : meta.defaultTitle,
    content: '',
    autoNumber: meta.supportsAutoNumber,
    collapsed: false,
  };
}

export function normalizePromptBlock(raw: unknown, index = 0): PromptBlock {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawType = typeof obj.type === 'string' ? obj.type : 'prompt';
  const type: PromptBlockType = VALID_BLOCK_TYPES.has(rawType as PromptBlockType)
    ? (rawType as PromptBlockType)
    : 'prompt';
  const block: PromptBlock = {
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `blk-${index}-${type}`,
    type,
    label: typeof obj.label === 'string' ? obj.label : '',
    content: typeof obj.content === 'string' ? obj.content : '',
  };
  if (typeof obj.note === 'string' && obj.note.trim()) {
    block.note = obj.note;
  }
  if (typeof obj.autoNumber === 'boolean') {
    block.autoNumber = obj.autoNumber;
  }
  if (typeof obj.collapsed === 'boolean') {
    block.collapsed = obj.collapsed;
  }
  if (typeof obj.imageUrl === 'string' && obj.imageUrl.trim()) {
    block.imageUrl = obj.imageUrl.trim();
  }
  if (typeof obj.imagePath === 'string' && obj.imagePath.trim()) {
    block.imagePath = obj.imagePath.trim();
  }
  if (typeof obj.imageCaption === 'string' && obj.imageCaption.trim()) {
    block.imageCaption = obj.imageCaption;
  }
  if (typeof obj.imageAlt === 'string' && obj.imageAlt.trim()) {
    block.imageAlt = obj.imageAlt;
  }
  return block;
}

export function isPromptBlockNonEmpty(block: PromptBlock): boolean {
  const type = block.type || 'prompt';
  if (type === 'image') {
    return Boolean(block.imagePath?.trim() || isSafeImageUrl(block.imageUrl));
  }
  if (type === 'heading') {
    return Boolean(block.label?.trim() || block.content?.trim());
  }
  return Boolean(block.content?.trim());
}

export function sanitizePromptBlocks(
  blocks: PromptBlock[],
  autoNumberSteps?: boolean,
): PromptBlock[] {
  return blocks
    .filter(isPromptBlockNonEmpty)
    .map((block, idx) => {
      const type = block.type || 'prompt';
      const defaultTitle = PROMPT_BLOCK_META[type].defaultTitle;
      const cleaned: PromptBlock = {
        id: block.id || `blk-${idx + 1}-${type}`,
        type,
        label: block.label.trim() || defaultTitle,
        content: block.content.trim(),
      };
      if (block.note?.trim()) cleaned.note = block.note.trim();
      if (typeof autoNumberSteps === 'boolean') {
        cleaned.autoNumber = autoNumberSteps && PROMPT_BLOCK_META[type].supportsAutoNumber;
      } else if (typeof block.autoNumber === 'boolean') {
        cleaned.autoNumber = block.autoNumber;
      }
      if (block.collapsed) cleaned.collapsed = true;
      if (type === 'image') {
        if (block.imagePath?.trim()) cleaned.imagePath = block.imagePath.trim();
        if (block.imageUrl?.trim() && isSafeImageUrl(block.imageUrl)) {
          cleaned.imageUrl = block.imageUrl.trim();
        }
        if (block.imageCaption?.trim()) cleaned.imageCaption = block.imageCaption.trim();
        if (block.imageAlt?.trim()) cleaned.imageAlt = block.imageAlt.trim();
      }
      return cleaned;
    });
}

export function computeBlockStepNumbers(
  blocks: PromptBlock[],
  autoNumberSteps: boolean,
): Array<number | null> {
  let stepCounter = 0;
  return blocks.map((block) => {
    const type = block.type || 'prompt';
    const supports = PROMPT_BLOCK_META[type].supportsAutoNumber;
    const isEnabled = autoNumberSteps && block.autoNumber !== false && supports;
    if (!isEnabled) return null;
    stepCounter += 1;
    return stepCounter;
  });
}

export function collectPromptTextsForCopyAll(blocks: PromptBlock[]): string {
  const promptBlocks = blocks.filter(
    (b) => (b.type || 'prompt') === 'prompt' && b.content.trim().length > 0,
  );
  if (promptBlocks.length === 0) return '';
  if (promptBlocks.length === 1) return promptBlocks[0].content.trim();
  return promptBlocks
    .map((b, idx) => {
      const title = b.label.trim() || `Câu lệnh ${idx + 1}`;
      return `### ${idx + 1}. ${title}\n${b.content.trim()}`;
    })
    .join('\n\n');
}

export function extractPromptStoragePaths(blocks: PromptBlock[]): string[] {
  const paths: string[] = [];
  for (const b of blocks) {
    if ((b.type || 'prompt') === 'image' && b.imagePath?.trim()) {
      paths.push(b.imagePath.trim());
    }
  }
  return paths;
}

interface SerializedNotePayloadV2 {
  description?: string;
  autoNumberSteps?: boolean;
  blocks?: unknown[];
  tags?: string[];
  legacyCategory?: string;
}

function cleanSerializedNoteTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.replace(/^#+/, '').replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function parseNoteV2CategoryField(categoryOffline?: string | null): SerializedNotePayloadV2 | null {
  if (!categoryOffline || typeof categoryOffline !== 'string') return null;
  if (!categoryOffline.startsWith(NOTE_V2_PREFIX)) return null;
  try {
    const jsonText = categoryOffline.slice(NOTE_V2_PREFIX.length);
    const parsed = JSON.parse(jsonText) as SerializedNotePayloadV2;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getNoteDescriptionAndBlocks(note?: Partial<Note> | null): {
  description: string;
  blocks: PromptBlock[];
  autoNumberSteps: boolean;
  tags: string[];
  legacyCategory?: string;
} {
  if (!note) {
    return {
      description: '',
      blocks: [createEmptyPromptBlock('prompt')],
      autoNumberSteps: false,
      tags: [],
    };
  }

  const parsedV2 = parseNoteV2CategoryField(note.categoryOffline);
  const directTags = cleanSerializedNoteTags(note.tags);
  const v2Tags = cleanSerializedNoteTags(parsedV2?.tags);
  const resolvedTags = directTags.length > 0 ? directTags : v2Tags;

  if (Array.isArray(note.blocks) && note.blocks.length > 0) {
    const blocks = note.blocks.map((b, idx) => normalizePromptBlock(b, idx));
    return {
      description:
        typeof note.description === 'string'
          ? note.description
          : typeof parsedV2?.description === 'string'
            ? parsedV2.description
            : '',
      blocks,
      autoNumberSteps:
        typeof note.autoNumberSteps === 'boolean'
          ? note.autoNumberSteps
          : Boolean(parsedV2?.autoNumberSteps),
      tags: resolvedTags,
      legacyCategory: parsedV2?.legacyCategory,
    };
  }

  if (parsedV2 && Array.isArray(parsedV2.blocks)) {
    const blocks = parsedV2.blocks.map((b, idx) => normalizePromptBlock(b, idx));
    return {
      description: typeof parsedV2.description === 'string' ? parsedV2.description : '',
      blocks: blocks.length > 0 ? blocks : [createEmptyPromptBlock('prompt')],
      autoNumberSteps: Boolean(parsedV2.autoNumberSteps),
      tags: resolvedTags,
      legacyCategory:
        typeof parsedV2.legacyCategory === 'string' ? parsedV2.legacyCategory : undefined,
    };
  }

  // Fallback từ Note truyền thống (`command` + `content`)
  const fallbackBlocks: PromptBlock[] = [];
  if (note.command && note.command.trim()) {
    fallbackBlocks.push({
      id: `legacy-cmd-${note.id || 'note'}`,
      type: 'prompt',
      label: 'Prompt cần nhập (Lệnh chính)',
      content: note.command,
      autoNumber: false,
    });
  }
  if (note.content && note.content.trim()) {
    fallbackBlocks.push({
      id: `legacy-content-${note.id || 'note'}`,
      type: 'guide',
      label: 'Nội dung chi tiết kèm dữ liệu',
      content: note.content,
      autoNumber: false,
    });
  }

  const legacyCatTags =
    resolvedTags.length > 0
      ? resolvedTags
      : note.categoryOffline &&
          !note.categoryOffline.startsWith(NOTE_V2_PREFIX) &&
          note.categoryOffline.trim()
        ? cleanSerializedNoteTags(note.categoryOffline.split(/[,/]/))
        : [];

  return {
    description: '',
    blocks: fallbackBlocks.length > 0 ? fallbackBlocks : [createEmptyPromptBlock('prompt')],
    autoNumberSteps: false,
    tags: legacyCatTags,
    legacyCategory: note.categoryOffline,
  };
}

export function buildNoteFieldsFromBlocks(params: {
  description: string;
  blocks: PromptBlock[];
  autoNumberSteps: boolean;
  tags?: string[];
  legacyCategory?: string;
}): Pick<
  Note,
  'command' | 'content' | 'description' | 'blocks' | 'autoNumberSteps' | 'tags' | 'categoryOffline'
> {
  const cleanBlocks = sanitizePromptBlocks(params.blocks, params.autoNumberSteps);
  const cleanDescription = params.description.trim();
  const cleanTags = cleanSerializedNoteTags(params.tags);

  const promptTexts = cleanBlocks
    .filter((b) => (b.type || 'prompt') === 'prompt' && b.content.trim())
    .map((b) => b.content.trim());

  const fallbackCommand =
    promptTexts.join('\n\n') ||
    cleanBlocks
      .map((b) => b.content.trim() || b.label.trim())
      .filter(Boolean)
      .slice(0, 1)
      .join('') ||
    cleanDescription;

  const textParts: string[] = [];
  if (cleanDescription) textParts.push(cleanDescription);
  for (const b of cleanBlocks) {
    const type = b.type || 'prompt';
    if (type === 'prompt') continue;
    if (type === 'image') {
      if (b.imageCaption?.trim()) textParts.push(b.imageCaption.trim());
      continue;
    }
    const piece = [b.label.trim(), b.content.trim()].filter(Boolean).join(': ');
    if (piece) textParts.push(piece);
  }

  const v2Payload: SerializedNotePayloadV2 = {
    description: cleanDescription,
    autoNumberSteps: params.autoNumberSteps,
    blocks: cleanBlocks,
    ...(cleanTags.length > 0 ? { tags: cleanTags } : {}),
    ...(params.legacyCategory && !params.legacyCategory.startsWith(NOTE_V2_PREFIX)
      ? { legacyCategory: params.legacyCategory }
      : {}),
  };

  return {
    description: cleanDescription,
    blocks: cleanBlocks,
    autoNumberSteps: params.autoNumberSteps,
    tags: cleanTags,
    command: fallbackCommand,
    content: textParts.join('\n\n') || fallbackCommand,
    categoryOffline: `${NOTE_V2_PREFIX}${JSON.stringify(v2Payload)}`,
  };
}

export function getLibraryPromptBlocks(prompt?: Partial<LibraryPrompt> | null): {
  blocks: PromptBlock[];
  autoNumberSteps: boolean;
} {
  if (!prompt || !Array.isArray(prompt.steps) || prompt.steps.length === 0) {
    return {
      blocks: [createEmptyPromptBlock('prompt')],
      autoNumberSteps: false,
    };
  }

  const blocks = prompt.steps.map((s, idx) => normalizePromptBlock(s, idx));
  const autoNumberSteps =
    typeof prompt.autoNumberSteps === 'boolean'
      ? prompt.autoNumberSteps
      : blocks.some((b) => b.autoNumber === true);

  return { blocks, autoNumberSteps };
}

export function blocksToLibraryPromptSteps(
  blocks: PromptBlock[],
  autoNumberSteps: boolean,
): PromptStep[] {
  return sanitizePromptBlocks(blocks, autoNumberSteps);
}

export function getNoteBlockSummaryLabel(note: Note): string {
  const { description, blocks } = getNoteDescriptionAndBlocks(note);
  const promptCount = blocks.filter((b) => (b.type || 'prompt') === 'prompt').length;
  const totalCount = blocks.length;
  if (description.trim()) return description.trim();
  if (totalCount > 1 || (totalCount === 1 && promptCount === 0)) {
    return `${totalCount} khối nội dung${promptCount > 0 ? ` • ${promptCount} lệnh` : ''}`;
  }
  return note.content || note.command || '';
}

export function isLegacyPlainNote(note?: Partial<Note> | null): boolean {
  if (!note) return false;
  if (Array.isArray(note.blocks) && note.blocks.length > 0) return false;
  return !parseNoteV2CategoryField(note.categoryOffline);
}
