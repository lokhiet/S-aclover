-- ============================================================================
-- SéaClover — Phase 4: Profile Avatar Storage & Cross-Device Profile Sync
-- Migration: 004_profile_avatars_storage.sql
--
-- Nguyên tắc bảo vệ dữ liệu & bảo mật:
--   1. Chỉ bổ sung bucket `avatars` và các RLS policy trên `storage.objects`.
--      KHÔNG xóa hay ghi đè dữ liệu hiện có trong `profiles` hoặc 4 bảng dữ liệu.
--   2. Giới hạn dung lượng tối đa 2 MB (2,097,152 bytes) và chỉ chấp nhận định dạng
--      ảnh an toàn: image/jpeg, image/png, image/webp, image/gif (chặn SVG/HTML).
--   3. Cô lập quyền ghi/sửa/xóa theo từng thư mục UUID riêng:
--      chỉ chủ sở hữu có đường dẫn `<auth.uid()>/<filename>` mới được thao tác.
--   4. Email vẫn tuyệt đối nằm riêng trong `public.profiles`, không đồng bộ sang
--      `public.public_profiles` và không bao giờ công khai.
-- ============================================================================

-- 1. Tạo hoặc cập nhật cấu hình bucket `avatars`
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Chính sách RLS cho bucket `avatars` trên `storage.objects`
--    (Dọn sạch các policy cùng tên trước khi tạo lại để đảm bảo an toàn khi chạy lại)

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  );

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
