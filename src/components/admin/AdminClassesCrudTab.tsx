'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Plus,
  Trash2,
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

export default function AdminClassesCrudTab({
  classes,
  profiles,
  attempts,
  onRefreshAll,
  onJumpToClassGradebook,
}: AdminClassesCrudTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [semester, setSemester] = useState('Semester 1');
  const [lecturer, setLecturer] = useState('');
  const [sortOrder, setSortOrder] = useState(10);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const classMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        studentCount: number;
        submittedStudents: number;
        attemptCount: number;
        avgScore: number;
      }
    >();

    classes.forEach((cls) => {
      const students = profiles.filter(
        (p) => p.role === 'student' && p.class_name === cls.name
      );
      const studentIds = new Set(students.map((s) => s.id));
      const clsAttempts = attempts.filter(
        (a) => studentIds.has(a.user_id) || a.student_class_snapshot === cls.name
      );
      const submittedUserSet = new Set(clsAttempts.map((a) => a.user_id));
      const sumScore = clsAttempts.reduce((acc, a) => acc + Number(a.score), 0);

      map.set(cls.name, {
        studentCount: students.length,
        submittedStudents: submittedUserSet.size,
        attemptCount: clsAttempts.length,
        avgScore:
          clsAttempts.length > 0
            ? Number((sumScore / clsAttempts.length).toFixed(1))
            : 0,
      });
    });

    return map;
  }, [attempts, classes, profiles]);

  const openCreate = () => {
    setEditingClass(null);
    setCode(`KEP-${classes.length + 1}A`);
    setName('');
    setSemester('Semester 1');
    setLecturer('');
    setSortOrder((classes.length + 1) * 10);
    setIsActive(true);
    setShowModal(true);
  };

  const openEdit = (cls: ClassItem) => {
    setEditingClass(cls);
    setCode(cls.code);
    setName(cls.name);
    setSemester(cls.semester || '');
    setLecturer(cls.lecturer_name || '');
    setSortOrder(cls.sort_order || 0);
    setIsActive(cls.is_active);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setSaving(true);
    try {
      if (editingClass) {
        const { error } = await supabase.rpc('update_class_with_cascade', {
          p_class_id: editingClass.id,
          p_code: code.trim().toUpperCase(),
          p_name: name.trim(),
          p_semester: semester.trim(),
          p_lecturer_name: lecturer.trim(),
          p_is_active: isActive,
          p_sort_order: Number(sortOrder) || 0,
        });
        if (error) throw error;
        setNotice({
          type: 'success',
          text: `Data kelas "${name.trim()}" berhasil diperbarui beserta sinkronisasi mahasiswa.`,
        });
      } else {
        const { error } = await supabase.from('classes').insert({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          semester: semester.trim(),
          lecturer_name: lecturer.trim(),
          sort_order: Number(sortOrder) || 0,
          is_active: isActive,
        });
        if (error) throw error;
        setNotice({
          type: 'success',
          text: `Kelas baru "${name.trim()}" berhasil ditambahkan.`,
        });
      }
      setShowModal(false);
      await onRefreshAll();
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan kelas.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cls: ClassItem) => {
    const metrics = classMetrics.get(cls.name);
    if (metrics && metrics.studentCount > 0) {
      alert(
        `Kelas "${cls.name}" masih memiliki ${metrics.studentCount} mahasiswa terdaftar. Pindahkan mahasiswa terlebih dahulu atau nonaktifkan kelas.`
      );
      return;
    }
    if (!window.confirm(`Hapus kelas "${cls.name}" dari daftar master kelas?`)) {
      return;
    }
    const { error } = await supabase.from('classes').delete().eq('id', cls.id);
    if (error) {
      setNotice({ type: 'error', text: error.message });
    } else {
      setNotice({ type: 'success', text: `Kelas "${cls.name}" berhasil dihapus.` });
      await onRefreshAll();
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
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-medika-600" />
            Manajemen Master Kelas & Pengelompokan Mahasiswa
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Atur daftar kelas keperawatan agar penilaian dan ekspor rekapitulasi terorganisir
            rapi per kelas.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Tambah Kelas Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => {
          const m = classMetrics.get(cls.name) || {
            studentCount: 0,
            submittedStudents: 0,
            attemptCount: 0,
            avgScore: 0,
          };

          return (
            <div
              key={cls.id}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-medika-700 bg-medika-50 px-2.5 py-0.5 rounded-full border border-medika-200">
                      {cls.code} · {cls.semester || 'Aktif'}
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 mt-2">
                      {cls.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(cls)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                      title="Edit Kelas"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cls)}
                      className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {cls.lecturer_name && (
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Dosen PJ: {cls.lecturer_name}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50">
                    <div className="text-lg font-extrabold text-slate-900">
                      {m.studentCount}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Mahasiswa
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50/70">
                    <div className="text-lg font-extrabold text-emerald-800">
                      {m.submittedStudents}/{m.studentCount}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-emerald-700">
                      Sudah Isi
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-medika-50/70">
                    <div className="text-lg font-extrabold text-medika-800">
                      {m.avgScore}
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
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka Buku Nilai Kelas Ini
              </button>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">
                {editingClass ? 'Edit Kelas' : 'Tambah Kelas Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Kode Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="KEP-1A"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono uppercase outline-none focus:border-medika-600"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Nama Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="S1 Keperawatan - Kelas 2B"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Semester / Tingkat
                  </label>
                  <input
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="Semester 1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Status Pendaftaran
                  </label>
                  <select
                    value={isActive ? '1' : '0'}
                    onChange={(e) => setIsActive(e.target.value === '1')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-medika-600"
                  >
                    <option value="1">Aktif (Muncul di Registrasi)</option>
                    <option value="0">Arsip / Ditutup</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Dosen Penanggung Jawab (Opsional)
                </label>
                <input
                  type="text"
                  value={lecturer}
                  onChange={(e) => setLecturer(e.target.value)}
                  placeholder="Ns. Rina Kartika, M.Kep."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-medika-600 hover:bg-medika-700 text-white text-xs font-extrabold shadow-sm"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
