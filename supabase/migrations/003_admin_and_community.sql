-- ============================================================================
-- SéaClover — Phase 3: Admin RBAC, Public/Private Visibility & Community
-- Migration: 003_admin_and_community.sql
--
-- Nguyên tắc bảo vệ dữ liệu & bảo mật:
--   1. KHÔNG xóa, KHÔNG tạo lại bảng cũ và KHÔNG ghi đè dữ liệu hiện có.
--   2. Toàn bộ dữ liệu cá nhân hiện có tự động nhận is_public = false, is_system = false.
--   3. Dọn sạch toàn bộ RLS policy cũ trên 4 bảng dữ liệu trước khi tạo bộ policy mới,
--      loại bỏ nguy cơ sót policy cũ gây lộ dữ liệu riêng tư.
--   4. Bảo vệ toàn diện các trường kiểm duyệt bình luận ở cả INSERT lẫn UPDATE.
--   5. Chỉ cho phép đánh giá/thả tim nội dung mặc định có thật trong bảng danh mục
--      public.builtin_content_registry (từ chối mọi ID tùy ý).
--   6. Giữ nguyên hoàn toàn cơ chế version (OCC) và xóa mềm (is_deleted) hiện tại.
--   7. Khóa quyền sở hữu & tính hợp lệ của mục tiêu khi cập nhật đánh giá.
--   8. KHÔNG tự cấp quyền Admin trong migration này.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HÀM KIỂM TRA QUYỀN ADMIN & SIẾT CHẶT QUYỀN BẢNG public.profiles
-- ----------------------------------------------------------------------------

-- Đảm bảo anon tuyệt đối không có quyền đọc/ghi bảng public.profiles (chứa email)
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. BẢNG HỒ SƠ HIỂN THỊ CÔNG KHAI (KHÔNG CHỨA EMAIL / BIO RIÊNG TƯ)
--    Tự động đồng bộ từ public.profiles để hiển thị tên tác giả & huy hiệu Admin
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text        NOT NULL DEFAULT '',
  avatar_url   text,
  role         text        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.public_profiles IS 'Thông tin tác giả công khai (không chứa email), tự động đồng bộ từ public.profiles.';

REVOKE ALL ON TABLE public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_profiles_select_all" ON public.public_profiles;
CREATE POLICY "public_profiles_select_all"
  ON public.public_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.sync_public_profile_from_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.public_profiles (id, display_name, avatar_url, role, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.display_name), ''), 'Thành viên SéaClover'),
    NEW.avatar_url,
    NEW.role,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    avatar_url   = EXCLUDED.avatar_url,
    role         = EXCLUDED.role,
    updated_at   = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_profile_from_profiles() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_profiles_sync_public ON public.profiles;
CREATE TRIGGER on_profiles_sync_public
  AFTER INSERT OR UPDATE OF display_name, avatar_url, role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_public_profile_from_profiles();

-- Đồng bộ 1 lần các hồ sơ đã có sẵn sang public_profiles (không đụng dữ liệu gốc)
INSERT INTO public.public_profiles (id, display_name, avatar_url, role, updated_at)
SELECT
  p.id,
  COALESCE(NULLIF(btrim(p.display_name), ''), 'Thành viên SéaClover'),
  p.avatar_url,
  p.role,
  COALESCE(p.updated_at, now())
FROM public.profiles AS p
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  avatar_url   = EXCLUDED.avatar_url,
  role         = EXCLUDED.role,
  updated_at   = EXCLUDED.updated_at;

-- ----------------------------------------------------------------------------
-- 3. DANH MỤC NỘI DUNG MẶC ĐỊNH HỢP LỆ: public.builtin_content_registry
--    Chỉ cho phép đánh giá / thả tim các ID mặc định thực sự tồn tại trong app
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.builtin_content_registry (
  target_type text NOT NULL CHECK (target_type IN ('library_prompt', 'idea')),
  item_id     text NOT NULL CHECK (char_length(btrim(item_id)) BETWEEN 1 AND 200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, item_id)
);

COMMENT ON TABLE public.builtin_content_registry IS 'Danh sách chính xác các mã nội dung mặc định hợp lệ được phép tương tác cộng đồng.';

REVOKE ALL ON TABLE public.builtin_content_registry FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.builtin_content_registry TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.builtin_content_registry TO authenticated;

ALTER TABLE public.builtin_content_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "builtin_registry_select_all" ON public.builtin_content_registry;
CREATE POLICY "builtin_registry_select_all"
  ON public.builtin_content_registry FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "builtin_registry_admin_write" ON public.builtin_content_registry;
CREATE POLICY "builtin_registry_admin_write"
  ON public.builtin_content_registry FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Khởi tạo danh sách chính xác các ID mặc định hiện có:
--   - defaultLibraryPrompts: lib-1 .. lib-22
--   - roleplayIdeas (initialIdeas): rp-1 .. rp-160
INSERT INTO public.builtin_content_registry (target_type, item_id)
SELECT 'library_prompt', 'lib-' || g::text
FROM generate_series(1, 22) AS g
ON CONFLICT (target_type, item_id) DO NOTHING;

INSERT INTO public.builtin_content_registry (target_type, item_id)
SELECT 'idea', 'rp-' || g::text
FROM generate_series(1, 160) AS g
ON CONFLICT (target_type, item_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. MỞ RỘNG KHÔNG PHÁ VỠ 4 BẢNG DỮ LIỆU HIỆN CÓ
--    Mặc định: is_public = false (riêng tư), is_system = false (cá nhân)
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_characters
  ADD COLUMN IF NOT EXISTS is_public    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_system    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.user_notes
  ADD COLUMN IF NOT EXISTS is_public    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_system    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.user_ideas
  ADD COLUMN IF NOT EXISTS is_public    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_system    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.user_library_prompts
  ADD COLUMN IF NOT EXISTS is_public    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_system    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Chỉ mục tăng tốc truy vấn nội dung hệ thống & cộng đồng công khai
CREATE INDEX IF NOT EXISTS idx_user_characters_public_system
  ON public.user_characters (is_system, is_public, is_deleted, published_at DESC)
  WHERE is_deleted = false AND (is_system = true OR is_public = true);

CREATE INDEX IF NOT EXISTS idx_user_notes_public_system
  ON public.user_notes (is_system, is_public, is_deleted, published_at DESC)
  WHERE is_deleted = false AND (is_system = true OR is_public = true);

CREATE INDEX IF NOT EXISTS idx_user_ideas_public_system
  ON public.user_ideas (is_system, is_public, is_deleted, published_at DESC)
  WHERE is_deleted = false AND (is_system = true OR is_public = true);

CREATE INDEX IF NOT EXISTS idx_user_library_prompts_public_system
  ON public.user_library_prompts (is_system, is_public, is_deleted, published_at DESC)
  WHERE is_deleted = false AND (is_system = true OR is_public = true);

-- Cập nhật Trigger bảo vệ is_system, giữ nguyên cơ chế version (OCC) & xóa mềm (is_deleted)
CREATE OR REPLACE FUNCTION public.handle_user_data_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF COALESCE(NEW.is_system, false) = true AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Chỉ tài khoản Admin mới được phép tạo nội dung hệ thống.'
        USING ERRCODE = '42501';
    END IF;

    -- Giữ nguyên cơ chế khởi tạo version = 1 và mốc thời gian máy chủ như migration 002
    NEW.version := 1;
    NEW.created_at := now();
    NEW.updated_at := now();
  END IF;

  -- Mục đã xóa mềm (soft-delete) tuyệt đối không được công khai
  IF COALESCE(NEW.is_deleted, false) = true THEN
    NEW.is_public := false;
    IF NOT public.is_admin() THEN
      NEW.is_system := false;
    END IF;
  ELSIF COALESCE(NEW.is_system, false) = true THEN
    NEW.is_public := true;
  END IF;

  IF COALESCE(NEW.is_deleted, false) = false
     AND (COALESCE(NEW.is_public, false) = true OR COALESCE(NEW.is_system, false) = true)
     AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  IF NEW.item_created_at IS NULL THEN
    NEW.item_created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_data_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Không được phép thay đổi chủ sở hữu dữ liệu (user_id).'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.item_id IS DISTINCT FROM OLD.item_id THEN
      RAISE EXCEPTION 'Không được phép thay đổi mã định danh mục (item_id).'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Không được phép thay đổi thời điểm tạo bản ghi hệ thống (created_at).'
        USING ERRCODE = '42501';
    END IF;

    IF (COALESCE(OLD.is_system, false) = true OR COALESCE(NEW.is_system, false) = true)
       AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Chỉ tài khoản Admin mới được phép chỉnh sửa nội dung hệ thống.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Nếu xóa mềm bản ghi -> tự động tắt công khai, không làm ảnh hưởng is_deleted
  IF COALESCE(NEW.is_deleted, false) = true THEN
    NEW.is_public := false;
  ELSIF COALESCE(NEW.is_system, false) = true THEN
    NEW.is_public := true;
  END IF;

  -- Quản lý published_at ổn định khi bật/tắt Công khai (không làm mất mốc đăng ban đầu)
  IF COALESCE(NEW.is_deleted, false) = false
     AND (COALESCE(NEW.is_public, false) = true OR COALESCE(NEW.is_system, false) = true) THEN
    IF OLD.published_at IS NULL THEN
      NEW.published_at := now();
    ELSE
      NEW.published_at := OLD.published_at;
    END IF;
  ELSE
    NEW.published_at := OLD.published_at;
  END IF;

  -- Giữ nguyên quy tắc tăng version (OCC) & updated_at như migration 002
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Đặt lại quyền tối thiểu (Least Privilege) trên cả 4 bảng:
-- anon CHỈ có SELECT (qua RLS chỉ thấy công khai/hệ thống chưa xóa mềm)
REVOKE ALL ON TABLE public.user_characters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_ideas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_library_prompts FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.user_characters TO anon;
GRANT SELECT ON TABLE public.user_notes TO anon;
GRANT SELECT ON TABLE public.user_ideas TO anon;
GRANT SELECT ON TABLE public.user_library_prompts TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_characters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_ideas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_library_prompts TO authenticated;

ALTER TABLE public.user_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library_prompts ENABLE ROW LEVEL SECURITY;

-- Dọn sạch TẤT CẢ chính sách RLS cũ trên 4 bảng dữ liệu để đảm bảo không sót
-- bất kỳ policy cũ/thử nghiệm nào có thể gây lộ dữ liệu riêng tư
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_characters',
        'user_notes',
        'user_ideas',
        'user_library_prompts'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I;',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END;
$$;

-- [4.1] Policies cho public.user_characters
CREATE POLICY "user_characters_select_public_anon"
  ON public.user_characters FOR SELECT
  TO anon
  USING (is_deleted = false AND (is_system = true OR is_public = true));

CREATE POLICY "user_characters_select_auth"
  ON public.user_characters FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (is_deleted = false AND (is_system = true OR is_public = true))
  );

CREATE POLICY "user_characters_insert_own"
  ON public.user_characters FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (is_system = false OR public.is_admin())
  );

CREATE POLICY "user_characters_update_own"
  ON public.user_characters FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_system = false)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (is_system = false OR public.is_admin())
  );

CREATE POLICY "user_characters_update_admin_system"
  ON public.user_characters FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND is_system = true)
  WITH CHECK (public.is_admin() AND is_system = true);

CREATE POLICY "user_characters_delete_own"
  ON public.user_characters FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_system = false);

CREATE POLICY "user_characters_delete_admin_system"
  ON public.user_characters FOR DELETE
  TO authenticated
  USING (public.is_admin() AND is_system = true);

-- [4.2] Policies cho public.user_notes
CREATE POLICY "user_notes_select_public_anon"
  ON public.user_notes FOR SELECT
  TO anon
  USING (is_deleted = false AND (is_system = true OR is_public = true));

CREATE POLICY "user_notes_select_auth"
  ON public.user_notes FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (is_deleted = false AND (is_system = true OR is_public = true))
  );

CREATE POLICY "user_notes_insert_own"
  ON public.user_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (is_system = false OR public.is_admin())
  );

CREATE POLICY "user_notes_update_own"
  ON public.user_notes FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_system = false)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (is_system = false OR public.is_admin())
  );

CREATE POLICY "user_notes_update_admin_system"
  ON public.user_notes FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND is_system = true)
  WITH CHECK (public.is_admin() AND is_system = true);

CREATE POLICY "user_notes_delete_own"
  ON public.user_notes FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_system = false);

CREATE POLICY "user_notes_delete_admin_system"
  ON public.user_notes FOR DELETE
  TO authenticated
  USING (public.is_admin() AND is_system = true);

-- [4.3] Policies cho public.user_ideas
CREATE POLICY "user_ideas_select_public_anon"
  ON public.user_ideas FOR SELECT
  TO anon
  USING (is_deleted = false AND (is_system = true OR is_public = true));

CREATE POLICY "user_ideas_select_auth"
  ON public.user_ideas FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (is_deleted = false AND (is_system = true OR is_public = true))
  );

CREATE POLICY "user_ideas_insert_own"
  ON public.user_ideas FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (is_system = false OR public.is_admin())
  );

CREATE POLICY "user_ideas_update_own"
  ON public.user_ideas FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_system = false)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (is_system = false OR public.is_admin())
  );

CREATE POLICY "user_ideas_update_admin_system"
  ON public.user_ideas FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND is_system = true)
  WITH CHECK (public.is_admin() AND is_system = true);

CREATE POLICY "user_ideas_delete_own"
  ON public.user_ideas FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_system = false);

CREATE POLICY "user_ideas_delete_admin_system"
  ON public.user_ideas FOR DELETE
  TO authenticated
  USING (public.is_admin() AND is_system = true);

-- [4.4] Policies cho public.user_library_prompts
CREATE POLICY "user_library_prompts_select_public_anon"
  ON public.user_library_prompts FOR SELECT
  TO anon
  USING (is_deleted = false AND (is_system = true OR is_public = true));

CREATE POLICY "user_library_prompts_select_auth"
  ON public.user_library_prompts FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (is_deleted = false AND (is_system = true OR is_public = true))
  );

CREATE POLICY "user_library_prompts_insert_own"
  ON public.user_library_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (is_system = false OR public.is_admin())
  );

CREATE POLICY "user_library_prompts_update_own"
  ON public.user_library_prompts FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_system = false)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (is_system = false OR public.is_admin())
  );

CREATE POLICY "user_library_prompts_update_admin_system"
  ON public.user_library_prompts FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND is_system = true)
  WITH CHECK (public.is_admin() AND is_system = true);

CREATE POLICY "user_library_prompts_delete_own"
  ON public.user_library_prompts FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_system = false);

CREATE POLICY "user_library_prompts_delete_admin_system"
  ON public.user_library_prompts FOR DELETE
  TO authenticated
  USING (public.is_admin() AND is_system = true);

-- ----------------------------------------------------------------------------
-- 5. BẢNG THÔNG BÁO HỆ THỐNG: public.system_announcements (CHỈ ADMIN QUẢN LÝ)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.system_announcements (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  content    text        NOT NULL,
  tone       text        NOT NULL DEFAULT 'info',
  is_pinned  boolean     NOT NULL DEFAULT false,
  is_active  boolean     NOT NULL DEFAULT true,
  author_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT system_announcements_title_valid CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT system_announcements_content_valid CHECK (char_length(btrim(content)) BETWEEN 1 AND 3000),
  CONSTRAINT system_announcements_tone_valid CHECK (tone IN ('info', 'update', 'important'))
);

CREATE INDEX IF NOT EXISTS idx_system_announcements_active_order
  ON public.system_announcements (is_active, is_pinned DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_system_announcements_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Chỉ tài khoản Admin mới được phép tạo thông báo hệ thống.'
        USING ERRCODE = '42501';
    END IF;
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSE
    IF current_user IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Chỉ tài khoản Admin mới được phép sửa thông báo hệ thống.'
        USING ERRCODE = '42501';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.author_id := OLD.author_id;
    NEW.updated_at := now();
  END IF;
  NEW.title := btrim(NEW.title);
  NEW.content := btrim(NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_system_announcements_before_write ON public.system_announcements;
CREATE TRIGGER on_system_announcements_before_write
  BEFORE INSERT OR UPDATE ON public.system_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_announcements_before_write();

REVOKE ALL ON TABLE public.system_announcements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.system_announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.system_announcements TO authenticated;

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select_active_all" ON public.system_announcements;
CREATE POLICY "announcements_select_active_all"
  ON public.system_announcements FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "announcements_insert_admin" ON public.system_announcements;
CREATE POLICY "announcements_insert_admin"
  ON public.system_announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND (SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "announcements_update_admin" ON public.system_announcements;
CREATE POLICY "announcements_update_admin"
  ON public.system_announcements FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "announcements_delete_admin" ON public.system_announcements;
CREATE POLICY "announcements_delete_admin"
  ON public.system_announcements FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. HÀM XÁC THỰC MỤC TIÊU TƯƠNG TÁC CÔNG KHAI (CHẶN TUYỆT ĐỐI ID TÙY Ý)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_interact_with_content(
  p_target_type text,
  p_target_owner_id uuid,
  p_target_item_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_target_owner_id IS NULL THEN
      -- Chỉ chấp nhận đúng các ID mặc định đã đăng ký trong builtin_content_registry
      EXISTS (
        SELECT 1
        FROM public.builtin_content_registry b
        WHERE b.target_type = p_target_type
          AND b.item_id = p_target_item_id
      )
    WHEN p_target_type = 'character' THEN
      EXISTS (
        SELECT 1 FROM public.user_characters c
        WHERE c.user_id = p_target_owner_id
          AND c.item_id = p_target_item_id
          AND c.is_deleted = false
          AND (c.is_system = true OR c.is_public = true)
      )
    WHEN p_target_type = 'note' THEN
      EXISTS (
        SELECT 1 FROM public.user_notes n
        WHERE n.user_id = p_target_owner_id
          AND n.item_id = p_target_item_id
          AND n.is_deleted = false
          AND (n.is_system = true OR n.is_public = true)
      )
    WHEN p_target_type = 'idea' THEN
      EXISTS (
        SELECT 1 FROM public.user_ideas i
        WHERE i.user_id = p_target_owner_id
          AND i.item_id = p_target_item_id
          AND i.is_deleted = false
          AND (i.is_system = true OR i.is_public = true)
      )
    WHEN p_target_type = 'library_prompt' THEN
      EXISTS (
        SELECT 1 FROM public.user_library_prompts lp
        WHERE lp.user_id = p_target_owner_id
          AND lp.item_id = p_target_item_id
          AND lp.is_deleted = false
          AND (lp.is_system = true OR lp.is_public = true)
      )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.can_interact_with_content(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_interact_with_content(text, uuid, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. BẢNG BÌNH LUẬN NHÂN VẬT: public.character_comments
--    Bảo vệ đầy đủ trường kiểm duyệt ở cả INSERT và UPDATE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.character_comments (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_owner_id uuid        NOT NULL,
  character_item_id  text        NOT NULL,
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content            text        NOT NULL,
  is_hidden          boolean     NOT NULL DEFAULT false,
  hidden_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  hidden_at          timestamptz,
  hidden_reason      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT character_comments_target_fk
    FOREIGN KEY (character_owner_id, character_item_id)
    REFERENCES public.user_characters (user_id, item_id)
    ON DELETE CASCADE,
  CONSTRAINT character_comments_content_valid CHECK (char_length(btrim(content)) BETWEEN 1 AND 1500),
  CONSTRAINT character_comments_hidden_reason_valid CHECK (hidden_reason IS NULL OR char_length(hidden_reason) <= 300),
  CONSTRAINT character_comments_moderation_consistent CHECK (
    (is_hidden = false AND hidden_by IS NULL AND hidden_at IS NULL AND hidden_reason IS NULL)
    OR (is_hidden = true)
  )
);

CREATE INDEX IF NOT EXISTS idx_character_comments_target
  ON public.character_comments (character_owner_id, character_item_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_character_comments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    -- Chặn hoàn toàn việc gửi sẵn các trường kiểm duyệt khi tạo bình luận mới
    IF COALESCE(NEW.is_hidden, false) = true
       OR NEW.hidden_by IS NOT NULL
       OR NEW.hidden_at IS NOT NULL
       OR NEW.hidden_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Không được phép thiết lập trạng thái kiểm duyệt khi tạo bình luận mới.'
        USING ERRCODE = '42501';
    END IF;

    NEW.is_hidden := false;
    NEW.hidden_by := NULL;
    NEW.hidden_at := NULL;
    NEW.hidden_reason := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
  END IF;

  NEW.content := btrim(NEW.content);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_character_comments_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean;
  v_uid uuid;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    v_is_admin := public.is_admin();
    v_uid := (SELECT auth.uid());

    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.character_owner_id IS DISTINCT FROM OLD.character_owner_id
       OR NEW.character_item_id IS DISTINCT FROM OLD.character_item_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Không được phép thay đổi thông tin định danh bình luận.'
        USING ERRCODE = '42501';
    END IF;

    -- Tài khoản thường chỉ sửa nội dung bình luận chưa bị ẩn; không được chạm các trường kiểm duyệt
    IF NOT v_is_admin THEN
      IF NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
         OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by
         OR NEW.hidden_at IS DISTINCT FROM OLD.hidden_at
         OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason THEN
        RAISE EXCEPTION 'Chỉ Admin mới được phép ẩn hoặc hiện bình luận.'
          USING ERRCODE = '42501';
      END IF;

      IF OLD.is_hidden = true THEN
        RAISE EXCEPTION 'Bình luận đang bị ẩn kiểm duyệt, không thể chỉnh sửa nội dung.'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      -- Admin kiểm duyệt bình luận của người khác: không được tự sửa nội dung chữ gốc
      IF v_uid IS DISTINCT FROM OLD.user_id AND NEW.content IS DISTINCT FROM OLD.content THEN
        RAISE EXCEPTION 'Admin chỉ được ẩn hoặc xóa bình luận vi phạm, không chỉnh sửa nội dung gốc.'
          USING ERRCODE = '42501';
      END IF;

      -- Luôn gắn chính xác thông tin người kiểm duyệt từ auth.uid(), không cho giả mạo
      IF NEW.is_hidden = true THEN
        IF OLD.is_hidden = false THEN
          NEW.hidden_by := v_uid;
          NEW.hidden_at := now();
        ELSE
          NEW.hidden_by := COALESCE(OLD.hidden_by, v_uid);
          NEW.hidden_at := COALESCE(OLD.hidden_at, now());
        END IF;
      ELSE
        NEW.hidden_by := NULL;
        NEW.hidden_at := NULL;
        NEW.hidden_reason := NULL;
      END IF;
    END IF;
  END IF;

  NEW.content := btrim(NEW.content);
  NEW.hidden_reason := nullif(btrim(coalesce(NEW.hidden_reason, '')), '');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_character_comments_before_insert ON public.character_comments;
CREATE TRIGGER on_character_comments_before_insert
  BEFORE INSERT ON public.character_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_character_comments_before_insert();

DROP TRIGGER IF EXISTS on_character_comments_before_update ON public.character_comments;
CREATE TRIGGER on_character_comments_before_update
  BEFORE UPDATE ON public.character_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_character_comments_before_update();

REVOKE ALL ON TABLE public.character_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.character_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.character_comments TO authenticated;

ALTER TABLE public.character_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "character_comments_select_visible" ON public.character_comments;
CREATE POLICY "character_comments_select_visible"
  ON public.character_comments FOR SELECT
  TO anon, authenticated
  USING (
    public.can_interact_with_content('character', character_owner_id, character_item_id)
    AND (
      is_hidden = false
      OR public.is_admin()
      OR (SELECT auth.uid()) = user_id
    )
  );

DROP POLICY IF EXISTS "character_comments_insert_auth" ON public.character_comments;
CREATE POLICY "character_comments_insert_auth"
  ON public.character_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND is_hidden = false
    AND hidden_by IS NULL
    AND hidden_at IS NULL
    AND hidden_reason IS NULL
    AND public.can_interact_with_content('character', character_owner_id, character_item_id)
  );

DROP POLICY IF EXISTS "character_comments_update_owner_or_admin" ON public.character_comments;
CREATE POLICY "character_comments_update_owner_or_admin"
  ON public.character_comments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      (SELECT auth.uid()) = user_id
      AND is_hidden = false
      AND public.can_interact_with_content('character', character_owner_id, character_item_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      (SELECT auth.uid()) = user_id
      AND is_hidden = false
      AND hidden_by IS NULL
      AND hidden_at IS NULL
      AND hidden_reason IS NULL
      AND public.can_interact_with_content('character', character_owner_id, character_item_id)
    )
  );

DROP POLICY IF EXISTS "character_comments_delete_owner_or_admin" ON public.character_comments;
CREATE POLICY "character_comments_delete_owner_or_admin"
  ON public.character_comments FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. BẢNG ĐÁNH GIÁ HIỆU QUẢ CÂU LỆNH: public.prompt_ratings
--    Khóa chặt quyền sở hữu và mục tiêu khi cập nhật đánh giá
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.prompt_ratings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     text        NOT NULL CHECK (target_type IN ('library_prompt', 'note')),
  target_scope    text        NOT NULL,
  target_owner_id uuid,
  target_item_id  text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score           smallint    NOT NULL CHECK (score BETWEEN 1 AND 5),
  review          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT prompt_ratings_scope_consistent CHECK (
    (target_owner_id IS NULL AND target_scope = 'builtin')
    OR (target_owner_id IS NOT NULL AND target_scope = target_owner_id::text)
  ),
  CONSTRAINT prompt_ratings_item_id_valid CHECK (char_length(btrim(target_item_id)) BETWEEN 1 AND 200),
  CONSTRAINT prompt_ratings_review_valid CHECK (review IS NULL OR char_length(review) <= 500),
  CONSTRAINT prompt_ratings_unique_user UNIQUE (target_type, target_scope, target_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_ratings_target
  ON public.prompt_ratings (target_type, target_scope, target_item_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.handle_prompt_ratings_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('anon', 'authenticated') THEN
      IF NEW.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'Không được phép tạo đánh giá thay cho tài khoản khác.'
          USING ERRCODE = '42501';
      END IF;
      IF NOT public.can_interact_with_content(NEW.target_type, NEW.target_owner_id, NEW.target_item_id) THEN
        RAISE EXCEPTION 'Câu lệnh này không tồn tại hoặc không còn ở trạng thái công khai.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    NEW.created_at := now();
  ELSE
    IF current_user IN ('anon', 'authenticated') THEN
      IF OLD.user_id IS DISTINCT FROM (SELECT auth.uid()) OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Bạn chỉ được phép cập nhật đánh giá của chính mình.'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.target_type IS DISTINCT FROM OLD.target_type
         OR NEW.target_scope IS DISTINCT FROM OLD.target_scope
         OR NEW.target_owner_id IS DISTINCT FROM OLD.target_owner_id
         OR NEW.target_item_id IS DISTINCT FROM OLD.target_item_id
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Không được phép thay đổi mục tiêu hoặc thông tin định danh của đánh giá.'
          USING ERRCODE = '42501';
      END IF;
      IF NOT public.can_interact_with_content(OLD.target_type, OLD.target_owner_id, OLD.target_item_id) THEN
        RAISE EXCEPTION 'Câu lệnh này không tồn tại hoặc không còn ở trạng thái công khai.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.user_id := OLD.user_id;
  END IF;

  NEW.review := nullif(btrim(coalesce(NEW.review, '')), '');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_prompt_ratings_before_write ON public.prompt_ratings;
CREATE TRIGGER on_prompt_ratings_before_write
  BEFORE INSERT OR UPDATE ON public.prompt_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_prompt_ratings_before_write();

REVOKE ALL ON TABLE public.prompt_ratings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.prompt_ratings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.prompt_ratings TO authenticated;

ALTER TABLE public.prompt_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_ratings_select_all" ON public.prompt_ratings;
CREATE POLICY "prompt_ratings_select_all"
  ON public.prompt_ratings FOR SELECT
  TO anon, authenticated
  USING (public.can_interact_with_content(target_type, target_owner_id, target_item_id));

DROP POLICY IF EXISTS "prompt_ratings_insert_own" ON public.prompt_ratings;
CREATE POLICY "prompt_ratings_insert_own"
  ON public.prompt_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.can_interact_with_content(target_type, target_owner_id, target_item_id)
  );

DROP POLICY IF EXISTS "prompt_ratings_update_own" ON public.prompt_ratings;
CREATE POLICY "prompt_ratings_update_own"
  ON public.prompt_ratings FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND public.can_interact_with_content(target_type, target_owner_id, target_item_id)
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.can_interact_with_content(target_type, target_owner_id, target_item_id)
  );

DROP POLICY IF EXISTS "prompt_ratings_delete_own_or_admin" ON public.prompt_ratings;
CREATE POLICY "prompt_ratings_delete_own_or_admin"
  ON public.prompt_ratings FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. BẢNG THẢ TIM & TƯƠNG TÁC: public.content_likes
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_likes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     text        NOT NULL CHECK (target_type IN ('character', 'note', 'idea', 'library_prompt')),
  target_scope    text        NOT NULL,
  target_owner_id uuid,
  target_item_id  text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT content_likes_scope_consistent CHECK (
    (target_owner_id IS NULL AND target_scope = 'builtin')
    OR (target_owner_id IS NOT NULL AND target_scope = target_owner_id::text)
  ),
  CONSTRAINT content_likes_item_id_valid CHECK (char_length(btrim(target_item_id)) BETWEEN 1 AND 200),
  CONSTRAINT content_likes_unique_user UNIQUE (target_type, target_scope, target_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_content_likes_target
  ON public.content_likes (target_type, target_scope, target_item_id);

REVOKE ALL ON TABLE public.content_likes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.content_likes TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.content_likes TO authenticated;

ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_likes_select_all" ON public.content_likes;
CREATE POLICY "content_likes_select_all"
  ON public.content_likes FOR SELECT
  TO anon, authenticated
  USING (public.can_interact_with_content(target_type, target_owner_id, target_item_id));

DROP POLICY IF EXISTS "content_likes_insert_own" ON public.content_likes;
CREATE POLICY "content_likes_insert_own"
  ON public.content_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.can_interact_with_content(target_type, target_owner_id, target_item_id)
  );

DROP POLICY IF EXISTS "content_likes_delete_own" ON public.content_likes;
CREATE POLICY "content_likes_delete_own"
  ON public.content_likes FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
