import { AppState, Note, Idea, Character, LibraryPrompt } from './types';
import { initialCharacters, initialNotes, initialIdeas } from './initialData';
import { defaultLibraryPrompts } from './promptsData';

const LOCAL_STORAGE_KEY = 'seaclover_state';

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) {
      return {
        notes: initialNotes,
        ideas: initialIdeas,
        characters: initialCharacters,
        theme: 'light',
        cloverEffect: true,
        libraryPrompts: defaultLibraryPrompts,
      };
    }
    const parsed = JSON.parse(saved);
    let ideasList = Array.isArray(parsed.ideas) ? parsed.ideas.filter((i: any) => i.id !== 'idea-1' && i.id !== 'idea-2') : initialIdeas;

    // Tự động đồng bộ các ý tưởng mới từ hệ thống vào kho ý tưởng hiện tại của người dùng
    // mà không phá hỏng hay xóa bỏ các ý tưởng cá nhân họ tự thêm thủ công trước đây.
    const savedIds = new Set(ideasList.map((i: any) => i.id));
    const missingIdeas = initialIdeas.filter(i => !savedIds.has(i.id));
    if (missingIdeas.length > 0) {
      ideasList = [...ideasList, ...missingIdeas];
      try {
        parsed.ideas = ideasList;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
      } catch (err) {
        console.error('Lỗi khi tự động nâng cấp kho ý tưởng vào LocalStorage:', err);
      }
    }

    const loadedNotes = Array.isArray(parsed.notes) ? parsed.notes : initialNotes;
    const finalNotes = loadedNotes.filter((n: any) => n && !['note-1', 'note-2', 'note-3', 'note-4'].includes(n.id));

    const REMOVED_BUILTIN_CHAR_IDS = new Set([
      'char-1',
      'char-2',
      'char-3',
      'char-4',
      'char-truong-thua-vu',
      'char-co-kinh-thuong',
      'char-an-thua-hach',
      'char-ly-han-thu',
      'char-hoang-duy-khoa',
      'char-ky-tinh-an',
      'char-f4-dua-xe',
      'char-le-tham',
      'char-vu-co-sa',
      'char-ha-di-tru',
      'char-liam-lawrence',
      'char-ahmose',
      'char-co-lang-hien',
      'char-tan-triet',
      'char-ky-duc',
      'char-tham-tinh-hoi',
      'char-co-chau-hoanh',
      'char-tham-dien',
      'char-co-duc-lam',
      'char-co-vu-lam',
      'char-aoyagi-haru',
      'char-game-thuc-te-ao',
      'char-hoac-canh-chau',
    ]);

    const loadedCharacters = Array.isArray(parsed.characters) ? parsed.characters : initialCharacters;
    let finalCharacters = loadedCharacters.filter((c: any) => c && !REMOVED_BUILTIN_CHAR_IDS.has(c.id));

    // Đồng bộ thuộc tính mới hoặc nhân vật mới cho người dùng hiện tại
    let hasUpdatedAnyChar = finalCharacters.length !== loadedCharacters.length;
    finalCharacters = finalCharacters.map((savedChar: any) => {
      const initialChar = initialCharacters.find(ic => ic.id === savedChar.id);
      if (initialChar) {
        let isUpdated = false;
        // Đồng bộ hóa chính xác backstoryUser và backstoryChar từ file dữ liệu
        if (savedChar.backstoryUser !== initialChar.backstoryUser) {
          savedChar.backstoryUser = initialChar.backstoryUser;
          isUpdated = true;
        }
        if (savedChar.backstoryChar !== initialChar.backstoryChar) {
          savedChar.backstoryChar = initialChar.backstoryChar;
          isUpdated = true;
        }
        if (savedChar.ggai !== initialChar.ggai) {
          savedChar.ggai = initialChar.ggai;
          isUpdated = true;
        }
        if (JSON.stringify(savedChar.fb) !== JSON.stringify(initialChar.fb)) {
          savedChar.fb = initialChar.fb;
          isUpdated = true;
        }
        if (JSON.stringify(savedChar.discord) !== JSON.stringify(initialChar.discord)) {
          savedChar.discord = initialChar.discord;
          isUpdated = true;
        }
        if (JSON.stringify(savedChar.discord2) !== JSON.stringify(initialChar.discord2)) {
          savedChar.discord2 = initialChar.discord2;
          isUpdated = true;
        }
        if (JSON.stringify(savedChar.web) !== JSON.stringify(initialChar.web)) {
          savedChar.web = initialChar.web;
          isUpdated = true;
        }
        if (JSON.stringify(savedChar.other) !== JSON.stringify(initialChar.other)) {
          savedChar.other = initialChar.other;
          isUpdated = true;
        }
        if (savedChar.author !== initialChar.author) {
          savedChar.author = initialChar.author;
          isUpdated = true;
        }
        if (savedChar.backstoryUserTitle !== initialChar.backstoryUserTitle) {
          savedChar.backstoryUserTitle = initialChar.backstoryUserTitle;
          isUpdated = true;
        }
        if (savedChar.backstoryCharTitle !== initialChar.backstoryCharTitle) {
          savedChar.backstoryCharTitle = initialChar.backstoryCharTitle;
          isUpdated = true;
        }
        if (savedChar.userProfile !== initialChar.userProfile) {
          savedChar.userProfile = initialChar.userProfile;
          isUpdated = true;
        }
        if (savedChar.userProfileTitle !== initialChar.userProfileTitle) {
          savedChar.userProfileTitle = initialChar.userProfileTitle;
          isUpdated = true;
        }
        // Force update role if it does not match system's initial data
        if (savedChar.role !== initialChar.role) {
          savedChar.role = initialChar.role;
          isUpdated = true;
        }
        if (savedChar.ggai !== initialChar.ggai) {
          savedChar.ggai = initialChar.ggai;
          isUpdated = true;
        }
        // Sync updated prompt if it differs or handles newly added prompts
        if (savedChar.prompt !== initialChar.prompt) {
          savedChar.prompt = initialChar.prompt;
          isUpdated = true;
        }
        if (isUpdated) {
          hasUpdatedAnyChar = true;
        }
      }
      return savedChar;
    });

    const savedCharIds = new Set(finalCharacters.map((c: any) => c.id));
    const missingCharacters = initialCharacters.filter(c => !savedCharIds.has(c.id));
    if (missingCharacters.length > 0) {
      finalCharacters = [...finalCharacters, ...missingCharacters];
      hasUpdatedAnyChar = true;
    }

    if (hasUpdatedAnyChar) {
      try {
        parsed.characters = finalCharacters;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
      } catch (err) {
        console.error('Lỗi khi tự động nâng cấp kho nhân vật vào LocalStorage:', err);
      }
    }

    let finalLibraryPrompts = Array.isArray(parsed.libraryPrompts) ? parsed.libraryPrompts : defaultLibraryPrompts;
    let hasUpdatedAnyPrompt = false;

    // Check if we need to sync updates from defaultLibraryPrompts
    finalLibraryPrompts = finalLibraryPrompts.map((savedPrompt: any) => {
      const defaultPrompt = defaultLibraryPrompts.find(dp => dp.id === savedPrompt.id);
      if (defaultPrompt) {
        let isUpdated = false;
        if (savedPrompt.title !== defaultPrompt.title) {
          savedPrompt.title = defaultPrompt.title;
          isUpdated = true;
        }
        if (savedPrompt.description !== defaultPrompt.description) {
          savedPrompt.description = defaultPrompt.description;
          isUpdated = true;
        }
        if (savedPrompt.howToUse !== defaultPrompt.howToUse) {
          savedPrompt.howToUse = defaultPrompt.howToUse;
          isUpdated = true;
        }
        if (JSON.stringify(savedPrompt.steps) !== JSON.stringify(defaultPrompt.steps)) {
          savedPrompt.steps = defaultPrompt.steps;
          isUpdated = true;
        }
        if (JSON.stringify(savedPrompt.tags) !== JSON.stringify(defaultPrompt.tags)) {
          savedPrompt.tags = defaultPrompt.tags;
          isUpdated = true;
        }
        if (isUpdated) {
          hasUpdatedAnyPrompt = true;
        }
      }
      return savedPrompt;
    });

    const savedPromptIds = new Set(finalLibraryPrompts.map((p: any) => p.id));
    const missingPrompts = defaultLibraryPrompts.filter(dp => !savedPromptIds.has(dp.id));
    if (missingPrompts.length > 0) {
      finalLibraryPrompts = [...finalLibraryPrompts, ...missingPrompts];
      hasUpdatedAnyPrompt = true;
    }

    if (hasUpdatedAnyPrompt) {
      try {
        parsed.libraryPrompts = finalLibraryPrompts;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
      } catch (err) {
        console.error('Lỗi khi nâng cấp thư viện câu lệnh:', err);
      }
    }

    return {
      notes: finalNotes,
      ideas: ideasList,
      characters: finalCharacters,
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      cloverEffect: typeof parsed.cloverEffect === 'boolean' ? parsed.cloverEffect : true,
      libraryPrompts: finalLibraryPrompts,
    };
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu từ LocalStorage:', error);
    return {
      notes: initialNotes,
      ideas: initialIdeas,
      characters: initialCharacters,
      theme: 'light',
      cloverEffect: true,
      libraryPrompts: defaultLibraryPrompts,
    };
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu vào LocalStorage:', error);
  }
}

export function exportStateToJSON(state: AppState) {
  const dataStr = JSON.stringify(state, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `seaclover_backup_${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

export function validateAndParseImport(jsonContent: string): Partial<AppState> | null {
  try {
    const parsed = JSON.parse(jsonContent);
    const result: Partial<AppState> = {};

    if (parsed.notes && Array.isArray(parsed.notes)) {
      result.notes = parsed.notes.filter((n: any) => n && typeof n.id === 'string' && typeof n.title === 'string');
    }
    if (parsed.ideas && Array.isArray(parsed.ideas)) {
      result.ideas = parsed.ideas.filter((i: any) => i && typeof i.id === 'string' && typeof i.title === 'string');
    }
    if (parsed.characters && Array.isArray(parsed.characters)) {
      result.characters = parsed.characters.filter((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string');
    }
    if (parsed.theme === 'light' || parsed.theme === 'dark') {
      result.theme = parsed.theme;
    }
    if (typeof parsed.cloverEffect === 'boolean') {
      result.cloverEffect = parsed.cloverEffect;
    }
    if (parsed.libraryPrompts && Array.isArray(parsed.libraryPrompts)) {
      result.libraryPrompts = parsed.libraryPrompts.filter((lp: any) => lp && typeof lp.id === 'string' && typeof lp.title === 'string');
    }

    if (Object.keys(result).length === 0) return null;
    return result;
  } catch (e) {
    console.error('Không thể phân tích tệp JSON tải lên:', e);
    return null;
  }
}
