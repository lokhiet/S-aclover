export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_SIGNUP_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;
export const SIGNUP_COOLDOWN_SECONDS = 45;
export const RESET_COOLDOWN_SECONDS = 60;
export const SIGNUP_WINDOW_MS = 10 * 60 * 1000;
export const MAX_SIGNUPS_PER_WINDOW = 3;

export const SIGNUP_RATE_LIMIT_KEY = 'seaclover_signup_rate_limit_v1';
export const RESET_COOLDOWN_KEY = 'seaclover_reset_cooldown_until_v1';

export type PasswordStrengthLevel = 'empty' | 'weak' | 'medium' | 'strong';

export interface PasswordStrengthResult {
  valid: boolean;
  level: PasswordStrengthLevel;
  label: string;
  error: string | null;
}

export interface SignupRateLimitCheck {
  allowed: boolean;
  waitSeconds: number;
  message?: string;
}

interface PersistedSignupRateState {
  successTimestamps: number[];
  recentFailTimestamps: number[];
  nextAllowedAt: number;
}

function getStorage(
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (storageOverride !== undefined) return storageOverride;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmailFormat(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return 'Vui lòng nhập địa chỉ email.';
  }
  if (normalized.length > MAX_EMAIL_LENGTH) {
    return 'Địa chỉ email quá dài.';
  }
  if (normalized.includes('..') || !EMAIL_REGEX.test(normalized)) {
    return 'Địa chỉ email không đúng định dạng.';
  }
  return null;
}

const COMMON_WEAK_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'abc12345',
  'seaclover',
  'seaclover123',
]);

/**
 * Kiểm tra độ mạnh mật khẩu cho đăng ký và đặt lại mật khẩu mới:
 * - Tối thiểu 8 ký tự, tối đa 128 ký tự.
 * - Phải chứa ít nhất 1 chữ cái và 1 chữ số.
 * - Chặn các mẫu quá yếu (lặp 1 ký tự, chuỗi phổ biến hoặc trùng phần tên email).
 */
export function evaluatePasswordStrength(
  password: string,
  email?: string,
): PasswordStrengthResult {
  if (!password) {
    return {
      valid: false,
      level: 'empty',
      label: '',
      error: 'Vui lòng nhập mật khẩu.',
    };
  }

  if (password.length < MIN_SIGNUP_PASSWORD_LENGTH) {
    return {
      valid: false,
      level: 'weak',
      label: 'Quá ngắn',
      error: `Mật khẩu phải có ít nhất ${MIN_SIGNUP_PASSWORD_LENGTH} ký tự.`,
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      level: 'weak',
      label: 'Quá dài',
      error: `Mật khẩu không được vượt quá ${MAX_PASSWORD_LENGTH} ký tự.`,
    };
  }

  const hasLetter = /\p{L}/u.test(password);
  const hasDigit = /\d/.test(password);

  if (!hasLetter || !hasDigit) {
    return {
      valid: false,
      level: 'weak',
      label: 'Yếu',
      error: 'Mật khẩu cần kết hợp cả chữ cái và chữ số.',
    };
  }

  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(password) || COMMON_WEAK_PASSWORDS.has(lower)) {
    return {
      valid: false,
      level: 'weak',
      label: 'Yếu',
      error: 'Mật khẩu quá phổ biến hoặc dễ đoán. Vui lòng chọn mật khẩu khác.',
    };
  }

  if (email) {
    const localPart = normalizeEmail(email).split('@')[0] || '';
    if (localPart.length >= 4 && lower === localPart) {
      return {
        valid: false,
        level: 'weak',
        label: 'Yếu',
        error: 'Mật khẩu không nên trùng với tên email của bạn.',
      };
    }
  }

  const hasUpper = /\p{Lu}/u.test(password);
  const hasLower = /\p{Ll}/u.test(password);
  const hasSymbol = /[^\p{L}\d\s]/u.test(password);

  const isStrong =
    (password.length >= 10 && hasUpper && hasLower && hasDigit) ||
    (password.length >= 8 && hasSymbol && (hasUpper || hasLower) && hasDigit);

  return {
    valid: true,
    level: isStrong ? 'strong' : 'medium',
    label: isStrong ? 'Mạnh' : 'Khá',
    error: null,
  };
}

function readSignupRateState(
  now: number,
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): PersistedSignupRateState {
  const storage = getStorage(storageOverride);
  const empty: PersistedSignupRateState = {
    successTimestamps: [],
    recentFailTimestamps: [],
    nextAllowedAt: 0,
  };
  if (!storage) return empty;

  try {
    const raw = storage.getItem(SIGNUP_RATE_LIMIT_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PersistedSignupRateState> | null;
    const successTimestamps = Array.isArray(parsed?.successTimestamps)
      ? parsed.successTimestamps.filter(
          (ts): ts is number =>
            typeof ts === 'number' && Number.isFinite(ts) && now - ts < SIGNUP_WINDOW_MS,
        )
      : [];
    const recentFailTimestamps = Array.isArray(parsed?.recentFailTimestamps)
      ? parsed.recentFailTimestamps.filter(
          (ts): ts is number =>
            typeof ts === 'number' && Number.isFinite(ts) && now - ts < 60_000,
        )
      : [];
    const nextAllowedAt =
      typeof parsed?.nextAllowedAt === 'number' && Number.isFinite(parsed.nextAllowedAt)
        ? parsed.nextAllowedAt
        : 0;
    return { successTimestamps, recentFailTimestamps, nextAllowedAt };
  } catch {
    return empty;
  }
}

function writeSignupRateState(
  state: PersistedSignupRateState,
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): void {
  const storage = getStorage(storageOverride);
  if (!storage) return;
  try {
    storage.setItem(SIGNUP_RATE_LIMIT_KEY, JSON.stringify(state));
  } catch {
    // Bỏ qua an toàn nếu trình duyệt hạn chế lưu localStorage
  }
}

export function checkSignupRateLimit(
  now = Date.now(),
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): SignupRateLimitCheck {
  const state = readSignupRateState(now, storageOverride);

  if (state.successTimestamps.length >= MAX_SIGNUPS_PER_WINDOW) {
    const oldest = Math.min(...state.successTimestamps);
    const unlockAt = Math.max(state.nextAllowedAt, oldest + SIGNUP_WINDOW_MS);
    if (unlockAt > now) {
      const waitSeconds = Math.max(1, Math.ceil((unlockAt - now) / 1000));
      return {
        allowed: false,
        waitSeconds,
        message: `Bạn đã tạo nhiều tài khoản liên tiếp. Vui lòng thử lại sau ${waitSeconds} giây.`,
      };
    }
  }

  if (state.nextAllowedAt > now) {
    const waitSeconds = Math.max(1, Math.ceil((state.nextAllowedAt - now) / 1000));
    return {
      allowed: false,
      waitSeconds,
      message: `Bạn thao tác đăng ký quá nhanh. Vui lòng chờ ${waitSeconds} giây rồi thử lại.`,
    };
  }

  return { allowed: true, waitSeconds: 0 };
}

export function recordSignupAttempt(
  succeeded: boolean,
  now = Date.now(),
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): SignupRateLimitCheck {
  const state = readSignupRateState(now, storageOverride);

  if (succeeded) {
    const nextSuccess = [...state.successTimestamps, now].slice(-MAX_SIGNUPS_PER_WINDOW);
    const nextState: PersistedSignupRateState = {
      successTimestamps: nextSuccess,
      recentFailTimestamps: [],
      nextAllowedAt: now + SIGNUP_COOLDOWN_SECONDS * 1000,
    };
    writeSignupRateState(nextState, storageOverride);
    return { allowed: true, waitSeconds: SIGNUP_COOLDOWN_SECONDS };
  }

  const nextFails = [...state.recentFailTimestamps, now];
  const nextAllowedAt =
    nextFails.length >= 4
      ? Math.max(state.nextAllowedAt, now + 15_000)
      : state.nextAllowedAt;

  writeSignupRateState(
    {
      successTimestamps: state.successTimestamps,
      recentFailTimestamps: nextFails,
      nextAllowedAt,
    },
    storageOverride,
  );

  return checkSignupRateLimit(now, storageOverride);
}

export function getRemainingCooldownSeconds(
  storageKey: string,
  now = Date.now(),
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): number {
  const storage = getStorage(storageOverride);
  if (!storage) return 0;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= now) return 0;
    return Math.ceil((until - now) / 1000);
  } catch {
    return 0;
  }
}

export function setCooldownSeconds(
  storageKey: string,
  seconds: number,
  now = Date.now(),
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): void {
  const storage = getStorage(storageOverride);
  if (!storage) return;
  try {
    storage.setItem(storageKey, String(now + Math.max(0, seconds) * 1000));
  } catch {
    // Bỏ qua an toàn
  }
}
