-- ============================================================================
-- SéaClover — Anonymous Guest Commenting & Guest Read-Only Hardening
-- Migration: 010_anonymous_guest_comments.sql
--
-- Mục tiêu:
--   1. Cho phép khách chưa đăng nhập (anon) bình luận ẩn danh công khai trên các
--      nhân vật công khai / hệ thống thông qua RPC SECURITY DEFINER an toàn:
--      `public.create_anonymous_character_comment(...)`.
--   2. Chuẩn hóa tên hiển thị ở phía server theo đúng định dạng cố định:
--      "Khách qua đường (<Tên tự đặt hoặc 4 chữ số 1000–9999>)".
--   3. Chống spam server-side bằng bảng rate limit nội bộ chỉ lưu mã băm SHA-256
--      (không lưu IP thô hay thông tin nhận diện thiết bị thô).
--   4. Khóa chặt mọi quyền ghi trực tiếp từ role `anon` vào toàn bộ bảng dữ liệu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MỞ RỘNG BẢNG public.character_comments CHO BÌNH LUẬN ẨN DANH
-- ----------------------------------------------------------------------------

ALTER TABLE public.character_comments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.character_comments
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

ALTER TABLE public.character_comments
  ADD COLUMN IF NOT EXISTS guest_display_name text;

ALTER TABLE public.character_comments
  DROP CONSTRAINT IF EXISTS character_comments_anonymous_identity_consistent;

ALTER TABLE public.character_comments
  ADD CONSTRAINT character_comments_anonymous_identity_consistent
  CHECK (
    (
      is_anonymous = false
      AND user_id IS NOT NULL
      AND guest_display_name IS NULL
    )
    OR
    (
      is_anonymous = true
      AND user_id IS NULL
      AND guest_display_name IS NOT NULL
      AND char_length(guest_display_name) <= 80
      AND guest_display_name ~ '^Khách qua đường \(.+\)$'
    )
  );

CREATE INDEX IF NOT EXISTS idx_character_comments_anonymous_moderation
  ON public.character_comments (character_owner_id, character_item_id, is_anonymous, is_hidden, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. CẬP NHẬT TRIGGER BẢO VỆ INSERT / UPDATE TRÊN public.character_comments
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_character_comments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'Khách ẩn danh chỉ được gửi bình luận qua RPC được cấp phép.'
        USING ERRCODE = '42501';
    END IF;

    v_uid := (SELECT auth.uid());
    IF v_uid IS NULL OR NEW.user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Phiên đăng nhập không hợp lệ để gửi bình luận thành viên.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.is_anonymous = true OR NEW.guest_display_name IS NOT NULL THEN
      RAISE EXCEPTION 'Tài khoản thành viên không thể tự gắn cờ bình luận ẩn danh.'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.can_interact_with_content('character', NEW.character_owner_id, NEW.character_item_id) THEN
      RAISE EXCEPTION 'Không thể bình luận vào nhân vật chưa công khai hoặc không tồn tại.'
        USING ERRCODE = '42501';
    END IF;

    NEW.content := btrim(regexp_replace(coalesce(NEW.content, ''), '[[:cntrl:]]+', '', 'g'));
    IF char_length(NEW.content) = 0 OR char_length(NEW.content) > 1500 THEN
      RAISE EXCEPTION 'Nội dung bình luận phải dài từ 1 đến 1500 ký tự.'
        USING ERRCODE = '22023';
    END IF;

    NEW.is_anonymous := false;
    NEW.guest_display_name := NULL;
    NEW.is_hidden := false;
    NEW.hidden_reason := NULL;
    NEW.hidden_by := NULL;
    NEW.hidden_at := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
  END IF;

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
    v_uid := (SELECT auth.uid());
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'Bạn cần đăng nhập để cập nhật bình luận.'
        USING ERRCODE = '42501';
    END IF;

    v_is_admin := public.is_admin();

    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.character_owner_id IS DISTINCT FROM OLD.character_owner_id
      OR NEW.character_item_id IS DISTINCT FROM OLD.character_item_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.is_anonymous IS DISTINCT FROM OLD.is_anonymous
      OR NEW.guest_display_name IS DISTINCT FROM OLD.guest_display_name
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Không được phép thay đổi thông tin định danh của bình luận.'
        USING ERRCODE = '42501';
    END IF;

    IF NOT v_is_admin THEN
      IF OLD.is_anonymous = true OR OLD.user_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'Bạn không có quyền chỉnh sửa bình luận này.'
          USING ERRCODE = '42501';
      END IF;

      NEW.content := btrim(regexp_replace(coalesce(NEW.content, ''), '[[:cntrl:]]+', '', 'g'));
      IF char_length(NEW.content) = 0 OR char_length(NEW.content) > 1500 THEN
        RAISE EXCEPTION 'Nội dung bình luận phải dài từ 1 đến 1500 ký tự.'
          USING ERRCODE = '22023';
      END IF;

      NEW.is_hidden := OLD.is_hidden;
      NEW.hidden_reason := OLD.hidden_reason;
      NEW.hidden_by := OLD.hidden_by;
      NEW.hidden_at := OLD.hidden_at;
    ELSE
      IF OLD.is_anonymous = true OR OLD.user_id IS DISTINCT FROM v_uid THEN
        IF NEW.content IS DISTINCT FROM OLD.content THEN
          RAISE EXCEPTION 'Admin chỉ được ẩn/hiện hoặc xóa bình luận của người khác, không được sửa nội dung.'
            USING ERRCODE = '42501';
        END IF;
      ELSE
        NEW.content := btrim(regexp_replace(coalesce(NEW.content, ''), '[[:cntrl:]]+', '', 'g'));
        IF char_length(NEW.content) = 0 OR char_length(NEW.content) > 1500 THEN
          RAISE EXCEPTION 'Nội dung bình luận phải dài từ 1 đến 1500 ký tự.'
            USING ERRCODE = '22023';
        END IF;
      END IF;

      IF NEW.is_hidden = true AND OLD.is_hidden = false THEN
        NEW.hidden_by := v_uid;
        NEW.hidden_at := now();
        NEW.hidden_reason := NULLIF(btrim(coalesce(NEW.hidden_reason, '')), '');
      ELSIF NEW.is_hidden = false THEN
        NEW.hidden_by := NULL;
        NEW.hidden_at := NULL;
        NEW.hidden_reason := NULL;
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RLS & QUYỀN TRUY CẬP TỐI THIỂU CHO BÌNH LUẬN VÀ BẢNG DỮ LIỆU
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "character_comments_select_visible" ON public.character_comments;
CREATE POLICY "character_comments_select_visible"
  ON public.character_comments FOR SELECT
  TO anon, authenticated
  USING (
    is_hidden = false
    OR public.is_admin()
    OR ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
  );

DROP POLICY IF EXISTS "character_comments_insert_authenticated" ON public.character_comments;
CREATE POLICY "character_comments_insert_authenticated"
  ON public.character_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_anonymous = false
    AND guest_display_name IS NULL
    AND (SELECT auth.uid()) = user_id
    AND public.can_interact_with_content('character', character_owner_id, character_item_id)
  );

DROP POLICY IF EXISTS "character_comments_update_owner_or_admin" ON public.character_comments;
CREATE POLICY "character_comments_update_owner_or_admin"
  ON public.character_comments FOR UPDATE
  TO authenticated
  USING (((NOT is_anonymous) AND (SELECT auth.uid()) = user_id) OR public.is_admin())
  WITH CHECK (((NOT is_anonymous) AND (SELECT auth.uid()) = user_id) OR public.is_admin());

DROP POLICY IF EXISTS "character_comments_delete_owner_or_admin" ON public.character_comments;
CREATE POLICY "character_comments_delete_owner_or_admin"
  ON public.character_comments FOR DELETE
  TO authenticated
  USING (((NOT is_anonymous) AND (SELECT auth.uid()) = user_id) OR public.is_admin());

-- Chặn tuyệt đối mọi quyền ghi trực tiếp từ `anon` lên các bảng ứng dụng
REVOKE INSERT, UPDATE, DELETE ON TABLE public.character_comments FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_characters FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_notes FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_ideas FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_library_prompts FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.prompt_ratings FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.content_likes FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.system_announcements FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.public_profiles FROM PUBLIC, anon;

DO $$
BEGIN
  IF to_regclass('public.shared_tags') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.shared_tags FROM PUBLIC, anon';
  END IF;
  IF to_regclass('public.builtin_tag_overrides') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.builtin_tag_overrides FROM PUBLIC, anon';
  END IF;
  IF to_regclass('public.builtin_content_registry') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.builtin_content_registry FROM PUBLIC, anon';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 4. BẢNG RATE LIMIT NỘI BỘ CHỐNG SPAM BÌNH LUẬN ẨN DANH (CHỈ LƯU HASH)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.anonymous_comment_rate_limits (
  bucket_key        text        PRIMARY KEY,
  window_start      timestamptz NOT NULL DEFAULT now(),
  request_count     integer     NOT NULL DEFAULT 1,
  last_request_at   timestamptz NOT NULL DEFAULT now(),
  last_content_hash text,
  last_target_key   text
);

ALTER TABLE public.anonymous_comment_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.anonymous_comment_rate_limits FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. RPC GỬI BÌNH LUẬN ẨN DANH CHO KHÁCH CHƯA ĐĂNG NHẬP
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_anonymous_character_comment(
  p_character_owner_id uuid,
  p_character_item_id text,
  p_guest_name text,
  p_content text,
  p_client_token text DEFAULT NULL
)
RETURNS public.character_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_item_id text;
  v_content text;
  v_raw_label text;
  v_label text;
  v_full_guest_name text;
  v_headers jsonb;
  v_raw_ip text;
  v_ip_hash text;
  v_token_clean text;
  v_token_hash text;
  v_target_key text;
  v_content_hash text;
  v_now timestamptz := now();
  v_bucket_key text;
  v_existing public.anonymous_comment_rate_limits%ROWTYPE;
  v_inserted public.character_comments%ROWTYPE;
  v_bucket_list text[] := ARRAY[]::text[];
  v_max_window_requests integer;
  v_target_bucket text;
BEGIN
  v_uid := (SELECT auth.uid());
  IF v_uid IS NOT NULL THEN
    RAISE EXCEPTION 'Bạn đang đăng nhập, vui lòng gửi bình luận bằng tài khoản thành viên.'
      USING ERRCODE = '42501';
  END IF;

  v_item_id := btrim(coalesce(p_character_item_id, ''));
  IF p_character_owner_id IS NULL OR char_length(v_item_id) = 0 OR char_length(v_item_id) > 200 THEN
    RAISE EXCEPTION 'Không xác định được nhân vật cần bình luận.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_interact_with_content('character', p_character_owner_id, v_item_id) THEN
    RAISE EXCEPTION 'Không thể bình luận vào nhân vật chưa công khai hoặc không tồn tại.'
      USING ERRCODE = '42501';
  END IF;

  -- Làm sạch nội dung bình luận (loại bỏ ký tự điều khiển, giữ nguyên xuống dòng hợp lệ)
  v_content := btrim(regexp_replace(coalesce(p_content, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+', '', 'g'));
  IF char_length(v_content) = 0 OR char_length(v_content) > 1500 THEN
    RAISE EXCEPTION 'Nội dung bình luận phải dài từ 1 đến 1500 ký tự.'
      USING ERRCODE = '22023';
  END IF;

  -- Chuẩn hóa tên tự đặt của khách & luôn ghép tiền tố cố định "Khách qua đường (...)"
  v_raw_label := btrim(regexp_replace(
    regexp_replace(coalesce(p_guest_name, ''), '[[:cntrl:]]+', ' ', 'g'),
    '\s+',
    ' ',
    'g'
  ));

  IF v_raw_label ~* '^khách qua đường\s*\((.+)\)$' THEN
    v_raw_label := btrim(regexp_replace(v_raw_label, '^khách qua đường\s*\((.+)\)$', '\1', 'i'));
  ELSIF v_raw_label ~* '^khách qua đường[\s:–—-]*' THEN
    v_raw_label := btrim(regexp_replace(v_raw_label, '^khách qua đường[\s:–—-]*', '', 'i'));
  END IF;

  v_label := btrim(left(v_raw_label, 40));
  IF v_label = '' THEN
    v_label := (1000 + floor(random() * 9000)::int)::text;
  END IF;

  v_full_guest_name := 'Khách qua đường (' || v_label || ')';

  -- Kiểm tra chống spam bằng mã băm SHA-256 (từ IP header / client token / mục tiêu)
  BEGIN
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::jsonb;
  END;

  v_raw_ip := nullif(btrim(coalesce(
    v_headers->>'cf-connecting-ip',
    split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1),
    v_headers->>'x-real-ip',
    ''
  )), '');

  v_target_key := p_character_owner_id::text || ':' || v_item_id;
  v_content_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(lower(v_content), 'UTF8')),
    'hex'
  );

  IF v_raw_ip IS NOT NULL THEN
    v_ip_hash := pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to('sc-ip:' || v_raw_ip, 'UTF8')),
      'hex'
    );
    v_bucket_list := array_append(v_bucket_list, 'ip:' || v_ip_hash);
  END IF;

  v_token_clean := btrim(regexp_replace(coalesce(p_client_token, ''), '[^a-zA-Z0-9_-]', '', 'g'));
  IF char_length(v_token_clean) >= 8 AND char_length(v_token_clean) <= 100 THEN
    v_token_hash := pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to('sc-tok:' || v_token_clean, 'UTF8')),
      'hex'
    );
    v_bucket_list := array_append(v_bucket_list, 'tok:' || v_token_hash);
  END IF;

  v_target_bucket := 'tgt:' || pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to('sc-tgt:' || v_target_key, 'UTF8')),
    'hex'
  );

  -- Dọn bản ghi rate limit quá 1 giờ để bảng luôn gọn
  DELETE FROM public.anonymous_comment_rate_limits
  WHERE last_request_at < v_now - interval '1 hour';

  -- 1) Kiểm tra giới hạn theo từng khách (IP hash / browser token hash)
  FOREACH v_bucket_key IN ARRAY v_bucket_list LOOP
    SELECT *
    INTO v_existing
    FROM public.anonymous_comment_rate_limits
    WHERE bucket_key = v_bucket_key
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing.last_request_at > v_now - interval '8 seconds' THEN
        RAISE EXCEPTION 'Bạn gửi bình luận hơi nhanh. Vui lòng chờ vài giây rồi thử lại.'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_existing.last_content_hash = v_content_hash
        AND v_existing.last_target_key = v_target_key
        AND v_existing.last_request_at > v_now - interval '120 seconds' THEN
        RAISE EXCEPTION 'Bình luận này vừa được gửi trước đó. Vui lòng không gửi trùng lặp.'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_existing.window_start > v_now - interval '10 minutes' THEN
        v_max_window_requests := 5;
        IF v_existing.request_count >= v_max_window_requests THEN
          RAISE EXCEPTION 'Bạn đã gửi quá nhiều bình luận ẩn danh trong thời gian ngắn. Vui lòng thử lại sau ít phút.'
            USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.anonymous_comment_rate_limits
        SET
          request_count = v_existing.request_count + 1,
          last_request_at = v_now,
          last_content_hash = v_content_hash,
          last_target_key = v_target_key
        WHERE bucket_key = v_bucket_key;
      ELSE
        UPDATE public.anonymous_comment_rate_limits
        SET
          window_start = v_now,
          request_count = 1,
          last_request_at = v_now,
          last_content_hash = v_content_hash,
          last_target_key = v_target_key
        WHERE bucket_key = v_bucket_key;
      END IF;
    ELSE
      INSERT INTO public.anonymous_comment_rate_limits (
        bucket_key,
        window_start,
        request_count,
        last_request_at,
        last_content_hash,
        last_target_key
      )
      VALUES (
        v_bucket_key,
        v_now,
        1,
        v_now,
        v_content_hash,
        v_target_key
      );
    END IF;
  END LOOP;

  -- 2) Kiểm tra tổng lưu lượng ẩn danh trên cùng một nhân vật để tránh flood
  SELECT *
  INTO v_existing
  FROM public.anonymous_comment_rate_limits
  WHERE bucket_key = v_target_bucket
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.last_content_hash = v_content_hash
      AND v_existing.last_request_at > v_now - interval '20 seconds' THEN
      RAISE EXCEPTION 'Bình luận giống hệt vừa được gửi gần đây. Vui lòng chờ một chút.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_existing.window_start > v_now - interval '10 minutes' THEN
      IF v_existing.request_count >= 20 THEN
        RAISE EXCEPTION 'Nhân vật này đang nhận quá nhiều bình luận ẩn danh liên tục. Vui lòng thử lại sau ít phút.'
          USING ERRCODE = 'P0001';
      END IF;

      UPDATE public.anonymous_comment_rate_limits
      SET
        request_count = v_existing.request_count + 1,
        last_request_at = v_now,
        last_content_hash = v_content_hash,
        last_target_key = v_target_key
      WHERE bucket_key = v_target_bucket;
    ELSE
      UPDATE public.anonymous_comment_rate_limits
      SET
        window_start = v_now,
        request_count = 1,
        last_request_at = v_now,
        last_content_hash = v_content_hash,
        last_target_key = v_target_key
      WHERE bucket_key = v_target_bucket;
    END IF;
  ELSE
    INSERT INTO public.anonymous_comment_rate_limits (
      bucket_key,
      window_start,
      request_count,
      last_request_at,
      last_content_hash,
      last_target_key
    )
    VALUES (
      v_target_bucket,
      v_now,
      1,
      v_now,
      v_content_hash,
      v_target_key
    );
  END IF;

  INSERT INTO public.character_comments (
    character_owner_id,
    character_item_id,
    user_id,
    is_anonymous,
    guest_display_name,
    content,
    is_hidden
  )
  VALUES (
    p_character_owner_id,
    v_item_id,
    NULL,
    true,
    v_full_guest_name,
    v_content,
    false
  )
  RETURNING * INTO v_inserted;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_anonymous_character_comment(uuid, text, text, text, text)
  FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_anonymous_character_comment(uuid, text, text, text, text)
  TO anon;
