'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Grid,
  HelpCircle,
  ListChecks,
  Lock,
  Printer,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  AttemptDetailResponse,
  QuizMaterial,
  formatDateTimeID,
  formatDuration,
  getNursingGradeInfo,
} from '@/types/medika';

interface AttemptDetailModalProps {
  attemptId: string;
  material?: QuizMaterial;
  isAdminView?: boolean;
  onClose: () => void;
  onResetAttempt?: (attemptId: string) => Promise<void>;
}

export default function AttemptDetailModal({
  attemptId,
  material,
  isAdminView = false,
  onClose,
  onResetAttempt,
}: AttemptDetailModalProps) {
  const [detail, setDetail] = useState<AttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'words' | 'grid'>('words');
  const [statusFilter, setStatusFilter] = useState<'all' | 'correct' | 'wrong' | 'empty'>('all');
  const [showSolutionOverlay, setShowSolutionOverlay] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: rpcErr } = await supabase.rpc('get_attempt_detail', {
        p_attempt_id: attemptId,
      });
      if (!mounted) return;
      if (rpcErr) {
        setError(rpcErr.message);
      } else {
        setDetail(data as AttemptDetailResponse);
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [attemptId]);

  const startNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!material) return map;
    [...material.across_clues, ...material.down_clues].forEach((c) => {
      map.set(`${c.row},${c.col}`, c.gridNo);
    });
    return map;
  }, [material]);

  const activeCellsSet = useMemo(() => {
    return new Set(material?.active_cells || Object.keys(detail?.submitted_cells || {}));
  }, [material, detail]);

  const filteredWords = useMemo(() => {
    if (!detail?.words) return [];
    if (statusFilter === 'all') return detail.words;
    return detail.words.filter((w) => w.status === statusFilter);
  }, [detail, statusFilter]);

  const handleConfirmReset = async () => {
    if (!onResetAttempt) return;
    setResetting(true);
    try {
      await onResetAttempt(attemptId);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal mereset pengerjaan.');
    } finally {
      setResetting(false);
    }
  };

  const gradeInfo =
    detail && detail.score !== null ? getNursingGradeInfo(Number(detail.score)) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-medika-700 to-clinical-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-medika-100">
              {isAdminView ? 'Inspeksi Jawaban Mahasiswa (Admin)' : 'Hasil Evaluasi TTS Saya'}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold mt-0.5">
              {detail?.material_name || material?.name || 'Memuat Materi...'}
            </h2>
          </div>

          <div className="flex items-center gap-2 no-print">
            {detail && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto medika-scroll flex-1 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-slate-500 font-medium">
              Memuat rincian jawaban dan evaluasi...
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : detail ? (
            <>
              {/* Student Identity & Summary Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Identitas Mahasiswa
                    </div>
                    <div className="text-lg font-extrabold text-slate-900 mt-1">
                      {detail.student_name}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                      <span className="px-2.5 py-0.5 rounded-full bg-medika-100 text-medika-800 font-mono font-bold">
                        NIM: {detail.student_nim}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-clinical-100 text-clinical-700 font-semibold">
                        {detail.student_class}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Durasi: <b className="text-slate-700">{formatDuration(detail.duration_seconds)}</b>
                    </span>
                    <span>Dikirim: {formatDateTimeID(detail.submitted_at)}</span>
                  </div>
                </div>

                <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-medika-50/70 border border-medika-200 rounded-2xl p-4 flex flex-col justify-center">
                    <span className="text-xs font-bold text-medika-700 uppercase">
                      Nilai Skor
                    </span>
                    <div className="text-3xl font-extrabold text-medika-800 mt-1">
                      {detail.can_view_score && detail.score !== null
                        ? Number(detail.score)
                        : '🔒'}
                    </div>
                    {gradeInfo && (
                      <span
                        className={`mt-1.5 inline-block w-fit px-2 py-0.5 text-[11px] font-bold rounded-full border ${gradeInfo.badgeClass}`}
                      >
                        Mutu {gradeInfo.letter} · {gradeInfo.predicate}
                      </span>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Soal Kata Benar
                    </span>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                      {detail.can_view_score && detail.correct_words !== null
                        ? `${detail.correct_words}/${detail.total_words}`
                        : `${detail.filled_words}/${detail.total_words} diisi`}
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                      {detail.can_view_score && detail.word_score !== null
                        ? `${detail.word_score}% kata tepat`
                        : 'Tersimpan'}
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Kotak Huruf
                    </span>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                      {detail.can_view_score && detail.correct_cells !== null
                        ? `${detail.correct_cells}/${detail.total_cells}`
                        : `${detail.filled_cells}/${detail.total_cells}`}
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                      {detail.can_view_score ? 'Kotak huruf benar' : 'Kotak terisi'}
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Progres Materi
                    </span>
                    <div className="text-2xl font-extrabold text-clinical-700 mt-1">
                      {detail.completed_count}/{detail.active_count}
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                      {detail.all_completed ? 'Selesai Semua ✓' : 'Materi selesai'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Reset Option */}
              {isAdminView && onResetAttempt && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 no-print">
                  <div className="text-xs text-amber-900">
                    <b>Opsi Pengelolaan Dosen/Admin:</b> Jika mahasiswa mengalami kendala teknis
                    saat pengiriman, Anda dapat mereset pengerjaan materi ini agar mahasiswa
                    dapat mengisi ulang 1 kali.
                  </div>
                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset & Izinkan Ulang
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-700">
                        Hapus jawaban materi ini?
                      </span>
                      <button
                        type="button"
                        disabled={resetting}
                        onClick={handleConfirmReset}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                      >
                        {resetting ? 'Mereset...' : 'Ya, Reset'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Detail Section (Respecting Visibility Policy) */}
              {!detail.can_view_detail ? (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center max-w-2xl mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-medika-100 text-medika-700 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Rincian Evaluasi Jawaban Belum Dibuka
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {detail.visibility_policy === 'after_all_completed'
                      ? `Sesuai aturan evaluasi akademik, rincian detail benar/salah per soal akan otomatis terbuka setelah Anda menyelesaikan seluruh ${detail.active_count} materi kesehatan. Saat ini Anda telah menyelesaikan ${detail.completed_count} dari ${detail.active_count} materi.`
                      : 'Dosen pengampu saat ini mengatur tampilan hasil hanya berupa rekapitulasi skor nilai.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Tabs: Words vs Visual Grid */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 no-print">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('words')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                          activeTab === 'words'
                            ? 'bg-medika-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <ListChecks className="w-4 h-4" />
                        Rincian Jawaban Per Soal ({detail.words?.length || 0})
                      </button>
                      {material && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('grid')}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                            activeTab === 'grid'
                              ? 'bg-medika-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <Grid className="w-4 h-4" />
                          Visualisasi Papan TTS
                        </button>
                      )}
                    </div>

                    {activeTab === 'words' && (
                      <div className="flex items-center gap-1.5 text-xs">
                        {(
                          [
                            ['all', 'Semua'],
                            ['correct', 'Benar'],
                            ['wrong', 'Salah'],
                            ['empty', 'Kosong'],
                          ] as const
                        ).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setStatusFilter(val)}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                              statusFilter === val
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {activeTab === 'grid' && detail.can_view_answer_key && detail.grid_solution && (
                      <button
                        type="button"
                        onClick={() => setShowSolutionOverlay((v) => !v)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                          showSolutionOverlay
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showSolutionOverlay
                          ? 'Menampilkan Kunci Jawaban'
                          : 'Bandingkan dengan Kunci Jawaban'}
                      </button>
                    )}
                  </div>

                  {activeTab === 'words' ? (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                            <th className="py-3 px-4 font-bold">No / Arah</th>
                            <th className="py-3 px-4 font-bold">Pertanyaan Terminologi</th>
                            <th className="py-3 px-4 font-bold">Jawaban Mahasiswa</th>
                            {detail.can_view_answer_key && (
                              <th className="py-3 px-4 font-bold">Kunci Jawaban</th>
                            )}
                            <th className="py-3 px-4 font-bold text-center">Huruf</th>
                            <th className="py-3 px-4 font-bold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredWords.map((w, idx) => (
                            <tr key={`${w.direction}_${w.no}_${idx}`} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="font-extrabold text-slate-900">
                                  #{w.gridNo}
                                </span>
                                <span
                                  className={`ml-2 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                    w.direction === 'across'
                                      ? 'bg-medika-50 text-medika-700'
                                      : 'bg-clinical-50 text-clinical-700'
                                  }`}
                                >
                                  {w.direction === 'across' ? 'Mendatar' : 'Menurun'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-md leading-relaxed text-xs sm:text-sm">
                                {w.question}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-xs sm:text-sm tracking-wider">
                                <span
                                  className={
                                    w.status === 'correct'
                                      ? 'text-emerald-700'
                                      : w.status === 'empty'
                                      ? 'text-slate-400 italic'
                                      : 'text-rose-700'
                                  }
                                >
                                  {w.filledLetters === 0 ? '(Kosong)' : w.studentAnswer}
                                </span>
                              </td>
                              {detail.can_view_answer_key && (
                                <td className="py-3 px-4 font-mono font-bold text-xs sm:text-sm tracking-wider text-medika-800">
                                  {w.correctAnswer || '-'}
                                </td>
                              )}
                              <td className="py-3 px-4 text-center font-mono text-xs text-slate-600">
                                {w.correctLetters}/{w.letters}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {w.status === 'correct' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Benar
                                  </span>
                                ) : w.status === 'empty' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                    <HelpCircle className="w-3.5 h-3.5" />
                                    Kosong
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                                    <XCircle className="w-3.5 h-3.5" />
                                    Salah
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : material ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-500 inline-block" />
                          Hijau = Huruf Benar
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-500 inline-block" />
                          Merah = Huruf Salah
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-400 inline-block" />
                          Kuning = Kosong
                        </span>
                      </div>

                      <div className="overflow-auto medika-scroll bg-slate-100 border border-slate-200 rounded-2xl p-4 max-h-[520px]">
                        <div
                          className="grid gap-[2px] w-max mx-auto"
                          style={{
                            gridTemplateColumns: `repeat(${material.cols}, 28px)`,
                          }}
                        >
                          {Array.from({ length: material.rows }).map((_, r) =>
                            Array.from({ length: material.cols }).map((__, c) => {
                              const key = `${r},${c}`;
                              const isCell = activeCellsSet.has(key);
                              if (!isCell) {
                                return (
                                  <div
                                    key={key}
                                    className="w-7 h-7 bg-slate-800/90 rounded-[3px]"
                                  />
                                );
                              }
                              const status = detail.cell_statuses?.[key] || 'empty';
                              const stuChar = detail.submitted_cells?.[key] || '';
                              const solChar = detail.grid_solution?.[key] || '';
                              const num = startNumberMap.get(key);

                              const bgClass =
                                status === 'correct'
                                  ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                                  : status === 'wrong'
                                  ? 'bg-rose-100 border-rose-400 text-rose-900'
                                  : 'bg-amber-50 border-amber-300 text-amber-800';

                              return (
                                <div
                                  key={key}
                                  title={
                                    detail.can_view_answer_key
                                      ? `Isian: ${stuChar || '(Kosong)'} | Kunci: ${solChar}`
                                      : `Isian: ${stuChar || '(Kosong)'}`
                                  }
                                  className={`w-7 h-7 border rounded-[3px] relative flex items-center justify-center font-mono font-bold text-xs ${bgClass}`}
                                >
                                  {num && (
                                    <span className="absolute left-0.5 top-0 text-[7px] leading-none text-slate-500 font-sans">
                                      {num}
                                    </span>
                                  )}
                                  <span>{showSolutionOverlay && solChar ? solChar : stuChar}</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
