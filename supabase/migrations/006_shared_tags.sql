-- ============================================================================
-- SéaClover — Phase 6: Hệ thống Tag chung (Admin RBAC)
-- Migration: 006_shared_tags.sql
--
-- Nguyên tắc an toàn:
--   1. KHÔNG xóa, KHÔNG ghi đè hay làm mất bất kỳ dữ liệu cá nhân hiện có nào.
--   2. KHÔNG tự động công khai dữ liệu riêng tư cũ.
--   3. Giữ nguyên cơ chế version (OCC), xóa mềm (is_deleted) và sync Chrome/Edge.
--   4. Chỉ Admin mới có quyền thêm/sửa/đổi tên/gộp/xóa tag trong danh mục chung
--      và trên các nội dung Hệ thống; user thường không thể sửa tag của người khác.
--   5. Tự động gắn tag & nhập thông minh chạy hoàn toàn phía client, không dùng
--      API bên ngoài hay bảng hạn mức AI.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BẢNG DANH MỤC TAG CHUNG: public.shared_tags
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_tags (
  slug        text        PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  label       text        NOT NULL UNIQUE CHECK (char_length(btrim(label)) BETWEEN 1 AND 50),
  aliases     text[]      NOT NULL DEFAULT '{}',
  description text        NOT NULL DEFAULT '',
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shared_tags IS 'Danh mục tag chuẩn hóa dùng chung trên SéaClover; chỉ Admin được quản trị, mọi người đọc để gợi ý và đồng nhất tag.';

REVOKE ALL ON TABLE public.shared_tags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.shared_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.shared_tags TO authenticated;

ALTER TABLE public.shared_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_tags_select_all" ON public.shared_tags;
CREATE POLICY "shared_tags_select_all"
  ON public.shared_tags
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "shared_tags_admin_insert" ON public.shared_tags;
CREATE POLICY "shared_tags_admin_insert"
  ON public.shared_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "shared_tags_admin_update" ON public.shared_tags;
CREATE POLICY "shared_tags_admin_update"
  ON public.shared_tags
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "shared_tags_admin_delete" ON public.shared_tags;
CREATE POLICY "shared_tags_admin_delete"
  ON public.shared_tags
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Khởi tạo sẵn bộ tag chuẩn từ dữ liệu mặc định của SéaClover (IDEMPOTENT)
INSERT INTO public.shared_tags (slug, label, aliases, description)
VALUES
  ('chong-godmode', 'Chống Godmode', ARRAY['anti-godmode', 'chong quyen than', 'khong viet thay', 'tu do thoai'], 'Ngăn AI tự ý điều khiển hành động, suy nghĩ hay lời thoại của user'),
  ('ngan-chan-ooc', 'Sửa lỗi OOC', ARRAY['ooc', 'chinh don tinh cach', 'no ooc', 'sua loi'], 'Chỉnh đốn nhân vật bị lệch tính cách hoặc quên thiết lập gốc'),
  ('chong-lap-tu', 'Chống lặp từ', ARRAY['anti-repetition', 'diet tru lap tu', 'xao lai cau'], 'Giảm lặp cấu trúc câu, từ vựng và cải thiện diễn đạt'),
  ('bypass', 'Bypass', ARRAY['vuot rao', 'mo khoa', 'bo qua bo loc', 'filter bypass'], 'Mở khóa ngữ cảnh nhập vai sáng tạo khi bị chặn nhầm'),
  ('hud', 'HUD', ARRAY['bang chi so', 'trang thai', 'chi so', 'status'], 'Hiển thị bảng chỉ số, tâm trạng, trạng thái nhân vật'),
  ('he-thong', 'Hệ thống', ARRAY['system', 'system instruction', 'lenh he thong'], 'Câu lệnh hệ thống, chỉ thị định dạng hoặc quy tắc vận hành AI'),
  ('sao-luu', 'Sao lưu', ARRAY['bao luu', 'backup', 'tom tat', 'quet 100 turn'], 'Tổng hợp, sao lưu bối cảnh và chuyển tiếp hội thoại dài'),
  ('dong-bo', 'Đồng bộ', ARRAY['context sync', 'dong bo hoa', 'nap khoi phuc'], 'Đồng bộ hóa mạch truyện và khôi phục ngữ cảnh giữa các đoạn chat'),
  ('tu-dong', 'Tự động', ARRAY['auto play', 'ranh tay', 'lenh sieu toc', 'skiptime'], 'Tự động đẩy diễn biến hoặc chuyển cảnh nhanh'),
  ('nhip-do', 'Nhịp độ', ARRAY['pacing', 'slow burn', 'cam ke leo'], 'Kiểm soát tốc độ diễn biến và độ chậm rãi của hội thoại'),
  ('van-phong', 'Văn phong', ARRAY['ngu phap', 'da dang tu vung', 'viet van'], 'Cải thiện chất lượng miêu tả, từ vựng và nhịp câu'),
  ('cot-truyen', 'Cốt truyện', ARRAY['story', 'plot', 'dan truyen', 'thuc day cot truyen'], 'Lệnh thúc đẩy, phát triển hoặc mở rộng cốt truyện'),
  ('minigame', 'Minigame', ARRAY['tro choi', 'truth or dare', 'xoay chai', 'bad bed'], 'Trò chơi nhỏ tương tác cùng nhân vật'),
  ('mang-xa-hoi', 'Mạng xã hội', ARRAY['social', 'tiktok', 'weibo', 'dien dan', 'confession'], 'Mô phỏng mạng xã hội, diễn đàn, bình luận và tin hot'),
  ('dien-thoai', 'Điện thoại', ARRAY['voicemail', 'tin nhan', 'trinh duyet an danh'], 'Mô phỏng màn hình điện thoại, lịch sử tìm kiếm và tin nhắn'),
  ('tao-thoai', 'Tạo thoại', ARRAY['ghi am cuoc goi', 'tin nhan thoai', 'voicemail script'], 'Tạo đoạn ghi âm, tin nhắn thoại hoặc hội thoại gọi điện'),
  ('showbiz', 'Showbiz', ARRAY['minh tinh', 'paparazzi', 'scandal', 'idol'], 'Bối cảnh giới giải trí, người nổi tiếng và truyền thông'),
  ('hoc-duong', 'Học đường', ARRAY['truong hoc', 'sinh vien', 'giang duong', 'ky tuc xa'], 'Bối cảnh trường học, giảng đường, ký túc xá'),
  ('nhay-cam', 'Nhạy cảm', ARRAY['nsfw', '18+', 'r18', 'canh nong'], 'Nội dung thân mật, nhạy cảm hoặc 18+'),
  ('h-scene', 'H-Scene', ARRAY['lam tinh', 'kinks', 'fetishes', 'dirty talk'], 'Miêu tả chi tiết tình huống thân mật 18+'),
  ('bdsm', 'BDSM', ARRAY['troi', 'phuc tung', 'hinh phat', 'edging'], 'Chủ đề trói buộc, kiểm soát và phục tùng 18+'),
  ('tong-tai', 'Tổng tài', ARRAY['ceo', 'sep', 'cong so', 'chu tich', 'hao mon'], 'Bối cảnh tổng tài, sếp, hào môn và môi trường công sở'),
  ('mafia', 'Mafia', ARRAY['xa hoi den', 'ong trum', 'bang dang', 'the gioi ngam'], 'Bối cảnh xã hội đen, thế giới ngầm và hành động'),
  ('yandere', 'Yandere', ARRAY['am anh', 'dien tinh', 'benh kieu', 'giam cam'], 'Nhân vật yêu cực đoan, ám ảnh, bám dính'),
  ('chiem-huu', 'Chiếm hữu', ARRAY['doc chiem', 'possessive', 'chu quyen'], 'Tâm lý độc chiếm, bảo vệ và không muốn chia sẻ'),
  ('ghen-tuong', 'Ghen tuông', ARRAY['ghen', 'tinh dich', 'tra xanh'], 'Tình huống ghen tuông, dò xét và cạnh tranh tình cảm'),
  ('ngot-ngao', 'Ngọt ngào', ARRAY['ngot', 'sweet', 'nuong chieu', 'tinh cam', 'lang man'], 'Tình cảm dịu dàng, nuông chiều, lãng mạn'),
  ('quyen-ru', 'Quyến rũ', ARRAY['me hoac', 'tha thinh', 'tan tinh', 'goi cam'], 'Tương tác tán tỉnh, trêu ghẹo quyến rũ'),
  ('nguoc', 'Ngược', ARRAY['bi thuong', 'ton thuong', 'truy the', 'dan vat'], 'Tình huống day dứt, hiểu lầm, ngược tâm hoặc truy thê'),
  ('mau-cho', 'Máu chó', ARRAY['cau huyet', 'the than', 'mat tri nho'], 'Tình tiết drama dồn dập, thế thân hoặc hiểu lầm cực độ'),
  ('drama', 'Drama', ARRAY['kich tinh', 'twist', 'giong bao', 'bien co'], 'Tình huống kịch tính, cao trào hoặc giông bão'),
  ('hai-huoc', 'Hài hước', ARRAY['hai', 'funny', 'comedy', 'vui nhon'], 'Tình huống gây cười, vui nhộn, giải trí'),
  ('troll', 'Troll', ARRAY['treu choc', 'choc pha', 'bay', 'thu phan ung'], 'Kịch bản trêu chọc, bẫy hoặc thử phản ứng nhân vật'),
  ('doi-thuong', 'Đời thường', ARRAY['slice of life', 'sinh hoat', 'cham soc'], 'Hoạt động sinh hoạt hằng ngày, chăm sóc, thư giãn'),
  ('nau-an', 'Nấu ăn', ARRAY['gian bep', 'am thuc', 'lam banh', 'vao bep'], 'Kịch bản nấu nướng, gian bếp, đồ ăn'),
  ('suc-khoe', 'Sức khỏe', ARRAY['cham om', 'nhap vien', 'benh', 'kiet suc'], 'Tình huống ốm đau, chăm sóc sức khỏe, bệnh viện'),
  ('ngu-nghe', 'Ngủ nghê', ARRAY['mong du', 'om ngu', 'mat ngu', 'ngu chung'], 'Tình huống xoay quanh giấc ngủ, mộng du, nghỉ ngơi'),
  ('gian-doi', 'Giận dỗi', ARRAY['chien tranh lanh', 'hon doi', 'lam lanh'], 'Tình huống giận dỗi, chiến tranh lạnh và dỗ dành'),
  ('gia-dinh', 'Gia đình', ARRAY['phu huynh', 'bo me', 'nha chong', 'nha vo'], 'Tình huống gặp gỡ người thân, phụ huynh, con cái'),
  ('ket-hon', 'Kết hôn', ARRAY['dam cuoi', 'vo chong', 'cau hon', 'tan hon'], 'Tình huống cầu hôn, đám cưới và đời sống vợ chồng'),
  ('hen-ho', 'Hẹn hò', ARRAY['dating', 'to tinh', 'di choi'], 'Tình huống tỏ tình, hẹn hò, buổi đi chơi lãng mạn'),
  ('say-xin', 'Say xỉn', ARRAY['say ruou', 'giai ruou', 'quan bar'], 'Tình huống say rượu, giải rượu, quán bar'),
  ('thu-cung', 'Thú cưng', ARRAY['tai meo', 'duoi meo', 'thu nhan', 'nhan nuoi'], 'Kịch bản thú cưng, thú nhân hoặc nhận nuôi động vật'),
  ('cosplay', 'Cosplay', ARRAY['hoa trang', 'hau gai', 'tai tho', 'dong phuc'], 'Kịch bản hóa trang, thay trang phục theo chủ đề'),
  ('fantasy', 'Fantasy', ARRAY['phep thuat', 'gia tuong', 'di gioi', 'tu tien'], 'Thế giới giả tưởng, phép thuật, siêu nhiên'),
  ('co-dai', 'Cổ đại', ARRAY['co trang', 'cung dau', 'kiem hiep', 'hoang cung'], 'Bối cảnh cổ trang, cung đình, giang hồ'),
  ('hien-dai', 'Hiện đại', ARRAY['modern', 'do thi', 'van phong', 'chung cu'], 'Bối cảnh đời sống đô thị hiện đại'),
  ('tam-ly', 'Tâm lý', ARRAY['noi tam', 'doc thoai noi tam', 'inner monologue'], 'Khai thác chiều sâu tâm lý và độc thoại nội tâm')
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. HÀM QUẢN TRỊ TAG CHUNG DÀNH RIÊNG CHO ADMIN (SECURITY DEFINER)
--    Chỉ cập nhật danh mục shared_tags + các mục Hệ thống / mục của chính Admin,
--    TUYỆT ĐỐI KHÔNG động vào dữ liệu riêng tư hay công khai của user khác.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_upsert_shared_tag(
  p_slug        text,
  p_label       text,
  p_aliases     text[] DEFAULT '{}',
  p_description text   DEFAULT ''
)
RETURNS public.shared_tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  v_slug  text := regexp_replace(lower(btrim(COALESCE(p_slug, ''))), '[^a-z0-9-]+', '-', 'g');
  v_label text := regexp_replace(btrim(COALESCE(p_label, '')), '\s+', ' ', 'g');
  v_row   public.shared_tags;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ tài khoản Admin mới có quyền quản lý danh mục tag chung.'
      USING ERRCODE = '42501';
  END IF;

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  IF char_length(v_slug) < 1 OR char_length(v_slug) > 80 THEN
    RAISE EXCEPTION 'Mã slug của tag không hợp lệ (1-80 ký tự chữ thường/số/gạch ngang).'
      USING ERRCODE = '22023';
  END IF;

  IF char_length(v_label) < 1 OR char_length(v_label) > 50 THEN
    RAISE EXCEPTION 'Tên tag phải từ 1 đến 50 ký tự.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.shared_tags (slug, label, aliases, description, created_by, created_at, updated_at)
  VALUES (
    v_slug,
    v_label,
    COALESCE(p_aliases, '{}'),
    btrim(COALESCE(p_description, '')),
    v_uid,
    now(),
    now()
  )
  ON CONFLICT (slug) DO UPDATE
  SET
    label       = EXCLUDED.label,
    aliases     = EXCLUDED.aliases,
    description = EXCLUDED.description,
    updated_at  = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_shared_tag(text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_shared_tag(text, text, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_rename_shared_tag(
  p_old_label text,
  p_new_label text,
  p_new_slug  text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_old       text := regexp_replace(btrim(COALESCE(p_old_label, '')), '\s+', ' ', 'g');
  v_new       text := regexp_replace(btrim(COALESCE(p_new_label, '')), '\s+', ' ', 'g');
  v_old_lower text := lower(v_old);
  v_new_lower text := lower(v_new);
  v_slug      text;
  v_updated   integer := 0;
  v_cnt       integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ tài khoản Admin mới có quyền đổi tên tag chung.'
      USING ERRCODE = '42501';
  END IF;

  IF char_length(v_old) < 1 OR char_length(v_new) < 1 OR char_length(v_new) > 50 THEN
    RAISE EXCEPTION 'Tên tag cũ hoặc tên tag mới không hợp lệ.'
      USING ERRCODE = '22023';
  END IF;

  IF v_old = v_new THEN
    RETURN 0;
  END IF;

  -- 1) Cập nhật hoặc hợp nhất trong bảng public.shared_tags
  IF EXISTS (SELECT 1 FROM public.shared_tags WHERE lower(label) = v_new_lower AND lower(label) <> v_old_lower) THEN
    UPDATE public.shared_tags
    SET
      aliases = (
        SELECT ARRAY(
          SELECT DISTINCT a
          FROM unnest(COALESCE(aliases, '{}') || ARRAY[v_old]) AS a
          WHERE lower(btrim(a)) <> v_new_lower AND btrim(a) <> ''
        )
      ),
      updated_at = now()
    WHERE lower(label) = v_new_lower;

    DELETE FROM public.shared_tags
    WHERE lower(label) = v_old_lower;
  ELSIF EXISTS (SELECT 1 FROM public.shared_tags WHERE lower(label) = v_old_lower) THEN
    UPDATE public.shared_tags
    SET
      label = v_new,
      aliases = (
        SELECT ARRAY(
          SELECT DISTINCT a
          FROM unnest(COALESCE(aliases, '{}') || ARRAY[v_old]) AS a
          WHERE lower(btrim(a)) <> v_new_lower AND btrim(a) <> ''
        )
      ),
      updated_at = now()
    WHERE lower(label) = v_old_lower;
  ELSIF p_new_slug IS NOT NULL AND btrim(p_new_slug) <> '' THEN
    v_slug := regexp_replace(regexp_replace(lower(btrim(p_new_slug)), '[^a-z0-9-]+', '-', 'g'), '(^-+|-+$)', '', 'g');
    IF char_length(v_slug) BETWEEN 1 AND 80 THEN
      INSERT INTO public.shared_tags (slug, label, aliases, created_by)
      VALUES (v_slug, v_new, ARRAY[v_old], v_uid)
      ON CONFLICT (slug) DO UPDATE
      SET
        label = EXCLUDED.label,
        aliases = (
          SELECT ARRAY(
            SELECT DISTINCT a
            FROM unnest(COALESCE(public.shared_tags.aliases, '{}') || ARRAY[v_old]) AS a
            WHERE lower(btrim(a)) <> v_new_lower AND btrim(a) <> ''
          )
        ),
        updated_at = now();
    END IF;
  END IF;

  -- 2) Cập nhật tag trên bảng user_library_prompts (CHỈ mục Hệ thống hoặc do chính Admin sở hữu)
  UPDATE public.user_library_prompts
  SET tags = COALESCE((
    SELECT jsonb_agg(elem ORDER BY first_pos)
    FROM (
      SELECT
        CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END AS elem,
        MIN(ord) AS first_pos
      FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) WITH ORDINALITY AS x(t, ord)
      WHERE btrim(t) <> ''
      GROUP BY CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END
    ) AS dedup
  ), '[]'::jsonb)
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS t
      WHERE lower(btrim(t)) = v_old_lower
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 3) Cập nhật tag trên bảng user_ideas (CHỈ mục Hệ thống hoặc do chính Admin sở hữu)
  UPDATE public.user_ideas
  SET tags = COALESCE((
    SELECT ARRAY(
      SELECT elem
      FROM (
        SELECT
          CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END AS elem,
          MIN(ord) AS first_pos
        FROM unnest(COALESCE(tags, '{}')) WITH ORDINALITY AS x(t, ord)
        WHERE btrim(t) <> ''
        GROUP BY CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END
        ORDER BY first_pos
      ) AS dedup
    )
  ), '{}')
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1 FROM unnest(COALESCE(tags, '{}')) AS t WHERE lower(btrim(t)) = v_old_lower
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 4) Cập nhật role tag trên user_characters (CHỈ mục Hệ thống hoặc do chính Admin sở hữu)
  UPDATE public.user_characters
  SET role = COALESCE((
    SELECT string_agg(elem, ' / ' ORDER BY first_pos)
    FROM (
      SELECT
        CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END AS elem,
        MIN(ord) AS first_pos
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,]\s*') WITH ORDINALITY AS x(t, ord)
      WHERE btrim(t) <> ''
      GROUP BY CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END
    ) AS dedup
  ), role)
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,]\s*') AS t
      WHERE lower(btrim(t)) = v_old_lower
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_rename_shared_tag(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rename_shared_tag(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_merge_shared_tags(
  p_source_labels text[],
  p_target_label  text,
  p_target_slug   text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  v_src   text;
  v_total integer := 0;
  v_step  integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ tài khoản Admin mới có quyền gộp tag chung.'
      USING ERRCODE = '42501';
  END IF;

  IF p_source_labels IS NULL OR array_length(p_source_labels, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_src IN ARRAY p_source_labels LOOP
    IF lower(btrim(COALESCE(v_src, ''))) <> '' AND lower(btrim(v_src)) <> lower(btrim(p_target_label)) THEN
      v_step := public.admin_rename_shared_tag(v_src, p_target_label, p_target_slug);
      v_total := v_total + v_step;
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_merge_shared_tags(text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_merge_shared_tags(text[], text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_shared_tag(
  p_label text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_target    text := lower(regexp_replace(btrim(COALESCE(p_label, '')), '\s+', ' ', 'g'));
  v_updated   integer := 0;
  v_cnt       integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ tài khoản Admin mới có quyền xóa tag chung.'
      USING ERRCODE = '42501';
  END IF;

  IF v_target = '' THEN
    RETURN 0;
  END IF;

  DELETE FROM public.shared_tags
  WHERE lower(btrim(label)) = v_target;

  -- Gỡ tag khỏi mục Hệ thống hoặc mục do chính Admin sở hữu (không chạm vào bài của user khác)
  UPDATE public.user_library_prompts
  SET tags = COALESCE((
    SELECT jsonb_agg(btrim(t) ORDER BY ord)
    FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) WITH ORDINALITY AS x(t, ord)
    WHERE btrim(t) <> '' AND lower(btrim(t)) <> v_target
  ), '[]'::jsonb)
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS t
      WHERE lower(btrim(t)) = v_target
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  UPDATE public.user_ideas
  SET tags = COALESCE((
    SELECT ARRAY(
      SELECT btrim(t)
      FROM unnest(COALESCE(tags, '{}')) WITH ORDINALITY AS x(t, ord)
      WHERE btrim(t) <> '' AND lower(btrim(t)) <> v_target
      ORDER BY ord
    )
  ), '{}')
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1 FROM unnest(COALESCE(tags, '{}')) AS t
      WHERE lower(btrim(t)) = v_target
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  UPDATE public.user_characters
  SET role = COALESCE((
    SELECT string_agg(btrim(t), ' / ' ORDER BY ord)
    FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,]\s*') WITH ORDINALITY AS x(t, ord)
    WHERE btrim(t) <> '' AND lower(btrim(t)) <> v_target
  ), '')
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,]\s*') AS t
      WHERE lower(btrim(t)) = v_target
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_shared_tag(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_shared_tag(text) TO authenticated;
