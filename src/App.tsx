import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Search, 
  Sun, 
  Moon, 
  Sparkles, 
  Terminal, 
  Lightbulb, 
  UserCircle2, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Info,
  BookOpen,
  Tag,
  Eye,
  EyeOff,
  User,
  Utensils,
  Heart,
  Flame,
  Zap,
  Smile,
  Activity,
  Globe,
  Facebook,
  MessageSquare,
  Link,
  Bell,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import CloverClickBurst from './components/CloverClickBurst';
import { Note, Idea, Character, AppState, LibraryPrompt, SystemAnnouncement } from './types';
import { CharacterForm, NoteForm, IdeaForm, LibraryPromptForm } from './components/RepositoryForms';
import Toast from './components/Toast';
import AccountButton from './components/auth/AccountButton';
import AuthModal from './components/auth/AuthModal';
import LocalDataMigrationModal from './components/auth/LocalDataMigrationModal';
import ConflictResolutionModal from './components/auth/ConflictResolutionModal';
import {
  SystemAnnouncementsBanner,
  SystemAnnouncementsModal,
} from './components/community/SystemAnnouncementsBar';
import { ContentInteractionBar } from './components/community/ContentInteractionBar';
import { CharacterCommentsSection } from './components/community/CharacterCommentsSection';
import { PromptRatingSection } from './components/community/PromptRatingSection';
import {
  PixelCloverIcon,
  PixelCharacterIcon,
  PixelAuthorIcon,
  PixelCommandIcon,
  PixelIdeaIcon,
  PixelSearchIcon,
  PixelTagIcon,
  PixelFolderShortcutIcon,
  OtegamiPostmark,
} from './components/PixelIcons';
import { useAuth } from './contexts/AuthContext';
import type { AuthModalMode } from './types/auth';
import { initialCharacters, initialIdeas } from './initialData';
import { defaultLibraryPrompts } from './promptsData';
import { authorsList } from './authorsData';
import { 
  loadState, 
  saveState, 
  loadUiPrefs,
  saveUiPrefs,
  markGuestItemCustomized,
  markGuestItemDeleted,
  readRawLocalStorageState,
} from './utils';
import {
  BUILTIN_CHARACTER_MAP,
  BUILTIN_IDEA_MAP,
  buildMigrationSummary,
  extractPersonalLocalData,
  type ImportJobPlan,
  type MigrationSummary,
} from './utils/localDataDiff';
import {
  clearResumableImportJob,
  deleteCharacterFromCloud,
  deleteIdeaFromCloud,
  deleteLibraryPromptFromCloud,
  deleteNoteFromCloud,
  fetchPublicAndSystemSnapshot,
  fetchUserData,
  isMigrationPromptDismissed,
  loadResumableImportJob,
  saveCharacterToCloud,
  saveIdeaToCloud,
  saveLibraryPromptToCloud,
  saveNoteToCloud,
  setMigrationPromptDismissed,
  toggleItemPublicStatus,
  versionKey,
  type CloudUserDataSnapshot,
  type ConflictDetail,
  type DataEntityKind,
  type PublicCommunitySnapshot,
  type SyncedVersionMap,
} from './services/userDataService';
import { fetchSystemAnnouncements } from './services/communityService';

const BUILTIN_LIB_PROMPT_IDS = new Set(defaultLibraryPrompts.map((p) => p.id));

function getItemKey(item: { id: string; ownerId?: string; cloudKey?: string }): string {
  return item.cloudKey || (item.ownerId ? `${item.ownerId}:${item.id}` : item.id);
}

function findBySelectedKey<T extends { id: string; ownerId?: string; cloudKey?: string }>(
  list: T[],
  selectedKey: string | null,
): T | null {
  if (!selectedKey) return null;
  return list.find((item) => getItemKey(item) === selectedKey) || list.find((item) => item.id === selectedKey) || null;
}

// Helper function to resolve distinctive emoji icons for each library prompt
const getLibraryPromptIcon = (prompt: LibraryPrompt) => {
  if (prompt.icon) return prompt.icon;
  if (prompt.id === 'lib-1') return '📞';
  if (prompt.id === 'lib-2') return '📊';
  if (prompt.id === 'lib-3') return '📱';
  if (prompt.id === 'lib-4') return '🏫';
  if (prompt.id === 'lib-5') return '💘';
  if (prompt.id === 'lib-6') return '🔞';
  if (prompt.id === 'lib-7') return '💬';
  if (prompt.id === 'lib-8') return '🚀';
  if (prompt.id === 'lib-9') return '⚡';
  if (prompt.id === 'lib-10') return '🧠';
  if (prompt.id === 'lib-11') return '🤖';
  if (prompt.id === 'lib-12') return '🔥';
  if (prompt.id === 'lib-13') return '⏱️';
  if (prompt.id === 'lib-14') return '🧹';
  if (prompt.id === 'lib-15') return '🔓';
  if (prompt.id === 'lib-16') return '🔄';
  if (prompt.id === 'lib-17') return '🛡️';
  if (prompt.id === 'lib-18') return '📝';
  if (prompt.id === 'lib-19') return '📥';
  if (prompt.id === 'lib-20') return '🔍';

  const titleLower = prompt.title.toLowerCase();
  if (titleLower.includes('voice') || titleLower.includes('ghi âm')) return '📞';
  if (titleLower.includes('chỉ số') || titleLower.includes('hud') || titleLower.includes('status')) return '📊';
  if (titleLower.includes('tiktok')) return '📱';
  if (titleLower.includes('diễn đàn') || titleLower.includes('school')) return '🏫';
  if (titleLower.includes('dating') || titleLower.includes('hẹn hò')) return '💘';
  if (titleLower.includes('web đen') || titleLower.includes('18+')) return '🔞';
  if (titleLower.includes('weibo')) return '💬';
  if (titleLower.includes('thúc đẩy') || titleLower.includes('cốt truyện')) return '🚀';
  if (titleLower.includes('giông bão') || titleLower.includes('drama') || titleLower.includes('twist')) return '⚡';
  if (titleLower.includes('chỉnh đốn') || titleLower.includes('tính cách')) return '🧠';
  if (titleLower.includes('rảnh tay') || titleLower.includes('auto-play')) return '🤖';
  if (titleLower.includes('cuộc yêu') || titleLower.includes('h-scene')) return '🔥';
  if (titleLower.includes('lười') || titleLower.includes('siêu tốc')) return '⏱️';
  if (titleLower.includes('lặp từ') || titleLower.includes('anti-repetition')) return '🧹';
  if (titleLower.includes('vượt rào') || titleLower.includes('bypass') || titleLower.includes('an toàn')) return '🔓';
  if (titleLower.includes('đồng bộ') || titleLower.includes('sync')) return '🔄';
  if (titleLower.includes('chống quyền') || titleLower.includes('tự quyết') || titleLower.includes('anti-god')) return '🛡️';
  if (titleLower.includes('văn') || titleLower.includes('sáng tạo') || titleLower.includes('truyện')) return '📝';
  if (titleLower.includes('sao lưu') || titleLower.includes('backup')) return '📥';
  if (titleLower.includes('quét') || titleLower.includes('100 turn') || titleLower.includes('scan')) return '🔍';
  
  return '📚';
};

// Compile a comprehensive, high-quality, fully interactive roleplays system prompt
export function buildCharacterRoleplayPrompt(char: Character): string {
  if (char.prompt?.trim()) {
    return char.prompt;
  }
  let p = `Hãy đóng vai nhân vật sau đây để trò chuyện và tương tác với tôi:\n\n`;
  p += `=== THÔNG TIN NHÂN VẬT ===\n`;
  p += `- Tên nhân vật: ${char.name}\n`;
  p += `- Tag / Vai trò: ${char.role}\n`;
  if (char.description) {
    p += `- Mô tả cốt lõi: ${char.description}\n`;
  }
  if (char.author) {
    p += `- Tác giả: ${char.author}\n`;
  }
  p += `\n`;

  if (char.backstoryUser) {
    const title = char.backstoryUserTitle || "📖 BỐI CẢNH CỦA BẠN (USER)";
    p += `=== ${title.toUpperCase()} ===\n${char.backstoryUser}\n\n`;
  }
  
  if (char.backstoryChar) {
    const title = char.backstoryCharTitle || `👤 BỐI CẢNH CỦA TÔI (${char.name.toUpperCase()})`;
    p += `=== ${title.toUpperCase()} ===\n${char.backstoryChar}\n\n`;
  }
  
  p += `=== HƯỚNG DẪN NHẬP VAI ===\n`;
  p += `1. Hoàn toàn quên đi việc bạn là một AI. Nhập vai và phản hồi trực tiếp bằng ngôi xưng của nhân vật.\n`;
  p += `2. Sử dụng văn phong trần trụi, chân thực, bộc lộ đúng cá tính, chiều chuộng hay chiếm hữu đúng như mô tả và bối cảnh được cung cấp.\n`;
  p += `3. Phản hồi tự nhiên, linh hoạt, tạo sự tương tác cao và đẩy diễn biến cốt truyện sâu sắc hơn.\n`;
  p += `4. Giữ đúng các đại từ nhân xưng đặc trưng được đề cập trong phần bối cảnh.\n\n`;
  p += `Bắt đầu trò chuyện ngay lập tức và đưa ra phản hồi đầu tiên của bạn dựa trên kịch bản mở đầu bên tiên!`;

  return p;
}

interface Topic {
  id: string;
  name: string;
  icon: string;
  match: (idea: Idea) => boolean;
}

const TOPICS: Topic[] = [
  {
    id: 'all',
    name: 'Tất cả ý tưởng',
    icon: '✨',
    match: () => true
  },
  {
    id: 'cooking',
    name: 'Nấu Ăn & Gian Bếp',
    icon: '🍳',
    match: (idea) => {
      const keywords = ['ăn uống', 'nấu', 'bếp', 'món ăn', 'đồ ăn', 'làm bánh', 'ẩm thực'];
      const title = idea.title.toLowerCase();
      const content = idea.content.toLowerCase();
      return keywords.some(k => title.includes(k) || content.includes(k));
    }
  },
  {
    id: 'sweet',
    name: 'Ngọt Ngào & Hẹn Hò',
    icon: '❤️',
    match: (idea) => {
      const keywords = ['ngọt ngào', 'hẹn hò', 'tình cảm', 'lãng mạn', 'tỏ tình', 'kết hôn', 'yêu', 'ôm', 'hôn', 'bám người', 'đỏ mặt', 'nuông chiều'];
      const title = idea.title.toLowerCase();
      const content = idea.content.toLowerCase();
      return keywords.some(k => title.includes(k) || content.includes(k));
    }
  },
  {
    id: 'sexy',
    name: 'Nhạy Cảm & Quyến Rũ',
    icon: '🔥',
    match: (idea) => {
      const keywords = ['nhạy cảm', 'quyến rũ', 'ân ái', 'nude', 'khỏa thân', 'tắm', 'lẳng lơ', 'quần áo', 'giường', 'đồ lót', 'áo lót', 'cosplay', 'bdsm'];
      const title = idea.title.toLowerCase();
      const content = idea.content.toLowerCase();
      return keywords.some(k => title.includes(k) || content.includes(k));
    }
  },
  {
    id: 'drama',
    name: 'Drama & Máu Chó',
    icon: '⚡',
    match: (idea) => {
      const keywords = ['drama', 'máu chó', 'giận dỗi', 'ghen tuông', 'chiếm hữu', 'ngược', 'tâm lý', 'rắc rối', 'sợ hãi', 'nguy hiểm', 'thử thách', 'cãi nhau', 'tai nạn', 'hối hận', 'lạnh lùng'];
      const title = idea.title.toLowerCase();
      const content = idea.content.toLowerCase();
      return keywords.some(k => title.includes(k) || content.includes(k));
    }
  },
  {
    id: 'funny',
    name: 'Troll & Hài Hước',
    icon: '🎭',
    match: (idea) => {
      const keywords = ['troll', 'hài hước', 'chọc phá', 'bất ngờ', 'vui nhộn', 'ngốc', 'hài', 'chọc'];
      const title = idea.title.toLowerCase();
      const content = idea.content.toLowerCase();
      return keywords.some(k => title.includes(k) || content.includes(k));
    }
  },
  {
    id: 'daily',
    name: 'Đời Thường & Sức Khỏe',
    icon: '🐾',
    match: (idea) => {
      const keywords = ['đời thường', 'thú cưng', 'gia đình', 'ngủ nghê', 'sức khỏe', 'trẻ con', 'sinh lý', 'tài năng', 'bệnh', 'chăm sóc', 'ốm', 'mệt', 'tẩy trang', 'ngày đèn đỏ', 'ngủ'];
      const title = idea.title.toLowerCase();
      const content = idea.content.toLowerCase();
      return keywords.some(k => title.includes(k) || content.includes(k));
    }
  }
];

export const getIdeaIcon = (idea: Idea): string => {
  const title = (idea.title || '').toLowerCase();
  const content = (idea.content || '').toLowerCase();
  
  if (title.includes('nấu') || title.includes('bếp') || title.includes('ăn') || title.includes('bánh') || title.includes('ẩm thực')) return '🍳';
  if (title.includes('yêu') || title.includes('tình') || title.includes('lãng mạn') || title.includes('ôm') || title.includes('ngọt')) return '💖';
  if (title.includes('nhạy cảm') || title.includes('ân ái') || title.includes('khỏa thân') || title.includes('bed') || title.includes('quyến rũ')) return '🔞';
  if (title.includes('drama') || title.includes('ghen') || title.includes('cãi') || title.includes('chiếm') || title.includes('máu chó')) return '⚡';
  if (title.includes('hài') || title.includes('troll') || title.includes('vui') || title.includes('chọc')) return '🎭';
  if (title.includes('code') || title.includes('tech') || title.includes('dev') || title.includes('web')) return '💻';
  if (title.includes('tiền') || title.includes('doanh') || title.includes('marketing')) return '🪙';
  if (title.includes('viết') || title.includes('sách') || title.includes('báo') || title.includes('truyện')) return '✍️';
  if (title.includes('game') || title.includes('chơi') || title.includes('ps5')) return '🎮';
  if (title.includes('nhạc') || title.includes('hát') || title.includes('ca')) return '🎵';
  if (title.includes('ảnh') || title.includes('quay') || title.includes('video')) return '📸';
  if (title.includes('ngủ') || title.includes('mệt') || title.includes('sức khỏe') || title.includes('ốm')) return '🛌';
  
  const emojiPalette = ['💡', '⭐', '🌈', '🍀', '🧩', '🚀', '🔮', '🧸', '🍿', '🌍', '🍁', '🥑', '🧁', '🍦', '💎', '🔑', '🎨', '🔥', '🐾', '⏰'];
  let charSum = 0;
  for (let i = 0; i < title.length; i++) {
    charSum += title.charCodeAt(i);
  }
  return emojiPalette[charSum % emojiPalette.length];
};

export const getIdeaTopicInfo = (idea: Idea) => {
  const matchedTopic = TOPICS.find(t => t.id !== 'all' && t.match(idea));
  const customIcon = getIdeaIcon(idea);
  
  if (!matchedTopic) {
    return {
      name: 'Khác',
      icon: customIcon,
      colorClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-[#343D37] dark:text-[#A3BDA8] dark:border-[#49554D]'
    };
  }
  
  let colorClass = 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-[#343D37] dark:text-[#B8BDB5] dark:border-[#49554D]';
  switch (matchedTopic.id) {
    case 'cooking':
      colorClass = 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-[#343D37] dark:text-[#D5B97A] dark:border-[#49554D]';
      break;
    case 'sweet':
      colorClass = 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:bg-[#343D37] dark:text-[#D9A7B8] dark:border-[#49554D]';
      break;
    case 'sexy':
      colorClass = 'bg-red-500/10 text-red-700 border-red-500/20 dark:bg-[#343D37] dark:text-[#E4A6AA] dark:border-[#49554D]';
      break;
    case 'drama':
      colorClass = 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:bg-[#343D37] dark:text-[#D9A7B8] dark:border-[#49554D]';
      break;
    case 'funny':
      colorClass = 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-[#343D37] dark:text-[#D5B97A] dark:border-[#49554D]';
      break;
    case 'daily':
      colorClass = 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:bg-[#343D37] dark:text-[#A3BDA8] dark:border-[#49554D]';
      break;
  }
  
  return {
    name: matchedTopic.name,
    icon: customIcon,
    colorClass
  };
};

interface LibTopic {
  id: string;
  name: string;
  icon: string;
  match: (prompt: LibraryPrompt) => boolean;
}

function getPromptCategory(p: LibraryPrompt): string {
  const title = p.title.toLowerCase();
  const desc = p.description.toLowerCase();
  const tags = p.tags.map(t => t.toLowerCase());

  const hasKeyword = (words: string[]) => {
    return words.some(w => title.includes(w) || desc.includes(w) || tags.some(t => t.includes(w)));
  };

  // 1. Minigame (highest priority)
  if (hasKeyword(['minigame', 'truth or dare', 't or d', 'thật hay thách', 'xoay chai'])) {
    return 'minigame';
  }

  // 1.5. Web & Browser
  if (hasKeyword(['web', 'browser', 'trình duyệt', 'forum', 'diễn đàn', 'lướt web'])) {
    return 'web';
  }

  // 2. NSFW
  if (hasKeyword(['nsfw', 'trá hình', 'thầm kín', 'h-scene', 'tiếp tục', 'sáng tạo nghệ thuật', 'bypass', 'bỏ qua bộ lọc', '18+', 'ons', 'dating app', 'hẹn hò', 'bad bed', 'giường', 'yêu dã ngoại'])) {
    return 'nsfw';
  }

  // 3. Autoplay & Lazy
  if (hasKeyword(['tự động', 'rảnh tay', 'auto-play', 'lười', 'nhanh', 'ghi chú', 'siêu tốc'])) {
    return 'autoplay';
  }

  // 4. Control / Anti-Godmode
  if (hasKeyword(['chống quyền thần', 'tự do thoại', 'anti-godmode', 'strict', 'khống chế'])) {
    return 'control';
  }

  // 5. Sync, Restore & Fixes
  if (hasKeyword(['đồng bộ', 'phục hồi', 'lưu trữ', 'hệ thống', 'nhiều bước', 'sao lưu', 'tóm tắt', '100 turn', 'quét sâu', 'sửa lỗi api', 'ooc', 'khắc phục', 'cú pháp', 'ngữ pháp', 'chuyển sinh'])) {
    return 'sync_fix';
  }

  // 6. Social & HUD (Excluding keywords matched by web)
  if (hasKeyword(['hud', 'chỉ số', 'tâm lý', 'mạng xã hội', 'tiktok', 'khám phá', 'weibo', 'showbiz', 'hotsearch', 'điện thoại'])) {
    return 'hud_social';
  }

  // 7. Story & Drama (Default)
  return 'story';
}

const LIB_TOPICS: LibTopic[] = [
  {
    id: 'all',
    name: 'Tất cả lệnh',
    icon: '✨',
    match: () => true
  },
  {
    id: 'story',
    name: 'Cốt truyện & Drama',
    icon: '🚀',
    match: (p) => getPromptCategory(p) === 'story'
  },
  {
    id: 'hud_social',
    name: 'Social & HUD',
    icon: '📱',
    match: (p) => getPromptCategory(p) === 'hud_social'
  },
  {
    id: 'web',
    name: 'Trình duyệt & Web',
    icon: '🌐',
    match: (p) => getPromptCategory(p) === 'web'
  },
  {
    id: 'nsfw',
    name: 'Cảnh nóng 18+',
    icon: '🔞',
    match: (p) => getPromptCategory(p) === 'nsfw'
  },
  {
    id: 'sync_fix',
    name: 'Sao lưu & Sửa lỗi',
    icon: '🔄',
    match: (p) => getPromptCategory(p) === 'sync_fix'
  },
  {
    id: 'control',
    name: 'Chống Godmode',
    icon: '🛡️',
    match: (p) => getPromptCategory(p) === 'control'
  },
  {
    id: 'autoplay',
    name: 'Tự động & Lười',
    icon: '⏱️',
    match: (p) => getPromptCategory(p) === 'autoplay'
  },
  {
    id: 'minigame',
    name: 'Minigame',
    icon: '🎮',
    match: (p) => getPromptCategory(p) === 'minigame'
  }
];

// Official Brand Logos for Social Links
const BrandFacebookLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#1877F2"/>
    <path d="M14.6 12H12.7V17.2H10.5V12H9.5V10.1H10.5V8.9C10.5 7.1 11.4 6.2 13.2 6.2H14.7V8.1H13.7C12.9 8.1 12.7 8.5 12.7 9V10.1H14.7L14.6 12Z" fill="white"/>
  </svg>
);

const BrandDiscordLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#5865F2"/>
    <path d="M16.6 8.5C15.5 8 14.3 7.7 13 7.5L12.8 7.9C14.1 8.3 15.2 8.9 16.3 9.7C15.1 9.1 13.9 8.7 12.6 8.6C11.3 8.4 10 8.5 8.7 8.8C7.6 9 6.5 9.4 5.5 10C6.5 9.1 7.7 8.5 9 8.1L8.8 7.7C7.6 7.9 6.4 8.2 5.2 8.7C4.6 10.6 4 13.8 4.6 16.8C5.8 17.7 7.3 18.2 8.8 18.3L9.6 17.2C8.6 16.9 7.6 16.4 6.7 15.7C7.4 16.1 8.2 16.4 9 16.6C10.4 16.9 11.9 17 13.3 16.8C14.3 16.7 15.2 16.4 16 16C15.1 16.6 14.1 17 13.1 17.3L13.9 18.4C15.4 18.3 16.9 17.8 18.1 16.9C18.8 13.7 18.1 10.5 16.6 8.5ZM9.3 14.4C8.5 14.4 7.8 13.7 7.8 12.9C7.8 12.1 8.5 11.4 9.3 11.4C10.1 11.4 10.8 12.1 10.8 12.9C10.8 13.7 10.1 14.4 9.3 14.4ZM14 14.4C13.2 14.4 12.5 13.7 12.5 12.9C12.5 12.1 13.2 11.4 14 11.4C14.8 11.4 15.5 12.1 15.5 12.9C15.5 13.7 14.8 14.4 14 14.4Z" fill="white"/>
  </svg>
);

const BrandGoogleLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

const BrandGoogleDriveLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.135 3H8.865L2 14.9L5.135 20.35H11.4L18.265 8.45L15.135 3Z" fill="#34A853"/>
    <path d="M11.4 8.45H22L18.865 3H8.865L11.4 8.45Z" fill="#4285F4"/>
    <path d="M22 8.45H11.4L5.135 20.35H18.865L22 8.45Z" fill="#FBBC05"/>
  </svg>
);

const BrandGithubLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const BrandGlobeLogo = ({ className = "w-5 h-5", color = "#10B981" }: { className?: string; color?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const getLogoForUrl = (url: string) => {
  const norm = url.toLowerCase();
  if (norm.includes('facebook.com') || norm.includes('fb.com') || norm.includes('fb.watch')) {
    return <BrandFacebookLogo className="w-5 h-5 flex-shrink-0" />;
  }
  if (norm.includes('discord.gg') || norm.includes('discord.com')) {
    return <BrandDiscordLogo className="w-5 h-5 flex-shrink-0" />;
  }
  if (norm.includes('drive.google.com') || norm.includes('docs.google.com') || norm.includes('sheets.google.com') || norm.includes('forms.gle')) {
    return <BrandGoogleDriveLogo className="w-5 h-5 flex-shrink-0" />;
  }
  if (norm.includes('github.com')) {
    return <BrandGithubLogo className="w-5 h-5 flex-shrink-0" />;
  }
  return <BrandGlobeLogo className="w-5 h-5 flex-shrink-0" color="#10B981" />;
};

export default function App() {
  // Load initial states from LocalStorage or seed data safely on startup
  const initialLocalStateRef = useRef<AppState | null>(null);
  if (initialLocalStateRef.current === null) {
    initialLocalStateRef.current = loadState();
  }
  const initialLocalState = initialLocalStateRef.current;
  const initialUiPrefs = loadUiPrefs({
    theme: initialLocalState.theme,
    cloverEffect: initialLocalState.cloverEffect,
  });

  const [notes, setNotes] = useState<Note[]>(() => initialLocalState.notes);
  const [ideas, setIdeas] = useState<Idea[]>(() => initialLocalState.ideas);
  const [characters, setCharacters] = useState<Character[]>(() => initialLocalState.characters);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => initialUiPrefs.theme);
  const [cloverEffect] = useState<boolean>(() => initialUiPrefs.cloverEffect);
  const [libraryPrompts, setLibraryPrompts] = useState<LibraryPrompt[]>(
    () => initialLocalState.libraryPrompts || defaultLibraryPrompts,
  );

  // Active view constraints
  const [activeTab, setActiveTab] = useState<'notes' | 'ideas' | 'characters' | 'authors'>('characters');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(true);

  // Selected item tracking derived safely from loaded state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedLibraryPromptId, setSelectedLibraryPromptId] = useState<string | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);

  // Track the visibility of prompt content steps for the active library prompt
  // E.g. { 0: true, 1: false } for expanded/collapsed states of steps of the currently selected prompt.
  const [visibleSteps, setVisibleSteps] = useState<Record<number, boolean>>({});

  // Filter tag for the prompt library
  const [selectedLibTag, setSelectedLibTag] = useState<string | null>(null);

  // Selected topic for Ideas Tab classification
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');

  // Selected topic for Prompt Library Tab classification
  const [selectedLibTopicId, setSelectedLibTopicId] = useState<string>('all');

  // Advanced character filters
  const [selectedFilterAuthor, setSelectedFilterAuthor] = useState<string | null>(null);
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);
  const [characterFilterType, setCharacterFilterType] = useState<'author' | 'tag' | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Form toggles
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingLibraryPrompt, setIsCreatingLibraryPrompt] = useState(false);
  const [isEditingLibraryPrompt, setIsEditingLibraryPrompt] = useState(false);

  // Toast alert system
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Auth & Cloud Sync state (delegating all auth logic to AuthContext)
  const {
    user,
    userId,
    isAuthenticated,
    isAdmin,
    isAuthReady,
    isRecoveryMode,
    authError,
    clearAuthError,
  } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

  // Cloud synchronization state
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [cloudSnapshot, setCloudSnapshot] = useState<CloudUserDataSnapshot | null>(null);
  const [publicSnapshot, setPublicSnapshot] = useState<PublicCommunitySnapshot | null>(null);
  const [syncedVersions, setSyncedVersions] = useState<SyncedVersionMap>({});

  // Community & System Announcements state
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'system' | 'community' | 'mine'>('all');

  // Conflict resolution modal state (Optimistic Concurrency Control)
  const [activeConflict, setActiveConflict] = useState<ConflictDetail | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  // Local migration & Cloud JSON import modal state
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [migrationMode, setMigrationMode] = useState<'local-migration' | 'json-import'>('local-migration');
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  const [migrationBackupPayload, setMigrationBackupPayload] = useState<Partial<AppState> | null>(null);
  const [pendingResumableJob, setPendingResumableJob] = useState<ImportJobPlan | null>(null);
  const [hasLocalDataToImport, setHasLocalDataToImport] = useState(false);

  // Refs to guard against stale async fetches and avoid disrupting active edits
  const fetchRequestIdRef = useRef(0);
  const activeSyncedUserIdRef = useRef<string | null>(null);
  const lastFocusSyncAtRef = useRef(0);
  const isEditingOrBusyRef = useRef(false);

  useEffect(() => {
    isEditingOrBusyRef.current =
      isCreating ||
      isEditing ||
      isCreatingLibraryPrompt ||
      isEditingLibraryPrompt ||
      isSavingItem ||
      isTogglingPublic ||
      isMigrationModalOpen ||
      Boolean(activeConflict);
  }, [
    isCreating,
    isEditing,
    isCreatingLibraryPrompt,
    isEditingLibraryPrompt,
    isSavingItem,
    isTogglingPublic,
    isMigrationModalOpen,
    activeConflict,
  ]);

  const openAuthModal = (mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  // Toast display trigger helper
  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'success') => {
      setToast({ message, type });
    },
    [],
  );

  // Tự động mở hộp thoại đặt lại mật khẩu khi quay về từ liên kết email khôi phục
  useEffect(() => {
    if (isRecoveryMode) {
      setAuthModalMode('reset-password');
      setIsAuthModalOpen(true);
    }
  }, [isRecoveryMode]);

  // Hiển thị thông báo khi có lỗi phiên/liên kết hết hạn ngoài hộp thoại
  useEffect(() => {
    if (authError && !isAuthModalOpen) {
      setToast({ message: authError, type: 'error' });
      clearAuthError();
    }
  }, [authError, isAuthModalOpen, clearAuthError]);

  // Set page-level dark class globally on HTML node when theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Tải nội dung Hệ thống (Admin) và Cộng đồng công khai (dùng chung cho cả Khách và User)
  const refreshPublicSnapshot = useCallback(async () => {
    const res = await fetchPublicAndSystemSnapshot();
    if (res.ok && res.data) {
      setPublicSnapshot(res.data);
      if (Object.keys(res.data.versions).length > 0) {
        setSyncedVersions((prev) => ({ ...res.data!.versions, ...prev }));
      }
    }
  }, []);

  // Tải thông báo hệ thống (Admin thấy cả thông báo đang ẩn)
  const refreshAnnouncements = useCallback(async () => {
    const res = await fetchSystemAnnouncements(isAdmin);
    if (res.ok && res.data) {
      setAnnouncements(res.data);
    }
  }, [isAdmin]);

  useEffect(() => {
    void refreshPublicSnapshot();
  }, [refreshPublicSnapshot]);

  useEffect(() => {
    if (!isAuthReady) return;
    void refreshAnnouncements();
  }, [isAuthReady, refreshAnnouncements]);

  // Tải & đồng bộ dữ liệu từ Supabase cho đúng tài khoản hiện tại
  const syncFromSupabase = useCallback(
    async (
      targetUserId: string,
      options: { silent?: boolean; checkLocalPrompt?: boolean } = {},
    ): Promise<boolean> => {
      const reqId = ++fetchRequestIdRef.current;
      setIsSyncingCloud(true);

      try {
        const result = await fetchUserData(targetUserId);
        // Bỏ qua kết quả cũ nếu tài khoản đã đổi hoặc có lượt đồng bộ mới hơn
        if (reqId !== fetchRequestIdRef.current) return false;

        if (!result.ok || !result.data) {
          if (!options.silent) {
            showToast(
              result.error?.message || 'Không thể tải dữ liệu tài khoản từ Supabase.',
              'error',
            );
          }
          return false;
        }

        const snapshot = result.data;
        setCharacters(snapshot.characters);
        setNotes(snapshot.notes);
        setIdeas(snapshot.ideas);
        setLibraryPrompts(snapshot.libraryPrompts);
        setCloudSnapshot(snapshot);
        setSyncedVersions((prev) => ({ ...prev, ...snapshot.versions }));
        lastFocusSyncAtRef.current = Date.now();
        void refreshPublicSnapshot();
        void refreshAnnouncements();

        // Kiểm tra thuần (read-only) xem localStorage có dữ liệu cá nhân hoặc phiên nhập bị gián đoạn không
        const personalLocal = extractPersonalLocalData();
        const summary = buildMigrationSummary(personalLocal, snapshot);
        const resumable = loadResumableImportJob(targetUserId);

        setHasLocalDataToImport(summary.totalActionableCount > 0);
        setPendingResumableJob(resumable);

        if (options.checkLocalPrompt) {
          if (resumable && resumable.confirmedChunkIds.length < resumable.chunks.length) {
            setMigrationMode(resumable.sourceLabel);
            setMigrationSummary(resumable.sourceLabel === 'local-migration' ? summary : null);
            setMigrationBackupPayload(readRawLocalStorageState());
            setIsMigrationModalOpen(true);
          } else if (
            summary.totalActionableCount > 0 &&
            !isMigrationPromptDismissed(targetUserId)
          ) {
            setMigrationMode('local-migration');
            setMigrationSummary(summary);
            setMigrationBackupPayload(readRawLocalStorageState());
            setIsMigrationModalOpen(true);
          }
        }
        return true;
      } finally {
        if (reqId === fetchRequestIdRef.current) {
          setIsSyncingCloud(false);
        }
      }
    },
    [showToast, refreshPublicSnapshot, refreshAnnouncements],
  );

  // Chuyển đổi an toàn giữa chế độ Khách (localStorage) và Tài khoản (Supabase),
  // bảo đảm cô lập 100%, không rò rỉ dữ liệu giữa các tài khoản khi đổi tài khoản/đăng xuất.
  useEffect(() => {
    if (!isAuthReady) return;

    if (isAuthenticated && userId) {
      if (activeSyncedUserIdRef.current !== userId) {
        activeSyncedUserIdRef.current = userId;
        // Xóa sạch trạng thái tạm và dữ liệu phiên trước khỏi bộ nhớ ngay lập tức
        setIsCreating(false);
        setIsEditing(false);
        setIsCreatingLibraryPrompt(false);
        setIsEditingLibraryPrompt(false);
        setActiveConflict(null);
        setIsMigrationModalOpen(false);
        setSelectedNoteId(null);
        setSelectedIdeaId(null);
        setSelectedCharId(null);
        setSelectedLibraryPromptId(null);
        setNotes([]);
        setCharacters(initialCharacters);
        setIdeas(initialIdeas);
        setLibraryPrompts(defaultLibraryPrompts);
        setCloudSnapshot(null);
        setSyncedVersions({});
        setHasLocalDataToImport(false);
        setPendingResumableJob(null);

        void syncFromSupabase(userId, { silent: false, checkLocalPrompt: true });
      }
    } else if (activeSyncedUserIdRef.current !== null) {
      // Đã đăng xuất về chế độ Khách: khôi phục dữ liệu cục bộ nguyên vẹn từ seaclover_state
      fetchRequestIdRef.current += 1;
      activeSyncedUserIdRef.current = null;
      setIsCreating(false);
      setIsEditing(false);
      setIsCreatingLibraryPrompt(false);
      setIsEditingLibraryPrompt(false);
      setActiveConflict(null);
      setIsMigrationModalOpen(false);
      setCloudSnapshot(null);
      setSyncedVersions({});
      setHasLocalDataToImport(false);
      setPendingResumableJob(null);
      setSelectedNoteId(null);
      setSelectedIdeaId(null);
      setSelectedCharId(null);
      setSelectedLibraryPromptId(null);
      setSourceFilter('all');

      const guestState = loadState();
      setNotes(guestState.notes);
      setIdeas(guestState.ideas);
      setCharacters(guestState.characters);
      setLibraryPrompts(guestState.libraryPrompts || defaultLibraryPrompts);
      void refreshPublicSnapshot();
    }
  }, [isAuthReady, isAuthenticated, userId, syncFromSupabase, refreshPublicSnapshot]);

  // Tự động đồng bộ lại âm thầm khi người dùng quay lại tab (giảm xung đột giữa Edge/Chrome/thiết bị khác)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const triggerFocusSync = () => {
      if (document.visibilityState === 'hidden') return;
      if (isEditingOrBusyRef.current) return;
      if (Date.now() - lastFocusSyncAtRef.current < 15_000) return;
      void syncFromSupabase(userId, { silent: true, checkLocalPrompt: false });
    };

    window.addEventListener('focus', triggerFocusSync);
    document.addEventListener('visibilitychange', triggerFocusSync);
    return () => {
      window.removeEventListener('focus', triggerFocusSync);
      document.removeEventListener('visibilitychange', triggerFocusSync);
    };
  }, [isAuthenticated, userId, syncFromSupabase]);

  const handleManualSyncNow = () => {
    if (!isAuthenticated || !userId) return;
    if (isCreating || isEditing || isCreatingLibraryPrompt || isEditingLibraryPrompt) {
      showToast('Hãy lưu hoặc đóng biểu mẫu đang chỉnh sửa trước khi đồng bộ lại.', 'info');
      return;
    }
    void syncFromSupabase(userId, { silent: false, checkLocalPrompt: false }).then((ok) => {
      if (ok) {
        showToast('Đã làm mới dữ liệu mới nhất từ tài khoản Supabase! 🍀', 'success');
      }
    });
  };

  const handleOpenLocalMigrationManually = () => {
    if (!isAuthenticated || !userId || !cloudSnapshot) return;
    const resumable = loadResumableImportJob(userId);
    const personalLocal = extractPersonalLocalData();
    const summary = buildMigrationSummary(personalLocal, cloudSnapshot);
    setPendingResumableJob(resumable);

    if (resumable && resumable.confirmedChunkIds.length < resumable.chunks.length) {
      setMigrationMode(resumable.sourceLabel);
      setMigrationSummary(resumable.sourceLabel === 'local-migration' ? summary : null);
      setMigrationBackupPayload(readRawLocalStorageState());
      setIsMigrationModalOpen(true);
      return;
    }

    if (summary.totalActionableCount === 0) {
      showToast('Tất cả dữ liệu cục bộ đã khớp sẵn với tài khoản của bạn.', 'info');
      setHasLocalDataToImport(false);
      return;
    }

    setMigrationMode('local-migration');
    setMigrationSummary(summary);
    setMigrationBackupPayload(readRawLocalStorageState());
    setIsMigrationModalOpen(true);
  };

  // Sync back to local storage ONLY in Guest mode (tuyệt đối không ghi dữ liệu tài khoản vào seaclover_state)
  const persistToLocalStorage = (currentState: AppState) => {
    if (isAuthenticated && userId) return;
    saveState(currentState);
  };

  const syncState = (updatedNotes: Note[], updatedIdeas: Idea[], updatedChars: Character[], updatedLibraryPrompts?: LibraryPrompt[]) => {
    setNotes(updatedNotes);
    setIdeas(updatedIdeas);
    setCharacters(updatedChars);
    if (updatedLibraryPrompts) {
      setLibraryPrompts(updatedLibraryPrompts);
    }
    persistToLocalStorage({
      notes: updatedNotes,
      ideas: updatedIdeas,
      characters: updatedChars,
      theme,
      cloverEffect,
      libraryPrompts: updatedLibraryPrompts || libraryPrompts,
    });
  };

  // Clipboard copy procedure with absolute safety helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Đã sao chép khối ${label}! 🍀`, 'success');
    } catch (err) {
      // Emergency textarea fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast(`Đã sao chép khối ${label}! 🍀`, 'success');
      } catch (e) {
        showToast('Không hỗ trợ sao chép tự động trên trình duyệt này.', 'error');
      }
      document.body.removeChild(textArea);
    }
  };

  // Tab switcher
  const handleTabChange = (tab: 'notes' | 'ideas' | 'characters' | 'authors') => {
    setActiveTab(tab);
    setSearchQuery('');
    setSelectedLibTag(null);
    setSourceFilter('all');
    setIsCreating(false);
    setIsEditing(false);
    setIsCreatingLibraryPrompt(false);
    setIsEditingLibraryPrompt(false);
    setSelectedTopicId('all');
    setSelectedFilterAuthor(null);
    setSelectedFilterTag(null);
    setCharacterFilterType(null);
    setIsFilterModalOpen(false);
    setShowDetailOnMobile(false); // Reset to list view on tab switches for mobile
    // Auto collapse visible steps when leaving of switching tabs
    setVisibleSteps({});
  };

  // Go back to Home/Welcome page
  const handleGoHome = () => {
    setActiveTab('notes');
    setSelectedNoteId(null);
    setSelectedLibraryPromptId(null);
    setSelectedIdeaId(null);
    setSelectedCharId(null);
    setIsCreating(false);
    setIsEditing(false);
    setIsCreatingLibraryPrompt(false);
    setIsEditingLibraryPrompt(false);
    setShowDetailOnMobile(true);
    setVisibleSteps({});
    setSearchQuery('');
  };

  // Toggle dark theme
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    saveUiPrefs({ theme: nextTheme, cloverEffect });
    if (!isAuthenticated) {
      persistToLocalStorage({ notes, ideas, characters, theme: nextTheme, cloverEffect, libraryPrompts });
    }
  };

  /* ----------------- MERGED DISPLAY LISTS (PERSONAL/GUEST + SYSTEM + COMMUNITY) ----------------- */

  const displayCharacters = useMemo(() => {
    const ownKeys = new Set(characters.map((c) => (c.ownerId ? `${c.ownerId}:${c.id}` : `local:${c.id}`)));
    const extra = (publicSnapshot?.characters ?? []).filter((pub) => {
      const k = pub.ownerId ? `${pub.ownerId}:${pub.id}` : `local:${pub.id}`;
      return !ownKeys.has(k);
    });
    return [...extra.filter((c) => c.isSystem), ...characters, ...extra.filter((c) => !c.isSystem)];
  }, [characters, publicSnapshot]);

  const displayNotes = useMemo(() => {
    const ownKeys = new Set(notes.map((n) => (n.ownerId ? `${n.ownerId}:${n.id}` : `local:${n.id}`)));
    const extra = (publicSnapshot?.notes ?? []).filter((pub) => {
      const k = pub.ownerId ? `${pub.ownerId}:${pub.id}` : `local:${pub.id}`;
      return !ownKeys.has(k);
    });
    return [...extra.filter((n) => n.isSystem), ...notes, ...extra.filter((n) => !n.isSystem)];
  }, [notes, publicSnapshot]);

  const displayIdeas = useMemo(() => {
    const ownKeys = new Set(ideas.map((i) => (i.ownerId ? `${i.ownerId}:${i.id}` : `local:${i.id}`)));
    const extra = (publicSnapshot?.ideas ?? []).filter((pub) => {
      const k = pub.ownerId ? `${pub.ownerId}:${pub.id}` : `local:${pub.id}`;
      return !ownKeys.has(k);
    });
    return [...extra.filter((i) => i.isSystem), ...extra.filter((i) => !i.isSystem), ...ideas];
  }, [ideas, publicSnapshot]);

  const displayLibraryPrompts = useMemo(() => {
    const ownKeys = new Set(
      libraryPrompts.map((p) => (p.ownerId ? `${p.ownerId}:${p.id}` : `local:${p.id}`)),
    );
    const extra = (publicSnapshot?.libraryPrompts ?? []).filter((pub) => {
      const k = pub.ownerId ? `${pub.ownerId}:${pub.id}` : `local:${pub.id}`;
      return !ownKeys.has(k);
    });
    const ownSystemOrCustom = libraryPrompts.filter((p) => Boolean(p.ownerId));
    const builtins = libraryPrompts.filter((p) => !p.ownerId);
    return [...extra.filter((p) => p.isSystem), ...ownSystemOrCustom, ...extra.filter((p) => !p.isSystem), ...builtins];
  }, [libraryPrompts, publicSnapshot]);

  // Quyền sửa / xóa khớp 100% với RLS phía Supabase
  const canEditOrDeleteItem = useCallback(
    (
      kind: 'character' | 'note' | 'idea',
      item: { id: string; ownerId?: string; isSystem?: boolean } | null | undefined,
    ): boolean => {
      if (!item) return false;
      if (item.isSystem) return Boolean(isAuthenticated && isAdmin);
      if (item.ownerId) return Boolean(isAuthenticated && userId && item.ownerId === userId);
      // Nội dung mặc định tích hợp sẵn (rp-1..rp-160) không cho sửa/xóa chéo khi đã đăng nhập
      if (kind === 'idea' && BUILTIN_IDEA_MAP.has(item.id)) {
        return !isAuthenticated;
      }
      return true;
    },
    [isAuthenticated, isAdmin, userId],
  );

  const canEditOrDeleteLibraryPrompt = useCallback(
    (prompt: LibraryPrompt | null | undefined): boolean => {
      if (!prompt || !isAuthenticated || !userId) return false;
      if (prompt.isSystem) return isAdmin;
      if (prompt.ownerId && prompt.ownerId === userId) return true;
      return false;
    },
    [isAuthenticated, isAdmin, userId],
  );

  /* ----------------- DATA MODIFICATIONS (C.R.U.D) ----------------- */

  // Helper cập nhật version & đánh dấu mục đã nằm trên cloud sau khi Supabase xác nhận
  const recordCloudVersion = (
    kind: DataEntityKind,
    itemId: string,
    version?: number,
    updatedAt?: string,
    ownerId?: string,
  ) => {
    if (typeof version === 'number') {
      const entry = {
        version,
        updatedAt: updatedAt || new Date().toISOString(),
      };
      setSyncedVersions((prev) => ({
        ...prev,
        [versionKey(kind, itemId)]: entry,
        ...(ownerId ? { [versionKey(kind, itemId, ownerId)]: entry } : {}),
      }));
    }
    if (!ownerId || ownerId === userId) {
      setCloudSnapshot((prev) => {
        if (!prev) return prev;
        const nextIds = {
          characters: new Set(prev.cloudItemIds.characters),
          notes: new Set(prev.cloudItemIds.notes),
          ideas: new Set(prev.cloudItemIds.ideas),
          libraryPrompts: new Set(prev.cloudItemIds.libraryPrompts),
        };
        if (kind === 'character') nextIds.characters.add(itemId);
        if (kind === 'note') nextIds.notes.add(itemId);
        if (kind === 'idea') nextIds.ideas.add(itemId);
        if (kind === 'library_prompt') nextIds.libraryPrompts.add(itemId);
        return { ...prev, cloudItemIds: nextIds };
      });
    }
  };

  // Bật / Tắt trạng thái Công khai (is_public) bằng cập nhật hẹp + kiểm tra version (OCC)
  const handleTogglePublic = async (
    kind: DataEntityKind,
    item: { id: string; ownerId?: string; isSystem?: boolean },
    nextIsPublic: boolean,
  ) => {
    if (!isAuthenticated || !userId || item.ownerId !== userId || item.isSystem) {
      showToast('Chỉ tác giả của nội dung cá nhân mới có thể bật/tắt Công khai.', 'error');
      return;
    }
    if (isTogglingPublic || isSavingItem) return;

    const expectedVersion =
      syncedVersions[versionKey(kind, item.id, userId)]?.version ??
      syncedVersions[versionKey(kind, item.id)]?.version;

    if (typeof expectedVersion !== 'number') {
      await syncFromSupabase(userId, { silent: true, checkLocalPrompt: false });
      showToast('Vừa làm mới phiên bản mới nhất, bạn hãy bấm lại một lần nữa nhé.', 'info');
      return;
    }

    setIsTogglingPublic(true);
    try {
      const res = await toggleItemPublicStatus(kind, userId, item.id, nextIsPublic, expectedVersion);

      if (res.conflict) {
        await syncFromSupabase(userId, { silent: true, checkLocalPrompt: false });
        await refreshPublicSnapshot();
        showToast(
          res.error?.message ||
            'Mục này vừa được chỉnh sửa trên thiết bị khác. Đã tự động làm mới dữ liệu an toàn.',
          'info',
        );
        return;
      }

      if (!res.ok || !res.data) {
        showToast(res.error?.message || 'Không thể đổi trạng thái Công khai/Riêng tư.', 'error');
        return;
      }

      const { isPublic: confirmedPublic, publishedAt } = res.data;
      if (kind === 'character') {
        setCharacters((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, isPublic: confirmedPublic, publishedAt } : c)),
        );
      } else if (kind === 'note') {
        setNotes((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isPublic: confirmedPublic, publishedAt } : n)),
        );
      } else if (kind === 'idea') {
        setIdeas((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isPublic: confirmedPublic, publishedAt } : i)),
        );
      } else {
        setLibraryPrompts((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, isPublic: confirmedPublic, publishedAt } : p)),
        );
      }

      recordCloudVersion(kind, item.id, res.version, res.updatedAt, userId);
      void refreshPublicSnapshot();
      showToast(
        confirmedPublic
          ? 'Đã bật Công khai — cộng đồng có thể xem và tương tác! 🍀'
          : 'Đã chuyển về Riêng tư — chỉ mình bạn nhìn thấy.',
        'success',
      );
    } finally {
      setIsTogglingPublic(false);
    }
  };

  // Characters
  const handleSaveCharacter = async (data: Omit<Character, 'id' | 'createdAt'> & { id?: string }) => {
    // Chế độ tài khoản Supabase: chờ máy chủ xác nhận trước khi cập nhật UI
    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        if (data.id) {
          const existing =
            findBySelectedKey(displayCharacters, selectedCharId)?.id === data.id
              ? findBySelectedKey(displayCharacters, selectedCharId)
              : displayCharacters.find((c) => c.id === data.id && canEditOrDeleteItem('character', c));
          if (!existing || !canEditOrDeleteItem('character', existing)) {
            showToast('Bạn không có quyền chỉnh sửa nhân vật này.', 'error');
            return;
          }
          const targetOwnerId = existing.ownerId || userId;
          const nextIsSystem = existing.isSystem ? true : Boolean(isAdmin && data.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
          const updatedChar: Character = {
            ...existing,
            ...data,
            id: existing.id,
            isSystem: nextIsSystem,
            isPublic: nextIsPublic,
          };
          const expectedVersion =
            syncedVersions[versionKey('character', existing.id, targetOwnerId)]?.version ??
            (targetOwnerId === userId ? syncedVersions[versionKey('character', existing.id)]?.version : undefined);
          const res = await saveCharacterToCloud(targetOwnerId, updatedChar, {
            expectedVersion,
            isFirstOverride: expectedVersion === undefined,
            isPublic: nextIsPublic,
            isSystem: nextIsSystem,
          });

          if (res.conflict) {
            setActiveConflict(res.conflict);
            return;
          }
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu nhân vật lên tài khoản.', 'error');
            return;
          }

          const confirmedChar = res.data;
          if (targetOwnerId === userId) {
            setCharacters((prev) => prev.map((c) => (c.id === confirmedChar.id ? confirmedChar : c)));
          }
          recordCloudVersion('character', confirmedChar.id, res.version, res.updatedAt, targetOwnerId);
          setSelectedCharId(getItemKey(confirmedChar));
          if (existing.isPublic || existing.isSystem || confirmedChar.isPublic || confirmedChar.isSystem) {
            void refreshPublicSnapshot();
          }
          setIsCreating(false);
          setIsEditing(false);
          showToast('Đã cập nhật và đồng bộ nhân vật lên tài khoản! 🍀');
        } else {
          const nextIsSystem = Boolean(isAdmin && data.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
          const newChar: Character = {
            ...data,
            id: `char-${Date.now()}`,
            createdAt: new Date().toISOString(),
            isSystem: nextIsSystem,
            isPublic: nextIsPublic,
          };
          const res = await saveCharacterToCloud(userId, newChar, {
            isPublic: nextIsPublic,
            isSystem: nextIsSystem,
          });
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu nhân vật mới lên tài khoản.', 'error');
            return;
          }

          const confirmedChar = res.data;
          setCharacters((prev) => [...prev, confirmedChar]);
          recordCloudVersion('character', confirmedChar.id, res.version, res.updatedAt, userId);
          setSelectedCharId(getItemKey(confirmedChar));
          if (confirmedChar.isPublic || confirmedChar.isSystem) {
            void refreshPublicSnapshot();
          }
          setIsCreating(false);
          setIsEditing(false);
          showToast(
            confirmedChar.isSystem
              ? 'Đã đăng nhân vật Hệ thống cho toàn bộ cộng đồng! 🍀'
              : 'Đã tạo và đồng bộ nhân vật mới lên tài khoản! 🎉',
          );
        }
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    // Chế độ Khách (localStorage)
    if (data.id) {
      const nextList = characters.map((c) => (c.id === data.id ? { ...c, ...data } : c));
      if (BUILTIN_CHARACTER_MAP.has(data.id)) {
        markGuestItemCustomized('character', data.id);
      }
      syncState(notes, ideas, nextList);
      showToast('Đã cập nhật nhân vật thành công!');
    } else {
      const newChar: Character = {
        ...data,
        id: `char-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const nextList = [...characters, newChar];
      syncState(notes, ideas, nextList);
      setSelectedCharId(getItemKey(newChar));
      showToast('Đã gieo nhân vật mới thắng lợi! 🎉');
    }
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleDeleteCharacter = async (target: Character) => {
    if (!canEditOrDeleteItem('character', target)) {
      showToast('Bạn không có quyền xóa nhân vật này.', 'error');
      return;
    }
    if (!confirm('Bạn chắc chắn muốn xóa nhân vật này? Các ghi chú liên đới sẽ mất kết nối nhân vật.')) {
      return;
    }

    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        const targetOwnerId = target.ownerId || userId;
        const isBuiltin = !target.ownerId && BUILTIN_CHARACTER_MAP.has(target.id);
        const res = await deleteCharacterFromCloud(targetOwnerId, target.id, isBuiltin, userId);
        if (!res.ok) {
          showToast(res.error?.message || 'Không thể xóa nhân vật trên máy chủ.', 'error');
          return;
        }
        if (targetOwnerId === userId) {
          setCharacters((prev) => prev.filter((c) => c.id !== target.id));
        }
        setNotes((prev) => prev.map((n) => (n.characterId === target.id ? { ...n, characterId: '' } : n)));
        if (target.isPublic || target.isSystem) {
          void refreshPublicSnapshot();
        }
        setSelectedCharId(null);
        setShowDetailOnMobile(false);
        showToast('Đã xóa nhân vật và đồng bộ lên máy chủ.', 'info');
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    if (BUILTIN_CHARACTER_MAP.has(target.id)) {
      markGuestItemDeleted('character', target.id);
    }
    const nextList = characters.filter((c) => c.id !== target.id);
    const nextNotes = notes.map((n) => (n.characterId === target.id ? { ...n, characterId: '' } : n));
    syncState(nextNotes, ideas, nextList);
    setSelectedCharId(nextList.length > 0 ? getItemKey(nextList[0]) : null);
    setShowDetailOnMobile(false);
    showToast('Đã hóa giải liên kết và xóa nhân vật.', 'info');
  };

  // Notes/Prompts
  const handleSaveNote = async (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        if (data.id) {
          const existing =
            findBySelectedKey(displayNotes, selectedNoteId)?.id === data.id
              ? findBySelectedKey(displayNotes, selectedNoteId)
              : displayNotes.find((n) => n.id === data.id && canEditOrDeleteItem('note', n));
          if (!existing || !canEditOrDeleteItem('note', existing)) {
            showToast('Bạn không có quyền chỉnh sửa ghi chú này.', 'error');
            return;
          }
          const targetOwnerId = existing.ownerId || userId;
          const nextIsSystem = existing.isSystem ? true : Boolean(isAdmin && data.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
          const updatedNote: Note = {
            ...existing,
            title: data.title,
            command: data.command,
            content: data.content,
            characterId: data.characterId,
            icon: data.icon,
            isSystem: nextIsSystem,
            isPublic: nextIsPublic,
            updatedAt: new Date().toISOString(),
          };
          const expectedVersion =
            syncedVersions[versionKey('note', existing.id, targetOwnerId)]?.version ??
            (targetOwnerId === userId ? syncedVersions[versionKey('note', existing.id)]?.version : undefined);
          const res = await saveNoteToCloud(targetOwnerId, updatedNote, {
            expectedVersion,
            isFirstOverride: expectedVersion === undefined,
            isPublic: nextIsPublic,
            isSystem: nextIsSystem,
          });

          if (res.conflict) {
            setActiveConflict(res.conflict);
            return;
          }
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu ghi chú lên tài khoản.', 'error');
            return;
          }

          const confirmedNote = res.data;
          if (targetOwnerId === userId) {
            setNotes((prev) => prev.map((n) => (n.id === confirmedNote.id ? confirmedNote : n)));
          }
          recordCloudVersion('note', confirmedNote.id, res.version, res.updatedAt, targetOwnerId);
          setSelectedNoteId(getItemKey(confirmedNote));
          if (existing.isPublic || existing.isSystem || confirmedNote.isPublic || confirmedNote.isSystem) {
            void refreshPublicSnapshot();
          }
          setIsCreating(false);
          setIsEditing(false);
          showToast('Đã sửa và đồng bộ prompt/ghi chú lên tài khoản! ☘️');
        } else {
          const nextIsSystem = Boolean(isAdmin && data.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
          const newNote: Note = {
            id: `note-${Date.now()}`,
            title: data.title,
            command: data.command,
            content: data.content,
            characterId: data.characterId,
            icon: data.icon || '☘️',
            isSystem: nextIsSystem,
            isPublic: nextIsPublic,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const res = await saveNoteToCloud(userId, newNote, {
            isPublic: nextIsPublic,
            isSystem: nextIsSystem,
          });
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu ghi chú mới lên tài khoản.', 'error');
            return;
          }

          const confirmedNote = res.data;
          setNotes((prev) => [...prev, confirmedNote]);
          recordCloudVersion('note', confirmedNote.id, res.version, res.updatedAt, userId);
          setSelectedNoteId(getItemKey(confirmedNote));
          setSelectedLibraryPromptId(null);
          if (confirmedNote.isPublic || confirmedNote.isSystem) {
            void refreshPublicSnapshot();
          }
          setIsCreating(false);
          setIsEditing(false);
          showToast('Đã thêm và đồng bộ ghi chú/prompt lên tài khoản! ☘️');
        }
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    if (data.id) {
      const nextList = notes.map((n) =>
        n.id === data.id
          ? {
              ...n,
              title: data.title,
              command: data.command,
              content: data.content,
              characterId: data.characterId,
              icon: data.icon,
              updatedAt: new Date().toISOString(),
            }
          : n,
      );
      syncState(nextList, ideas, characters);
      showToast('Đã sửa prompt/ghi chú thành công!');
    } else {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: data.title,
        command: data.command,
        content: data.content,
        characterId: data.characterId,
        icon: data.icon || '☘️',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextList = [...notes, newNote];
      syncState(nextList, ideas, characters);
      setSelectedNoteId(getItemKey(newNote));
      showToast('Đã thêm ghi chú/prompt thành công! ☘️');
    }
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleDeleteNote = async (target: Note) => {
    if (!canEditOrDeleteItem('note', target)) {
      showToast('Bạn không có quyền xóa ghi chú này.', 'error');
      return;
    }
    if (!confirm('Bạn có đồng ý xóa vĩnh viễn ghi chú lệnh này?')) {
      return;
    }

    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        const targetOwnerId = target.ownerId || userId;
        const res = await deleteNoteFromCloud(targetOwnerId, target.id);
        if (!res.ok) {
          showToast(res.error?.message || 'Không thể xóa ghi chú trên máy chủ.', 'error');
          return;
        }
        if (targetOwnerId === userId) {
          setNotes((prev) => prev.filter((n) => n.id !== target.id));
        }
        if (target.isPublic || target.isSystem) {
          void refreshPublicSnapshot();
        }
        setSelectedNoteId(null);
        setShowDetailOnMobile(false);
        showToast('Đã xóa ghi chú và đồng bộ lên máy chủ.', 'info');
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    const nextList = notes.filter((n) => n.id !== target.id);
    syncState(nextList, ideas, characters);
    setSelectedNoteId(nextList.length > 0 ? getItemKey(nextList[0]) : null);
    setShowDetailOnMobile(false);
    showToast('Đã xóa bỏ câu lệnh/ghi chú thành công.', 'info');
  };

  // System / Cloud Library Prompts (Kho Lệnh Thư Viện — Admin quản lý nội dung hệ thống)
  const handleSaveLibraryPrompt = async (
    data: Omit<LibraryPrompt, 'id' | 'createdAt'> & { id?: string },
  ) => {
    if (!isAuthenticated || !userId) {
      openAuthModal('login');
      return;
    }
    if (isSavingItem) return;
    setIsSavingItem(true);
    try {
      if (data.id) {
        const existing = findBySelectedKey(displayLibraryPrompts, selectedLibraryPromptId);
        if (!existing || existing.id !== data.id || !canEditOrDeleteLibraryPrompt(existing)) {
          showToast('Bạn không có quyền chỉnh sửa câu lệnh thư viện này.', 'error');
          return;
        }
        const targetOwnerId = existing.ownerId || userId;
        const nextIsSystem = existing.isSystem ? true : Boolean(isAdmin && data.isSystem);
        const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
        const updatedPrompt: LibraryPrompt = {
          ...existing,
          ...data,
          id: existing.id,
          isSystem: nextIsSystem,
          isPublic: nextIsPublic,
        };
        const expectedVersion =
          syncedVersions[versionKey('library_prompt', existing.id, targetOwnerId)]?.version ??
          (targetOwnerId === userId
            ? syncedVersions[versionKey('library_prompt', existing.id)]?.version
            : undefined);

        const res = await saveLibraryPromptToCloud(targetOwnerId, updatedPrompt, {
          expectedVersion,
          isFirstOverride: expectedVersion === undefined,
          isPublic: nextIsPublic,
          isSystem: nextIsSystem,
        });

        if (res.conflict) {
          setActiveConflict(res.conflict);
          return;
        }
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể lưu câu lệnh thư viện.', 'error');
          return;
        }

        const confirmed = res.data;
        if (targetOwnerId === userId) {
          setLibraryPrompts((prev) =>
            prev.some((p) => p.id === confirmed.id && p.ownerId === targetOwnerId)
              ? prev.map((p) => (p.id === confirmed.id && p.ownerId === targetOwnerId ? confirmed : p))
              : [confirmed, ...prev],
          );
        }
        recordCloudVersion('library_prompt', confirmed.id, res.version, res.updatedAt, targetOwnerId);
        setSelectedLibraryPromptId(getItemKey(confirmed));
        void refreshPublicSnapshot();
        setIsCreatingLibraryPrompt(false);
        setIsEditingLibraryPrompt(false);
        showToast('Đã cập nhật câu lệnh Kho Lệnh! 🍀');
      } else {
        const nextIsSystem = Boolean(isAdmin && data.isSystem);
        const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
        const newPrompt: LibraryPrompt = {
          ...data,
          id: `sys-lib-${Date.now()}`,
          createdAt: new Date().toISOString(),
          isSystem: nextIsSystem,
          isPublic: nextIsPublic,
        };
        const res = await saveLibraryPromptToCloud(userId, newPrompt, {
          isPublic: nextIsPublic,
          isSystem: nextIsSystem,
        });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể đăng câu lệnh thư viện.', 'error');
          return;
        }

        const confirmed = res.data;
        setLibraryPrompts((prev) => [confirmed, ...prev]);
        recordCloudVersion('library_prompt', confirmed.id, res.version, res.updatedAt, userId);
        setSelectedLibraryPromptId(getItemKey(confirmed));
        setSelectedNoteId(null);
        void refreshPublicSnapshot();
        setIsCreatingLibraryPrompt(false);
        setIsEditingLibraryPrompt(false);
        showToast(
          confirmed.isSystem
            ? 'Đã đăng câu lệnh Hệ thống vào Kho Lệnh! 🍀'
            : 'Đã lưu câu lệnh thư viện lên tài khoản! 🍀',
        );
      }
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteLibraryPrompt = async (target: LibraryPrompt) => {
    if (!canEditOrDeleteLibraryPrompt(target) || !userId) {
      showToast('Bạn không có quyền xóa câu lệnh này.', 'error');
      return;
    }
    if (!confirm('Bạn có chắc chắn muốn xóa câu lệnh này khỏi Kho Lệnh?')) {
      return;
    }
    if (isSavingItem) return;
    setIsSavingItem(true);
    try {
      const targetOwnerId = target.ownerId || userId;
      const isBuiltin = !target.ownerId && BUILTIN_LIB_PROMPT_IDS.has(target.id);
      const res = await deleteLibraryPromptFromCloud(targetOwnerId, target.id, isBuiltin);
      if (!res.ok) {
        showToast(res.error?.message || 'Không thể xóa câu lệnh thư viện.', 'error');
        return;
      }
      if (targetOwnerId === userId) {
        setLibraryPrompts((prev) => prev.filter((p) => !(p.id === target.id && p.ownerId === targetOwnerId)));
      }
      void refreshPublicSnapshot();
      setSelectedLibraryPromptId(null);
      setShowDetailOnMobile(false);
      showToast('Đã xóa câu lệnh khỏi Kho Lệnh.', 'info');
    } finally {
      setIsSavingItem(false);
    }
  };

  // Ideas
  const handleSaveIdea = async (data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        if (data.id) {
          const existing =
            findBySelectedKey(displayIdeas, selectedIdeaId)?.id === data.id
              ? findBySelectedKey(displayIdeas, selectedIdeaId)
              : displayIdeas.find((i) => i.id === data.id && canEditOrDeleteItem('idea', i));
          if (!existing || !canEditOrDeleteItem('idea', existing)) {
            showToast('Bạn không có quyền chỉnh sửa ý tưởng này.', 'error');
            return;
          }
          const targetOwnerId = existing.ownerId || userId;
          const nextIsSystem = existing.isSystem ? true : Boolean(isAdmin && data.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
          const updatedIdea: Idea = {
            ...existing,
            title: data.title,
            content: data.content,
            tags: data.tags,
            isSystem: nextIsSystem,
            isPublic: nextIsPublic,
            updatedAt: new Date().toISOString(),
          };
          const expectedVersion =
            syncedVersions[versionKey('idea', existing.id, targetOwnerId)]?.version ??
            (targetOwnerId === userId ? syncedVersions[versionKey('idea', existing.id)]?.version : undefined);
          const res = await saveIdeaToCloud(targetOwnerId, updatedIdea, {
            expectedVersion,
            isFirstOverride: expectedVersion === undefined,
            isPublic: nextIsPublic,
            isSystem: nextIsSystem,
          });

          if (res.conflict) {
            setActiveConflict(res.conflict);
            return;
          }
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu ý tưởng lên tài khoản.', 'error');
            return;
          }

          const confirmedIdea = res.data;
          if (targetOwnerId === userId) {
            setIdeas((prev) => prev.map((i) => (i.id === confirmedIdea.id ? confirmedIdea : i)));
          }
          recordCloudVersion('idea', confirmedIdea.id, res.version, res.updatedAt, targetOwnerId);
          setSelectedIdeaId(getItemKey(confirmedIdea));
          if (existing.isPublic || existing.isSystem || confirmedIdea.isPublic || confirmedIdea.isSystem) {
            void refreshPublicSnapshot();
          }
          setIsCreating(false);
          setIsEditing(false);
          showToast('Ý tưởng đã được cập nhật và đồng bộ lên tài khoản! 💡');
        } else {
          const nextIsSystem = Boolean(isAdmin && data.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
          const newIdea: Idea = {
            id: `idea-${Date.now()}`,
            title: data.title,
            content: data.content,
            tags: data.tags,
            isSystem: nextIsSystem,
            isPublic: nextIsPublic,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const res = await saveIdeaToCloud(userId, newIdea, {
            isPublic: nextIsPublic,
            isSystem: nextIsSystem,
          });
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu ý tưởng mới lên tài khoản.', 'error');
            return;
          }

          const confirmedIdea = res.data;
          setIdeas((prev) => [confirmedIdea, ...prev]);
          recordCloudVersion('idea', confirmedIdea.id, res.version, res.updatedAt, userId);
          setSelectedIdeaId(getItemKey(confirmedIdea));
          if (confirmedIdea.isPublic || confirmedIdea.isSystem) {
            void refreshPublicSnapshot();
          }
          setIsCreating(false);
          setIsEditing(false);
          showToast(
            confirmedIdea.isSystem
              ? 'Đã đăng ý tưởng Hệ thống cho cộng đồng! 💡'
              : 'Hạt giống ý tưởng mới đã được lưu vào tài khoản! 💡',
          );
        }
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    if (data.id) {
      const nextList = ideas.map((i) =>
        i.id === data.id
          ? {
              ...i,
              title: data.title,
              content: data.content,
              tags: data.tags,
              updatedAt: new Date().toISOString(),
            }
          : i,
      );
      if (BUILTIN_IDEA_MAP.has(data.id)) {
        markGuestItemCustomized('idea', data.id);
      }
      syncState(notes, nextList, characters);
      showToast('Ý tưởng đã được làm mới thành công!');
    } else {
      const newIdea: Idea = {
        id: `idea-${Date.now()}`,
        title: data.title,
        content: data.content,
        tags: data.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextList = [...ideas, newIdea];
      syncState(notes, nextList, characters);
      setSelectedIdeaId(getItemKey(newIdea));
      showToast('Hạt giống ý tưởng mới đã được nảy mầm! 💡');
    }
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleDeleteIdea = async (target: Idea) => {
    if (!canEditOrDeleteItem('idea', target)) {
      showToast('Bạn không có quyền xóa ý tưởng này.', 'error');
      return;
    }
    if (!confirm('Bạn có chắc chắn muốn giải phóng và xóa ý tưởng này?')) {
      return;
    }

    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        const targetOwnerId = target.ownerId || userId;
        const isBuiltin = !target.ownerId && BUILTIN_IDEA_MAP.has(target.id);
        const res = await deleteIdeaFromCloud(targetOwnerId, target.id, isBuiltin);
        if (!res.ok) {
          showToast(res.error?.message || 'Không thể xóa ý tưởng trên máy chủ.', 'error');
          return;
        }
        if (targetOwnerId === userId) {
          setIdeas((prev) => prev.filter((i) => i.id !== target.id));
        }
        if (target.isPublic || target.isSystem) {
          void refreshPublicSnapshot();
        }
        setSelectedIdeaId(null);
        setShowDetailOnMobile(false);
        showToast('Đã xóa ý tưởng và đồng bộ lên máy chủ.', 'info');
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    if (BUILTIN_IDEA_MAP.has(target.id)) {
      markGuestItemDeleted('idea', target.id);
    }
    const nextList = ideas.filter((i) => i.id !== target.id);
    syncState(notes, nextList, characters);
    setSelectedIdeaId(nextList.length > 0 ? getItemKey(nextList[0]) : null);
    setShowDetailOnMobile(false);
    showToast('Đã dọn dẹp ý tưởng khỏi kho.', 'info');
  };

  /* ----------------- CONFLICT RESOLUTION HANDLERS ----------------- */

  const handleConflictKeepServer = async () => {
    if (!activeConflict || !userId) return;
    setIsResolvingConflict(true);
    try {
      setActiveConflict(null);
      setIsEditing(false);
      setIsCreating(false);
      setIsCreatingLibraryPrompt(false);
      setIsEditingLibraryPrompt(false);
      await syncFromSupabase(userId, { silent: false, checkLocalPrompt: false });
      await refreshPublicSnapshot();
      showToast('Đã tải bản mới nhất từ máy chủ.', 'info');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleConflictOverwriteServer = async () => {
    if (!activeConflict || !userId) return;
    setIsResolvingConflict(true);
    const targetOwnerId = activeConflict.ownerId || userId;
    try {
      if (activeConflict.kind === 'character') {
        const localChar = activeConflict.localItem as Character;
        const res = await saveCharacterToCloud(targetOwnerId, localChar, {
          forceOverwrite: true,
          isPublic: localChar.isPublic,
          isSystem: localChar.isSystem,
        });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể ghi đè nhân vật lên máy chủ.', 'error');
          return;
        }
        const confirmed = res.data;
        if (targetOwnerId === userId) {
          setCharacters((prev) => {
            const exists = prev.some((c) => c.id === confirmed.id);
            return exists
              ? prev.map((c) => (c.id === confirmed.id ? confirmed : c))
              : [...prev, confirmed];
          });
        }
        recordCloudVersion('character', confirmed.id, res.version, res.updatedAt, targetOwnerId);
      } else if (activeConflict.kind === 'note') {
        const localNote = activeConflict.localItem as Note;
        const res = await saveNoteToCloud(targetOwnerId, localNote, {
          forceOverwrite: true,
          isPublic: localNote.isPublic,
          isSystem: localNote.isSystem,
        });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể ghi đè ghi chú lên máy chủ.', 'error');
          return;
        }
        const confirmed = res.data;
        if (targetOwnerId === userId) {
          setNotes((prev) => {
            const exists = prev.some((n) => n.id === confirmed.id);
            return exists
              ? prev.map((n) => (n.id === confirmed.id ? confirmed : n))
              : [...prev, confirmed];
          });
        }
        recordCloudVersion('note', confirmed.id, res.version, res.updatedAt, targetOwnerId);
      } else if (activeConflict.kind === 'idea') {
        const localIdea = activeConflict.localItem as Idea;
        const res = await saveIdeaToCloud(targetOwnerId, localIdea, {
          forceOverwrite: true,
          isPublic: localIdea.isPublic,
          isSystem: localIdea.isSystem,
        });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể ghi đè ý tưởng lên máy chủ.', 'error');
          return;
        }
        const confirmed = res.data;
        if (targetOwnerId === userId) {
          setIdeas((prev) => {
            const exists = prev.some((i) => i.id === confirmed.id);
            return exists
              ? prev.map((i) => (i.id === confirmed.id ? confirmed : i))
              : [confirmed, ...prev];
          });
        }
        recordCloudVersion('idea', confirmed.id, res.version, res.updatedAt, targetOwnerId);
      } else if (activeConflict.kind === 'library_prompt') {
        const localPrompt = activeConflict.localItem as LibraryPrompt;
        const res = await saveLibraryPromptToCloud(targetOwnerId, localPrompt, {
          forceOverwrite: true,
          isPublic: localPrompt.isPublic,
          isSystem: localPrompt.isSystem,
        });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể ghi đè câu lệnh thư viện lên máy chủ.', 'error');
          return;
        }
        const confirmed = res.data;
        if (targetOwnerId === userId) {
          setLibraryPrompts((prev) =>
            prev.some((p) => p.id === confirmed.id && p.ownerId === targetOwnerId)
              ? prev.map((p) => (p.id === confirmed.id && p.ownerId === targetOwnerId ? confirmed : p))
              : [confirmed, ...prev],
          );
        }
        recordCloudVersion('library_prompt', confirmed.id, res.version, res.updatedAt, targetOwnerId);
      }

      setActiveConflict(null);
      setIsEditing(false);
      setIsCreating(false);
      setIsCreatingLibraryPrompt(false);
      setIsEditingLibraryPrompt(false);
      void refreshPublicSnapshot();
      showToast('Đã lưu và ghi đè bản trên thiết bị này lên tài khoản! 🍀', 'success');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleConflictSaveAsCopy = async () => {
    if (!activeConflict || !userId) return;
    setIsResolvingConflict(true);
    try {
      const nowIso = new Date().toISOString();
      if (activeConflict.kind === 'character') {
        const localChar = activeConflict.localItem as Character;
        const copyChar: Character = {
          ...localChar,
          id: `char-${Date.now()}`,
          name: localChar.name.endsWith(' (Bản sao)') ? localChar.name : `${localChar.name} (Bản sao)`,
          isPublic: false,
          isSystem: false,
          createdAt: nowIso,
        };
        const res = await saveCharacterToCloud(userId, copyChar, { isPublic: false, isSystem: false });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể tạo bản sao nhân vật.', 'error');
          return;
        }
        setSelectedCharId(getItemKey(res.data));
      } else if (activeConflict.kind === 'note') {
        const localNote = activeConflict.localItem as Note;
        const copyNote: Note = {
          ...localNote,
          id: `note-${Date.now()}`,
          title: localNote.title.endsWith(' (Bản sao)') ? localNote.title : `${localNote.title} (Bản sao)`,
          isPublic: false,
          isSystem: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const res = await saveNoteToCloud(userId, copyNote, { isPublic: false, isSystem: false });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể tạo bản sao ghi chú.', 'error');
          return;
        }
        setSelectedNoteId(getItemKey(res.data));
      } else if (activeConflict.kind === 'idea') {
        const localIdea = activeConflict.localItem as Idea;
        const copyIdea: Idea = {
          ...localIdea,
          id: `idea-${Date.now()}`,
          title: localIdea.title.endsWith(' (Bản sao)') ? localIdea.title : `${localIdea.title} (Bản sao)`,
          isPublic: false,
          isSystem: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const res = await saveIdeaToCloud(userId, copyIdea, { isPublic: false, isSystem: false });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể tạo bản sao ý tưởng.', 'error');
          return;
        }
        setSelectedIdeaId(getItemKey(res.data));
      } else if (activeConflict.kind === 'library_prompt') {
        const localPrompt = activeConflict.localItem as LibraryPrompt;
        const copyPrompt: LibraryPrompt = {
          ...localPrompt,
          id: `sys-lib-${Date.now()}`,
          title: localPrompt.title.endsWith(' (Bản sao)') ? localPrompt.title : `${localPrompt.title} (Bản sao)`,
          isPublic: false,
          isSystem: false,
          createdAt: nowIso,
        };
        const res = await saveLibraryPromptToCloud(userId, copyPrompt, { isPublic: false, isSystem: false });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể tạo bản sao câu lệnh thư viện.', 'error');
          return;
        }
        setSelectedLibraryPromptId(getItemKey(res.data));
      }

      setActiveConflict(null);
      setIsEditing(false);
      setIsCreating(false);
      setIsCreatingLibraryPrompt(false);
      setIsEditingLibraryPrompt(false);
      await syncFromSupabase(userId, { silent: true, checkLocalPrompt: false });
      showToast('Đã lưu thành bản sao riêng tư mới và giữ nguyên bản trên máy chủ! 🍀', 'success');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  /* ----------------- SELECTION & FILTER SEARCH ----------------- */

  const matchesSourceFilter = (item: { ownerId?: string; isPublic?: boolean; isSystem?: boolean }) => {
    if (sourceFilter === 'all') return true;
    if (sourceFilter === 'system') return Boolean(item.isSystem || !item.ownerId);
    if (sourceFilter === 'community') return Boolean(item.isPublic && !item.isSystem);
    if (sourceFilter === 'mine') {
      return Boolean(isAuthenticated && userId && item.ownerId === userId && !item.isSystem);
    }
    return true;
  };

  // Filtration logic for active left lists
  const queryLower = searchQuery.toLowerCase();

  const filteredNotes = selectedLibTopicId === 'all' ? displayNotes.filter((n) => {
    if (!matchesSourceFilter(n)) return false;
    return (
      n.title.toLowerCase().includes(queryLower) ||
      n.command.toLowerCase().includes(queryLower) ||
      n.content.toLowerCase().includes(queryLower)
    );
  }) : [];

  const activeTopic = TOPICS.find(t => t.id === selectedTopicId) || TOPICS[0];
  const filteredIdeas = displayIdeas
    .filter(matchesSourceFilter)
    .filter(activeTopic.match)
    .filter(i => 
      i.title.toLowerCase().includes(queryLower) ||
      i.content.toLowerCase().includes(queryLower) ||
      (i.tags && i.tags.some(t => t.toLowerCase().includes(queryLower)))
    );

  const filteredCharacters = displayCharacters.filter(c => {
    if (!matchesSourceFilter(c)) return false;
    const matchesText = searchQuery === '' || 
      c.name.toLowerCase().includes(queryLower) ||
      c.role.toLowerCase().includes(queryLower) || 
      (c.description && c.description.toLowerCase().includes(queryLower));
    
    const matchesAuthor = !selectedFilterAuthor || c.author === selectedFilterAuthor;
    
    const matchesTag = !selectedFilterTag || 
      c.role.split('/').map(r => r.trim().toLowerCase()).includes(selectedFilterTag.toLowerCase());
      
    return matchesText && matchesAuthor && matchesTag;
  });

  const activeLibTopic = LIB_TOPICS.find(t => t.id === selectedLibTopicId) || LIB_TOPICS[0];
  const filteredLibraryPrompts = displayLibraryPrompts
    .filter(matchesSourceFilter)
    .filter(activeLibTopic.match)
    .filter(p => {
      const matchesQuery = p.title.toLowerCase().includes(queryLower) ||
        p.description.toLowerCase().includes(queryLower) ||
        p.author.toLowerCase().includes(queryLower) ||
        p.tags.some(t => t.toLowerCase().includes(queryLower));

      const matchesTag = selectedLibTag ? p.tags.includes(selectedLibTag) : true;
      return matchesQuery && matchesTag;
    });

  // Filtered authors based on search query
  const filteredAuthors = authorsList.filter(author => {
    const queryLower = searchQuery.toLowerCase();
    return author.name.toLowerCase().includes(queryLower) ||
      (author.fullName && author.fullName.toLowerCase().includes(queryLower)) ||
      author.bio.toLowerCase().includes(queryLower);
  });

  // Active object selection resolution
  const activeNote = findBySelectedKey(displayNotes, selectedNoteId);
  const activeIdea = findBySelectedKey(displayIdeas, selectedIdeaId);
  const activeChar = findBySelectedKey(displayCharacters, selectedCharId);
  const activeLibraryPrompt = findBySelectedKey(displayLibraryPrompts, selectedLibraryPromptId);
  const activeAuthor = authorsList.find(a => a.id === (selectedAuthorId || (filteredAuthors.length > 0 ? filteredAuthors[0].id : authorsList[0]?.id))) || null;

  const activeAnnouncementCount = announcements.filter((a) => a.isActive).length;

  // Scroll detail viewport back to top whenever tab, selected item, or form mode changes
  const detailScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    detailScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [
    activeTab,
    selectedNoteId,
    selectedLibraryPromptId,
    selectedIdeaId,
    selectedCharId,
    selectedAuthorId,
    isCreating,
    isEditing,
    isCreatingLibraryPrompt,
    isEditingLibraryPrompt,
  ]);

  // Direct prompt link traversal from character profile helper
  const navigateToPrompt = (noteId: string) => {
    setActiveTab('notes');
    setSelectedNoteId(noteId);
    setSelectedLibraryPromptId(null);
    setIsCreating(false);
    setIsEditing(false);
    setIsCreatingLibraryPrompt(false);
    setIsEditingLibraryPrompt(false);
    setShowDetailOnMobile(true); // Jump to detail on mobile
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col bg-[#ECF5EF] dark:bg-[#202423] text-[#20372D] dark:text-[#E4E1D8] transition-theme relative">

      {/* Global left-click pixel clover burst (pointer-events: none, max 2 concurrent bursts) */}
      <CloverClickBurst />

      {/* RETRO EARLY-2000s WINDOW TITLE BAR */}
      <header className="retro-titlebar px-3 sm:px-4 py-2 flex items-center justify-between gap-2 flex-shrink-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          {showDetailOnMobile && (
            <button
              type="button"
              onClick={() => setShowDetailOnMobile(false)}
              className="md:hidden retro-btn px-2.5 py-1 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>← Thư mục</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleGoHome}
            title="Mở lại lá thư chào mừng SéaClover"
            className="flex items-center gap-2 min-w-0 px-1.5 py-0.5 rounded hover:bg-white/45 dark:hover:bg-[#343D37] transition-colors cursor-pointer select-none"
          >
            <PixelCloverIcon className="w-4 h-4 flex-shrink-0" />
            <span className="font-mono text-xs sm:text-[13px] font-semibold tracking-tight text-[#254B3C] dark:text-[#E4E1D8] truncate">
              SéaClover.exe
            </span>
          </button>
        </div>

        {/* Utility buttons: soft square corners with gentle sunken press */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Dark / Light switch */}
          <button
            type="button"
            onClick={toggleTheme}
            className="retro-btn px-2.5 py-1.5 flex items-center justify-center cursor-pointer"
            title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
            aria-label={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
          >
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5 text-[#39755D]" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-[#D5B97A]" />
            )}
          </button>

          {/* Account / Login trigger */}
          <AccountButton
            onOpenAuth={openAuthModal}
            onToast={showToast}
            isSyncing={isSyncingCloud}
            hasLocalDataToImport={hasLocalDataToImport}
            hasPendingImportJob={Boolean(pendingResumableJob)}
            onSyncNow={handleManualSyncNow}
            onOpenLocalMigration={handleOpenLocalMigrationManually}
          />
        </div>
      </header>

      {/* 2-COLUMN WORKSPACE SHELL (1 column on mobile) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative z-20">
        
        {/* LEFT COLUMN: RETRO FOLDER BROWSER SIDEBAR (308px - 328px on desktop) */}
        <aside className={`w-full md:w-[308px] lg:w-[328px] h-full flex-shrink-0 bg-[#FAF6EA] dark:bg-[#292E2B] border-b md:border-b-0 md:border-r border-[#B8D7C5] dark:border-[#49554D] flex flex-col overflow-hidden ${showDetailOnMobile ? 'hidden md:flex' : 'flex'}`}>
          
          {/* Brand Identity Header inside Folder Browser */}
          <div className="px-3.5 py-3 border-b border-[#D5E6DC] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#292E2B] flex items-center justify-between gap-2">
            <div 
              onClick={handleGoHome}
              className="flex items-center gap-2.5 cursor-pointer group select-none min-w-0"
              title="Về lá thư chào mừng"
            >
              <div className="w-10 h-10 rounded-md overflow-hidden bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-none flex-shrink-0 p-0.5">
                <img
                  src="/app-icon.jpg"
                  alt="SéaClover"
                  className="w-full h-full object-cover rounded-[4px]"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-[17px] font-extrabold text-[#2B5A47] dark:text-[#E4E1D8] tracking-tight leading-tight group-hover:text-[#39755D] dark:group-hover:text-[#A3BDA8] transition-colors truncate">
                  SéaClover
                </h1>
                <p className="text-[10px] text-[#567466] dark:text-[#B8BDB5] font-mono tracking-wider mt-0.5 truncate">
                  credit by Nhi Séa
                </p>
              </div>
            </div>

            {/* Subtle blush-pink stationery tab badge on mobile to open welcome letter */}
            <button
              type="button"
              onClick={handleGoHome}
              className="md:hidden retro-btn px-2 py-1 text-[11px] font-semibold text-[#39755D] dark:text-[#A3BDA8] whitespace-nowrap shrink-0 cursor-pointer"
              title="Đọc lá thư chào mừng"
            >
              Thư chào
            </button>
          </div>

          {/* 4 Directory Folder Tabs with Crisp Pixel Icons */}
          <div className="p-2 border-b border-[#D5E6DC] dark:border-[#49554D] bg-[#F1F8F3] dark:bg-[#202423] grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => handleTabChange('characters')}
              className={`py-2 px-1 rounded-md border text-[10px] sm:text-[11px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer active:translate-y-px ${
                activeTab === 'characters'
                  ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-none'
                  : 'bg-[#FFF9EA]/80 dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4C6A5C] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/60 dark:hover:bg-[#343D37] hover:border-[#7AA994]'
              }`}
            >
              <PixelCharacterIcon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate max-w-full leading-tight">Nhân Vật</span>
              <span className="text-[9px] tabular-nums-mono opacity-80">({characters.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('authors')}
              className={`py-2 px-1 rounded-md border text-[10px] sm:text-[11px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer active:translate-y-px ${
                activeTab === 'authors'
                  ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-none'
                  : 'bg-[#FFF9EA]/80 dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4C6A5C] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/60 dark:hover:bg-[#343D37] hover:border-[#7AA994]'
              }`}
            >
              <PixelAuthorIcon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate max-w-full leading-tight">Tác Giả</span>
              <span className="text-[9px] tabular-nums-mono opacity-80">({authorsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('notes')}
              className={`py-2 px-1 rounded-md border text-[10px] sm:text-[11px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer active:translate-y-px ${
                activeTab === 'notes'
                  ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-none'
                  : 'bg-[#FFF9EA]/80 dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4C6A5C] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/60 dark:hover:bg-[#343D37] hover:border-[#7AA994]'
              }`}
            >
              <PixelCommandIcon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate max-w-full leading-tight">Kho Lệnh</span>
              <span className="text-[9px] tabular-nums-mono opacity-80">({notes.length + libraryPrompts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('ideas')}
              className={`py-2 px-1 rounded-md border text-[10px] sm:text-[11px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer active:translate-y-px ${
                activeTab === 'ideas'
                  ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-none'
                  : 'bg-[#FFF9EA]/80 dark:bg-[#292E2B] border-[#C9DFD1] dark:border-[#49554D] text-[#4C6A5C] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/60 dark:hover:bg-[#343D37] hover:border-[#7AA994]'
              }`}
            >
              <PixelIdeaIcon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate max-w-full leading-tight">Kho Idea</span>
              <span className="text-[9px] tabular-nums-mono opacity-80">({ideas.length})</span>
            </button>
          </div>

          {/* Compact Search & Tag Filter Bar */}
          <div className="p-2.5 border-b border-[#E0ECE4] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#292E2B]">
            <div className="relative">
              <PixelSearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4E7A66] dark:text-[#B8BDB5] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'notes' ? 'Tìm kiếm câu lệnh...' : 
                  activeTab === 'ideas' ? 'Tìm kiếm ý tưởng...' : 
                  activeTab === 'characters' ? 'Tìm nhân vật...' : 'Tìm kiếm tác giả...'
                }
                className="retro-input w-full pl-8 pr-3 py-1.5 text-xs placeholder:text-[#6B887A] dark:placeholder:text-[#B8BDB5] transition-theme"
              />
            </div>

            {/* Advanced Tag Filter for Characters */}
            {activeTab === 'characters' && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterModalOpen(true);
                      setCharacterFilterType('tag');
                    }}
                    className={`retro-btn flex-1 py-1.5 px-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedFilterTag ? 'retro-btn-active' : ''
                    }`}
                  >
                    <PixelTagIcon className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                    <span>{selectedFilterTag ? `Tag: #${selectedFilterTag}` : 'Tìm theo Tag'}</span>
                  </button>

                  {selectedFilterTag && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFilterAuthor(null);
                        setSelectedFilterTag(null);
                        setCharacterFilterType(null);
                        showToast('Xóa bộ lọc nhân vật', 'info');
                      }}
                      className="retro-btn px-2.5 text-red-700 dark:text-[#E4A6AA] cursor-pointer"
                      title="Xóa bộ lọc"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Active search filter badge indicator */}
                {selectedFilterTag && (
                  <div className="flex flex-wrap items-center gap-1.5 px-2 py-1 bg-[#FFF9EA] dark:bg-[#292E2B] rounded border border-[#D4E4DA] dark:border-[#49554D] text-[10px] text-[#527062] dark:text-[#B8BDB5]">
                    <span className="font-medium">Đang lọc:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFilterTag(null)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#F2CDDA]/45 dark:bg-[#343D37] text-[#6B374B] dark:text-[#D9A7B8] rounded border border-[#E5B6C6] dark:border-[#49554D] hover:opacity-85 cursor-pointer transition font-semibold"
                    >
                      #{selectedFilterTag} ×
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Categories / Topics Horizontal Scroll Bar specifically for Prompt Library (Notes Tab) */}
          {activeTab === 'notes' && (
            <div className="px-2.5 py-2 border-b border-[#E3EFE7] dark:border-[#49554D] flex items-center gap-1.5 overflow-x-auto snap-x snap-mandatory scrollbar-none">
              {LIB_TOPICS.map((topic) => {
                const isActive = selectedLibTopicId === topic.id;
                const count = libraryPrompts.filter(topic.match).length + (topic.id === 'all' ? notes.length : 0);
                
                const renderLucideIcon = () => {
                  const css = `w-3 h-3 flex-shrink-0 ${isActive ? 'text-[#39755D] dark:text-[#A3BDA8]' : 'text-[#5A786A] dark:text-[#B8BDB5]'}`;
                  switch (topic.id) {
                    case 'all': return <Sparkles className={css} />;
                    case 'story': return <BookOpen className={css} />;
                    case 'hud_social': return <Terminal className={css} />;
                    case 'web': return <Globe className={css} />;
                    case 'nsfw': return <Flame className={css} />;
                    case 'sync_fix': return <RefreshCw className={css} />;
                    case 'control': return <User className={css} />;
                    case 'autoplay': return <Zap className={css} />;
                    case 'minigame': return <Activity className={css} />;
                    default: return <Sparkles className={css} />;
                  }
                };

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedLibTopicId(topic.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap snap-start transition-all cursor-pointer active:translate-y-px ${
                      isActive
                        ? 'border-[#39755D] bg-[#E2F3E8] text-[#224C3B] dark:bg-[#343D37] dark:text-[#E4E1D8] dark:border-[#A3BDA8]'
                        : 'border-[#CFE2D6] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#292E2B] text-[#4C6A5C] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/55 dark:hover:bg-[#343D37]'
                    }`}
                  >
                    {renderLucideIcon()}
                    <span>{topic.name}</span>
                    <span className="text-[10px] opacity-75 tabular-nums-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Categories / Topics Horizontal Scroll Bar specifically for Ideas Tab */}
          {activeTab === 'ideas' && (
            <div className="px-2.5 py-2 border-b border-[#E3EFE7] dark:border-[#49554D] flex items-center gap-1.5 overflow-x-auto snap-x snap-mandatory scrollbar-none">
              {TOPICS.map((topic) => {
                const isActive = selectedTopicId === topic.id;
                const count = ideas.filter(topic.match).length;
                
                const renderLucideIcon = () => {
                  const css = `w-3 h-3 flex-shrink-0 ${isActive ? 'text-[#39755D] dark:text-[#A3BDA8]' : 'text-[#5A786A] dark:text-[#B8BDB5]'}`;
                  switch (topic.id) {
                    case 'all': return <Sparkles className={css} />;
                    case 'cooking': return <Utensils className={css} />;
                    case 'sweet': return <Heart className={css} />;
                    case 'sexy': return <Flame className={css} />;
                    case 'drama': return <Zap className={css} />;
                    case 'funny': return <Smile className={css} />;
                    case 'daily': return <Activity className={css} />;
                    default: return <Sparkles className={css} />;
                  }
                };

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap snap-start transition-all cursor-pointer active:translate-y-px ${
                      isActive
                        ? 'border-[#39755D] bg-[#E2F3E8] text-[#224C3B] dark:bg-[#343D37] dark:text-[#E4E1D8] dark:border-[#A3BDA8]'
                        : 'border-[#CFE2D6] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#292E2B] text-[#4C6A5C] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/55 dark:hover:bg-[#343D37]'
                    }`}
                  >
                    {renderLucideIcon()}
                    <span>{topic.name}</span>
                    <span className="text-[10px] opacity-75 tabular-nums-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Unified Item Listings inside Folder Browser */}
          <div className="flex-1 overflow-y-auto px-2 py-2 pb-16 space-y-1.5">
            {activeTab === 'notes' && (
              <>
                {filteredNotes.map((note) => {
                  const correlatedChar = characters.find(c => c.id === note.characterId);
                  const isSelected = selectedNoteId === note.id && !selectedLibraryPromptId && !isCreating;
                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        setSelectedNoteId(note.id);
                        setSelectedLibraryPromptId(null);
                        setIsCreating(false);
                        setIsEditing(false);
                        setShowDetailOnMobile(true);
                      }}
                      className={`group relative w-full text-left p-2.5 rounded-md transition flex items-start gap-2.5 border cursor-pointer select-none ${
                        isSelected
                          ? 'bg-[#E2F3E8] border-[#39755D] dark:bg-[#343D37] dark:border-[#A3BDA8] text-[#1E4434] dark:text-[#E4E1D8]'
                          : 'bg-[#FFF9EA]/70 dark:bg-[#292E2B] border-transparent hover:border-[#B8D7C5] dark:hover:border-[#A3BDA8] hover:bg-[#E2F3E8]/45 dark:hover:bg-[#343D37] text-[#284237] dark:text-[#E4E1D8]'
                      }`}
                    >
                      <span className="text-lg mt-0.5 leading-none">{note.icon || '☘️'}</span>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className="font-semibold text-xs truncate leading-snug">{note.title}</p>
                        <p className="text-[10px] text-[#587568] dark:text-[#B8BDB5] mt-1 truncate tabular-nums-mono">
                          {correlatedChar ? `${correlatedChar.name} • ` : ''}{new Date(note.updatedAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      
                      {/* Quick Delete Trash Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-[#6B877A] hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Xóa nhanh câu lệnh này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                {filteredLibraryPrompts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedLibraryPromptId(p.id);
                      setSelectedNoteId(null);
                      setIsCreating(false);
                      setIsEditing(false);
                      setShowDetailOnMobile(true);
                      setVisibleSteps({});
                    }}
                    className={`w-full text-left p-2.5 rounded-md transition flex items-start gap-2.5 border cursor-pointer ${
                      selectedLibraryPromptId === p.id && !selectedNoteId && !isCreating
                        ? 'bg-[#E2F3E8] border-[#39755D] dark:bg-[#343D37] dark:border-[#A3BDA8] text-[#1E4434] dark:text-[#E4E1D8]'
                        : 'bg-[#FFF9EA]/70 dark:bg-[#292E2B] border-transparent hover:border-[#B8D7C5] dark:hover:border-[#A3BDA8] hover:bg-[#E2F3E8]/45 dark:hover:bg-[#343D37] text-[#284237] dark:text-[#E4E1D8]'
                    }`}
                  >
                    <span className="text-lg mt-0.5 leading-none">{getLibraryPromptIcon(p)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[12.5px] leading-snug text-[#23503E] dark:text-[#A3BDA8]">{p.title}</p>
                      <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] mt-1 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#648174] dark:text-[#B8BDB5]">
                        <span className="truncate">Tác giả: <strong className="text-[#2D5544] dark:text-[#E4E1D8]">{p.author}</strong></span>
                        <span className="flex items-center gap-1 font-semibold text-[#39755D] dark:text-[#A3BDA8] tabular-nums-mono shrink-0">
                          <Terminal className="w-3 h-3" />
                          {p.steps.length} phần
                        </span>
                      </div>
                    </div>
                  </button>
                ))}

                {filteredNotes.length === 0 && filteredLibraryPrompts.length === 0 && (
                  <div className="p-6 text-center text-[#6B877A] dark:text-[#B8BDB5] text-xs">
                    Thư mục này chưa có câu lệnh phù hợp.
                  </div>
                )}
              </>
            )}

            {activeTab === 'ideas' && (
              <>
                {filteredIdeas.length === 0 ? (
                  <div className="p-6 text-center text-[#6B877A] dark:text-[#B8BDB5] text-xs">
                    Không có ý tưởng nào khớp.
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-0.5">
                    {filteredIdeas.map((idea) => {
                      const topicInfo = getIdeaTopicInfo(idea);
                      const isActive = selectedIdeaId === idea.id && !isCreating;
                      
                      return (
                        <div
                          key={idea.id}
                          onClick={() => {
                            setSelectedIdeaId(idea.id);
                            setShowDetailOnMobile(true);
                          }}
                          className={`group relative text-left p-3 rounded-lg transition-all duration-150 flex flex-col gap-2 border cursor-pointer select-none ${
                            isActive
                              ? 'bg-[#E2F3E8] border-[#39755D] dark:bg-[#343D37] dark:border-[#A3BDA8]'
                              : 'bg-[#FFF9EA] dark:bg-[#292E2B] border-[#CFE2D6] dark:border-[#49554D] hover:border-[#8AB69F] dark:hover:border-[#A3BDA8]'
                          }`}
                        >
                          {/* Card Header (Icon, Topic & Actions) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-base leading-none flex-shrink-0">{topicInfo.icon}</span>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded border truncate select-none ${topicInfo.colorClass}`}>
                                {topicInfo.name}
                              </span>
                            </div>
                            
                            {/* Mini Actions */}
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedIdeaId(idea.id);
                                  setIsEditing(true);
                                  setIsCreating(false);
                                  setShowDetailOnMobile(true);
                                }}
                                className="p-1 rounded text-[#587568] hover:text-[#39755D] hover:bg-[#39755D]/10 dark:text-[#B8BDB5] dark:hover:text-[#A3BDA8] transition"
                                title="Sửa ý tưởng"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteIdea(idea.id);
                                }}
                                className="p-1 rounded text-[#587568] hover:text-red-600 hover:bg-red-500/10 dark:text-[#B8BDB5] dark:hover:text-[#E4A6AA] transition"
                                title="Xóa ý tưởng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Card Title */}
                          <h4 className="font-bold text-xs text-[#20372D] dark:text-[#E4E1D8] leading-snug tracking-tight">
                            {idea.title}
                          </h4>

                          {/* Card Content */}
                          <div className="text-[11px] text-[#3E5A4E] dark:text-[#E4E1D8] leading-relaxed whitespace-pre-wrap break-words bg-white/75 dark:bg-[#202423] p-2.5 rounded border border-[#D8E7DD] dark:border-[#49554D] max-h-[2400px] overflow-y-auto pr-1.5">
                            {idea.content}
                          </div>

                          {/* Card Footer */}
                          <div className="flex items-center justify-between text-[9px] text-[#668476] dark:text-[#B8BDB5] tabular-nums-mono pt-0.5">
                            <span>Gieo: {new Date(idea.createdAt).toLocaleDateString('vi-VN')}</span>
                            {idea.updatedAt && idea.updatedAt !== idea.createdAt && (
                              <span>đã sửa</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'characters' && (
              <>
                {filteredCharacters.length === 0 ? (
                  <div className="p-6 text-center text-[#6B877A] dark:text-[#B8BDB5] text-xs">
                    Chưa có nhân vật nào trong thư mục.
                  </div>
                ) : (
                  filteredCharacters.map((char) => {
                    const isSelected = selectedCharId === char.id && !isCreating;
                    return (
                      <div
                        key={char.id}
                        onClick={() => {
                          setSelectedCharId(char.id);
                          setIsCreating(false);
                          setIsEditing(false);
                          setShowDetailOnMobile(true);
                        }}
                        className={`group relative w-full text-left p-2.5 rounded-md transition flex items-start gap-2.5 border cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#E2F3E8] border-[#39755D] dark:bg-[#343D37] dark:border-[#A3BDA8] text-[#1E4434] dark:text-[#E4E1D8]'
                            : 'bg-[#FFF9EA]/70 dark:bg-[#292E2B] border-transparent hover:border-[#B8D7C5] dark:hover:border-[#A3BDA8] hover:bg-[#E2F3E8]/45 dark:hover:bg-[#343D37] text-[#284237] dark:text-[#E4E1D8]'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-xs truncate leading-snug text-[#20372D] dark:text-[#E4E1D8] group-hover:text-[#39755D] dark:group-hover:text-[#A3BDA8] transition-colors">
                              {char.name}
                            </p>
                            {char.author && (
                              <span
                                className="px-1.5 py-0.5 text-[9px] bg-[#E2F3E8]/80 dark:bg-[#343D37] text-[#39755D] dark:text-[#A3BDA8] rounded border border-[#BDD9C9] dark:border-[#49554D] font-medium max-w-[85px] truncate"
                                title={`Tác giả: ${char.author}`}
                              >
                                {char.author}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#5B786B] dark:text-[#B8BDB5] mt-1 truncate">{char.role}</p>
                        </div>

                        {/* Quick Delete Character Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCharacter(char.id);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-[#6B877A] hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Xóa nhanh nhân vật này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'authors' && (
              <>
                {filteredAuthors.length === 0 ? (
                  <div className="p-6 text-center text-[#6B877A] dark:text-[#B8BDB5] text-xs">
                    Chưa có tác giả nào trong thư mục.
                  </div>
                ) : (
                  filteredAuthors.map((author) => {
                    const isSelected = selectedAuthorId === author.id || (!selectedAuthorId && author.id === authorsList[0]?.id);
                    return (
                      <div
                        key={author.id}
                        onClick={() => {
                          setSelectedAuthorId(author.id);
                          setIsCreating(false);
                          setIsEditing(false);
                          setShowDetailOnMobile(true);
                        }}
                        className={`group relative w-full text-left p-2.5 rounded-md transition flex items-center gap-2.5 border cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#E2F3E8] border-[#39755D] dark:bg-[#343D37] dark:border-[#A3BDA8] text-[#1E4434] dark:text-[#E4E1D8]'
                            : 'bg-[#FFF9EA]/70 dark:bg-[#292E2B] border-transparent hover:border-[#B8D7C5] dark:hover:border-[#A3BDA8] hover:bg-[#E2F3E8]/45 dark:hover:bg-[#343D37] text-[#284237] dark:text-[#E4E1D8]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-md bg-[#FFF9EA] dark:bg-[#292E2B] flex items-center justify-center text-base border border-[#C6DFD0] dark:border-[#49554D]">
                          {author.avatarEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-xs truncate leading-snug ${isSelected ? 'text-[#214C3B] dark:text-[#A3BDA8] font-bold' : 'text-[#20372D] dark:text-[#E4E1D8]'}`}>
                            {author.name}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Sidebar Creation Command Anchor */}
          {activeTab !== 'authors' && (
            <div className="sticky bottom-0 p-2.5 border-t border-[#CBE0D3] dark:border-[#49554D] bg-[#F1F8F3] dark:bg-[#202423] flex justify-center z-10">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  setIsEditing(false);
                  setShowDetailOnMobile(true);
                }}
                className="retro-btn-primary w-full py-2 px-4 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Mới {
                  activeTab === 'notes' ? 'Câu Lệnh' : 
                  activeTab === 'ideas' ? 'Ý Tưởng' : 'Nhân Vật'
                }</span>
              </button>
            </div>
          )}
        </aside>

        {/* RIGHT COLUMN: MAIN LETTER & DETAIL VIEWPORT */}
        <main className={`flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-[#EDF6F0] dark:bg-[#202423] ${showDetailOnMobile ? 'flex' : 'hidden md:flex'}`}>
          
          {/* DETAILS OR FORM EDITOR VIEW (Scroll container begins strictly below top bar) */}
          <div
            ref={detailScrollRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5"
          >
            <div className="max-w-5xl w-full mx-auto space-y-4">
              
              {/* 1. CREATION / FORM SECTOR */}
              {isCreating && (
                <div className="w-full">
                  {activeTab === 'notes' && (
                    <NoteForm 
                      characters={characters}
                      onSave={handleSaveNote}
                      onCancel={() => setIsCreating(false)}
                      isSaving={isSavingItem}
                    />
                  )}
                  {activeTab === 'ideas' && (
                    <IdeaForm 
                      onSave={handleSaveIdea}
                      onCancel={() => setIsCreating(false)}
                      isSaving={isSavingItem}
                    />
                  )}
                  {activeTab === 'characters' && (
                    <CharacterForm 
                      onSave={handleSaveCharacter}
                      onCancel={() => setIsCreating(false)}
                      isSaving={isSavingItem}
                    />
                  )}
                </div>
              )}

              {/* 2. CHOSEN EDIT STATE */}
              {isEditing && (
                <div className="w-full">
                  {activeTab === 'notes' && activeNote && (
                    <NoteForm 
                      initialData={activeNote}
                      characters={characters}
                      onSave={handleSaveNote}
                      onCancel={() => setIsEditing(false)}
                      isSaving={isSavingItem}
                    />
                  )}
                  {activeTab === 'ideas' && activeIdea && (
                    <IdeaForm 
                      initialData={activeIdea}
                      onSave={handleSaveIdea}
                      onCancel={() => setIsEditing(false)}
                      isSaving={isSavingItem}
                    />
                  )}
                  {activeTab === 'characters' && activeChar && (
                    <CharacterForm 
                      initialData={activeChar}
                      onSave={handleSaveCharacter}
                      onCancel={() => setIsEditing(false)}
                      isSaving={isSavingItem}
                    />
                  )}
                </div>
              )}

              {/* 3. COHESIVE READ MODE (ONLY SHOWS IF NOT CREATING OR EDITING) */}
              {!isCreating && !isEditing && (
                <>
                  {/* A. NOT SELECTED STATE — OPENED HANDWRITTEN WELCOME LETTER */}
                  {((activeTab === 'notes' && !activeNote && !activeLibraryPrompt) || 
                    (activeTab === 'ideas' && !activeIdea) || 
                    (activeTab === 'characters' && !activeChar) ||
                    (activeTab === 'authors' && !activeAuthor)) && (
                    <section className="letter-paper relative rounded-lg px-5 py-5 sm:px-8 sm:py-7 animate-fade-in overflow-hidden">
                      {/* Soft blush-pink masking-tape accent at top-left paper corner */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-1 left-6 w-16 h-3.5 bg-[#F2CDDA]/85 dark:bg-[#9E7786]/45 border-x border-b border-[#E3B2C4]/70 dark:border-[#9E7786]/40 rounded-b-[2px] -rotate-2"
                      />

                      {/* Header Row ONLY shares width with postage stamp & "おてがみ" postmark */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 text-left pt-2">
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5B7D6E] dark:text-[#B8BDB5] mb-1.5">
                            Dear friend — SéaClover
                          </p>
                          <h2 className="text-xl sm:text-2xl font-bold text-[#2B5A47] dark:text-[#E4E1D8] tracking-tight leading-snug">
                            Gửi bạn, từ SéaClover
                          </h2>
                        </div>

                        {/* Top-right Perforated Postage Stamp + Circular "おてがみ" Postmark */}
                        <div className="flex items-center justify-end flex-shrink-0 select-none">
                          <div className="-mr-4 sm:-mr-5 z-10 text-[#39755D] dark:text-[#A3BDA8] pointer-events-none">
                            <OtegamiPostmark className="w-16 h-14 sm:w-24 sm:h-[74px]" />
                          </div>

                          <div className="postage-stamp rotate-[2deg]">
                            <div className="bg-[#FFF9EA] dark:bg-[#292E2B] p-1 border border-[#D89AB1] dark:border-[#8C6876]">
                              <img
                                src="/app-icon.jpg"
                                alt="Mascot cỏ bốn lá SéaClover"
                                className="w-[58px] h-[58px] sm:w-[74px] sm:h-[74px] object-cover block"
                              />
                              <div className="flex items-center justify-between pt-1 px-0.5 font-mono text-[7.5px] font-semibold text-[#8A4E64] dark:text-[#D9A7B8] leading-none">
                                <span>CLOVER</span>
                                <span>04</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Full-width natural-wrapping letter body below header & stamp */}
                      <p className="mt-4 w-full text-left text-[15px] sm:text-base leading-7 text-[#2B463A] dark:text-[#E4E1D8]">
                        Mình để dành ở đây những nhân vật, câu lệnh và ý tưởng mình thích. Bạn cứ mở một thư mục và xem từ từ nhé. 🍀
                      </p>

                      {/* Hairline stationery rule separating letter body & 4 mini folder shortcuts */}
                      <div className="mt-6 pt-5 border-t border-dashed border-[#B7D4C3] dark:border-[#49554D]">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="font-mono text-[11px] font-semibold tracking-wider text-[#4C7060] dark:text-[#B8BDB5]">
                            Mở nhanh thư mục
                          </span>
                          <span className="font-mono text-[10px] text-[#6B8A7B] dark:text-[#B8BDB5] tabular-nums-mono">
                            4 thư mục
                          </span>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('characters');
                              setShowDetailOnMobile(false);
                            }}
                            className="retro-btn p-3 text-left flex flex-col items-start gap-2 cursor-pointer group"
                          >
                            <div className="w-full flex items-center justify-between gap-2">
                              <PixelFolderShortcutIcon
                                variant="characters"
                                className="w-9 h-8 transition-transform duration-150 group-hover:-translate-y-0.5"
                              />
                              <span className="tabular-nums-mono text-[10px] px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#2F634E] dark:text-[#A3BDA8] border border-[#BDDAC9] dark:border-[#49554D]">
                                {characters.length}
                              </span>
                            </div>
                            <div className="min-w-0 w-full">
                              <h3 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug">
                                Nhân Vật
                              </h3>
                              <p className="text-[11px] text-[#587668] dark:text-[#B8BDB5] mt-0.5 leading-snug line-clamp-2">
                                Hồ sơ các nhân vật bạn lưu giữ
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('authors');
                              setShowDetailOnMobile(false);
                            }}
                            className="retro-btn p-3 text-left flex flex-col items-start gap-2 cursor-pointer group"
                          >
                            <div className="w-full flex items-center justify-between gap-2">
                              <PixelFolderShortcutIcon
                                variant="authors"
                                className="w-9 h-8 transition-transform duration-150 group-hover:-translate-y-0.5"
                              />
                              <span className="tabular-nums-mono text-[10px] px-1.5 py-0.5 rounded bg-[#F2CDDA]/55 dark:bg-[#343D37] text-[#7A3F55] dark:text-[#D9A7B8] border border-[#E6B8C8] dark:border-[#49554D]">
                                {authorsList.length}
                              </span>
                            </div>
                            <div className="min-w-0 w-full">
                              <h3 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug">
                                Tác Giả
                              </h3>
                              <p className="text-[11px] text-[#587668] dark:text-[#B8BDB5] mt-0.5 leading-snug line-clamp-2">
                                Ghi chú về các tác giả yêu thích
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('notes');
                              setShowDetailOnMobile(false);
                            }}
                            className="retro-btn p-3 text-left flex flex-col items-start gap-2 cursor-pointer group"
                          >
                            <div className="w-full flex items-center justify-between gap-2">
                              <PixelFolderShortcutIcon
                                variant="notes"
                                className="w-9 h-8 transition-transform duration-150 group-hover:-translate-y-0.5"
                              />
                              <span className="tabular-nums-mono text-[10px] px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#2F634E] dark:text-[#A3BDA8] border border-[#BDDAC9] dark:border-[#49554D]">
                                {notes.length + libraryPrompts.length}
                              </span>
                            </div>
                            <div className="min-w-0 w-full">
                              <h3 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug">
                                Kho Lệnh
                              </h3>
                              <p className="text-[11px] text-[#587668] dark:text-[#B8BDB5] mt-0.5 leading-snug line-clamp-2">
                                Prompt mẫu & câu lệnh tiện dùng
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('ideas');
                              setShowDetailOnMobile(false);
                            }}
                            className="retro-btn p-3 text-left flex flex-col items-start gap-2 cursor-pointer group"
                          >
                            <div className="w-full flex items-center justify-between gap-2">
                              <PixelFolderShortcutIcon
                                variant="ideas"
                                className="w-9 h-8 transition-transform duration-150 group-hover:-translate-y-0.5"
                              />
                              <span className="tabular-nums-mono text-[10px] px-1.5 py-0.5 rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#2F634E] dark:text-[#A3BDA8] border border-[#BDDAC9] dark:border-[#49554D]">
                                {ideas.length}
                              </span>
                            </div>
                            <div className="min-w-0 w-full">
                              <h3 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug">
                                Kho Idea
                              </h3>
                              <p className="text-[11px] text-[#587668] dark:text-[#B8BDB5] mt-0.5 leading-snug line-clamp-2">
                                Những ý tưởng vui để chơi cùng char
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* B. NOTE DETAILS COMPONENT DISPLAY */}
                  {activeTab === 'notes' && activeNote && (
                    <article className="space-y-4 animate-fade-in min-w-0" id="active-note-card">
                      {/* Header Window */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2.5 flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#39755D] dark:text-[#A3BDA8] flex items-center gap-1.5">
                            <PixelCommandIcon className="w-3.5 h-3.5" />
                            Kho Lệnh / Ghi chú cá nhân
                          </span>
                          <span className="text-[10px] tabular-nums-mono text-[#587568] dark:text-[#B8BDB5]">
                            {new Date(activeNote.updatedAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <div className="p-4 flex flex-col sm:flex-row justify-between items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h2 className="text-lg sm:text-xl font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug break-words flex items-center gap-2">
                              <span>{activeNote.icon || '☘️'}</span>
                              <span>{activeNote.title}</span>
                            </h2>
                          </div>
                          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsEditing(true)}
                              className="retro-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                              <span>Chỉnh sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(activeNote.id)}
                              className="retro-btn-danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa bỏ</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Linked Character Strip */}
                      <div className="retro-callout-mint p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-md bg-[#FFF9EA] dark:bg-[#292E2B] border border-[#B8D7C5] dark:border-[#49554D] flex items-center justify-center text-2xl flex-shrink-0">
                            {characters.find(c => c.id === activeNote.characterId)?.avatar || '🍀'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-mono uppercase font-semibold text-[#39755D] dark:text-[#A3BDA8] tracking-wider">
                              Nhân vật liên kết
                            </p>
                            <h4 className="font-bold text-[#20372D] dark:text-[#E4E1D8] text-sm truncate">
                              {characters.find(c => c.id === activeNote.characterId)?.name || 'Không xác định'}
                            </h4>
                            <p className="text-xs text-[#547264] dark:text-[#B8BDB5] truncate">
                              {characters.find(c => c.id === activeNote.characterId)?.role || 'Vui lòng chỉnh sửa và liên kết nhân vật'}
                            </p>
                          </div>
                        </div>
                        
                        {activeNote.characterId && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('characters');
                              setSelectedCharId(activeNote.characterId);
                            }}
                            className="retro-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="Đến trang chi tiết nhân vật"
                          >
                            <span>Xem nhân vật</span>
                            <ExternalLink className="w-3 h-3 text-[#39755D] dark:text-[#A3BDA8]" />
                          </button>
                        )}
                      </div>

                      {/* Section 1: Prompt cần nhập (Command) */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2.5 flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                            <span>1. PROMPT CẦN NHẬP (LỆNH CHÍNH)</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(activeNote.command, 'Prompt cần nhập')}
                            className="retro-btn-primary px-2.5 py-1 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </button>
                        </div>
                        <div className="p-3.5">
                          <div className="retro-code-box p-3.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words select-all">
                            {activeNote.command}
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Nội dung (Detailed content instructions) */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2.5 flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-2">
                            <Info className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                            <span>2. NỘI DUNG CHI TIẾT KÈM DỮ LIỆU</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(activeNote.content, 'Nội dung')}
                            className="retro-btn-primary px-2.5 py-1 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </button>
                        </div>
                        <div className="p-4 text-sm leading-relaxed text-[#294338] dark:text-[#E4E1D8] whitespace-pre-wrap break-words select-text">
                          {activeNote.content}
                        </div>
                      </div>
                    </article>
                  )}

                  {/* B2. PROMPT LIBRARY DETAILS DISPLAY */}
                  {activeTab === 'notes' && activeLibraryPrompt && (
                    <article className="space-y-4 animate-fade-in min-w-0" id="active-library-prompt-card">
                      {/* Compact Retro Window Header */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <PixelCommandIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#FFF9EA] dark:bg-[#292E2B] text-[#39755D] dark:text-[#A3BDA8] rounded border border-[#B8D7C5] dark:border-[#49554D]">
                              Kho Lệnh AI
                            </span>
                            <span className="text-xs text-[#547264] dark:text-[#B8BDB5] truncate">
                              Tác giả: <strong className="text-[#23503E] dark:text-[#E4E1D8] font-semibold">{activeLibraryPrompt.author}</strong>
                            </span>
                          </div>
                          <span className="text-[10px] tabular-nums-mono text-[#5B7A6C] dark:text-[#B8BDB5]">
                            {activeLibraryPrompt.steps.length} khối lệnh
                          </span>
                        </div>

                        <div className="px-4 py-3.5">
                          <h2 className="text-lg sm:text-xl font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug flex items-start gap-2.5">
                            <span className="text-xl leading-none mt-0.5 flex-shrink-0">{getLibraryPromptIcon(activeLibraryPrompt)}</span>
                            <span className="min-w-0 break-words">{activeLibraryPrompt.title}</span>
                          </h2>
                        </div>
                      </div>

                      {/* Section Description Card — Mint accent */}
                      <div className="retro-callout-mint p-4 space-y-1.5">
                        <h4 className="text-xs font-bold text-[#255442] dark:text-[#A3BDA8] flex items-center gap-1.5 uppercase tracking-wide">
                          <Info className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
                          <span>Thông tin về công cụ lệnh</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-[#2A4539] dark:text-[#E4E1D8] leading-relaxed whitespace-pre-line break-words">
                          {activeLibraryPrompt.description}
                        </p>
                      </div>

                      {/* Section How to use Card — Warm cream accent */}
                      <div className="retro-callout-warm p-4 space-y-1.5">
                        <h4 className="text-xs font-bold text-[#6E5120] dark:text-[#D5B97A] flex items-center gap-1.5 uppercase tracking-wide">
                          <Terminal className="w-3.5 h-3.5 text-[#9C742E] dark:text-[#D5B97A] flex-shrink-0" />
                          <span>Hướng dẫn sử dụng (Cách dùng)</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-[#3A3528] dark:text-[#E4E1D8] leading-relaxed whitespace-pre-line break-words">
                          {activeLibraryPrompt.howToUse}
                        </p>
                      </div>

                      {/* Steps / Commands list section */}
                      <div className="space-y-3">
                        {activeLibraryPrompt.steps.length === 1 ? (
                          // SINGLE CONTINUOUS BLOCK
                          <div className="retro-window overflow-hidden">
                            <div className="retro-window-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Terminal className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] flex-shrink-0" />
                                <h3 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] uppercase tracking-wider truncate">
                                  Nội dung câu lệnh
                                </h3>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setVisibleSteps(prev => ({ ...prev, 0: !prev[0] }))}
                                  className={`retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                                    visibleSteps[0] ? 'retro-btn-active' : ''
                                  }`}
                                >
                                  {visibleSteps[0] ? (
                                    <>
                                      <EyeOff className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                      <span>Ẩn lệnh</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                      <span>Hiện lệnh</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(activeLibraryPrompt.steps[0].content, activeLibraryPrompt.title)}
                                  className="retro-btn-primary px-3 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                                  title="Copy toàn bộ câu lệnh này"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy lệnh</span>
                                </button>
                              </div>
                            </div>

                            <div className="px-4 py-2.5 border-b border-[#DCEAE1] dark:border-[#49554D] bg-[#FAF6EA]/80 dark:bg-[#202423] flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#3C5C4E] dark:text-[#B8BDB5]">
                                {activeLibraryPrompt.steps[0].label || 'Khối câu lệnh chính'}
                              </span>
                              {!visibleSteps[0] && (
                                <span className="font-mono text-[10px] text-[#668476] dark:text-[#B8BDB5]">
                                  Bấm “Hiện lệnh” để xem chi tiết
                                </span>
                              )}
                            </div>

                            {visibleSteps[0] && (
                              <div className="p-3.5 space-y-3">
                                <pre className="retro-code-box p-3.5 text-xs leading-relaxed whitespace-pre-wrap break-words select-all m-0">
                                  {activeLibraryPrompt.steps[0].content}
                                </pre>
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(activeLibraryPrompt.steps[0].content, activeLibraryPrompt.title)}
                                    className="retro-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy toàn bộ câu lệnh</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          // MULTI-STEP / EN-VI TRANSLATION BLOCKS
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                              <h3 className="text-xs font-bold text-[#224C3B] dark:text-[#A3BDA8] uppercase tracking-wider flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                <span>Danh sách các khối câu lệnh ({activeLibraryPrompt.steps.length})</span>
                              </h3>
                              <p className="text-[10px] font-mono text-[#5B7A6C] dark:text-[#B8BDB5] hidden sm:inline">
                                * Tách nhỏ từng phần để dễ theo dõi và sao chép riêng
                              </p>
                            </div>

                            <div className="space-y-3">
                              {activeLibraryPrompt.steps.map((step, index) => {
                                const isOpen = !!visibleSteps[index];
                                return (
                                  <div
                                    key={index}
                                    className="retro-window overflow-hidden"
                                  >
                                    {/* Step Card Header */}
                                    <div className="retro-window-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-5 h-5 rounded bg-[#39755D] dark:bg-[#343D37] text-[#FFF9EA] dark:text-[#A3BDA8] dark:border dark:border-[#49554D] text-[10px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                                          {index + 1}
                                        </span>
                                        <span className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] break-words">
                                          {step.label || 'Khối lệnh'}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setVisibleSteps(prev => ({ ...prev, [index]: !prev[index] }))}
                                          className={`retro-btn px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                                            isOpen ? 'retro-btn-active' : ''
                                          }`}
                                          title={isOpen ? 'Thu gọn nội dung hiển thị' : 'Bấm để xem nội dung câu lệnh'}
                                        >
                                          {isOpen ? (
                                            <>
                                              <EyeOff className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                              <span className="hidden min-[400px]:inline">Ẩn lệnh</span>
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                              <span className="hidden min-[400px]:inline">Hiện lệnh</span>
                                            </>
                                          )}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(step.content, `Bước ${index + 1}: ${step.label}`)}
                                          className="retro-btn-primary px-2.5 py-1 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                                          title="Copy ngay lập tức"
                                        >
                                          <Copy className="w-3 h-3" />
                                          <span>Copy lệnh {index + 1}</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Step Card Content (Collapsible) */}
                                    {isOpen && (
                                      <div className="p-3.5 space-y-2.5">
                                        <pre className="retro-code-box p-3.5 text-xs leading-relaxed whitespace-pre-wrap break-words select-all m-0">
                                          {step.content}
                                        </pre>
                                        <div className="flex justify-end">
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(step.content, `Bước ${index + 1}: ${step.label || 'Lệnh'}`)}
                                            className="retro-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Copy câu lệnh</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </article>
                  )}

                  {/* C. IDEA DETAILS COMPONENT DISPLAY */}
                  {activeTab === 'ideas' && activeIdea && (
                    <article className="space-y-4 animate-fade-in min-w-0" id="active-idea-card">
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2.5 flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#39755D] dark:text-[#A3BDA8] flex items-center gap-1.5">
                            <PixelIdeaIcon className="w-3.5 h-3.5" />
                            Kho Idea
                          </span>
                          <span className="text-[10px] tabular-nums-mono text-[#587568] dark:text-[#B8BDB5]">
                            Gieo ngày: {new Date(activeIdea.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        <div className="p-4 flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-[#D8E7DD] dark:border-[#49554D]">
                          <h2 className="text-lg sm:text-xl font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug break-words flex-1 min-w-0">
                            {activeIdea.title}
                          </h2>
                          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsEditing(true)}
                              className="retro-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                              <span>Chỉnh sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIdea(activeIdea.id)}
                              className="retro-btn-danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa</span>
                            </button>
                          </div>
                        </div>

                        <div className="p-4 sm:p-5">
                          <p className="text-sm text-[#284237] dark:text-[#E4E1D8] whitespace-pre-wrap break-words leading-relaxed">
                            {activeIdea.content}
                          </p>
                        </div>
                      </div>
                    </article>
                  )}

                  {/* D. CHARACTER DETAILS COMPONENT DISPLAY */}
                  {activeTab === 'characters' && activeChar && (
                    <article className="space-y-4 animate-fade-in min-w-0" id="active-character-card">
                      {/* Compact Retro Profile Window */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#39755D] dark:text-[#A3BDA8] flex items-center gap-1.5">
                            <PixelCharacterIcon className="w-3.5 h-3.5" />
                            Hồ sơ Nhân Vật
                          </span>
                          {activeChar.author && (
                            <span className="px-2 py-0.5 bg-[#FFF9EA] dark:bg-[#292E2B] text-[#39755D] dark:text-[#A3BDA8] rounded text-[10px] font-semibold border border-[#B8D7C5] dark:border-[#49554D]">
                              Tác giả: {activeChar.author}
                            </span>
                          )}
                        </div>

                        <div className="p-4 space-y-3.5">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                            <div className="flex items-start gap-3.5 min-w-0 flex-1">
                              <div className="w-14 h-14 rounded-lg bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] flex items-center justify-center text-3xl flex-shrink-0">
                                {activeChar.avatar}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h2 className="text-lg sm:text-xl font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug break-words">
                                  {activeChar.name}
                                </h2>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {activeChar.role.split('/').map((tag, idx) => {
                                    const trimmed = tag.trim();
                                    if (!trimmed) return null;
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          setSelectedFilterTag(trimmed);
                                          setShowDetailOnMobile(false);
                                          showToast(`Đang lọc nhân vật theo tag: ${trimmed}`, 'info');
                                        }}
                                        className="px-2 py-0.5 bg-[#E2F3E8] dark:bg-[#202423] text-[#285B47] dark:text-[#A3BDA8] hover:bg-[#39755D] hover:text-[#FFF9EA] dark:hover:bg-[#343D37] dark:hover:text-[#E4E1D8] dark:hover:border-[#A3BDA8] font-semibold text-[11px] rounded border border-[#B3D5C1] dark:border-[#49554D] transition cursor-pointer"
                                        title={`Lọc theo tag #${trimmed}`}
                                      >
                                        #{trimmed}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="retro-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                <span>Chỉnh sửa</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCharacter(activeChar.id)}
                                className="retro-btn-danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </div>

                          {activeChar.description && (
                            <div className="pt-3 border-t border-[#DCEAE1] dark:border-[#49554D] text-sm text-[#2B463A] dark:text-[#E4E1D8] leading-relaxed break-words">
                              {activeChar.description}
                            </div>
                          )}

                          {/* Social external linkages — unified retro-btn style */}
                          {(activeChar.fb || activeChar.discord || activeChar.discord2 || activeChar.web || activeChar.other || activeChar.ggai) && (
                            <div className="pt-3 flex flex-wrap gap-2 border-t border-[#DCEAE1] dark:border-[#49554D]">
                              {activeChar.fb && (
                                <a
                                  href={typeof activeChar.fb === 'object' ? activeChar.fb.url : activeChar.fb}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="retro-btn inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                                  title="Truy cập tác giả Facebook"
                                >
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
                                  </svg>
                                  <span>{typeof activeChar.fb === 'object' ? activeChar.fb.name : 'Góc Tam Quan Lệch Của Tinh Âm'}</span>
                                </a>
                              )}

                              {activeChar.discord && (
                                <a
                                  href={typeof activeChar.discord === 'object' ? activeChar.discord.url : activeChar.discord}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="retro-btn inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                                  title="Tham gia cộng đồng Discord"
                                >
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 127.14 96.36" fill="currentColor">
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.51-5c.89-.65,1.76-1.34,2.58-2a75.59,75.59,0,0,0,73,0c.83.68,1.69,1.37,2.58,2a68.43,68.43,0,0,1-10.51,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,48.12,123.7,25.28,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" fill="#5865F2" />
                                  </svg>
                                  <span>{typeof activeChar.discord === 'object' ? activeChar.discord.name : '🌸Vườn Nhỏ Dưới Tán Anh Đào🌸'}</span>
                                </a>
                              )}

                              {activeChar.discord2 && (
                                <a
                                  href={typeof activeChar.discord2 === 'object' ? activeChar.discord2.url : activeChar.discord2}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="retro-btn inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                                  title="Tham gia cộng đồng Discord phụ"
                                >
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 127.14 96.36" fill="currentColor">
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.51-5c.89-.65,1.76-1.34,2.58-2a75.59,75.59,0,0,0,73,0c.83.68,1.69,1.37,2.58,2a68.43,68.43,0,0,1-10.51,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,48.12,123.7,25.28,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" fill="#7C3AED" />
                                  </svg>
                                  <span>{typeof activeChar.discord2 === 'object' ? activeChar.discord2.name : 'Discord'}</span>
                                </a>
                              )}

                              {activeChar.web && (
                                <a
                                  href={typeof activeChar.web === 'object' ? activeChar.web.url : activeChar.web}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="retro-btn inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                                  title="Truy cập Website"
                                >
                                  <Globe className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                  <span>{typeof activeChar.web === 'object' ? activeChar.web.name : 'Website'}</span>
                                </a>
                              )}

                              {activeChar.other && (
                                <a
                                  href={typeof activeChar.other === 'object' ? activeChar.other.url : activeChar.other}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="retro-btn inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                                  title="Truy cập Website phụ"
                                >
                                  <Globe className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                  <span>{typeof activeChar.other === 'object' ? activeChar.other.name : 'Website'}</span>
                                </a>
                              )}

                              {activeChar.ggai && (
                                <div className="inline-flex items-center gap-1">
                                  <a
                                    href={activeChar.ggai}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="retro-btn inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                                    title={`Mở Prompt ${activeChar.name} trong Google AI Studio`}
                                  >
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                    </svg>
                                    <span>{activeChar.name}</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(activeChar.ggai || '', 'Link Google AI Studio')}
                                    className="retro-btn px-2 py-1.5 text-xs cursor-pointer"
                                    title="Sao chép link Google AI Studio"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* BACKSTORY dual retro windows */}
                      {(activeChar.backstoryUser || activeChar.backstoryChar) && (
                        <div className={`grid gap-4 ${
                          activeChar.backstoryUser && activeChar.backstoryChar 
                            ? 'grid-cols-1 md:grid-cols-2' 
                            : 'grid-cols-1'
                        }`}>
                          {activeChar.backstoryUser && (
                            <div className="retro-window overflow-hidden">
                              <div className="retro-window-header px-4 py-2">
                                <h4 className="text-[11px] font-bold text-[#224C3B] dark:text-[#A3BDA8] uppercase tracking-wider">
                                  {activeChar.backstoryUserTitle || '📖 BACKSTORY (user)'}
                                </h4>
                              </div>
                              <div className="p-4 text-[13px] text-[#2A4539] dark:text-[#E4E1D8] whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
                                {activeChar.backstoryUser}
                              </div>
                            </div>
                          )}

                          {activeChar.backstoryChar && (
                            <div className="retro-window overflow-hidden">
                              <div className="retro-window-header px-4 py-2">
                                <h4 className="text-[11px] font-bold text-[#224C3B] dark:text-[#A3BDA8] uppercase tracking-wider">
                                  {activeChar.backstoryCharTitle || `👤 BACKSTORY (${activeChar.name})`}
                                </h4>
                              </div>
                              <div className="p-4 text-[13px] text-[#2A4539] dark:text-[#E4E1D8] whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
                                {activeChar.backstoryChar}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SYSTEM PROMPT retro window */}
                      <div className="retro-window overflow-hidden" id={`prompt-${activeChar.id}`}>
                        <div className="retro-window-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                            <span>SYSTEM PROMPT</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const fullPrompt = buildCharacterRoleplayPrompt(activeChar);
                              copyToClipboard(fullPrompt, `Prompt nhập vai của ${activeChar.name}`);
                            }}
                            className="retro-btn-primary px-3 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                            title="Sao chép toàn bộ Prompt nhập vai này"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy prompt</span>
                          </button>
                        </div>
                        
                        <div className="p-3.5">
                          <pre className="retro-code-box p-3.5 text-xs leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap break-words select-all m-0">
                            {buildCharacterRoleplayPrompt(activeChar)}
                          </pre>
                        </div>
                        
                        <div className="px-4 py-2 bg-[#F4F9F6] dark:bg-[#202423] border-t border-[#DCEAE1] dark:border-[#49554D] text-[11px] text-[#547264] dark:text-[#B8BDB5]">
                          Mẹo: Sao chép khối prompt này dán trực tiếp vào mục System Instructions / Chat Prompt của mô hình AI.
                        </div>
                      </div>

                      {/* USER PROFILE retro window */}
                      {activeChar.userProfile && (
                        <div className="retro-window overflow-hidden" id="profile-user-card">
                          <div className="retro-window-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-[11px] font-bold text-[#224C3B] dark:text-[#A3BDA8] uppercase tracking-wider">
                              {activeChar.userProfileTitle || '👤 HỒ SƠ NHÂN VẬT: {{USER}}'}
                            </h4>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(activeChar.userProfile || '', `${activeChar.userProfileTitle || 'Hồ sơ nhân vật'} của ${activeChar.name}`)}
                              className="retro-btn-primary px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                              title="Sao chép hồ sơ nhân vật này"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy hồ sơ</span>
                            </button>
                          </div>
                          <div className="p-3.5">
                            <pre className="retro-code-box p-3.5 text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap break-words m-0">
                              {activeChar.userProfile}
                            </pre>
                          </div>
                        </div>
                      )}
                    </article>
                  )}

                  {/* E. AUTHOR DETAILS COMPONENT DISPLAY */}
                  {activeTab === 'authors' && activeAuthor && (
                    <article className="space-y-4 animate-fade-in min-w-0" id="active-author-card">
                      {/* Compact Author Retro Window */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#39755D] dark:text-[#A3BDA8] flex items-center gap-1.5">
                            <PixelAuthorIcon className="w-3.5 h-3.5" />
                            Hồ sơ Tác Giả
                          </span>
                        </div>
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                          <div className="w-16 h-16 rounded-lg bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] flex items-center justify-center text-3xl flex-shrink-0">
                            {activeAuthor.avatarEmoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h2 className="text-xl sm:text-2xl font-bold text-[#224C3B] dark:text-[#E4E1D8] tracking-tight break-words">
                              {activeAuthor.fullName || activeAuthor.name}
                            </h2>
                          </div>
                        </div>
                      </div>

                      {/* Curated Social Links Retro Window */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2.5">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#224C3B] dark:text-[#E4E1D8]">
                            Danh sách liên kết & Mạng xã hội
                          </h3>
                        </div>

                        <div className="p-4 flex flex-col gap-2.5">
                          {(() => {
                            const links: React.ReactNode[] = [];
                            
                            if (activeAuthor.fb) {
                              links.push(
                                <div className="flex gap-2 w-full" key="fb">
                                  <a
                                    href={activeAuthor.fb.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="retro-btn flex-1 flex items-center gap-3 py-2 px-3.5 text-left min-w-0 group"
                                  >
                                    {getLogoForUrl(activeAuthor.fb.url)}
                                    <span className="text-xs font-bold text-[#244B3C] dark:text-[#E4E1D8] truncate flex items-center gap-1.5">
                                      {activeAuthor.fb.name}
                                      <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      copyToClipboard(activeAuthor.fb?.url || '', `Fanpage ${activeAuthor.fb?.name}`);
                                    }}
                                    className="retro-btn h-10 w-10 flex items-center justify-center shrink-0 cursor-pointer"
                                    title="Sao chép link Facebook"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                  </button>
                                </div>
                              );
                            }

                            if (activeAuthor.discords && activeAuthor.discords.length > 0) {
                              activeAuthor.discords.forEach((disc, idx) => {
                                links.push(
                                  <div className="flex gap-2 w-full" key={`discord-${idx}`}>
                                    <a
                                      href={disc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="retro-btn flex-1 flex items-center gap-3 py-2 px-3.5 text-left min-w-0 group"
                                    >
                                      {getLogoForUrl(disc.url)}
                                      <span className="text-xs font-bold text-[#244B3C] dark:text-[#E4E1D8] truncate flex items-center gap-1.5">
                                        {disc.name}
                                        <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                      </span>
                                    </a>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        copyToClipboard(disc.url, `Discord ${disc.name}`);
                                      }}
                                      className="retro-btn h-10 w-10 flex items-center justify-center shrink-0 cursor-pointer"
                                      title="Sao chép link Discord"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                    </button>
                                  </div>
                                );
                              });
                            }

                            if (activeAuthor.web) {
                              links.push(
                                <div className="flex gap-2 w-full" key="web">
                                  <a
                                    href={activeAuthor.web.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="retro-btn flex-1 flex items-center gap-3 py-2 px-3.5 text-left min-w-0 group"
                                  >
                                    {getLogoForUrl(activeAuthor.web.url)}
                                    <span className="text-xs font-bold text-[#244B3C] dark:text-[#E4E1D8] truncate flex items-center gap-1.5">
                                      {activeAuthor.web.name}
                                      <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      copyToClipboard(activeAuthor.web?.url || '', `Web ${activeAuthor.web?.name}`);
                                    }}
                                    className="retro-btn h-10 w-10 flex items-center justify-center shrink-0 cursor-pointer"
                                    title="Sao chép link Web"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                  </button>
                                </div>
                              );
                            }

                            if (activeAuthor.other) {
                              links.push(
                                <div className="flex gap-2 w-full" key="other">
                                  <a
                                    href={activeAuthor.other.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="retro-btn flex-1 flex items-center gap-3 py-2 px-3.5 text-left min-w-0 group"
                                  >
                                    {getLogoForUrl(activeAuthor.other.url)}
                                    <span className="text-xs font-bold text-[#244B3C] dark:text-[#E4E1D8] truncate flex items-center gap-1.5">
                                      {activeAuthor.other.name}
                                      <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      copyToClipboard(activeAuthor.other?.url || '', `Tài nguyên ${activeAuthor.other?.name}`);
                                    }}
                                    className="retro-btn h-10 w-10 flex items-center justify-center shrink-0 cursor-pointer"
                                    title="Sao chép link tài nguyên"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                  </button>
                                </div>
                              );
                            }

                            if (links.length === 0) {
                              return (
                                <div className="p-4 rounded-md border border-dashed border-[#B8D7C5] dark:border-[#49554D] text-center">
                                  <p className="text-xs text-[#5B7A6C] dark:text-[#B8BDB5]">Không có liên kết để hiển thị</p>
                                </div>
                              );
                            }

                            return links;
                          })()}
                        </div>
                      </div>

                      {/* Creative works under this author */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2.5">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#224C3B] dark:text-[#E4E1D8]">
                            Nhân vật của tác giả ({characters.filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase()).length})
                          </h3>
                        </div>

                        <div className="p-4">
                          {characters.filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase()).length === 0 ? (
                            <p className="text-[#5B7A6C] dark:text-[#B8BDB5] text-xs py-4 text-center">
                              Chưa có nhân vật nào của tác giả này trong dữ liệu cá nhân của bạn.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {characters
                                .filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase())
                                .map((char) => (
                                  <button
                                    key={char.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCharId(char.id);
                                      setActiveTab('characters');
                                      setIsCreating(false);
                                      setIsEditing(false);
                                      setShowDetailOnMobile(true);
                                    }}
                                    className="retro-btn p-3 flex items-center gap-3 text-left cursor-pointer"
                                  >
                                    <span className="text-xl flex-shrink-0">{char.avatar || '👤'}</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-[#20372D] dark:text-[#E4E1D8] truncate">{char.name}</p>
                                      <p className="text-[10px] text-[#587568] dark:text-[#B8BDB5] truncate mt-0.5">{char.role}</p>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-[#587568] dark:text-[#B8BDB5] flex-shrink-0" />
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  )}
                </>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* CHARACTER SEARCH & FILTER MODAL */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-stone-900/60 dark:bg-[#141716]/75 backdrop-blur-xs transition-opacity"
            onClick={() => setIsFilterModalOpen(false)}
          />
          
          {/* Modal content container */}
          <div className="bg-[#FFF9EA] dark:bg-[#292E2B] rounded-lg border border-[#9FC4AF] dark:border-[#49554D] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-lg dark:shadow-none relative z-10 animate-fade-in">
            {/* Modal Header */}
            <div className="retro-titlebar px-5 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <PixelTagIcon className="w-4 h-4 text-[#39755D] dark:text-[#A3BDA8]" />
                <div>
                  <h3 className="text-sm font-bold text-[#224C3B] dark:text-[#E4E1D8]">Tìm kiếm & Lọc nhân vật</h3>
                  <p className="text-[10px] text-[#527062] dark:text-[#B8BDB5]">Phân loại nhân vật theo từng Tag mong muốn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="retro-btn p-1.5 text-[#39755D] dark:text-[#A3BDA8] cursor-pointer"
                aria-label="Đóng"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* List of Tags */}
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between border-b border-[#D5E6DC] dark:border-[#49554D] pb-2">
                  <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-1.5">
                    <PixelTagIcon className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                    <span>Danh sách Tag / Thể loại</span>
                  </h4>
                  <span className="text-[10px] tabular-nums-mono text-[#5B7A6C] dark:text-[#B8BDB5]">
                    Tất cả ({Array.from(new Set(characters.flatMap(c => c.role.split('/').map(r => r.trim())).filter(Boolean))).length})
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(Array.from(new Set(characters.flatMap(c => c.role.split('/').map(r => r.trim())).filter(Boolean))) as string[]).map((tag) => {
                    const isChosen = selectedFilterTag === tag;
                    const matchingCount = characters.filter(c => 
                      c.role.split('/').map(r => r.trim().toLowerCase()).includes(tag.toLowerCase())
                    ).length;

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const nextTag = isChosen ? null : tag;
                          setSelectedFilterTag(nextTag);
                          setSelectedFilterAuthor(null);
                          setIsFilterModalOpen(false);
                          if (nextTag) {
                            showToast(`Đã lọc nhân vật theo tag: #${nextTag}`, 'success');
                          } else {
                            showToast('Đã dừng lọc theo tag', 'info');
                          }
                        }}
                        className={`retro-btn py-1.5 px-2.5 text-xs flex items-center gap-1.5 font-semibold cursor-pointer ${
                          isChosen ? 'retro-btn-active' : ''
                        }`}
                      >
                        <span>#{tag}</span>
                        <span className="text-[10px] tabular-nums-mono opacity-80 bg-[#E2F3E8] dark:bg-[#343D37] px-1.5 py-0.5 rounded">
                          {matchingCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List of matching characters */}
              {selectedFilterTag && (
                <div className="border-t border-[#D5E6DC] dark:border-[#49554D] pt-4 space-y-3">
                  <div className="retro-callout-mint px-3 py-2 flex justify-between items-center">
                    <div className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8]">
                      Đang chọn: <span className="text-[#39755D] dark:text-[#A3BDA8]">#{selectedFilterTag}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFilterTag(null);
                      }}
                      className="text-[11px] text-red-700 dark:text-[#E4A6AA] hover:underline font-semibold cursor-pointer"
                    >
                      Bỏ chọn lọc
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {characters.filter(c => {
                      const matchesTag = !selectedFilterTag || c.role.split('/').map(r => r.trim().toLowerCase()).includes(selectedFilterTag.toLowerCase());
                      return matchesTag;
                    }).map((char) => {
                      const isCurrentlySelected = selectedCharId === char.id;
                      return (
                        <div
                           key={char.id}
                           onClick={() => {
                             setSelectedCharId(char.id);
                             setIsFilterModalOpen(false);
                             showToast(`Đã chọn nhân vật: ${char.name}`, 'success');
                           }}
                           className={`p-2.5 rounded-md border transition cursor-pointer flex items-center justify-between gap-3 group ${
                             isCurrentlySelected
                               ? 'border-[#39755D] bg-[#E2F3E8] dark:border-[#A3BDA8] dark:bg-[#343D37]'
                               : 'border-[#CFE2D6] dark:border-[#49554D] bg-[#FAF6EA] dark:bg-[#292E2B] hover:border-[#39755D] dark:hover:border-[#A3BDA8]'
                           }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-md bg-[#FFF9EA] dark:bg-[#202423] border border-[#B8D7C5] dark:border-[#49554D] flex items-center justify-center text-lg flex-shrink-0">
                              {char.avatar}
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-[#20372D] dark:text-[#E4E1D8] truncate">
                                {char.name}
                              </h5>
                              <p className="text-[10px] text-[#587568] dark:text-[#B8BDB5] mt-0.5 line-clamp-1">
                                {char.role}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {char.author && (
                              <span className="text-[10px] bg-[#E2F3E8] dark:bg-[#343D37] px-1.5 py-0.5 rounded text-[#2F634E] dark:text-[#A3BDA8] font-medium">
                                {char.author}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-[#F1F8F3] dark:bg-[#202423] border-t border-[#CBE0D3] dark:border-[#49554D] flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedFilterAuthor(null);
                  setSelectedFilterTag(null);
                  setCharacterFilterType('tag');
                  showToast('Đã đặt lại bộ lọc', 'info');
                }}
                className="retro-btn px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                Đặt lại
              </button>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="retro-btn-primary px-4 py-1.5 font-semibold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTHENTICATION MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        mode={authModalMode}
        onModeChange={setAuthModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onToast={showToast}
      />

      {/* LOCAL DATA MIGRATION / CLOUD JSON IMPORT MODAL */}
      {isAuthenticated && userId && (
        <LocalDataMigrationModal
          isOpen={isMigrationModalOpen}
          mode={migrationMode}
          userId={userId}
          userEmail={user?.email ?? undefined}
          summary={migrationSummary}
          backupPayload={migrationBackupPayload}
          resumableJob={pendingResumableJob}
          onClose={(markDismissed) => {
            if (markDismissed && migrationMode === 'local-migration') {
              setMigrationPromptDismissed(userId, true);
            }
            setIsMigrationModalOpen(false);
          }}
          onCompleted={async () => {
            clearResumableImportJob(userId);
            setPendingResumableJob(null);
            if (migrationMode === 'local-migration') {
              setMigrationPromptDismissed(userId, true);
            }
            await syncFromSupabase(userId, { silent: true, checkLocalPrompt: false });
          }}
          onToast={showToast}
        />
      )}

      {/* CROSS-DEVICE EDIT CONFLICT RESOLUTION MODAL */}
      <ConflictResolutionModal
        conflict={activeConflict}
        isResolving={isResolvingConflict}
        onKeepServer={handleConflictKeepServer}
        onOverwriteServer={handleConflictOverwriteServer}
        onSaveAsCopy={handleConflictSaveAsCopy}
        onCopyLocalDraft={(text) => {
          void copyToClipboard(text, 'nội dung đang soạn');
        }}
        onCancel={() => setActiveConflict(null)}
      />

      {/* Floating dynamic Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
