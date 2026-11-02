'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ClassItem, QuizAttempt, UserProfile } from '@/types/medika';

interface AdminUsersCrudTabProps {
  currentAdminId: string;
  profiles: UserProfile[];
  classes: ClassItem[];
  attempts: QuizAttempt[];
  onRefreshAll: () => Promise<void>;
  onOpenStudentHistory: (student: UserProfile) => void;
}

export default function AdminUsersCrudTab({
  currentAdminId,
  profiles,
  classes,
  attempts,
  onRefreshAll,
  onOpenStudentHistory,
}: AdminUsersCrudTabProps) {
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'admin'>('all');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Single User Create / Edit Modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<'student' | 'admin'>('student');
  const [formNim, setFormNim] = useState('');
  const [formClass, setFormClass] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [savingUser, setSavingUser] = useState(false);

  // Bulk Student Import Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkClass, setBulkClass] = useState(classes[0]?.name || '');
  const [bulkDefaultPassword, setBulkDefaultPassword] = useState('Medika2026!');
  const [bulkText, setBulkText] = useState('');
  const [savingBulk, setSavingBulk] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const attemptCountByUser = useMemo(() => {
    const map = new Map<string, number>();
    attempts.forEach((a) => {
      map.set(a.user_id, (map.get(a.user_id) || 0) + 1);
    });
    return map;
  }, [attempts]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (classFilter !== 'ALL') {
        if ((u.class_name || '') !== classFilter) return false;
      }
      if (q) {
        const hay = `${u.full_name} ${u.nim || ''} ${u.email} ${u.class_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [classFilter, profiles, roleFilter, searchQuery]);

  const openCreateModal = (defaultRole: 'student' | 'admin') => {
    setEditingUser(null);
    setFormRole(defaultRole);
    setFormEmail('');
    setFormPassword('');
    setFormName('');
    setFormNim('');
    setFormClass(defaultRole === 'student' ? classes[0]?.name || '' : '');
    setFormPhone('');
    setFormActive(true);
    setShowUserModal(true);
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setFormRole(u.role);
    setFormEmail(u.email);
    setFormPassword('');
    setFormName(u.full_name);
    setFormNim(u.nim || '');
    setFormClass(u.class_name || classes[0]?.name || '');
    setFormPhone(u.phone || '');
    setFormActive(u.is_active);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSavingUser(true);

    try {
      if (editingUser) {
        const { error } = await supabase.rpc('admin_update_user', {
          p_user_id: editingUser.id,
          p_full_name: formName.trim(),
          p_role: formRole,
          p_nim: formRole === 'student' ? formNim.trim() : formNim.trim() || null,
          p_class_name: formRole === 'student' ? formClass : '',
          p_phone: formPhone.trim(),
          p_is_active: formActive,
          p_new_email: formEmail.trim().toLowerCase(),
          p_new_password: formPassword.trim() || null,
        });
        if (error) throw error;
        setFeedback({
          type: 'success',
          text: `Data pengguna "${formName}" berhasil diperbarui.`,
        });
      } else {
        const { error } = await supabase.rpc('admin_create_user', {
          p_email: formEmail.trim().toLowerCase(),
          p_password: formPassword,
          p_full_name: formName.trim(),
          p_role: formRole,
          p_nim: formRole === 'student' ? formNim.trim() : formNim.trim() || null,
          p_class_name: formRole === 'student' ? formClass : '',
          p_phone: formPhone.trim(),
        });
        if (error) throw error;
        setFeedback({
          type: 'success',
          text: `Akun ${formRole === 'admin' ? 'Admin/Dosen' : 'Mahasiswa'} "${formName}" berhasil dibuat.`,
        });
      }
      setShowUserModal(false);
      await onRefreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan data pengguna.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (u: UserProfile) => {
    if (u.id === currentAdminId) {
      alert('Anda tidak dapat menghapus akun Admin Anda sendiri yang sedang aktif.');
      return;
    }
    const ok = window.confirm(
      `Hapus permanen akun ${u.role === 'admin' ? 'ADMIN' : 'MAHASISWA'} "${u.full_name}" (${u.email}) beserta seluruh riwayat pengerjaannya?`
    );
    if (!ok) return;

    setFeedback(null);
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: u.id,
    });
    if (error) {
      setFeedback({ type: 'error', text: error.message });
    } else {
      setFeedback({
        type: 'success',
        text: `Akun "${u.full_name}" berhasil dihapus.`,
      });
      await onRefreshAll();
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setFeedback({
        type: 'error',
        text: 'Masukkan minimal 1 baris data mahasiswa untuk diimpor.',
      });
      return;
    }

    const parsedStudents = lines.map((line) => {
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      const nim = parts[0] || '';
      const full_name = parts[1] || '';
      const email =
        parts[2] ||
        `${nim.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@mahasiswa.medika.ac.id`;
      return {
        nim,
        full_name,
        email,
        class_name: bulkClass,
        password: bulkDefaultPassword,
      };
    });

    setSavingBulk(true);
    try {
      const { data, error } = await supabase.rpc('admin_bulk_create_students', {
        p_students: parsedStudents,
      });
      if (error) throw error;
      const res = data as {
        created: number;
        errors: Array<{ nim?: string; email?: string; error?: string }>;
      };
      setFeedback({
        type: 'success',
        text: `Import massal selesai: ${res.created} akun mahasiswa berhasil dibuat, ${res.errors?.length || 0} dilewati.`,
      });
      setShowBulkModal(false);
      setBulkText('');
      await onRefreshAll();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal melakukan import massal.',
      });
    } finally {
      setSavingBulk(false);
    }
  };

  const studentCount = profiles.filter((p) => p.role === 'student').length;
  const adminCount = profiles.filter((p) => p.role === 'admin').length;

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Action Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-medika-600" />
              Manajemen CRUD Akun Mahasiswa & Admin / Dosen
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kelola akun mahasiswa per kelas, tambah akun dosen/admin pengampu, reset password,
              atau impor daftar kelas sekaligus.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setBulkClass(classes[0]?.name || '');
                setShowBulkModal(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-clinical-50 border border-clinical-200 hover:bg-clinical-100 text-clinical-800 text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <Upload className="w-4 h-4" />
              Import Massal Mahasiswa
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('admin')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              + Tambah Admin / Dosen
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('student')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
            >
              <UserPlus className="w-4 h-4" />
              + Tambah Mahasiswa
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['all', `Semua Akun (${profiles.length})`],
                ['student', `Mahasiswa (${studentCount})`],
                ['admin', `Admin / Dosen (${adminCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRoleFilter(key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  roleFilter === key
                    ? 'bg-medika-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 outline-none focus:border-medika-600"
            >
              <option value="ALL">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[250px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, NIM, email..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm outline-none focus:border-medika-600"
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3.5 px-4 font-bold">Nama & Email</th>
                <th className="py-3.5 px-4 font-bold">Peran</th>
                <th className="py-3.5 px-4 font-bold">NIM</th>
                <th className="py-3.5 px-4 font-bold">Kelas</th>
                <th className="py-3.5 px-4 font-bold text-center">Progres TTS</th>
                <th className="py-3.5 px-4 font-bold text-center">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Aksi CRUD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const doneCount = attemptCountByUser.get(u.id) || 0;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900">{u.full_name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-medika-300" />
                          Admin / Dosen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-medika-50 text-medika-800 border border-medika-200 text-xs font-bold">
                          Mahasiswa
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-700">
                      {u.nim || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                      {u.class_name || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.role === 'student' ? (
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                            doneCount >= 11
                              ? 'bg-emerald-100 text-emerald-800'
                              : doneCount > 0
                              ? 'bg-clinical-100 text-clinical-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {doneCount}/11 Materi
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.is_active ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {u.role === 'student' && (
                          <button
                            type="button"
                            onClick={() => onOpenStudentHistory(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-medika-50 hover:bg-medika-100 text-medika-800 border border-medika-200 text-xs font-bold inline-flex items-center gap-1 transition"
                            title="Lihat Rekap & Jawaban Mahasiswa"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Jawaban
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                          title="Edit Akun / Reset Password"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {u.id !== currentAdminId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Tidak ada akun yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Single User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">
                {editingUser
                  ? `Edit Akun: ${editingUser.full_name}`
                  : formRole === 'admin'
                  ? 'Tambah Akun Admin / Dosen Baru'
                  : 'Tambah Akun Mahasiswa Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Peran Akun *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as 'student' | 'admin')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold outline-none focus:border-medika-600"
                  >
                    <option value="student">Mahasiswa</option>
                    <option value="admin">Admin / Dosen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Status Akun
                  </label>
                  <select
                    value={formActive ? 'active' : 'inactive'}
                    onChange={(e) => setFormActive(e.target.value === 'active')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold outline-none focus:border-medika-600"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    formRole === 'admin'
                      ? 'Contoh: Ns. Budi Santoso, S.Kep., M.Kep.'
                      : 'Contoh: Siti Nurhaliza'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Alamat Email Login *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="nama@medikakeperawatan.ac.id"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                />
              </div>

              {formRole === 'student' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                      NIM Mahasiswa *
                    </label>
                    <input
                      type="text"
                      required
                      value={formNim}
                      onChange={(e) => setFormNim(e.target.value)}
                      placeholder="2410711020"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-medika-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                      Kelas *
                    </label>
                    <select
                      required
                      value={formClass}
                      onChange={(e) => setFormClass(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-medika-600"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    {editingUser ? 'Reset Password (Opsional)' : 'Password Awal *'}
                  </label>
                  <input
                    type="text"
                    required={!editingUser}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={
                      editingUser ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-medika-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    No. WhatsApp / Telepon
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-medika-600"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2.5 rounded-xl bg-medika-600 hover:bg-medika-700 text-white text-xs font-extrabold shadow-sm disabled:opacity-60"
                >
                  {savingUser
                    ? 'Menyimpan...'
                    : editingUser
                    ? 'Simpan Perubahan'
                    : 'Buat Akun Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden">
            <div className="bg-gradient-to-r from-medika-700 to-clinical-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Import Massal Daftar Mahasiswa Per Kelas
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkImport} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Target Kelas *
                  </label>
                  <select
                    required
                    value={bulkClass}
                    onChange={(e) => setBulkClass(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold outline-none focus:border-medika-600"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Password Default Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    value={bulkDefaultPassword}
                    onChange={(e) => setBulkDefaultPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-medika-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Tempel Daftar Mahasiswa (Format: NIM;Nama Lengkap;Email Opsional)
                </label>
                <textarea
                  rows={7}
                  required
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`2410711021;Nadia Putri Pratama;nadia@medikakeperawatan.ac.id\n2410711022;Rizky Ramadhan\n2410711023;Salsabila Azzahra`}
                  className="w-full p-3.5 rounded-2xl border border-slate-300 font-mono text-xs outline-none focus:border-medika-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Pemisah mendukung titik koma (<b>;</b>), koma (<b>,</b>), atau Tab dari
                  Excel. Jika kolom email dikosongkan, email dibuat otomatis dari NIM dan
                  mahasiswa dapat langsung login memakai NIM + Password Default.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBulk}
                  className="px-5 py-2.5 rounded-xl bg-medika-600 hover:bg-medika-700 text-white text-xs font-extrabold shadow-sm disabled:opacity-60"
                >
                  {savingBulk ? 'Memproses Import...' : 'Proses Import Mahasiswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
