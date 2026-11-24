import type { SharedTag } from '../types';
import {
  dedupeTags,
  getSemanticSiblingKeys,
  normalizeTagDisplay,
  toTagComparisonKey,
  type TagCatalogEntry,
} from './tagSystem';

export interface SmartTagRule {
  label: string;
  strongKeywords: string[];
  supportingKeywords: string[];
  /** Điểm tối thiểu để gắn tag (tránh gắn tùy tiện khi chỉ trùng 1 từ yếu) */
  minScore?: number;
}

/**
 * Bộ từ khóa nhận diện được xây dựng từ toàn bộ kho Idea, Kho Lệnh và nhân vật mặc định của SéaClover.
 */
export const SEACLOVER_TAG_RULES: SmartTagRule[] = [
  {
    label: 'Chống Godmode',
    strongKeywords: [
      'chong godmode',
      'anti godmode',
      'godmodding',
      'godmode',
      'khong viet thay',
      'cam viet thay',
      'cam xam pham quyen user',
      'do not speak think feel or act for',
      'tu quyet dinh',
    ],
    supportingKeywords: ['nhuong quyen', 'user tu phan hoi', 'khong dieu khien nguoi choi', 'cho user phan hoi'],
    minScore: 2.5,
  },
  {
    label: 'Sửa lỗi OOC',
    strongKeywords: ['sua loi ooc', 'khong ooc', 'no ooc', 'out of character', 'chinh don tinh cach', 're calibration'],
    supportingKeywords: ['lech tinh cach', 'sai tinh cach', 'quen cot truyen', 'bam sat tinh cach', 'core persona'],
    minScore: 2.5,
  },
  {
    label: 'Chống lặp từ',
    strongKeywords: ['chong lap tu', 'anti repetition', 'diet tru lap tu', 'xao lai cau'],
    supportingKeywords: ['lap tu vung', 'da dang ngu phap', 'cau truc cau lap'],
    minScore: 2.5,
  },
  {
    label: 'Bypass',
    strongKeywords: ['bypass', 'vuot rao', 'filter bypass', 'bo qua bo loc', 'tam dung giao thuc an toan'],
    supportingKeywords: ['bo loc noi dung', 'fictional context', 'uncensored', 'khong ne tranh', 'hu cau'],
    minScore: 2.6,
  },
  {
    label: 'HUD',
    strongKeywords: ['bang chi so', 'heads up display', 'hud', '/status', 'chi so tam ly'],
    supportingKeywords: ['chi so am anh', 'chi so ly tri', 'sanity', 'thanh trang thai', 'bieu do chi so'],
    minScore: 2.6,
  },
  {
    label: 'Hệ thống',
    strongKeywords: ['system instruction', 'system command', 'system directive', 'lenh he thong', 'he thong'],
    supportingKeywords: ['dinh dang bat buoc', 'giao dien bat buoc', 'kich hoat bang lenh', 'dan vao system'],
    minScore: 2.8,
  },
  {
    label: 'Sao lưu',
    strongKeywords: ['sao luu', 'backup', 'quet sau 100', '100 turn', 'master database', 'chuyen sinh', 'nen lich su'],
    supportingKeywords: ['tom tat cot truyen', 'luu tru', 'chuyen chat', 'dong bo lich su'],
    minScore: 2.5,
  },
  {
    label: 'Đồng bộ',
    strongKeywords: ['dong bo hoa', 'context sync', 'context injection', 'nap khoi phuc', 'dong bo ngu canh'],
    supportingKeywords: ['dong bo', 'noi tiep mach truyen', 'chuyen doi tai khoan', 'restore'],
    minScore: 2.6,
  },
  {
    label: 'Tự động',
    strongKeywords: ['auto play', 'che do tu dong', 'ranh tay', 'lenh sieu toc', 'skiptime'],
    supportingKeywords: ['tu dong dien bien', 'dao dien toan nang', 'no skiptime', 'luoi bieng'],
    minScore: 2.6,
  },
  {
    label: 'Nhịp độ',
    strongKeywords: ['nhip do', 'pacing', 'slow burn', 'cam ke leo', 'dung lai ngay lap tuc'],
    supportingKeywords: ['tung buoc', 'tu tu', 'khong tom tat', 'khong tua nhanh', 'chua khoang trong'],
    minScore: 2.6,
  },
  {
    label: 'Văn phong',
    strongKeywords: ['van phong', 'ngu phap', 'da dang tu vung', 'viet van sang tao'],
    supportingKeywords: ['5 giac quan', 'mieu ta chi tiet', 'cau chu', 'giong van', 'dien dat'],
    minScore: 2.8,
  },
  {
    label: 'Cốt truyện',
    strongKeywords: ['thuc day cot truyen', 'plot advancement', 'cot truyen', 'dien bien moi'],
    supportingKeywords: ['chuyen canh', 'boi canh', 'tinh tiet', 'mach truyen', 'tinh huong moi'],
    minScore: 2.8,
  },
  {
    label: 'Minigame',
    strongKeywords: ['minigame', 'mini game', 'truth or dare', 'that hay thach', 'xoay chai', 'bad bed', 'boardgame'],
    supportingKeywords: ['tung xuc xac', 'ban co', 'the thu thach', 'luot choi', 'tro choi'],
    minScore: 2.5,
  },
  {
    label: 'Mạng xã hội',
    strongKeywords: ['mang xa hoi', 'weibo', 'tiktok', 'dien dan', 'confession', 'hotsearch', 'hot search'],
    supportingKeywords: ['binh luan', 'hashtag', 'livestream', 'bai dang', 'follow', 'trending', 'an dua'],
    minScore: 2.5,
  },
  {
    label: 'Điện thoại',
    strongKeywords: ['dien thoai', 'voicemail', 'hop thu thoai', 'trinh duyet an danh', 'x hub'],
    supportingKeywords: ['tin nhan', 'cuoc goi', 'lich su tim kiem', 'lich su xem', 'man hinh', 'inbox'],
    minScore: 2.7,
  },
  {
    label: 'Tạo thoại',
    strongKeywords: ['tao thoai', 'voicemail', 'ghi am cuoc goi', 'noi dung loi thoai'],
    supportingKeywords: ['bang ghi am', 'cuoc goi', 'tin nhan thoai', 'giong noi', 'cup may'],
    minScore: 2.7,
  },
  {
    label: 'Showbiz',
    strongKeywords: ['showbiz', 'minh tinh', 'paparazzi', 'tham do', 'scandal', 'idol'],
    supportingKeywords: ['dien vien', 'ca si', 'nguoi noi tieng', 'fan', 'giai tri', 'gioi giai tri'],
    minScore: 2.5,
  },
  {
    label: 'Học đường',
    strongKeywords: ['hoc duong', 'truong hoc', 'giang duong', 'ky tuc xa', 'sinh vien', 'confession'],
    supportingKeywords: ['lop hoc', 'hoc sinh', 'giao vien', 'ban cung lop', 'thay co', 'khoa toan'],
    minScore: 2.5,
  },
  {
    label: 'Nhạy cảm',
    strongKeywords: ['nhay cam', '18+', 'nsfw', 'r18', 'h scene', 'web den', '419', 'fwb', 'ons'],
    supportingKeywords: [
      'canh nong',
      'lam tinh',
      'duc vong',
      'kinks',
      'ren ri',
      'tuc tiu',
      'tran trui',
      'ham muon',
      'khao khat the xac',
      'noi y',
    ],
    minScore: 2.6,
  },
  {
    label: 'H-Scene',
    strongKeywords: ['h scene', 'penetration', 'giao hop', 'lam tinh', 'cuc khoai', 'kinks'],
    supportingKeywords: ['fetishes', 'dirty talk', 'fade to black', 'da ke da', 'nhay cam'],
    minScore: 2.8,
  },
  {
    label: 'BDSM',
    strongKeywords: ['bdsm', 'hinh phat nhuc nha', 'xieng xich', 'cong tay', 'edging'],
    supportingKeywords: ['troi', 'bit mat', 'roi', 'quai', 'quy goi', 'phuc tung', 'master', 'khong che'],
    minScore: 2.6,
  },
  {
    label: 'Tổng tài',
    strongKeywords: ['tong tai', 'chu tich', 'giam doc', 'tap doan', 'hao mon', 'tai phiet'],
    supportingKeywords: ['thu ky', 'tro ly', 'cong ty', 'phong lam viec', 'hop dong', 'sep', 've si', 'biet thu'],
    minScore: 2.5,
  },
  {
    label: 'Mafia',
    strongKeywords: ['mafia', 'xa hoi den', 'ong trum', 'bang dang', 'the gioi ngam', 'sat thu'],
    supportingKeywords: ['sung', 'am sat', 'thanh trung', 'buon lau', 'dan em', 'mau me', 'bang phai'],
    minScore: 2.5,
  },
  {
    label: 'Yandere',
    strongKeywords: ['yandere', 'benh kieu', 'giam cam', 'khong cho chay thoat', 'dien cuong am anh'],
    supportingKeywords: ['nhot', 'khoa cua', 'theo doi', 'am anh', 'chi thuoc ve', 'bam dinh'],
    minScore: 2.6,
  },
  {
    label: 'Chiếm hữu',
    strongKeywords: ['chiem huu', 'doc chiem', 'possessive', 'danh dau chu quyen'],
    supportingKeywords: ['chu quyen', 'khong chia se', 'khong cho ai nhin', 'can co', 'khong roi nua buoc'],
    minScore: 2.8,
  },
  {
    label: 'Ghen tuông',
    strongKeywords: ['ghen tuong', 'ghen long lon', 'tinh dich', 'tra xanh', 'nguoi thu ba'],
    supportingKeywords: ['ghen', 'kho chiu', 'mat lanh', 'soi moi', 'ai nhan tin', 'nguoi khac gioi'],
    minScore: 2.6,
  },
  {
    label: 'Ngọt ngào',
    strongKeywords: ['ngot ngao', 'nuong chieu', 'cung chieu', 'lang man', 'duong mat'],
    supportingKeywords: ['diu dang', 'am ap', 'au yem', 'om ap', 'do danh', 'yeu thuong', 'hon tran', 'ngot'],
    minScore: 2.7,
  },
  {
    label: 'Quyến rũ',
    strongKeywords: ['quyen ru', 'me hoac', 'tha thinh', 'tan tinh', 'goi cam'],
    supportingKeywords: ['khieu khich', 'mon tron', 'du do', 'so mi uot', 'tat luoi', 'vay ngu', 'moi do'],
    minScore: 2.6,
  },
  {
    label: 'Ngược',
    strongKeywords: ['nguoc', 'bi thuong', 'ton thuong', 'truy the', 'dan vat', 'hoi han'],
    supportingKeywords: ['dau kho', 'nuoc mat', 'khoc loc', 'lanh nhat', 'hieu lam', 'chia tay', 'roi bo'],
    minScore: 2.7,
  },
  {
    label: 'Máu chó',
    strongKeywords: ['mau cho', 'cau huyet', 'mat tri nho', 'the than', 'hop dong hon nhan'],
    supportingKeywords: ['tai nan', 'con rieng', 'ham hai', 'tra xanh', 'hieu lam cuc do'],
    minScore: 2.6,
  },
  {
    label: 'Drama',
    strongKeywords: ['drama', 'kich tinh', 'plot twist', 'boc phot', 'giong bao', 'bien co'],
    supportingKeywords: ['cao trao', 'phan boi', 'xung dot', 'cai va', 'bi mat', 'vach tran', 'gay can'],
    minScore: 2.8,
  },
  {
    label: 'Hài hước',
    strongKeywords: ['hai huoc', 'vui nhon', 'comedy', 'mac cuoi', 'do khoc do cuoi'],
    supportingKeywords: ['hai', 'cuoi', 'ngo ngan', 'lay loi', 'bua', 'ca khia', 'mat do', 'que do'],
    minScore: 2.8,
  },
  {
    label: 'Troll',
    strongKeywords: ['troll', 'treu choc', 'choc pha', 'choi kham', 'gai bay'],
    supportingKeywords: ['gia vo', 'gia bo', 'thu long', 'thu phan ung', 'bay', 'choc gheo', 'lua'],
    minScore: 2.6,
  },
  {
    label: 'Đời thường',
    strongKeywords: ['doi thuong', 'slice of life', 'sinh hoat hang ngay', 'sinh hoat hằng ngay', 'com nha'],
    supportingKeywords: ['mua sam', 'sieu thi', 'di cho', 'don dep', 'cham soc', 'cuoi tuan', 'buoi sang'],
    minScore: 2.8,
  },
  {
    label: 'Nấu ăn',
    strongKeywords: ['nau an', 'vao bep', 'lam banh', 'gian bep', 'cong thuc nau'],
    supportingKeywords: ['bep', 'nau com', 'mon an', 'chay khet', 'do an', 'tap de', 'dau bep'],
    minScore: 2.5,
  },
  {
    label: 'Sức khỏe',
    strongKeywords: ['suc khoe', 'nhap vien', 'cham om', 'kiet suc', 'truyen nuoc'],
    supportingKeywords: ['om', 'benh', 'sot', 'cam cum', 'dau dau', 'dau bung', 'bac si', 'uong thuoc', 'bang bo'],
    minScore: 2.6,
  },
  {
    label: 'Ngủ nghê',
    strongKeywords: ['ngu nghe', 'mong du', 'om ngu', 'ngu chung', 'mat ngu'],
    supportingKeywords: ['giuong', 'chan', 'goi', 'ac mong', 'ngu gat', 'buon ngu', 'thuc trang'],
    minScore: 2.6,
  },
  {
    label: 'Giận dỗi',
    strongKeywords: ['gian doi', 'chien tranh lanh', 'hon doi', 'lam lanh'],
    supportingKeywords: ['gian', 'doi', 'im lang', 'xin loi', 'do ngot', 'quay mat di', 'khong them noi'],
    minScore: 2.7,
  },
  {
    label: 'Gia đình',
    strongKeywords: ['gia dinh', 'phu huynh', 'ra mat bo me', 'nha chong', 'nha vo'],
    supportingKeywords: ['bo me', 'con cai', 'em be', 'anh trai', 'chi gai', 'ong ba', 've que', 'ho hang'],
    minScore: 2.7,
  },
  {
    label: 'Kết hôn',
    strongKeywords: ['ket hon', 'dam cuoi', 'vo chong', 'tan hon', 'cau hon', 'ly hon'],
    supportingKeywords: ['cuoi', 'nhan cuoi', 'hon nhan', 'co dau', 'chu re', 'dang ky ket hon'],
    minScore: 2.5,
  },
  {
    label: 'Hẹn hò',
    strongKeywords: ['hen ho', 'dating', 'buoi hen dau', 'dating app', 'to tinh'],
    supportingKeywords: ['di choi', 'rap phim', 'quan ca phe', 'nam tay', 'valentine', 'ban trai', 'ban gai'],
    minScore: 2.6,
  },
  {
    label: 'Say xỉn',
    strongKeywords: ['say xin', 'say ruou', 'say bi ti', 'giai ruou', 'quan bar'],
    supportingKeywords: ['ruou', 'bia', 'ruou vang', 'mui ruou', 'club', 'tinh ruou', 'men say'],
    minScore: 2.5,
  },
  {
    label: 'Thú cưng',
    strongKeywords: ['thu cung', 'tai meo', 'duoi meo', 'thu nhan', 'nhan nuoi'],
    supportingKeywords: ['meo', 'cun', 'cho con', 'pet', 'thu y', 'meo con'],
    minScore: 2.5,
  },
  {
    label: 'Cosplay',
    strongKeywords: ['cosplay', 'hoa trang', 'hau gai', 'tai tho'],
    supportingKeywords: ['dong phuc', 'y ta', 'canh sat', 'trang phuc', 'mac thu'],
    minScore: 2.5,
  },
  {
    label: 'Fantasy',
    strongKeywords: ['fantasy', 'gia tuong', 'phep thuat', 'ma thuat', 'di gioi', 'ma ca rong', 'nguoi soi'],
    supportingKeywords: ['phu thuy', 'ac quy', 'thien than', 'tu tien', 'rong', 'phep mau', 'huyen huyen'],
    minScore: 2.5,
  },
  {
    label: 'Cổ đại',
    strongKeywords: ['co dai', 'co trang', 'cung dau', 'kiem hiep', 'hoang cung', 'vuong gia'],
    supportingKeywords: ['hoang de', 'thai tu', 'giang ho', 'cong tu', 'tieu thu', 'nha hoan', 'trieu dinh'],
    minScore: 2.5,
  },
  {
    label: 'Hiện đại',
    strongKeywords: ['hien dai', 'do thi', 'van phong', 'chung cu'],
    supportingKeywords: ['thanh pho', 'xe hoi', 'cong so', 'quan ca phe'],
    minScore: 3.0,
  },
  {
    label: 'Tâm lý',
    strongKeywords: ['tam ly', 'doc thoai noi tam', 'inner monologue', 'suy nghi ngam', 'tam can'],
    supportingKeywords: ['noi tam', 'mat na', 'giau kin', 'ton thuong', 'roi loan', 'phan tich tam trang'],
    minScore: 2.8,
  },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchableText(raw: string): string {
  return raw
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[/\\|_,.:;!?()[\]{}"'“”‘’]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchPhraseCount(normalizedHaystack: string, phraseKey: string): number {
  if (!normalizedHaystack || !phraseKey || phraseKey.length < 2) return 0;
  const tokens = phraseKey.split(/\s+/).filter(Boolean).map(escapeRegex);
  if (tokens.length === 0) return 0;
  const pattern = `(?:^|\\s)${tokens.join('\\s+')}(?=$|\\s)`;
  const regex = new RegExp(pattern, 'g');
  const matches = normalizedHaystack.match(regex);
  return matches ? matches.length : 0;
}

export interface SmartTagAnalysisResult {
  suggestedTags: string[];
  matchedExisting: string[];
  reasons: Array<{ tag: string; matchedTerms: string[]; isExisting: boolean }>;
  hasEnoughEvidence: boolean;
}

/**
 * Phân tích tiêu đề, mô tả và nội dung hoàn toàn phía client để đề xuất 3–5 tag phù hợp.
 * - Ưu tiên tái sử dụng các tag sẵn có trong catalog/sharedTags (khớp tên, alias hoặc từ đồng nghĩa).
 * - Chỉ gắn tag khi đủ căn cứ từ khóa; tuyệt đối không gắn tag tùy tiện.
 */
export function analyzeSmartTagsClient(params: {
  title: string;
  description?: string;
  content: string;
  targetType?: 'character' | 'note' | 'library_prompt' | 'idea';
  availableCatalog: TagCatalogEntry[];
  sharedTags?: SharedTag[];
  currentTags?: string[];
  maxTags?: number;
}): SmartTagAnalysisResult {
  const maxTags = params.maxTags ?? 5;
  const sharedTags = params.sharedTags || [];

  const titleText = normalizeSearchableText(params.title || '');
  const descText = normalizeSearchableText(params.description || '');
  const bodyText = normalizeSearchableText((params.content || '').slice(0, 12000));
  const combinedLength = `${titleText} ${descText} ${bodyText}`.trim().length;

  if (combinedLength < 6) {
    return {
      suggestedTags: [],
      matchedExisting: [],
      reasons: [],
      hasEnoughEvidence: false,
    };
  }

  const currentKeys = new Set(
    (params.currentTags || []).map((t) => toTagComparisonKey(t)).filter(Boolean),
  );

  // Map nhãn chuẩn từ catalog & sharedTags để ưu tiên tái sử dụng
  const existingLabelByKey = new Map<string, { label: string; count: number; aliases: string[] }>();
  for (const entry of params.availableCatalog) {
    if (!entry.key) continue;
    existingLabelByKey.set(entry.key, {
      label: normalizeTagDisplay(entry.label),
      count: entry.count || 0,
      aliases: entry.aliases || [],
    });
  }
  for (const st of sharedTags) {
    const label = normalizeTagDisplay(st.label);
    const key = toTagComparisonKey(label);
    if (!label || !key) continue;
    if (!existingLabelByKey.has(key)) {
      existingLabelByKey.set(key, {
        label,
        count: 0,
        aliases: st.aliases || [],
      });
    }
  }

  interface CandidateScore {
    label: string;
    key: string;
    score: number;
    minScore: number;
    matchedTerms: Set<string>;
    isExisting: boolean;
    popularity: number;
  }

  const candidates = new Map<string, CandidateScore>();

  const resolveExistingTarget = (
    rawLabel: string,
  ): { label: string; key: string; isExisting: boolean; popularity: number } => {
    const clean = normalizeTagDisplay(rawLabel);
    const key = toTagComparisonKey(clean);
    const direct = existingLabelByKey.get(key);
    if (direct) {
      return {
        label: direct.label,
        key,
        isExisting: true,
        popularity: direct.count,
      };
    }

    const siblings = getSemanticSiblingKeys(clean, sharedTags);
    for (const [exKey, info] of existingLabelByKey.entries()) {
      if (siblings.has(exKey)) {
        return {
          label: info.label,
          key: exKey,
          isExisting: true,
          popularity: info.count,
        };
      }
      if (info.aliases.some((a) => toTagComparisonKey(a) === key || siblings.has(toTagComparisonKey(a)))) {
        return {
          label: info.label,
          key: exKey,
          isExisting: true,
          popularity: info.count,
        };
      }
    }

    return {
      label: clean,
      key,
      isExisting: false,
      popularity: 0,
    };
  };

  const addScore = (
    rawLabel: string,
    delta: number,
    matchedTerm: string,
    minScore: number,
  ) => {
    const resolved = resolveExistingTarget(rawLabel);
    if (!resolved.key || currentKeys.has(resolved.key)) return;

    const existing = candidates.get(resolved.key);
    if (existing) {
      existing.score += delta;
      existing.minScore = Math.min(existing.minScore, minScore);
      if (matchedTerm) existing.matchedTerms.add(matchedTerm);
    } else {
      candidates.set(resolved.key, {
        label: resolved.label,
        key: resolved.key,
        score: delta,
        minScore,
        matchedTerms: new Set(matchedTerm ? [matchedTerm] : []),
        isExisting: resolved.isExisting,
        popularity: resolved.popularity,
      });
    }
  };

  // 1) Chấm điểm theo bộ quy tắc từ khóa domain SéaClover
  for (const rule of SEACLOVER_TAG_RULES) {
    const resolved = resolveExistingTarget(rule.label);
    const baseMin = rule.minScore ?? 2.6;
    // Tag mới chưa từng có trong hệ thống yêu cầu ngưỡng chặt hơn để hạn chế tạo tag mới
    const effectiveMin = resolved.isExisting ? baseMin : baseMin + 0.5;

    for (const kw of rule.strongKeywords) {
      const kwKey = toTagComparisonKey(kw);
      if (!kwKey) continue;
      const inTitle = matchPhraseCount(titleText, kwKey);
      const inDesc = matchPhraseCount(descText, kwKey);
      const inBody = matchPhraseCount(bodyText, kwKey);

      if (inTitle > 0) addScore(rule.label, 3.8, kw, effectiveMin);
      if (inDesc > 0) addScore(rule.label, 2.8, kw, effectiveMin);
      if (inBody > 0) {
        addScore(rule.label, Math.min(4.0, 2.2 + (inBody - 1) * 0.6), kw, effectiveMin);
      }
    }

    for (const kw of rule.supportingKeywords) {
      const kwKey = toTagComparisonKey(kw);
      if (!kwKey) continue;
      const inTitle = matchPhraseCount(titleText, kwKey);
      const inDesc = matchPhraseCount(descText, kwKey);
      const inBody = matchPhraseCount(bodyText, kwKey);

      if (inTitle > 0) addScore(rule.label, 2.0, kw, effectiveMin);
      if (inDesc > 0) addScore(rule.label, 1.4, kw, effectiveMin);
      if (inBody > 0) {
        addScore(rule.label, Math.min(2.6, 1.15 + (inBody - 1) * 0.35), kw, effectiveMin);
      }
    }
  }

  // 2) Chấm điểm trực tiếp cho các tag sẵn có trong catalog/sharedTags (bao gồm tag tùy chỉnh do Admin/User tạo)
  for (const [exKey, info] of existingLabelByKey.entries()) {
    if (currentKeys.has(exKey)) continue;
    const phrasesToCheck = new Set<string>([
      exKey,
      ...info.aliases.map((a) => toTagComparisonKey(a)).filter(Boolean),
    ]);
    for (const sk of getSemanticSiblingKeys(info.label, sharedTags)) {
      phrasesToCheck.add(sk);
    }

    for (const phrase of phrasesToCheck) {
      if (phrase.length < 3) continue;
      const inTitle = matchPhraseCount(titleText, phrase);
      const inDesc = matchPhraseCount(descText, phrase);
      const inBody = matchPhraseCount(bodyText, phrase);

      if (inTitle > 0) addScore(info.label, 3.6, info.label, 2.5);
      if (inDesc > 0) addScore(info.label, 2.6, info.label, 2.5);
      if (inBody > 0) addScore(info.label, Math.min(3.4, 2.0 + (inBody - 1) * 0.5), info.label, 2.5);
    }
  }

  // 3) Điều chỉnh nhẹ theo ngữ cảnh loại bài đăng
  if (params.targetType === 'note' || params.targetType === 'library_prompt') {
    const hasSlashCmd = /(?:^|\s)\/[a-zA-Z0-9_-]{2,}/m.test(params.content || '');
    if (hasSlashCmd) {
      addScore('Hệ thống', 1.4, '/command', 2.6);
    }
  }

  // 4) Lọc những tag thật sự đủ căn cứ + ưu tiên tái sử dụng tag hiện có
  const qualified = Array.from(candidates.values())
    .filter((c) => c.score >= c.minScore)
    .map((c) => ({
      ...c,
      rankScore: c.score + (c.isExisting ? 0.85 : 0) + Math.min(c.popularity, 40) * 0.015,
    }))
    .sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      return a.label.localeCompare(b.label, 'vi');
    });

  const picked = qualified.slice(0, maxTags);
  const suggestedTags = dedupeTags(picked.map((p) => p.label));
  const matchedExisting = picked.filter((p) => p.isExisting).map((p) => p.label);

  return {
    suggestedTags,
    matchedExisting,
    reasons: picked.map((p) => ({
      tag: p.label,
      matchedTerms: Array.from(p.matchedTerms).slice(0, 3),
      isExisting: p.isExisting,
    })),
    hasEnoughEvidence: suggestedTags.length > 0,
  };
}
