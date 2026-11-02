export type UserRole = 'student' | 'admin';

export type StudentDetailVisibility =
  | 'after_all_completed'
  | 'immediate_per_section'
  | 'score_only';

export interface AppSettings {
  id: number;
  institution_name: string;
  program_name: string;
  course_name: string;
  academic_year: string;
  show_score_immediately: boolean;
  student_detail_visibility: StudentDetailVisibility;
  show_correct_word_in_student_review: boolean;
  allow_self_registration: boolean;
  updated_at?: string;
}

export interface ClassItem {
  id: string;
  code: string;
  name: string;
  semester: string;
  lecturer_name: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  nim: string | null;
  class_name: string;
  role: UserRole;
  phone: string;
  avatar_color: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ClueItem {
  no: number;
  gridNo: number;
  row: number;
  col: number;
  letters: number;
  question: string;
  answer?: string;
}

export interface QuizMaterial {
  material_index: number;
  slug: string;
  name: string;
  subtitle: string;
  rows: number;
  cols: number;
  active_cells: string[];
  positions: Record<string, [number, number, number, number]>;
  across_clues: ClueItem[];
  down_clues: ClueItem[];
  total_questions: number;
  total_cells: number;
  is_active: boolean;
}

export interface QuizAnswerKey {
  material_index: number;
  grid_solution: Record<string, string>;
  across_answers: Required<ClueItem>[];
  down_answers: Required<ClueItem>[];
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  material_index: number;
  student_name_snapshot: string;
  student_nim_snapshot: string;
  student_class_snapshot: string;
  submitted_cells: Record<string, string>;
  total_cells: number;
  filled_cells: number;
  correct_cells: number;
  total_letter_slots: number;
  correct_letter_slots: number;
  total_words: number;
  filled_words: number;
  correct_words: number;
  score: number;
  word_score: number;
  duration_seconds: number;
  started_at?: string;
  submitted_at: string;
}

export interface WordEvaluationItem {
  direction: 'across' | 'down';
  no: number;
  gridNo: number;
  question: string;
  letters: number;
  studentAnswer: string;
  filledLetters: number;
  correctLetters: number;
  status: 'correct' | 'wrong' | 'empty';
  correctAnswer: string | null;
}

export interface AttemptDetailResponse {
  id: string;
  user_id: string;
  material_index: number;
  material_name: string;
  student_name: string;
  student_nim: string;
  student_class: string;
  submitted_at: string;
  duration_seconds: number;
  total_cells: number;
  filled_cells: number;
  total_words: number;
  filled_words: number;
  all_completed: boolean;
  completed_count: number;
  active_count: number;
  can_view_score: boolean;
  can_view_detail: boolean;
  can_view_answer_key: boolean;
  visibility_policy: StudentDetailVisibility;
  score: number | null;
  word_score: number | null;
  correct_cells: number | null;
  correct_words: number | null;
  submitted_cells: Record<string, string>;
  cell_statuses: Record<string, 'correct' | 'wrong' | 'empty'> | null;
  grid_solution: Record<string, string> | null;
  words: WordEvaluationItem[] | null;
}

export function isStudentProfileComplete(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') {
    return Boolean(profile.full_name && profile.full_name.trim().length > 0);
  }
  return Boolean(
    profile.full_name &&
      profile.full_name.trim().length > 0 &&
      profile.nim &&
      profile.nim.trim().length > 0 &&
      profile.class_name &&
      profile.class_name.trim().length > 0
  );
}

export function getNursingGradeInfo(score: number): {
  letter: string;
  predicate: string;
  badgeClass: string;
} {
  if (score >= 85) {
    return {
      letter: 'A',
      predicate: 'Sangat Memuaskan',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  if (score >= 80) {
    return {
      letter: 'AB',
      predicate: 'Memuaskan Tinggi',
      badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    };
  }
  if (score >= 70) {
    return {
      letter: 'B',
      predicate: 'Baik',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    };
  }
  if (score >= 60) {
    return {
      letter: 'C',
      predicate: 'Cukup',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }
  if (score >= 50) {
    return {
      letter: 'D',
      predicate: 'Kurang',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    };
  }
  return {
    letter: 'E',
    predicate: 'Perlu Pembinaan',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
  };
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0m 0d';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}j ${remMins}m`;
  }
  return `${mins}m ${secs}d`;
}

export function formatDateTimeID(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
