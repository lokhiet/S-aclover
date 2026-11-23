import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Link
} from 'lucide-react';
import CloverRain from './components/CloverRain';
import StarRain from './components/StarRain';
import { Note, Idea, Character, AppState, LibraryPrompt } from './types';
import { CharacterForm, NoteForm, IdeaForm } from './components/RepositoryForms';
import Toast from './components/Toast';
import AccountButton from './components/auth/AccountButton';
import AuthModal from './components/auth/AuthModal';
import LocalDataMigrationModal from './components/auth/LocalDataMigrationModal';
import ConflictResolutionModal from './components/auth/ConflictResolutionModal';
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
  deleteNoteFromCloud,
  fetchUserData,
  isMigrationPromptDismissed,
  loadResumableImportJob,
  saveCharacterToCloud,
  saveIdeaToCloud,
  saveNoteToCloud,
  setMigrationPromptDismissed,
  versionKey,
  type CloudUserDataSnapshot,
  type ConflictDetail,
  type SyncedVersionMap,
} from './services/userDataService';

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
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20'
    };
  }
  
  let colorClass = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-400 border-zinc-200 dark:border-zinc-900/40';
  switch (matchedTopic.id) {
    case 'cooking':
      colorClass = 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/20';
      break;
    case 'sweet':
      colorClass = 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-500/20';
      break;
    case 'sexy':
      colorClass = 'bg-red-500/10 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-500/20';
      break;
    case 'drama':
      colorClass = 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border-purple-500/20';
      break;
    case 'funny':
      colorClass = 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/20';
      break;
    case 'daily':
      colorClass = 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-500/20';
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
  const [cloverEffect, setCloverEffect] = useState<boolean>(() => initialUiPrefs.cloverEffect);
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

  // Toast alert system
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Auth & Cloud Sync state (delegating all auth logic to AuthContext)
  const {
    user,
    userId,
    isAuthenticated,
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
  const [cloudSnapshot, setCloudSnapshot] = useState<CloudUserDataSnapshot | null>(null);
  const [syncedVersions, setSyncedVersions] = useState<SyncedVersionMap>({});

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
      isSavingItem ||
      isMigrationModalOpen ||
      Boolean(activeConflict);
  }, [isCreating, isEditing, isSavingItem, isMigrationModalOpen, activeConflict]);

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
        setSyncedVersions(snapshot.versions);
        lastFocusSyncAtRef.current = Date.now();

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
    [showToast],
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

      const guestState = loadState();
      setNotes(guestState.notes);
      setIdeas(guestState.ideas);
      setCharacters(guestState.characters);
      setLibraryPrompts(guestState.libraryPrompts || defaultLibraryPrompts);
    }
  }, [isAuthReady, isAuthenticated, userId, syncFromSupabase]);

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
    if (isCreating || isEditing) {
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
    setIsCreating(false);
    setIsEditing(false);
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
    setShowDetailOnMobile(true);
    setVisibleSteps({});
    setSearchQuery('');
  };

  // Toggle dynamic clover falling (tách cài đặt giao diện để không bao giờ ghi đè seaclover_state khi đã đăng nhập)
  const handleCloverToggle = () => {
    const nextVal = !cloverEffect;
    setCloverEffect(nextVal);
    saveUiPrefs({ theme, cloverEffect: nextVal });
    if (!isAuthenticated) {
      persistToLocalStorage({ notes, ideas, characters, theme, cloverEffect: nextVal, libraryPrompts });
    }
    showToast(nextVal ? 'Đã bật hiệu ứng cỏ bốn lá rơi 🍀' : 'Đã tắt hiệu ứng cỏ bốn lá rơi', 'info');
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

  /* ----------------- DATA MODIFICATIONS (C.R.U.D) ----------------- */

  // Helper cập nhật version & đánh dấu mục đã nằm trên cloud sau khi Supabase xác nhận
  const recordCloudVersion = (
    kind: 'character' | 'note' | 'idea' | 'library_prompt',
    itemId: string,
    version?: number,
    updatedAt?: string,
  ) => {
    if (typeof version === 'number') {
      setSyncedVersions((prev) => ({
        ...prev,
        [versionKey(kind, itemId)]: {
          version,
          updatedAt: updatedAt || new Date().toISOString(),
        },
      }));
    }
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
  };

  // Characters
  const handleSaveCharacter = async (data: Omit<Character, 'id' | 'createdAt'> & { id?: string }) => {
    // Chế độ tài khoản Supabase: chờ máy chủ xác nhận trước khi cập nhật UI
    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        if (data.id) {
          const existing = characters.find((c) => c.id === data.id);
          if (!existing) return;
          // Gộp với bản hiện có để bảo toàn tuyệt đối các trường không có trong form (discord2, web, other...)
          const updatedChar: Character = { ...existing, ...data, id: existing.id };
          const expectedVersion = syncedVersions[versionKey('character', existing.id)]?.version;
          const res = await saveCharacterToCloud(userId, updatedChar, {
            expectedVersion,
            isFirstOverride: expectedVersion === undefined,
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
          setCharacters((prev) => prev.map((c) => (c.id === confirmedChar.id ? confirmedChar : c)));
          recordCloudVersion('character', confirmedChar.id, res.version, res.updatedAt);
          setIsCreating(false);
          setIsEditing(false);
          showToast('Đã cập nhật và đồng bộ nhân vật lên tài khoản! 🍀');
        } else {
          const newChar: Character = {
            ...data,
            id: `char-${Date.now()}`,
            createdAt: new Date().toISOString(),
          };
          const res = await saveCharacterToCloud(userId, newChar);
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu nhân vật mới lên tài khoản.', 'error');
            return;
          }

          const confirmedChar = res.data;
          setCharacters((prev) => [...prev, confirmedChar]);
          recordCloudVersion('character', confirmedChar.id, res.version, res.updatedAt);
          setSelectedCharId(confirmedChar.id);
          setIsCreating(false);
          setIsEditing(false);
          showToast('Đã tạo và đồng bộ nhân vật mới lên tài khoản! 🎉');
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
      setSelectedCharId(newChar.id);
      showToast('Đã gieo nhân vật mới thắng lợi! 🎉');
    }
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa nhân vật này? Các ghi chú liên đới sẽ mất kết nối nhân vật.')) {
      return;
    }

    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        const isBuiltin = BUILTIN_CHARACTER_MAP.has(id);
        const res = await deleteCharacterFromCloud(userId, id, isBuiltin);
        if (!res.ok) {
          showToast(res.error?.message || 'Không thể xóa nhân vật trên máy chủ.', 'error');
          return;
        }
        const nextList = characters.filter((c) => c.id !== id);
        const nextNotes = notes.map((n) => (n.characterId === id ? { ...n, characterId: '' } : n));
        setCharacters(nextList);
        setNotes(nextNotes);
        setSelectedCharId(nextList.length > 0 ? nextList[0].id : null);
        setShowDetailOnMobile(false);
        showToast('Đã xóa nhân vật và đồng bộ lên tài khoản.', 'info');
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    if (BUILTIN_CHARACTER_MAP.has(id)) {
      markGuestItemDeleted('character', id);
    }
    const nextList = characters.filter((c) => c.id !== id);
    const nextNotes = notes.map((n) => (n.characterId === id ? { ...n, characterId: '' } : n));
    syncState(nextNotes, ideas, nextList);
    setSelectedCharId(nextList.length > 0 ? nextList[0].id : null);
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
          const existing = notes.find((n) => n.id === data.id);
          if (!existing) return;
          // Giữ lại các thuộc tính tùy chọn như categoryOffline khi chỉnh sửa
          const updatedNote: Note = {
            ...existing,
            title: data.title,
            command: data.command,
            content: data.content,
            characterId: data.characterId,
            icon: data.icon,
            updatedAt: new Date().toISOString(),
          };
          const expectedVersion = syncedVersions[versionKey('note', existing.id)]?.version;
          const res = await saveNoteToCloud(userId, updatedNote, {
            expectedVersion,
            isFirstOverride: expectedVersion === undefined,
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
          setNotes((prev) => prev.map((n) => (n.id === confirmedNote.id ? confirmedNote : n)));
          recordCloudVersion('note', confirmedNote.id, res.version, res.updatedAt);
          setIsCreating(false);
          setIsEditing(false);
          showToast('Đã sửa và đồng bộ prompt/ghi chú lên tài khoản! ☘️');
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
          const res = await saveNoteToCloud(userId, newNote);
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu ghi chú mới lên tài khoản.', 'error');
            return;
          }

          const confirmedNote = res.data;
          setNotes((prev) => [...prev, confirmedNote]);
          recordCloudVersion('note', confirmedNote.id, res.version, res.updatedAt);
          setSelectedNoteId(confirmedNote.id);
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
      setSelectedNoteId(newNote.id);
      showToast('Đã thêm ghi chú/prompt thành công! ☘️');
    }
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Bạn có đồng ý xóa vĩnh viễn ghi chú lệnh này?')) {
      return;
    }

    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        const res = await deleteNoteFromCloud(userId, id);
        if (!res.ok) {
          showToast(res.error?.message || 'Không thể xóa ghi chú trên máy chủ.', 'error');
          return;
        }
        const nextList = notes.filter((n) => n.id !== id);
        setNotes(nextList);
        setSelectedNoteId(nextList.length > 0 ? nextList[0].id : null);
        setShowDetailOnMobile(false);
        showToast('Đã xóa ghi chú và đồng bộ lên tài khoản.', 'info');
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    const nextList = notes.filter((n) => n.id !== id);
    syncState(nextList, ideas, characters);
    setSelectedNoteId(nextList.length > 0 ? nextList[0].id : null);
    setShowDetailOnMobile(false);
    showToast('Đã xóa bỏ câu lệnh/ghi chú thành công.', 'info');
  };

  // Ideas
  const handleSaveIdea = async (data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        if (data.id) {
          const existing = ideas.find((i) => i.id === data.id);
          if (!existing) return;
          const updatedIdea: Idea = {
            ...existing,
            title: data.title,
            content: data.content,
            tags: data.tags,
            updatedAt: new Date().toISOString(),
          };
          const expectedVersion = syncedVersions[versionKey('idea', existing.id)]?.version;
          const res = await saveIdeaToCloud(userId, updatedIdea, {
            expectedVersion,
            isFirstOverride: expectedVersion === undefined,
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
          setIdeas((prev) => prev.map((i) => (i.id === confirmedIdea.id ? confirmedIdea : i)));
          recordCloudVersion('idea', confirmedIdea.id, res.version, res.updatedAt);
          setIsCreating(false);
          setIsEditing(false);
          showToast('Ý tưởng đã được cập nhật và đồng bộ lên tài khoản! 💡');
        } else {
          const newIdea: Idea = {
            id: `idea-${Date.now()}`,
            title: data.title,
            content: data.content,
            tags: data.tags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const res = await saveIdeaToCloud(userId, newIdea);
          if (!res.ok || !res.data) {
            showToast(res.error?.message || 'Không thể lưu ý tưởng mới lên tài khoản.', 'error');
            return;
          }

          const confirmedIdea = res.data;
          setIdeas((prev) => [confirmedIdea, ...prev]);
          recordCloudVersion('idea', confirmedIdea.id, res.version, res.updatedAt);
          setSelectedIdeaId(confirmedIdea.id);
          setIsCreating(false);
          setIsEditing(false);
          showToast('Hạt giống ý tưởng mới đã được lưu vào tài khoản! 💡');
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
      setSelectedIdeaId(newIdea.id);
      showToast('Hạt giống ý tưởng mới đã được nảy mầm! 💡');
    }
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleDeleteIdea = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn giải phóng và xóa ý tưởng này?')) {
      return;
    }

    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        const isBuiltin = BUILTIN_IDEA_MAP.has(id);
        const res = await deleteIdeaFromCloud(userId, id, isBuiltin);
        if (!res.ok) {
          showToast(res.error?.message || 'Không thể xóa ý tưởng trên máy chủ.', 'error');
          return;
        }
        const nextList = ideas.filter((i) => i.id !== id);
        setIdeas(nextList);
        setSelectedIdeaId(nextList.length > 0 ? nextList[0].id : null);
        setShowDetailOnMobile(false);
        showToast('Đã xóa ý tưởng và đồng bộ lên tài khoản.', 'info');
      } finally {
        setIsSavingItem(false);
      }
      return;
    }

    if (BUILTIN_IDEA_MAP.has(id)) {
      markGuestItemDeleted('idea', id);
    }
    const nextList = ideas.filter((i) => i.id !== id);
    syncState(notes, nextList, characters);
    setSelectedIdeaId(nextList.length > 0 ? nextList[0].id : null);
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
      await syncFromSupabase(userId, { silent: false, checkLocalPrompt: false });
      showToast('Đã tải bản mới nhất từ máy chủ.', 'info');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleConflictOverwriteServer = async () => {
    if (!activeConflict || !userId) return;
    setIsResolvingConflict(true);
    try {
      if (activeConflict.kind === 'character') {
        const res = await saveCharacterToCloud(
          userId,
          activeConflict.localItem as Character,
          { forceOverwrite: true },
        );
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể ghi đè nhân vật lên máy chủ.', 'error');
          return;
        }
        const confirmed = res.data;
        setCharacters((prev) => {
          const exists = prev.some((c) => c.id === confirmed.id);
          return exists
            ? prev.map((c) => (c.id === confirmed.id ? confirmed : c))
            : [...prev, confirmed];
        });
        recordCloudVersion('character', confirmed.id, res.version, res.updatedAt);
      } else if (activeConflict.kind === 'note') {
        const res = await saveNoteToCloud(
          userId,
          activeConflict.localItem as Note,
          { forceOverwrite: true },
        );
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể ghi đè ghi chú lên máy chủ.', 'error');
          return;
        }
        const confirmed = res.data;
        setNotes((prev) => {
          const exists = prev.some((n) => n.id === confirmed.id);
          return exists
            ? prev.map((n) => (n.id === confirmed.id ? confirmed : n))
            : [...prev, confirmed];
        });
        recordCloudVersion('note', confirmed.id, res.version, res.updatedAt);
      } else if (activeConflict.kind === 'idea') {
        const res = await saveIdeaToCloud(
          userId,
          activeConflict.localItem as Idea,
          { forceOverwrite: true },
        );
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể ghi đè ý tưởng lên máy chủ.', 'error');
          return;
        }
        const confirmed = res.data;
        setIdeas((prev) => {
          const exists = prev.some((i) => i.id === confirmed.id);
          return exists
            ? prev.map((i) => (i.id === confirmed.id ? confirmed : i))
            : [confirmed, ...prev];
        });
        recordCloudVersion('idea', confirmed.id, res.version, res.updatedAt);
      }

      setActiveConflict(null);
      setIsEditing(false);
      setIsCreating(false);
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
          createdAt: nowIso,
        };
        const res = await saveCharacterToCloud(userId, copyChar);
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể tạo bản sao nhân vật.', 'error');
          return;
        }
        setSelectedCharId(res.data.id);
      } else if (activeConflict.kind === 'note') {
        const localNote = activeConflict.localItem as Note;
        const copyNote: Note = {
          ...localNote,
          id: `note-${Date.now()}`,
          title: localNote.title.endsWith(' (Bản sao)') ? localNote.title : `${localNote.title} (Bản sao)`,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const res = await saveNoteToCloud(userId, copyNote);
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể tạo bản sao ghi chú.', 'error');
          return;
        }
        setSelectedNoteId(res.data.id);
      } else if (activeConflict.kind === 'idea') {
        const localIdea = activeConflict.localItem as Idea;
        const copyIdea: Idea = {
          ...localIdea,
          id: `idea-${Date.now()}`,
          title: localIdea.title.endsWith(' (Bản sao)') ? localIdea.title : `${localIdea.title} (Bản sao)`,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const res = await saveIdeaToCloud(userId, copyIdea);
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể tạo bản sao ý tưởng.', 'error');
          return;
        }
        setSelectedIdeaId(res.data.id);
      }

      setActiveConflict(null);
      setIsEditing(false);
      setIsCreating(false);
      await syncFromSupabase(userId, { silent: true, checkLocalPrompt: false });
      showToast('Đã lưu thành bản sao mới và giữ nguyên bản trên máy chủ! 🍀', 'success');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  /* ----------------- SELECTION & FILTER SEARCH ----------------- */

  // Filtration logic for active left lists
  const queryLower = searchQuery.toLowerCase();

  const filteredNotes = selectedLibTopicId === 'all' ? notes.filter(n => 
    n.title.toLowerCase().includes(queryLower) || 
    n.command.toLowerCase().includes(queryLower) ||
    n.content.toLowerCase().includes(queryLower)
  ) : [];

  const activeTopic = TOPICS.find(t => t.id === selectedTopicId) || TOPICS[0];
  const filteredIdeas = ideas
    .filter(activeTopic.match)
    .filter(i => 
      i.title.toLowerCase().includes(queryLower) ||
      i.content.toLowerCase().includes(queryLower) ||
      (i.tags && i.tags.some(t => t.toLowerCase().includes(queryLower)))
    );

  const filteredCharacters = characters.filter(c => {
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
  const filteredLibraryPrompts = libraryPrompts
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
  const activeNote = notes.find(n => n.id === selectedNoteId) || null;
  const activeIdea = ideas.find(i => i.id === selectedIdeaId) || null;
  const activeChar = characters.find(c => c.id === selectedCharId) || null;
  const activeLibraryPrompt = libraryPrompts.find(p => p.id === selectedLibraryPromptId) || null;
  const activeAuthor = authorsList.find(a => a.id === (selectedAuthorId || (filteredAuthors.length > 0 ? filteredAuthors[0].id : authorsList[0]?.id))) || null;

  const isWelcomeScreen = !isCreating && !isEditing && (
    (activeTab === 'notes' && !activeNote && !activeLibraryPrompt) ||
    (activeTab === 'ideas' && !activeIdea) ||
    (activeTab === 'characters' && !activeChar) ||
    (activeTab === 'authors' && !activeAuthor)
  );

  // Direct prompt link traversal from character profile helper
  const navigateToPrompt = (noteId: string) => {
    setActiveTab('notes');
    setSelectedNoteId(noteId);
    setSelectedLibraryPromptId(null);
    setIsCreating(false);
    setIsEditing(false);
    setShowDetailOnMobile(true); // Jump to detail on mobile
  };

  return (
    <div className={`h-[100dvh] overflow-hidden flex flex-col md:flex-row bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 transition-theme relative`}>
      
      {/* Clover Rain Canvas Backing Overlay */}
      <CloverRain active={cloverEffect} />
      
      {/* Star Rain falling stars on dark mode */}
      <StarRain active={theme === 'dark'} />

      {/* 2-COLUMN STRUCTURE: SIDEBAR CONTAINER */}
      <aside className={`w-full md:w-80 h-full flex-shrink-0 bg-white dark:bg-zinc-900 border-b md:border-b-0 md:border-r border-emerald-100 dark:border-emerald-900/30 flex flex-col z-20 ${showDetailOnMobile ? 'hidden md:flex' : 'flex'}`}>
        
        {/* App Title Display Area */}
        <div className="p-3 border-b border-emerald-50 dark:border-emerald-900/20 flex items-center justify-between">
          <div 
            onClick={handleGoHome}
            className="flex items-center gap-2.5 cursor-pointer group select-none hover:opacity-95 active:scale-95 transition-all duration-150"
            title="Về trang chủ Chào mừng"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-800/60 shadow-md shadow-emerald-500/20 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
              <img
                src="/app-icon.jpg"
                alt="SéaClover"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-emerald-800 dark:text-emerald-400 font-sans tracking-tight leading-none group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">SéaClover</h1>
              <p className="text-[9px] text-emerald-600/70 dark:text-emerald-500/60 font-mono tracking-widest mt-0.5">credit by Nhi Séa</p>
            </div>
          </div>

          {/* Mobile quick access to Account / Login from Sidebar */}
          <div className="md:hidden">
            <AccountButton
              compact
              onOpenAuth={openAuthModal}
              onToast={showToast}
              isSyncing={isSyncingCloud}
              hasLocalDataToImport={hasLocalDataToImport}
              hasPendingImportJob={Boolean(pendingResumableJob)}
              onSyncNow={handleManualSyncNow}
              onOpenLocalMigration={handleOpenLocalMigrationManually}
            />
          </div>
        </div>

        {/* Categories Tab selector bar */}
        <div className="p-2 border-b border-emerald-50 dark:border-emerald-900/10 bg-emerald-50/50 dark:bg-zinc-950/45 grid grid-cols-4 gap-1">
          <button
            onClick={() => handleTabChange('characters')}
            className={`py-1.5 px-0.5 rounded-lg text-[9px] md:text-xs font-semibold flex flex-col items-center gap-1 transition ${
              activeTab === 'characters' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/20'
            }`}
          >
            <UserCircle2 className="w-3.5 h-3.5 text-blue-500" />
            <span className="truncate max-w-full">Nhân Vật</span>
            <span className="text-[8px] opacity-75 font-mono">({characters.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('authors')}
            className={`py-1.5 px-0.5 rounded-lg text-[9px] md:text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
              activeTab === 'authors' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/20'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-500" />
            <span className="truncate max-w-full">Tác Giả</span>
            <span className="text-[8px] opacity-75 font-mono">({authorsList.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('notes')}
            className={`py-1.5 px-0.5 rounded-lg text-[9px] md:text-xs font-semibold flex flex-col items-center gap-1 transition ${
              activeTab === 'notes' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/20'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span className="truncate max-w-full">Kho Lệnh</span>
            <span className="text-[8px] opacity-75 font-mono">({notes.length + libraryPrompts.length})</span>
          </button>
          
          <button
            onClick={() => handleTabChange('ideas')}
            className={`py-1.5 px-0.5 rounded-lg text-[9px] md:text-xs font-semibold flex flex-col items-center gap-1 transition ${
              activeTab === 'ideas' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/20'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="truncate max-w-full">Kho Idea</span>
            <span className="text-[8px] opacity-75 font-mono">({ideas.length})</span>
          </button>
        </div>

        {/* Visual Sidebar Search with responsive input */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600/60 dark:text-emerald-500/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'notes' ? "Tìm kiếm câu lệnh..." : 
                activeTab === 'ideas' ? "Tìm kiếm ý tưởng..." : 
                activeTab === 'characters' ? "Tìm nhân vật đại diện..." : "Tìm kiếm tác giả..."
              }
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-zinc-950/30 text-emerald-950 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-theme"
            />
          </div>

          {/* Advanced filter button for characters */}
          {activeTab === 'characters' && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterModalOpen(true);
                    setCharacterFilterType('tag');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-2 transition duration-200 shadow-sm active:scale-[0.98] ${
                    selectedFilterTag
                      ? 'border-emerald-305 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-450 font-extrabold'
                      : 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-zinc-950/20 text-emerald-850 dark:text-emerald-400 hover:bg-emerald-50/50'
                  }`}
                >
                  <span>🔍 Tìm theo Tag</span>
                  {selectedFilterTag && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  )}
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
                    className="px-2.5 rounded-xl border border-red-200 bg-red-50 text-red-650 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition active:scale-[0.98]"
                    title="Xóa bộ lọc"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Active search filter badge indicator */}
              {selectedFilterTag && (
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-stone-50/55 dark:bg-zinc-950/10 rounded-lg text-[9px] text-zinc-500">
                  <span className="font-medium opacity-75">Đang lọc:</span>
                  {selectedFilterTag && (
                    <span 
                      onClick={() => setSelectedFilterTag(null)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded border border-amber-100 hover:bg-amber-100 cursor-pointer transition font-semibold"
                    >
                      🏷️ #{selectedFilterTag} ×
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Categories / Topics Horizontal Scroll Bar specifically for Prompt Library (Notes Tab) */}
        {activeTab === 'notes' && (
          <div className="px-3 pb-3.5 flex items-center gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none">
            {LIB_TOPICS.map((topic) => {
              const isActive = selectedLibTopicId === topic.id;
              const count = libraryPrompts.filter(topic.match).length + (topic.id === 'all' ? notes.length : 0);
              
              const renderLucideIcon = () => {
                const css = `w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-emerald-500' : 'text-zinc-500 dark:text-zinc-400'}`;
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
                  onClick={() => setSelectedLibTopicId(topic.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap snap-start transition-all duration-200 active:scale-95 ${
                    isActive
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/40'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {renderLucideIcon()}
                  <span>{topic.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Categories / Topics Horizontal Scroll Bar specifically for Ideas Tab */}
        {activeTab === 'ideas' && (
          <div className="px-3 pb-3.5 flex items-center gap-2 overflow-x-auto snap-x snap-mandatory">
            {TOPICS.map((topic) => {
              const isActive = selectedTopicId === topic.id;
              const count = ideas.filter(topic.match).length;
              
              // Icon rendering helper mapped exactly to topics
              const renderLucideIcon = () => {
                const css = `w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-amber-500' : 'text-zinc-500 dark:text-zinc-400'}`;
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
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap snap-start transition-all duration-200 active:scale-95 ${
                    isActive
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-500 dark:border-amber-500/40'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {renderLucideIcon()}
                  <span>{topic.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Unified Item listings with elegant scroll */}
        <div className="flex-1 overflow-y-auto px-2 pb-16 space-y-1">
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
                    className={`group relative w-full text-left p-3 rounded-xl transition flex items-start gap-3 border cursor-pointer select-none ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-400'
                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="text-xl mt-0.5">{note.icon || '☘️'}</span>
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="font-semibold text-xs truncate leading-snug">{note.title}</p>
                      <p className="text-[10px] opacity-75 mt-1 truncate">
                        {correlatedChar ? `${correlatedChar.name} • ` : ''}{new Date(note.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {/* Quick Delete Trash Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
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
                  onClick={() => {
                    setSelectedLibraryPromptId(p.id);
                    setSelectedNoteId(null);
                    setIsCreating(false);
                    setIsEditing(false);
                    setShowDetailOnMobile(true);
                    // Auto collapse when switching selected library prompt
                    setVisibleSteps({});
                  }}
                  className={`w-full text-left p-3 rounded-xl transition flex items-start gap-3 border ${
                    selectedLibraryPromptId === p.id && !selectedNoteId && !isCreating
                      ? 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-400'
                      : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span className="text-xl mt-0.5">{getLibraryPromptIcon(p)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] leading-snug text-emerald-900 dark:text-emerald-400">{p.title}</p>
                    <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
                      <span>Tác giả: <strong className="text-zinc-600 dark:text-zinc-300">{p.author}</strong></span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-440">
                        <Terminal className="w-3 h-3 text-emerald-500" />
                        {p.steps.length} phần lệnh
                      </span>
                    </div>
                  </div>
                </button>
              ))}

              {filteredNotes.length === 0 && filteredLibraryPrompts.length === 0 && (
                <div className="p-6 text-center text-zinc-400 dark:text-zinc-600 text-xs">Không tìm thấy câu lệnh phù hợp</div>
              )}
            </>
          )}

          {activeTab === 'ideas' && (
            <>
              {filteredIdeas.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 dark:text-zinc-600 text-xs text-medium">Không có ý tưởng nào khớp</div>
              ) : (
                <div className="space-y-3.5 pt-1">
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
                        className={`group relative text-left p-4 rounded-2xl transition-all duration-200 flex flex-col gap-2.5 border cursor-pointer select-none ${
                          isActive
                            ? 'bg-gradient-to-br from-emerald-500/5 to-emerald-500/[0.01] border-emerald-500/35 dark:border-emerald-500/45 shadow-sm ring-1 ring-emerald-500/10'
                            : 'bg-zinc-50/40 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-800/55 hover:border-zinc-300 dark:hover:border-zinc-700/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30'
                        }`}
                      >
                        {/* Card Header (Icon, Topic & Actions) */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-lg leading-none flex-shrink-0">{topicInfo.icon}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border truncate select-none ${topicInfo.colorClass}`}>
                              {topicInfo.name}
                            </span>
                          </div>
                          
                          {/* Mini Actions */}
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIdeaId(idea.id);
                                setIsEditing(true);
                                setIsCreating(false);
                                setShowDetailOnMobile(true);
                              }}
                              className="p-1 rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/25 transition"
                              title="Sửa ý tưởng"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteIdea(idea.id);
                              }}
                              className="p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/25 transition"
                              title="Xóa ý tưởng"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Card Title */}
                        <h4 className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100 leading-snug tracking-tight">
                          {idea.title}
                        </h4>

                        {/* Card Content (Displayed directly outside) */}
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words bg-white/75 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-200/40 dark:border-zinc-850 shadow-inner max-h-[2400px] overflow-y-auto pr-1.5 scrollbar-thin">
                          {idea.content}
                        </div>

                        {/* Card Footer (Creation Date) */}
                        <div className="flex items-center justify-between text-[9px] text-zinc-400 dark:text-zinc-500 font-mono tracking-tight pt-0.5">
                          <span>📅 Gieo: {new Date(idea.createdAt).toLocaleDateString('vi-VN')}</span>
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
                <div className="p-6 text-center text-zinc-400 dark:text-zinc-600 text-xs">Không tìm thấy nhân vật nào</div>
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
                      className={`group relative w-full text-left p-3 rounded-xl transition flex items-start gap-3 border cursor-pointer select-none ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-400'
                          : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-xs truncate leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-450 transition-colors">{char.name}</p>
                          {char.author && (
                            <span className="px-1 py-0.2 text-[8px] bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 rounded border border-zinc-200/50 dark:border-zinc-700 font-medium max-w-[80px] truncate" title={`Tác giả: ${char.author}`}>
                              {char.author}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] opacity-75 mt-1 truncate">{char.role}</p>
                      </div>

                      {/* Quick Delete Character Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCharacter(char.id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
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
                <div className="p-6 text-center text-zinc-400 dark:text-zinc-600 text-xs">Không tìm thấy tác giả nào</div>
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
                      className={`group relative w-full text-left p-3 rounded-xl transition flex items-center gap-3 border cursor-pointer select-none ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-250 dark:bg-emerald-950/20 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-400'
                          : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-lg shadow-sm border border-zinc-200/50 dark:border-zinc-700/50">
                        {author.avatarEmoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-xs truncate leading-snug ${isSelected ? 'text-emerald-900 dark:text-emerald-400 font-bold' : 'text-zinc-900 dark:text-zinc-100'}`}>
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
          <div className="sticky bottom-0 p-3 border-t border-emerald-50 dark:border-emerald-900/20 bg-white dark:bg-zinc-900 flex justify-center z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] dark:shadow-none">
            <button
              onClick={() => {
                setIsCreating(true);
                setIsEditing(false);
                setShowDetailOnMobile(true);
              }}
              className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 hover:shadow-emerald-500/20 transition-theme"
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

      {/* MAIN SCREEN COLUMNS CONTROLLER */}
      <main className={`flex-1 h-full flex flex-col min-w-0 z-20 ${showDetailOnMobile ? 'flex' : 'hidden md:flex'}`}>
        
        {/* Navigation Utilities bar with Theme & Export triggers */}
        <header className="px-6 py-2 bg-white dark:bg-zinc-900 border-b border-emerald-50 dark:border-emerald-900/25 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {showDetailOnMobile && !isWelcomeScreen && (
              <button
                onClick={() => setShowDetailOnMobile(false)}
                className="md:hidden flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-xs px-2.5 py-1.5 bg-emerald-50 dark:bg-zinc-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30 transition-theme active:scale-95 mr-1"
              >
                ← Chọn Khác
              </button>
            )}
            {/* Removed the redundant category badge indicator per user request */}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Clover switch */}
            <button
              onClick={handleCloverToggle}
              title={cloverEffect ? "Tắt cỏ rơi" : "Mở cỏ rơi"}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                cloverEffect 
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' 
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span className={`animate-bounce mt-0.5`}>🍀</span>
              <span className="hidden lg:inline">Cỏ Rơi</span>
            </button>

            {/* Dark switch (Always Visible) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition"
              title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
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

        {/* DETAILS OR FORM EDITOR VIEW */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* 1. CREATION / FORM SECTOR */}
            {isCreating && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 p-1">
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
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 p-1">
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
                {/* A. NOT SELECTED STATE - THE WELCOME CARD */}
                {((activeTab === 'notes' && !activeNote && !activeLibraryPrompt) || 
                  (activeTab === 'ideas' && !activeIdea) || 
                  (activeTab === 'characters' && !activeChar) ||
                  (activeTab === 'authors' && !activeAuthor)) && (
                  <div className="bg-gradient-to-br from-emerald-500/5 to-white dark:from-zinc-900 dark:to-zinc-950 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 text-center space-y-6">
                    <img
                      src="/app-icon.jpg"
                      alt="SéaClover"
                      className="w-20 h-20 mx-auto rounded-2xl object-cover shadow-lg shadow-emerald-500/20 border-2 border-emerald-200/80 dark:border-emerald-800/70"
                    />
                    <h2 className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-400 font-sans tracking-tight">Chào mừng đến với SéaClover!</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto pt-4">
                      <div 
                        onClick={() => {
                          setActiveTab('characters');
                          setShowDetailOnMobile(false);
                        }}
                        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border border-emerald-500/5 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-md transition duration-300 cursor-pointer select-none active:scale-95"
                      >
                        <span className="text-xl">🎨</span>
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 mt-2">Kho Nhân vật</h4>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Bộ sưu tập các char/nhân vật yêu thích</p>
                      </div>
                      <div 
                        onClick={() => {
                          setActiveTab('authors');
                          setShowDetailOnMobile(false);
                        }}
                        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border border-emerald-500/5 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-md transition duration-300 cursor-pointer select-none active:scale-95"
                      >
                        <span className="text-xl">👩‍💻</span>
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 mt-2">Kho Tác giả</h4>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Thông tin chi tiết của các nhà sáng tạo nội dung</p>
                      </div>
                      <div 
                        onClick={() => {
                          setActiveTab('notes');
                          setShowDetailOnMobile(false);
                        }}
                        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border border-emerald-500/5 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-md transition duration-300 cursor-pointer select-none active:scale-95"
                      >
                        <span className="text-xl">✍️</span>
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 mt-2">Kho Lệnh AI</h4>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Lưu trữ các prompt mẫu, câu lệnh tiện ích</p>
                      </div>
                      <div 
                        onClick={() => {
                          setActiveTab('ideas');
                          setShowDetailOnMobile(false);
                        }}
                        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border border-emerald-500/5 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-md transition duration-300 cursor-pointer select-none active:scale-95"
                      >
                        <span className="text-xl">💡</span>
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 mt-2">Kho Ý tưởng</h4>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Tổng hợp những ý tưởng có thể chơi với char để giải ngấy</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* B. NOTE DETAILS COMPONENT DISPLAY */}
                {activeTab === 'notes' && activeNote && (
                  <article className="space-y-6 animate-fade-in" id="active-note-card">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                      <div>
                        <h2 className="text-xl font-bold text-emerald-850 dark:text-emerald-400 leading-tight">{activeNote.title}</h2>
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-2 block">
                          Cập nhật cuối: {new Date(activeNote.updatedAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>
                        <button
                          onClick={() => handleDeleteNote(activeNote.id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center gap-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa bỏ</span>
                        </button>
                      </div>
                    </div>

                    {/* Section Character reference */}
                    <div className="bg-emerald-500/5 dark:bg-emerald-950/10 rounded-2xl p-4 border border-emerald-500/10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">
                          {characters.find(c => c.id === activeNote.characterId)?.avatar || '🍀'}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Nhân vật liên kết</p>
                          <h4 className="font-semibold text-emerald-800 dark:text-emerald-400 text-sm">
                            {characters.find(c => c.id === activeNote.characterId)?.name || 'Không xác định'}
                          </h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {characters.find(c => c.id === activeNote.characterId)?.role || 'Vui lòng chỉnh sửa và liên kết nhân vật'}
                          </p>
                        </div>
                      </div>
                      
                      {activeNote.characterId && (
                        <button
                          onClick={() => {
                            setActiveTab('characters');
                            setSelectedCharId(activeNote.characterId);
                          }}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-500 flex items-center gap-1 transition"
                          title="Đến trang chi tiết nhân vật"
                        >
                          <span>Xem nhân vật</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Section 1: Prompt cần nhập (Command) */}
                    <div className="gap-2 bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100/60 dark:border-emerald-900/20 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 bg-emerald-50/50 dark:bg-emerald-950/10 border-b border-emerald-500/5 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-emerald-600" />
                          <span>1. PROMPT CẦN NHẬP (LỆNH CHÍNH)</span>
                        </h4>
                        <button
                          onClick={() => copyToClipboard(activeNote.command, 'Prompt cần nhập')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-semibold text-[10px] flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </button>
                      </div>
                      <div className="p-5 font-mono text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/40 whitespace-pre-wrap select-all border-l-4 border-emerald-500 overflow-x-auto">
                        {activeNote.command}
                      </div>
                    </div>

                    {/* Section 2: Nội dung (Detailed content instructions) */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100/60 dark:border-emerald-900/20 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 bg-emerald-50/50 dark:bg-emerald-950/10 border-b border-emerald-500/5 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                          <Info className="w-4 h-4 text-emerald-600" />
                          <span>2. NỘI DUNG CHỈ TIẾT KÈM DỮ LIỆU</span>
                        </h4>
                        <button
                          onClick={() => copyToClipboard(activeNote.content, 'Nội dung')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-semibold text-[10px] flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </button>
                      </div>
                      <div className="p-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900/10 whitespace-pre-wrap leading-relaxed select-text">
                        {activeNote.content}
                      </div>
                    </div>
                  </article>
                )}

                {/* B2. PROMPT LIBRARY DETAILS DISPLAY */}
                {activeTab === 'notes' && activeLibraryPrompt && (
                  <article className="space-y-6 animate-fade-in" id="active-library-prompt-card">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                            Kho Lệnh AI
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Tác giả: <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">{activeLibraryPrompt.author}</strong>
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-emerald-850 dark:text-emerald-400 leading-tight flex items-center gap-2">
                          <span className="text-2xl">{getLibraryPromptIcon(activeLibraryPrompt)}</span>
                          <span>{activeLibraryPrompt.title}</span>
                        </h2>
                      </div>
                    </div>

                    {/* Section Description Card */}
                    <div className="bg-emerald-500/5 dark:bg-zinc-900 border border-emerald-500/10 dark:border-emerald-900/10 rounded-2xl p-5 shadow-sm space-y-2">
                      <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 uppercase font-sans tracking-wide">
                        <Info className="w-4 h-4 text-emerald-600" />
                        <span>Thông tin về công cụ lệnh</span>
                      </h4>
                      <p className="text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                        {activeLibraryPrompt.description}
                      </p>
                    </div>

                    {/* Section How to use Card */}
                    <div className="bg-amber-500/5 dark:bg-zinc-900 border border-amber-500/10 dark:border-amber-900/10 rounded-2xl p-5 shadow-sm space-y-2">
                      <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5 uppercase font-sans tracking-wide">
                        <Terminal className="w-4 h-4 text-amber-500" />
                        <span>Hướng dẫn sử dụng (Cách dùng)</span>
                      </h4>
                      <p className="text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                        {activeLibraryPrompt.howToUse}
                      </p>
                    </div>

                    {/* Steps / Commands list section */}
                    <div className="space-y-4">
                      {activeLibraryPrompt.steps.length === 1 ? (
                        // SINGLE CONTINUOUS BLOCK
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-emerald-850 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                              <span>📋 Nội dung câu lệnh</span>
                            </h3>
                            {visibleSteps[0] && (
                              <button
                                onClick={() => copyToClipboard(activeLibraryPrompt.steps[0].content, activeLibraryPrompt.title)}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-md shadow-emerald-600/10"
                                title="Copy toàn bộ câu lệnh này"
                              >
                                <Copy className="w-4 h-4" />
                                <span>Copy toàn bộ lệnh</span>
                              </button>
                            )}
                          </div>

                          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 overflow-hidden shadow-sm">
                            <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 flex justify-between items-center gap-3">
                              <span>{activeLibraryPrompt.steps[0].label || 'Hiển thị câu lệnh'}</span>
                              <button
                                onClick={() => setVisibleSteps(prev => ({ ...prev, 0: !prev[0] }))}
                                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-slate-50 dark:bg-zinc-950/30 text-[10px] flex items-center gap-1.5 transition"
                              >
                                {visibleSteps[0] ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>Ẩn lệnh</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Hiện lệnh</span>
                                  </>
                                )}
                              </button>
                            </div>
                            {visibleSteps[0] && (
                              <div className="p-5 bg-zinc-500/5">
                                <div className="font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border-l-4 border-emerald-500 overflow-x-auto whitespace-pre-wrap select-all">
                                  {activeLibraryPrompt.steps[0].content}
                                </div>
                                <div className="mt-3 flex justify-between items-center">
                                  <button
                                    onClick={() => copyToClipboard(activeLibraryPrompt.steps[0].content, activeLibraryPrompt.title)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy câu lệnh</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        // MULTI-STEP / EN-VI TRANSLATION BLOCKS
                        <>
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-emerald-850 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                              <span>📦 Danh sách các khối câu lệnh ({activeLibraryPrompt.steps.length})</span>
                            </h3>
                            <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 hidden sm:inline">
                              * Tách nhỏ từng phần tiếng Anh dễ theo dõi và sao chép riêng
                            </p>
                          </div>

                          <div className="space-y-3">
                            {activeLibraryPrompt.steps.map((step, index) => {
                              const isOpen = !!visibleSteps[index];
                              return (
                                <div
                                  key={index}
                                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 overflow-hidden shadow-sm"
                                >
                                  {/* Step Card Header */}
                                  <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                                        {index + 1}
                                      </span>
                                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                                        {step.label || 'Khối lệnh'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Eye (Show/Hide) Trigger */}
                                      <button
                                        onClick={() => setVisibleSteps(prev => ({ ...prev, [index]: !prev[index] }))}
                                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-slate-50 dark:bg-zinc-950/30 text-[10px] flex items-center gap-1 transition"
                                        title={isOpen ? "Thu gọn nội dung hiển thị" : "Bấm để phóng to và xem văn bản lệnh"}
                                      >
                                        {isOpen ? (
                                          <>
                                            <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                                            <span className="hidden min-[400px]:inline">Ẩn văn bản</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="hidden min-[400px]:inline">Xem văn bản</span>
                                          </>
                                        )}
                                      </button>

                                      {/* Copy directly without needing to expand */}
                                      <button
                                        onClick={() => copyToClipboard(step.content, `Bước ${index + 1}: ${step.label}`)}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 active:scale-95 transition"
                                        title="Copy ngay lập tức"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy lệnh {index + 1}</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Step Card Content (Collapsible) */}
                                  {isOpen && (
                                    <div className="p-4 bg-zinc-500/5 border-t border-zinc-200 dark:border-zinc-850">
                                      <div className="font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border-l-4 border-emerald-500 overflow-x-auto whitespace-pre-wrap select-all">
                                        {step.content}
                                      </div>
                                      <div className="mt-2.5 flex justify-between items-center gap-2">
                                        <button
                                          onClick={() => copyToClipboard(step.content, `Bước ${index + 1}: ${step.label || 'Lệnh'}`)}
                                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition duration-150"
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
                  <article className="space-y-6 animate-fade-in" id="active-idea-card">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                      <div>
                        <h2 className="text-xl font-bold text-emerald-850 dark:text-emerald-400 leading-tight flex items-center gap-2">
                          <span className="text-amber-500">💡</span>
                          {activeIdea.title}
                        </h2>
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-2 block">
                          Gieo ngày: {new Date(activeIdea.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>
                        <button
                          onClick={() => handleDeleteIdea(activeIdea.id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center gap-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 p-6 shadow-sm">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {activeIdea.content}
                      </p>
                    </div>
                  </article>
                )}

                {/* D. CHARACTER DETAILS COMPONENT DISPLAY */}
                {activeTab === 'characters' && activeChar && (
                  <article className="space-y-6 animate-fade-in" id="active-character-card">
                    {/* Header with Hero Profile panel */}
                    <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-100/10 to-white dark:from-emerald-950/20 dark:to-zinc-900/40 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-4">
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-950 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center text-4xl shadow-md">
                            {activeChar.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-xl font-bold text-emerald-850 dark:text-emerald-400 leading-tight">{activeChar.name}</h2>
                              {activeChar.author && (
                                <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-400 rounded text-[10px] font-semibold border border-zinc-200 dark:border-zinc-800">
                                  Tác giả: {activeChar.author}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {activeChar.role.split('/').map((tag, idx) => {
                                const trimmed = tag.trim();
                                if (!trimmed) return null;
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setSelectedFilterTag(trimmed);
                                      setShowDetailOnMobile(false);
                                      showToast(`Đang lọc nhân vật theo tag: ${trimmed}`, 'info');
                                    }}
                                    className="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white font-semibold text-[10.5px] rounded-md border border-emerald-500/15 transition cursor-pointer hover:scale-105 active:scale-95"
                                    title={`Lọc theo tag #${trimmed}`}
                                  >
                                    #{trimmed}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Chỉnh sửa</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCharacter(activeChar.id)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center gap-1.5 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </div>

                      {activeChar.description && (
                        <div className="pt-4 border-t border-emerald-100/40 dark:border-emerald-900/20 text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed font-semibold">
                          {activeChar.description}
                        </div>
                      )}

                      {/* Social external linkages */}
                      {(activeChar.fb || activeChar.discord || activeChar.discord2 || activeChar.web || activeChar.other || activeChar.ggai) && (
                        <div className="pt-3 flex flex-wrap gap-2.5 border-t border-emerald-105/10 dark:border-emerald-900/10">
                          {activeChar.fb && (
                            <a
                              href={typeof activeChar.fb === 'object' ? activeChar.fb.url : activeChar.fb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100/60 dark:border-blue-900/25 text-xs font-semibold hover:-translate-y-0.5 hover:shadow-sm transition active:scale-95 duration-150"
                              title="Truy cập tác giả Facebook"
                            >
                              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
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
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/25 text-xs font-semibold hover:-translate-y-0.5 hover:shadow-sm transition active:scale-95 duration-150"
                              title="Tham gia cộng đồng Discord"
                            >
                              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 127.14 96.36" fill="currentColor">
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
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 border border-violet-100/60 dark:border-violet-900/25 text-xs font-semibold hover:-translate-y-0.5 hover:shadow-sm transition active:scale-95 duration-150"
                              title="Tham gia cộng đồng Discord phụ"
                            >
                              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 127.14 96.36" fill="currentColor">
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
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/25 text-xs font-semibold hover:-translate-y-0.5 hover:shadow-sm transition active:scale-95 duration-150"
                              title="Truy cập Website"
                            >
                              <span className="text-sm">🌐</span>
                              <span>{typeof activeChar.web === 'object' ? activeChar.web.name : 'Website'}</span>
                            </a>
                          )}

                          {activeChar.other && (
                            <a
                              href={typeof activeChar.other === 'object' ? activeChar.other.url : activeChar.other}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/45 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100/60 dark:border-amber-900/25 text-xs font-semibold hover:-translate-y-0.5 hover:shadow-sm transition active:scale-95 duration-150"
                              title="Truy cập Website phụ"
                            >
                              <span className="text-sm">🌐</span>
                              <span>{typeof activeChar.other === 'object' ? activeChar.other.name : 'Website'}</span>
                            </a>
                          )}

                          {activeChar.ggai && (
                            <div className="flex items-center">
                              <a
                                href={activeChar.ggai}
                                target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-l-xl bg-emerald-50/50 dark:bg-zinc-950/60 text-emerald-850 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/35 border-r-0 text-xs font-semibold hover:-translate-y-0.5 hover:shadow-sm transition active:scale-95 duration-150"
                                  title={`Mở Prompt ${activeChar.name} trong Google AI Studio`}
                                >
                                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                                    <path
                                      fill="#4285F4"
                                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                      fill="#34A853"
                                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                      fill="#FBBC05"
                                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                    />
                                    <path
                                      fill="#EA4335"
                                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                    />
                                  </svg>
                                  <span>{activeChar.name}</span>
                                </a>
                                <button
                                  onClick={() => copyToClipboard(activeChar.ggai || '', 'Link Google AI Studio')}
                                  className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-r-xl bg-emerald-50/50 dark:bg-zinc-950/60 text-emerald-850 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/35 text-xs font-semibold hover:-translate-y-0.5 hover:shadow-sm transition active:scale-95 duration-150 border-l border-emerald-100/40 dark:border-emerald-900/10 hover:bg-emerald-100/50 dark:hover:bg-zinc-900"
                                  title="Sao chép link Google AI Studio"
                                >
                                  <Copy className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                </button>
                              </div>
                            )}
                          </div>
                      )}
                    </div>

                    {/* Highly aesthetic BACKSTORY dual sections */}
                    {(activeChar.backstoryUser || activeChar.backstoryChar) && (
                      <div className={`grid gap-5 ${
                        activeChar.backstoryUser && activeChar.backstoryChar 
                          ? "grid-cols-1 md:grid-cols-2" 
                          : "grid-cols-1"
                      }`}>
                        {activeChar.backstoryUser && (
                          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 p-5 shadow-sm space-y-3 relative">
                            <div className="flex justify-between items-center pb-2 border-b border-zinc-50 dark:border-zinc-800/40">
                              <h4 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                                {activeChar.backstoryUserTitle || "📖 BACKSTORY (user)"}
                              </h4>
                            </div>
                            <div className="text-[13px] text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto pr-1">
                              {activeChar.backstoryUser}
                            </div>
                          </div>
                        )}

                        {activeChar.backstoryChar && (
                          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 p-5 shadow-sm space-y-3 relative">
                            <div className="flex justify-between items-center pb-2 border-b border-zinc-50 dark:border-zinc-800/40">
                              <h4 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                                {activeChar.backstoryCharTitle || `👤 BACKSTORY (${activeChar.name})`}
                              </h4>
                            </div>
                            <div className="text-[13px] text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto pr-1">
                              {activeChar.backstoryChar}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Highly interactive and beautiful PROMPT section with quick Copy action */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 shadow-sm overflow-hidden animate-fade-in" id={`prompt-${activeChar.id}`}>
                      <div className="px-5 py-3.5 bg-emerald-500/5 dark:bg-emerald-950/10 border-b border-emerald-500/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📄</span>
                          <h4 className="text-xs font-bold text-emerald-850 dark:text-emerald-400">
                            SYSTEM PROMPT
                          </h4>
                        </div>
                        <button
                          onClick={() => {
                            const fullPrompt = buildCharacterRoleplayPrompt(activeChar);
                            copyToClipboard(fullPrompt, `Prompt nhập vai của ${activeChar.name}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow-sm hover:shadow-md transition-all cursor-pointer"
                          title="Sao chép toàn bộ Prompt nhập vai này"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy prompt</span>
                        </button>
                      </div>
                      
                      <div className="p-5 font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950/40 border-l-4 border-emerald-600 dark:border-emerald-500">
                        <div className="max-h-60 overflow-y-auto pr-1 select-all whitespace-pre-wrap scrollbar-thin">
                          {buildCharacterRoleplayPrompt(activeChar)}
                        </div>
                      </div>
                      
                      <div className="px-5 py-2.5 bg-zinc-50/50 dark:bg-zinc-950/20 border-t border-zinc-100 dark:border-zinc-800/60 text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <span className="text-amber-500">💡</span>
                        <span>Mẹo: Sao chép khối prompt này dán trực tiếp vào mục System Instructions/Chat Prompt của mô hình AI để bắt đầu nhập vai hoàn hảo!</span>
                      </div>
                    </div>

                    {/* Highly aesthetic USER PROFILE section with its own copy button */}
                    {activeChar.userProfile && (
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-emerald-900/20 p-5 shadow-sm space-y-3 relative animate-fade-in" id="profile-user-card">
                        <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/40">
                          <h4 className="text-[11.5px] font-extrabold text-emerald-800 dark:text-emerald-450 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                            {activeChar.userProfileTitle || "👤 HỒ SƠ NHÂN VẬT: {{USER}}"}
                          </h4>
                          <button
                            onClick={() => copyToClipboard(activeChar.userProfile || '', `${activeChar.userProfileTitle || 'Hồ sơ nhân vật'} của ${activeChar.name}`)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1.5 active:scale-95 shadow-sm hover:shadow-md transition duration-150 cursor-pointer"
                            title="Sao chép hồ sơ nhân vật này"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy hồ sơ</span>
                          </button>
                        </div>
                        <div className="text-[11.5px] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto pr-1 font-mono bg-zinc-50 dark:bg-zinc-950/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-850">
                          {activeChar.userProfile}
                        </div>
                      </div>
                    )}


                  </article>
                )}

                {activeTab === 'authors' && activeAuthor && (
                  <article className="space-y-6 animate-fade-in" id="active-author-card">
                    {/* Dynamic author primary banner card - Only showing Logo and Name */}
                    <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-3xl border border-emerald-100 dark:border-emerald-900/20 p-6 md:p-8 shadow-md">
                      {/* Premium aesthetic glowing visual accents */}
                      <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${activeAuthor.themeColor} opacity-10 dark:opacity-[0.07] blur-3xl rounded-full`} />
                      <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-emerald-500/10 dark:bg-emerald-500/5 opacity-40 blur-2xl rounded-full" />

                      <div className="relative flex flex-col md:flex-row items-center md:items-center gap-6 select-none text-center md:text-left">
                        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${activeAuthor.themeColor} p-[3px] shadow-lg shadow-emerald-500/10`}>
                          <div className="w-full h-full rounded-full bg-white dark:bg-zinc-950 flex items-center justify-center text-3xl sm:text-4xl">
                            {activeAuthor.avatarEmoji}
                          </div>
                        </div>

                        <div className="flex-1">
                          <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-emerald-800 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent tracking-tight font-sans text-emerald-850 dark:text-emerald-400">
                            {activeAuthor.fullName || activeAuthor.name}
                          </h2>
                        </div>
                      </div>
                    </div>

                    {/* Curated Interactive Social Links Block */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/25 p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-850 dark:text-emerald-400 pb-3 border-b border-zinc-100 dark:border-zinc-800/40 flex items-center gap-2 font-sans">
                        <span>✨</span> Danh sách liên kết & Mạng xã hội
                      </h3>

                      <div className="flex flex-col gap-3.5">
                        {(() => {
                          const links: React.ReactNode[] = [];
                          
                          if (activeAuthor.fb) {
                            links.push(
                              <div className="flex gap-2 w-full animate-fade-in" key="fb">
                                <a
                                  href={activeAuthor.fb.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center gap-3.5 py-2.5 px-4 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition duration-200 group text-left min-w-0 shadow-sm"
                                >
                                  {getLogoForUrl(activeAuthor.fb.url)}
                                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 truncate flex items-center gap-1.5">
                                    {activeAuthor.fb.name}
                                    <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                  </span>
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    copyToClipboard(activeAuthor.fb?.url || '', `Fanpage ${activeAuthor.fb?.name}`);
                                  }}
                                  className="h-11 w-11 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 flex items-center justify-center transition shadow-sm shrink-0"
                                  title="Sao chép link Facebook"
                                >
                                  <Copy className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                </button>
                              </div>
                            );
                          }

                          if (activeAuthor.discords && activeAuthor.discords.length > 0) {
                            activeAuthor.discords.forEach((disc, idx) => {
                              links.push(
                                <div className="flex gap-2 w-full animate-fade-in" key={`discord-${idx}`}>
                                  <a
                                    href={disc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center gap-3.5 py-2.5 px-4 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:bg-zinc-700/80 transition duration-200 group text-left min-w-0 shadow-sm"
                                  >
                                    {getLogoForUrl(disc.url)}
                                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 truncate flex items-center gap-1.5">
                                      {disc.name}
                                      <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      copyToClipboard(disc.url, `Discord ${disc.name}`);
                                    }}
                                    className="h-11 w-11 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 flex items-center justify-center transition shadow-sm shrink-0"
                                    title="Sao chép link Discord"
                                  >
                                    <Copy className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                  </button>
                                </div>
                              );
                            });
                          }

                          if (activeAuthor.web) {
                            links.push(
                              <div className="flex gap-2 w-full animate-fade-in" key="web">
                                <a
                                  href={activeAuthor.web.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center gap-3.5 py-2.5 px-4 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition duration-200 group text-left min-w-0 shadow-sm"
                                >
                                  {getLogoForUrl(activeAuthor.web.url)}
                                  <span className="text-xs font-black text-emerald-600 dark:text-[#00e699] truncate flex items-center gap-1.5">
                                    {activeAuthor.web.name}
                                    <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                  </span>
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    copyToClipboard(activeAuthor.web?.url || '', `Web ${activeAuthor.web?.name}`);
                                  }}
                                  className="h-11 w-11 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 flex items-center justify-center transition shadow-sm shrink-0"
                                  title="Sao chép link Web"
                                >
                                  <Copy className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                </button>
                              </div>
                            );
                          }

                          if (activeAuthor.other) {
                            links.push(
                              <div className="flex gap-2 w-full animate-fade-in" key="other">
                                <a
                                  href={activeAuthor.other.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center gap-3.5 py-2.5 px-4 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition duration-200 group text-left min-w-0 shadow-sm"
                                >
                                  {getLogoForUrl(activeAuthor.other.url)}
                                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 truncate flex items-center gap-1.5">
                                    {activeAuthor.other.name}
                                    <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                  </span>
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    copyToClipboard(activeAuthor.other?.url || '', `Tài nguyên ${activeAuthor.other?.name}`);
                                  }}
                                  className="h-11 w-11 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 flex items-center justify-center transition shadow-sm shrink-0"
                                  title="Sao chép link tài nguyên"
                                >
                                  <Copy className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                </button>
                              </div>
                            );
                          }

                          if (links.length === 0) {
                            return (
                              <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/10 dark:bg-zinc-950/5 flex items-center justify-center opacity-60 select-none">
                                <p className="text-xs text-zinc-500 font-medium">Không có liên kết để hiển thị</p>
                              </div>
                            );
                          }

                          return links;
                        })()}
                      </div>
                    </div>

                    {/* Creative works under this author filtered matching */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/25 p-5 shadow-sm space-y-3.5">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-850 dark:text-emerald-400 pb-3 border-b border-zinc-100 dark:border-zinc-850 flex items-center gap-2 font-sans">
                        <span>🎭</span> Bộ sưu tập nhân vật trong hệ thống ({characters.filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase()).length})
                      </h3>

                      {characters.filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase()).length === 0 ? (
                        <p className="text-zinc-455 dark:text-zinc-500 text-xs py-5 text-center font-medium">Chưa có nhân vật nào của tác giả này trong dữ liệu cá nhân của bạn.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {characters
                            .filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase())
                            .map((char) => (
                              <div
                                key={char.id}
                                onClick={() => {
                                  setSelectedCharId(char.id);
                                  setActiveTab('characters');
                                  setIsCreating(false);
                                  setIsEditing(false);
                                  setShowDetailOnMobile(true);
                                }}
                                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 hover:border-emerald-400 dark:hover:border-emerald-800/80 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/5 transition duration-200 cursor-pointer flex items-center gap-3.5 select-none"
                              >
                                <span className="text-2xl flex-shrink-0">{char.avatar || '👤'}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate transition-colors text-left">{char.name}</p>
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5 text-left">{char.role}</p>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-400/80 dark:text-zinc-550 flex-shrink-0" />
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </article>
                )}
              </>
            )}

          </div>
        </div>
      </main>

      {/* CHARACTER SEARCH & FILTER MODAL */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-stone-900/60 dark:bg-zinc-950/80 backdrop-blur-xs transition-opacity"
            onClick={() => setIsFilterModalOpen(false)}
          />
          
          {/* Modal content container */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800/80 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative z-10 animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-950/20">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <div>
                  <h3 className="text-sm font-extrabold text-emerald-950 dark:text-zinc-200">Tìm kiếm & Lọc nhân vật</h3>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Dễ dàng phân loại nhân vật theo từng Tag mong muốn</p>
                </div>
              </div>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition bg-white dark:bg-zinc-950"
                aria-label="Đóng"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* List of Tags: "bấm vào hiện list các tag" */}
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>🏷️</span> Danh sách Tag / Thể loại
                  </h4>
                  <span className="text-[10px] font-mono text-zinc-400">
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
                        className={`py-1.5 px-3 rounded-xl border text-xs transition duration-150 flex items-center gap-1.5 font-medium ${
                          isChosen
                            ? 'bg-amber-50 dark:bg-amber-952/35 border-amber-400 text-amber-800 dark:text-amber-400 font-bold shadow-xs'
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-950 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <span>#{tag}</span>
                        <span className="text-[9px] font-mono opacity-70 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded">
                          {matchingCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List of matching characters: "bấm vào từng tag sẽ hiện list" */}
              {selectedFilterTag && (
                <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-6 space-y-3 animate-slide-up">
                  <div className="flex justify-between items-center bg-stone-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Đang chọn: {' '}
                      <span className="text-amber-600 dark:text-amber-400">🏷️ #{selectedFilterTag}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFilterTag(null);
                      }}
                      className="text-[10px] text-red-500 hover:text-red-700 hover:underline font-bold transition"
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
                           className={`p-3 rounded-2xl border transition duration-150 cursor-pointer flex items-center justify-between gap-4 group ${
                             isCurrentlySelected
                               ? 'border-emerald-400 bg-emerald-500/5 dark:border-emerald-800'
                               : 'border-zinc-100 dark:border-zinc-850/60 bg-stone-50/20 dark:bg-zinc-900/10 hover:border-emerald-200 hover:bg-emerald-500/5'
                           }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 flex items-center justify-center text-xl shadow-xs">
                              {char.avatar}
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                                {char.name}
                              </h5>
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                                {char.role}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-450 font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              Xem chi tiết →
                            </span>
                            {char.author && (
                              <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 dark:text-zinc-400 font-medium">
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
            <div className="px-6 py-3 bg-stone-50 dark:bg-zinc-950/20 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-2">
              <button
                onClick={() => {
                  setSelectedFilterAuthor(null);
                  setSelectedFilterTag(null);
                  setCharacterFilterType('tag');
                  showToast('Đã đặt lại bộ lọc', 'info');
                }}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition"
              >
                Đặt lại
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 text-white font-bold text-[11px] transition"
                >
                  Đóng
                </button>
              </div>
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
