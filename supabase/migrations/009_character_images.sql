-- ============================================================================
-- SéaClover — Phase 9: Lưu ảnh nhân vật (0–5 ảnh) & Bảo mật Storage riêng tư
-- Migration: 009_character_images.sql
--
-- Chạy bổ sung trực tiếp SAU 008_builtin_tag_overrides.sql.
--
-- Nguyên tắc bảo vệ dữ liệu & bảo mật:
--   1. KHÔNG xóa, KHÔNG sửa migration 001..008, KHÔNG ghi đè dữ liệu hiện có.
--   2. Bổ sung cột `images jsonb NOT NULL DEFAULT '[]'::jsonb` trên
--      `public.user_characters` với ràng buộc mảng tối đa 5 ảnh (`<= 5`).
--   3. Tạo bucket riêng tư `character-images` (`public = false`, tối đa 5 MB,
--      chỉ JPEG/PNG/WebP/GIF).
--   4. RLS động trên `storage.objects`: ảnh nhân vật Riêng tư chỉ chủ sở hữu
--      xem được; ảnh nhân vật Công khai / Hệ thống (chưa xóa mềm) cho phép
--      người xem hợp lệ đọc; bật/tắt Công khai <-> Riêng tư có hiệu lực tức thì.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CỘT `images` TRÊN `public.user_characters` (0..5 ẢNH, TƯƠNG THÍCH NGƯỢC)
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_characters
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_characters.images IS
  'Danh sách tối đa 5 ảnh nhân vật (JSON array gồm id, storagePath/url, mimeType, width, height, name). Ảnh đầu tiên là ảnh đại diện.';

ALTER TABLE public.user_characters
  DROP CONSTRAINT IF EXISTS user_characters_images_array_max5;

ALTER TABLE public.user_characters
  ADD CONSTRAINT user_characters_images_array_max5
  CHECK (
    jsonb_typeof(images) = 'array'
    AND jsonb_array_length(images) <= 5
  );

-- ----------------------------------------------------------------------------
-- 2. BUCKET RIÊNG TƯ `character-images` TRONG SUPABASE STORAGE
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-images',
  'character-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public             = false,
  file_size_limit    = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- ----------------------------------------------------------------------------
-- 3. HÀM KIỂM TRA QUYỀN ĐỌC ẢNH NHÂN VẬT THEO TRẠNG THÁI CÔNG KHAI / RIÊNG TƯ
--    Đường dẫn chuẩn: <uploader_uid>/character/<character_item_id>/<filename>
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_character_image(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parts      text[];
  v_owner_text text;
  v_owner_uuid uuid;
  v_target     text;
  v_item_id    text;
  v_uid        uuid;
BEGIN
  IF p_object_name IS NULL OR btrim(p_object_name) = '' THEN
    RETURN false;
  END IF;

  v_parts := storage.foldername(p_object_name);
  IF v_parts IS NULL OR array_length(v_parts, 1) < 3 THEN
    RETURN false;
  END IF;

  v_owner_text := v_parts[1];
  v_target     := v_parts[2];
  v_item_id    := v_parts[3];

  IF v_target <> 'character' OR coalesce(btrim(v_item_id), '') = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_owner_uuid := v_owner_text::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  v_uid := auth.uid();

  -- Chủ sở hữu tệp luôn đọc được ảnh của chính mình (kể cả khi đang Riêng tư)
  IF v_uid IS NOT NULL AND v_uid = v_owner_uuid THEN
    RETURN true;
  END IF;

  -- Nếu ảnh gắn với nhân vật thuộc người dùng (công khai) hoặc nội dung Hệ thống
  -- (kể cả khi Admin khác tải ảnh bổ sung cho nhân vật Hệ thống)
  RETURN EXISTS (
    SELECT 1
    FROM public.user_characters AS c
    WHERE c.item_id = v_item_id
      AND c.is_deleted = false
      AND (
        (c.user_id = v_owner_uuid AND c.is_public = true)
        OR c.is_system = true
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_character_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_character_image(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. CHÍNH SÁCH RLS TRÊN `storage.objects` CHO BUCKET `character-images`
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "character_images_scoped_read" ON storage.objects;
CREATE POLICY "character_images_scoped_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'character-images'
    AND public.can_access_character_image(name)
  );

DROP POLICY IF EXISTS "character_images_owner_insert" ON storage.objects;
CREATE POLICY "character_images_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'character-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] = 'character'
    AND coalesce((storage.foldername(name))[3], '') <> ''
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

DROP POLICY IF EXISTS "character_images_owner_update" ON storage.objects;
CREATE POLICY "character_images_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'character-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'character-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] = 'character'
    AND coalesce((storage.foldername(name))[3], '') <> ''
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

DROP POLICY IF EXISTS "character_images_owner_delete" ON storage.objects;
CREATE POLICY "character_images_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'character-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
