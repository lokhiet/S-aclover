-- ============================================================================
-- SéaClover — Phase 7: Sửa triệt để lỗi kiểu dữ liệu text[] / jsonb & tối ưu
-- các hàm RPC quản lý tag chung (thêm, đổi tên, gộp, xóa)
-- Migration: 007_fix_tag_management.sql
--
-- Chạy bổ sung trực tiếp SAU 006_shared_tags.sql (KHÔNG cần chạy lại 006).
--
-- Nội dung sửa:
--   1. Sửa lỗi `COALESCE types text[] and jsonb cannot be matched` trên cột
--      `public.user_library_prompts.tags` (kiểu thực tế trong DB là `text[]`).
--   2. Chuẩn hóa toàn bộ phép COALESCE / unnest / dedupe trên `shared_tags.aliases`
--      (`text[]`), `user_library_prompts.tags` (`text[]`), `user_ideas.tags` (`text[]`),
--      `user_characters.role` (`text`) và `user_notes.category_offline` (`text`).
--   3. Bảo toàn aliases của tag nguồn khi gộp sang tag đích và khử trùng lặp
--      không phân biệt hoa/thường trong từng bài.
--   4. Chỉ tác động lên `public.shared_tags` và các bản ghi Hệ thống / thuộc
--      chính Admin (`is_deleted = false AND (is_system = true OR user_id = v_uid)`).
--      Toàn bộ thao tác chạy nguyên tử trong 1 transaction PostgreSQL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SỬA HÀM: public.admin_upsert_shared_tag
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_upsert_shared_tag(
  p_slug        text,
  p_label       text,
  p_aliases     text[] DEFAULT '{}'::text[],
  p_description text   DEFAULT ''
)
RETURNS public.shared_tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid           uuid := (SELECT auth.uid());
  v_slug          text := regexp_replace(lower(btrim(COALESCE(p_slug, ''))), '[^a-z0-9-]+', '-', 'g');
  v_label         text := regexp_replace(btrim(COALESCE(p_label, '')), '\s+', ' ', 'g');
  v_label_lower   text := lower(v_label);
  v_clean_aliases text[];
  v_existing_slug text;
  v_row           public.shared_tags;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ tài khoản Admin mới có quyền quản lý danh mục tag chung.'
      USING ERRCODE = '42501';
  END IF;

  IF char_length(v_label) < 1 OR char_length(v_label) > 50 THEN
    RAISE EXCEPTION 'Tên tag phải từ 1 đến 50 ký tự.'
      USING ERRCODE = '22023';
  END IF;

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  IF char_length(v_slug) < 1 THEN
    v_slug := 'tag-' || substr(md5(v_label_lower), 1, 8);
  ELSIF char_length(v_slug) > 80 THEN
    v_slug := left(v_slug, 80);
  END IF;

  -- Làm sạch và khử trùng lặp mảng aliases (text[])
  SELECT COALESCE(
    ARRAY(
      SELECT chosen_alias
      FROM (
        SELECT
          (ARRAY_AGG(regexp_replace(btrim(a), '\s+', ' ', 'g') ORDER BY ord))[1] AS chosen_alias,
          MIN(ord) AS first_pos
        FROM unnest(COALESCE(p_aliases, '{}'::text[])) WITH ORDINALITY AS x(a, ord)
        WHERE btrim(COALESCE(a, '')) <> ''
          AND lower(regexp_replace(btrim(a), '\s+', ' ', 'g')) <> v_label_lower
        GROUP BY lower(regexp_replace(btrim(a), '\s+', ' ', 'g'))
      ) AS dedup
      ORDER BY first_pos
    ),
    '{}'::text[]
  )
  INTO v_clean_aliases;

  -- Nếu đã có dòng trùng label (khác slug), cập nhật dòng đó để tránh lỗi unique label
  SELECT s.slug
  INTO v_existing_slug
  FROM public.shared_tags AS s
  WHERE lower(btrim(s.label)) = v_label_lower
  LIMIT 1;

  IF v_existing_slug IS NOT NULL THEN
    UPDATE public.shared_tags
    SET
      label       = v_label,
      aliases     = v_clean_aliases,
      description = btrim(COALESCE(p_description, '')),
      updated_at  = now()
    WHERE slug = v_existing_slug
    RETURNING * INTO v_row;

    RETURN v_row;
  END IF;

  -- Nếu slug đã bị một nhãn khác sử dụng, tạo slug riêng an toàn
  IF EXISTS (
    SELECT 1
    FROM public.shared_tags AS s
    WHERE s.slug = v_slug
      AND lower(btrim(s.label)) <> v_label_lower
  ) THEN
    v_slug := left(v_slug, 71) || '-' || substr(md5(v_label_lower), 1, 8);
  END IF;

  INSERT INTO public.shared_tags (slug, label, aliases, description, created_by, created_at, updated_at)
  VALUES (
    v_slug,
    v_label,
    v_clean_aliases,
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

-- ----------------------------------------------------------------------------
-- 2. SỬA HÀM: public.admin_rename_shared_tag
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

  -- Chuẩn hóa slug đích (fallback an toàn nếu p_new_slug NULL hoặc rỗng)
  v_slug := regexp_replace(lower(btrim(COALESCE(p_new_slug, ''))), '[^a-z0-9-]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  IF char_length(v_slug) < 1 THEN
    v_slug := 'tag-' || substr(md5(v_new_lower), 1, 8);
  ELSIF char_length(v_slug) > 80 THEN
    v_slug := left(v_slug, 80);
  END IF;

  -- Lấy trước aliases & description của tag nguồn (nếu có trong shared_tags) để không bị mất khi xóa tag nguồn
  SELECT COALESCE(s.aliases, '{}'::text[]), COALESCE(s.description, '')
  INTO v_old_aliases, v_old_desc
  FROM public.shared_tags AS s
  WHERE lower(btrim(s.label)) = v_old_lower
  LIMIT 1;

  v_old_aliases := COALESCE(v_old_aliases, '{}'::text[]);
  v_old_desc := COALESCE(v_old_desc, '');

  -- 1) Cập nhật hoặc hợp nhất trong bảng public.shared_tags
  IF EXISTS (
    SELECT 1
    FROM public.shared_tags AS s
    WHERE lower(btrim(s.label)) = v_new_lower
      AND lower(btrim(s.label)) <> v_old_lower
  ) THEN
    -- Tag đích đã tồn tại -> gộp cả v_old và v_old_aliases vào aliases của tag đích, sau đó xóa tag nguồn
    UPDATE public.shared_tags AS s
    SET
      aliases = COALESCE(
        ARRAY(
          SELECT chosen_alias
          FROM (
            SELECT
              (ARRAY_AGG(btrim(a) ORDER BY ord))[1] AS chosen_alias,
              MIN(ord) AS first_pos
            FROM unnest(
              COALESCE(s.aliases, '{}'::text[])
              || v_old_aliases
              || ARRAY[v_old]::text[]
            ) WITH ORDINALITY AS x(a, ord)
            WHERE btrim(COALESCE(a, '')) <> ''
              AND lower(btrim(a)) <> v_new_lower
            GROUP BY lower(btrim(a))
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
    WHERE lower(btrim(s.label)) = v_new_lower;

    DELETE FROM public.shared_tags
    WHERE lower(btrim(label)) = v_old_lower;

  ELSIF EXISTS (
    SELECT 1
    FROM public.shared_tags AS s
    WHERE lower(btrim(s.label)) = v_old_lower
  ) THEN
    -- Chỉ tồn tại tag nguồn -> đổi label sang v_new và giữ v_old làm alias (nếu khác nhau)
    UPDATE public.shared_tags AS s
    SET
      label = v_new,
      aliases = COALESCE(
        ARRAY(
          SELECT chosen_alias
          FROM (
            SELECT
              (ARRAY_AGG(btrim(a) ORDER BY ord))[1] AS chosen_alias,
              MIN(ord) AS first_pos
            FROM unnest(
              COALESCE(s.aliases, '{}'::text[])
              || CASE WHEN v_old_lower <> v_new_lower THEN ARRAY[v_old]::text[] ELSE '{}'::text[] END
            ) WITH ORDINALITY AS x(a, ord)
            WHERE btrim(COALESCE(a, '')) <> ''
              AND lower(btrim(a)) <> v_new_lower
            GROUP BY lower(btrim(a))
          ) AS dedup
          ORDER BY first_pos
        ),
        '{}'::text[]
      ),
      updated_at = now()
    WHERE lower(btrim(s.label)) = v_old_lower;

  ELSE
    -- Cả tag nguồn lẫn tag đích đều chưa nằm trong shared_tags -> tạo bản ghi chuẩn hóa cho tag đích
    IF EXISTS (
      SELECT 1
      FROM public.shared_tags AS s
      WHERE s.slug = v_slug
        AND lower(btrim(s.label)) <> v_new_lower
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
              (ARRAY_AGG(btrim(a) ORDER BY ord))[1] AS chosen_alias,
              MIN(ord) AS first_pos
            FROM unnest(
              COALESCE(public.shared_tags.aliases, '{}'::text[])
              || COALESCE(EXCLUDED.aliases, '{}'::text[])
            ) WITH ORDINALITY AS x(a, ord)
            WHERE btrim(COALESCE(a, '')) <> ''
              AND lower(btrim(a)) <> v_new_lower
            GROUP BY lower(btrim(a))
          ) AS dedup
          ORDER BY first_pos
        ),
        '{}'::text[]
      ),
      updated_at = now();
  END IF;

  -- 2) Cập nhật tag trên bảng public.user_library_prompts (cột tags là text[])
  --    CHỈ tác động lên mục Hệ thống hoặc mục do chính Admin sở hữu
  UPDATE public.user_library_prompts
  SET tags = COALESCE(
    ARRAY(
      SELECT chosen_elem
      FROM (
        SELECT
          CASE
            WHEN bool_or(lower(btrim(t)) IN (v_old_lower, v_new_lower)) THEN v_new
            ELSE (ARRAY_AGG(btrim(t) ORDER BY ord))[1]
          END AS chosen_elem,
          MIN(ord) AS first_pos
        FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
        WHERE btrim(COALESCE(t, '')) <> ''
        GROUP BY lower(
          CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END
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
      WHERE lower(btrim(COALESCE(t, ''))) = v_old_lower
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 3) Cập nhật tag trên bảng public.user_ideas (cột tags là text[])
  --    CHỈ tác động lên mục Hệ thống hoặc mục do chính Admin sở hữu
  UPDATE public.user_ideas
  SET tags = COALESCE(
    ARRAY(
      SELECT chosen_elem
      FROM (
        SELECT
          CASE
            WHEN bool_or(lower(btrim(t)) IN (v_old_lower, v_new_lower)) THEN v_new
            ELSE (ARRAY_AGG(btrim(t) ORDER BY ord))[1]
          END AS chosen_elem,
          MIN(ord) AS first_pos
        FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
        WHERE btrim(COALESCE(t, '')) <> ''
        GROUP BY lower(
          CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END
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
      WHERE lower(btrim(COALESCE(t, ''))) = v_old_lower
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 4) Cập nhật role tag trên bảng public.user_characters (cột role là text)
  --    CHỈ tác động lên mục Hệ thống hoặc mục do chính Admin sở hữu
  UPDATE public.user_characters
  SET role = COALESCE((
    SELECT string_agg(chosen_elem, ' / ' ORDER BY first_pos)
    FROM (
      SELECT
        CASE
          WHEN bool_or(lower(btrim(t)) IN (v_old_lower, v_new_lower)) THEN v_new
          ELSE (ARRAY_AGG(btrim(t) ORDER BY ord))[1]
        END AS chosen_elem,
        MIN(ord) AS first_pos
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,|]\s*') WITH ORDINALITY AS x(t, ord)
      WHERE btrim(COALESCE(t, '')) <> ''
      GROUP BY lower(
        CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END
      )
    ) AS dedup
  ), role)
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,|]\s*') AS t
      WHERE lower(btrim(COALESCE(t, ''))) = v_old_lower
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- 5) Cập nhật tag trên bảng public.user_notes (cột category_offline lưu JSON V2 hoặc danh mục phân tách dấu / ,)
  --    CHỈ tác động lên mục Hệ thống hoặc mục do chính Admin sở hữu
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
             WHERE lower(btrim(COALESCE(nt, ''))) = v_old_lower
           ) THEN
          SELECT COALESCE(jsonb_agg(chosen_elem ORDER BY first_pos), '[]'::jsonb)
          INTO v_new_note_tags
          FROM (
            SELECT
              CASE
                WHEN bool_or(lower(btrim(t)) IN (v_old_lower, v_new_lower)) THEN v_new
                ELSE (ARRAY_AGG(btrim(t) ORDER BY ord))[1]
              END AS chosen_elem,
              MIN(ord) AS first_pos
            FROM jsonb_array_elements_text(v_note_json->'tags') WITH ORDINALITY AS x(t, ord)
            WHERE btrim(COALESCE(t, '')) <> ''
            GROUP BY lower(
              CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END
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
        -- Bỏ qua nếu bản ghi cũ không phải JSON hợp lệ
        NULL;
      END;
    ELSIF EXISTS (
      SELECT 1
      FROM regexp_split_to_table(v_note_rec.category_offline, '\s*[/,]\s*') AS nt
      WHERE lower(btrim(COALESCE(nt, ''))) = v_old_lower
    ) THEN
      SELECT string_agg(chosen_elem, ' / ' ORDER BY first_pos)
      INTO v_new_legacy_cat
      FROM (
        SELECT
          CASE
            WHEN bool_or(lower(btrim(t)) IN (v_old_lower, v_new_lower)) THEN v_new
            ELSE (ARRAY_AGG(btrim(t) ORDER BY ord))[1]
          END AS chosen_elem,
          MIN(ord) AS first_pos
        FROM regexp_split_to_table(v_note_rec.category_offline, '\s*[/,]\s*') WITH ORDINALITY AS x(t, ord)
        WHERE btrim(COALESCE(t, '')) <> ''
        GROUP BY lower(
          CASE WHEN lower(btrim(t)) = v_old_lower THEN v_new ELSE btrim(t) END
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
-- 3. SỬA HÀM: public.admin_merge_shared_tags
--    Chạy trọn vẹn trong 1 transaction: nếu có lỗi ở bất kỳ bước nào, PostgreSQL
--    tự động rollback toàn bộ, không bao giờ cập nhật dở dang hay mất dữ liệu.
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
      -- Chỉ bỏ qua nếu trùng chính xác cả chữ hoa/thường với tag đích;
      -- nếu khác hoa/thường (vd ghen -> Ghen) vẫn cho phép chuẩn hóa về tag đích.
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
-- 4. SỬA HÀM: public.admin_delete_shared_tag
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
  WHERE lower(btrim(label)) = v_target;

  -- Gỡ tag khỏi public.user_library_prompts (cột tags là text[])
  -- CHỈ tác động lên mục Hệ thống hoặc mục do chính Admin sở hữu
  UPDATE public.user_library_prompts
  SET tags = COALESCE(
    ARRAY(
      SELECT btrim(t)
      FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
      WHERE btrim(COALESCE(t, '')) <> ''
        AND lower(btrim(t)) <> v_target
      ORDER BY ord
    ),
    '{}'::text[]
  )
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(tags, '{}'::text[])) AS t
      WHERE lower(btrim(COALESCE(t, ''))) = v_target
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- Gỡ tag khỏi public.user_ideas (cột tags là text[])
  UPDATE public.user_ideas
  SET tags = COALESCE(
    ARRAY(
      SELECT btrim(t)
      FROM unnest(COALESCE(tags, '{}'::text[])) WITH ORDINALITY AS x(t, ord)
      WHERE btrim(COALESCE(t, '')) <> ''
        AND lower(btrim(t)) <> v_target
      ORDER BY ord
    ),
    '{}'::text[]
  )
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(tags, '{}'::text[])) AS t
      WHERE lower(btrim(COALESCE(t, ''))) = v_target
    );
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- Gỡ tag khỏi public.user_characters (cột role là text)
  UPDATE public.user_characters
  SET role = COALESCE((
    SELECT string_agg(btrim(t), ' / ' ORDER BY ord)
    FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,|]\s*') WITH ORDINALITY AS x(t, ord)
    WHERE btrim(COALESCE(t, '')) <> ''
      AND lower(btrim(t)) <> v_target
  ), '')
  WHERE is_deleted = false
    AND (is_system = true OR user_id = v_uid)
    AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(COALESCE(role, ''), '\s*[/,|]\s*') AS t
      WHERE lower(btrim(COALESCE(t, ''))) = v_target
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
             WHERE lower(btrim(COALESCE(nt, ''))) = v_target
           ) THEN
          SELECT COALESCE(jsonb_agg(btrim(t) ORDER BY ord), '[]'::jsonb)
          INTO v_new_note_tags
          FROM jsonb_array_elements_text(v_note_json->'tags') WITH ORDINALITY AS x(t, ord)
          WHERE btrim(COALESCE(t, '')) <> ''
            AND lower(btrim(t)) <> v_target;

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
      WHERE lower(btrim(COALESCE(nt, ''))) = v_target
    ) THEN
      SELECT string_agg(btrim(t), ' / ' ORDER BY ord)
      INTO v_new_legacy_cat
      FROM regexp_split_to_table(v_note_rec.category_offline, '\s*[/,]\s*') WITH ORDINALITY AS x(t, ord)
      WHERE btrim(COALESCE(t, '')) <> ''
        AND lower(btrim(t)) <> v_target;

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
