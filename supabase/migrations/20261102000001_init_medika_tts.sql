-- Medika Keperawatan: TTS Terminologi Kesehatan Schema, RLS & RPCs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Application Settings (Singleton)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  institution_name text NOT NULL DEFAULT 'Medika Keperawatan',
  program_name text NOT NULL DEFAULT 'Program Studi S1 Keperawatan',
  course_name text NOT NULL DEFAULT 'Evaluasi Terminologi Kesehatan',
  academic_year text NOT NULL DEFAULT '2026/2027',
  show_score_immediately boolean NOT NULL DEFAULT true,
  student_detail_visibility text NOT NULL DEFAULT 'after_all_completed'
    CHECK (student_detail_visibility IN ('after_all_completed', 'immediate_per_section', 'score_only')),
  show_correct_word_in_student_review boolean NOT NULL DEFAULT true,
  allow_self_registration boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Master Classes (Kelas Mahasiswa)
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  semester text NOT NULL DEFAULT '',
  lecturer_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. User Profiles (Mahasiswa & Admin)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  nim text,
  class_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  phone text NOT NULL DEFAULT '',
  avatar_color text NOT NULL DEFAULT '#0D9488',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_nim_unique_idx
  ON public.profiles (upper(trim(nim)))
  WHERE nim IS NOT NULL AND trim(nim) <> '';

CREATE INDEX IF NOT EXISTS profiles_class_name_idx ON public.profiles (class_name);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

-- 4. Quiz Materials (Public Puzzle Structure - NO Answer Keys)
CREATE TABLE IF NOT EXISTS public.quiz_materials (
  material_index integer PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  rows integer NOT NULL,
  cols integer NOT NULL,
  active_cells jsonb NOT NULL,
  positions jsonb NOT NULL,
  across_clues jsonb NOT NULL,
  down_clues jsonb NOT NULL,
  total_questions integer NOT NULL,
  total_cells integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Quiz Answer Keys (Strictly Admin-Only via RLS)
CREATE TABLE IF NOT EXISTS public.quiz_answer_keys (
  material_index integer PRIMARY KEY REFERENCES public.quiz_materials(material_index) ON DELETE CASCADE,
  grid_solution jsonb NOT NULL,
  across_answers jsonb NOT NULL,
  down_answers jsonb NOT NULL
);

-- 6. Quiz Attempts (1x Submit per Material per Student)
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  material_index integer NOT NULL REFERENCES public.quiz_materials(material_index) ON DELETE CASCADE,
  student_name_snapshot text NOT NULL,
  student_nim_snapshot text NOT NULL,
  student_class_snapshot text NOT NULL,
  submitted_cells jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_cells integer NOT NULL DEFAULT 0,
  filled_cells integer NOT NULL DEFAULT 0,
  correct_cells integer NOT NULL DEFAULT 0,
  total_letter_slots integer NOT NULL DEFAULT 0,
  correct_letter_slots integer NOT NULL DEFAULT 0,
  total_words integer NOT NULL DEFAULT 0,
  filled_words integer NOT NULL DEFAULT 0,
  correct_words integer NOT NULL DEFAULT 0,
  score numeric(5,2) NOT NULL DEFAULT 0,
  word_score numeric(5,2) NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_attempts_user_material_unique UNIQUE (user_id, material_index)
);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_idx ON public.quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_material_idx ON public.quiz_attempts (material_index);
CREATE INDEX IF NOT EXISTS quiz_attempts_submitted_at_idx ON public.quiz_attempts (submitted_at DESC);

-- Helper: Check if current authenticated user is active Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

-- Trigger: Sync new auth.users row into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_nim text;
  v_class text;
BEGIN
  v_full_name := trim(coalesce(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    ''
  ));
  v_nim := nullif(upper(trim(coalesce(NEW.raw_user_meta_data ->> 'nim', ''))), '');
  v_class := trim(coalesce(NEW.raw_user_meta_data ->> 'class_name', ''));

  -- Avoid unique NIM collision inside auth trigger if duplicate NIM passed
  IF v_nim IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE upper(trim(nim)) = v_nim AND id <> NEW.id
  ) THEN
    v_nim := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, nim, class_name, role)
  VALUES (
    NEW.id,
    coalesce(NEW.email, ''),
    v_full_name,
    v_nim,
    v_class,
    'student'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Guard non-admin profile updates against privilege escalation
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.nim IS NOT NULL THEN
    NEW.nim := nullif(upper(trim(NEW.nim)), '');
  END IF;

  -- Allow service_role / postgres superuser / admin full update
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin')
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admin cannot change role, email, or active status
  NEW.role := OLD.role;
  NEW.email := OLD.email;
  NEW.is_active := OLD.is_active;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Policies: app_settings
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update app_settings"
  ON public.app_settings FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policies: classes
CREATE POLICY "Anyone can read classes"
  ON public.classes FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert classes"
  ON public.classes FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update classes"
  ON public.classes FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete classes"
  ON public.classes FOR DELETE
  USING (public.is_admin());

-- Policies: profiles
CREATE POLICY "Users read own profile or admin reads all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users insert own student profile or admin inserts"
  ON public.profiles FOR INSERT
  WITH CHECK ((auth.uid() = id AND role = 'student') OR public.is_admin());

CREATE POLICY "Users update own profile or admin updates all"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- Policies: quiz_materials
CREATE POLICY "Authenticated and anon can read quiz_materials"
  ON public.quiz_materials FOR SELECT
  USING (true);

CREATE POLICY "Admins manage quiz_materials"
  ON public.quiz_materials FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policies: quiz_answer_keys (STRICTLY ADMIN ONLY!)
CREATE POLICY "Only admins can access quiz_answer_keys"
  ON public.quiz_answer_keys FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policies: quiz_attempts
CREATE POLICY "Users read own attempts or admin reads all"
  ON public.quiz_attempts FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can delete or reset attempts"
  ON public.quiz_attempts FOR DELETE
  USING (public.is_admin());

CREATE POLICY "Admins can update attempts"
  ON public.quiz_attempts FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RPC: Resolve NIM or Email for Login
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := trim(coalesce(p_identifier, ''));
  v_email text;
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  IF position('@' in v_clean) > 0 THEN
    RETURN lower(v_clean);
  END IF;

  SELECT email INTO v_email
  FROM public.profiles
  WHERE upper(trim(nim)) = upper(v_clean)
  LIMIT 1;

  RETURN v_email;
END;
$$;

-- RPC: Check NIM Availability
CREATE OR REPLACE FUNCTION public.check_nim_available(p_nim text, p_exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE upper(trim(nim)) = upper(trim(coalesce(p_nim, '')))
      AND trim(coalesce(p_nim, '')) <> ''
      AND (p_exclude_user_id IS NULL OR id <> p_exclude_user_id)
  );
$$;

-- RPC: Rename Class with Cascade to Student Profiles
CREATE OR REPLACE FUNCTION public.update_class_with_cascade(
  p_class_id uuid,
  p_code text,
  p_name text,
  p_semester text,
  p_lecturer_name text,
  p_is_active boolean,
  p_sort_order integer DEFAULT 0
)
RETURNS public.classes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_name text;
  v_updated public.classes;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin yang dapat mengubah data kelas.';
  END IF;

  SELECT name INTO v_old_name FROM public.classes WHERE id = p_class_id;
  IF v_old_name IS NULL THEN
    RAISE EXCEPTION 'Data kelas tidak ditemukan.';
  END IF;

  UPDATE public.classes
  SET code = upper(trim(p_code)),
      name = trim(p_name),
      semester = trim(coalesce(p_semester, '')),
      lecturer_name = trim(coalesce(p_lecturer_name, '')),
      is_active = coalesce(p_is_active, true),
      sort_order = coalesce(p_sort_order, 0),
      updated_at = now()
  WHERE id = p_class_id
  RETURNING * INTO v_updated;

  IF v_old_name <> trim(p_name) THEN
    UPDATE public.profiles
    SET class_name = trim(p_name), updated_at = now()
    WHERE class_name = v_old_name;
  END IF;

  RETURN v_updated;
END;
$$;

-- RPC: Submit Quiz Attempt (Server-side Grading + 1x Lock + Mandatory Identity Check)
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_material_index integer,
  p_submitted_cells jsonb,
  p_duration_seconds integer DEFAULT 0,
  p_started_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_material public.quiz_materials;
  v_key public.quiz_answer_keys;
  v_clean_cells jsonb := '{}'::jsonb;
  v_cell_key text;
  v_expected_letter text;
  v_given_letter text;
  v_total_cells integer := 0;
  v_filled_cells integer := 0;
  v_correct_cells integer := 0;
  v_total_slots integer := 0;
  v_correct_slots integer := 0;
  v_total_words integer := 0;
  v_filled_words integer := 0;
  v_correct_words integer := 0;
  v_item jsonb;
  v_ans text;
  v_row integer;
  v_col integer;
  v_k integer;
  v_coord text;
  v_ch text;
  v_word_built text;
  v_word_all_filled boolean;
  v_score numeric(5,2);
  v_word_score numeric(5,2);
  v_attempt public.quiz_attempts;
  v_settings public.app_settings;
  v_active_materials_count integer;
  v_completed_active_count integer;
  v_all_completed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan. Silakan login kembali.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profil pengguna tidak ditemukan.';
  END IF;

  IF NOT v_profile.is_active THEN
    RAISE EXCEPTION 'Akun Anda sedang dinonaktifkan oleh Admin.';
  END IF;

  IF v_profile.role = 'student' AND (
    trim(coalesce(v_profile.full_name, '')) = '' OR
    trim(coalesce(v_profile.nim, '')) = '' OR
    trim(coalesce(v_profile.class_name, '')) = ''
  ) THEN
    RAISE EXCEPTION 'Identitas Nama Lengkap, NIM, dan Kelas wajib dilengkapi sebelum mengumpulkan TTS.';
  END IF;

  SELECT * INTO v_material FROM public.quiz_materials WHERE material_index = p_material_index;
  IF v_material.material_index IS NULL THEN
    RAISE EXCEPTION 'Materi TTS tidak ditemukan.';
  END IF;

  IF NOT v_material.is_active AND v_profile.role <> 'admin' THEN
    RAISE EXCEPTION 'Materi TTS ini sedang ditutup oleh Admin.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE user_id = v_uid AND material_index = p_material_index
  ) THEN
    RAISE EXCEPTION 'Anda sudah mengumpulkan jawaban pada materi ini. Setiap materi kesehatan hanya dapat diisi 1 kali.';
  END IF;

  SELECT * INTO v_key FROM public.quiz_answer_keys WHERE material_index = p_material_index;
  IF v_key.material_index IS NULL THEN
    RAISE EXCEPTION 'Kunci jawaban materi belum tersedia.';
  END IF;

  -- Evaluate unique grid cells
  FOR v_cell_key, v_expected_letter IN
    SELECT key, value #>> '{}' FROM jsonb_each(v_key.grid_solution)
  LOOP
    v_total_cells := v_total_cells + 1;
    v_given_letter := regexp_replace(upper(coalesce(p_submitted_cells ->> v_cell_key, '')), '[^A-Z]', '', 'g');
    IF length(v_given_letter) > 0 THEN
      v_given_letter := substring(v_given_letter FROM 1 FOR 1);
      v_clean_cells := v_clean_cells || jsonb_build_object(v_cell_key, v_given_letter);
      v_filled_cells := v_filled_cells + 1;
      IF v_given_letter = v_expected_letter THEN
        v_correct_cells := v_correct_cells + 1;
      END IF;
    END IF;
  END LOOP;

  -- Evaluate ACROSS words (dr = 0, dc = 1)
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_key.across_answers)
  LOOP
    v_total_words := v_total_words + 1;
    v_ans := v_item ->> 'answer';
    v_row := (v_item ->> 'row')::integer;
    v_col := (v_item ->> 'col')::integer;
    v_word_built := '';
    v_word_all_filled := true;

    FOR v_k IN 0..(length(v_ans) - 1) LOOP
      v_coord := v_row::text || ',' || (v_col + v_k)::text;
      v_total_slots := v_total_slots + 1;
      v_ch := coalesce(v_clean_cells ->> v_coord, '');
      IF v_ch = '' THEN
        v_word_all_filled := false;
        v_word_built := v_word_built || '_';
      ELSE
        v_word_built := v_word_built || v_ch;
        IF v_ch = substring(v_ans FROM v_k + 1 FOR 1) THEN
          v_correct_slots := v_correct_slots + 1;
        END IF;
      END IF;
    END LOOP;

    IF v_word_all_filled THEN
      v_filled_words := v_filled_words + 1;
    END IF;
    IF v_word_built = v_ans THEN
      v_correct_words := v_correct_words + 1;
    END IF;
  END LOOP;

  -- Evaluate DOWN words (dr = 1, dc = 0)
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_key.down_answers)
  LOOP
    v_total_words := v_total_words + 1;
    v_ans := v_item ->> 'answer';
    v_row := (v_item ->> 'row')::integer;
    v_col := (v_item ->> 'col')::integer;
    v_word_built := '';
    v_word_all_filled := true;

    FOR v_k IN 0..(length(v_ans) - 1) LOOP
      v_coord := (v_row + v_k)::text || ',' || v_col::text;
      v_total_slots := v_total_slots + 1;
      v_ch := coalesce(v_clean_cells ->> v_coord, '');
      IF v_ch = '' THEN
        v_word_all_filled := false;
        v_word_built := v_word_built || '_';
      ELSE
        v_word_built := v_word_built || v_ch;
        IF v_ch = substring(v_ans FROM v_k + 1 FOR 1) THEN
          v_correct_slots := v_correct_slots + 1;
        END IF;
      END IF;
    END LOOP;

    IF v_word_all_filled THEN
      v_filled_words := v_filled_words + 1;
    END IF;
    IF v_word_built = v_ans THEN
      v_correct_words := v_correct_words + 1;
    END IF;
  END LOOP;

  v_score := CASE WHEN v_total_slots > 0
    THEN round((v_correct_slots::numeric / v_total_slots::numeric) * 100, 2)
    ELSE 0 END;

  v_word_score := CASE WHEN v_total_words > 0
    THEN round((v_correct_words::numeric / v_total_words::numeric) * 100, 2)
    ELSE 0 END;

  INSERT INTO public.quiz_attempts (
    user_id,
    material_index,
    student_name_snapshot,
    student_nim_snapshot,
    student_class_snapshot,
    submitted_cells,
    total_cells,
    filled_cells,
    correct_cells,
    total_letter_slots,
    correct_letter_slots,
    total_words,
    filled_words,
    correct_words,
    score,
    word_score,
    duration_seconds,
    started_at
  ) VALUES (
    v_uid,
    p_material_index,
    coalesce(nullif(trim(v_profile.full_name), ''), v_profile.email),
    coalesce(v_profile.nim, '-'),
    coalesce(nullif(trim(v_profile.class_name), ''), '-'),
    v_clean_cells,
    v_total_cells,
    v_filled_cells,
    v_correct_cells,
    v_total_slots,
    v_correct_slots,
    v_total_words,
    v_filled_words,
    v_correct_words,
    v_score,
    v_word_score,
    greatest(coalesce(p_duration_seconds, 0), 0),
    coalesce(p_started_at, now())
  )
  RETURNING * INTO v_attempt;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = 1;
  SELECT count(*) INTO v_active_materials_count FROM public.quiz_materials WHERE is_active = true;
  SELECT count(*) INTO v_completed_active_count
  FROM public.quiz_attempts qa
  JOIN public.quiz_materials qm ON qm.material_index = qa.material_index
  WHERE qa.user_id = v_uid AND qm.is_active = true;

  v_all_completed := (v_active_materials_count > 0 AND v_completed_active_count >= v_active_materials_count);

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'material_index', v_attempt.material_index,
    'submitted_at', v_attempt.submitted_at,
    'filled_cells', v_attempt.filled_cells,
    'total_cells', v_attempt.total_cells,
    'filled_words', v_attempt.filled_words,
    'total_words', v_attempt.total_words,
    'all_completed', v_all_completed,
    'completed_count', v_completed_active_count,
    'active_materials_count', v_active_materials_count,
    'score_visible', (v_settings.show_score_immediately OR v_all_completed OR v_profile.role = 'admin'),
    'score', CASE WHEN (v_settings.show_score_immediately OR v_all_completed OR v_profile.role = 'admin') THEN v_attempt.score ELSE NULL END,
    'word_score', CASE WHEN (v_settings.show_score_immediately OR v_all_completed OR v_profile.role = 'admin') THEN v_attempt.word_score ELSE NULL END,
    'correct_words', CASE WHEN (v_settings.show_score_immediately OR v_all_completed OR v_profile.role = 'admin') THEN v_attempt.correct_words ELSE NULL END,
    'correct_cells', CASE WHEN (v_settings.show_score_immediately OR v_all_completed OR v_profile.role = 'admin') THEN v_attempt.correct_cells ELSE NULL END
  );
END;
$$;

-- RPC: Get Detailed Evaluation for a Specific Attempt (Admin sees full; Student obeys app_settings)
CREATE OR REPLACE FUNCTION public.get_attempt_detail(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_attempt public.quiz_attempts;
  v_material public.quiz_materials;
  v_key public.quiz_answer_keys;
  v_settings public.app_settings;
  v_active_count integer;
  v_user_completed_count integer;
  v_all_completed boolean;
  v_can_view_score boolean;
  v_can_view_detail boolean;
  v_can_view_answer_key boolean;
  v_cell_statuses jsonb := '{}'::jsonb;
  v_cell_key text;
  v_expected_letter text;
  v_given_letter text;
  v_words jsonb := '[]'::jsonb;
  v_dir text;
  v_item jsonb;
  v_ans text;
  v_row integer;
  v_col integer;
  v_dr integer;
  v_dc integer;
  v_k integer;
  v_coord text;
  v_ch text;
  v_student_word text;
  v_correct_letters integer;
  v_filled_letters integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi.';
  END IF;

  SELECT * INTO v_attempt FROM public.quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'Data pengerjaan tidak ditemukan.';
  END IF;

  IF NOT v_is_admin AND v_attempt.user_id <> v_uid THEN
    RAISE EXCEPTION 'Anda tidak memiliki akses ke data pengerjaan ini.';
  END IF;

  SELECT * INTO v_material FROM public.quiz_materials WHERE material_index = v_attempt.material_index;
  SELECT * INTO v_key FROM public.quiz_answer_keys WHERE material_index = v_attempt.material_index;
  SELECT * INTO v_settings FROM public.app_settings WHERE id = 1;

  SELECT count(*) INTO v_active_count FROM public.quiz_materials WHERE is_active = true;
  SELECT count(*) INTO v_user_completed_count
  FROM public.quiz_attempts qa
  JOIN public.quiz_materials qm ON qm.material_index = qa.material_index
  WHERE qa.user_id = v_attempt.user_id AND qm.is_active = true;

  v_all_completed := (v_active_count > 0 AND v_user_completed_count >= v_active_count);

  IF v_is_admin THEN
    v_can_view_score := true;
    v_can_view_detail := true;
    v_can_view_answer_key := true;
  ELSE
    v_can_view_score := (v_settings.show_score_immediately OR v_all_completed);
    v_can_view_detail := (
      v_settings.student_detail_visibility = 'immediate_per_section'
      OR (v_settings.student_detail_visibility = 'after_all_completed' AND v_all_completed)
    );
    v_can_view_answer_key := (v_can_view_detail AND v_settings.show_correct_word_in_student_review);
  END IF;

  IF v_can_view_detail THEN
    FOR v_cell_key, v_expected_letter IN
      SELECT key, value #>> '{}' FROM jsonb_each(v_key.grid_solution)
    LOOP
      v_given_letter := coalesce(v_attempt.submitted_cells ->> v_cell_key, '');
      IF v_given_letter = '' THEN
        v_cell_statuses := v_cell_statuses || jsonb_build_object(v_cell_key, 'empty');
      ELSIF v_given_letter = v_expected_letter THEN
        v_cell_statuses := v_cell_statuses || jsonb_build_object(v_cell_key, 'correct');
      ELSE
        v_cell_statuses := v_cell_statuses || jsonb_build_object(v_cell_key, 'wrong');
      END IF;
    END LOOP;

    FOREACH v_dir IN ARRAY ARRAY['across', 'down'] LOOP
      v_dr := CASE WHEN v_dir = 'across' THEN 0 ELSE 1 END;
      v_dc := CASE WHEN v_dir = 'across' THEN 1 ELSE 0 END;

      FOR v_item IN
        SELECT value FROM jsonb_array_elements(
          CASE WHEN v_dir = 'across' THEN v_key.across_answers ELSE v_key.down_answers END
        )
      LOOP
        v_ans := v_item ->> 'answer';
        v_row := (v_item ->> 'row')::integer;
        v_col := (v_item ->> 'col')::integer;
        v_student_word := '';
        v_correct_letters := 0;
        v_filled_letters := 0;

        FOR v_k IN 0..(length(v_ans) - 1) LOOP
          v_coord := (v_row + v_dr * v_k)::text || ',' || (v_col + v_dc * v_k)::text;
          v_ch := coalesce(v_attempt.submitted_cells ->> v_coord, '');
          IF v_ch = '' THEN
            v_student_word := v_student_word || '·';
          ELSE
            v_student_word := v_student_word || v_ch;
            v_filled_letters := v_filled_letters + 1;
            IF v_ch = substring(v_ans FROM v_k + 1 FOR 1) THEN
              v_correct_letters := v_correct_letters + 1;
            END IF;
          END IF;
        END LOOP;

        v_words := v_words || jsonb_build_array(
          jsonb_build_object(
            'direction', v_dir,
            'no', (v_item ->> 'no')::integer,
            'gridNo', (v_item ->> 'gridNo')::integer,
            'question', v_item ->> 'question',
            'letters', (v_item ->> 'letters')::integer,
            'studentAnswer', v_student_word,
            'filledLetters', v_filled_letters,
            'correctLetters', v_correct_letters,
            'status', CASE
              WHEN v_filled_letters = 0 THEN 'empty'
              WHEN v_correct_letters = length(v_ans) THEN 'correct'
              ELSE 'wrong'
            END,
            'correctAnswer', CASE WHEN v_can_view_answer_key THEN v_ans ELSE NULL END
          )
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'id', v_attempt.id,
    'user_id', v_attempt.user_id,
    'material_index', v_attempt.material_index,
    'material_name', v_material.name,
    'student_name', v_attempt.student_name_snapshot,
    'student_nim', v_attempt.student_nim_snapshot,
    'student_class', v_attempt.student_class_snapshot,
    'submitted_at', v_attempt.submitted_at,
    'duration_seconds', v_attempt.duration_seconds,
    'total_cells', v_attempt.total_cells,
    'filled_cells', v_attempt.filled_cells,
    'total_words', v_attempt.total_words,
    'filled_words', v_attempt.filled_words,
    'all_completed', v_all_completed,
    'completed_count', v_user_completed_count,
    'active_count', v_active_count,
    'can_view_score', v_can_view_score,
    'can_view_detail', v_can_view_detail,
    'can_view_answer_key', v_can_view_answer_key,
    'visibility_policy', v_settings.student_detail_visibility,
    'score', CASE WHEN v_can_view_score THEN v_attempt.score ELSE NULL END,
    'word_score', CASE WHEN v_can_view_score THEN v_attempt.word_score ELSE NULL END,
    'correct_cells', CASE WHEN v_can_view_score THEN v_attempt.correct_cells ELSE NULL END,
    'correct_words', CASE WHEN v_can_view_score THEN v_attempt.correct_words ELSE NULL END,
    'submitted_cells', v_attempt.submitted_cells,
    'cell_statuses', CASE WHEN v_can_view_detail THEN v_cell_statuses ELSE NULL END,
    'grid_solution', CASE WHEN v_can_view_answer_key THEN v_key.grid_solution ELSE NULL END,
    'words', CASE WHEN v_can_view_detail THEN v_words ELSE NULL END
  );
END;
$$;

-- RPC: Admin Detailed Word-by-Word Export (Filterable by Class)
CREATE OR REPLACE FUNCTION public.get_admin_detailed_answers_export(p_class_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_rec record;
  v_dir text;
  v_dr integer;
  v_dc integer;
  v_item jsonb;
  v_ans text;
  v_row integer;
  v_col integer;
  v_k integer;
  v_coord text;
  v_ch text;
  v_student_word text;
  v_filled integer;
  v_correct integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin yang dapat mengekspor laporan detail.';
  END IF;

  FOR v_rec IN
    SELECT
      qa.id AS attempt_id,
      qa.material_index,
      qm.name AS material_name,
      coalesce(nullif(p.full_name, ''), qa.student_name_snapshot) AS full_name,
      coalesce(nullif(p.nim, ''), qa.student_nim_snapshot) AS nim,
      coalesce(nullif(p.class_name, ''), qa.student_class_snapshot) AS class_name,
      p.email,
      qa.score,
      qa.word_score,
      qa.submitted_at,
      qa.duration_seconds,
      qa.submitted_cells,
      qak.across_answers,
      qak.down_answers
    FROM public.quiz_attempts qa
    JOIN public.profiles p ON p.id = qa.user_id
    JOIN public.quiz_materials qm ON qm.material_index = qa.material_index
    JOIN public.quiz_answer_keys qak ON qak.material_index = qa.material_index
    WHERE (p_class_name IS NULL OR p_class_name = '' OR p_class_name = 'ALL' OR coalesce(nullif(p.class_name, ''), qa.student_class_snapshot) = p_class_name)
    ORDER BY coalesce(nullif(p.class_name, ''), qa.student_class_snapshot), coalesce(nullif(p.nim, ''), qa.student_nim_snapshot), qa.material_index
  LOOP
    FOREACH v_dir IN ARRAY ARRAY['across', 'down'] LOOP
      v_dr := CASE WHEN v_dir = 'across' THEN 0 ELSE 1 END;
      v_dc := CASE WHEN v_dir = 'across' THEN 1 ELSE 0 END;

      FOR v_item IN
        SELECT value FROM jsonb_array_elements(
          CASE WHEN v_dir = 'across' THEN v_rec.across_answers ELSE v_rec.down_answers END
        )
      LOOP
        v_ans := v_item ->> 'answer';
        v_row := (v_item ->> 'row')::integer;
        v_col := (v_item ->> 'col')::integer;
        v_student_word := '';
        v_filled := 0;
        v_correct := 0;

        FOR v_k IN 0..(length(v_ans) - 1) LOOP
          v_coord := (v_row + v_dr * v_k)::text || ',' || (v_col + v_dc * v_k)::text;
          v_ch := coalesce(v_rec.submitted_cells ->> v_coord, '');
          IF v_ch = '' THEN
            v_student_word := v_student_word || '_';
          ELSE
            v_student_word := v_student_word || v_ch;
            v_filled := v_filled + 1;
            IF v_ch = substring(v_ans FROM v_k + 1 FOR 1) THEN
              v_correct := v_correct + 1;
            END IF;
          END IF;
        END LOOP;

        v_result := v_result || jsonb_build_array(
          jsonb_build_object(
            'nim', v_rec.nim,
            'full_name', v_rec.full_name,
            'class_name', v_rec.class_name,
            'email', v_rec.email,
            'material_no', v_rec.material_index + 1,
            'material_name', v_rec.material_name,
            'direction', CASE WHEN v_dir = 'across' THEN 'Mendatar' ELSE 'Menurun' END,
            'grid_no', (v_item ->> 'gridNo')::integer,
            'question', v_item ->> 'question',
            'student_answer', CASE WHEN v_filled = 0 THEN '(Kosong)' ELSE v_student_word END,
            'correct_answer', v_ans,
            'status', CASE
              WHEN v_filled = 0 THEN 'Kosong'
              WHEN v_correct = length(v_ans) THEN 'Benar'
              ELSE 'Salah'
            END,
            'letter_accuracy', v_correct::text || '/' || length(v_ans)::text,
            'section_score', v_rec.score,
            'submitted_at', v_rec.submitted_at
          )
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;
