import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigStatus {
  configured: boolean;
  missingVars: Array<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'>;
  invalidUrl: boolean;
  message: string;
}

export interface SupabaseConnectionResult {
  ok: boolean;
  configured: boolean;
  statusCode?: number;
  message: string;
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missingVars: Array<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'> = [];

  if (!rawSupabaseUrl) {
    missingVars.push('VITE_SUPABASE_URL');
  }
  if (!rawSupabaseAnonKey) {
    missingVars.push('VITE_SUPABASE_ANON_KEY');
  }

  if (missingVars.length > 0) {
    return {
      configured: false,
      missingVars,
      invalidUrl: false,
      message: `Thiếu biến môi trường Supabase: ${missingVars.join(', ')}. Ứng dụng vẫn hoạt động bình thường với localStorage.`,
    };
  }

  if (!isValidHttpUrl(rawSupabaseUrl)) {
    return {
      configured: false,
      missingVars: [],
      invalidUrl: true,
      message:
        'Giá trị VITE_SUPABASE_URL không hợp lệ (cần bắt đầu bằng https:// hoặc http://).',
    };
  }

  return {
    configured: true,
    missingVars: [],
    invalidUrl: false,
    message: 'Đã cấu hình đầy đủ biến môi trường Supabase.',
  };
}

const configStatus = getSupabaseConfigStatus();

export const SUPABASE_AUTH_STORAGE_KEY = 'seaclover_supabase_auth';

export const isSupabaseConfigured: boolean = configStatus.configured;

/**
 * Supabase client instance.
 * Trả về null nếu chưa cấu hình hoặc cấu hình biến môi trường chưa hợp lệ,
 * đảm bảo không gây lỗi ứng dụng và không ảnh hưởng dữ liệu localStorage hiện có.
 *
 * Cấu hình Auth dùng PKCE và khóa lưu phiên riêng biệt (`seaclover_supabase_auth`),
 * hoàn toàn tách rời khỏi khóa dữ liệu ứng dụng (`seaclover_state`).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawSupabaseUrl, rawSupabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
      },
    })
  : null;

/**
 * Lấy Supabase client đã khởi tạo hoặc ném lỗi rõ ràng khi thiếu cấu hình.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(getSupabaseConfigStatus().message);
  }
  return supabase;
}

/**
 * Kiểm tra kết nối tới Supabase Project mà không cần tạo bảng database hay đăng nhập.
 * Hoạt động an toàn với cả Publishable Key mới và Anon Key chuẩn.
 */
export async function checkSupabaseConnection(
  timeoutMs = 8000,
): Promise<SupabaseConnectionResult> {
  const status = getSupabaseConfigStatus();

  if (!status.configured || !supabase) {
    return {
      ok: false,
      configured: false,
      message: status.message,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const normalizedUrl = rawSupabaseUrl.replace(/\/+$/, '');
    const response = await fetch(`${normalizedUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: rawSupabaseAnonKey,
      },
      signal: controller.signal,
    });

    if (response.ok) {
      return {
        ok: true,
        configured: true,
        statusCode: response.status,
        message: 'Kết nối tới Supabase Project thành công.',
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        configured: true,
        statusCode: response.status,
        message:
          'Kết nối tới Supabase bị từ chối. Vui lòng kiểm tra lại VITE_SUPABASE_ANON_KEY (Publishable Key).',
      };
    }

    return {
      ok: false,
      configured: true,
      statusCode: response.status,
      message: `Supabase phản hồi mã trạng thái không mong muốn (HTTP ${response.status}).`,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        configured: true,
        message: 'Hết thời gian chờ khi kết nối tới Supabase Project.',
      };
    }

    return {
      ok: false,
      configured: true,
      message:
        'Không thể kết nối tới Supabase Project. Vui lòng kiểm tra lại VITE_SUPABASE_URL hoặc kết nối mạng.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
