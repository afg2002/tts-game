'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Mail,
  Phone,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  QuizAttempt,
  QuizMaterial,
  UserProfile,
  formatDateTimeID,
  formatDuration,
  getNursingGradeInfo,
} from '@/types/medika';

interface StudentFullHistoryModalProps {
  student: UserProfile;
  attempts: QuizAttempt[];
  materials: QuizMaterial[];
  onClose: () => void;
  onInspectAttempt: (attemptId: string, material: QuizMaterial) => void;
  onResetAttempt: (attemptId: string) => Promise<void>;
}

export default function StudentFullHistoryModal({
  student,
  attempts,
  materials,
  onClose,
  onInspectAttempt,
  onResetAttempt,
}: StudentFullHistoryModalProps) {
  const attemptMap = new Map<number, QuizAttempt>();
  attempts.forEach((a) => attemptMap.set(a.material_index, a));

  const activeCount = materials.filter((m) => m.is_active).length || materials.length;
  const sumScore = attempts.reduce((acc, a) => acc + Number(a.score), 0);
  const avgCompleted =
    attempts.length > 0 ? Number((sumScore / attempts.length).toFixed(1)) : 0;
  const finalScore =
    activeCount > 0 ? Number((sumScore / activeCount).toFixed(1)) : 0;
  const grade = getNursingGradeInfo(finalScore);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-medika-800 to-clinical-800 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-medika-200">
              <GraduationCap className="w-4 h-4" />
              Rekapitulasi Individu Mahasiswa
            </div>
            <h2 className="text-xl font-extrabold mt-0.5">{student.full_name}</h2>
            <div className="text-xs text-medika-100 mt-1 flex flex-wrap items-center gap-3">
              <span className="font-mono font-bold">NIM: {student.nim || '-'}</span>
              <span>· {student.class_name || 'Tanpa Kelas'}</span>
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {student.email}
              </span>
              {student.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {student.phone}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto medika-scroll space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-medika-50 border border-medika-200">
              <span className="text-xs font-bold text-medika-700 uppercase">
                Materi Dikerjakan
              </span>
              <div className="text-2xl font-extrabold text-medika-900 mt-1">
                {attempts.length}/{materials.length}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Rata-rata Diisi
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {avgCompleted}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Nilai Akhir (/11)
              </span>
              <div className="text-2xl font-extrabold text-clinical-700 mt-1">
                {finalScore}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Predikat Mutu
              </span>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {attempts.length > 0 ? `${grade.letter} (${grade.predicate})` : '-'}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-3 px-4 font-bold">No</th>
                  <th className="py-3 px-4 font-bold">Materi Kesehatan</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                  <th className="py-3 px-4 font-bold text-center">Skor</th>
                  <th className="py-3 px-4 font-bold text-center">Soal Benar</th>
                  <th className="py-3 px-4 font-bold text-center">Durasi</th>
                  <th className="py-3 px-4 font-bold text-right">Tindakan Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.map((mat) => {
                  const att = attemptMap.get(mat.material_index);
                  return (
                    <tr key={mat.material_index} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-500">
                        {mat.material_index + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{mat.name}</div>
                        {att && (
                          <div className="text-[11px] text-slate-400">
                            {formatDateTimeID(att.submitted_at)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {att ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Selesai
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">
                            Belum Diisi
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-medika-800">
                        {att ? Number(att.score) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs">
                        {att ? `${att.correct_words}/${att.total_words}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-slate-600">
                        {att ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(att.duration_seconds)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {att ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onInspectAttempt(att.id, mat)}
                              className="px-2.5 py-1.5 rounded-lg bg-medika-600 hover:bg-medika-700 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail Jawaban
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    `Reset jawaban ${student.full_name} pada materi ${mat.name} agar mahasiswa dapat mengerjakan ulang?`
                                  )
                                ) {
                                  await onResetAttempt(att.id);
                                }
                              }}
                              className="p-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition"
                              title="Reset agar bisa mengisi ulang"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
