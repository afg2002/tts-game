'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  Edit3,
  ExternalLink,
  GitMerge,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ClassItem, QuizAttempt, UserProfile } from '@/types/medika';

interface AdminClassesCrudTabProps {
  classes: ClassItem[];
  profiles: UserProfile[];
  attempts: QuizAttempt[];
  onRefreshAll: () => Promise<void>;
  onJumpToClassGradebook: (className: string) => void;
}

interface DynamicClassSummary {
  name: string;
  studentCount: number;
  submittedStudents: number;
  attemptCount: number;
  avgScore: number;
}

export default function AdminClassesCrudTab({
  classes,
  profiles,
  attempts,
  onRefreshAll,
  onJumpToClassGradebook,
}: AdminClassesCrudTabProps) {
  const [renamingFrom, setRenamingFrom] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const dynamicClasses = useMemo<DynamicClassSummary[]>(() => {
    const classNames = new Set<string>();
    const studentsOnly = profiles.filter((p) => p.role === 'student');

    studentsOnly.forEach((s) => {
      const clean = (s.class_name || '').trim();
      if (clean) classNames.add(clean);
    });
    attempts.forEach((a) => {
      const clean = (a.student_class_snapshot || '').trim();
      if (clean) classNames.add(clean);
    });
    classes.forEach((c) => {
      const clean = (c.name || '').trim();
      if (clean) classNames.add(clean);
    });

    return Array.from(classNames)
      .sort((a, b) => a.localeCompare(b, 'id'))
      .map((clsName) => {
        const clsStudents = studentsOnly.filter(
          (p) => (p.class_name || '').trim() === clsName
        );
        const studentIds = new Set(clsStudents.map((s) => s.id));
        const clsAttempts = attempts.filter(
          (a) =>
            studentIds.has(a.user_id) ||
            (a.student_class_snapshot || '').trim() === clsName
        );
        const submittedUserSet = new Set(clsAttempts.map((a) => a.user_id));
        const sumScore = clsAttempts.reduce((acc, a) => acc + Number(a.score), 0);

        return {
          name: clsName,
          studentCount: clsStudents.length,
          submittedStudents: submittedUserSet.size,
          attemptCount: clsAttempts.length,
          avgScore:
            clsAttempts.length > 0
              ? Number((sumScore / clsAttempts.length).toFixed(1))
              : 0,
        };
      });
  }, [attempts, classes, profiles]);

  const openRenameModal = (currentName: string) => {
    setRenamingFrom(currentName);
    setNewClassName(currentName);
    setNotice(null);
  };

  const handleRenameOrMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFrom) return;
    const cleanNew = newClassName.trim().replace(/\s+/g, ' ');
    if (!cleanNew) return;

    setSaving(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.rpc('admin_rename_class_group', {
        p_old_name: renamingFrom,
        p_new_name: cleanNew,
      });
      if (error) throw error;

      const res = data as {
        updated_profiles?: number;
        updated_attempts?: number;
      } | null;

      setNotice({
        type: 'success',
        text: `Nama kelas "${renamingFrom}" berhasil diseragamkan menjadi "${cleanNew}" (${res?.updated_profiles || 0} profil mahasiswa diperbarui).`,
      });
      setRenamingFrom(null);
      await onRefreshAll();
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal mengubah / menggabungkan nama kelas.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-bold underline"
          >
            Tutup
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <BookMarked className="w-6 h-6 text-medika-600" />
              Pengelompokan & Penyeragaman Kelas Mahasiswa
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Mahasiswa dapat <b>mengisi sendiri nama kelasnya</b> secara bebas saat registrasi
              maupun di halaman profil. Setiap nama kelas yang diketik mahasiswa otomatis
              muncul di bawah ini. Jika terdapat perbedaan penulisan (misalnya{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs">
                1a
              </code>{' '}
              dan{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs">
                Kelas 1A
              </code>
              ), gunakan tombol <b>Seragamkan / Gabungkan Nama</b> agar seluruh mahasiswa
              terkumpul rapi dalam satu kelas yang sama.
            </p>
          </div>
        </div>
      </div>

      {dynamicClasses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-medika-50 text-medika-600 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            Belum Ada Data Kelas Mahasiswa
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Daftar kelas akan otomatis terbentuk begitu mahasiswa mendaftar dan mengetikkan
            nama kelasnya sendiri, atau saat Admin menambahkan mahasiswa baru.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {dynamicClasses.map((cls) => (
            <div
              key={cls.name}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-medika-700 bg-medika-50 px-2.5 py-0.5 rounded-full border border-medika-200">
                      Kelas Mahasiswa
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 mt-2">
                      {cls.name}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => openRenameModal(cls.name)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition"
                    title="Ubah atau gabungkan penulisan nama kelas ini"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Rapikan
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                  <div className="p-2.5 rounded-2xl bg-slate-50">
                    <div className="text-lg font-extrabold text-slate-900">
                      {cls.studentCount}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Mahasiswa
                    </div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-emerald-50/70">
                    <div className="text-lg font-extrabold text-emerald-700">
                      {cls.submittedStudents}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-emerald-700">
                      Sudah Isi
                    </div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-medika-50/70">
                    <div className="text-lg font-extrabold text-medika-700">
                      {cls.attemptCount > 0 ? cls.avgScore : '-'}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-medika-700">
                      Rata-rata
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onJumpToClassGradebook(cls.name)}
                className="mt-4 w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <span>Buka Buku Nilai Kelas Ini</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Rename / Merge Class */}
      {renamingFrom && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-medika-300" />
                Seragamkan / Gabungkan Nama Kelas
              </h3>
              <button
                type="button"
                onClick={() => setRenamingFrom(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameOrMerge} className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Seluruh mahasiswa dan riwayat nilai dengan kelas{' '}
                <b className="text-slate-900">&ldquo;{renamingFrom}&rdquo;</b> akan diperbarui
                ke nama kelas baru di bawah ini. Jika nama kelas baru sudah ada, keduanya
                otomatis digabungkan.
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  Nama Kelas Baru / Standar *
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Contoh: Kelas 1A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:border-medika-600"
                />
              </div>

              {dynamicClasses.length > 1 && (
                <div>
                  <div className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                    Atau klik untuk gabungkan ke kelas yang sudah ada:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dynamicClasses
                      .filter((c) => c.name !== renamingFrom)
                      .map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setNewClassName(c.name)}
                          className="px-2.5 py-1 rounded-lg bg-medika-50 hover:bg-medika-100 border border-medika-200 text-medika-800 text-xs font-bold transition"
                        >
                          {c.name} ({c.studentCount})
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenamingFrom(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-medika-600 hover:bg-medika-700 text-white text-xs font-extrabold shadow-sm disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan & Gabungkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
