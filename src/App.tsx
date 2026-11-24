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
  Calendar,
  ArrowUpDown,
  RotateCcw,
  X,
} from 'lucide-react';
import CloverClickBurst from './components/CloverClickBurst';
import {
  Note,
  Idea,
  Character,
  CharacterImage,
  AppState,
  LibraryPrompt,
  SystemAnnouncement,
  SharedTag,
  MAX_CHARACTER_IMAGES,
  SortOrder,
} from './types';
import {
  CharacterForm,
  NoteForm,
  IdeaForm,
  LibraryPromptForm,
  type CharacterFormSavePayload,
} from './components/RepositoryForms';
import Toast from './components/Toast';
import AccountButton from './components/auth/AccountButton';
import AuthModal from './components/auth/AuthModal';
import ProfileEditModal from './components/auth/ProfileEditModal';
import MyContentVaultModal from './components/auth/MyContentVaultModal';
import LocalDataMigrationModal from './components/auth/LocalDataMigrationModal';
import ConflictResolutionModal from './components/auth/ConflictResolutionModal';
import {
  SystemAnnouncementsBanner,
  SystemAnnouncementsModal,
} from './components/community/SystemAnnouncementsBar';
import { ContentInteractionBar } from './components/community/ContentInteractionBar';
import { CharacterCommentsSection } from './components/community/CharacterCommentsSection';
import { PromptRatingSection } from './components/community/PromptRatingSection';
import { SocialPlatformIcon } from './components/common/SocialPlatformIcon';
import { CharacterAvatarThumb, CharacterDetailGallery } from './components/common/CharacterImageDisplay';
import { PromptBlocksView } from './components/prompts/PromptBlocksView';
import { TagFilterBar } from './components/tags/TagFilterBar';
import { AllTagsModal, type TagMutationEvent } from './components/tags/AllTagsModal';
import {
  detectSocialPlatformFromUrl,
  extractPromptStoragePaths,
  getCharacterImages,
  getCharacterSocialLinks,
  getLibraryPromptBlocks,
  getNoteDescriptionAndBlocks,
  getSocialPlatformLabel,
  isSafeExternalHttpUrl,
  normalizeCharacterImages,
} from './utils/contentBlocks';
import {
  applyTagsToCharacterFields,
  buildTagCatalogFromTagLists,
  dedupeTags,
  getCharacterTags,
  getIdeaTags,
  getLibraryPromptTags,
  getNoteTags,
  itemHasTagMatchingQuery,
  itemMatchesSelectedTags,
  toTagComparisonKey,
} from './utils/tagSystem';
import {
  EMPTY_BUILTIN_TAG_OVERRIDES,
  fetchBuiltinTagOverrides,
  fetchSharedTags,
  type BuiltinTagOverridesMap,
} from './services/tagAdminService';
import {
  deleteCharacterImagePaths,
  deletePromptIllustrationPaths,
  invalidateCharacterImageSignedCache,
  uploadCharacterImageBlob,
} from './services/mediaService';
import {
  getLocalImageBlob,
  hasIndexedDbStoredImages,
} from './services/localImageStore';
import {
  buildSavedCharacterDatesList,
  formatCreatedDateShort,
  getCharacterDateFilterBadgeLabel,
  matchesCharacterDateFilter,
  sortItemsByCreatedOrder,
  toLocalDateKey,
  type CharacterDateFilter,
} from './utils/dateFilterSort';
import {
  findPromptsByOriginalAuthor,
  isSameOriginalAuthor,
} from './utils/authorMatching';
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
import type { AuthModalMode, UserProfile } from './types/auth';
import { initialCharacters, initialIdeas } from './initialData';
import { defaultLibraryPrompts } from './promptsData';
import { authorsList } from './authorsData';
import { 
  getGuestPublicBuiltinState,
  loadUiPrefs,
  saveUiPrefs,
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
const BUILTIN_CHAR_IDS = new Set(BUILTIN_CHARACTER_MAP.keys());
const BUILTIN_IDEA_IDS = new Set(BUILTIN_IDEA_MAP.keys());

function collectStoragePathsExcluding(
  chars: Character[],
  excludeChar?: { id: string; ownerId?: string },
): Set<string> {
  const paths = new Set<string>();
  for (const c of chars) {
    if (
      excludeChar &&
      c.id === excludeChar.id &&
      (c.ownerId || '') === (excludeChar.ownerId || '')
    ) {
      continue;
    }
    for (const img of getCharacterImages(c)) {
      if (img.storagePath) paths.add(img.storagePath);
    }
  }
  return paths;
}

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

export const getIdeaIcon = (idea: Idea): string => {
  const title = (idea.title || '').toLowerCase();

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

const renderBrandLogoForUrl = (url: string) => (
  <SocialPlatformIcon
    platform={detectSocialPlatformFromUrl(url)}
    className="w-5 h-5 flex-shrink-0"
  />
);

export default function App() {
  // Khởi tạo chế độ Khách thuần đọc (không đọc ghi chú cá nhân cũ và tuyệt đối không ghi đè seaclover_state)
  const rawLegacyStateRef = useRef<Partial<AppState> | null>(null);
  if (rawLegacyStateRef.current === null) {
    rawLegacyStateRef.current = readRawLocalStorageState() ?? {};
  }
  const initialUiPrefs = loadUiPrefs({
    theme: rawLegacyStateRef.current.theme === 'dark' ? 'dark' : 'light',
    cloverEffect:
      typeof rawLegacyStateRef.current.cloverEffect === 'boolean'
        ? rawLegacyStateRef.current.cloverEffect
        : true,
  });
  const initialGuestStateRef = useRef<AppState | null>(null);
  if (initialGuestStateRef.current === null) {
    initialGuestStateRef.current = getGuestPublicBuiltinState(initialUiPrefs);
  }
  const initialLocalState = initialGuestStateRef.current;

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

  // Flexible multi-tag filters (per tab) & Shared Tag catalog
  const [selectedNoteTags, setSelectedNoteTags] = useState<string[]>([]);
  const [selectedIdeaTags, setSelectedIdeaTags] = useState<string[]>([]);
  const [selectedCharTags, setSelectedCharTags] = useState<string[]>([]);
  const [isAllTagsModalOpen, setIsAllTagsModalOpen] = useState(false);
  const [sharedTags, setSharedTags] = useState<SharedTag[]>([]);
  const [builtinTagOverrides, setBuiltinTagOverrides] = useState<BuiltinTagOverridesMap>(
    EMPTY_BUILTIN_TAG_OVERRIDES,
  );

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
    session,
    userId,
    profile,
    isAuthenticated,
    isAdmin,
    isAuthReady,
    isRecoveryMode,
    authError,
    clearAuthError,
    refreshProfile,
  } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMyVaultOpen, setIsMyVaultOpen] = useState(false);

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

  // Character Date Saved Filter & Unified Newest/Oldest Sort preferences
  const [charDateFilter, setCharDateFilter] = useState<CharacterDateFilter>({ mode: 'all' });
  const [isCharDateFilterOpen, setIsCharDateFilterOpen] = useState(false);
  const [promptAuthorFilter, setPromptAuthorFilter] = useState('');
  const [charSort, setCharSort] = useState<SortOrder>(() => initialUiPrefs.charSort);
  const [noteSort, setNoteSort] = useState<SortOrder>(() => initialUiPrefs.noteSort);
  const [ideaSort, setIdeaSort] = useState<SortOrder>(() => initialUiPrefs.ideaSort);
  const [vaultSort, setVaultSort] = useState<SortOrder>(() => initialUiPrefs.vaultSort);

  // Conflict resolution modal state (Optimistic Concurrency Control)
  const [activeConflict, setActiveConflict] = useState<ConflictDetail | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const conflictUploadPathsRef = useRef<string[]>([]);

  // Local migration & Cloud JSON import modal state
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [migrationMode, setMigrationMode] = useState<'local-migration' | 'json-import'>('local-migration');
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  const [migrationBackupPayload, setMigrationBackupPayload] = useState<Partial<AppState> | null>(null);
  const [pendingResumableJob, setPendingResumableJob] = useState<ImportJobPlan | null>(null);
  const [hasLocalDataToImport, setHasLocalDataToImport] = useState(false);
  const [hasLegacyGuestData, setHasLegacyGuestData] = useState(false);
  const [legacyNoticeDismissed, setLegacyNoticeDismissed] = useState(false);

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
      isProfileModalOpen ||
      Boolean(activeConflict);
  }, [
    isCreating,
    isEditing,
    isCreatingLibraryPrompt,
    isEditingLibraryPrompt,
    isSavingItem,
    isTogglingPublic,
    isMigrationModalOpen,
    isProfileModalOpen,
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

  // Kiểm tra không phá hủy xem trình duyệt còn dữ liệu cục bộ cũ từ phiên bản trước hay không
  useEffect(() => {
    if (isAuthenticated) {
      setHasLegacyGuestData(false);
      return;
    }

    let cancelled = false;
    const personal = extractPersonalLocalData();
    const hasLocalItems =
      personal.characters.length > 0 ||
      personal.notes.length > 0 ||
      personal.ideas.length > 0 ||
      personal.libraryPrompts.length > 0;

    if (hasLocalItems) {
      setHasLegacyGuestData(true);
      return;
    }

    void hasIndexedDbStoredImages().then((hasImgs) => {
      if (!cancelled) {
        setHasLegacyGuestData(hasImgs);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

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

  // Tải danh mục tag chung chuẩn hóa (Admin quản lý, cộng đồng xem)
  const refreshSharedTags = useCallback(async () => {
    const res = await fetchSharedTags();
    if (res.ok && res.data) {
      setSharedTags(res.data);
    }
  }, []);

  // Tải danh sách tag hiện hành trên Supabase cho các nội dung Hệ thống mặc định
  const refreshBuiltinTagOverrides = useCallback(async () => {
    const res = await fetchBuiltinTagOverrides();
    if (res.ok && res.data) {
      setBuiltinTagOverrides(res.data);
    }
  }, []);

  useEffect(() => {
    void refreshPublicSnapshot();
    void refreshSharedTags();
    void refreshBuiltinTagOverrides();
  }, [refreshPublicSnapshot, refreshSharedTags, refreshBuiltinTagOverrides]);

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
        void refreshProfile();
        void refreshPublicSnapshot();
        void refreshAnnouncements();
        void refreshSharedTags();
        void refreshBuiltinTagOverrides();

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
    [
      showToast,
      refreshProfile,
      refreshPublicSnapshot,
      refreshAnnouncements,
      refreshSharedTags,
      refreshBuiltinTagOverrides,
    ],
  );

  const handleRefreshTagsAndData = useCallback(async () => {
    await Promise.all([
      refreshSharedTags(),
      refreshBuiltinTagOverrides(),
      refreshPublicSnapshot(),
      isAuthenticated && userId
        ? syncFromSupabase(userId, { silent: true, checkLocalPrompt: false })
        : Promise.resolve(true),
    ]);
  }, [
    refreshSharedTags,
    refreshBuiltinTagOverrides,
    refreshPublicSnapshot,
    isAuthenticated,
    userId,
    syncFromSupabase,
  ]);

  const handleTagsMutated = useCallback((event: TagMutationEvent) => {
    const remapList = (prev: string[]): string[] => {
      if (prev.length === 0) return prev;
      if (event.type === 'delete') {
        const targetKey = toTagComparisonKey(event.label);
        return prev.filter((t) => toTagComparisonKey(t) !== targetKey);
      }
      if (event.type === 'rename') {
        const oldKey = toTagComparisonKey(event.oldLabel);
        return dedupeTags(
          prev.map((t) => (toTagComparisonKey(t) === oldKey ? event.newLabel : t)),
        );
      }
      const sourceKeys = new Set(event.sourceLabels.map((s) => toTagComparisonKey(s)));
      return dedupeTags(
        prev.map((t) => (sourceKeys.has(toTagComparisonKey(t)) ? event.targetLabel : t)),
      );
    };
    setSelectedNoteTags(remapList);
    setSelectedIdeaTags(remapList);
    setSelectedCharTags(remapList);
  }, []);

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
        setIsProfileModalOpen(false);
        setIsMyVaultOpen(false);
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
      // Đã đăng xuất về chế độ Khách: chỉ hiển thị nội dung hệ thống/công khai (tuyệt đối không xóa dữ liệu cục bộ cũ)
      fetchRequestIdRef.current += 1;
      activeSyncedUserIdRef.current = null;
      setIsCreating(false);
      setIsEditing(false);
      setIsCreatingLibraryPrompt(false);
      setIsEditingLibraryPrompt(false);
      setActiveConflict(null);
      setIsMigrationModalOpen(false);
      setIsProfileModalOpen(false);
      setIsMyVaultOpen(false);
      setCloudSnapshot(null);
      setSyncedVersions({});
      setHasLocalDataToImport(false);
      setPendingResumableJob(null);
      setSelectedNoteId(null);
      setSelectedIdeaId(null);
      setSelectedCharId(null);
      setSelectedLibraryPromptId(null);
      setSourceFilter('all');

      const guestState = getGuestPublicBuiltinState({ theme, cloverEffect });
      setNotes(guestState.notes);
      setIdeas(guestState.ideas);
      setCharacters(guestState.characters);
      setLibraryPrompts(guestState.libraryPrompts || defaultLibraryPrompts);
      void refreshPublicSnapshot();
      void refreshSharedTags();
      void refreshBuiltinTagOverrides();
    }
  }, [
    isAuthReady,
    isAuthenticated,
    userId,
    syncFromSupabase,
    refreshPublicSnapshot,
    refreshSharedTags,
    refreshBuiltinTagOverrides,
  ]);

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

  const requireAuthForWriteAction = useCallback(
    (message = 'Đăng nhập để lưu nội dung và đồng bộ kho cá nhân của bạn.') => {
      showToast(message, 'info');
      openAuthModal('login');
    },
    [showToast],
  );

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
    setSourceFilter('all');
    setIsCharDateFilterOpen(false);
    setPromptAuthorFilter('');
    setIsCreating(false);
    setIsEditing(false);
    setIsCreatingLibraryPrompt(false);
    setIsEditingLibraryPrompt(false);
    setIsAllTagsModalOpen(false);
    setShowDetailOnMobile(false); // Reset to list view on tab switches for mobile
  };

  // Go back to Home/Welcome page
  const handleGoHome = () => {
    setActiveTab('notes');
    setSelectedNoteId(null);
    setSelectedLibraryPromptId(null);
    setSelectedIdeaId(null);
    setSelectedCharId(null);
    setIsCharDateFilterOpen(false);
    setPromptAuthorFilter('');
    setIsCreating(false);
    setIsEditing(false);
    setIsCreatingLibraryPrompt(false);
    setIsEditingLibraryPrompt(false);
    setShowDetailOnMobile(true);
    setSearchQuery('');
  };

  // Toggle dark theme (lưu riêng trong seaclover_ui_prefs, không chạm vào seaclover_state cũ)
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    saveUiPrefs({ theme: nextTheme, cloverEffect });
  };

  /* ----------------- MERGED DISPLAY LISTS (PERSONAL/GUEST + SYSTEM + COMMUNITY) ----------------- */

  const displayCharacters = useMemo<Character[]>(() => {
    const systemCloudIds = new Set(
      [...characters, ...(publicSnapshot?.characters ?? [])]
        .filter((c) => Boolean(c.ownerId) && Boolean(c.isSystem))
        .map((c) => c.id),
    );

    const seenKeys = new Set<string>();
    const ownFiltered: Character[] = [];
    for (const c of characters) {
      if (!c.ownerId && systemCloudIds.has(c.id)) continue;
      const k = c.ownerId ? `${c.ownerId}:${c.id}` : `local:${c.id}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      if (
        !c.ownerId &&
        builtinTagOverrides.schemaReady &&
        Object.prototype.hasOwnProperty.call(builtinTagOverrides.characterTags, c.id)
      ) {
        const nextFields = applyTagsToCharacterFields(builtinTagOverrides.characterTags[c.id]);
        ownFiltered.push({ ...c, ...nextFields });
      } else {
        ownFiltered.push(c);
      }
    }

    const extra: Character[] = [];
    for (const pub of publicSnapshot?.characters ?? []) {
      const k = pub.ownerId ? `${pub.ownerId}:${pub.id}` : `local:${pub.id}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      extra.push(pub);
    }
    return [...extra.filter((c) => c.isSystem), ...ownFiltered, ...extra.filter((c) => !c.isSystem)];
  }, [characters, publicSnapshot, builtinTagOverrides]);

  const displayNotes = useMemo<Note[]>(() => {
    const seenKeys = new Set<string>();
    const ownFiltered: Note[] = [];
    for (const n of notes) {
      const k = n.ownerId ? `${n.ownerId}:${n.id}` : `local:${n.id}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      ownFiltered.push(n);
    }
    const extra: Note[] = [];
    for (const pub of publicSnapshot?.notes ?? []) {
      const k = pub.ownerId ? `${pub.ownerId}:${pub.id}` : `local:${pub.id}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      extra.push(pub);
    }
    return [...extra.filter((n) => n.isSystem), ...ownFiltered, ...extra.filter((n) => !n.isSystem)];
  }, [notes, publicSnapshot]);

  const displayIdeas = useMemo<Idea[]>(() => {
    const systemCloudIds = new Set(
      [...ideas, ...(publicSnapshot?.ideas ?? [])]
        .filter((i) => Boolean(i.ownerId) && Boolean(i.isSystem))
        .map((i) => i.id),
    );

    const seenKeys = new Set<string>();
    const ownFiltered: Idea[] = [];
    for (const i of ideas) {
      if (!i.ownerId && systemCloudIds.has(i.id)) continue;
      const k = i.ownerId ? `${i.ownerId}:${i.id}` : `local:${i.id}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      if (
        !i.ownerId &&
        builtinTagOverrides.schemaReady &&
        Object.prototype.hasOwnProperty.call(builtinTagOverrides.ideaTags, i.id)
      ) {
        ownFiltered.push({ ...i, tags: builtinTagOverrides.ideaTags[i.id] });
      } else {
        ownFiltered.push(i);
      }
    }

    const extra: Idea[] = [];
    for (const pub of publicSnapshot?.ideas ?? []) {
      const k = pub.ownerId ? `${pub.ownerId}:${pub.id}` : `local:${pub.id}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      extra.push(pub);
    }
    return [...extra.filter((i) => i.isSystem), ...extra.filter((i) => !i.isSystem), ...ownFiltered];
  }, [ideas, publicSnapshot, builtinTagOverrides]);

  const displayLibraryPrompts = useMemo<LibraryPrompt[]>(() => {
    const systemCloudIds = new Set(
      [...libraryPrompts, ...(publicSnapshot?.libraryPrompts ?? [])]
        .filter((p) => Boolean(p.ownerId) && Boolean(p.isSystem))
        .map((p) => p.id),
    );

    const seenKeys = new Set<string>();
    const ownSystemOrCustom: LibraryPrompt[] = [];
    const builtins: LibraryPrompt[] = [];

    for (const p of libraryPrompts) {
      if (!p.ownerId && systemCloudIds.has(p.id)) continue;
      const k = p.ownerId ? `${p.ownerId}:${p.id}` : `local:${p.id}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      if (p.ownerId) {
        ownSystemOrCustom.push(p);
      } else if (
        builtinTagOverrides.schemaReady &&
        Object.prototype.hasOwnProperty.call(builtinTagOverrides.libraryPromptTags, p.id)
      ) {
        builtins.push({ ...p, tags: builtinTagOverrides.libraryPromptTags[p.id] });
      } else {
        builtins.push(p);
      }
    }

    const extra: LibraryPrompt[] = [];
    for (const pub of publicSnapshot?.libraryPrompts ?? []) {
      const k = pub.ownerId ? `${pub.ownerId}:${pub.id}` : `local:${pub.id}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      extra.push(pub);
    }
    return [...extra.filter((p) => p.isSystem), ...ownSystemOrCustom, ...extra.filter((p) => !p.isSystem), ...builtins];
  }, [libraryPrompts, publicSnapshot, builtinTagOverrides]);

  // Quyền sửa / xóa khớp 100% với RLS phía Supabase (Khách chưa đăng nhập luôn trả false)
  const canEditOrDeleteItem = useCallback(
    (
      kind: 'character' | 'note' | 'idea',
      item: { id: string; ownerId?: string; isSystem?: boolean } | null | undefined,
    ): boolean => {
      if (!item || !isAuthenticated || !userId) return false;
      if (item.isSystem) return isAdmin;
      if (item.ownerId) return item.ownerId === userId;
      if (kind === 'idea' && BUILTIN_IDEA_MAP.has(item.id)) {
        return false;
      }
      return false;
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

  // Characters (hỗ trợ 0..5 ảnh qua Supabase Storage — yêu cầu đăng nhập)
  const handleSaveCharacter = async (data: CharacterFormSavePayload) => {
    if (!isAuthenticated || !userId) {
      requireAuthForWriteAction('Đăng nhập để lưu nhân vật và đồng bộ kho nội dung của bạn.');
      return;
    }
    const { draftImages, ...charPayload } = data;
    const targetCharId = charPayload.id || `char-${Date.now()}`;

    // Chế độ tài khoản Supabase: tải ảnh mới trước, lưu DB sau, rollback nếu lỗi/conflict
    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      const newlyUploadedPaths: string[] = [];
      try {
        let existing: Character | undefined;
        if (charPayload.id) {
          const foundExisting =
            findBySelectedKey<Character>(displayCharacters, selectedCharId)?.id === charPayload.id
              ? findBySelectedKey<Character>(displayCharacters, selectedCharId)
              : displayCharacters.find((c) => c.id === charPayload.id && canEditOrDeleteItem('character', c));
          if (!foundExisting || !canEditOrDeleteItem('character', foundExisting)) {
            showToast('Bạn không có quyền chỉnh sửa nhân vật này.', 'error');
            return;
          }
          existing = foundExisting;
        }

        const resolvedImages: CharacterImage[] = [];
        if (draftImages && draftImages.length > 0) {
          for (const draft of draftImages.slice(0, MAX_CHARACTER_IMAGES)) {
            if (draft.pendingBlob) {
              // Luôn upload dưới userId (auth.uid()) để thỏa mãn RLS folder[1] ngay cả khi Admin sửa nhân vật hệ thống của Admin khác
              const upRes = await uploadCharacterImageBlob(
                userId,
                targetCharId,
                draft.pendingBlob,
                draft.image.mimeType,
              );
              if (!upRes.ok || !upRes.storagePath) {
                if (newlyUploadedPaths.length > 0) {
                  void deleteCharacterImagePaths(userId, newlyUploadedPaths);
                }
                showToast(upRes.error || 'Không thể tải ảnh nhân vật lên máy chủ.', 'error');
                return;
              }
              newlyUploadedPaths.push(upRes.storagePath);
              resolvedImages.push({
                id: draft.image.id || draft.id,
                storagePath: upRes.storagePath,
                mimeType: draft.image.mimeType || draft.pendingBlob.type,
                width: draft.image.width,
                height: draft.image.height,
                name: draft.image.name,
              });
            } else if (draft.image.localId && !draft.image.storagePath && !draft.image.url) {
              const localBlob = await getLocalImageBlob(draft.image.localId);
              if (localBlob) {
                const upRes = await uploadCharacterImageBlob(
                  userId,
                  targetCharId,
                  localBlob,
                  draft.image.mimeType || localBlob.type,
                );
                if (!upRes.ok || !upRes.storagePath) {
                  if (newlyUploadedPaths.length > 0) {
                    void deleteCharacterImagePaths(userId, newlyUploadedPaths);
                  }
                  showToast(upRes.error || 'Không thể đồng bộ ảnh cục bộ lên máy chủ.', 'error');
                  return;
                }
                newlyUploadedPaths.push(upRes.storagePath);
                resolvedImages.push({
                  id: draft.image.id || draft.id,
                  storagePath: upRes.storagePath,
                  mimeType: draft.image.mimeType || localBlob.type,
                  width: draft.image.width,
                  height: draft.image.height,
                  name: draft.image.name,
                });
              }
            } else {
              resolvedImages.push(draft.image);
            }
          }
        }
        const finalImages = normalizeCharacterImages(
          draftImages ? resolvedImages : charPayload.images,
        ).slice(0, MAX_CHARACTER_IMAGES);

        if (existing) {
          const targetOwnerId = existing.ownerId || userId;
          const nextIsSystem = existing.isSystem ? true : Boolean(isAdmin && charPayload.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(charPayload.isPublic);
          const updatedChar: Character = {
            ...existing,
            ...charPayload,
            id: existing.id,
            images: finalImages,
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
            conflictUploadPathsRef.current = newlyUploadedPaths;
            setActiveConflict(res.conflict);
            return;
          }
          if (!res.ok || !res.data) {
            if (newlyUploadedPaths.length > 0) {
              void deleteCharacterImagePaths(userId, newlyUploadedPaths);
            }
            showToast(res.error?.message || 'Không thể lưu nhân vật lên tài khoản.', 'error');
            return;
          }

          const confirmedChar = res.data;
          // Dọn dẹp an toàn các ảnh đã gỡ bỏ và không còn được nhân vật nào khác tham chiếu
          const keptPathSet = new Set(
            getCharacterImages(confirmedChar)
              .map((img) => img.storagePath)
              .filter(Boolean) as string[],
          );
          const otherReferencedPaths = collectStoragePathsExcluding(displayCharacters, {
            id: existing.id,
            ownerId: existing.ownerId,
          });
          const pathsToDelete = getCharacterImages(existing)
            .map((img) => img.storagePath)
            .filter((p): p is string => Boolean(p) && !keptPathSet.has(p) && !otherReferencedPaths.has(p));
          if (pathsToDelete.length > 0) {
            invalidateCharacterImageSignedCache(pathsToDelete);
            void deleteCharacterImagePaths(userId, pathsToDelete);
          }

          if (targetOwnerId === userId) {
            setCharacters((prev) => prev.map((c) => (c.id === confirmedChar.id ? confirmedChar : c)));
          } else {
            setPublicSnapshot((prev) =>
              prev
                ? {
                    ...prev,
                    characters: prev.characters.map((c) =>
                      c.id === confirmedChar.id && c.ownerId === confirmedChar.ownerId ? confirmedChar : c,
                    ),
                  }
                : prev,
            );
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
          const nextIsSystem = Boolean(isAdmin && charPayload.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(charPayload.isPublic);
          const newChar: Character = {
            ...charPayload,
            id: targetCharId,
            images: finalImages,
            createdAt: new Date().toISOString(),
            isSystem: nextIsSystem,
            isPublic: nextIsPublic,
          };
          const res = await saveCharacterToCloud(userId, newChar, {
            isPublic: nextIsPublic,
            isSystem: nextIsSystem,
          });
          if (!res.ok || !res.data) {
            if (newlyUploadedPaths.length > 0) {
              void deleteCharacterImagePaths(userId, newlyUploadedPaths);
            }
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
  };

  const handleDeleteCharacter = async (target: Character) => {
    if (!isAuthenticated || !userId) {
      requireAuthForWriteAction('Đăng nhập để quản lý nhân vật trong tài khoản của bạn.');
      return;
    }
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
        const otherPaths = collectStoragePathsExcluding(displayCharacters, {
          id: target.id,
          ownerId: target.ownerId,
        });
        const orphanPaths = getCharacterImages(target)
          .map((img) => img.storagePath)
          .filter((p): p is string => Boolean(p) && !otherPaths.has(p));
        if (orphanPaths.length > 0) {
          invalidateCharacterImageSignedCache(orphanPaths);
          void deleteCharacterImagePaths(userId, orphanPaths);
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
  };

  // Notes/Prompts
  const handleSaveNote = async (
    data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; draftId?: string },
  ) => {
    if (!isAuthenticated || !userId) {
      requireAuthForWriteAction('Đăng nhập để lưu câu lệnh và đồng bộ kho nội dung của bạn.');
      return;
    }
    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        if (data.id) {
          const existing =
            findBySelectedKey<Note>(displayNotes, selectedNoteId)?.id === data.id
              ? findBySelectedKey<Note>(displayNotes, selectedNoteId)
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
            description: data.description,
            blocks: data.blocks,
            autoNumberSteps: data.autoNumberSteps,
            tags: data.tags,
            categoryOffline: data.categoryOffline,
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
          showToast('Đã sửa và đồng bộ bài đăng Kho Lệnh lên tài khoản! ☘️');
        } else {
          const nextIsSystem = Boolean(isAdmin && data.isSystem);
          const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
          const newNote: Note = {
            id: data.draftId || `note-${Date.now()}`,
            title: data.title,
            command: data.command,
            content: data.content,
            description: data.description,
            blocks: data.blocks,
            autoNumberSteps: data.autoNumberSteps,
            tags: data.tags,
            categoryOffline: data.categoryOffline,
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
          showToast('Đã thêm và đồng bộ bài đăng Kho Lệnh lên tài khoản! ☘️');
        }
      } finally {
        setIsSavingItem(false);
      }
      return;
    }
  };

  const handleDeleteNote = async (target: Note) => {
    if (!isAuthenticated || !userId) {
      requireAuthForWriteAction('Đăng nhập để quản lý câu lệnh trong tài khoản của bạn.');
      return;
    }
    if (!canEditOrDeleteItem('note', target)) {
      showToast('Bạn không có quyền xóa ghi chú này.', 'error');
      return;
    }
    if (!confirm('Bạn có đồng ý xóa vĩnh viễn bài đăng Kho Lệnh này?')) {
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
        const { blocks } = getNoteDescriptionAndBlocks(target);
        const imagePaths = extractPromptStoragePaths(blocks);
        if (targetOwnerId === userId && imagePaths.length > 0) {
          void deletePromptIllustrationPaths(userId, imagePaths);
        }
        if (targetOwnerId === userId) {
          setNotes((prev) => prev.filter((n) => n.id !== target.id));
        }
        if (target.isPublic || target.isSystem) {
          void refreshPublicSnapshot();
        }
        setSelectedNoteId(null);
        setShowDetailOnMobile(false);
        showToast('Đã xóa bài đăng và đồng bộ lên máy chủ.', 'info');
      } finally {
        setIsSavingItem(false);
      }
      return;
    }
  };

  // System / Cloud Library Prompts (Kho Lệnh Thư Viện — Admin quản lý nội dung hệ thống)
  const handleSaveLibraryPrompt = async (
    data: Omit<LibraryPrompt, 'id' | 'createdAt'> & { id?: string; draftId?: string },
  ) => {
    if (!isAuthenticated || !userId) {
      openAuthModal('login');
      return;
    }
    if (isSavingItem) return;
    setIsSavingItem(true);
    try {
      if (data.id) {
        const existing = findBySelectedKey<LibraryPrompt>(displayLibraryPrompts, selectedLibraryPromptId);
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
        showToast('Đã cập nhật bài đăng Kho Lệnh! 🍀');
      } else {
        const nextIsSystem = Boolean(isAdmin && data.isSystem);
        const nextIsPublic = nextIsSystem ? true : Boolean(data.isPublic);
        const newPrompt: LibraryPrompt = {
          ...data,
          id: data.draftId || `sys-lib-${Date.now()}`,
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
            ? 'Đã đăng bài Hệ thống vào Kho Lệnh! 🍀'
            : 'Đã lưu bài đăng thư viện lên tài khoản! 🍀',
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
    if (!confirm('Bạn có chắc chắn muốn xóa bài đăng này khỏi Kho Lệnh?')) {
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
      const imagePaths = extractPromptStoragePaths(target.steps || []);
      if (targetOwnerId === userId && imagePaths.length > 0) {
        void deletePromptIllustrationPaths(userId, imagePaths);
      }
      if (targetOwnerId === userId) {
        setLibraryPrompts((prev) => prev.filter((p) => !(p.id === target.id && p.ownerId === targetOwnerId)));
      }
      void refreshPublicSnapshot();
      setSelectedLibraryPromptId(null);
      setShowDetailOnMobile(false);
      showToast('Đã xóa bài đăng khỏi Kho Lệnh.', 'info');
    } finally {
      setIsSavingItem(false);
    }
  };

  // Ideas
  const handleSaveIdea = async (data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (!isAuthenticated || !userId) {
      requireAuthForWriteAction('Đăng nhập để lưu ý tưởng và đồng bộ kho nội dung của bạn.');
      return;
    }
    if (isAuthenticated && userId) {
      if (isSavingItem) return;
      setIsSavingItem(true);
      try {
        if (data.id) {
          const existing =
            findBySelectedKey<Idea>(displayIdeas, selectedIdeaId)?.id === data.id
              ? findBySelectedKey<Idea>(displayIdeas, selectedIdeaId)
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
  };

  const handleDeleteIdea = async (target: Idea) => {
    if (!isAuthenticated || !userId) {
      requireAuthForWriteAction('Đăng nhập để quản lý ý tưởng trong tài khoản của bạn.');
      return;
    }
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
  };

  /* ----------------- CONFLICT RESOLUTION HANDLERS ----------------- */

  const handleConflictKeepServer = async () => {
    if (!activeConflict || !userId) return;
    setIsResolvingConflict(true);
    try {
      if (conflictUploadPathsRef.current.length > 0) {
        const toClean = [...conflictUploadPathsRef.current];
        conflictUploadPathsRef.current = [];
        void deleteCharacterImagePaths(userId, toClean);
      }
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
        const serverChar = activeConflict.serverItem as Character | undefined;
        const res = await saveCharacterToCloud(targetOwnerId, localChar, {
          forceOverwrite: true,
          isPublic: localChar.isPublic,
          isSystem: localChar.isSystem,
        });
        if (!res.ok || !res.data) {
          showToast(res.error?.message || 'Không thể ghi đè nhân vật lên máy chủ.', 'error');
          return;
        }
        conflictUploadPathsRef.current = [];
        const confirmed = res.data;
        if (serverChar) {
          const keptSet = new Set(
            getCharacterImages(confirmed)
              .map((img) => img.storagePath)
              .filter(Boolean) as string[],
          );
          const otherRefs = collectStoragePathsExcluding(displayCharacters, {
            id: confirmed.id,
            ownerId: confirmed.ownerId,
          });
          const orphanPaths = getCharacterImages(serverChar)
            .map((img) => img.storagePath)
            .filter((p): p is string => Boolean(p) && !keptSet.has(p) && !otherRefs.has(p));
          if (orphanPaths.length > 0) {
            invalidateCharacterImageSignedCache(orphanPaths);
            void deleteCharacterImagePaths(userId, orphanPaths);
          }
        }
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
        conflictUploadPathsRef.current = [];
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

  // Danh mục tag xây dựng CHỈ từ dữ liệu hợp lệ đang hiển thị cho người xem hiện tại
  const charTagCatalog = useMemo(
    () =>
      buildTagCatalogFromTagLists(
        displayCharacters.map((c) => getCharacterTags(c)),
        sharedTags,
      ),
    [displayCharacters, sharedTags],
  );

  const noteTagCatalog = useMemo(
    () =>
      buildTagCatalogFromTagLists(
        [
          ...displayNotes.map((n) => getNoteTags(n)),
          ...displayLibraryPrompts.map((p) => getLibraryPromptTags(p)),
        ],
        sharedTags,
      ),
    [displayNotes, displayLibraryPrompts, sharedTags],
  );

  const ideaTagCatalog = useMemo(
    () =>
      buildTagCatalogFromTagLists(
        displayIdeas.map((i) => getIdeaTags(i)),
        sharedTags,
      ),
    [displayIdeas, sharedTags],
  );

  const formCharTagCatalog = useMemo(
    () =>
      buildTagCatalogFromTagLists(
        displayCharacters.map((c) => getCharacterTags(c)),
        sharedTags,
        { includeZeroShared: true },
      ),
    [displayCharacters, sharedTags],
  );

  const formNoteTagCatalog = useMemo(
    () =>
      buildTagCatalogFromTagLists(
        [
          ...displayNotes.map((n) => getNoteTags(n)),
          ...displayLibraryPrompts.map((p) => getLibraryPromptTags(p)),
        ],
        sharedTags,
        { includeZeroShared: true },
      ),
    [displayNotes, displayLibraryPrompts, sharedTags],
  );

  const formIdeaTagCatalog = useMemo(
    () =>
      buildTagCatalogFromTagLists(
        displayIdeas.map((i) => getIdeaTags(i)),
        sharedTags,
        { includeZeroShared: true },
      ),
    [displayIdeas, sharedTags],
  );

  const toggleTagInList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    tag: string,
  ) => {
    const key = toTagComparisonKey(tag);
    if (!key) return;
    setter((prev) =>
      prev.some((t) => toTagComparisonKey(t) === key)
        ? prev.filter((t) => toTagComparisonKey(t) !== key)
        : [...prev, tag],
    );
  };

  const removeTagFromList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    tag: string,
  ) => {
    const key = toTagComparisonKey(tag);
    setter((prev) => prev.filter((t) => toTagComparisonKey(t) !== key));
  };

  // Filtration logic for active left lists (multi-tag AND + source + date/author + text)
  const queryLower = searchQuery.toLowerCase();

  const savedCharDates = useMemo(
    () => buildSavedCharacterDatesList(displayCharacters),
    [displayCharacters],
  );

  const filteredNotes = displayNotes.filter((n) => {
    if (promptAuthorFilter.trim()) return false;
    if (!matchesSourceFilter(n)) return false;
    const nTags = getNoteTags(n);
    if (!itemMatchesSelectedTags(nTags, selectedNoteTags, sharedTags)) return false;
    if (!queryLower) return true;
    return (
      n.title.toLowerCase().includes(queryLower) ||
      n.command.toLowerCase().includes(queryLower) ||
      n.content.toLowerCase().includes(queryLower) ||
      (n.description && n.description.toLowerCase().includes(queryLower)) ||
      itemHasTagMatchingQuery(nTags, searchQuery, sharedTags)
    );
  });

  const filteredIdeas = displayIdeas.filter((i) => {
    if (!matchesSourceFilter(i)) return false;
    const iTags = getIdeaTags(i);
    if (!itemMatchesSelectedTags(iTags, selectedIdeaTags, sharedTags)) return false;
    if (!queryLower) return true;
    return (
      i.title.toLowerCase().includes(queryLower) ||
      i.content.toLowerCase().includes(queryLower) ||
      itemHasTagMatchingQuery(iTags, searchQuery, sharedTags)
    );
  });

  const sortedIdeas = useMemo(
    () => sortItemsByCreatedOrder(filteredIdeas, ideaSort, BUILTIN_IDEA_IDS),
    [filteredIdeas, ideaSort],
  );

  const filteredCharacters = displayCharacters.filter((c) => {
    if (!matchesSourceFilter(c)) return false;
    if (!matchesCharacterDateFilter(c.createdAt, charDateFilter)) return false;
    const cTags = getCharacterTags(c);
    if (!itemMatchesSelectedTags(cTags, selectedCharTags, sharedTags)) return false;
    if (!queryLower) return true;
    return (
      c.name.toLowerCase().includes(queryLower) ||
      c.role.toLowerCase().includes(queryLower) ||
      (c.author && c.author.toLowerCase().includes(queryLower)) ||
      (c.description && c.description.toLowerCase().includes(queryLower)) ||
      itemHasTagMatchingQuery(cTags, searchQuery, sharedTags)
    );
  });

  const sortedCharacters = useMemo(
    () => sortItemsByCreatedOrder(filteredCharacters, charSort, BUILTIN_CHAR_IDS),
    [filteredCharacters, charSort],
  );

  const filteredLibraryPrompts = displayLibraryPrompts.filter((p) => {
    if (promptAuthorFilter.trim() && !isSameOriginalAuthor(p.author, promptAuthorFilter)) {
      return false;
    }
    if (!matchesSourceFilter(p)) return false;
    const pTags = getLibraryPromptTags(p);
    if (!itemMatchesSelectedTags(pTags, selectedNoteTags, sharedTags)) return false;
    if (!queryLower) return true;
    return (
      p.title.toLowerCase().includes(queryLower) ||
      p.description.toLowerCase().includes(queryLower) ||
      p.author.toLowerCase().includes(queryLower) ||
      itemHasTagMatchingQuery(pTags, searchQuery, sharedTags)
    );
  });

  const sortedKhoLenhEntries = useMemo(() => {
    type KhoLenhEntry =
      | { kind: 'note'; id: string; ownerId?: string; createdAt?: string; item: Note }
      | { kind: 'library_prompt'; id: string; ownerId?: string; createdAt?: string; item: LibraryPrompt };

    const combined: KhoLenhEntry[] = [
      ...filteredNotes.map((item) => ({
        kind: 'note' as const,
        id: item.id,
        ownerId: item.ownerId,
        createdAt: item.createdAt,
        item,
      })),
      ...filteredLibraryPrompts.map((item) => ({
        kind: 'library_prompt' as const,
        id: item.id,
        ownerId: item.ownerId,
        createdAt: item.createdAt,
        item,
      })),
    ];

    return sortItemsByCreatedOrder(combined, noteSort, BUILTIN_LIB_PROMPT_IDS);
  }, [filteredNotes, filteredLibraryPrompts, noteSort]);

  // Filtered authors based on search query
  const filteredAuthors = authorsList.filter(author => {
    const queryLower = searchQuery.toLowerCase();
    return author.name.toLowerCase().includes(queryLower) ||
      (author.fullName && author.fullName.toLowerCase().includes(queryLower)) ||
      author.bio.toLowerCase().includes(queryLower);
  });

  // Active object selection resolution
  const activeNote = findBySelectedKey<Note>(displayNotes, selectedNoteId);
  const activeIdea = findBySelectedKey<Idea>(displayIdeas, selectedIdeaId);
  const activeChar = findBySelectedKey<Character>(displayCharacters, selectedCharId);
  const activeLibraryPrompt = findBySelectedKey<LibraryPrompt>(displayLibraryPrompts, selectedLibraryPromptId);
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

  // Profile personalization update: reflect new display_name & avatar_url across local items and community snapshots
  const handleProfileSaved = (updatedProfile: UserProfile) => {
    const nextName = updatedProfile.display_name?.trim() || undefined;
    const nextAvatar = updatedProfile.avatar_url ?? null;

    setCharacters((prev) =>
      prev.map((c) =>
        c.ownerId === updatedProfile.id
          ? { ...c, authorDisplayName: nextName, authorAvatarUrl: nextAvatar }
          : c,
      ),
    );
    setNotes((prev) =>
      prev.map((n) =>
        n.ownerId === updatedProfile.id
          ? { ...n, authorDisplayName: nextName, authorAvatarUrl: nextAvatar }
          : n,
      ),
    );
    setIdeas((prev) =>
      prev.map((i) =>
        i.ownerId === updatedProfile.id
          ? { ...i, authorDisplayName: nextName, authorAvatarUrl: nextAvatar }
          : i,
      ),
    );
    setLibraryPrompts((prev) =>
      prev.map((p) =>
        p.ownerId === updatedProfile.id
          ? { ...p, authorDisplayName: nextName, authorAvatarUrl: nextAvatar }
          : p,
      ),
    );
    setPublicSnapshot((prev) => {
      if (!prev) return prev;
      const patch = <T extends { ownerId?: string; authorDisplayName?: string; authorAvatarUrl?: string | null }>(
        list: T[],
      ) =>
        list.map((item) =>
          item.ownerId === updatedProfile.id
            ? { ...item, authorDisplayName: nextName, authorAvatarUrl: nextAvatar }
            : item,
        );
      return {
        ...prev,
        characters: patch(prev.characters),
        notes: patch(prev.notes),
        ideas: patch(prev.ideas),
        libraryPrompts: patch(prev.libraryPrompts),
      };
    });

    void refreshPublicSnapshot();
    void refreshAnnouncements();
  };

  // Direct navigation & edit actions from My Content Vault modal
  const handleVaultNavigateItem = (
    kind: DataEntityKind,
    item: Character | Note | Idea | LibraryPrompt,
    mode: 'view' | 'edit',
  ) => {
    setIsMyVaultOpen(false);
    setSearchQuery('');
    setSourceFilter('all');
    setCharDateFilter({ mode: 'all' });
    setIsCharDateFilterOpen(false);
    setPromptAuthorFilter('');
    setSelectedNoteTags([]);
    setSelectedIdeaTags([]);
    setSelectedCharTags([]);
    setIsAllTagsModalOpen(false);
    setIsCreating(false);
    setIsCreatingLibraryPrompt(false);

    const itemKey = getItemKey(item);
    if (kind === 'character') {
      setActiveTab('characters');
      setSelectedCharId(itemKey);
      setIsEditingLibraryPrompt(false);
      setIsEditing(mode === 'edit');
    } else if (kind === 'note') {
      setActiveTab('notes');
      setSelectedNoteId(itemKey);
      setSelectedLibraryPromptId(null);
      setIsEditingLibraryPrompt(false);
      setIsEditing(mode === 'edit');
    } else if (kind === 'library_prompt') {
      setActiveTab('notes');
      setSelectedLibraryPromptId(itemKey);
      setSelectedNoteId(null);
      setIsEditing(false);
      setIsEditingLibraryPrompt(mode === 'edit');
    } else {
      setActiveTab('ideas');
      setSelectedIdeaId(itemKey);
      setIsEditingLibraryPrompt(false);
      setIsEditing(mode === 'edit');
    }

    setShowDetailOnMobile(true);
  };

  const handleVaultDeleteItem = async (
    kind: DataEntityKind,
    item: Character | Note | Idea | LibraryPrompt,
  ) => {
    if (kind === 'character') {
      await handleDeleteCharacter(item as Character);
    } else if (kind === 'note') {
      await handleDeleteNote(item as Note);
    } else if (kind === 'idea') {
      await handleDeleteIdea(item as Idea);
    } else {
      await handleDeleteLibraryPrompt(item as LibraryPrompt);
    }
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
          {/* System Announcements button */}
          <button
            type="button"
            onClick={() => setIsAnnouncementsModalOpen(true)}
            className="retro-btn px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer relative"
            title="Thông báo hệ thống"
            aria-label="Thông báo hệ thống"
          >
            <Bell className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
            {activeAnnouncementCount > 0 && (
              <span className="px-1 py-0 text-[9px] leading-tight font-mono font-bold rounded bg-[#39755D] dark:bg-[#A3BDA8] text-[#FFF9EA] dark:text-[#202423] tabular-nums-mono">
                {activeAnnouncementCount}
              </span>
            )}
          </button>

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
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onOpenMyVault={() => setIsMyVaultOpen(true)}
          />
        </div>
      </header>

      {/* Subtle Legacy Local Data Notice (read-only detection, zero forced popups) */}
      {isAuthReady && !isAuthenticated && hasLegacyGuestData && !legacyNoticeDismissed && (
        <div className="px-3 sm:px-4 py-1.5 bg-[#FFF9EA] dark:bg-[#242926] border-b border-[#DCE7DF] dark:border-[#49554D] flex items-center justify-between gap-2 text-[11px] sm:text-xs text-[#4C6A5C] dark:text-[#B8BDB5] flex-shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Info className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8] shrink-0" />
            <span className="truncate sm:whitespace-normal">
              Bạn có dữ liệu đã lưu từ phiên bản trước. Hãy đăng nhập để nhập dữ liệu vào tài khoản.
            </span>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="font-bold text-[#224C3B] dark:text-[#A3BDA8] underline hover:text-[#39755D] cursor-pointer shrink-0"
            >
              Đăng nhập ngay
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLegacyNoticeDismissed(true)}
            aria-label="Đóng thông báo"
            className="p-0.5 rounded text-[#587568] hover:text-[#224C3B] dark:text-[#B8BDB5] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
              <span className="text-[9px] tabular-nums-mono opacity-80">({displayCharacters.length})</span>
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
              <span className="text-[9px] tabular-nums-mono opacity-80">({displayNotes.length + displayLibraryPrompts.length})</span>
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
              <span className="text-[9px] tabular-nums-mono opacity-80">({displayIdeas.length})</span>
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

            {/* Source Filter Bar + Newest/Oldest Sort + Character Date Saved Filter */}
            {activeTab !== 'authors' && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {([
                      { id: 'all', label: 'Tất cả' },
                      { id: 'system', label: 'Hệ thống' },
                      { id: 'community', label: 'Cộng đồng' },
                      ...(isAuthenticated ? [{ id: 'mine', label: 'Của tôi' }] : []),
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSourceFilter(opt.id)}
                        className={`px-2 py-0.5 rounded border text-[10px] font-semibold transition cursor-pointer ${
                          sourceFilter === opt.id
                            ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8]'
                            : 'bg-[#FFF9EA] dark:bg-[#202423] border-[#CFE2D6] dark:border-[#49554D] text-[#587568] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/50 dark:hover:bg-[#343D37]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Toolbar right controls: Character Date Filter + Sort (Mới nhất / Cũ nhất) */}
                  <div className="flex items-center gap-1">
                    {activeTab === 'characters' && (
                      <button
                        type="button"
                        onClick={() => setIsCharDateFilterOpen((prev) => !prev)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold transition cursor-pointer ${
                          charDateFilter.mode !== 'all' || isCharDateFilterOpen
                            ? 'bg-[#E2F3E8] dark:bg-[#343D37] border-[#39755D] dark:border-[#A3BDA8] text-[#214C3B] dark:text-[#E4E1D8]'
                            : 'bg-[#FFF9EA] dark:bg-[#202423] border-[#CFE2D6] dark:border-[#49554D] text-[#587568] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/50 dark:hover:bg-[#343D37]'
                        }`}
                        title="Lọc nhân vật theo ngày lưu"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>
                          {charDateFilter.mode === 'all'
                            ? 'Ngày lưu'
                            : getCharacterDateFilterBadgeLabel(charDateFilter)}
                        </span>
                      </button>
                    )}

                    {(() => {
                      const activeSort: SortOrder =
                        activeTab === 'characters'
                          ? charSort
                          : activeTab === 'notes'
                            ? noteSort
                            : ideaSort;
                      const toggleActiveSort = () => {
                        const nextSort: SortOrder = activeSort === 'newest' ? 'oldest' : 'newest';
                        if (activeTab === 'characters') {
                          setCharSort(nextSort);
                          saveUiPrefs({ charSort: nextSort });
                        } else if (activeTab === 'notes') {
                          setNoteSort(nextSort);
                          saveUiPrefs({ noteSort: nextSort });
                        } else {
                          setIdeaSort(nextSort);
                          saveUiPrefs({ ideaSort: nextSort });
                        }
                      };
                      return (
                        <button
                          type="button"
                          onClick={toggleActiveSort}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold bg-[#FFF9EA] dark:bg-[#202423] border-[#CFE2D6] dark:border-[#49554D] text-[#285B47] dark:text-[#A3BDA8] hover:bg-[#E2F3E8]/60 dark:hover:bg-[#343D37] transition cursor-pointer"
                          title="Đổi thứ tự sắp xếp Mới nhất / Cũ nhất"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          <span>{activeSort === 'newest' ? 'Mới nhất' : 'Cũ nhất'}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Active Author Filter chip on Kho Lệnh */}
                {activeTab === 'notes' && promptAuthorFilter.trim() && (
                  <div className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-[#9FC4AF] dark:border-[#63806E] bg-[#E2F3E8]/80 dark:bg-[#343D37] text-[10px]">
                    <span className="text-[#214C3B] dark:text-[#E4E1D8] truncate">
                      Tác giả câu lệnh: <strong>{promptAuthorFilter}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPromptAuthorFilter('')}
                      className="text-[#39755D] dark:text-[#A3BDA8] hover:text-red-600 font-semibold inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      Bỏ lọc
                    </button>
                  </div>
                )}

                {/* Collapsible Character Date Saved Filter Panel */}
                {activeTab === 'characters' && isCharDateFilterOpen && (
                  <div className="p-2.5 rounded-md border border-[#9FC4AF] dark:border-[#49554D] bg-[#FFF9EA] dark:bg-[#202423] space-y-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#224C3B] dark:text-[#A3BDA8] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Lọc theo ngày lưu
                      </span>
                      <div className="flex items-center gap-1.5">
                        {charDateFilter.mode !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setCharDateFilter({ mode: 'all' })}
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#39755D] dark:text-[#A3BDA8] hover:underline cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Đặt lại
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsCharDateFilterOpen(false)}
                          className="p-0.5 rounded text-[#587568] hover:text-[#224C3B] dark:text-[#B8BDB5] cursor-pointer"
                          title="Đóng bộ lọc ngày"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {([
                        { id: 'all', label: 'Tất cả' },
                        { id: 'today', label: 'Hôm nay' },
                        { id: 'yesterday', label: 'Hôm qua' },
                        { id: 'last7days', label: '7 ngày qua' },
                        { id: 'thisMonth', label: 'Tháng này' },
                      ] as const).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setCharDateFilter({ mode: preset.id })}
                          className={`px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                            charDateFilter.mode === preset.id
                              ? 'bg-[#39755D] text-[#FFF9EA] border-[#285B47] dark:bg-[#496A59] dark:border-[#A3BDA8]'
                              : 'bg-white/80 dark:bg-[#292E2B] text-[#2B463A] dark:text-[#E4E1D8] border-[#CFE2D6] dark:border-[#49554D] hover:bg-[#E2F3E8]/60'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-semibold text-[#4B6A5C] dark:text-[#B8BDB5] shrink-0">
                        Chọn ngày cụ thể:
                      </label>
                      <input
                        type="date"
                        value={charDateFilter.mode === 'exact' ? (charDateFilter.dateKey || '') : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setCharDateFilter({ mode: 'all' });
                          } else {
                            setCharDateFilter({ mode: 'exact', dateKey: val });
                          }
                        }}
                        className="retro-input px-2 py-0.5 text-[11px] flex-1 min-w-0"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-[#4B6A5C] dark:text-[#B8BDB5]">
                        Các ngày đã lưu ({savedCharDates.length}):
                      </p>
                      {savedCharDates.length === 0 ? (
                        <p className="text-[10px] text-[#6B877A] dark:text-[#B8BDB5] italic">
                          Chưa có ngày lưu hợp lệ.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-0.5">
                          {savedCharDates.map((entry) => {
                            const isSelectedDate =
                              charDateFilter.mode === 'exact' &&
                              charDateFilter.dateKey === entry.dateKey;
                            return (
                              <button
                                key={entry.dateKey}
                                type="button"
                                onClick={() => setCharDateFilter({ mode: 'exact', dateKey: entry.dateKey })}
                                className={`px-1.5 py-0.5 rounded border text-[10px] font-mono cursor-pointer transition ${
                                  isSelectedDate
                                    ? 'bg-[#39755D] text-[#FFF9EA] border-[#285B47] dark:bg-[#496A59] dark:border-[#A3BDA8]'
                                    : 'bg-white/80 dark:bg-[#292E2B] text-[#2B463A] dark:text-[#E4E1D8] border-[#CFE2D6] dark:border-[#49554D] hover:bg-[#E2F3E8]/60'
                                }`}
                              >
                                {entry.label} ({entry.count})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Multi-Tag Filter Bar across Characters, Notes/Library, and Ideas */}
          {activeTab === 'characters' && (
            <TagFilterBar
              catalog={charTagCatalog}
              selectedTags={selectedCharTags}
              onToggleTag={(t) => toggleTagInList(setSelectedCharTags, t)}
              onRemoveTag={(t) => removeTagFromList(setSelectedCharTags, t)}
              onClearAll={() => setSelectedCharTags([])}
              onOpenAllTags={() => setIsAllTagsModalOpen(true)}
              isAdmin={Boolean(isAuthenticated && isAdmin)}
            />
          )}

          {activeTab === 'notes' && (
            <TagFilterBar
              catalog={noteTagCatalog}
              selectedTags={selectedNoteTags}
              onToggleTag={(t) => toggleTagInList(setSelectedNoteTags, t)}
              onRemoveTag={(t) => removeTagFromList(setSelectedNoteTags, t)}
              onClearAll={() => setSelectedNoteTags([])}
              onOpenAllTags={() => setIsAllTagsModalOpen(true)}
              isAdmin={Boolean(isAuthenticated && isAdmin)}
            />
          )}

          {activeTab === 'ideas' && (
            <TagFilterBar
              catalog={ideaTagCatalog}
              selectedTags={selectedIdeaTags}
              onToggleTag={(t) => toggleTagInList(setSelectedIdeaTags, t)}
              onRemoveTag={(t) => removeTagFromList(setSelectedIdeaTags, t)}
              onClearAll={() => setSelectedIdeaTags([])}
              onOpenAllTags={() => setIsAllTagsModalOpen(true)}
              isAdmin={Boolean(isAuthenticated && isAdmin)}
            />
          )}

          {/* Unified Item Listings inside Folder Browser */}
          <div className="flex-1 overflow-y-auto px-2 py-2 pb-16 space-y-1.5">
            {activeTab === 'notes' && (
              <>
                {sortedKhoLenhEntries.map((entry) => {
                  if (entry.kind === 'note') {
                    const note = entry.item;
                    const noteKey = getItemKey(note);
                    const correlatedChar =
                      displayCharacters.find(
                        (c) =>
                          c.id === note.characterId &&
                          (!note.ownerId || !c.ownerId || c.ownerId === note.ownerId),
                      ) || displayCharacters.find((c) => c.id === note.characterId);
                    const isSelected =
                      selectedNoteId === noteKey &&
                      !selectedLibraryPromptId &&
                      !isCreating &&
                      !isCreatingLibraryPrompt;
                    const canMutate = canEditOrDeleteItem('note', note);
                    return (
                      <div
                        key={`note-${noteKey}`}
                        onClick={() => {
                          setSelectedNoteId(noteKey);
                          setSelectedLibraryPromptId(null);
                          setIsCreating(false);
                          setIsEditing(false);
                          setIsCreatingLibraryPrompt(false);
                          setIsEditingLibraryPrompt(false);
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
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-xs truncate leading-snug">{note.title}</p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {note.isSystem ? (
                              <span className="px-1 py-0 text-[9px] font-bold rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#285B47] dark:text-[#A3BDA8] border border-[#9FC4AF] dark:border-[#49554D]">
                                Hệ thống
                              </span>
                            ) : note.isPublic ? (
                              <span className="px-1 py-0 text-[9px] font-bold rounded bg-[#FFFDF7] dark:bg-[#202423] text-[#2E6B53] dark:text-[#A3BDA8] border border-[#B8D7C5] dark:border-[#49554D]">
                                Công khai
                              </span>
                            ) : note.ownerId ? (
                              <span className="px-1 py-0 text-[9px] font-semibold rounded bg-[#F5F2E8] dark:bg-[#202423] text-[#668476] dark:text-[#B8BDB5] border border-[#D4E2D8] dark:border-[#49554D]">
                                Riêng tư
                              </span>
                            ) : null}
                            <p className="text-[10px] text-[#587568] dark:text-[#B8BDB5] truncate tabular-nums-mono">
                              {correlatedChar ? `${correlatedChar.name} • ` : ''}
                              {note.authorDisplayName ? `${note.authorDisplayName} • ` : ''}
                              {new Date(note.updatedAt).toLocaleDateString('vi-VN')}
                            </p>
                          </div>
                        </div>

                        {canMutate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-[#6B877A] hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Xóa nhanh câu lệnh này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  }

                  const p = entry.item;
                  const promptKey = getItemKey(p);
                  const displayPromptAuthor = p.author || p.authorDisplayName || 'Cộng đồng';
                  const isSelected =
                    selectedLibraryPromptId === promptKey &&
                    !selectedNoteId &&
                    !isCreating &&
                    !isCreatingLibraryPrompt;
                  return (
                    <button
                      key={`lib-${promptKey}`}
                      type="button"
                      onClick={() => {
                        setSelectedLibraryPromptId(promptKey);
                        setSelectedNoteId(null);
                        setIsCreating(false);
                        setIsEditing(false);
                        setIsCreatingLibraryPrompt(false);
                        setIsEditingLibraryPrompt(false);
                        setShowDetailOnMobile(true);
                      }}
                      className={`w-full text-left p-2.5 rounded-md transition flex items-start gap-2.5 border cursor-pointer ${
                        isSelected
                          ? 'bg-[#E2F3E8] border-[#39755D] dark:bg-[#343D37] dark:border-[#A3BDA8] text-[#1E4434] dark:text-[#E4E1D8]'
                          : 'bg-[#FFF9EA]/70 dark:bg-[#292E2B] border-transparent hover:border-[#B8D7C5] dark:hover:border-[#A3BDA8] hover:bg-[#E2F3E8]/45 dark:hover:bg-[#343D37] text-[#284237] dark:text-[#E4E1D8]'
                      }`}
                    >
                      <span className="text-lg mt-0.5 leading-none">{getLibraryPromptIcon(p)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-[12.5px] leading-snug text-[#23503E] dark:text-[#A3BDA8]">{p.title}</p>
                          {p.isSystem && (
                            <span className="px-1 py-0 text-[9px] font-bold rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#285B47] dark:text-[#A3BDA8] border border-[#9FC4AF] dark:border-[#49554D]">
                              Hệ thống
                            </span>
                          )}
                          {!p.isSystem && p.isPublic && (
                            <span className="px-1 py-0 text-[9px] font-bold rounded bg-[#FFFDF7] dark:bg-[#202423] text-[#2E6B53] dark:text-[#A3BDA8] border border-[#B8D7C5] dark:border-[#49554D]">
                              Công khai
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] mt-1 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#648174] dark:text-[#B8BDB5]">
                          <span className="truncate">
                            Tác giả: <strong className="text-[#2D5544] dark:text-[#E4E1D8]">{displayPromptAuthor}</strong>
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-[#39755D] dark:text-[#A3BDA8] tabular-nums-mono shrink-0">
                            <Terminal className="w-3 h-3" />
                            {p.steps.length} phần
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {sortedKhoLenhEntries.length === 0 && (
                  <div className="p-6 text-center text-[#6B877A] dark:text-[#B8BDB5] text-xs">
                    Thư mục này chưa có câu lệnh phù hợp.
                  </div>
                )}
              </>
            )}

            {activeTab === 'ideas' && (
              <>
                {sortedIdeas.length === 0 ? (
                  <div className="p-6 text-center text-[#6B877A] dark:text-[#B8BDB5] text-xs">
                    Không có ý tưởng nào khớp.
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-0.5">
                    {sortedIdeas.map((idea) => {
                      const ideaKey = getItemKey(idea);
                      const ideaIcon = getIdeaIcon(idea);
                      const ideaTags = getIdeaTags(idea);
                      const isActive = selectedIdeaId === ideaKey && !isCreating;
                      const canMutate = canEditOrDeleteItem('idea', idea);
                      
                      return (
                        <div
                          key={ideaKey}
                          onClick={() => {
                            setSelectedIdeaId(ideaKey);
                            setIsCreating(false);
                            setIsEditing(false);
                            setShowDetailOnMobile(true);
                          }}
                          className={`group relative text-left p-3 rounded-lg transition-all duration-150 flex flex-col gap-2 border cursor-pointer select-none ${
                            isActive
                              ? 'bg-[#E2F3E8] border-[#39755D] dark:bg-[#343D37] dark:border-[#A3BDA8]'
                              : 'bg-[#FFF9EA] dark:bg-[#292E2B] border-[#CFE2D6] dark:border-[#49554D] hover:border-[#8AB69F] dark:hover:border-[#A3BDA8]'
                          }`}
                        >
                          {/* Card Header (Icon, Tags & Actions) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 min-w-0 flex-wrap">
                              <span className="text-base leading-none flex-shrink-0 mr-0.5">{ideaIcon}</span>
                              {ideaTags.slice(0, 3).map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTagInList(setSelectedIdeaTags, tag);
                                  }}
                                  className="px-1.5 py-0.5 text-[9.5px] font-semibold rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#285B47] dark:text-[#A3BDA8] border border-[#C3DEC9] dark:border-[#49554D] hover:border-[#39755D] cursor-pointer"
                                  title={`Lọc theo tag #${tag}`}
                                >
                                  #{tag}
                                </button>
                              ))}
                              {ideaTags.length > 3 && (
                                <span className="text-[9.5px] font-mono text-[#587568] dark:text-[#B8BDB5]">
                                  +{ideaTags.length - 3}
                                </span>
                              )}
                              {idea.isSystem ? (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#E2F3E8] dark:bg-[#343D37] text-[#285B47] dark:text-[#A3BDA8] border border-[#9FC4AF] dark:border-[#49554D]">
                                  Hệ thống
                                </span>
                              ) : idea.isPublic ? (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#FFFDF7] dark:bg-[#202423] text-[#2E6B53] dark:text-[#A3BDA8] border border-[#B8D7C5] dark:border-[#49554D]">
                                  Công khai
                                </span>
                              ) : idea.ownerId ? (
                                <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-[#F5F2E8] dark:bg-[#202423] text-[#668476] dark:text-[#B8BDB5] border border-[#D4E2D8] dark:border-[#49554D]">
                                  Riêng tư
                                </span>
                              ) : null}
                            </div>
                            
                            {/* Mini Actions (Author / Admin only) */}
                            {canMutate && (
                              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIdeaId(ideaKey);
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
                                    handleDeleteIdea(idea);
                                  }}
                                  className="p-1 rounded text-[#587568] hover:text-red-600 hover:bg-red-500/10 dark:text-[#B8BDB5] dark:hover:text-[#E4A6AA] transition"
                                  title="Xóa ý tưởng"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
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
                          <div className="flex items-center justify-between text-[9px] text-[#668476] dark:text-[#B8BDB5] tabular-nums-mono pt-0.5 gap-2">
                            <span className="truncate">
                              {idea.authorDisplayName ? `${idea.authorDisplayName} • ` : ''}Gieo: {new Date(idea.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                            {idea.updatedAt && idea.updatedAt !== idea.createdAt && (
                              <span className="shrink-0">đã sửa</span>
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
                {sortedCharacters.length === 0 ? (
                  <div className="p-6 text-center text-[#6B877A] dark:text-[#B8BDB5] text-xs space-y-2">
                    <p>Chưa có nhân vật nào phù hợp trong thư mục.</p>
                    {charDateFilter.mode !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setCharDateFilter({ mode: 'all' })}
                        className="retro-btn px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                      >
                        Đặt lại bộ lọc ngày
                      </button>
                    )}
                  </div>
                ) : (
                  sortedCharacters.map((char) => {
                    const charKey = getItemKey(char);
                    const charImages = getCharacterImages(char);
                    const isSelected = selectedCharId === charKey && !isCreating;
                    const canMutate = canEditOrDeleteItem('character', char);
                    const displayCharAuthor = char.author || char.authorDisplayName;
                    return (
                      <div
                        key={charKey}
                        onClick={() => {
                          setSelectedCharId(charKey);
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
                        <CharacterAvatarThumb
                          firstImage={charImages[0]}
                          totalImages={charImages.length}
                          emojiFallback={char.avatar}
                          name={char.name}
                          isSelected={isSelected}
                        />
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-xs truncate leading-snug text-[#20372D] dark:text-[#E4E1D8] group-hover:text-[#39755D] dark:group-hover:text-[#A3BDA8] transition-colors">
                              {char.name}
                            </p>
                            {char.isSystem ? (
                              <span className="px-1.5 py-0.5 text-[9px] bg-[#E2F3E8] dark:bg-[#343D37] text-[#285B47] dark:text-[#A3BDA8] rounded border border-[#9FC4AF] dark:border-[#49554D] font-bold">
                                Hệ thống
                              </span>
                            ) : char.isPublic ? (
                              <span className="px-1.5 py-0.5 text-[9px] bg-[#FFFDF7] dark:bg-[#202423] text-[#2E6B53] dark:text-[#A3BDA8] rounded border border-[#B8D7C5] dark:border-[#49554D] font-bold">
                                Công khai
                              </span>
                            ) : char.ownerId ? (
                              <span className="px-1.5 py-0.5 text-[9px] bg-[#F5F2E8] dark:bg-[#202423] text-[#668476] dark:text-[#B8BDB5] rounded border border-[#D4E2D8] dark:border-[#49554D] font-semibold">
                                Riêng tư
                              </span>
                            ) : null}
                            {displayCharAuthor && (
                              <span
                                className="px-1.5 py-0.5 text-[9px] bg-[#E2F3E8]/80 dark:bg-[#343D37] text-[#39755D] dark:text-[#A3BDA8] rounded border border-[#BDD9C9] dark:border-[#49554D] font-medium max-w-[95px] truncate"
                                title={`Tác giả: ${displayCharAuthor}`}
                              >
                                {displayCharAuthor}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#5B786B] dark:text-[#B8BDB5] mt-1 truncate">{char.role}</p>
                        </div>

                        {/* Quick Delete Character Button (Author / Admin only) */}
                        {canMutate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCharacter(char);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-[#6B877A] hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Xóa nhanh nhân vật này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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

          {/* Sidebar Creation Command Anchor (Chỉ hiển thị khi đã đăng nhập) */}
          {isAuthenticated && activeTab !== 'authors' && (
            <div className="sticky bottom-0 p-2.5 border-t border-[#CBE0D3] dark:border-[#49554D] bg-[#F1F8F3] dark:bg-[#202423] flex flex-col gap-1.5 z-10">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  setIsEditing(false);
                  setIsCreatingLibraryPrompt(false);
                  setIsEditingLibraryPrompt(false);
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

              {activeTab === 'notes' && isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingLibraryPrompt(true);
                    setIsEditingLibraryPrompt(false);
                    setIsCreating(false);
                    setIsEditing(false);
                    setShowDetailOnMobile(true);
                  }}
                  className="retro-btn w-full py-1.5 px-3 font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer text-[#224C3B] dark:text-[#A3BDA8]"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                  <span>Đăng Kho Lệnh (Admin)</span>
                </button>
              )}
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
              {isAuthenticated && isCreating && (
                <div className="w-full">
                  {activeTab === 'notes' && (
                    <NoteForm 
                      characters={displayCharacters}
                      onSave={handleSaveNote}
                      onCancel={() => setIsCreating(false)}
                      isSaving={isSavingItem}
                      canPublish={isAuthenticated}
                      isAdmin={isAdmin}
                      isAuthenticated={isAuthenticated}
                      userId={userId}
                      availableCatalog={formNoteTagCatalog}
                      sharedTags={sharedTags}
                      onToast={showToast}
                    />
                  )}
                  {activeTab === 'ideas' && (
                    <IdeaForm 
                      onSave={handleSaveIdea}
                      onCancel={() => setIsCreating(false)}
                      isSaving={isSavingItem}
                      canPublish={isAuthenticated}
                      isAdmin={isAdmin}
                      availableCatalog={formIdeaTagCatalog}
                      sharedTags={sharedTags}
                      onToast={showToast}
                    />
                  )}
                  {activeTab === 'characters' && (
                    <CharacterForm 
                      onSave={handleSaveCharacter}
                      onCancel={() => setIsCreating(false)}
                      isSaving={isSavingItem}
                      canPublish={isAuthenticated}
                      isAdmin={isAdmin}
                      availableCatalog={formCharTagCatalog}
                      sharedTags={sharedTags}
                      onToast={showToast}
                    />
                  )}
                </div>
              )}

              {/* 1B. ADMIN / CLOUD LIBRARY PROMPT FORM SECTOR */}
              {isAuthenticated && (isCreatingLibraryPrompt || isEditingLibraryPrompt) && activeTab === 'notes' && (
                <div className="w-full">
                  <LibraryPromptForm
                    initialData={isEditingLibraryPrompt ? activeLibraryPrompt ?? undefined : undefined}
                    onSave={handleSaveLibraryPrompt}
                    onCancel={() => {
                      setIsCreatingLibraryPrompt(false);
                      setIsEditingLibraryPrompt(false);
                    }}
                    isSaving={isSavingItem}
                    isAdmin={isAdmin}
                    isAuthenticated={isAuthenticated}
                    userId={userId}
                    availableCatalog={formNoteTagCatalog}
                    sharedTags={sharedTags}
                    onToast={showToast}
                  />
                </div>
              )}

              {/* 2. CHOSEN EDIT STATE */}
              {isAuthenticated && isEditing && (
                <div className="w-full">
                  {activeTab === 'notes' && activeNote && (
                    <NoteForm 
                      initialData={activeNote}
                      characters={displayCharacters}
                      onSave={handleSaveNote}
                      onCancel={() => setIsEditing(false)}
                      isSaving={isSavingItem}
                      canPublish={isAuthenticated}
                      isAdmin={isAdmin}
                      isAuthenticated={isAuthenticated}
                      userId={userId}
                      availableCatalog={formNoteTagCatalog}
                      sharedTags={sharedTags}
                      onToast={showToast}
                    />
                  )}
                  {activeTab === 'ideas' && activeIdea && (
                    <IdeaForm 
                      initialData={activeIdea}
                      onSave={handleSaveIdea}
                      onCancel={() => setIsEditing(false)}
                      isSaving={isSavingItem}
                      canPublish={isAuthenticated}
                      isAdmin={isAdmin}
                      availableCatalog={formIdeaTagCatalog}
                      sharedTags={sharedTags}
                      onToast={showToast}
                    />
                  )}
                  {activeTab === 'characters' && activeChar && (
                    <CharacterForm 
                      initialData={activeChar}
                      onSave={handleSaveCharacter}
                      onCancel={() => setIsEditing(false)}
                      isSaving={isSavingItem}
                      canPublish={isAuthenticated}
                      isAdmin={isAdmin}
                      availableCatalog={formCharTagCatalog}
                      sharedTags={sharedTags}
                      onToast={showToast}
                    />
                  )}
                </div>
              )}

              {/* 3. COHESIVE READ MODE (ONLY SHOWS IF NOT CREATING OR EDITING) */}
              {!isCreating && !isEditing && !isCreatingLibraryPrompt && !isEditingLibraryPrompt && (
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

                      {/* System Announcements Banner */}
                      <div className="mt-4">
                        <SystemAnnouncementsBanner
                          announcements={announcements}
                          isAdmin={isAdmin}
                          onOpenModal={() => setIsAnnouncementsModalOpen(true)}
                        />
                      </div>

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
                                {displayCharacters.length}
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
                                {displayNotes.length + displayLibraryPrompts.length}
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
                                {displayIdeas.length}
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
                            {getNoteTags(activeNote).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {getNoteTags(activeNote).map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                      toggleTagInList(setSelectedNoteTags, tag);
                                      setShowDetailOnMobile(false);
                                    }}
                                    className="px-2 py-0.5 bg-[#E2F3E8] dark:bg-[#202423] text-[#285B47] dark:text-[#A3BDA8] hover:bg-[#39755D] hover:text-[#FFF9EA] dark:hover:bg-[#343D37] dark:hover:text-[#E4E1D8] font-semibold text-[11px] rounded border border-[#B3D5C1] dark:border-[#49554D] transition cursor-pointer"
                                    title={`Lọc Kho Lệnh theo #${tag}`}
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {canEditOrDeleteItem('note', activeNote) && (
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
                                onClick={() => handleDeleteNote(activeNote)}
                                className="retro-btn-danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa bỏ</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <ContentInteractionBar
                        targetType="note"
                        item={activeNote}
                        isAuthenticated={isAuthenticated}
                        currentUserId={userId}
                        isTogglingPublic={isTogglingPublic}
                        onTogglePublic={(nextPublic) => handleTogglePublic('note', activeNote, nextPublic)}
                        onRequireAuth={() => openAuthModal('login')}
                        onToast={(msg) => showToast(msg, 'info')}
                      />

                      {/* Linked Character Strip */}
                      {(() => {
                        const linkedChar =
                          displayCharacters.find(
                            (c) =>
                              c.id === activeNote.characterId &&
                              (!activeNote.ownerId || !c.ownerId || c.ownerId === activeNote.ownerId),
                          ) || displayCharacters.find((c) => c.id === activeNote.characterId);
                        if (!activeNote.characterId && !linkedChar) return null;
                        return (
                          <div className="retro-callout-mint p-3.5 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-md bg-[#FFF9EA] dark:bg-[#292E2B] border border-[#B8D7C5] dark:border-[#49554D] flex items-center justify-center text-2xl flex-shrink-0">
                                {linkedChar?.avatar || '🍀'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-mono uppercase font-semibold text-[#39755D] dark:text-[#A3BDA8] tracking-wider">
                                  Nhân vật liên kết
                                </p>
                                <h4 className="font-bold text-[#20372D] dark:text-[#E4E1D8] text-sm truncate">
                                  {linkedChar?.name || 'Không xác định'}
                                </h4>
                                <p className="text-xs text-[#547264] dark:text-[#B8BDB5] truncate">
                                  {linkedChar?.role || 'Vui lòng chỉnh sửa và liên kết nhân vật'}
                                </p>
                              </div>
                            </div>
                            
                            {linkedChar && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('characters');
                                  setSelectedCharId(getItemKey(linkedChar));
                                }}
                                className="retro-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                                title="Đến trang chi tiết nhân vật"
                              >
                                <span>Xem nhân vật</span>
                                <ExternalLink className="w-3 h-3 text-[#39755D] dark:text-[#A3BDA8]" />
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Flexible Ordered Content Blocks */}
                      {(() => {
                        const parsedNote = getNoteDescriptionAndBlocks(activeNote);
                        return (
                          <PromptBlocksView
                            postKey={getItemKey(activeNote)}
                            title={activeNote.title}
                            description={parsedNote.description}
                            blocks={parsedNote.blocks}
                            autoNumberSteps={parsedNote.autoNumberSteps}
                            defaultPromptsExpanded
                            onCopyText={(text, label) => copyToClipboard(text, label)}
                          />
                        );
                      })()}

                      <PromptRatingSection
                        targetType="note"
                        item={activeNote}
                        isAuthenticated={isAuthenticated}
                        currentUserId={userId}
                        isAdmin={isAdmin}
                        onRequireAuth={() => openAuthModal('login')}
                        onToast={(msg) => showToast(msg, 'info')}
                        profileRevision={profile?.updated_at}
                      />
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
                              Tác giả: <strong className="text-[#23503E] dark:text-[#E4E1D8] font-semibold">{activeLibraryPrompt.author || activeLibraryPrompt.authorDisplayName || 'Cộng đồng'}</strong>
                            </span>
                          </div>
                          <span className="text-[10px] tabular-nums-mono text-[#5B7A6C] dark:text-[#B8BDB5]">
                            {activeLibraryPrompt.steps.length} khối lệnh
                          </span>
                        </div>

                        <div className="px-4 py-3.5 flex flex-col sm:flex-row justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug flex items-start gap-2.5">
                              <span className="text-xl leading-none mt-0.5 flex-shrink-0">{getLibraryPromptIcon(activeLibraryPrompt)}</span>
                              <span className="min-w-0 break-words">{activeLibraryPrompt.title}</span>
                            </h2>
                            {getLibraryPromptTags(activeLibraryPrompt).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {getLibraryPromptTags(activeLibraryPrompt).map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                      toggleTagInList(setSelectedNoteTags, tag);
                                      setShowDetailOnMobile(false);
                                    }}
                                    className="px-2 py-0.5 bg-[#E2F3E8] dark:bg-[#202423] text-[#285B47] dark:text-[#A3BDA8] hover:bg-[#39755D] hover:text-[#FFF9EA] dark:hover:bg-[#343D37] dark:hover:text-[#E4E1D8] font-semibold text-[11px] rounded border border-[#B3D5C1] dark:border-[#49554D] transition cursor-pointer"
                                    title={`Lọc Kho Lệnh theo #${tag}`}
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {canEditOrDeleteLibraryPrompt(activeLibraryPrompt) && (
                            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setIsEditingLibraryPrompt(true)}
                                className="retro-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                <span>Chỉnh sửa</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLibraryPrompt(activeLibraryPrompt)}
                                className="retro-btn-danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <ContentInteractionBar
                        targetType="library_prompt"
                        item={activeLibraryPrompt}
                        isAuthenticated={isAuthenticated}
                        currentUserId={userId}
                        isTogglingPublic={isTogglingPublic}
                        onTogglePublic={(nextPublic) => handleTogglePublic('library_prompt', activeLibraryPrompt, nextPublic)}
                        onRequireAuth={() => openAuthModal('login')}
                        onToast={(msg) => showToast(msg, 'info')}
                      />

                      {/* Flexible Ordered Content Blocks (100% compatible with legacy library steps) */}
                      {(() => {
                        const parsedLib = getLibraryPromptBlocks(activeLibraryPrompt);
                        return (
                          <PromptBlocksView
                            postKey={getItemKey(activeLibraryPrompt)}
                            title={activeLibraryPrompt.title}
                            description={activeLibraryPrompt.description}
                            howToUse={activeLibraryPrompt.howToUse}
                            blocks={parsedLib.blocks}
                            autoNumberSteps={parsedLib.autoNumberSteps}
                            defaultPromptsExpanded={false}
                            onCopyText={(text, label) => copyToClipboard(text, label)}
                          />
                        );
                      })()}

                      <PromptRatingSection
                        targetType="library_prompt"
                        item={activeLibraryPrompt}
                        isAuthenticated={isAuthenticated}
                        currentUserId={userId}
                        isAdmin={isAdmin}
                        onRequireAuth={() => openAuthModal('login')}
                        onToast={(msg) => showToast(msg, 'info')}
                        profileRevision={profile?.updated_at}
                      />

                      {/* Các câu lệnh khác của cùng tác giả */}
                      {(() => {
                        const originalAuthor = activeLibraryPrompt.author?.trim();
                        if (!originalAuthor) return null;
                        const otherPrompts = findPromptsByOriginalAuthor(
                          displayLibraryPrompts,
                          originalAuthor,
                          activeLibraryPrompt,
                        );
                        if (otherPrompts.length === 0) return null;
                        return (
                          <div className="retro-window overflow-hidden">
                            <div className="retro-window-header px-4 py-2 flex items-center justify-between gap-2">
                              <h3 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                <span>Các câu lệnh khác của cùng tác giả ({otherPrompts.length})</span>
                              </h3>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('notes');
                                  setSearchQuery('');
                                  setSourceFilter('all');
                                  setSelectedNoteTags([]);
                                  setPromptAuthorFilter(originalAuthor);
                                  setShowDetailOnMobile(false);
                                  showToast(`Đang lọc Kho Lệnh theo tác giả: ${originalAuthor}`, 'info');
                                }}
                                className="retro-btn px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                              >
                                Xem tất cả
                              </button>
                            </div>
                            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {otherPrompts.slice(0, 6).map((matchPrompt) => {
                                const matchKey = getItemKey(matchPrompt);
                                return (
                                  <button
                                    key={matchKey}
                                    type="button"
                                    onClick={() => {
                                      setSelectedLibraryPromptId(matchKey);
                                      setSelectedNoteId(null);
                                      setShowDetailOnMobile(true);
                                    }}
                                    className="retro-btn p-2.5 flex items-start gap-2.5 text-left cursor-pointer"
                                  >
                                    <span className="text-base leading-none mt-0.5 shrink-0">
                                      {getLibraryPromptIcon(matchPrompt)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-[#20372D] dark:text-[#E4E1D8] truncate">
                                        {matchPrompt.title}
                                      </p>
                                      {matchPrompt.description && (
                                        <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] line-clamp-2 mt-0.5">
                                          {matchPrompt.description}
                                        </p>
                                      )}
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-[#587568] dark:text-[#B8BDB5] shrink-0 mt-1" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
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
                          <div className="flex-1 min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug break-words">
                              {activeIdea.title}
                            </h2>
                            {getIdeaTags(activeIdea).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {getIdeaTags(activeIdea).map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                      toggleTagInList(setSelectedIdeaTags, tag);
                                      setShowDetailOnMobile(false);
                                    }}
                                    className="px-2 py-0.5 bg-[#E2F3E8] dark:bg-[#202423] text-[#285B47] dark:text-[#A3BDA8] hover:bg-[#39755D] hover:text-[#FFF9EA] dark:hover:bg-[#343D37] dark:hover:text-[#E4E1D8] font-semibold text-[11px] rounded border border-[#B3D5C1] dark:border-[#49554D] transition cursor-pointer"
                                    title={`Lọc Kho Idea theo #${tag}`}
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {canEditOrDeleteItem('idea', activeIdea) && (
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
                                onClick={() => handleDeleteIdea(activeIdea)}
                                className="retro-btn-danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="p-4 sm:p-5">
                          <p className="text-sm text-[#284237] dark:text-[#E4E1D8] whitespace-pre-wrap break-words leading-relaxed">
                            {activeIdea.content}
                          </p>
                        </div>
                      </div>

                      <ContentInteractionBar
                        targetType="idea"
                        item={activeIdea}
                        isAuthenticated={isAuthenticated}
                        currentUserId={userId}
                        isTogglingPublic={isTogglingPublic}
                        onTogglePublic={(nextPublic) => handleTogglePublic('idea', activeIdea, nextPublic)}
                        onRequireAuth={() => openAuthModal('login')}
                        onToast={(msg) => showToast(msg, 'info')}
                      />
                    </article>
                  )}

                  {/* D. CHARACTER DETAILS COMPONENT DISPLAY */}
                  {activeTab === 'characters' && activeChar && (() => {
                    const activeCharImages = getCharacterImages(activeChar);
                    const savedDateKey = toLocalDateKey(activeChar.createdAt);
                    const savedDateLabel = formatCreatedDateShort(activeChar.createdAt);
                    const displayCharAuthor = activeChar.author || activeChar.authorDisplayName;
                    const authorPrompts = activeChar.author?.trim()
                      ? findPromptsByOriginalAuthor(
                          displayLibraryPrompts,
                          activeChar.author,
                        )
                      : [];
                    return (
                    <article className="space-y-4 animate-fade-in min-w-0" id="active-character-card">
                      {/* Compact Retro Profile Window */}
                      <div className="retro-window overflow-hidden">
                        <div className="retro-window-header px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#39755D] dark:text-[#A3BDA8] flex items-center gap-1.5">
                            <PixelCharacterIcon className="w-3.5 h-3.5" />
                            Hồ sơ Nhân Vật
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {savedDateLabel && savedDateKey && (
                              <div className="inline-flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-[#547264] dark:text-[#B8BDB5]">
                                  Lưu: {savedDateLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCharDateFilter({ mode: 'exact', dateKey: savedDateKey });
                                    setIsCharDateFilterOpen(true);
                                    setShowDetailOnMobile(false);
                                    showToast(`Đang lọc nhân vật lưu ngày ${savedDateLabel}`, 'info');
                                  }}
                                  className="px-1.5 py-0.5 bg-[#FFF9EA] dark:bg-[#292E2B] hover:bg-[#E2F3E8] dark:hover:bg-[#343D37] text-[#39755D] dark:text-[#A3BDA8] rounded text-[10px] font-semibold border border-[#B8D7C5] dark:border-[#49554D] inline-flex items-center gap-1 cursor-pointer transition"
                                  title={`Lọc các nhân vật cùng lưu ngày ${savedDateLabel}`}
                                >
                                  <Calendar className="w-2.5 h-2.5" />
                                  <span>Lọc ngày này</span>
                                </button>
                              </div>
                            )}
                            {displayCharAuthor && (
                              <span className="px-2 py-0.5 bg-[#FFF9EA] dark:bg-[#292E2B] text-[#39755D] dark:text-[#A3BDA8] rounded text-[10px] font-semibold border border-[#B8D7C5] dark:border-[#49554D]">
                                Tác giả: {displayCharAuthor}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-4 space-y-3.5">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                            <div className="flex items-start gap-3.5 min-w-0 flex-1">
                              {activeCharImages.length > 0 ? (
                                <CharacterAvatarThumb
                                  firstImage={activeCharImages[0]}
                                  totalImages={activeCharImages.length}
                                  emojiFallback={activeChar.avatar}
                                  name={activeChar.name}
                                  isSelected
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-lg bg-[#E2F3E8] dark:bg-[#343D37] border border-[#9FC4AF] dark:border-[#49554D] flex items-center justify-center text-3xl flex-shrink-0">
                                  {activeChar.avatar}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h2 className="text-lg sm:text-xl font-bold text-[#224C3B] dark:text-[#E4E1D8] leading-snug break-words">
                                  {activeChar.name}
                                </h2>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {getCharacterTags(activeChar).map((trimmed, idx) => (
                                    <button
                                      key={`${trimmed}-${idx}`}
                                      type="button"
                                      onClick={() => {
                                        toggleTagInList(setSelectedCharTags, trimmed);
                                        setShowDetailOnMobile(false);
                                        showToast(`Đang lọc nhân vật theo tag: #${trimmed}`, 'info');
                                      }}
                                      className="px-2 py-0.5 bg-[#E2F3E8] dark:bg-[#202423] text-[#285B47] dark:text-[#A3BDA8] hover:bg-[#39755D] hover:text-[#FFF9EA] dark:hover:bg-[#343D37] dark:hover:text-[#E4E1D8] dark:hover:border-[#A3BDA8] font-semibold text-[11px] rounded border border-[#B3D5C1] dark:border-[#49554D] transition cursor-pointer"
                                      title={`Lọc theo tag #${trimmed}`}
                                    >
                                      #{trimmed}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {canEditOrDeleteItem('character', activeChar) && (
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
                                  onClick={() => handleDeleteCharacter(activeChar)}
                                  className="retro-btn-danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {activeChar.description && (
                            <div className="pt-3 border-t border-[#DCEAE1] dark:border-[#49554D] text-sm text-[#2B463A] dark:text-[#E4E1D8] leading-relaxed break-words">
                              {activeChar.description}
                            </div>
                          )}

                          {/* Social external linkages — unified retro-btn style (dynamic + legacy safe) */}
                          {(() => {
                            const charSocialLinks = getCharacterSocialLinks(activeChar).filter((link) =>
                              isSafeExternalHttpUrl(link.url),
                            );
                            const safeGgaiUrl = isSafeExternalHttpUrl(activeChar.ggai)
                              ? activeChar.ggai!.trim()
                              : '';
                            if (charSocialLinks.length === 0 && !safeGgaiUrl) return null;

                            return (
                              <div className="pt-3 flex flex-wrap gap-2 border-t border-[#DCEAE1] dark:border-[#49554D]">
                                {charSocialLinks.map((link) => {
                                  const platformName = getSocialPlatformLabel(link.platform);
                                  const displayText = link.label?.trim() || platformName;
                                  return (
                                    <a
                                      key={link.id}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="retro-btn inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold max-w-full"
                                      title={`Mở ${platformName}: ${displayText}`}
                                    >
                                      <SocialPlatformIcon
                                        platform={link.platform}
                                        className="w-3.5 h-3.5 flex-shrink-0"
                                      />
                                      <span className="truncate">{displayText}</span>
                                    </a>
                                  );
                                })}

                                {safeGgaiUrl && (
                                  <div className="inline-flex items-center gap-1">
                                    <a
                                      href={safeGgaiUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="retro-btn inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                                      title={`Mở Prompt ${activeChar.name} trong Google AI Studio`}
                                    >
                                      <SocialPlatformIcon
                                        platform={detectSocialPlatformFromUrl(safeGgaiUrl)}
                                        className="w-3.5 h-3.5 flex-shrink-0"
                                      />
                                      <span>{activeChar.name}</span>
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(safeGgaiUrl, 'Link Google AI Studio')}
                                      className="retro-btn px-2 py-1.5 text-xs cursor-pointer"
                                      title="Sao chép link Google AI Studio"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* CHARACTER IMAGE GALLERY (0..5 images + Copy PNG + Zoom Lightbox) */}
                      {activeCharImages.length > 0 && (
                        <CharacterDetailGallery
                          images={activeCharImages}
                          characterName={activeChar.name}
                          onToast={showToast}
                        />
                      )}

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

                      {/* Các câu lệnh của cùng tác giả gốc với nhân vật */}
                      {authorPrompts.length > 0 && activeChar.author && (
                        <div className="retro-window overflow-hidden">
                          <div className="retro-window-header px-4 py-2 flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-[#224C3B] dark:text-[#E4E1D8] flex items-center gap-1.5">
                              <Terminal className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                              <span>Các câu lệnh của {activeChar.author} ({authorPrompts.length})</span>
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('notes');
                                setSearchQuery('');
                                setSourceFilter('all');
                                setSelectedNoteTags([]);
                                setPromptAuthorFilter(activeChar.author || '');
                                setShowDetailOnMobile(false);
                                showToast(`Đang xem Kho Lệnh của tác giả ${activeChar.author}`, 'info');
                              }}
                              className="retro-btn px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                            >
                              Xem tất cả
                            </button>
                          </div>
                          <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {authorPrompts.slice(0, 6).map((matchPrompt) => {
                              const matchKey = getItemKey(matchPrompt);
                              return (
                                <button
                                  key={matchKey}
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('notes');
                                    setPromptAuthorFilter('');
                                    setSelectedLibraryPromptId(matchKey);
                                    setSelectedNoteId(null);
                                    setIsCreating(false);
                                    setIsEditing(false);
                                    setShowDetailOnMobile(true);
                                  }}
                                  className="retro-btn p-2.5 flex items-start gap-2.5 text-left cursor-pointer"
                                >
                                  <span className="text-base leading-none mt-0.5 shrink-0">
                                    {getLibraryPromptIcon(matchPrompt)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[#20372D] dark:text-[#E4E1D8] truncate">
                                      {matchPrompt.title}
                                    </p>
                                    {matchPrompt.description && (
                                      <p className="text-[10.5px] text-[#587568] dark:text-[#B8BDB5] line-clamp-2 mt-0.5">
                                        {matchPrompt.description}
                                      </p>
                                    )}
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-[#587568] dark:text-[#B8BDB5] shrink-0 mt-1" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <ContentInteractionBar
                        targetType="character"
                        item={activeChar}
                        isAuthenticated={isAuthenticated}
                        currentUserId={userId}
                        isTogglingPublic={isTogglingPublic}
                        onTogglePublic={(nextPublic) => handleTogglePublic('character', activeChar, nextPublic)}
                        onRequireAuth={() => openAuthModal('login')}
                        onToast={(msg) => showToast(msg, 'info')}
                      />

                      <CharacterCommentsSection
                        character={activeChar}
                        isAuthenticated={isAuthenticated}
                        currentUserId={userId}
                        isAdmin={isAdmin}
                        onRequireAuth={() => openAuthModal('login')}
                        onToast={(msg) => showToast(msg, 'info')}
                        profileRevision={profile?.updated_at}
                      />
                    </article>
                    );
                  })()}

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
                                    {renderBrandLogoForUrl(activeAuthor.fb.url)}
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
                                      {renderBrandLogoForUrl(disc.url)}
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
                                    {renderBrandLogoForUrl(activeAuthor.web.url)}
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
                                    {renderBrandLogoForUrl(activeAuthor.other.url)}
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
                            Nhân vật của tác giả ({displayCharacters.filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase()).length})
                          </h3>
                        </div>

                        <div className="p-4">
                          {displayCharacters.filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase()).length === 0 ? (
                            <p className="text-[#5B7A6C] dark:text-[#B8BDB5] text-xs py-4 text-center">
                              Chưa có nhân vật nào của tác giả này trong dữ liệu đang hiển thị.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {displayCharacters
                                .filter(c => c.author?.toLowerCase() === activeAuthor.id?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.name?.toLowerCase() || c.author?.toLowerCase() === activeAuthor.fullName?.toLowerCase())
                                .map((char) => {
                                  const charKey = getItemKey(char);
                                  const charImages = getCharacterImages(char);
                                  return (
                                    <button
                                      key={charKey}
                                      type="button"
                                      onClick={() => {
                                        setSelectedCharId(charKey);
                                        setActiveTab('characters');
                                        setIsCreating(false);
                                        setIsEditing(false);
                                        setShowDetailOnMobile(true);
                                      }}
                                      className="retro-btn p-3 flex items-center gap-3 text-left cursor-pointer"
                                    >
                                      <CharacterAvatarThumb
                                        firstImage={charImages[0]}
                                        totalImages={charImages.length}
                                        emojiFallback={char.avatar}
                                        name={char.name}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-[#20372D] dark:text-[#E4E1D8] truncate">{char.name}</p>
                                        <p className="text-[10px] text-[#587568] dark:text-[#B8BDB5] truncate mt-0.5">{char.role}</p>
                                      </div>
                                      <ChevronRight className="w-3.5 h-3.5 text-[#587568] dark:text-[#B8BDB5] flex-shrink-0" />
                                    </button>
                                  );
                                })}
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

      {/* ALL TAGS & ADMIN TAG MANAGEMENT MODAL */}
      <AllTagsModal
        isOpen={isAllTagsModalOpen}
        onClose={() => setIsAllTagsModalOpen(false)}
        catalog={
          activeTab === 'notes'
            ? noteTagCatalog
            : activeTab === 'ideas'
              ? ideaTagCatalog
              : charTagCatalog
        }
        sharedTags={sharedTags}
        selectedTags={
          activeTab === 'notes'
            ? selectedNoteTags
            : activeTab === 'ideas'
              ? selectedIdeaTags
              : selectedCharTags
        }
        onToggleTag={(tag) => {
          if (activeTab === 'notes') toggleTagInList(setSelectedNoteTags, tag);
          else if (activeTab === 'ideas') toggleTagInList(setSelectedIdeaTags, tag);
          else toggleTagInList(setSelectedCharTags, tag);
        }}
        onClearSelected={() => {
          if (activeTab === 'notes') setSelectedNoteTags([]);
          else if (activeTab === 'ideas') setSelectedIdeaTags([]);
          else setSelectedCharTags([]);
        }}
        isAdmin={Boolean(isAuthenticated && isAdmin)}
        tabLabel={
          activeTab === 'notes'
            ? 'Kho Lệnh'
            : activeTab === 'ideas'
              ? 'Kho Idea'
              : 'Nhân Vật'
        }
        onRefreshTagsAndData={handleRefreshTagsAndData}
        onTagsMutated={handleTagsMutated}
        onToast={showToast}
      />

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

      {/* PROFILE EDIT MODAL */}
      {isAuthenticated && userId && (
        <ProfileEditModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSaved={handleProfileSaved}
          onToast={showToast}
        />
      )}

      {/* MY CONTENT VAULT MODAL */}
      {isAuthenticated && userId && (
        <MyContentVaultModal
          isOpen={isMyVaultOpen}
          onClose={() => setIsMyVaultOpen(false)}
          userId={userId}
          isAdmin={isAdmin}
          characters={displayCharacters}
          notes={displayNotes}
          ideas={displayIdeas}
          libraryPrompts={displayLibraryPrompts}
          isTogglingPublic={isTogglingPublic}
          isSavingItem={isSavingItem}
          sortOrder={vaultSort}
          onChangeSortOrder={(next) => {
            setVaultSort(next);
            saveUiPrefs({ vaultSort: next });
          }}
          onViewItem={(kind, item) => handleVaultNavigateItem(kind, item, 'view')}
          onEditItem={(kind, item) => handleVaultNavigateItem(kind, item, 'edit')}
          onDeleteItem={handleVaultDeleteItem}
          onTogglePublic={handleTogglePublic}
        />
      )}

      {/* SYSTEM ANNOUNCEMENTS MODAL */}
      <SystemAnnouncementsModal
        isOpen={isAnnouncementsModalOpen}
        onClose={() => setIsAnnouncementsModalOpen(false)}
        announcements={announcements}
        isAdmin={Boolean(isAuthenticated && isAdmin)}
        currentUserId={userId}
        onChanged={refreshAnnouncements}
        onToast={(msg) => showToast(msg, 'success')}
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
