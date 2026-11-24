export interface CloudContentMeta {
  ownerId?: string;
  isPublic?: boolean;
  isSystem?: boolean;
  publishedAt?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string | null;
  authorRole?: 'user' | 'admin';
  cloudKey?: string;
}

export const MAX_CHARACTER_IMAGES = 5;

export type SortOrder = 'newest' | 'oldest';

export interface CharacterImage {
  id: string;
  /** Đường dẫn Storage trong bucket riêng tư `character-images` (khi đã đăng nhập) */
  storagePath?: string;
  /** Khóa lưu cục bộ trong IndexedDB (chế độ Khách hoặc nháp trước khi đồng bộ) */
  localId?: string;
  /** URL HTTPS ngoài hợp lệ (hoặc data:image khi nhập JSON cũ trước khi chuyển sang kho lưu trữ) */
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  name?: string;
}

export type SocialPlatform =
  | 'facebook'
  | 'discord'
  | 'google_ai_studio'
  | 'gemini'
  | 'google_drive'
  | 'github'
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'youtube'
  | 'weibo'
  | 'reddit'
  | 'website'
  | 'other';

export interface CharacterSocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
  label?: string;
}

export interface Character extends CloudContentMeta {
  id: string;
  name: string;
  role: string;
  tags?: string[];
  avatar: string; // Emoji or short code
  images?: CharacterImage[];
  description?: string;
  createdAt: string;
  author?: string;
  fb?: { name: string; url: string } | string;
  discord?: { name: string; url: string } | string;
  discord2?: { name: string; url: string } | string;
  web?: { name: string; url: string } | string;
  other?: { name: string; url: string; links?: CharacterSocialLink[] } | string;
  socialLinks?: CharacterSocialLink[];
  ggai?: string;
  backstoryUser?: string;
  backstoryChar?: string;
  backstoryUserTitle?: string;
  backstoryCharTitle?: string;
  userProfile?: string;
  userProfileTitle?: string;
  prompt?: string;
}

export type PromptBlockType =
  | 'prompt'
  | 'guide'
  | 'note'
  | 'example'
  | 'heading'
  | 'image';

export interface PromptStep {
  id?: string;
  type?: PromptBlockType; // Defaults to 'prompt' for legacy compatibility
  label: string; // Title / section heading / step label
  content: string; // Main prompt / guide / note / example / subtitle text
  note?: string; // Legacy optional tip for this specific step
  autoNumber?: boolean; // Whether step participates in automatic numbering
  collapsed?: boolean; // Saved editor collapse hint
  imageUrl?: string; // External HTTPS illustration URL
  imagePath?: string; // Private Supabase storage path inside 'prompt-images'
  imageCaption?: string; // Optional caption shown below illustration
  imageAlt?: string; // Accessible alt text
}

export type PromptBlock = PromptStep;

export interface Note extends CloudContentMeta {
  id: string;
  title: string;
  command: string; // "Prompt cần nhập" or concatenated prompt blocks (for search & legacy)
  content: string; // "Nội dung" or overview + text blocks (for search & legacy)
  description?: string; // Optional overview description for flexible block posts
  blocks?: PromptBlock[]; // Flexible ordered blocks
  autoNumberSteps?: boolean; // Auto step numbering toggle
  tags?: string[]; // Flexible semantic tags (serialized safely in NOTE_V2 payload)
  characterId: string; // References Character.id
  categoryOffline?: string; // Optional tagging / serialized V2 block payload
  icon?: string; // Specific emoji icon for each note
  createdAt: string;
  updatedAt: string;
}

export interface SharedTag {
  slug: string;
  label: string;
  aliases: string[];
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Idea extends CloudContentMeta {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LibraryPrompt extends CloudContentMeta {
  id: string;
  title: string;
  description: string;
  howToUse: string;
  author: string;
  tags: string[];
  icon?: string; // Specific emoji for each library prompt
  steps: PromptStep[]; // Flexible ordered blocks (100% backward-compatible with legacy steps)
  autoNumberSteps?: boolean;
  createdAt: string;
}

export interface AppState {
  notes: Note[];
  ideas: Idea[];
  characters: Character[];
  theme: 'light' | 'dark';
  cloverEffect: boolean;
  libraryPrompts?: LibraryPrompt[]; // Optional user custom addition or loaded
}

export type ContentTargetType = 'character' | 'note' | 'idea' | 'library_prompt';

export interface PublicProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'admin';
  updated_at: string;
}

export type AnnouncementTone = 'info' | 'update' | 'important';

export interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  tone: AnnouncementTone;
  isPinned: boolean;
  isActive: boolean;
  authorId: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterComment {
  id: string;
  characterOwnerId: string;
  characterItemId: string;
  userId: string | null;
  isAnonymous?: boolean;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  authorRole: 'user' | 'admin' | 'guest';
  content: string;
  isHidden: boolean;
  hiddenBy: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptRating {
  id: string;
  targetType: 'library_prompt' | 'note';
  targetScope: string;
  targetOwnerId: string | null;
  targetItemId: string;
  userId: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  authorRole: 'user' | 'admin';
  score: number;
  review: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptRatingSummary {
  average: number;
  count: number;
  userRating: PromptRating | null;
  ratings: PromptRating[];
}

export interface LikeSummary {
  count: number;
  likedByMe: boolean;
}
