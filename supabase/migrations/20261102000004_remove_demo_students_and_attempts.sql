-- Remove all seeded demo student accounts and demo quiz attempts for clean production usage
DELETE FROM public.quiz_attempts
WHERE user_id IN (
  SELECT id FROM public.profiles
  WHERE email IN (
    'mhs1@medikakeperawatan.ac.id',
    'mhs2@medikakeperawatan.ac.id',
    'mhs3@medikakeperawatan.ac.id',
    'mhs4@medikakeperawatan.ac.id'
  )
);

DELETE FROM auth.users
WHERE lower(email) IN (
  'mhs1@medikakeperawatan.ac.id',
  'mhs2@medikakeperawatan.ac.id',
  'mhs3@medikakeperawatan.ac.id',
  'mhs4@medikakeperawatan.ac.id'
);
