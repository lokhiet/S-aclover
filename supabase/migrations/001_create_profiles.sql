-- ============================================================================
-- S-Aclover — Phase 2A / Step 1: User Profiles Schema, Triggers & RLS
-- File: supabase/migrations/001_create_profiles.sql
--
-- Lưu ý triển khai:
-- - Chạy tệp này trong Supabase Dashboard -> SQL Editor.
-- - Chỉ quản lý hồ sơ người dùng (public.profiles), không ảnh hưởng dữ liệu
--   localStorage (seaclover_state) trên trình duyệt.
-- - Hỗ trợ nhiều tài khoản độc lập trên cùng thiết bị thông qua khóa chính
--   UUID gắn chặt với auth.users(id).
-- ============================================================================

-- 1. Tạo bảng public.profiles liên kết 1-1 với auth.users(id)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  bio text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Ràng buộc kiểm tra dữ liệu đầu vào ở tầng database
  CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) <= 80),
  CONSTRAINT profiles_bio_length CHECK (char_length(bio) <= 500),
  CONSTRAINT profiles_role_valid CHECK (role IN ('user', 'admin')),
  CONSTRAINT profiles_avatar_url_safe CHECK (
    avatar_url IS NULL
    OR avatar_url = ''
    OR (
      char_length(avatar_url) <= 2048
      AND avatar_url ~* '^https://'
    )
  )
);

COMMENT ON TABLE public.profiles IS 'Hồ sơ người dùng S-Aclover, liên kết 1-1 với auth.users bằng UUID.';
COMMENT ON COLUMN public.profiles.id IS 'UUID trùng với auth.users.id (bất biến, hệ thống quản lý).';
COMMENT ON COLUMN public.profiles.email IS 'Email đồng bộ từ auth.users (chỉ hệ thống cập nhật).';
COMMENT ON COLUMN public.profiles.role IS 'Quyền hệ thống mặc định là user (người dùng không được tự chỉnh sửa).';

-- 2. Thu hồi quyền mặc định và cấp quyền tối thiểu theo từng cột
--    - Chặn hoàn toàn quyền truy cập của anon.
--    - Không cấp quyền DELETE trực tiếp cho người dùng.
--    - Chỉ cho phép authenticated INSERT/UPDATE các trường hồ sơ cá nhân,
--      ngăn chỉnh sửa id, email, role, created_at, updated_at từ frontend.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT INSERT (id, display_name, avatar_url, bio) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, bio) ON TABLE public.profiles TO authenticated;

-- 3. Trigger tự động khởi tạo hồ sơ khi có tài khoản mới trong auth.users
--    Hoạt động an toàn cho cả Email + Password và Google OAuth.
--    Luôn gán role = 'user' (không bao giờ đọc role từ raw_user_meta_data).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name text;
  v_raw_avatar text;
  v_safe_avatar text;
BEGIN
  v_display_name := btrim(
    coalesce(
      nullif(NEW.raw_user_meta_data ->> 'display_name', ''),
      nullif(NEW.raw_user_meta_data ->> 'full_name', ''),
      nullif(NEW.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(NEW.email, ''), '@', 1),
      ''
    )
  );
  v_display_name := substr(v_display_name, 1, 80);

  v_raw_avatar := btrim(
    coalesce(
      nullif(NEW.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(NEW.raw_user_meta_data ->> 'picture', ''),
      ''
    )
  );

  IF v_raw_avatar ~* '^https://' AND char_length(v_raw_avatar) <= 2048 THEN
    v_safe_avatar := v_raw_avatar;
  ELSE
    v_safe_avatar := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, display_name, avatar_url, bio, role)
  VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    v_safe_avatar,
    '',
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Trigger đồng bộ email khi người dùng đổi email qua Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET
      email = NEW.email,
      updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_auth_user_email_updated() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_email_updated();

-- 5. Trigger bảo vệ trường định danh/hệ thống và tự động cập nhật updated_at
--    Lớp phòng thủ thứ 2 song song với phân quyền theo cột:
--    Chặn tuyệt đối mọi nỗ lực thay đổi id, email, role, created_at từ vai trò client.
CREATE OR REPLACE FUNCTION public.handle_profile_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Không được phép thay đổi UUID định danh (id).'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Không được phép thay đổi quyền hạn hệ thống (role).'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Không được phép chỉnh sửa trực tiếp trường email hệ thống.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Không được phép thay đổi thời điểm tạo (created_at).'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.display_name := btrim(coalesce(NEW.display_name, ''));
  NEW.bio := btrim(coalesce(NEW.bio, ''));
  NEW.avatar_url := nullif(btrim(coalesce(NEW.avatar_url, '')), '');
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_profile_before_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_profiles_before_update ON public.profiles;
CREATE TRIGGER on_profiles_before_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_before_update();

-- 6. Bật Row Level Security (RLS) và thiết lập chính sách cô lập từng tài khoản
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = 'user'
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Lưu ý: Cố ý KHÔNG tạo chính sách DELETE cho bảng public.profiles.
-- Kết hợp với REVOKE DELETE ở mục 2, người dùng không thể xóa trực tiếp hồ sơ.

-- 7. Đồng bộ an toàn cho các tài khoản đã tồn tại sẵn trong auth.users (nếu có)
INSERT INTO public.profiles (id, email, display_name, avatar_url, bio, role)
SELECT
  u.id,
  u.email,
  substr(
    btrim(
      coalesce(
        nullif(u.raw_user_meta_data ->> 'display_name', ''),
        nullif(u.raw_user_meta_data ->> 'full_name', ''),
        nullif(u.raw_user_meta_data ->> 'name', ''),
        split_part(coalesce(u.email, ''), '@', 1),
        ''
      )
    ),
    1,
    80
  ),
  CASE
    WHEN btrim(
      coalesce(
        nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
        nullif(u.raw_user_meta_data ->> 'picture', ''),
        ''
      )
    ) ~* '^https://'
    AND char_length(
      btrim(
        coalesce(
          nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
          nullif(u.raw_user_meta_data ->> 'picture', ''),
          ''
        )
      )
    ) <= 2048
    THEN btrim(
      coalesce(
        nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
        nullif(u.raw_user_meta_data ->> 'picture', ''),
        ''
      )
    )
    ELSE NULL
  END,
  '',
  'user'
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;
