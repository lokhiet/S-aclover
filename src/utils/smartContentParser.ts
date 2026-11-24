import type { PromptBlock, PromptBlockType, SharedTag } from '../types';
import { createPromptBlockId } from './contentBlocks';
import type { TagCatalogEntry } from './tagSystem';
import { analyzeSmartTagsClient } from './smartTagEngine';

export interface SmartParsedDraft {
  title: string;
  description: string;
  howToUse: string;
  autoNumberSteps: boolean;
  blocks: PromptBlock[];
  suggestedTags: string[];
  detectedStats: {
    hasTitle: boolean;
    hasCodeFences: boolean;
    stepCount: number;
  };
}

interface FenceSegment {
  kind: 'text' | 'fence';
  raw: string;
  lang?: string;
}

function splitByCodeFences(input: string): FenceSegment[] {
  const lines = input.split('\n');
  const segments: FenceSegment[] = [];
  let textBuf: string[] = [];
  let inFence = false;
  let fenceLang = '';
  let fenceBuf: string[] = [];

  const flushText = () => {
    if (textBuf.length > 0) {
      segments.push({ kind: 'text', raw: textBuf.join('\n') });
      textBuf = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inFence && /^```([a-zA-Z0-9_-]*)\s*$/.test(trimmed)) {
      flushText();
      inFence = true;
      fenceLang = trimmed.replace(/^```/, '').trim();
      fenceBuf = [];
      continue;
    }

    if (inFence && /^```\s*$/.test(trimmed)) {
      segments.push({
        kind: 'fence',
        raw: fenceBuf.join('\n'),
        lang: fenceLang,
      });
      inFence = false;
      fenceLang = '';
      fenceBuf = [];
      continue;
    }

    if (inFence) {
      fenceBuf.push(line);
    } else {
      textBuf.push(line);
    }
  }

  // Nếu thiếu thẻ đóng ``` thì vẫn giữ nguyên văn như text bình thường
  if (inFence) {
    textBuf.push(`\`\`\`${fenceLang}`, ...fenceBuf);
  }
  flushText();

  return segments;
}

const TITLE_PREFIX_RE = /^(?:tiêu đề|tên bài|tên lệnh|tên|title)\s*[:：]\s*(.+)$/i;
const DESC_PREFIX_RE = /^(?:mô tả|giới thiệu|công dụng|tổng quan|description|overview)\s*[:：]\s*(.+)$/i;
const HOWTO_PREFIX_RE = /^(?:cách dùng|cách sử dụng|hướng dẫn dùng|how to use|usage)\s*[:：]\s*(.+)$/i;

const STEP_HEADER_RE =
  /^(?:(?:#{1,4}\s*)?(?:bước|step|phần|mục|giai đoạn)\s+(\d+|[IVX]+)\s*[:.\-–—]?\s*(.*)|(\d{1,2})\s*[.)]\s+(.+))$/i;

const SECTION_HEADER_RE =
  /^(?:#{1,4}\s+(.+)|(?:={3,}|-{3,})\s*([^=\n-]+?)\s*(?:={3,}|-{3,})|\[(?!SYSTEM|YÊU CẦU|LỆNH|USER|CHAR)([^\]\n]{2,60})\](?:\s*[:：])?)$/i;

const TYPED_PREFIX_RE =
  /^(?:[📌⚠️📝💡📖🔥⚙️🎯✨👉🚨]*\s*)?(câu lệnh(?:\s*(?:chính|tiếng anh|tiếng việt|system|phụ))?|prompt(?:\s*(?:chính|tiếng anh|tiếng việt|system))?|system\s*(?:prompt|instruction)|bản tiếng anh(?:\s*\([^)]*\))?|bản tiếng việt(?:\s*\([^)]*\))?|hướng dẫn(?:\s*(?:cài đặt|sử dụng|chi tiết))?|cách dùng|cách dán|thiết lập|guide|how to use|lưu ý(?:\s*(?:quan trọng|bắt buộc))?|chú ý|cảnh báo|note|warning|ví dụ(?:\s*(?:minh họa|mẫu))?|mẫu|minh họa|example|sample|vd)\s*[:：]\s*(.*)$/i;

function classifyHeaderLabel(labelRaw: string, bodySample = ''): PromptBlockType {
  const combined = `${labelRaw} ${bodySample.slice(0, 180)}`.toLowerCase();
  const l = labelRaw.toLowerCase();

  if (/(?:lưu ý|chú ý|cảnh báo|quan trọng|\bnote\b|warning|⚠️|🚨|⛔)/.test(l)) {
    return 'note';
  }
  if (/(?:ví dụ|minh họa|kết quả mẫu|\bmẫu\b|example|sample|^vd\b)/.test(l)) {
    return 'example';
  }
  if (/(?:hướng dẫn|cách dùng|cách dán|cách sử dụng|thiết lập|\bguide\b|how to|setup)/.test(l)) {
    // Nếu trong thân có dấu hiệu câu lệnh rõ ràng thì ưu tiên giữ là prompt để có nút sao chép
    if (/(?:\[system|system instruction|\{\{user\}\}|\{\{char\}\}|^\/[a-z])/im.test(bodySample)) {
      return 'prompt';
    }
    return 'guide';
  }
  if (
    /(?:prompt|câu lệnh|lệnh|system|bản tiếng anh|bản tiếng việt|đoạn mã|code)/.test(l) ||
    /(?:\[system|system instruction|system command|\{\{user\}\}|\{\{char\}\}|<\/?[a-z]+>)/i.test(
      combined,
    )
  ) {
    return 'prompt';
  }
  return 'prompt';
}

function isLikelyPromptLine(line: string): boolean {
  return /^(?:\[?(?:SYSTEM\s*(?:INSTRUCTION|COMMAND|DIRECTIVE|OVERRIDE)?|YÊU CẦU|LỆNH HỆ THỐNG)|<\/?(?:system|instruction|prompt|rule|rules)>|\/[A-Za-z0-9_-]{2,}|\{\{(?:char|user)\}\})/i.test(
    line.trim(),
  );
}

function deriveTitleFromLine(line: string): string {
  const cleaned = line
    .replace(/^#+\s*/, '')
    .replace(/^\[|\]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= 90) return cleaned;
  return `${cleaned.slice(0, 87).trim()}...`;
}

/**
 * Bộ phân tích cấu trúc & từ khóa hoàn toàn phía client cho tính năng "Nhập thông minh".
 * Bảo toàn tuyệt đối từng ký tự nội dung gốc (không dịch, không tóm tắt, không viết lại).
 */
export function parseRawContentClient(params: {
  rawText: string;
  targetType: 'note' | 'library_prompt';
  availableCatalog: TagCatalogEntry[];
  sharedTags?: SharedTag[];
}): SmartParsedDraft {
  const normalized = params.rawText.replace(/\r\n?/g, '\n');
  const trimmedAll = normalized.trim();
  if (!trimmedAll) {
    return {
      title: '',
      description: '',
      howToUse: '',
      autoNumberSteps: false,
      blocks: [],
      suggestedTags: [],
      detectedStats: { hasTitle: false, hasCodeFences: false, stepCount: 0 },
    };
  }

  let title = '';
  let description = '';
  let howToUse = '';
  let stepCount = 0;
  let hasCodeFences = false;

  const segments = splitByCodeFences(normalized);
  const rawBlocks: PromptBlock[] = [];

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];

    if (seg.kind === 'fence') {
      hasCodeFences = true;
      const content = seg.raw.replace(/^\n+|\n+$/g, '');
      if (!content.trim()) continue;
      const looksLikePrompt =
        /(?:system|{{user}}|{{char}}|<system>|\[system|prompt|roleplay)/i.test(content);
      rawBlocks.push({
        id: createPromptBlockId(),
        type: looksLikePrompt || !seg.lang || /^(txt|text|markdown|md|prompt)$/i.test(seg.lang)
          ? 'prompt'
          : 'prompt',
        label: seg.lang
          ? `Đoạn mã / Nội dung (${seg.lang})`
          : looksLikePrompt
            ? 'Câu lệnh (Prompt)'
            : 'Đoạn nội dung / Mã',
        content,
        autoNumber: false,
        collapsed: false,
      });
      continue;
    }

    const lines = seg.raw.split('\n');
    let currentType: PromptBlockType = 'prompt';
    let currentLabel = '';
    let currentLines: string[] = [];
    let isFirstSegment = segIdx === 0;

    const flushBlock = () => {
      const joined = currentLines.join('\n').replace(/^\n+|\n+$/g, '');
      if (!joined.trim() && currentType !== 'heading') {
        currentLines = [];
        return;
      }
      const fallbackLabel =
        currentType === 'note'
          ? 'Lưu ý'
          : currentType === 'guide'
            ? 'Hướng dẫn'
            : currentType === 'example'
              ? 'Ví dụ minh họa'
              : currentType === 'heading'
                ? 'Phân mục'
                : 'Câu lệnh';

      rawBlocks.push({
        id: createPromptBlockId(),
        type: currentType,
        label: currentLabel || fallbackLabel,
        content: joined,
        autoNumber: false,
        collapsed: false,
      });
      currentLabel = '';
      currentLines = [];
      currentType = 'prompt';
    };

    let idx = 0;

    // Quét metadata ở phần đầu văn bản (Tiêu đề / Mô tả / Cách dùng) mà không làm mất nội dung câu lệnh
    if (isFirstSegment) {
      while (idx < lines.length && !lines[idx].trim()) {
        idx++;
      }

      // Kiểm tra các dòng đầu có nhãn rõ ràng
      let consumedMeta = true;
      while (idx < lines.length && consumedMeta) {
        consumedMeta = false;
        const line = lines[idx];
        const trimmed = line.trim();
        if (!trimmed) {
          idx++;
          consumedMeta = true;
          continue;
        }

        const titleMatch = trimmed.match(TITLE_PREFIX_RE);
        if (titleMatch && !title) {
          title = titleMatch[1].trim().slice(0, 140);
          idx++;
          consumedMeta = true;
          continue;
        }

        const descMatch = trimmed.match(DESC_PREFIX_RE);
        if (descMatch && !description) {
          description = descMatch[1].trim();
          idx++;
          consumedMeta = true;
          continue;
        }

        const howToMatch = trimmed.match(HOWTO_PREFIX_RE);
        if (howToMatch && !howToUse && params.targetType === 'library_prompt') {
          howToUse = howToMatch[1].trim();
          idx++;
          consumedMeta = true;
          continue;
        }
      }

      // Nếu chưa có tiêu đề rõ ràng nhưng dòng đầu tiên là tiêu đề Markdown (# ...) hoặc dòng tiêu đề ngắn đứng riêng
      if (!title && idx < lines.length) {
        const firstLine = lines[idx].trim();
        const mdHeading = firstLine.match(/^#\s+(.+)$/);
        const nextLine = lines[idx + 1]?.trim() ?? '';
        const hasRemainingContent = lines.slice(idx + 1).some((l) => l.trim().length > 0);

        if (mdHeading && hasRemainingContent) {
          title = mdHeading[1].trim().slice(0, 140);
          idx++;
        } else if (
          hasRemainingContent &&
          firstLine.length >= 3 &&
          firstLine.length <= 95 &&
          nextLine === '' &&
          !isLikelyPromptLine(firstLine) &&
          !STEP_HEADER_RE.test(firstLine) &&
          !TYPED_PREFIX_RE.test(firstLine) &&
          !/^[-*•]/.test(firstLine)
        ) {
          title = deriveTitleFromLine(firstLine);
          idx++;
        }
      }
    }

    for (; idx < lines.length; idx++) {
      const line = lines[idx];
      const trimmed = line.trim();

      if (!trimmed) {
        if (currentLines.length > 0) {
          currentLines.push('');
        }
        continue;
      }

      // 1) Kiểm tra dòng đầu khối có nhãn định dạng (Lưu ý:, Hướng dẫn:, Ví dụ:, Prompt:, Bản Tiếng Anh:...)
      const typedMatch = trimmed.match(TYPED_PREFIX_RE);
      if (typedMatch && !isLikelyPromptLine(trimmed)) {
        const headerPart = typedMatch[1].trim();
        const inlineRest = typedMatch[2] || '';
        flushBlock();
        currentLabel = headerPart;
        currentType = classifyHeaderLabel(headerPart, inlineRest);
        if (inlineRest.trim()) {
          currentLines.push(inlineRest);
        }
        continue;
      }

      // 2) Kiểm tra bước đánh số (Bước 1:, Step 1:, 1. ...) — chỉ tách khối khi là đầu mục bước rõ ràng
      const stepMatch = trimmed.match(STEP_HEADER_RE);
      if (stepMatch) {
        const stepNum = stepMatch[1] || stepMatch[3];
        const stepTitle = (stepMatch[2] || stepMatch[4] || '').trim();
        const looksLikeSubListInsidePrompt =
          currentLines.length > 0 &&
          currentType === 'prompt' &&
          !stepMatch[1] &&
          Number(stepNum) > 1 &&
          stepTitle.length > 100;

        if (!looksLikeSubListInsidePrompt && (stepMatch[1] || stepTitle.length <= 90)) {
          flushBlock();
          stepCount++;
          const composedLabel = stepTitle
            ? `Bước ${stepNum}: ${stepTitle}`
            : `Bước ${stepNum}`;
          currentLabel = composedLabel;
          currentType = classifyHeaderLabel(composedLabel);
          // Nếu dạng "1. <nội dung dài>" không có chữ "Bước", giữ nguyên dòng nội dung nếu đây là nội dung thực tế
          if (!stepMatch[1] && stepTitle.length > 45) {
            currentLines.push(stepTitle);
            currentLabel = `Bước ${stepNum}`;
          }
          continue;
        }
      }

      // 3) Kiểm tra tiêu đề phân mục Markdown (## ..., ### ...) hoặc khung === ... ===
      const secMatch = trimmed.match(SECTION_HEADER_RE);
      if (secMatch && !isLikelyPromptLine(trimmed)) {
        const headingText = (secMatch[1] || secMatch[2] || secMatch[3] || '').trim();
        if (headingText && headingText.length <= 90) {
          flushBlock();
          // Xem nếu ngay sau đó là nội dung văn bản, gán heading làm nhãn cho khối sắp tới
          const lookAhead = lines
            .slice(idx + 1, idx + 4)
            .map((l) => l.trim())
            .find(Boolean);
          if (lookAhead && !SECTION_HEADER_RE.test(lookAhead) && !TYPED_PREFIX_RE.test(lookAhead)) {
            currentLabel = headingText;
            currentType = classifyHeaderLabel(headingText, lookAhead);
          } else {
            rawBlocks.push({
              id: createPromptBlockId(),
              type: 'heading',
              label: headingText,
              content: '',
              autoNumber: false,
              collapsed: false,
            });
          }
          continue;
        }
      }

      currentLines.push(line);
    }

    flushBlock();
  }

  // Fallback bảo toàn 100% nội dung gốc nếu chưa tách được khối nào
  const validBlocks = rawBlocks.filter(
    (b) => b.content.trim().length > 0 || (b.type === 'heading' && b.label.trim().length > 0),
  );
  if (validBlocks.length === 0) {
    validBlocks.push({
      id: createPromptBlockId(),
      type: 'prompt',
      label: 'Câu lệnh chính',
      content: trimmedAll,
      autoNumber: false,
      collapsed: false,
    });
  }

  const autoNumberSteps = stepCount >= 2;
  const finalBlocks = validBlocks.map((b) => ({
    ...b,
    autoNumber: autoNumberSteps && b.type !== 'heading',
  }));

  if (!title) {
    const firstNonEmpty = trimmedAll.split('\n').find((l) => l.trim().length > 0) || '';
    title = deriveTitleFromLine(firstNonEmpty) || 'Bài đăng mới';
  }

  const tagAnalysis = analyzeSmartTagsClient({
    title,
    description: [description, howToUse].filter(Boolean).join('\n'),
    content: finalBlocks.map((b) => `${b.label}\n${b.content || ''}`).join('\n\n'),
    targetType: params.targetType,
    availableCatalog: params.availableCatalog,
    sharedTags: params.sharedTags,
    maxTags: 5,
  });

  return {
    title,
    description,
    howToUse,
    autoNumberSteps,
    blocks: finalBlocks,
    suggestedTags: tagAnalysis.suggestedTags,
    detectedStats: {
      hasTitle: Boolean(title),
      hasCodeFences,
      stepCount,
    },
  };
}
