-- ============================================================================
-- SéaClover — Phase 8: Bảng lưu trữ bền vững tag của nội dung Hệ thống mặc định
-- Migration: 008_builtin_tag_overrides.sql
--
-- Chạy bổ sung trực tiếp SAU 007_fix_tag_management.sql.
--
-- Nguyên nhân & giải pháp triệt để:
--   - Các mục mặc định tích hợp sẵn (lib-1..lib-22 và rp-1..rp-160) trước đây
--     chỉ nằm trong mã nguồn client và chưa có bảng lưu tag trên Supabase.
--     Vì vậy khi Admin đổi tên, gộp hoặc xóa tag, các mục mặc định vẫn giữ tag
--     cũ trong bundle / localStorage và tự khôi phục lại vào danh sách lọc.
--   - Migration này tạo bảng public.builtin_tag_overrides làm nguồn sự thật
--     duy nhất trên Supabase cho tag của mọi nội dung mặc định, đồng thời cập
--     nhật các hàm RPC admin_rename_shared_tag, admin_merge_shared_tags và
--     admin_delete_shared_tag để đồng bộ nguyên tử cả shared_tags,
--     builtin_tag_overrides và các bảng user_* thuộc phạm vi Admin/Hệ thống.
--   - TUYỆT ĐỐI KHÔNG tác động vào nội dung riêng tư hay công khai thuộc tài
--     khoản người dùng khác (chỉ sửa mục Hệ thống hoặc mục của chính Admin).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BẢNG LƯU TAG HỆ THỐNG CHO NỘI DUNG MẶC ĐỊNH: public.builtin_tag_overrides
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.builtin_tag_overrides (
  target_type text        NOT NULL CHECK (target_type IN ('library_prompt', 'idea', 'character')),
  item_id     text        NOT NULL CHECK (char_length(btrim(item_id)) BETWEEN 1 AND 200),
  tags        text[]      NOT NULL DEFAULT '{}'::text[],
  updated_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, item_id)
);

COMMENT ON TABLE public.builtin_tag_overrides IS 'Danh sách tag hiện hành trên Supabase cho các nội dung Hệ thống mặc định; mọi thiết bị và khách chưa đăng nhập đều đọc từ đây thay vì dùng tag cứng cũ.';

REVOKE ALL ON TABLE public.builtin_tag_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.builtin_tag_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.builtin_tag_overrides TO authenticated;

ALTER TABLE public.builtin_tag_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "builtin_tag_overrides_select_all" ON public.builtin_tag_overrides;
CREATE POLICY "builtin_tag_overrides_select_all"
  ON public.builtin_tag_overrides
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "builtin_tag_overrides_admin_insert" ON public.builtin_tag_overrides;
CREATE POLICY "builtin_tag_overrides_admin_insert"
  ON public.builtin_tag_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "builtin_tag_overrides_admin_update" ON public.builtin_tag_overrides;
CREATE POLICY "builtin_tag_overrides_admin_update"
  ON public.builtin_tag_overrides
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "builtin_tag_overrides_admin_delete" ON public.builtin_tag_overrides;
CREATE POLICY "builtin_tag_overrides_admin_delete"
  ON public.builtin_tag_overrides
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. KHỞI TẠO DỮ LIỆU TAG GỐC CHO TOÀN BỘ 22 KHO LỆNH & 160 IDEA MẶC ĐỊNH
--    (IDEMPOTENT: không ghi đè các bản ghi đã tồn tại nếu chạy lại migration)
-- ----------------------------------------------------------------------------

INSERT INTO public.builtin_tag_overrides (target_type, item_id, tags)
VALUES
  ('library_prompt', 'lib-1', ARRAY['Tạo thoại', 'Say xỉn', 'Tâm lý', 'Cốt truyện']::text[]),
  ('library_prompt', 'lib-2', ARRAY['HUD', 'Tâm lý', 'Ghen tuông', 'Hệ thống']::text[]),
  ('library_prompt', 'lib-3', ARRAY['Mạng xã hội', 'TikTok', 'Điện thoại', 'Khám phá']::text[]),
  ('library_prompt', 'lib-4', ARRAY['Diễn đàn', 'Mạng xã hội', 'Học đường', 'Drama']::text[]),
  ('library_prompt', 'lib-5', ARRAY['Hẹn hò', 'Điện thoại', 'Nhạy cảm', 'Mạng xã hội']::text[]),
  ('library_prompt', 'lib-6', ARRAY['Nhạy cảm', 'Trình duyệt', 'Tâm lý', 'Hệ thống']::text[]),
  ('library_prompt', 'lib-7', ARRAY['Mạng xã hội', 'Weibo', 'Showbiz', 'Drama']::text[]),
  ('library_prompt', 'lib-8', ARRAY['Cốt truyện', 'Nhịp độ', 'Chống Godmode']::text[]),
  ('library_prompt', 'lib-9', ARRAY['Drama', 'Cốt truyện', 'Nhịp độ', 'Chống Godmode']::text[]),
  ('library_prompt', 'lib-10', ARRAY['Sửa lỗi OOC', 'Tâm lý', 'Chống Godmode']::text[]),
  ('library_prompt', 'lib-11', ARRAY['Tự động', 'Cốt truyện', 'Hệ thống']::text[]),
  ('library_prompt', 'lib-12', ARRAY['Nhạy cảm', 'H-Scene', 'Nhịp độ']::text[]),
  ('library_prompt', 'lib-13', ARRAY['Tự động', 'Nhịp độ', 'Hệ thống']::text[]),
  ('library_prompt', 'lib-14', ARRAY['Chống lặp từ', 'Sửa lỗi OOC', 'Văn phong']::text[]),
  ('library_prompt', 'lib-15', ARRAY['Bypass', 'Nhạy cảm', 'Sửa lỗi OOC']::text[]),
  ('library_prompt', 'lib-16', ARRAY['Sao lưu', 'Đồng bộ', 'Sửa lỗi OOC']::text[]),
  ('library_prompt', 'lib-17', ARRAY['Chống Godmode', 'Hệ thống', 'Cốt truyện']::text[]),
  ('library_prompt', 'lib-18', ARRAY['Nhạy cảm', 'Bypass', 'Văn phong', 'Hệ thống']::text[]),
  ('library_prompt', 'lib-19', ARRAY['Sao lưu', 'Đồng bộ', 'Nhiều bước', 'Hệ thống']::text[]),
  ('library_prompt', 'lib-20', ARRAY['Sao lưu', 'Đồng bộ', 'Hệ thống']::text[]),
  ('library_prompt', 'lib-21', ARRAY['Minigame', 'Nhạy cảm', 'BDSM', 'Chống Godmode']::text[]),
  ('library_prompt', 'lib-22', ARRAY['Minigame', 'Cốt truyện', 'Chống Godmode']::text[]),
  ('idea', 'rp-1', ARRAY['Hài hước', 'Nấu ăn', 'Sức khỏe']::text[]),
  ('idea', 'rp-2', ARRAY['Hài hước', 'Nấu ăn', 'Đời thường']::text[]),
  ('idea', 'rp-3', ARRAY['Troll', 'Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-4', ARRAY['Drama', 'Thử thách', 'Gia đình', 'Troll']::text[]),
  ('idea', 'rp-5', ARRAY['Nhạy cảm', 'Quyến rũ', 'Ngọt ngào']::text[]),
  ('idea', 'rp-6', ARRAY['Nhạy cảm', 'Quyến rũ', 'Ngọt ngào']::text[]),
  ('idea', 'rp-7', ARRAY['Nhạy cảm', 'Bất ngờ', 'Ngủ nghê']::text[]),
  ('idea', 'rp-8', ARRAY['Nhạy cảm', 'Ngọt ngào', 'Quyến rũ']::text[]),
  ('idea', 'rp-9', ARRAY['Hài hước', 'Ngọt ngào', 'Nhạy cảm']::text[]),
  ('idea', 'rp-10', ARRAY['Đời thường', 'Sức khỏe']::text[]),
  ('idea', 'rp-11', ARRAY['Sức khỏe', 'Đời thường']::text[]),
  ('idea', 'rp-12', ARRAY['Ngược', 'Tâm lý', 'Drama', 'Yandere']::text[]),
  ('idea', 'rp-13', ARRAY['Giận dỗi', 'Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-14', ARRAY['Giận dỗi', 'Drama', 'Đời thường']::text[]),
  ('idea', 'rp-15', ARRAY['Ngược', 'Drama', 'Máu chó', 'Sức khỏe']::text[]),
  ('idea', 'rp-16', ARRAY['Bám người', 'Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-17', ARRAY['Ngược', 'Drama', 'Đời thường']::text[]),
  ('idea', 'rp-18', ARRAY['Giận dỗi', 'Drama', 'Đời thường']::text[]),
  ('idea', 'rp-19', ARRAY['Đỏ mặt', 'Hẹn hò', 'Nhạy cảm']::text[]),
  ('idea', 'rp-20', ARRAY['Ngọt ngào', 'Hẹn hò', 'Quyến rũ']::text[]),
  ('idea', 'rp-21', ARRAY['Hài hước', 'Troll', 'Ngọt ngào']::text[]),
  ('idea', 'rp-22', ARRAY['Ngọt ngào', 'Quyến rũ', 'Đời thường']::text[]),
  ('idea', 'rp-23', ARRAY['Bất ngờ', 'Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-24', ARRAY['Bất ngờ', 'Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-25', ARRAY['Gia đình', 'Kết hôn', 'Đời thường']::text[]),
  ('idea', 'rp-26', ARRAY['Nhạy cảm', 'Quyến rũ', 'Ngọt ngào']::text[]),
  ('idea', 'rp-27', ARRAY['Hài hước', 'Troll', 'Nhạy cảm']::text[]),
  ('idea', 'rp-28', ARRAY['Mafia', 'Ngược', 'Drama', 'Yandere']::text[]),
  ('idea', 'rp-29', ARRAY['Ngược', 'Máu chó', 'Drama', 'Gia đình']::text[]),
  ('idea', 'rp-30', ARRAY['Quyến rũ', 'Nhạy cảm', 'Ngủ nghê']::text[]),
  ('idea', 'rp-31', ARRAY['Hài hước', 'Thú cưng', 'Ghen tuông', 'Giận dỗi']::text[]),
  ('idea', 'rp-32', ARRAY['Hài hước', 'Thú cưng', 'Đời thường']::text[]),
  ('idea', 'rp-33', ARRAY['Hài hước', 'Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-34', ARRAY['Drama', 'Máu chó', 'Ghen tuông']::text[]),
  ('idea', 'rp-35', ARRAY['Drama', 'Ghen tuông', 'Đời thường']::text[]),
  ('idea', 'rp-36', ARRAY['Drama', 'Ghen tuông', 'Đời thường']::text[]),
  ('idea', 'rp-37', ARRAY['Ngọt ngào', 'Quyến rũ', 'Ghen tuông', 'Giận dỗi']::text[]),
  ('idea', 'rp-38', ARRAY['Drama', 'Bạn bè', 'Đời thường']::text[]),
  ('idea', 'rp-39', ARRAY['Ngược', 'Sức khỏe', 'Ngọt ngào']::text[]),
  ('idea', 'rp-40', ARRAY['Tâm lý', 'Drama', 'Ghen tuông']::text[]),
  ('idea', 'rp-41', ARRAY['Ngược', 'Drama', 'Nguy hiểm', 'Mafia']::text[]),
  ('idea', 'rp-42', ARRAY['Nhạy cảm', 'Quyến rũ', 'Drama', 'Sức khỏe']::text[]),
  ('idea', 'rp-43', ARRAY['Hài hước', 'Troll', 'Rắc rối']::text[]),
  ('idea', 'rp-44', ARRAY['Troll', 'Hài hước', 'Đời thường']::text[]),
  ('idea', 'rp-45', ARRAY['Ngược', 'Tâm lý', 'Drama']::text[]),
  ('idea', 'rp-46', ARRAY['Hài hước', 'Đời thường', 'Quyến rũ']::text[]),
  ('idea', 'rp-47', ARRAY['Ngược', 'Drama', 'Sức khỏe', 'Tâm lý']::text[]),
  ('idea', 'rp-48', ARRAY['Ngược', 'Đời thường', 'Sức khỏe']::text[]),
  ('idea', 'rp-49', ARRAY['Ngược', 'Sức khỏe', 'Drama', 'Giận dỗi']::text[]),
  ('idea', 'rp-50', ARRAY['Troll', 'Hài hước', 'Hẹn hò']::text[]),
  ('idea', 'rp-51', ARRAY['Ngọt ngào', 'Hài hước', 'Kết hôn']::text[]),
  ('idea', 'rp-52', ARRAY['Troll', 'Giận dỗi', 'Đời thường']::text[]),
  ('idea', 'rp-53', ARRAY['Thử thách', 'Drama', 'Ghen tuông']::text[]),
  ('idea', 'rp-54', ARRAY['Ghen tuông', 'Tâm lý', 'Ngủ nghê', 'Say xỉn']::text[]),
  ('idea', 'rp-55', ARRAY['Hài hước', 'Drama', 'Đời thường']::text[]),
  ('idea', 'rp-56', ARRAY['Sức khỏe', 'Sợ hãi', 'Ngọt ngào']::text[]),
  ('idea', 'rp-57', ARRAY['Ngủ nghê', 'Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-58', ARRAY['Ngủ nghê', 'Hài hước', 'Đời thường']::text[]),
  ('idea', 'rp-59', ARRAY['Nhạy cảm', 'Quyến rũ', 'Ngọt ngào']::text[]),
  ('idea', 'rp-60', ARRAY['Troll', 'Hài hước', 'Ngủ nghê', 'Fantasy']::text[]),
  ('idea', 'rp-61', ARRAY['Ngủ nghê', 'Hài hước', 'Ngọt ngào']::text[]),
  ('idea', 'rp-62', ARRAY['Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-63', ARRAY['Đời thường', 'Ngọt ngào']::text[]),
  ('idea', 'rp-64', ARRAY['Quyến rũ', 'Nhạy cảm', 'Ngọt ngào']::text[]),
  ('idea', 'rp-65', ARRAY['Hài hước', 'Hẹn hò', 'Cosplay', 'Thú cưng']::text[]),
  ('idea', 'rp-66', ARRAY['Hài hước', 'Cosplay', 'Đời thường']::text[]),
  ('idea', 'rp-67', ARRAY['Quyến rũ', 'Nhạy cảm', 'Ngọt ngào']::text[]),
  ('idea', 'rp-68', ARRAY['Đời thường', 'Quyến rũ', 'Ngọt ngào']::text[]),
  ('idea', 'rp-69', ARRAY['Ngọt ngào', 'Tỏ tình', 'Hẹn hò']::text[]),
  ('idea', 'rp-70', ARRAY['Gia đình', 'Rắc rối', 'Đời thường']::text[]),
  ('idea', 'rp-71', ARRAY['Hài hước', 'Gia đình', 'Ngủ nghê', 'Nhạy cảm']::text[]),
  ('idea', 'rp-72', ARRAY['Hài hước', 'Gia đình', 'Đời thường']::text[]),
  ('idea', 'rp-73', ARRAY['Quyến rũ', 'Đời thường', 'Gia đình']::text[]),
  ('idea', 'rp-74', ARRAY['Đời thường', 'Gia đình']::text[]),
  ('idea', 'rp-75', ARRAY['Hài hước', 'Rắc rối', 'Gia đình', 'Tổng tài']::text[]),
  ('idea', 'rp-76', ARRAY['Hành động', 'Ngầu', 'Đời thường']::text[]),
  ('idea', 'rp-77', ARRAY['Drama', 'Bất ngờ', 'Sức khỏe']::text[]),
  ('idea', 'rp-78', ARRAY['Hài hước', 'Trẻ con', 'Đời thường']::text[]),
  ('idea', 'rp-79', ARRAY['Fantasy', 'Hài hước', 'Thú cưng', 'Nhạy cảm']::text[]),
  ('idea', 'rp-80', ARRAY['Ngược', 'Yandere', 'Drama', 'Chiếm hữu']::text[]),
  ('idea', 'rp-81', ARRAY['Ngọt ngào', 'Ngủ nghê', 'Say xỉn']::text[]),
  ('idea', 'rp-82', ARRAY['Troll', 'Ngọt ngào', 'Đời thường']::text[]),
  ('idea', 'rp-83', ARRAY['Quyến rũ', 'Nhạy cảm', 'Ngủ nghê']::text[]),
  ('idea', 'rp-84', ARRAY['Quyến rũ', 'Nhạy cảm', 'Tổng tài']::text[]),
  ('idea', 'rp-85', ARRAY['Troll', 'Nhạy cảm', 'Rắc rối', 'Tổng tài']::text[]),
  ('idea', 'rp-86', ARRAY['Hài hước', 'Mafia', 'Ngầu']::text[]),
  ('idea', 'rp-87', ARRAY['Drama', 'Giận dỗi', 'Đời thường']::text[]),
  ('idea', 'rp-88', ARRAY['Troll', 'Hài hước', 'Nhạy cảm']::text[]),
  ('idea', 'rp-89', ARRAY['Troll', 'Hài hước', 'Ngọt ngào', 'Quyến rũ']::text[]),
  ('idea', 'rp-90', ARRAY['Quyến rũ', 'Chiếm hữu', 'Nhạy cảm']::text[]),
  ('idea', 'rp-91', ARRAY['Troll', 'Ghen tuông', 'Drama']::text[]),
  ('idea', 'rp-92', ARRAY['BDSM', 'Nhạy cảm', 'Chiếm hữu', 'Troll']::text[]),
  ('idea', 'rp-93', ARRAY['Nhạy cảm', 'Drama', 'Quyến rũ']::text[]),
  ('idea', 'rp-94', ARRAY['Troll', 'Nhạy cảm', 'Quyến rũ']::text[]),
  ('idea', 'rp-95', ARRAY['Hài hước', 'Troll', 'Đời thường']::text[]),
  ('idea', 'rp-96', ARRAY['Sức khỏe', 'Ngược', 'Drama']::text[]),
  ('idea', 'rp-97', ARRAY['Ngọt ngào', 'Kết hôn', 'Đời thường']::text[]),
  ('idea', 'rp-98', ARRAY['Hài hước', 'Quyến rũ', 'Ngọt ngào']::text[]),
  ('idea', 'rp-99', ARRAY['Ngược', 'Drama', 'Tổng tài']::text[]),
  ('idea', 'rp-100', ARRAY['Ngược', 'Drama', 'Tổng tài']::text[]),
  ('idea', 'rp-101', ARRAY['Ngầu', 'Ngọt ngào', 'Tổng tài']::text[]),
  ('idea', 'rp-102', ARRAY['Drama', 'Ghen tuông', 'Troll']::text[]),
  ('idea', 'rp-103', ARRAY['Hài hước', 'Ngọt ngào', 'Kết hôn']::text[]),
  ('idea', 'rp-104', ARRAY['Troll', 'Nhạy cảm', 'Quyến rũ']::text[]),
  ('idea', 'rp-105', ARRAY['Quyến rũ', 'Nhạy cảm', 'Ngủ nghê']::text[]),
  ('idea', 'rp-106', ARRAY['Ngược', 'Troll', 'Drama']::text[]),
  ('idea', 'rp-107', ARRAY['Hài hước', 'Đời thường']::text[]),
  ('idea', 'rp-108', ARRAY['Hài hước', 'Troll', 'Tổng tài']::text[]),
  ('idea', 'rp-109', ARRAY['Quyến rũ', 'Nhạy cảm', 'Sức khỏe']::text[]),
  ('idea', 'rp-110', ARRAY['Hài hước', 'Troll', 'Hẹn hò']::text[]),
  ('idea', 'rp-111', ARRAY['Ngược', 'Troll', 'Giận dỗi']::text[]),
  ('idea', 'rp-112', ARRAY['Drama', 'Đi chơi', 'Say xỉn']::text[]),
  ('idea', 'rp-113', ARRAY['Troll', 'Drama', 'Tổng tài']::text[]),
  ('idea', 'rp-114', ARRAY['Drama', 'Ghen tuông', 'Đời thường']::text[]),
  ('idea', 'rp-115', ARRAY['Troll', 'Drama', 'Hài hước', 'Tổng tài']::text[]),
  ('idea', 'rp-116', ARRAY['Ngược', 'Drama', 'Máu chó']::text[]),
  ('idea', 'rp-117', ARRAY['Troll', 'Nhạy cảm', 'Tổng tài']::text[]),
  ('idea', 'rp-118', ARRAY['Nhạy cảm', 'Quyến rũ', 'Gia đình']::text[]),
  ('idea', 'rp-119', ARRAY['Hài hước', 'Troll', 'Tổng tài', 'Đời thường']::text[]),
  ('idea', 'rp-120', ARRAY['Nhạy cảm', 'Quyến rũ', 'Troll', 'Tổng tài']::text[]),
  ('idea', 'rp-121', ARRAY['Hài hước', 'Troll', 'Tổng tài', 'Ghen tuông']::text[]),
  ('idea', 'rp-122', ARRAY['Troll', 'Hài hước', 'Tổng tài']::text[]),
  ('idea', 'rp-123', ARRAY['Quyến rũ', 'Drama', 'Tổng tài']::text[]),
  ('idea', 'rp-124', ARRAY['Quyến rũ', 'Ngọt ngào', 'Tổng tài']::text[]),
  ('idea', 'rp-125', ARRAY['Quyến rũ', 'Hẹn hò', 'Tổng tài']::text[]),
  ('idea', 'rp-126', ARRAY['Say xỉn', 'Hài hước', 'Troll', 'Tổng tài']::text[]),
  ('idea', 'rp-127', ARRAY['Troll', 'Drama', 'Tổng tài', 'Ghen tuông']::text[]),
  ('idea', 'rp-128', ARRAY['Hài hước', 'Troll', 'Cosplay', 'Tổng tài']::text[]),
  ('idea', 'rp-129', ARRAY['Quyến rũ', 'Nhạy cảm', 'Tổng tài']::text[]),
  ('idea', 'rp-130', ARRAY['Nhạy cảm', 'Ngọt ngào', 'Tổng tài']::text[]),
  ('idea', 'rp-131', ARRAY['Ngược', 'Troll', 'Nhạy cảm']::text[]),
  ('idea', 'rp-132', ARRAY['Hài hước', 'Troll', 'Sức khỏe']::text[]),
  ('idea', 'rp-133', ARRAY['Tổng tài', 'Hài hước', 'Đời thường']::text[]),
  ('idea', 'rp-134', ARRAY['Hài hước', 'Troll', 'Tổng tài', 'Yandere']::text[]),
  ('idea', 'rp-135', ARRAY['Drama', 'Máu chó', 'Ghen tuông', 'Gia đình']::text[]),
  ('idea', 'rp-136', ARRAY['Ngược', 'Drama', 'Mafia', 'Ghen tuông']::text[]),
  ('idea', 'rp-137', ARRAY['Troll', 'Nhạy cảm', 'Ngủ nghê']::text[]),
  ('idea', 'rp-138', ARRAY['Hài hước', 'Troll', 'Tổng tài', 'Đời thường']::text[]),
  ('idea', 'rp-139', ARRAY['Hài hước', 'Troll', 'Tổng tài']::text[]),
  ('idea', 'rp-140', ARRAY['Hài hước', 'Troll', 'Tổng tài']::text[]),
  ('idea', 'rp-141', ARRAY['Hài hước', 'Troll', 'Tổng tài', 'Giận dỗi']::text[]),
  ('idea', 'rp-142', ARRAY['Hài hước', 'Troll', 'Tổng tài', 'Giận dỗi']::text[]),
  ('idea', 'rp-143', ARRAY['Nhạy cảm', 'Troll', 'Tổng tài']::text[]),
  ('idea', 'rp-144', ARRAY['Drama', 'Yandere', 'Tổng tài']::text[]),
  ('idea', 'rp-145', ARRAY['Hài hước', 'Giận dỗi', 'Tổng tài', 'Sức khỏe']::text[]),
  ('idea', 'rp-146', ARRAY['Quyến rũ', 'Nhạy cảm', 'Tổng tài']::text[]),
  ('idea', 'rp-147', ARRAY['Fantasy', 'Ngược', 'Tổng tài']::text[]),
  ('idea', 'rp-148', ARRAY['Hài hước', 'Ngọt ngào', 'Tổng tài']::text[]),
  ('idea', 'rp-149', ARRAY['Fantasy', 'Hài hước', 'Tổng tài', 'Mafia']::text[]),
  ('idea', 'rp-150', ARRAY['Quyến rũ', 'Nhạy cảm', 'Tổng tài']::text[]),
  ('idea', 'rp-151', ARRAY['Drama', 'Hài hước', 'Tổng tài', 'Kết hôn']::text[]),
  ('idea', 'rp-152', ARRAY['Ngọt ngào', 'Nhạy cảm', 'Tổng tài', 'Đời thường']::text[]),
  ('idea', 'rp-153', ARRAY['Ngọt ngào', 'Tổng tài', 'Đời thường']::text[]),
  ('idea', 'rp-154', ARRAY['Troll', 'Drama', 'Tổng tài', 'Ghen tuông']::text[]),
  ('idea', 'rp-155', ARRAY['Hài hước', 'Troll', 'Tổng tài', 'Mafia']::text[]),
  ('idea', 'rp-156', ARRAY['Hài hước', 'Ngọt ngào', 'Tổng tài']::text[]),
  ('idea', 'rp-157', ARRAY['Drama', 'Troll', 'Tổng tài', 'Mafia']::text[]),
  ('idea', 'rp-158', ARRAY['Hài hước', 'Troll', 'Tổng tài', 'Mafia']::text[]),
  ('idea', 'rp-159', ARRAY['Ngọt ngào', 'Hẹn hò', 'Tổng tài', 'Đời thường']::text[]),
  ('idea', 'rp-160', ARRAY['Drama', 'Máu chó', 'Ghen tuông', 'Tổng tài']::text[])
ON CONFLICT (target_type, item_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. ĐỐI CHIẾU & ĐỒNG BỘ LẠI CÁC THAO TÁC GỘP / ĐỔI TÊN ĐÃ CHẠY TỪ TRƯỚC
--    Áp dụng các từ đồng nghĩa (aliases) đã lưu trong shared_tags lên
--    builtin_tag_overrides (vd: TikTok, Trình duyệt, Weibo -> Mạng xã hội)
--    khi tag nguồn không còn là một tag độc lập trong shared_tags.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_rec      record;
  v_new_tags text[];
BEGIN
  FOR v_rec IN
    SELECT target_type, item_id, tags
    FROM public.builtin_tag_overrides
    WHERE COALESCE(array_length(tags, 1), 0) > 0
  LOOP
    SELECT COALESCE(
      ARRAY(
        SELECT chosen_elem
        FROM (
          SELECT
            (ARRAY_AGG(resolved_label ORDER BY ord))[1] AS chosen_elem,
            MIN(ord) AS first_pos
          FROM (
            SELECT
              x.ord,
              COALESCE(
                (
                  SELECT s.label
                  FROM public.shared_tags AS s
                  WHERE lower(regexp_replace(btrim(s.label), '\s+', ' ', 'g'))
                          <> lower(regexp_replace(btrim(x.t), '\s+', ' ', 'g'))
                    AND NOT EXISTS (
                      SELECT 1
                      FROM public.shared_tags AS s_own
                      WHERE lower(regexp_replace(btrim(s_own.label), '\s+', ' ', 'g'))
                              = lower(regexp_replace(btrim(x.t), '\s+', ' ', 'g'))
                    )
                    AND EXISTS (
                      SELECT 1
                      FROM unnest(COALESCE(s.aliases, '{}'::text[])) AS a
                      WHERE lower(regexp_replace(btrim(a), '\s+', ' ', 'g'))
                              = lower(regexp_replace(btrim(x.t), '\s+', ' ', 'g'))
                    )
                  ORDER BY s.updated_at DESC, s.label ASC
                  LIMIT 1
                ),
                regexp_replace(btrim(x.t), '\s+', ' ', 'g')
              ) AS resolved_label
            FROM unnest(COALESCE(v_rec.tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
            WHERE btrim(COALESCE(x.t, '')) <> ''
          ) AS mapped
          GROUP BY lower(resolved_label)
        ) AS dedup
        ORDER BY first_pos
      ),
      '{}'::text[]
    )
    INTO v_new_tags;

    IF v_new_tags IS DISTINCT FROM v_rec.tags THEN
      UPDATE public.builtin_tag_overrides
      SET
        tags       = v_new_tags,
        updated_at = now()
      WHERE target_type = v_rec.target_type
        AND item_id = v_rec.item_id;
    END IF;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. CẬP NHẬT HÀM: public.admin_rename_shared_tag
--    Đồng bộ nguyên tử: shared_tags + builtin_tag_overrides + user_* (Hệ thống/Admin)
-- ----------------------------------------------------------------------------

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
  v_uid             uuid := (SELECT auth.uid());
  v_old             text := regexp_replace(btrim(COALESCE(p_old_label, '')), '\s+', ' ', 'g');
  v_new             text := regexp_replace(btrim(COALESCE(p_new_label, '')), '\s+', ' ', 'g');
  v_old_lower       text := lower(v_old);
  v_new_lower       text := lower(v_new);
  v_slug            text;
  v_old_aliases     text[] := '{}'::text[];
  v_old_desc        text := '';
  v_updated         integer := 0;
  v_cnt             integer := 0;
  v_note_prefix     constant text := '__SEACLOVER_NOTE_V2__:';
  v_note_rec        record;
  v_note_json       jsonb;
  v_new_note_tags   jsonb;
  v_new_legacy_cat  text;
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

  -- Chuẩn hóa slug đích
  v_slug := regexp_replace(lower(btrim(COALESCE(p_new_slug, ''))), '[^a-z0-9-]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  IF char_length(v_slug) < 1 THEN
    v_slug := 'tag-' || substr(md5(v_new_lower), 1, 8);
  ELSIF char_length(v_slug) > 80 THEN
    v_slug := left(v_slug, 80);
  END IF;

  -- Lưu lại aliases & description của tag nguồn trước khi hợp nhất/xóa
  SELECT COALESCE(s.aliases, '{}'::text[]), COALESCE(s.description, '')
  INTO v_old_aliases, v_old_desc
  FROM public.shared_tags AS s
  WHERE lower(regexp_replace(btrim(s.label), '\s+', ' ', 'g')) = v_old_lower
  LIMIT 1;

  v_old_aliases := COALESCE(v_old_aliases, '{}'::text[]);
  v_old_desc := COALESCE(v_old_desc, '');

  -- 1) Cập nhật hoặc hợp nhất trong bảng public.shared_tags
  IF EXISTS (
    SELECT 1
    FROM public.shared_tags AS s
    WHERE lower(regexp_replace(btrim(s.label), '\s+', ' ', 'g')) = v_new_lower
      AND lower(regexp_replace(btrim(s.label), '\s+', ' ', 'g')) <> v_old_lower
  ) THEN
    UPDATE public.shared_tags AS s
    SET
      aliases = COALESCE(
        ARRAY(
          SELECT chosen_alias
          FROM (
            SELECT
              (ARRAY_AGG(regexp_replace(btrim(a), '\s+', ' ', 'g') ORDER BY ord))[1] AS chosen_alias,
              MIN(ord) AS first_pos
            FROM unnest(
              COALESCE(s.aliases, '{}'::text[])
              || v_old_aliases
              || ARRAY[v_old]::text[]
            ) WITH ORDINALITY AS x(a, ord)
            WHERE btrim(COALESCE(a, '')) <> ''
              AND lower(regexp_replace(btrim(a), '\s+', ' ', 'g')) <> v_new_lower
            GROUP BY lower(regexp_replace(btrim(a), '\s+', ' ', 'g'))
          ) AS dedup
          ORDER BY first_pos
        ),
        '{}'::text[]
      ),
      description = CASE
        WHEN btrim(COALESCE(s.description, '')) = '' AND btrim(v_old_desc) <> '' THEN v_old_desc
        ELSE s.description
      END,
      updated_at = now()
    WHERE lower(regexp_replace(btrim(s.label), '\s+', ' ', 'g')) = v_new_lower;

    DELETE FROM public.shared_tags
    WHERE lower(regexp_replace(btrim(label), '\s+', ' ', 'g')) = v_old_lower;

  ELSIF EXISTS (
    SELECT 1
    FROM public.shared_tags AS s
    WHERE lower(regexp_replace(btrim(s.label), '\s+', ' ', 'g')) = v_old_lower
  ) THEN
    UPDATE public.shared_tags AS s
    SET
      label = v_new,
      aliases = COALESCE(
        ARRAY(
          SELECT chosen_alias
          FROM (
            SELECT
              (ARRAY_AGG(regexp_replace(btrim(a), '\s+', ' ', 'g') ORDER BY ord))[1] AS chosen_alias,
              MIN(ord) AS first_pos
            FROM unnest(
              COALESCE(s.aliases, '{}'::text[])
              || CASE WHEN v_old_lower <> v_new_lower THEN ARRAY[v_old]::text[] ELSE '{}'::text[] END
            ) WITH ORDINALITY AS x(a, ord)
            WHERE btrim(COALESCE(a, '')) <> ''
              AND lower(regexp_replace(btrim(a), '\s+', ' ', 'g')) <> v_new_lower
            GROUP BY lower(regexp_replace(btrim(a), '\s+', ' ', 'g'))
          ) AS dedup
          ORDER BY first_pos
        ),
        '{}'::text[]
      ),
      updated_at = now()
    WHERE lower(regexp_replace(btrim(s.label), '\s+', ' ', 'g')) = v_old_lower;

  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.shared_tags AS s
      WHERE s.slug = v_slug
        AND lower(regexp_replace(btrim(s.label), '\s+', ' ', 'g')) <> v_new_lower
    ) THEN
      v_slug := left(v_slug, 71) || '-' || substr(md5(v_new_lower), 1, 8);
    END IF;

    INSERT INTO public.shared_tags (slug, label, aliases, created_by, created_at, updated_at)
    VALUES (
      v_slug,
      v_new,
      CASE WHEN v_old_lower <> v_new_lower THEN ARRAY[v_old]::text[] ELSE '{}'::text[] END,
      v_uid,
      now(),
      now()
    )
    ON CONFLICT (slug) DO UPDATE
    SET
      label = EXCLUDED.label,
      aliases = COALESCE(
        ARRAY(
          SELECT chosen_alias
          FROM (
            SELECT
              (ARRAY_AGG(regexp_replace(btrim(a), '\s+', ' ', 'g') ORDER BY ord))[1] AS chosen_alias,
              MIN(ord) AS first_pos
            FROM unnest(
              COALESCE(public.shared_tags.aliases, '{}'::text[])
              || COALESCE(EXCLUDED.aliases, '{}'::text[])
            ) WITH ORDINALITY AS x(a, ord)
            WHERE btrim(COALESCE(a, '')) <> ''
              AND lower(regexp_replace(btrim(a), '\s+', ' ', 'g')) <> v_new_lower
            GROUP BY lower(regexp_replace(btrim(a), '\s+', ' ', 'g'))
          ) AS dedup
          ORDER BY first_pos
        ),
        '{}'::text[]
      ),
      updated_at = now();
  END IF;

  -- 2) Cập nhật tag trên bảng public.builtin_tag_overrides (nội dung Hệ thống mặc định)
  UPDATE public.builtin_tag_overrides
  SET
    tags = COALESCE(
      ARRAY(
        SELECT chosen_elem
        FROM (
          SELECT
            CASE
              WHEN bool_or(lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) IN (v_old_lower, v_new_lower)) THEN v_new
              ELSE (ARRAY_AGG(regexp_replace(btrim(t), '\s+', ' ', 'g') ORDER BY ord))[1]
            END AS chosen_elem,
            MIN(ord) AS first_pos
          FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
          WHERE btrim(COALESCE(t, '')) <> ''
          GROUP BY lower(
            CASE
              WHEN lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) = v_old_lower THEN v_new
              ELSE regexp_replace(btrim(t), '\s+', ' ', 'g')
            END
          )
        ) AS dedup
        ORDER BY first_pos
      ),
      '{}'::text[]
    ),
    updated_by = v_uid,
    updated_at = now()
  WHERE EXISTS (
    SELECT 1
    FROM unnest(COALESCE(tags, '{}'::text[])) AS t
    WHERE lower(regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g')) = v_old_lower
      AND regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g') <> v_new
  );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 3) Cập nhật tag trên bảng public.user_library_prompts (cột tags là text[])
  --    CHỈ tác động lên mục Hệ thống hoặc mục do chính Admin sở hữu
  UPDATE public.user_library_prompts
  SET tags = COALESCE(
    ARRAY(
      SELECT chosen_elem
      FROM (
        SELECT
          CASE
            WHEN bool_or(lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) IN (v_old_lower, v_new_lower)) THEN v_new
            ELSE (ARRAY_AGG(regexp_replace(btrim(t), '\s+', ' ', 'g') ORDER BY ord))[1]
          END AS chosen_elem,
          MIN(ord) AS first_pos
        FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
        WHERE btrim(COALESCE(t, '')) <> ''
        GROUP BY lower(
          CASE
            WHEN lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) = v_old_lower THEN v_new
            ELSE regexp_replace(btrim(t), '\s+', ' ', 'g')
          END
        )
      ) AS dedup
      ORDER BY first_pos
    ),
    '{}'::text[]
  )
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(tags, '{}'::text[])) AS t
      WHERE lower(regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g')) = v_old_lower
        AND regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g') <> v_new
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 4) Cập nhật tag trên bảng public.user_ideas (cột tags là text[])
  UPDATE public.user_ideas
  SET tags = COALESCE(
    ARRAY(
      SELECT chosen_elem
      FROM (
        SELECT
          CASE
            WHEN bool_or(lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) IN (v_old_lower, v_new_lower)) THEN v_new
            ELSE (ARRAY_AGG(regexp_replace(btrim(t), '\s+', ' ', 'g') ORDER BY ord))[1]
          END AS chosen_elem,
          MIN(ord) AS first_pos
        FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
        WHERE btrim(COALESCE(t, '')) <> ''
        GROUP BY lower(
          CASE
            WHEN lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) = v_old_lower THEN v_new
            ELSE regexp_replace(btrim(t), '\s+', ' ', 'g')
          END
        )
      ) AS dedup
      ORDER BY first_pos
    ),
    '{}'::text[]
  )
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(tags, '{}'::text[])) AS t
      WHERE lower(regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g')) = v_old_lower
        AND regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g') <> v_new
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 5) Cập nhật role tag trên bảng public.user_characters (cột role là text)
  UPDATE public.user_characters
  SET role = COALESCE((
    SELECT string_agg(chosen_elem, ' / ' ORDER BY first_pos)
    FROM (
      SELECT
        CASE
          WHEN bool_or(lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) IN (v_old_lower, v_new_lower)) THEN v_new
          ELSE (ARRAY_AGG(regexp_replace(btrim(t), '\s+', ' ', 'g') ORDER BY ord))[1]
        END AS chosen_elem,
        MIN(ord) AS first_pos
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,|]\s*') WITH ORDINALITY AS x(t, ord)
      WHERE btrim(COALESCE(t, '')) <> ''
      GROUP BY lower(
        CASE
          WHEN lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) = v_old_lower THEN v_new
          ELSE regexp_replace(btrim(t), '\s+', ' ', 'g')
        END
      )
    ) AS dedup
  ), role)
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,|]\s*') AS t
      WHERE lower(regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g')) = v_old_lower
        AND regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g') <> v_new
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 6) Cập nhật tag trên bảng public.user_notes (cột category_offline)
  FOR v_note_rec IN
    SELECT user_id, item_id, category_offline
    FROM public.user_notes
    WHERE is_deleted = false
      AND (is_system = true OR user_id = v_uid)
      AND category_offline IS NOT NULL
      AND btrim(category_offline) <> ''
  LOOP
    IF left(v_note_rec.category_offline, char_length(v_note_prefix)) = v_note_prefix THEN
      BEGIN
        v_note_json := substring(v_note_rec.category_offline FROM char_length(v_note_prefix) + 1)::jsonb;
        IF jsonb_typeof(v_note_json->'tags') = 'array'
           AND EXISTS (
             SELECT 1
             FROM jsonb_array_elements_text(v_note_json->'tags') AS nt
             WHERE lower(regexp_replace(btrim(COALESCE(nt, '')), '\s+', ' ', 'g')) = v_old_lower
               AND regexp_replace(btrim(COALESCE(nt, '')), '\s+', ' ', 'g') <> v_new
           ) THEN
          SELECT COALESCE(jsonb_agg(chosen_elem ORDER BY first_pos), '[]'::jsonb)
          INTO v_new_note_tags
          FROM (
            SELECT
              CASE
                WHEN bool_or(lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) IN (v_old_lower, v_new_lower)) THEN v_new
                ELSE (ARRAY_AGG(regexp_replace(btrim(t), '\s+', ' ', 'g') ORDER BY ord))[1]
              END AS chosen_elem,
              MIN(ord) AS first_pos
            FROM jsonb_array_elements_text(v_note_json->'tags') WITH ORDINALITY AS x(t, ord)
            WHERE btrim(COALESCE(t, '')) <> ''
            GROUP BY lower(
              CASE
                WHEN lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) = v_old_lower THEN v_new
                ELSE regexp_replace(btrim(t), '\s+', ' ', 'g')
              END
            )
          ) AS dedup;

          UPDATE public.user_notes
          SET category_offline = v_note_prefix || jsonb_set(v_note_json, '{tags}', v_new_note_tags, true)::text
          WHERE user_id = v_note_rec.user_id
            AND item_id = v_note_rec.item_id;

          GET DIAGNOSTICS v_cnt = ROW_COUNT;
          v_updated := v_updated + v_cnt;
        END IF;
      EXCEPTION WHEN SQLSTATE '22P02' THEN
        NULL;
      END;
    ELSIF EXISTS (
      SELECT 1
      FROM regexp_split_to_table(v_note_rec.category_offline, '\s*[/,]\s*') AS nt
      WHERE lower(regexp_replace(btrim(COALESCE(nt, '')), '\s+', ' ', 'g')) = v_old_lower
        AND regexp_replace(btrim(COALESCE(nt, '')), '\s+', ' ', 'g') <> v_new
    ) THEN
      SELECT string_agg(chosen_elem, ' / ' ORDER BY first_pos)
      INTO v_new_legacy_cat
      FROM (
        SELECT
          CASE
            WHEN bool_or(lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) IN (v_old_lower, v_new_lower)) THEN v_new
            ELSE (ARRAY_AGG(regexp_replace(btrim(t), '\s+', ' ', 'g') ORDER BY ord))[1]
          END AS chosen_elem,
          MIN(ord) AS first_pos
        FROM regexp_split_to_table(v_note_rec.category_offline, '\s*[/,]\s*') WITH ORDINALITY AS x(t, ord)
        WHERE btrim(COALESCE(t, '')) <> ''
        GROUP BY lower(
          CASE
            WHEN lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) = v_old_lower THEN v_new
            ELSE regexp_replace(btrim(t), '\s+', ' ', 'g')
          END
        )
      ) AS dedup;

      UPDATE public.user_notes
      SET category_offline = COALESCE(v_new_legacy_cat, v_note_rec.category_offline)
      WHERE user_id = v_note_rec.user_id
        AND item_id = v_note_rec.item_id;

      GET DIAGNOSTICS v_cnt = ROW_COUNT;
      v_updated := v_updated + v_cnt;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_rename_shared_tag(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rename_shared_tag(text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. CẬP NHẬT HÀM: public.admin_merge_shared_tags (nguyên tử 1 transaction)
-- ----------------------------------------------------------------------------

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
  v_uid           uuid := (SELECT auth.uid());
  v_target_clean  text := regexp_replace(btrim(COALESCE(p_target_label, '')), '\s+', ' ', 'g');
  v_target_lower  text := lower(v_target_clean);
  v_src           text;
  v_src_clean     text;
  v_seen_sources  text[] := '{}'::text[];
  v_total         integer := 0;
  v_step          integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ tài khoản Admin mới có quyền gộp tag chung.'
      USING ERRCODE = '42501';
  END IF;

  IF char_length(v_target_clean) < 1 OR char_length(v_target_clean) > 50 THEN
    RAISE EXCEPTION 'Tên tag đích không hợp lệ (1-50 ký tự).'
      USING ERRCODE = '22023';
  END IF;

  IF p_source_labels IS NULL OR array_length(p_source_labels, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_src IN ARRAY p_source_labels LOOP
    v_src_clean := regexp_replace(btrim(COALESCE(v_src, '')), '\s+', ' ', 'g');
    IF v_src_clean <> ''
       AND v_src_clean <> v_target_clean
       AND NOT (lower(v_src_clean) = ANY(v_seen_sources)) THEN
      IF lower(v_src_clean) <> v_target_lower OR v_src_clean <> v_target_clean THEN
        v_seen_sources := v_seen_sources || lower(v_src_clean);
        v_step := public.admin_rename_shared_tag(v_src_clean, v_target_clean, p_target_slug);
        v_total := v_total + v_step;
      END IF;
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_merge_shared_tags(text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_merge_shared_tags(text[], text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. CẬP NHẬT HÀM: public.admin_delete_shared_tag
--    Gỡ vĩnh viễn tag khỏi shared_tags, builtin_tag_overrides và user_* (Hệ thống/Admin)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_shared_tag(
  p_label text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid             uuid := (SELECT auth.uid());
  v_target          text := lower(regexp_replace(btrim(COALESCE(p_label, '')), '\s+', ' ', 'g'));
  v_updated         integer := 0;
  v_cnt             integer := 0;
  v_note_prefix     constant text := '__SEACLOVER_NOTE_V2__:';
  v_note_rec        record;
  v_note_json       jsonb;
  v_new_note_tags   jsonb;
  v_updated_json    jsonb;
  v_new_legacy_cat  text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ tài khoản Admin mới có quyền xóa tag chung.'
      USING ERRCODE = '42501';
  END IF;

  IF v_target = '' THEN
    RETURN 0;
  END IF;

  DELETE FROM public.shared_tags
  WHERE lower(regexp_replace(btrim(label), '\s+', ' ', 'g')) = v_target;

  -- Gỡ tag khỏi public.builtin_tag_overrides (vẫn giữ dòng với {}::text[] nếu rỗng để không khôi phục tag cũ)
  UPDATE public.builtin_tag_overrides
  SET
    tags = COALESCE(
      ARRAY(
        SELECT regexp_replace(btrim(t), '\s+', ' ', 'g')
        FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
        WHERE btrim(COALESCE(t, '')) <> ''
          AND lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) <> v_target
        ORDER BY ord
      ),
      '{}'::text[]
    ),
    updated_by = v_uid,
    updated_at = now()
  WHERE EXISTS (
    SELECT 1
    FROM unnest(COALESCE(tags, '{}'::text[])) AS t
    WHERE lower(regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g')) = v_target
  );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- Gỡ tag khỏi public.user_library_prompts (cột tags là text[])
  UPDATE public.user_library_prompts
  SET tags = COALESCE(
    ARRAY(
      SELECT regexp_replace(btrim(t), '\s+', ' ', 'g')
      FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
      WHERE btrim(COALESCE(t, '')) <> ''
        AND lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) <> v_target
      ORDER BY ord
    ),
    '{}'::text[]
  )
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(tags, '{}'::text[])) AS t
      WHERE lower(regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g')) = v_target
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- Gỡ tag khỏi public.user_ideas (cột tags là text[])
  UPDATE public.user_ideas
  SET tags = COALESCE(
    ARRAY(
      SELECT regexp_replace(btrim(t), '\s+', ' ', 'g')
      FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
      WHERE btrim(COALESCE(t, '')) <> ''
        AND lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) <> v_target
      ORDER BY ord
    ),
    '{}'::text[]
  )
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(tags, '{}'::text[])) AS t
      WHERE lower(regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g')) = v_target
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- Gỡ tag khỏi public.user_characters (cột role là text)
  UPDATE public.user_characters
  SET role = COALESCE((
    SELECT string_agg(regexp_replace(btrim(t), '\s+', ' ', 'g'), ' / ' ORDER BY ord)
    FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,|]\s*') WITH ORDINALITY AS x(t, ord)
    WHERE btrim(COALESCE(t, '')) <> ''
      AND lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) <> v_target
  ), '')
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,|]\s*') AS t
      WHERE lower(regexp_replace(btrim(COALESCE(t, '')), '\s+', ' ', 'g')) = v_target
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- Gỡ tag khỏi public.user_notes (cột category_offline)
  FOR v_note_rec IN
    SELECT user_id, item_id, category_offline
    FROM public.user_notes
    WHERE is_deleted = false
      AND (is_system = true OR user_id = v_uid)
      AND category_offline IS NOT NULL
      AND btrim(category_offline) <> ''
  LOOP
    IF left(v_note_rec.category_offline, char_length(v_note_prefix)) = v_note_prefix THEN
      BEGIN
        v_note_json := substring(v_note_rec.category_offline FROM char_length(v_note_prefix) + 1)::jsonb;
        IF jsonb_typeof(v_note_json->'tags') = 'array'
           AND EXISTS (
             SELECT 1
             FROM jsonb_array_elements_text(v_note_json->'tags') AS nt
             WHERE lower(regexp_replace(btrim(COALESCE(nt, '')), '\s+', ' ', 'g')) = v_target
           ) THEN
          SELECT COALESCE(jsonb_agg(regexp_replace(btrim(t), '\s+', ' ', 'g') ORDER BY ord), '[]'::jsonb)
          INTO v_new_note_tags
          FROM jsonb_array_elements_text(v_note_json->'tags') WITH ORDINALITY AS x(t, ord)
          WHERE btrim(COALESCE(t, '')) <> ''
            AND lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) <> v_target;

          v_updated_json := CASE
            WHEN jsonb_array_length(v_new_note_tags) = 0 THEN v_note_json - 'tags'
            ELSE jsonb_set(v_note_json, '{tags}', v_new_note_tags, true)
          END;

          UPDATE public.user_notes
          SET category_offline = v_note_prefix || v_updated_json::text
          WHERE user_id = v_note_rec.user_id
            AND item_id = v_note_rec.item_id;

          GET DIAGNOSTICS v_cnt = ROW_COUNT;
          v_updated := v_updated + v_cnt;
        END IF;
      EXCEPTION WHEN SQLSTATE '22P02' THEN
        NULL;
      END;
    ELSIF EXISTS (
      SELECT 1
      FROM regexp_split_to_table(v_note_rec.category_offline, '\s*[/,]\s*') AS nt
      WHERE lower(regexp_replace(btrim(COALESCE(nt, '')), '\s+', ' ', 'g')) = v_target
    ) THEN
      SELECT string_agg(regexp_replace(btrim(t), '\s+', ' ', 'g'), ' / ' ORDER BY ord)
      INTO v_new_legacy_cat
      FROM regexp_split_to_table(v_note_rec.category_offline, '\s*[/,]\s*') WITH ORDINALITY AS x(t, ord)
      WHERE btrim(COALESCE(t, '')) <> ''
        AND lower(regexp_replace(btrim(t), '\s+', ' ', 'g')) <> v_target;

      UPDATE public.user_notes
      SET category_offline = COALESCE(v_new_legacy_cat, '')
      WHERE user_id = v_note_rec.user_id
        AND item_id = v_note_rec.item_id;

      GET DIAGNOSTICS v_cnt = ROW_COUNT;
      v_updated := v_updated + v_cnt;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_shared_tag(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_shared_tag(text) TO authenticated;
