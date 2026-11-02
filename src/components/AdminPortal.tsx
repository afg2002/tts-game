'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookMarked,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  KeyRound,
  LogOut,
  Printer,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Stethoscope,
  Users,
} from 'lucide-react';
import { SUPABASE_GOOGLE_CALLBACK_URL, supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  QuizAttempt,
  QuizMaterial,
  StudentDetailVisibility,
  UserProfile,
  formatDateTimeID,
  getNursingGradeInfo,
} from '@/types/medika';
import {
  DetailedExportRow,
  exportAdminGradebookCSV,
  exportAdminGradebookExcel,
  exportDetailedWordAnswersExcel,
} from '@/lib/exportReports';
import AttemptDetailModal from './AttemptDetailModal';
import ProfilePanel from './ProfilePanel';
import AdminAnswerKeyTab from './admin/AdminAnswerKeyTab';
import AdminUsersCrudTab from './admin/AdminUsersCrudTab';
import AdminClassesCrudTab from './admin/AdminClassesCrudTab';
import StudentFullHistoryModal from './admin/StudentFullHistoryModal';

type AdminTab =
  | 'overview'
  | 'reports'
  | 'users'
  | 'classes'
  | 'answer_keys'
  | 'settings';

export default function AdminPortal() {
  const {
    profile,
    settings,
    classes,
    materials,
    googleProviderEnabled,
    signOut,
    refreshSettings,
    refreshClasses,
    refreshMaterials,
    refreshAuthProviders,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [exportingDetailed, setExportingDetailed] = useState(false);

  // Gradebook & Report Filters
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string>('ALL');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<
    'all' | 'has_submitted' | 'completed_all' | 'not_submitted'
  >('all');
  const [reportSearch, setReportSearch] = useState('');

  // Modals for Inspection
  const [inspectAttemptId, setInspectAttemptId] = useState<string | null>(null);
  const [inspectMaterial, setInspectMaterial] = useState<QuizMaterial | undefined>(
    undefined
  );
  const [historyStudent, setHistoryStudent] = useState<UserProfile | null>(null);

  // Settings Form State
  const [instName, setInstName] = useState(settings.institution_name);
  const [progName, setProgName] = useState(settings.program_name);
  const [acadYear, setAcadYear] = useState(settings.academic_year);
  const [showScoreImm, setShowScoreImm] = useState(settings.show_score_immediately);
  const [detailVisMode, setDetailVisMode] = useState<StudentDetailVisibility>(
    settings.student_detail_visibility
  );
  const [showCorrectWordInReview, setShowCorrectWordInReview] = useState(
    settings.show_correct_word_in_student_review
  );
  const [allowReg, setAllowReg] = useState(settings.allow_self_registration);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setInstName(settings.institution_name);
    setProgName(settings.program_name);
    setAcadYear(settings.academic_year);
    setShowScoreImm(settings.show_score_immediately);
    setDetailVisMode(settings.student_detail_visibility);
    setShowCorrectWordInReview(settings.show_correct_word_in_student_review);
    setAllowReg(settings.allow_self_registration);
  }, [settings]);

  const loadAdminDataset = useCallback(async () => {
    setLoadingData(true);
    const [profRes, attRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('class_name', { ascending: true })
        .order('full_name', { ascending: true }),
      supabase
        .from('quiz_attempts')
        .select('*')
        .order('submitted_at', { ascending: false }),
    ]);
    if (profRes.data) setProfiles(profRes.data as UserProfile[]);
    if (attRes.data) setAttempts(attRes.data as QuizAttempt[]);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    loadAdminDataset();
  }, [loadAdminDataset]);

  const handleRefreshEverything = useCallback(async () => {
    await Promise.all([
      loadAdminDataset(),
      refreshClasses(),
      refreshMaterials(),
      refreshSettings(),
    ]);
  }, [loadAdminDataset, refreshClasses, refreshMaterials, refreshSettings]);

  const handleResetAttempt = async (attemptId: string) => {
    const { error } = await supabase
      .from('quiz_attempts')
      .delete()
      .eq('id', attemptId);
    if (!error) {
      await loadAdminDataset();
    } else {
      alert(`Gagal mereset pengerjaan: ${error.message}`);
    }
  };

  const students = useMemo(
    () => profiles.filter((p) => p.role === 'student'),
    [profiles]
  );

  // Map user_id -> material_index -> QuizAttempt
  const attemptsByUserAndMat = useMemo(() => {
    const map = new Map<string, Map<number, QuizAttempt>>();
    attempts.forEach((a) => {
      if (!map.has(a.user_id)) {
        map.set(a.user_id, new Map());
      }
      map.get(a.user_id)!.set(a.material_index, a);
    });
    return map;
  }, [attempts]);

  const activeMaterialCount = useMemo(
    () => materials.filter((m) => m.is_active).length || 11,
    [materials]
  );

  // Executive KPIs
  const overviewStats = useMemo(() => {
    const totalStudents = students.length;
    const studentsWithAnyAttempt = students.filter(
      (s) => (attemptsByUserAndMat.get(s.id)?.size || 0) > 0
    ).length;
    const studentsCompletedAll = students.filter(
      (s) => (attemptsByUserAndMat.get(s.id)?.size || 0) >= activeMaterialCount
    ).length;
    const studentsNotSubmitted = totalStudents - studentsWithAnyAttempt;
    const avgScoreAll =
      attempts.length > 0
        ? Number(
            (
              attempts.reduce((acc, a) => acc + Number(a.score), 0) / attempts.length
            ).toFixed(1)
          )
        : 0;

    return {
      totalStudents,
      studentsWithAnyAttempt,
      studentsCompletedAll,
      studentsNotSubmitted,
      totalAttempts: attempts.length,
      avgScoreAll,
    };
  }, [activeMaterialCount, attempts, attemptsByUserAndMat, students]);

  // Filtered students for Gradebook Matrix
  const filteredStudents = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (selectedClass !== 'ALL' && (s.class_name || '') !== selectedClass) {
        return false;
      }
      if (q) {
        const hay = `${s.full_name} ${s.nim || ''} ${s.class_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const userMap = attemptsByUserAndMat.get(s.id);
      const count = userMap?.size || 0;

      if (selectedMaterialFilter !== 'ALL') {
        const matIdx = Number(selectedMaterialFilter);
        const hasThisMat = Boolean(userMap?.has(matIdx));
        if (submissionStatusFilter === 'has_submitted' && !hasThisMat) return false;
        if (submissionStatusFilter === 'not_submitted' && hasThisMat) return false;
      } else {
        if (submissionStatusFilter === 'has_submitted' && count === 0) return false;
        if (submissionStatusFilter === 'not_submitted' && count > 0) return false;
      }

      if (submissionStatusFilter === 'completed_all' && count < activeMaterialCount) {
        return false;
      }

      return true;
    });
  }, [
    activeMaterialCount,
    attemptsByUserAndMat,
    reportSearch,
    selectedClass,
    selectedMaterialFilter,
    students,
    submissionStatusFilter,
  ]);

  // Group filteredStudents by class_name so grading per class is effortless
  const groupedStudentsByClass = useMemo(() => {
    const groups = new Map<string, UserProfile[]>();
    filteredStudents.forEach((s) => {
      const cls = s.class_name || 'Belum Memilih Kelas';
      if (!groups.has(cls)) groups.set(cls, []);
      groups.get(cls)!.push(s);
    });
    return Array.from(groups.entries());
  }, [filteredStudents]);

  const handleExportDetailedAnswers = async () => {
    setExportingDetailed(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_detailed_answers_export', {
        p_class_name: selectedClass === 'ALL' ? null : selectedClass,
      });
      if (error) throw error;
      let rows = (data || []) as DetailedExportRow[];
      if (selectedMaterialFilter !== 'ALL') {
        const targetNo = Number(selectedMaterialFilter) + 1;
        rows = rows.filter((r) => r.material_no === targetNo);
      }
      if (rows.length === 0) {
        alert('Belum ada data jawaban terkumpul pada filter kelas/materi ini.');
        return;
      }
      exportDetailedWordAnswersExcel(rows, selectedClass);
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'Gagal mengekspor detail jawaban per soal.'
      );
    } finally {
      setExportingDetailed(false);
    }
  };

  const handleSaveAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedMsg(null);
    const { error } = await supabase
      .from('app_settings')
      .update({
        institution_name: instName.trim(),
        program_name: progName.trim(),
        academic_year: acadYear.trim(),
        show_score_immediately: showScoreImm,
        student_detail_visibility: detailVisMode,
        show_correct_word_in_student_review: showCorrectWordInReview,
        allow_self_registration: allowReg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    setSavingSettings(false);
    if (error) {
      alert(`Gagal menyimpan pengaturan: ${error.message}`);
    } else {
      await refreshSettings();
      setSettingsSavedMsg('Pengaturan evaluasi & visibilitas nilai berhasil disimpan!');
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm no-print">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-medika-700 to-clinical-700 text-white flex items-center justify-center shadow-md">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                  {settings.institution_name}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-medika-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Panel Admin & Dosen
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {settings.program_name} · {settings.academic_year}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefreshEverything}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
              title="Muat Ulang Data Terbaru"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingData ? 'animate-spin text-medika-600' : ''}`}
              />
            </button>

            <div className="hidden md:block text-right">
              <div className="text-xs font-extrabold text-slate-900">
                {profile.full_name}
              </div>
              <div className="text-[11px] text-slate-500">{profile.email}</div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Secondary Navigation Bar */}
        <div className="border-t border-slate-100 bg-slate-50/80">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-2 medika-scroll">
            {(
              [
                ['overview', 'Ringkasan & Analitik', BarChart3],
                ['reports', 'Buku Nilai Per Kelas & Laporan', ClipboardList],
                ['users', 'CRUD Pengguna (Admin & Mhs)', Users],
                ['classes', 'Manajemen Kelas', BookMarked],
                ['answer_keys', 'Kunci Jawaban (Khusus Admin)', KeyRound],
                ['settings', 'Pengaturan & Profil', Settings],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-2 transition ${
                  activeTab === key
                    ? 'bg-medika-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Total Mahasiswa
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-medika-50 text-medika-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2">
                  {overviewStats.totalStudents}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Tersebar di <b>{classes.length}</b> kelas keperawatan
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Partisipasi Pengisian
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-emerald-700 mt-2">
                  {overviewStats.studentsWithAnyAttempt}{' '}
                  <span className="text-base font-bold text-slate-400">
                    / {overviewStats.totalStudents}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  <b>{overviewStats.studentsCompletedAll}</b> tuntas 11 materi ·{' '}
                  <b className="text-rose-600">{overviewStats.studentsNotSubmitted}</b>{' '}
                  belum mengisi
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Lembar TTS Terkumpul
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-clinical-50 text-clinical-600 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2">
                  {overviewStats.totalAttempts}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Batas 1x pengumpulan per materi aktif
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Rata-rata Skor Nasional
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-medika-700 mt-2">
                  {overviewStats.avgScoreAll}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Visibilitas detail:{' '}
                  <b>
                    {settings.student_detail_visibility === 'after_all_completed'
                      ? 'Setelah 11 Materi'
                      : settings.student_detail_visibility === 'immediate_per_section'
                      ? 'Langsung Per Materi'
                      : 'Hanya Skor Ringkas'}
                  </b>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Rekap Per Kelas */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Rekapitulasi Penilaian Per Kelas
                    </h3>
                    <p className="text-xs text-slate-500">
                      Klik kelas untuk langsung membuka Buku Nilai & Ekspor Kelas tersebut
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500">
                        <th className="py-3 px-4 font-bold">Nama Kelas</th>
                        <th className="py-3 px-3 font-bold text-center">Mhs</th>
                        <th className="py-3 px-3 font-bold text-center">Sudah Isi</th>
                        <th className="py-3 px-3 font-bold text-center">Belum Isi</th>
                        <th className="py-3 px-3 font-bold text-center">Rata-rata</th>
                        <th className="py-3 px-4 font-bold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classes.map((cls) => {
                        const clsStudents = students.filter(
                          (s) => s.class_name === cls.name
                        );
                        const clsStudentIds = new Set(clsStudents.map((s) => s.id));
                        const started = clsStudents.filter(
                          (s) => (attemptsByUserAndMat.get(s.id)?.size || 0) > 0
                        ).length;
                        const notStarted = clsStudents.length - started;
                        const clsAttempts = attempts.filter(
                          (a) =>
                            clsStudentIds.has(a.user_id) ||
                            a.student_class_snapshot === cls.name
                        );
                        const avg =
                          clsAttempts.length > 0
                            ? (
                                clsAttempts.reduce((acc, a) => acc + Number(a.score), 0) /
                                clsAttempts.length
                              ).toFixed(1)
                            : '-';

                        return (
                          <tr key={cls.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {cls.name}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {clsStudents.length}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-700">
                              {started}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-rose-600">
                              {notStarted}
                            </td>
                            <td className="py-3 px-3 text-center font-extrabold text-medika-700">
                              {avg}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClass(cls.name);
                                  setActiveTab('reports');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-medika-50 hover:bg-medika-100 text-medika-800 border border-medika-200 text-xs font-bold transition"
                              >
                                Nilai Kelas
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Recent Submissions */}
                <div className="mt-6">
                  <h4 className="text-sm font-extrabold text-slate-900 mb-3">
                    Pengumpulan Jawaban Terbaru (Klik untuk Inspeksi Jawaban)
                  </h4>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto medika-scroll pr-1">
                    {attempts.slice(0, 8).map((att) => {
                      const mat = materials.find(
                        (m) => m.material_index === att.material_index
                      );
                      return (
                        <div
                          key={att.id}
                          onClick={() => {
                            setInspectMaterial(mat);
                            setInspectAttemptId(att.id);
                          }}
                          className="p-3 rounded-2xl border border-slate-200 hover:border-medika-300 hover:bg-medika-50/30 cursor-pointer flex items-center justify-between gap-3 transition"
                        >
                          <div>
                            <div className="text-xs sm:text-sm font-bold text-slate-900">
                              {att.student_name_snapshot}{' '}
                              <span className="font-mono text-xs text-slate-500">
                                ({att.student_nim_snapshot})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {att.student_class_snapshot} ·{' '}
                              <b>{mat?.name || `Materi ${att.material_index + 1}`}</b> ·{' '}
                              {formatDateTimeID(att.submitted_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2.5 py-1 rounded-xl bg-medika-100 text-medika-900 font-extrabold text-xs">
                              Skor {Number(att.score)}
                            </span>
                            <Eye className="w-4 h-4 text-medika-600" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Analitik 11 Materi */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
                <h3 className="text-base font-extrabold text-slate-900 mb-1">
                  Analitik Capaian 11 Materi Sistem Kesehatan
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Rata-rata skor dan jumlah mahasiswa yang sudah mengerjakan tiap sistem
                </p>

                <div className="space-y-3">
                  {materials.map((m) => {
                    const matAttempts = attempts.filter(
                      (a) => a.material_index === m.material_index
                    );
                    const avg =
                      matAttempts.length > 0
                        ? Number(
                            (
                              matAttempts.reduce((acc, a) => acc + Number(a.score), 0) /
                              matAttempts.length
                            ).toFixed(1)
                          )
                        : 0;

                    return (
                      <div
                        key={m.material_index}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80"
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="text-slate-800 truncate pr-2">
                            M{m.material_index + 1}. {m.name}
                          </span>
                          <span className="text-slate-600 shrink-0">
                            {matAttempts.length}/{students.length} mhs · Rata-rata{' '}
                            <b className="text-medika-700">{avg}</b>
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-medika-500 to-clinical-500 rounded-full"
                            style={{ width: `${Math.min(100, avg)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GRADEBOOK BY CLASS & DETAILED REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Print-Only Formal Letterhead */}
            <div className="print-only border-b-2 border-slate-900 pb-4 mb-6">
              <h1 className="text-xl font-extrabold uppercase">
                {settings.institution_name} — {settings.program_name}
              </h1>
              <p className="text-sm font-semibold">
                Laporan Buku Nilai Evaluasi TTS Terminologi Kesehatan ({settings.academic_year})
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Filter Kelas: {selectedClass === 'ALL' ? 'Semua Kelas' : selectedClass} ·
                Dicetak pada {formatDateTimeID(new Date().toISOString())}
              </p>
            </div>

            {/* Control & Export Toolbar */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4 no-print">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-6 h-6 text-medika-600" />
                    Buku Nilai Terkategorisasi Per Kelas & Laporan Pengisian Detail
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Klik angka nilai pada kolom <b>M1–M11</b> untuk memeriksa lembar TTS &
                    rincian jawaban per soal milik mahasiswa tersebut.
                  </p>
                </div>

                {/* Export Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      exportAdminGradebookExcel({
                        students: filteredStudents,
                        attempts,
                        materials,
                        classes,
                        settings,
                        selectedClass,
                      })
                    }
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export Buku Nilai (.xlsx)
                  </button>

                  <button
                    type="button"
                    disabled={exportingDetailed}
                    onClick={handleExportDetailedAnswers}
                    className="px-3.5 py-2.5 rounded-xl bg-medika-700 hover:bg-medika-800 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition disabled:opacity-60"
                  >
                    <Download className="w-4 h-4" />
                    {exportingDetailed
                      ? 'Menyiapkan...'
                      : 'Export Jawaban Per Soal (.xlsx)'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      exportAdminGradebookCSV({
                        students: filteredStudents,
                        attempts,
                        materials,
                        classes,
                        settings,
                        selectedClass,
                      })
                    }
                    className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-4 h-4" />
                    CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak / PDF
                  </button>
                </div>
              </div>

              {/* Filters Row */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    <Filter className="w-3 h-3 inline mr-1" />
                    Kategori Kelas
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-medika-600"
                  >
                    <option value="ALL">Semua Kelas ({students.length} Mahasiswa)</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Fokus Materi TTS
                  </label>
                  <select
                    value={selectedMaterialFilter}
                    onChange={(e) => setSelectedMaterialFilter(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-medika-600"
                  >
                    <option value="ALL">Semua 11 Materi (Matriks Lengkap)</option>
                    {materials.map((m) => (
                      <option key={m.material_index} value={String(m.material_index)}>
                        M{m.material_index + 1} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Status Pengumpulan
                  </label>
                  <select
                    value={submissionStatusFilter}
                    onChange={(e) =>
                      setSubmissionStatusFilter(
                        e.target.value as
                          | 'all'
                          | 'has_submitted'
                          | 'completed_all'
                          | 'not_submitted'
                      )
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-medika-600"
                  >
                    <option value="all">Semua Mahasiswa</option>
                    <option value="has_submitted">Sudah Mengisi</option>
                    <option value="completed_all">Tuntas Seluruh 11 Materi</option>
                    <option value="not_submitted">Belum Mengisi Sama Sekali</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Cari Mahasiswa / NIM
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      placeholder="Ketik nama atau NIM..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-medika-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Class-Categorized Gradebook Sections */}
            {groupedStudentsByClass.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
                Tidak ada data mahasiswa yang sesuai dengan filter kelas/status di atas.
              </div>
            ) : (
              groupedStudentsByClass.map(([className, classStudents]) => {
                return (
                  <div
                    key={className}
                    className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    {/* Class Section Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-medika-950 to-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-lg bg-medika-500/20 border border-medika-400/30 text-medika-200 text-xs font-extrabold">
                          KELAS
                        </span>
                        <h3 className="font-extrabold text-sm sm:text-base">
                          {className}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-300 font-semibold">
                        {classStudents.length} Mahasiswa Ditampilkan
                      </span>
                    </div>

                    <div className="overflow-x-auto medika-scroll">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500">
                            <th className="py-3 px-3 font-bold">No</th>
                            <th className="py-3 px-3 font-bold min-w-[180px]">
                              Nama Mahasiswa & NIM
                            </th>
                            {materials.map((m) => (
                              <th
                                key={m.material_index}
                                title={m.name}
                                className={`py-3 px-2 font-extrabold text-center ${
                                  selectedMaterialFilter === String(m.material_index)
                                    ? 'bg-medika-100 text-medika-900'
                                    : ''
                                }`}
                              >
                                M{m.material_index + 1}
                              </th>
                            ))}
                            <th className="py-3 px-2.5 font-bold text-center">Selesai</th>
                            <th className="py-3 px-2.5 font-bold text-center">
                              Rata-rata
                            </th>
                            <th className="py-3 px-2.5 font-bold text-center">
                              Nilai (/11)
                            </th>
                            <th className="py-3 px-3 font-bold text-center">Mutu</th>
                            <th className="py-3 px-3 font-bold text-right no-print">
                              Detail
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {classStudents.map((stu, idx) => {
                            const stuMap =
                              attemptsByUserAndMat.get(stu.id) ||
                              new Map<number, QuizAttempt>();
                            const doneCount = stuMap.size;
                            let sum = 0;
                            stuMap.forEach((a) => {
                              sum += Number(a.score);
                            });
                            const avgDone =
                              doneCount > 0 ? Number((sum / doneCount).toFixed(1)) : 0;
                            const finalScore =
                              materials.length > 0
                                ? Number((sum / materials.length).toFixed(1))
                                : 0;
                            const grade = getNursingGradeInfo(finalScore);

                            return (
                              <tr key={stu.id} className="hover:bg-slate-50/90">
                                <td className="py-3 px-3 font-mono text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-3">
                                  <button
                                    type="button"
                                    onClick={() => setHistoryStudent(stu)}
                                    className="text-left group"
                                  >
                                    <div className="font-extrabold text-slate-900 group-hover:text-medika-700 group-hover:underline">
                                      {stu.full_name}
                                    </div>
                                    <div className="font-mono text-[11px] text-slate-500">
                                      {stu.nim || '-'}
                                    </div>
                                  </button>
                                </td>

                                {materials.map((m) => {
                                  const att = stuMap.get(m.material_index);
                                  if (!att) {
                                    return (
                                      <td
                                        key={m.material_index}
                                        className="py-3 px-1.5 text-center text-slate-300 font-mono"
                                      >
                                        -
                                      </td>
                                    );
                                  }
                                  const sc = Number(att.score);
                                  const pillClass =
                                    sc >= 80
                                      ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border-emerald-300'
                                      : sc >= 65
                                      ? 'bg-sky-100 text-sky-900 hover:bg-sky-200 border-sky-300'
                                      : sc >= 50
                                      ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border-amber-300'
                                      : 'bg-rose-100 text-rose-900 hover:bg-rose-200 border-rose-300';

                                  return (
                                    <td
                                      key={m.material_index}
                                      className="py-2.5 px-1 text-center"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setInspectMaterial(m);
                                          setInspectAttemptId(att.id);
                                        }}
                                        title={`Klik untuk melihat jawaban ${stu.full_name} di ${m.name}`}
                                        className={`px-2 py-1 rounded-lg border font-mono font-extrabold text-[11px] transition ${pillClass}`}
                                      >
                                        {sc}
                                      </button>
                                    </td>
                                  );
                                })}

                                <td className="py-3 px-2.5 text-center font-mono font-bold">
                                  <span
                                    className={
                                      doneCount >= materials.length
                                        ? 'text-emerald-700'
                                        : doneCount > 0
                                        ? 'text-slate-800'
                                        : 'text-rose-600'
                                    }
                                  >
                                    {doneCount}/{materials.length}
                                  </span>
                                </td>
                                <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-700">
                                  {doneCount > 0 ? avgDone : '-'}
                                </td>
                                <td className="py-3 px-2.5 text-center font-mono font-extrabold text-medika-800">
                                  {doneCount > 0 ? finalScore : '-'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {doneCount > 0 ? (
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 font-extrabold text-slate-800">
                                      {grade.letter}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-rose-600">
                                      Belum
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right no-print">
                                  <button
                                    type="button"
                                    onClick={() => setHistoryStudent(stu)}
                                    className="px-2.5 py-1 rounded-lg border border-medika-300 text-medika-700 hover:bg-medika-50 font-bold text-[11px]"
                                  >
                                    Rekap User
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}

            {/* Legend for M1 - M11 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 flex flex-wrap gap-x-5 gap-y-1.5">
              <span className="font-extrabold text-slate-800">Keterangan Kode Materi:</span>
              {materials.map((m) => (
                <span key={m.material_index}>
                  <b>M{m.material_index + 1}</b>: {m.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: USERS CRUD */}
        {activeTab === 'users' && (
          <AdminUsersCrudTab
            currentAdminId={profile.id}
            profiles={profiles}
            classes={classes}
            attempts={attempts}
            onRefreshAll={handleRefreshEverything}
            onOpenStudentHistory={(stu) => setHistoryStudent(stu)}
          />
        )}

        {/* TAB 4: CLASSES CRUD */}
        {activeTab === 'classes' && (
          <AdminClassesCrudTab
            classes={classes}
            profiles={profiles}
            attempts={attempts}
            onRefreshAll={handleRefreshEverything}
            onJumpToClassGradebook={(clsName) => {
              setSelectedClass(clsName);
              setActiveTab('reports');
            }}
          />
        )}

        {/* TAB 5: ADMIN-ONLY ANSWER KEYS */}
        {activeTab === 'answer_keys' && (
          <AdminAnswerKeyTab
            materials={materials}
            onMaterialsChanged={refreshMaterials}
          />
        )}

        {/* TAB 6: SETTINGS & ADMIN PROFILE */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-medika-100 text-medika-700 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Pengaturan Institusi & Visibilitas Nilai Mahasiswa
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Atur kapan mahasiswa dapat melihat nilai skor dan evaluasi kunci
                    jawaban benar/salah.
                  </p>
                </div>
              </div>

              {settingsSavedMsg && (
                <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{settingsSavedMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveAppSettings} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                      Nama Institusi / Kampus
                    </label>
                    <input
                      type="text"
                      required
                      value={instName}
                      onChange={(e) => setInstName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                      Program Studi / Unit
                    </label>
                    <input
                      type="text"
                      required
                      value={progName}
                      onChange={(e) => setProgName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                      Tahun Akademik
                    </label>
                    <input
                      type="text"
                      required
                      value={acadYear}
                      onChange={(e) => setAcadYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                    />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-medika-600" />
                    Kontrol Visibilitas Skor & Pembahasan Mahasiswa
                  </h3>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showScoreImm}
                      onChange={(e) => setShowScoreImm(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-teal-600"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        Tampilkan Angka Skor (0–100) Segera Setelah Submit Materi
                      </div>
                      <div className="text-xs text-slate-500">
                        Jika dinonaktifkan, angka skor baru terlihat oleh mahasiswa setelah
                        seluruh 11 materi selesai dikerjakan.
                      </div>
                    </div>
                  </label>

                  <div className="pt-3 border-t border-slate-200">
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
                      Mode Visibilitas Rincian Jawaban Benar/Salah Bagi Mahasiswa
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(
                        [
                          [
                            'after_all_completed',
                            'Setelah Seluruh 11 Materi Selesai (Rekomendasi)',
                            'Mencegah bocornya kunci jawaban ke teman sekelas sebelum semua materi selesai.',
                          ],
                          [
                            'immediate_per_section',
                            'Langsung Setelah Submit Tiap Materi',
                            'Mahasiswa langsung melihat evaluasi jawaban benar/salah begitu selesai 1 materi.',
                          ],
                          [
                            'score_only',
                            'Hanya Skor Ringkas (Khusus Ujian Ketat)',
                            'Rincian kunci jawaban per soal hanya bisa dilihat oleh Admin/Dosen.',
                          ],
                        ] as const
                      ).map(([val, title, desc]) => (
                        <label
                          key={val}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                            detailVisMode === val
                              ? 'bg-medika-50 border-medika-500 ring-2 ring-medika-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="detailVis"
                              checked={detailVisMode === val}
                              onChange={() => setDetailVisMode(val)}
                              className="accent-teal-600"
                            />
                            <span className="text-xs font-extrabold text-slate-900">
                              {title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                            {desc}
                          </p>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-start gap-3 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCorrectWordInReview}
                      onChange={(e) => setShowCorrectWordInReview(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-teal-600"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        Sertakan Kata Kunci Jawaban Benar Saat Rincian Evaluasi Mahasiswa Terbuka
                      </div>
                      <div className="text-xs text-slate-500">
                        Jika dicentang, setelah rincian terbuka mahasiswa dapat belajar dari
                        istilah medis yang benar pada soal yang salah.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowReg}
                      onChange={(e) => setAllowReg(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-teal-600"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        Izinkan Pendaftaran Mandiri Mahasiswa Baru di Halaman Login
                      </div>
                      <div className="text-xs text-slate-500">
                        Matikan jika akun mahasiswa hanya boleh dibuat oleh Admin melalui
                        menu Import Massal.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white text-sm font-extrabold shadow-md transition disabled:opacity-60"
                  >
                    {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Evaluasi'}
                  </button>
                </div>
              </form>

              {/* Google OAuth Provider Live Status & Setup Guide */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">
                        Integrasi Login Google (OAuth 2.0)
                      </span>
                      {googleProviderEnabled ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                          Aktif di Supabase ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                          Belum Diaktifkan di Supabase (Tombol Google Disembunyikan Otomatis)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => refreshAuthProviders()}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Cek Ulang Status
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Selama provider Google belum diaktifkan di Dashboard Supabase, tombol{' '}
                    <b>Lanjutkan dengan Google</b> disembunyikan otomatis agar mahasiswa tidak
                    mengalami error saat login. Begitu diaktifkan, tombol Google langsung muncul
                    otomatis tanpa perlu deploy ulang.
                  </p>

                  {!googleProviderEnabled && (
                    <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                      <div className="font-bold text-slate-900">
                        Cara Mengaktifkan Login Google (Opsional):
                      </div>
                      <div>
                        1. Buka <b>Google Cloud Console → APIs &amp; Services → Credentials</b>,
                        buat <b>OAuth 2.0 Client ID (Web application)</b>.
                      </div>
                      <div>
                        2. Isi <b>Authorized Redirect URI</b> dengan:{' '}
                        <code className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] select-all">
                          {SUPABASE_GOOGLE_CALLBACK_URL}
                        </code>
                      </div>
                      <div>
                        3. Buka <b>Supabase Dashboard → Authentication → Providers → Google</b>,
                        aktifkan toggle <b>Enable Sign in with Google</b>, tempel{' '}
                        <i>Client ID</i> &amp; <i>Client Secret</i>, lalu klik <b>Save</b>.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <ProfilePanel />
          </div>
        )}
      </main>

      {/* Student Full 11-Section History Modal */}
      {historyStudent && (
        <StudentFullHistoryModal
          student={historyStudent}
          attempts={Array.from(
            attemptsByUserAndMat.get(historyStudent.id)?.values() || []
          )}
          materials={materials}
          onClose={() => setHistoryStudent(null)}
          onInspectAttempt={(attemptId, mat) => {
            setInspectMaterial(mat);
            setInspectAttemptId(attemptId);
          }}
          onResetAttempt={handleResetAttempt}
        />
      )}

      {/* Individual Attempt Crossword & Clue Inspection Modal */}
      {inspectAttemptId && (
        <AttemptDetailModal
          attemptId={inspectAttemptId}
          material={inspectMaterial}
          isAdminView={true}
          onClose={() => setInspectAttemptId(null)}
          onResetAttempt={handleResetAttempt}
        />
      )}
    </div>
  );
}
