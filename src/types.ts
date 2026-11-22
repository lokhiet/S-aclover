export interface Character {
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

export interface Note {
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

export interface Idea {
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

export interface LibraryPrompt {
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
