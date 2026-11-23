export interface CloudContentMeta {
  ownerId?: string;
  isPublic?: boolean;
  isSystem?: boolean;
  publishedAt?: string;
  authorDisplayName?: string;
  authorRole?: 'user' | 'admin';
  cloudKey?: string;
}

export interface Character extends CloudContentMeta {
  id: string;
  name: string;
  role: string;
  avatar: string; // Emoji or short code
  description?: string;
  createdAt: string;
  author?: string;
  fb?: { name: string; url: string } | string;
  discord?: { name: string; url: string } | string;
  discord2?: { name: string; url: string } | string;
  web?: { name: string; url: string } | string;
  other?: { name: string; url: string } | string;
  ggai?: string;
  backstoryUser?: string;
  backstoryChar?: string;
  backstoryUserTitle?: string;
  backstoryCharTitle?: string;
  userProfile?: string;
  userProfileTitle?: string;
  prompt?: string;
}

export interface Note extends CloudContentMeta {
  id: string;
  title: string;
  command: string; // "Prompt cần nhập" or command
  content: string; // "Nội dung"
  characterId: string; // References Character.id
  categoryOffline?: string; // Optional tagging
  icon?: string; // Specific emoji icon for each note
  createdAt: string;
  updatedAt: string;
}

export interface Idea extends CloudContentMeta {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptStep {
  label: string; // e.g., "Bước 1: Lấy thông tin tóm tắt", or the name of the specific block
  content: string; // The copyable prompt content
  note?: string; // Optional tip for this specific step
}

export interface LibraryPrompt extends CloudContentMeta {
  id: string;
  title: string;
  description: string;
  howToUse: string;
  author: string;
  tags: string[];
  icon?: string; // Specific emoji for each library prompt
  steps: PromptStep[]; // Multiple copy blocks for steps!
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
  createdAt: string;
  updatedAt: string;
}

export interface CharacterComment {
  id: string;
  characterOwnerId: string;
  characterItemId: string;
  userId: string;
  authorDisplayName: string;
  authorRole: 'user' | 'admin';
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
