import * as XLSX from 'xlsx';
import {
  AppSettings,
  ClassItem,
  QuizAttempt,
  QuizMaterial,
  UserProfile,
  formatDateTimeID,
  formatDuration,
  getNursingGradeInfo,
} from '@/types/medika';

export interface GradebookExportParams {
  students: UserProfile[];
  attempts: QuizAttempt[];
  materials: QuizMaterial[];
  classes: ClassItem[];
  settings: AppSettings;
  selectedClass: string; // 'ALL' or specific class name
}

export function buildStudentMatrixRows({
  students,
  attempts,
  materials,
  selectedClass,
}: Omit<GradebookExportParams, 'classes' | 'settings'>) {
  const activeMaterials = materials.filter((m) => m.is_active);
  const totalActive = activeMaterials.length || materials.length;

  const filteredStudents = students
    .filter((s) => s.role === 'student')
    .filter((s) => selectedClass === 'ALL' || s.class_name === selectedClass)
    .sort((a, b) => {
      const clsCmp = (a.class_name || '').localeCompare(b.class_name || '');
      if (clsCmp !== 0) return clsCmp;
      return (a.nim || '').localeCompare(b.nim || '');
    });

  const attemptByUserMat = new Map<string, QuizAttempt>();
  for (const att of attempts) {
    attemptByUserMat.set(`${att.user_id}_${att.material_index}`, att);
  }

  return filteredStudents.map((student, idx) => {
    let sumCompletedScores = 0;
    let completedCount = 0;
    let completedActiveCount = 0;
    let totalDuration = 0;

    const perMaterialScores: Record<string, number | string> = {};

    materials.forEach((mat) => {
      const colKey = `M${mat.material_index + 1} (${mat.name})`;
      const att = attemptByUserMat.get(`${student.id}_${mat.material_index}`);
      if (att) {
        const numScore = Number(att.score);
        perMaterialScores[colKey] = numScore;
        sumCompletedScores += numScore;
        completedCount += 1;
        totalDuration += att.duration_seconds || 0;
        if (mat.is_active) completedActiveCount += 1;
      } else {
        perMaterialScores[colKey] = '-';
      }
    });

    const avgCompleted =
      completedCount > 0 ? Number((sumCompletedScores / completedCount).toFixed(2)) : 0;
    const finalOverallScore =
      totalActive > 0 ? Number((sumCompletedScores / totalActive).toFixed(2)) : 0;
    const grade = getNursingGradeInfo(finalOverallScore);

    const statusLabel =
      completedCount === 0
        ? 'Belum Mengisi'
        : completedActiveCount >= totalActive
        ? 'Selesai Lengkap'
        : `Proses (${completedActiveCount}/${totalActive})`;

    return {
      No: idx + 1,
      NIM: student.nim || '-',
      'Nama Mahasiswa': student.full_name || '-',
      Kelas: student.class_name || 'Belum Diatur',
      Email: student.email,
      ...perMaterialScores,
      'Materi Selesai': `${completedCount}/${materials.length}`,
      'Rata-rata Materi Dikerjakan': avgCompleted,
      'Nilai Akhir Keseluruhan': finalOverallScore,
      'Huruf Mutu': completedCount > 0 ? grade.letter : '-',
      Predikat: completedCount > 0 ? grade.predicate : 'Belum Mengikuti',
      'Total Durasi': formatDuration(totalDuration),
      'Status Pengerjaan': statusLabel,
    };
  });
}

export function exportAdminGradebookExcel(params: GradebookExportParams) {
  const { students, attempts, materials, classes, settings, selectedClass } = params;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Buku Nilai Mahasiswa
  const matrixRows = buildStudentMatrixRows({
    students,
    attempts,
    materials,
    selectedClass,
  });
  const wsMatrix = XLSX.utils.json_to_sheet(
    matrixRows.length > 0
      ? matrixRows
      : [{ Info: 'Belum ada data mahasiswa pada filter kelas ini.' }]
  );
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Buku Nilai Mahasiswa');

  // Sheet 2: Rekap Per Kelas
  const activeMaterialsCount = materials.filter((m) => m.is_active).length || materials.length;
  const allClassNames = Array.from(
    new Set([
      ...classes.map((c) => c.name),
      ...students.filter((s) => s.role === 'student' && s.class_name).map((s) => s.class_name),
    ])
  ).filter((name) => selectedClass === 'ALL' || name === selectedClass);

  const classSummaryRows = allClassNames.map((className, idx) => {
    const clsMeta = classes.find((c) => c.name === className);
    const clsStudents = students.filter(
      (s) => s.role === 'student' && s.class_name === className
    );
    const studentIds = new Set(clsStudents.map((s) => s.id));
    const clsAttempts = attempts.filter((a) => studentIds.has(a.user_id));

    let startedStudents = 0;
    let completedAllStudents = 0;
    let sumFinalScores = 0;

    clsStudents.forEach((stu) => {
      const stuAtts = clsAttempts.filter((a) => a.user_id === stu.id);
      if (stuAtts.length > 0) startedStudents += 1;
      if (stuAtts.length >= activeMaterialsCount && activeMaterialsCount > 0) {
        completedAllStudents += 1;
      }
      const stuSum = stuAtts.reduce((acc, cur) => acc + Number(cur.score), 0);
      sumFinalScores += activeMaterialsCount > 0 ? stuSum / activeMaterialsCount : 0;
    });

    const avgAttemptScore =
      clsAttempts.length > 0
        ? Number(
            (
              clsAttempts.reduce((acc, cur) => acc + Number(cur.score), 0) /
              clsAttempts.length
            ).toFixed(2)
          )
        : 0;

    const avgFinalClass =
      clsStudents.length > 0 ? Number((sumFinalScores / clsStudents.length).toFixed(2)) : 0;

    return {
      No: idx + 1,
      'Kode Kelas': clsMeta?.code || '-',
      'Nama Kelas': className,
      Semester: clsMeta?.semester || '-',
      'Dosen PJ': clsMeta?.lecturer_name || '-',
      'Total Mahasiswa': clsStudents.length,
      'Sudah Mengisi (>=1)': startedStudents,
      'Belum Mengisi': clsStudents.length - startedStudents,
      'Selesai Semua Materi': completedAllStudents,
      'Total Pengumpulan TTS': clsAttempts.length,
      'Rata-rata Skor TTS': avgAttemptScore,
      'Rata-rata Nilai Akhir Kelas': avgFinalClass,
    };
  });

  const wsClasses = XLSX.utils.json_to_sheet(
    classSummaryRows.length > 0
      ? classSummaryRows
      : [{ Info: 'Belum ada data rekap kelas.' }]
  );
  XLSX.utils.book_append_sheet(wb, wsClasses, 'Rekap Per Kelas');

  // Sheet 3: Riwayat Pengumpulan Detail
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const materialMap = new Map(materials.map((m) => [m.material_index, m]));

  const attemptRows = attempts
    .filter((a) => {
      const stu = studentMap.get(a.user_id);
      const cls = stu?.class_name || a.student_class_snapshot;
      return selectedClass === 'ALL' || cls === selectedClass;
    })
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .map((att, idx) => {
      const stu = studentMap.get(att.user_id);
      const mat = materialMap.get(att.material_index);
      return {
        No: idx + 1,
        'Waktu Pengumpulan': formatDateTimeID(att.submitted_at),
        NIM: stu?.nim || att.student_nim_snapshot,
        'Nama Mahasiswa': stu?.full_name || att.student_name_snapshot,
        Kelas: stu?.class_name || att.student_class_snapshot,
        'No Materi': att.material_index + 1,
        'Nama Materi': mat?.name || `Materi ${att.material_index + 1}`,
        'Nilai Skor (0-100)': Number(att.score),
        'Skor Kata Penuh (%)': Number(att.word_score),
        'Soal Dijawab Benar': `${att.correct_words}/${att.total_words}`,
        'Kotak Huruf Benar': `${att.correct_cells}/${att.total_cells}`,
        'Durasi Pengerjaan': formatDuration(att.duration_seconds),
      };
    });

  const wsAttempts = XLSX.utils.json_to_sheet(
    attemptRows.length > 0 ? attemptRows : [{ Info: 'Belum ada riwayat pengerjaan.' }]
  );
  XLSX.utils.book_append_sheet(wb, wsAttempts, 'Riwayat Pengumpulan');

  // Sheet 4: Daftar Mahasiswa Belum Mengisi Sama Sekali
  const attemptedUserIds = new Set(attempts.map((a) => a.user_id));
  const notStartedRows = students
    .filter((s) => s.role === 'student')
    .filter((s) => selectedClass === 'ALL' || s.class_name === selectedClass)
    .filter((s) => !attemptedUserIds.has(s.id))
    .map((s, idx) => ({
      No: idx + 1,
      NIM: s.nim || '-',
      'Nama Mahasiswa': s.full_name || '-',
      Kelas: s.class_name || '-',
      Email: s.email,
      Telepon: s.phone || '-',
      'Terdaftar Sejak': formatDateTimeID(s.created_at),
    }));

  const wsNotStarted = XLSX.utils.json_to_sheet(
    notStartedRows.length > 0
      ? notStartedRows
      : [{ Info: 'Seluruh mahasiswa pada filter ini sudah mulai mengerjakan.' }]
  );
  XLSX.utils.book_append_sheet(wb, wsNotStarted, 'Belum Mengisi');

  const safeClassSlug =
    selectedClass === 'ALL'
      ? 'Semua_Kelas'
      : selectedClass.replace(/[^a-zA-Z0-9]+/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Laporan_Nilai_TTS_${settings.institution_name.replace(/[^a-zA-Z0-9]+/g, '_')}_${safeClassSlug}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

export function exportAdminGradebookCSV(params: GradebookExportParams) {
  const rows = buildStudentMatrixRows(params);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const safeClassSlug =
    params.selectedClass === 'ALL'
      ? 'Semua_Kelas'
      : params.selectedClass.replace(/[^a-zA-Z0-9]+/g, '_');
  const link = document.createElement('a');
  link.href = url;
  link.download = `Rekap_Nilai_TTS_${safeClassSlug}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface DetailedExportRow {
  nim: string;
  full_name: string;
  class_name: string;
  email: string;
  material_no: number;
  material_name: string;
  direction: string;
  grid_no: number;
  question: string;
  student_answer: string;
  correct_answer: string;
  status: string;
  letter_accuracy: string;
  section_score: number;
  submitted_at: string;
}

export function exportDetailedWordAnswersExcel(
  rows: DetailedExportRow[],
  selectedClass: string
) {
  const formatted = rows.map((r, idx) => ({
    No: idx + 1,
    NIM: r.nim,
    'Nama Mahasiswa': r.full_name,
    Kelas: r.class_name,
    Email: r.email,
    'No Materi': r.material_no,
    'Nama Materi': r.material_name,
    Arah: r.direction,
    'No Kotak TTS': r.grid_no,
    Pertanyaan: r.question,
    'Jawaban Mahasiswa': r.student_answer,
    'Kunci Jawaban': r.correct_answer,
    Status: r.status,
    'Akurasi Huruf': r.letter_accuracy,
    'Nilai Materi': Number(r.section_score),
    'Waktu Submit': formatDateTimeID(r.submitted_at),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    formatted.length > 0
      ? formatted
      : [{ Info: 'Belum ada detail jawaban pada filter kelas ini.' }]
  );
  XLSX.utils.book_append_sheet(wb, ws, 'Detail Jawaban Per Soal');

  const safeClassSlug =
    selectedClass === 'ALL'
      ? 'Semua_Kelas'
      : selectedClass.replace(/[^a-zA-Z0-9]+/g, '_');
  XLSX.writeFile(
    wb,
    `Detail_Jawaban_Mahasiswa_TTS_${safeClassSlug}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
