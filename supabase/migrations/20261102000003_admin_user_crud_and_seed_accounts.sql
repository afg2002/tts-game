-- Clean up temporary seeder
DROP FUNCTION IF EXISTS public._seed_compact_materials(jsonb);

-- Internal helper to provision an auth user + identity + profile cleanly
CREATE OR REPLACE FUNCTION public._provision_account(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text DEFAULT 'student',
  p_nim text DEFAULT NULL,
  p_class_name text DEFAULT '',
  p_phone text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_clean_email text := lower(trim(coalesce(p_email, '')));
  v_clean_nim text := nullif(upper(trim(coalesce(p_nim, ''))), '');
  v_clean_role text := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'student' END;
BEGIN
  IF v_clean_email = '' OR position('@' in v_clean_email) = 0 THEN
    RAISE EXCEPTION 'Format alamat email tidak valid.';
  END IF;

  IF length(coalesce(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Password minimal harus terdiri dari 6 karakter.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'Email "%" sudah terdaftar di sistem.', v_clean_email;
  END IF;

  IF v_clean_nim IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE upper(trim(nim)) = v_clean_nim
  ) THEN
    RAISE EXCEPTION 'NIM "%" sudah digunakan oleh pengguna lain.', v_clean_nim;
  END IF;

  IF v_clean_role = 'student' AND (
    trim(coalesce(p_full_name, '')) = '' OR
    v_clean_nim IS NULL OR
    trim(coalesce(p_class_name, '')) = ''
  ) THEN
    RAISE EXCEPTION 'Untuk akun Mahasiswa, Nama Lengkap, NIM, dan Kelas wajib diisi.';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_uid,
    'authenticated',
    'authenticated',
    v_clean_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_uid::text,
      'email', v_clean_email,
      'email_verified', true,
      'phone_verified', false,
      'full_name', trim(coalesce(p_full_name, '')),
      'nim', coalesce(v_clean_nim, ''),
      'class_name', trim(coalesce(p_class_name, ''))
    ),
    false,
    now(),
    now(),
    false,
    false
  );

  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_uid::text,
    v_uid,
    jsonb_build_object(
      'sub', v_uid::text,
      'email', v_clean_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  UPDATE public.profiles
  SET full_name = trim(coalesce(p_full_name, '')),
      nim = v_clean_nim,
      class_name = CASE WHEN v_clean_role = 'admin' THEN coalesce(trim(p_class_name), '') ELSE trim(coalesce(p_class_name, '')) END,
      role = v_clean_role,
      phone = trim(coalesce(p_phone, '')),
      is_active = true,
      updated_at = now()
  WHERE id = v_uid;

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public._provision_account(text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Admin RPC: Create User (Mahasiswa or Admin)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text DEFAULT 'student',
  p_nim text DEFAULT NULL,
  p_class_name text DEFAULT '',
  p_phone text DEFAULT ''
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_new_id uuid;
  v_profile public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin yang dapat menambahkan pengguna.';
  END IF;

  v_new_id := public._provision_account(
    p_email, p_password, p_full_name, p_role, p_nim, p_class_name, p_phone
  );

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_new_id;
  RETURN v_profile;
END;
$$;

-- Admin RPC: Update User (Profile + Role + Email + Optional Password Reset)
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_nim text DEFAULT NULL,
  p_class_name text DEFAULT '',
  p_phone text DEFAULT '',
  p_is_active boolean DEFAULT true,
  p_new_email text DEFAULT NULL,
  p_new_password text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_nim text := nullif(upper(trim(coalesce(p_nim, ''))), '');
  v_clean_email text := nullif(lower(trim(coalesce(p_new_email, ''))), '');
  v_clean_role text := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'student' END;
  v_profile public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin yang dapat mengubah data pengguna.';
  END IF;

  IF p_user_id = auth.uid() AND (v_clean_role <> 'admin' OR NOT coalesce(p_is_active, true)) THEN
    RAISE EXCEPTION 'Anda tidak dapat mencabut akses Admin atau menonaktifkan akun Anda sendiri.';
  END IF;

  IF v_clean_role = 'student' AND (
    trim(coalesce(p_full_name, '')) = '' OR
    v_clean_nim IS NULL OR
    trim(coalesce(p_class_name, '')) = ''
  ) THEN
    RAISE EXCEPTION 'Akun Mahasiswa wajib memiliki Nama Lengkap, NIM, dan Kelas.';
  END IF;

  IF v_clean_nim IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE upper(trim(nim)) = v_clean_nim AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'NIM "%" sudah digunakan oleh pengguna lain.', v_clean_nim;
  END IF;

  IF v_clean_email IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email AND id <> p_user_id) THEN
      RAISE EXCEPTION 'Email "%" sudah digunakan oleh akun lain.', v_clean_email;
    END IF;

    UPDATE auth.users
    SET email = v_clean_email, updated_at = now()
    WHERE id = p_user_id;

    UPDATE auth.identities
    SET identity_data = identity_data || jsonb_build_object('email', v_clean_email),
        updated_at = now()
    WHERE user_id = p_user_id AND provider = 'email';
  END IF;

  IF p_new_password IS NOT NULL AND trim(p_new_password) <> '' THEN
    IF length(p_new_password) < 6 THEN
      RAISE EXCEPTION 'Password baru minimal 6 karakter.';
    END IF;
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  UPDATE public.profiles
  SET email = coalesce(v_clean_email, email),
      full_name = trim(coalesce(p_full_name, '')),
      nim = v_clean_nim,
      class_name = trim(coalesce(p_class_name, '')),
      role = v_clean_role,
      phone = trim(coalesce(p_phone, '')),
      is_active = coalesce(p_is_active, true),
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak ditemukan.';
  END IF;

  RETURN v_profile;
END;
$$;

-- Admin RPC: Delete User Completely (Auth + Profile + Attempts)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin yang dapat menghapus pengguna.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Anda tidak dapat menghapus akun Admin Anda sendiri yang sedang aktif.';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN true;
END;
$$;

-- Admin RPC: Bulk Create Students (for fast class import)
CREATE OR REPLACE FUNCTION public.admin_bulk_create_students(p_students jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_item jsonb;
  v_created integer := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin yang dapat mengimpor data mahasiswa.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_students) LOOP
    BEGIN
      PERFORM public._provision_account(
        v_item ->> 'email',
        coalesce(nullif(v_item ->> 'password', ''), 'Medika2026!'),
        v_item ->> 'full_name',
        'student',
        v_item ->> 'nim',
        v_item ->> 'class_name',
        coalesce(v_item ->> 'phone', '')
      );
      v_created := v_created + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'nim', v_item ->> 'nim',
        'email', v_item ->> 'email',
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'errors', v_errors);
END;
$$;

-- Seed Initial Admin + Realistic Demo Students & Sample Attempts
DO $$
DECLARE
  v_admin_id uuid;
  v_mhs1_id uuid;
  v_mhs2_id uuid;
  v_mhs3_id uuid;
  v_mat record;
  v_key record;
  v_cells jsonb;
  v_cell_k text;
  v_cell_v text;
  v_counter integer;
  v_total_cells integer;
  v_correct_cells integer;
  v_total_slots integer;
  v_correct_slots integer;
  v_total_words integer;
  v_correct_words integer;
  v_item jsonb;
  v_ans text;
  v_r integer;
  v_c integer;
  v_k integer;
  v_word_ok boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'admin@medikakeperawatan.ac.id') THEN
    v_admin_id := public._provision_account(
      'admin@medikakeperawatan.ac.id',
      'AdminMedika2026!',
      'Ns. Administrator Medika, S.Kep., M.Kep.',
      'admin',
      NULL,
      'Tim Dosen Keperawatan',
      '081200001111'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'mhs1@medikakeperawatan.ac.id') THEN
    v_mhs1_id := public._provision_account(
      'mhs1@medikakeperawatan.ac.id',
      'Medika2026!',
      'Aulia Rahmawati',
      'student',
      '2410711001',
      'S1 Keperawatan - Kelas 1A',
      '081234560001'
    );

    -- Populate all 11 materials for mhs1 (high scores 92%-100%) so "11/11 Selesai" review & Admin matrix work out of the box
    FOR v_mat IN SELECT * FROM public.quiz_materials ORDER BY material_index LOOP
      SELECT * INTO v_key FROM public.quiz_answer_keys WHERE material_index = v_mat.material_index;
      v_cells := v_key.grid_solution;
      v_counter := 0;

      -- Introduce 2 realistic minor letter errors on odd-numbered materials
      IF (v_mat.material_index % 2) = 1 THEN
        FOR v_cell_k, v_cell_v IN SELECT key, value #>> '{}' FROM jsonb_each(v_key.grid_solution) LOOP
          v_counter := v_counter + 1;
          IF v_counter IN (5, 19) THEN
            v_cells := v_cells || jsonb_build_object(v_cell_k, CASE WHEN v_cell_v = 'A' THEN 'E' ELSE 'A' END);
          END IF;
        END LOOP;
      END IF;

      -- Calculate exact scores
      v_total_cells := 0; v_correct_cells := 0;
      FOR v_cell_k, v_cell_v IN SELECT key, value #>> '{}' FROM jsonb_each(v_key.grid_solution) LOOP
        v_total_cells := v_total_cells + 1;
        IF (v_cells ->> v_cell_k) = v_cell_v THEN v_correct_cells := v_correct_cells + 1; END IF;
      END LOOP;

      v_total_slots := 0; v_correct_slots := 0; v_total_words := 0; v_correct_words := 0;
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_key.across_answers) LOOP
        v_total_words := v_total_words + 1; v_ans := v_item ->> 'answer';
        v_r := (v_item ->> 'row')::int; v_c := (v_item ->> 'col')::int; v_word_ok := true;
        FOR v_k IN 0..(length(v_ans)-1) LOOP
          v_total_slots := v_total_slots + 1;
          IF (v_cells ->> (v_r::text || ',' || (v_c + v_k)::text)) = substring(v_ans FROM v_k+1 FOR 1) THEN
            v_correct_slots := v_correct_slots + 1;
          ELSE v_word_ok := false; END IF;
        END LOOP;
        IF v_word_ok THEN v_correct_words := v_correct_words + 1; END IF;
      END LOOP;

      FOR v_item IN SELECT value FROM jsonb_array_elements(v_key.down_answers) LOOP
        v_total_words := v_total_words + 1; v_ans := v_item ->> 'answer';
        v_r := (v_item ->> 'row')::int; v_c := (v_item ->> 'col')::int; v_word_ok := true;
        FOR v_k IN 0..(length(v_ans)-1) LOOP
          v_total_slots := v_total_slots + 1;
          IF (v_cells ->> ((v_r + v_k)::text || ',' || v_c::text)) = substring(v_ans FROM v_k+1 FOR 1) THEN
            v_correct_slots := v_correct_slots + 1;
          ELSE v_word_ok := false; END IF;
        END LOOP;
        IF v_word_ok THEN v_correct_words := v_correct_words + 1; END IF;
      END LOOP;

      INSERT INTO public.quiz_attempts (
        user_id, material_index, student_name_snapshot, student_nim_snapshot, student_class_snapshot,
        submitted_cells, total_cells, filled_cells, correct_cells, total_letter_slots, correct_letter_slots,
        total_words, filled_words, correct_words, score, word_score, duration_seconds, started_at, submitted_at
      ) VALUES (
        v_mhs1_id, v_mat.material_index, 'Aulia Rahmawati', '2410711001', 'S1 Keperawatan - Kelas 1A',
        v_cells, v_total_cells, v_total_cells, v_correct_cells, v_total_slots, v_correct_slots,
        v_total_words, v_total_words, v_correct_words,
        round((v_correct_slots::numeric / v_total_slots::numeric) * 100, 2),
        round((v_correct_words::numeric / v_total_words::numeric) * 100, 2),
        420 + (v_mat.material_index * 35),
        now() - ((12 - v_mat.material_index) || ' hours')::interval,
        now() - ((11 - v_mat.material_index) || ' hours')::interval
      );
    END LOOP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'mhs2@medikakeperawatan.ac.id') THEN
    v_mhs2_id := public._provision_account(
      'mhs2@medikakeperawatan.ac.id',
      'Medika2026!',
      'Bagas Pratama Putra',
      'student',
      '2410711002',
      'S1 Keperawatan - Kelas 1A',
      '081234560002'
    );

    -- Populate first 3 materials for mhs2 (in progress)
    FOR v_mat IN SELECT * FROM public.quiz_materials WHERE material_index IN (0, 1, 2) ORDER BY material_index LOOP
      SELECT * INTO v_key FROM public.quiz_answer_keys WHERE material_index = v_mat.material_index;
      v_cells := v_key.grid_solution;
      v_counter := 0;
      FOR v_cell_k, v_cell_v IN SELECT key, value #>> '{}' FROM jsonb_each(v_key.grid_solution) LOOP
        v_counter := v_counter + 1;
        IF (v_counter % 9) = 0 THEN
          v_cells := v_cells || jsonb_build_object(v_cell_k, CASE WHEN v_cell_v = 'I' THEN 'O' ELSE 'I' END);
        END IF;
      END LOOP;

      v_total_cells := 0; v_correct_cells := 0;
      FOR v_cell_k, v_cell_v IN SELECT key, value #>> '{}' FROM jsonb_each(v_key.grid_solution) LOOP
        v_total_cells := v_total_cells + 1;
        IF (v_cells ->> v_cell_k) = v_cell_v THEN v_correct_cells := v_correct_cells + 1; END IF;
      END LOOP;

      v_total_slots := 0; v_correct_slots := 0; v_total_words := 0; v_correct_words := 0;
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_key.across_answers) LOOP
        v_total_words := v_total_words + 1; v_ans := v_item ->> 'answer';
        v_r := (v_item ->> 'row')::int; v_c := (v_item ->> 'col')::int; v_word_ok := true;
        FOR v_k IN 0..(length(v_ans)-1) LOOP
          v_total_slots := v_total_slots + 1;
          IF (v_cells ->> (v_r::text || ',' || (v_c + v_k)::text)) = substring(v_ans FROM v_k+1 FOR 1) THEN
            v_correct_slots := v_correct_slots + 1;
          ELSE v_word_ok := false; END IF;
        END LOOP;
        IF v_word_ok THEN v_correct_words := v_correct_words + 1; END IF;
      END LOOP;
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_key.down_answers) LOOP
        v_total_words := v_total_words + 1; v_ans := v_item ->> 'answer';
        v_r := (v_item ->> 'row')::int; v_c := (v_item ->> 'col')::int; v_word_ok := true;
        FOR v_k IN 0..(length(v_ans)-1) LOOP
          v_total_slots := v_total_slots + 1;
          IF (v_cells ->> ((v_r + v_k)::text || ',' || v_c::text)) = substring(v_ans FROM v_k+1 FOR 1) THEN
            v_correct_slots := v_correct_slots + 1;
          ELSE v_word_ok := false; END IF;
        END LOOP;
        IF v_word_ok THEN v_correct_words := v_correct_words + 1; END IF;
      END LOOP;

      INSERT INTO public.quiz_attempts (
        user_id, material_index, student_name_snapshot, student_nim_snapshot, student_class_snapshot,
        submitted_cells, total_cells, filled_cells, correct_cells, total_letter_slots, correct_letter_slots,
        total_words, filled_words, correct_words, score, word_score, duration_seconds, started_at, submitted_at
      ) VALUES (
        v_mhs2_id, v_mat.material_index, 'Bagas Pratama Putra', '2410711002', 'S1 Keperawatan - Kelas 1A',
        v_cells, v_total_cells, v_total_cells, v_correct_cells, v_total_slots, v_correct_slots,
        v_total_words, v_total_words, v_correct_words,
        round((v_correct_slots::numeric / v_total_slots::numeric) * 100, 2),
        round((v_correct_words::numeric / v_total_words::numeric) * 100, 2),
        510 + (v_mat.material_index * 40),
        now() - ((5 - v_mat.material_index) || ' hours')::interval,
        now() - ((4 - v_mat.material_index) || ' hours')::interval
      );
    END LOOP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'mhs3@medikakeperawatan.ac.id') THEN
    v_mhs3_id := public._provision_account(
      'mhs3@medikakeperawatan.ac.id',
      'Medika2026!',
      'Citra Lestari Putri',
      'student',
      '2410711015',
      'S1 Keperawatan - Kelas 1B',
      '081234560015'
    );

    -- Populate 2 materials for mhs3 in Kelas 1B
    FOR v_mat IN SELECT * FROM public.quiz_materials WHERE material_index IN (0, 2) ORDER BY material_index LOOP
      SELECT * INTO v_key FROM public.quiz_answer_keys WHERE material_index = v_mat.material_index;
      v_cells := v_key.grid_solution;
      INSERT INTO public.quiz_attempts (
        user_id, material_index, student_name_snapshot, student_nim_snapshot, student_class_snapshot,
        submitted_cells, total_cells, filled_cells, correct_cells, total_letter_slots, correct_letter_slots,
        total_words, filled_words, correct_words, score, word_score, duration_seconds, started_at, submitted_at
      ) VALUES (
        v_mhs3_id, v_mat.material_index, 'Citra Lestari Putri', '2410711015', 'S1 Keperawatan - Kelas 1B',
        v_cells, v_mat.total_cells, v_mat.total_cells, v_mat.total_cells,
        300, 300, v_mat.total_questions, v_mat.total_questions, v_mat.total_questions,
        100, 100, 480, now() - interval '2 hours', now() - interval '90 minutes'
      );
    END LOOP;
  END IF;
END;
$$;
