-- ============================================================================
-- SéaClover — Phase 5: Private & Public Illustration Storage for Kho Lệnh
-- Migration: 005_prompt_images_storage.sql
--
-- Nguyên tắc bảo vệ dữ liệu & bảo mật:
--   1. Tạo bucket RIÊNG TƯ `prompt-images` (public = false) cho khối "Hình ảnh minh họa"
--      trong Kho Lệnh (`user_notes` và `user_library_prompts`).
--      KHÔNG ảnh hưởng đến dữ liệu hiện có hoặc bucket `avatars` ở migration 004.
--   2. Giới hạn dung lượng tối đa 5 MB (5,242,880 bytes) và chỉ chấp nhận các định dạng
--      ảnh raster an toàn: image/jpeg, image/png, image/webp, image/gif (chặn SVG/HTML).
--   3. Cấu trúc đường dẫn bắt buộc:
--      `<owner_uuid>/<target_type>/<item_id>/<filename>`
--      trong đó `target_type` thuộc `('note', 'library_prompt')`.
--   4. Phân quyền đọc thông minh theo trạng thái bài đăng:
--      - Chủ sở hữu (`auth.uid() = owner_uuid`) luôn xem được ảnh trong bài Riêng tư của mình.
--      - Người khác (kể cả khách chưa đăng nhập) CHỈ xem được ảnh khi bài đăng gốc
--        tồn tại, chưa bị xóa mềm (`is_deleted = false`), và đang ở trạng thái
--        `is_public = true` hoặc `is_system = true`.
--   5. Chỉ chủ sở hữu đã đăng nhập mới được tải lên, cập nhật hoặc xóa tệp trong
--      thư mục UUID của chính mình.
-- ============================================================================

-- 1. Tạo hoặc cập nhật cấu hình bucket riêng tư `prompt-images`
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prompt-images',
  'prompt-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Hàm kiểm tra quyền đọc ảnh theo trạng thái Riêng tư / Công khai / Hệ thống
CREATE OR REPLACE FUNCTION public.can_access_prompt_image(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_folders text[];
  v_owner_text text;
  v_target_type text;
  v_item_id text;
  v_owner_id uuid;
  v_uid uuid;
BEGIN
  IF p_object_name IS NULL OR length(trim(p_object_name)) = 0 THEN
    RETURN false;
  END IF;

  v_folders := storage.foldername(p_object_name);
  IF v_folders IS NULL OR array_length(v_folders, 1) < 3 THEN
    RETURN false;
  END IF;

  v_owner_text := v_folders[1];
  v_target_type := v_folders[2];
  v_item_id := v_folders[3];

  IF v_target_type NOT IN ('note', 'library_prompt') OR coalesce(v_item_id, '') = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_owner_id := v_owner_text::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  v_uid := auth.uid();
  IF v_uid IS NOT NULL AND v_uid = v_owner_id THEN
    RETURN true;
  END IF;

  IF v_target_type = 'note' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_notes n
      WHERE n.user_id = v_owner_id
        AND n.item_id = v_item_id
        AND n.is_deleted = false
        AND (n.is_system = true OR n.is_public = true)
    );
  END IF;

  IF v_target_type = 'library_prompt' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_library_prompts p
      WHERE p.user_id = v_owner_id
        AND p.item_id = v_item_id
        AND p.is_deleted = false
        AND (p.is_system = true OR p.is_public = true)
    );
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_prompt_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_prompt_image(text) TO anon, authenticated;

-- 3. Chính sách RLS trên `storage.objects` cho bucket `prompt-images`

DROP POLICY IF EXISTS "prompt_images_scoped_read" ON storage.objects;
CREATE POLICY "prompt_images_scoped_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'prompt-images'
    AND public.can_access_prompt_image(name)
  );

DROP POLICY IF EXISTS "prompt_images_owner_insert" ON storage.objects;
CREATE POLICY "prompt_images_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'prompt-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] IN ('note', 'library_prompt')
    AND coalesce((storage.foldername(name))[3], '') <> ''
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

DROP POLICY IF EXISTS "prompt_images_owner_update" ON storage.objects;
CREATE POLICY "prompt_images_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'prompt-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'prompt-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] IN ('note', 'library_prompt')
    AND coalesce((storage.foldername(name))[3], '') <> ''
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

DROP POLICY IF EXISTS "prompt_images_owner_delete" ON storage.objects;
CREATE POLICY "prompt_images_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'prompt-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
