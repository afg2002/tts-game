'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  GraduationCap,
  HeartPulse,
  Lock,
  LogOut,
  Play,
  Printer,
  Stethoscope,
  User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  QuizAttempt,
  QuizMaterial,
  formatDateTimeID,
  formatDuration,
  getNursingGradeInfo,
} from '@/types/medika';
import CrosswordWorkspace from './CrosswordWorkspace';
import AttemptDetailModal from './AttemptDetailModal';
import ProfilePanel from './ProfilePanel';

export default function StudentPortal() {
  const { profile, settings, materials, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<'materials' | 'transcript' | 'profile'>(
    'materials'
  );
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('all');
  const [playingMaterial, setPlayingMaterial] = useState<QuizMaterial | null>(null);
  const [myAttempts, setMyAttempts] = useState<QuizAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [inspectAttemptId, setInspectAttemptId] = useState<string | null>(null);
  const [inspectMaterial, setInspectMaterial] = useState<QuizMaterial | undefined>(
    undefined
  );
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const loadMyAttempts = useCallback(async () => {
    if (!profile) return;
    setLoadingAttempts(true);
    const { data } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', profile.id)
      .order('material_index', { ascending: true });
    if (data) {
      setMyAttempts(data as QuizAttempt[]);
    }
    setLoadingAttempts(false);
  }, [profile]);

  useEffect(() => {
    loadMyAttempts();
  }, [loadMyAttempts]);

  const attemptByMaterial = useMemo(() => {
    const map = new Map<number, QuizAttempt>();
    myAttempts.forEach((a) => map.set(a.material_index, a));
    return map;
  }, [myAttempts]);

  const activeMaterials = useMemo(
    () => materials.filter((m) => m.is_active),
    [materials]
  );

  const completedActiveCount = useMemo(
    () => activeMaterials.filter((m) => attemptByMaterial.has(m.material_index)).length,
    [activeMaterials, attemptByMaterial]
  );

  const allActiveCompleted =
    activeMaterials.length > 0 && completedActiveCount >= activeMaterials.length;

  const canSeeScore = settings.show_score_immediately || allActiveCompleted;
  const canSeeDetailNow =
    settings.student_detail_visibility === 'immediate_per_section' ||
    (settings.student_detail_visibility === 'after_all_completed' && allActiveCompleted);

  const statsSummary = useMemo(() => {
    const count = myAttempts.length;
    const sumScores = myAttempts.reduce((acc, a) => acc + Number(a.score), 0);
    const avgCompleted = count > 0 ? Number((sumScores / count).toFixed(1)) : 0;
    const overallScore =
      activeMaterials.length > 0
        ? Number((sumScores / activeMaterials.length).toFixed(1))
        : 0;
    const totalCorrectWords = myAttempts.reduce((acc, a) => acc + a.correct_words, 0);
    const totalWordsAttempted = myAttempts.reduce((acc, a) => acc + a.total_words, 0);

    return {
      count,
      avgCompleted,
      overallScore,
      totalCorrectWords,
      totalWordsAttempted,
      grade: getNursingGradeInfo(overallScore),
    };
  }, [activeMaterials.length, myAttempts]);

  const displayedMaterials = useMemo(() => {
    return materials.filter((m) => {
      const done = attemptByMaterial.has(m.material_index);
      if (filterMode === 'completed') return done;
      if (filterMode === 'pending') return !done && m.is_active;
      return true;
    });
  }, [attemptByMaterial, filterMode, materials]);

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Clinical Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-medika-600 to-clinical-600 text-white flex items-center justify-center shadow-md">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                {settings.institution_name}
              </div>
              <div className="text-xs text-slate-500">
                {settings.program_name} · {settings.academic_year}
              </div>
            </div>
          </div>

          {!playingMaterial && (
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl order-3 md:order-2 w-full md:w-auto justify-center">
              <button
                type="button"
                onClick={() => setActiveTab('materials')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition ${
                  activeTab === 'materials'
                    ? 'bg-white text-medika-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Materi TTS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('transcript')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition ${
                  activeTab === 'transcript'
                    ? 'bg-white text-medika-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>Nilai & Evaluasi</span>
                <span className="px-1.5 py-0.5 rounded-full bg-medika-100 text-medika-800 text-[10px] font-extrabold">
                  {completedActiveCount}/{activeMaterials.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition ${
                  activeTab === 'profile'
                    ? 'bg-white text-medika-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Profil Saya</span>
              </button>
            </nav>
          )}

          <div className="flex items-center gap-2.5 order-2 md:order-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-extrabold text-slate-900">
                {profile.full_name}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {profile.nim} · {profile.class_name}
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {bannerNotice && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{bannerNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              className="text-xs font-bold text-emerald-800 hover:underline"
            >
              Tutup
            </button>
          </div>
        )}

        {playingMaterial ? (
          <CrosswordWorkspace
            material={playingMaterial}
            profile={profile}
            onBack={() => setPlayingMaterial(null)}
            onSubmittedSuccess={async (payload) => {
              setPlayingMaterial(null);
              await loadMyAttempts();
              const matObj = materials.find(
                (m) => m.material_index === payload.material_index
              );
              setBannerNotice(
                payload.all_completed
                  ? `Selamat! Anda telah menyelesaikan seluruh ${activeMaterials.length} materi TTS Kesehatan. Nilai akhir dan rincian evaluasi lengkap Anda kini terbuka!`
                  : `Jawaban TTS materi ${matObj?.name || ''} berhasil dikumpulkan dan dikunci.`
              );
              setInspectMaterial(matObj);
              setInspectAttemptId(payload.attempt_id);
            }}
          />
        ) : activeTab === 'materials' ? (
          <div className="space-y-6">
            {/* Student Progress Hero */}
            <div className="bg-gradient-to-r from-medika-800 via-medika-700 to-clinical-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
                <div className="lg:col-span-7 space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
                    <GraduationCap className="w-4 h-4 text-medika-200" />
                    <span>{profile.class_name}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold">
                    Halo, {profile.full_name}
                  </h1>
                  <p className="text-medika-100 text-sm leading-relaxed max-w-2xl">
                    Pilih kategori sistem organ di bawah ini untuk mengerjakan TTS Terminologi
                    Kesehatan. Setiap kategori hanya dapat dikumpulkan <b>1 kali</b>.
                  </p>
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span>
                        Progres Penyelesaian Materi ({completedActiveCount}/
                        {activeMaterials.length} Selesai)
                      </span>
                      <span>
                        {activeMaterials.length > 0
                          ? Math.round((completedActiveCount / activeMaterials.length) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-300 to-white rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            activeMaterials.length > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (completedActiveCount / activeMaterials.length) * 100
                                  )
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                  <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
                    <div className="text-xs font-bold text-medika-100 uppercase">
                      Rata-rata Materi Diisi
                    </div>
                    <div className="text-3xl font-extrabold mt-1">
                      {canSeeScore
                        ? statsSummary.count > 0
                          ? statsSummary.avgCompleted
                          : '-'
                        : '🔒'}
                    </div>
                    <div className="text-xs text-medika-100 mt-1">
                      {statsSummary.count} materi terkumpul
                    </div>
                  </div>

                  <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
                    <div className="text-xs font-bold text-medika-100 uppercase">
                      Nilai Akhir (/11)
                    </div>
                    <div className="text-3xl font-extrabold mt-1">
                      {allActiveCompleted
                        ? statsSummary.overallScore
                        : canSeeScore && statsSummary.count > 0
                        ? statsSummary.overallScore
                        : '-'}
                    </div>
                    <div className="text-xs text-medika-100 mt-1">
                      {allActiveCompleted
                        ? `Predikat ${statsSummary.grade.letter} (${statsSummary.grade.predicate})`
                        : `${activeMaterials.length - completedActiveCount} materi tersisa`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(
                  [
                    ['all', `Semua Materi (${materials.length})`],
                    [
                      'pending',
                      `Belum Dikerjakan (${Math.max(0, activeMaterials.length - completedActiveCount)})`,
                    ],
                    ['completed', `Sudah Dikerjakan (${myAttempts.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterMode(key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      filterMode === key
                        ? 'bg-medika-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-medika-600" />
                <span>
                  {allActiveCompleted
                    ? 'Seluruh materi selesai! Anda dapat membuka rincian evaluasi lengkap.'
                    : settings.student_detail_visibility === 'after_all_completed'
                    ? 'Selesaikan seluruh materi untuk membuka rincian jawaban lengkap.'
                    : 'Klik materi untuk mulai mengerjakan evaluasi.'}
                </span>
              </div>
            </div>

            {/* 11 Health System Cards */}
            {loadingAttempts ? (
              <div className="py-12 text-center text-slate-500 font-medium">
                Memuat daftar materi evaluasi...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedMaterials.map((mat) => {
                  const attempt = attemptByMaterial.get(mat.material_index);
                  const isCompleted = Boolean(attempt);

                  return (
                    <div
                      key={mat.material_index}
                      className={`bg-white rounded-3xl border p-5 flex flex-col justify-between transition shadow-sm hover:shadow-md ${
                        isCompleted
                          ? 'border-emerald-200 bg-gradient-to-b from-white to-emerald-50/20'
                          : !mat.is_active
                          ? 'border-slate-200 opacity-70'
                          : 'border-slate-200 hover:border-medika-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-xl bg-medika-50 text-medika-800 border border-medika-100 text-xs font-extrabold">
                            Materi {mat.material_index + 1}
                          </span>

                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Sudah Diisi (1/1)
                            </span>
                          ) : !mat.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                              <Lock className="w-3.5 h-3.5" />
                              Ditutup
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                              Belum Dikerjakan
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-extrabold text-slate-900 mt-3">
                          {mat.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {mat.subtitle}
                        </p>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span>
                            <b>{mat.across_clues.length}</b> Mendatar ·{' '}
                            <b>{mat.down_clues.length}</b> Menurun
                          </span>
                          <span className="font-mono">{mat.total_cells} kotak</span>
                        </div>
                      </div>

                      <div className="mt-5">
                        {isCompleted && attempt ? (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl px-3.5 py-2.5">
                              <div>
                                <div className="text-[10px] font-bold uppercase text-slate-400">
                                  Skor Nilai
                                </div>
                                <div className="text-lg font-extrabold text-medika-700">
                                  {canSeeScore ? Number(attempt.score) : 'Tersimpan'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-bold uppercase text-slate-400">
                                  Soal Benar
                                </div>
                                <div className="text-sm font-bold text-slate-800">
                                  {canSeeScore
                                    ? `${attempt.correct_words}/${attempt.total_words} soal`
                                    : `${attempt.filled_words}/${attempt.total_words} diisi`}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setInspectMaterial(mat);
                                setInspectAttemptId(attempt.id);
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-white border border-medika-300 hover:bg-medika-50 text-medika-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                            >
                              <Eye className="w-4 h-4" />
                              {canSeeDetailNow
                                ? 'Lihat Detail Jawaban & Evaluasi'
                                : 'Lihat Ringkasan Hasil'}
                            </button>
                          </div>
                        ) : mat.is_active ? (
                          <button
                            type="button"
                            onClick={() => setPlayingMaterial(mat)}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            Kerjakan Materi Ini (1x Kesempatan)
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed"
                          >
                            Materi Belum Dibuka Dosen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'transcript' ? (
          <div className="space-y-6">
            {/* Printable Transcript Header */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-medika-50 text-medika-700 text-xs font-bold border border-medika-200">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    Kartu Hasil Evaluasi Terminologi Kesehatan
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                    {profile.full_name}
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    NIM: <b className="font-mono">{profile.nim}</b> · Kelas:{' '}
                    <b>{profile.class_name}</b> · {settings.institution_name}
                  </p>
                </div>

                <div className="flex items-center gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 transition"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak Kartu Nilai
                  </button>
                </div>
              </div>

              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
                <div className="p-4 rounded-2xl bg-medika-50 border border-medika-200">
                  <span className="text-xs font-bold text-medika-700 uppercase">
                    Status Kelengkapan
                  </span>
                  <div className="text-xl font-extrabold text-medika-900 mt-1">
                    {completedActiveCount}/{activeMaterials.length} Materi
                  </div>
                  <span className="text-xs text-medika-700">
                    {allActiveCompleted ? 'Tuntas Lengkap ✓' : 'Masih Berjalan'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Rata-rata Materi Diisi
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {canSeeScore ? statsSummary.avgCompleted : '🔒'}
                  </div>
                  <span className="text-xs text-slate-500">Skala 0 – 100</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Nilai Akhir Kumulatif
                  </span>
                  <div className="text-2xl font-extrabold text-clinical-700 mt-1">
                    {canSeeScore ? statsSummary.overallScore : '🔒'}
                  </div>
                  <span className="text-xs text-slate-500">Dari total {activeMaterials.length} materi</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Predikat Akademik
                  </span>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {canSeeScore && statsSummary.count > 0
                      ? `${statsSummary.grade.letter} (${statsSummary.grade.predicate})`
                      : '-'}
                  </div>
                  <span className="text-xs text-slate-500">
                    {canSeeScore
                      ? `${statsSummary.totalCorrectWords} soal kata benar`
                      : 'Menunggu selesai'}
                  </span>
                </div>
              </div>

              {!allActiveCompleted &&
                settings.student_detail_visibility === 'after_all_completed' && (
                  <div className="mb-5 p-4 rounded-2xl bg-clinical-50 border border-clinical-100 text-clinical-900 text-xs sm:text-sm flex items-center gap-3 no-print">
                    <Activity className="w-5 h-5 text-clinical-600 shrink-0" />
                    <span>
                      Anda telah menyelesaikan <b>{completedActiveCount}</b> dari{' '}
                      <b>{activeMaterials.length}</b> materi. Selesaikan{' '}
                      <b>{activeMaterials.length - completedActiveCount} materi lainnya</b>{' '}
                      untuk membuka detail evaluasi jawaban per nomor soal secara menyeluruh!
                    </span>
                  </div>
                )}

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-3.5 px-4 font-bold">No</th>
                      <th className="py-3.5 px-4 font-bold">Materi Sistem Kesehatan</th>
                      <th className="py-3.5 px-4 font-bold text-center">Status</th>
                      <th className="py-3.5 px-4 font-bold text-center">Soal Benar</th>
                      <th className="py-3.5 px-4 font-bold text-center">Huruf Benar</th>
                      <th className="py-3.5 px-4 font-bold text-center">Durasi</th>
                      <th className="py-3.5 px-4 font-bold text-center">Nilai Skor</th>
                      <th className="py-3.5 px-4 font-bold text-right no-print">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((mat) => {
                      const att = attemptByMaterial.get(mat.material_index);
                      return (
                        <tr key={mat.material_index} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                            {mat.material_index + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{mat.name}</div>
                            {att && (
                              <div className="text-[11px] text-slate-400">
                                Dikirim {formatDateTimeID(att.submitted_at)}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {att ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                Selesai ✓
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                                Belum Diisi
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs">
                            {att
                              ? canSeeScore
                                ? `${att.correct_words}/${att.total_words}`
                                : `${att.filled_words}/${att.total_words}`
                              : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs">
                            {att
                              ? canSeeScore
                                ? `${att.correct_cells}/${att.total_cells}`
                                : `${att.filled_cells}/${att.total_cells}`
                              : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                            {att ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatDuration(att.duration_seconds)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {att ? (
                              canSeeScore ? (
                                <span className="px-3 py-1 rounded-xl bg-medika-50 border border-medika-200 text-medika-800 font-extrabold text-sm">
                                  {Number(att.score)}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 font-semibold">
                                  Terkunci
                                </span>
                              )
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right no-print">
                            {att ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectMaterial(mat);
                                  setInspectAttemptId(att.id);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-medika-300 text-medika-700 hover:bg-medika-50 text-xs font-bold transition"
                              >
                                {canSeeDetailNow ? 'Detail Jawaban' : 'Ringkasan'}
                              </button>
                            ) : mat.is_active ? (
                              <button
                                type="button"
                                onClick={() => setPlayingMaterial(mat)}
                                className="px-3 py-1.5 rounded-lg bg-medika-600 hover:bg-medika-700 text-white text-xs font-bold transition"
                              >
                                Kerjakan
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <ProfilePanel />
        )}
      </main>

      {/* Attempt Detail Inspection Modal */}
      {inspectAttemptId && (
        <AttemptDetailModal
          attemptId={inspectAttemptId}
          material={inspectMaterial}
          isAdminView={false}
          onClose={() => setInspectAttemptId(null)}
        />
      )}
    </div>
  );
}
