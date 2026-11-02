-- Remove dummy seeded classes so classes come naturally from student free-text input
DELETE FROM public.classes
WHERE code IN ('KEP-1A', 'KEP-1B', 'KEP-2A', 'KEP-2B', 'KEP-3A', 'KEP-EKS');

-- Admin RPC: Rename or Merge a free-text class name across profiles, attempts, and optional class metadata
CREATE OR REPLACE FUNCTION public.admin_rename_class_group(
  p_old_name text,
  p_new_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text := trim(coalesce(p_old_name, ''));
  v_new text := regexp_replace(trim(coalesce(p_new_name, '')), '\s+', ' ', 'g');
  v_updated_profiles integer := 0;
  v_updated_attempts integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin yang dapat mengubah/menggabungkan nama kelas.';
  END IF;

  IF v_old = '' OR v_new = '' THEN
    RAISE EXCEPTION 'Nama kelas lama dan nama kelas baru wajib diisi.';
  END IF;

  UPDATE public.profiles
  SET class_name = v_new,
      updated_at = now()
  WHERE trim(class_name) = v_old;
  GET DIAGNOSTICS v_updated_profiles = ROW_COUNT;

  UPDATE public.quiz_attempts
  SET student_class_snapshot = v_new
  WHERE trim(student_class_snapshot) = v_old;
  GET DIAGNOSTICS v_updated_attempts = ROW_COUNT;

  -- Sync optional classes metadata table if an entry exists
  IF EXISTS (SELECT 1 FROM public.classes WHERE name = v_old) THEN
    IF EXISTS (SELECT 1 FROM public.classes WHERE name = v_new AND name <> v_old) THEN
      DELETE FROM public.classes WHERE name = v_old;
    ELSE
      UPDATE public.classes
      SET name = v_new, updated_at = now()
      WHERE name = v_old;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'old_name', v_old,
    'new_name', v_new,
    'updated_profiles', v_updated_profiles,
    'updated_attempts', v_updated_attempts
  );
END;
$$;
