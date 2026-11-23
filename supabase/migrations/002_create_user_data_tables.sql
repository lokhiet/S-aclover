-- ============================================================================
-- SéaClover — Per-Account Cloud Data Tables & Row Level Security (RLS)
-- Migration: 002_create_user_data_tables.sql
--
-- Hướng dẫn chạy:
--   Mở Supabase Dashboard -> SQL Editor -> New query -> Dán toàn bộ nội dung
--   tệp này -> Bấm Run.
--
-- Thiết kế bảo mật & đồng bộ:
--   1. Mỗi tài khoản (auth.users.id) sở hữu không gian dữ liệu tách biệt hoàn toàn.
--   2. Khóa chính phức hợp (user_id, item_id) cho phép nhiều tài khoản cùng chỉnh
--      sửa / ẩn các mục mặc định hoặc nhập cùng tệp sao lưu mà không đụng khóa.
--   3. Cột `version` tự tăng trong trigger BEFORE UPDATE phục vụ kiểm soát xung đột
--      chỉnh sửa đa thiết bị (Optimistic Concurrency Control).
--   4. Cột `is_deleted` lưu dấu xóa mềm cho mục mặc định để không tự hiện lại khi
--      ứng dụng cập nhật.
--   5. Toàn bộ mốc thời gian sử dụng `now()` (timestamptz chuẩn PostgreSQL).
--   6. Bật RLS chặt chẽ cho cả 4 bảng; thu hồi toàn bộ quyền của `anon` và `PUBLIC`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER FUNCTIONS CHUNG (BẢO VỆ METADATA & TỰ TĂNG VERSION)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_user_data_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.version := 1;
    NEW.created_at := now();
    NEW.updated_at := now();
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
      RAISE EXCEPTION 'Không được phép thay đổi chủ sở hữu dữ liệu (user_id).';
    END IF;

    IF NEW.item_id IS DISTINCT FROM OLD.item_id THEN
      RAISE EXCEPTION 'Không được phép thay đổi mã định danh mục (item_id).';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Không được phép thay đổi thời điểm tạo bản ghi hệ thống (created_at).';
    END IF;
  END IF;

  NEW.version := OLD.version + 1;
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. BẢNG NHÂN VẬT CÁ NHÂN: public.user_characters
--    Tương thích 100% với interface Character trong src/types.ts (20 trường)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_characters (
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id               text        NOT NULL,
  name                  text        NOT NULL,
  role                  text        NOT NULL DEFAULT '',
  avatar                text        NOT NULL DEFAULT '🍀',
  description           text,
  author                text,
  fb                    jsonb,
  discord               jsonb,
  discord2              jsonb,
  web                   jsonb,
  other                 jsonb,
  ggai                  text,
  backstory_user        text,
  backstory_char        text,
  backstory_user_title  text,
  backstory_char_title  text,
  user_profile          text,
  user_profile_title    text,
  prompt                text,
  item_created_at       timestamptz NOT NULL DEFAULT now(),
  is_deleted            boolean     NOT NULL DEFAULT false,
  version               integer     NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, item_id),
  CONSTRAINT user_characters_item_id_nonempty CHECK (char_length(trim(item_id)) > 0 AND char_length(item_id) <= 200),
  CONSTRAINT user_characters_name_valid CHECK (is_deleted OR (char_length(trim(name)) > 0 AND char_length(name) <= 300)),
  CONSTRAINT user_characters_version_positive CHECK (version >= 1),
  CONSTRAINT user_characters_fb_type CHECK (fb IS NULL OR jsonb_typeof(fb) IN ('object', 'string')),
  CONSTRAINT user_characters_discord_type CHECK (discord IS NULL OR jsonb_typeof(discord) IN ('object', 'string')),
  CONSTRAINT user_characters_discord2_type CHECK (discord2 IS NULL OR jsonb_typeof(discord2) IN ('object', 'string')),
  CONSTRAINT user_characters_web_type CHECK (web IS NULL OR jsonb_typeof(web) IN ('object', 'string')),
  CONSTRAINT user_characters_other_type CHECK (other IS NULL OR jsonb_typeof(other) IN ('object', 'string'))
);

CREATE INDEX IF NOT EXISTS idx_user_characters_user_updated
  ON public.user_characters (user_id, is_deleted, updated_at DESC);

DROP TRIGGER IF EXISTS on_user_characters_before_insert ON public.user_characters;
CREATE TRIGGER on_user_characters_before_insert
  BEFORE INSERT ON public.user_characters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_data_before_insert();

DROP TRIGGER IF EXISTS on_user_characters_before_update ON public.user_characters;
CREATE TRIGGER on_user_characters_before_update
  BEFORE UPDATE ON public.user_characters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_data_before_update();

-- ----------------------------------------------------------------------------
-- 3. BẢNG GHI CHÚ / KHO LỆNH CÁ NHÂN: public.user_notes
--    Tương thích 100% với interface Note trong src/types.ts (9 trường)
--    Lưu ý: character_id cho phép rỗng ('') hoặc trỏ tới nhân vật mặc định.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_notes (
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id           text        NOT NULL,
  title             text        NOT NULL,
  command           text        NOT NULL DEFAULT '',
  content           text        NOT NULL DEFAULT '',
  character_id      text        NOT NULL DEFAULT '',
  category_offline  text,
  icon              text,
  item_created_at   timestamptz NOT NULL DEFAULT now(),
  is_deleted        boolean     NOT NULL DEFAULT false,
  version           integer     NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, item_id),
  CONSTRAINT user_notes_item_id_nonempty CHECK (char_length(trim(item_id)) > 0 AND char_length(item_id) <= 200),
  CONSTRAINT user_notes_title_valid CHECK (is_deleted OR (char_length(trim(title)) > 0 AND char_length(title) <= 500)),
  CONSTRAINT user_notes_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user_updated
  ON public.user_notes (user_id, is_deleted, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notes_user_character
  ON public.user_notes (user_id, character_id);

DROP TRIGGER IF EXISTS on_user_notes_before_insert ON public.user_notes;
CREATE TRIGGER on_user_notes_before_insert
  BEFORE INSERT ON public.user_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_data_before_insert();

DROP TRIGGER IF EXISTS on_user_notes_before_update ON public.user_notes;
CREATE TRIGGER on_user_notes_before_update
  BEFORE UPDATE ON public.user_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_data_before_update();

-- ----------------------------------------------------------------------------
-- 4. BẢNG Ý TƯỞNG CÁ NHÂN: public.user_ideas
--    Tương thích 100% với interface Idea trong src/types.ts (6 trường)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_ideas (
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id          text        NOT NULL,
  title            text        NOT NULL,
  content          text        NOT NULL DEFAULT '',
  tags             text[],
  item_created_at  timestamptz NOT NULL DEFAULT now(),
  is_deleted       boolean     NOT NULL DEFAULT false,
  version          integer     NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, item_id),
  CONSTRAINT user_ideas_item_id_nonempty CHECK (char_length(trim(item_id)) > 0 AND char_length(item_id) <= 200),
  CONSTRAINT user_ideas_title_valid CHECK (is_deleted OR (char_length(trim(title)) > 0 AND char_length(title) <= 500)),
  CONSTRAINT user_ideas_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_user_ideas_user_updated
  ON public.user_ideas (user_id, is_deleted, updated_at DESC);

DROP TRIGGER IF EXISTS on_user_ideas_before_insert ON public.user_ideas;
CREATE TRIGGER on_user_ideas_before_insert
  BEFORE INSERT ON public.user_ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_data_before_insert();

DROP TRIGGER IF EXISTS on_user_ideas_before_update ON public.user_ideas;
CREATE TRIGGER on_user_ideas_before_update
  BEFORE UPDATE ON public.user_ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_data_before_update();

-- ----------------------------------------------------------------------------
-- 5. BẢNG THƯ VIỆN PROMPT CÁ NHÂN: public.user_library_prompts
--    Tương thích 100% với interface LibraryPrompt & PromptStep trong src/types.ts
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_library_prompts (
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id          text        NOT NULL,
  title            text        NOT NULL,
  description      text        NOT NULL DEFAULT '',
  how_to_use       text        NOT NULL DEFAULT '',
  author           text        NOT NULL DEFAULT '',
  tags             text[]      NOT NULL DEFAULT '{}'::text[],
  icon             text,
  steps            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  item_created_at  timestamptz NOT NULL DEFAULT now(),
  is_deleted       boolean     NOT NULL DEFAULT false,
  version          integer     NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, item_id),
  CONSTRAINT user_library_prompts_item_id_nonempty CHECK (char_length(trim(item_id)) > 0 AND char_length(item_id) <= 200),
  CONSTRAINT user_library_prompts_title_valid CHECK (is_deleted OR (char_length(trim(title)) > 0 AND char_length(title) <= 500)),
  CONSTRAINT user_library_prompts_steps_array CHECK (jsonb_typeof(steps) = 'array'),
  CONSTRAINT user_library_prompts_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_user_library_prompts_user_updated
  ON public.user_library_prompts (user_id, is_deleted, updated_at DESC);

DROP TRIGGER IF EXISTS on_user_library_prompts_before_insert ON public.user_library_prompts;
CREATE TRIGGER on_user_library_prompts_before_insert
  BEFORE INSERT ON public.user_library_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_data_before_insert();

DROP TRIGGER IF EXISTS on_user_library_prompts_before_update ON public.user_library_prompts;
CREATE TRIGGER on_user_library_prompts_before_update
  BEFORE UPDATE ON public.user_library_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_data_before_update();

-- ----------------------------------------------------------------------------
-- 6. PHÂN QUYỀN TỐI THIỂU (LEAST PRIVILEGE) — CHẶN HOÀN TOÀN ANON & PUBLIC
-- ----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.user_characters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_ideas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_library_prompts FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_characters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_ideas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_library_prompts TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. BẬT ROW LEVEL SECURITY (RLS) & CHÍNH SÁCH CÔ LẬP TỪNG TÀI KHOẢN
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library_prompts ENABLE ROW LEVEL SECURITY;

-- Policies cho public.user_characters
DROP POLICY IF EXISTS "user_characters_select_own" ON public.user_characters;
CREATE POLICY "user_characters_select_own"
  ON public.user_characters FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_characters_insert_own" ON public.user_characters;
CREATE POLICY "user_characters_insert_own"
  ON public.user_characters FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_characters_update_own" ON public.user_characters;
CREATE POLICY "user_characters_update_own"
  ON public.user_characters FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_characters_delete_own" ON public.user_characters;
CREATE POLICY "user_characters_delete_own"
  ON public.user_characters FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Policies cho public.user_notes
DROP POLICY IF EXISTS "user_notes_select_own" ON public.user_notes;
CREATE POLICY "user_notes_select_own"
  ON public.user_notes FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_notes_insert_own" ON public.user_notes;
CREATE POLICY "user_notes_insert_own"
  ON public.user_notes FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_notes_update_own" ON public.user_notes;
CREATE POLICY "user_notes_update_own"
  ON public.user_notes FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_notes_delete_own" ON public.user_notes;
CREATE POLICY "user_notes_delete_own"
  ON public.user_notes FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Policies cho public.user_ideas
DROP POLICY IF EXISTS "user_ideas_select_own" ON public.user_ideas;
CREATE POLICY "user_ideas_select_own"
  ON public.user_ideas FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_ideas_insert_own" ON public.user_ideas;
CREATE POLICY "user_ideas_insert_own"
  ON public.user_ideas FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_ideas_update_own" ON public.user_ideas;
CREATE POLICY "user_ideas_update_own"
  ON public.user_ideas FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_ideas_delete_own" ON public.user_ideas;
CREATE POLICY "user_ideas_delete_own"
  ON public.user_ideas FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Policies cho public.user_library_prompts
DROP POLICY IF EXISTS "user_library_prompts_select_own" ON public.user_library_prompts;
CREATE POLICY "user_library_prompts_select_own"
  ON public.user_library_prompts FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_library_prompts_insert_own" ON public.user_library_prompts;
CREATE POLICY "user_library_prompts_insert_own"
  ON public.user_library_prompts FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_library_prompts_update_own" ON public.user_library_prompts;
CREATE POLICY "user_library_prompts_update_own"
  ON public.user_library_prompts FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_library_prompts_delete_own" ON public.user_library_prompts;
CREATE POLICY "user_library_prompts_delete_own"
  ON public.user_library_prompts FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
