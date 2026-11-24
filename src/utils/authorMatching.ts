import type { LibraryPrompt } from '../types';

/**
 * Chuẩn hóa tên tác giả để đối chiếu chính xác (không phân biệt hoa/thường và khoảng trắng thừa),
 * tuyệt đối không gộp mờ các tác giả khác nhau.
 */
export function normalizeAuthorName(author?: string | null): string {
  if (!author) return '';
  return author.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
}

export function isSameOriginalAuthor(a?: string | null, b?: string | null): boolean {
  const normA = normalizeAuthorName(a);
  const normB = normalizeAuthorName(b);
  if (!normA || !normB) return false;
  return normA === normB;
}

function getPromptUniqueKey(p: LibraryPrompt): string {
  return p.cloudKey || (p.ownerId ? `${p.ownerId}:${p.id}` : p.id);
}

/**
 * Tìm các câu lệnh trong Kho Lệnh (đang hiển thị hợp lệ với người xem) có cùng tác giả gốc (`author`).
 * - Chỉ đối chiếu theo trường `author` gốc (không nhầm với `authorDisplayName` của người đăng).
 * - Loại trừ bài đang xem (nếu có) và loại trừ trùng lặp theo khóa duy nhất.
 */
export function findPromptsByOriginalAuthor(
  prompts: LibraryPrompt[],
  targetAuthor?: string | null,
  excludePrompt?: LibraryPrompt | null,
): LibraryPrompt[] {
  const normTarget = normalizeAuthorName(targetAuthor);
  if (!normTarget) return [];

  const excludeKey = excludePrompt ? getPromptUniqueKey(excludePrompt) : null;
  const seenKeys = new Set<string>();
  const matches: LibraryPrompt[] = [];

  for (const prompt of prompts) {
    if (normalizeAuthorName(prompt.author) !== normTarget) continue;
    const key = getPromptUniqueKey(prompt);
    if (excludeKey && key === excludeKey) continue;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    matches.push(prompt);
  }

  return matches;
}
