export const GUEST_COMMENT_IDENTITY_KEY = 'seaclover_guest_comment_identity_v1';

export const GUEST_DISPLAY_PREFIX = 'Khách qua đường';
export const GUEST_CUSTOM_NAME_MAX_LENGTH = 40;

export interface GuestCommentIdentityState {
  customName: string;
  randomCode: string | null;
  clientToken: string;
}

function getStorage(storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (storageOverride !== undefined) return storageOverride;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createRandomFourDigitCode(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(1000 + (buf[0] % 9000));
  }
  return String(1000 + Math.floor(Math.random() * 9000));
}

function createGuestClientToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Chuẩn hóa tên tự đặt của khách:
 * - Hỗ trợ tiếng Việt có dấu, Unicode, emoji và khoảng trắng hợp lệ.
 * - Loại bỏ ký tự điều khiển, gộp khoảng trắng liên tiếp, xóa prefix thừa nếu khách tự gõ "Khách qua đường".
 * - Chỉ gồm khoảng trắng hoặc rỗng -> trả về chuỗi rỗng ''.
 */
export function normalizeGuestCustomName(raw: string): string {
  const withoutControls = raw.replace(/[\u0000-\u001F\u007F]+/g, ' ');
  let collapsed = withoutControls.replace(/\s+/g, ' ').trim();

  const wrappedPrefixMatch = collapsed.match(/^khách qua đường\s*\((.+)\)$/i);
  if (wrappedPrefixMatch && wrappedPrefixMatch[1]) {
    collapsed = wrappedPrefixMatch[1].trim();
  } else {
    collapsed = collapsed.replace(/^khách qua đường[\s:–—-]*/i, '').trim();
  }

  return Array.from(collapsed).slice(0, GUEST_CUSTOM_NAME_MAX_LENGTH).join('').trim();
}

export function formatGuestDisplayName(label: string): string {
  const cleanLabel = normalizeGuestCustomName(label);
  const effectiveLabel = cleanLabel || createRandomFourDigitCode();
  return `${GUEST_DISPLAY_PREFIX} (${effectiveLabel})`;
}

export function loadGuestCommentIdentity(
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): GuestCommentIdentityState {
  const storage = getStorage(storageOverride);
  if (!storage) {
    return {
      customName: '',
      randomCode: null,
      clientToken: 'guest_fallback_token',
    };
  }

  try {
    const raw = storage.getItem(GUEST_COMMENT_IDENTITY_KEY);
    if (!raw) {
      return {
        customName: '',
        randomCode: null,
        clientToken: createGuestClientToken(),
      };
    }

    const parsed = JSON.parse(raw) as Partial<GuestCommentIdentityState> | null;
    const customName = typeof parsed?.customName === 'string'
      ? normalizeGuestCustomName(parsed.customName)
      : '';
    const randomCode =
      typeof parsed?.randomCode === 'string' && /^\d{4}$/.test(parsed.randomCode)
        ? parsed.randomCode
        : null;
    const clientToken =
      typeof parsed?.clientToken === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(parsed.clientToken)
        ? parsed.clientToken
        : createGuestClientToken();

    return {
      customName,
      randomCode,
      clientToken,
    };
  } catch {
    return {
      customName: '',
      randomCode: null,
      clientToken: createGuestClientToken(),
    };
  }
}

function persistGuestCommentIdentity(
  state: GuestCommentIdentityState,
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): void {
  const storage = getStorage(storageOverride);
  if (!storage) return;
  try {
    storage.setItem(GUEST_COMMENT_IDENTITY_KEY, JSON.stringify(state));
  } catch {
    // Bỏ qua an toàn nếu trình duyệt chặn lưu localStorage
  }
}

/**
 * Lưu tên tự đặt mới nhất của khách (giữ nguyên randomCode đã có để khi xóa tên sẽ quay lại số cũ).
 */
export function saveGuestCustomName(
  rawName: string,
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): GuestCommentIdentityState {
  const current = loadGuestCommentIdentity(storageOverride);
  const next: GuestCommentIdentityState = {
    customName: normalizeGuestCustomName(rawName),
    randomCode: current.randomCode,
    clientToken: current.clientToken,
  };
  persistGuestCommentIdentity(next, storageOverride);
  return next;
}

/**
 * Lấy số ngẫu nhiên 4 chữ số đã lưu trong trình duyệt, hoặc tạo mới lần đầu và lưu lại.
 */
export function getOrCreateGuestRandomCode(
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): string {
  const current = loadGuestCommentIdentity(storageOverride);
  if (current.randomCode) {
    // Đảm bảo clientToken cũng được ghi ổn định
    persistGuestCommentIdentity(current, storageOverride);
    return current.randomCode;
  }

  const nextCode = createRandomFourDigitCode();
  const next: GuestCommentIdentityState = {
    customName: current.customName,
    randomCode: nextCode,
    clientToken: current.clientToken,
  };
  persistGuestCommentIdentity(next, storageOverride);
  return nextCode;
}

/**
 * Chuẩn bị danh tính khi khách bấm gửi bình luận:
 * - Nếu có tên tự đặt hợp lệ -> lưu tên tự đặt và dùng "Khách qua đường (<Tên tự đặt>)".
 * - Nếu để trống / chỉ toàn khoảng trắng -> xóa customName, lấy (hoặc tạo mới 1 lần) randomCode 4 chữ số
 *   và dùng "Khách qua đường (<4 chữ số>)".
 */
export function resolveGuestIdentityForSubmission(
  rawCustomName: string,
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> | null,
): {
  label: string;
  fullDisplayName: string;
  state: GuestCommentIdentityState;
} {
  const normalizedName = normalizeGuestCustomName(rawCustomName);
  const current = loadGuestCommentIdentity(storageOverride);

  if (normalizedName) {
    const nextState: GuestCommentIdentityState = {
      customName: normalizedName,
      randomCode: current.randomCode,
      clientToken: current.clientToken,
    };
    persistGuestCommentIdentity(nextState, storageOverride);
    return {
      label: normalizedName,
      fullDisplayName: `${GUEST_DISPLAY_PREFIX} (${normalizedName})`,
      state: nextState,
    };
  }

  const randomCode = current.randomCode ?? createRandomFourDigitCode();
  const nextState: GuestCommentIdentityState = {
    customName: '',
    randomCode,
    clientToken: current.clientToken,
  };
  persistGuestCommentIdentity(nextState, storageOverride);
  return {
    label: randomCode,
    fullDisplayName: `${GUEST_DISPLAY_PREFIX} (${randomCode})`,
    state: nextState,
  };
}
