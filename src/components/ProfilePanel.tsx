'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const AVATAR_COLORS = [
  '#0D9488',
  '#0284C7',
  '#059669',
  '#2563EB',
  '#4F46E5',
  '#0F766E',
];

export default function ProfilePanel() {
  const { profile, classes, refreshProfile } = useAuth();
  const activeClasses = classes.filter((c) => c.is_active);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [nim, setNim] = useState(profile?.nim || '');
  const [className, setClassName] = useState(profile?.class_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || '#0D9488');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  if (!profile) return null;

  const isStudent = profile.role === 'student';
  const initials = (profile.full_name || profile.email || 'MK')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    if (!fullName.trim()) {
      setProfileMsg({ type: 'err', text: 'Nama lengkap wajib diisi.' });
      return;
    }
    if (isStudent && (!nim.trim() || !className.trim())) {
      setProfileMsg({
        type: 'err',
        text: 'Untuk Mahasiswa, NIM dan Kelas wajib diisi lengkap.',
      });
      return;
    }

    setSavingProfile(true);
    try {
      if (nim.trim()) {
        const { data: available, error: checkErr } = await supabase.rpc(
          'check_nim_available',
          {
            p_nim: nim.trim().toUpperCase(),
            p_exclude_user_id: profile.id,
          }
        );
        if (checkErr) throw new Error(checkErr.message);
        if (!available) {
          throw new Error(`NIM "${nim.trim().toUpperCase()}" sudah digunakan oleh akun lain.`);
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          nim: nim.trim() ? nim.trim().toUpperCase() : null,
          class_name: className.trim(),
          phone: phone.trim(),
          avatar_color: avatarColor,
        })
        .eq('id', profile.id);

      if (error) throw new Error(error.message);
      await refreshProfile();
      setProfileMsg({ type: 'ok', text: 'Profil Anda berhasil diperbarui.' });
    } catch (err: any) {
      setProfileMsg({
        type: 'err',
        text: err?.message || 'Gagal memperbarui profil.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword.length < 6) {
      setPassMsg({ type: 'err', text: 'Password baru minimal 6 karakter.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'err', text: 'Konfirmasi password baru tidak sama.' });
      return;
    }

    setSavingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      setNewPassword('');
      setConfirmPassword('');
      setPassMsg({ type: 'ok', text: 'Password akun Anda berhasil diperbarui.' });
    } catch (err: any) {
      setPassMsg({ type: 'err', text: err?.message || 'Gagal mengubah password.' });
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Identity Card */}
      <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold shadow-md shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-medika-50 text-medika-700 border border-medika-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              {profile.role === 'admin' ? 'Administrator / Dosen' : 'Mahasiswa Keperawatan'}
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              {profile.full_name || 'Profil Pengguna'}
            </h2>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {profile.email}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
          {profileMsg && (
            <div
              className={`p-3.5 rounded-xl text-sm flex items-center gap-2.5 border ${
                profileMsg.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {profileMsg.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Lengkap {isStudent && <span className="text-rose-600">*</span>}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
              />
            </div>
          </div>

          {isStudent ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  NIM Mahasiswa <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nim}
                  onChange={(e) => setNim(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kelas <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm bg-white"
                >
                  <option value="" disabled>
                    -- Pilih Kelas --
                  </option>
                  {activeClasses.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {className && !activeClasses.some((c) => c.name === className) && (
                    <option value={className}>{className}</option>
                  )}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Unit / Jabatan Akademik
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Contoh: Koordinator Mata Kuliah Keperawatan Dasar"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nomor WhatsApp / Telepon
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Warna Identitas Profil
            </label>
            <div className="flex items-center gap-2.5">
              {AVATAR_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setAvatarColor(col)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    avatarColor === col ? 'ring-4 ring-offset-2 ring-medika-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 rounded-xl bg-medika-600 hover:bg-medika-700 text-white font-bold text-sm flex items-center gap-2 shadow-sm transition disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
          </button>
        </form>
      </div>

      {/* Password Security Card */}
      <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 h-fit">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-clinical-50 text-clinical-700 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900">Keamanan & Password</h3>
            <p className="text-xs text-slate-500">Perbarui kata sandi akun Anda</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
          {passMsg && (
            <div
              className={`p-3.5 rounded-xl text-sm flex items-center gap-2 border ${
                passMsg.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {passMsg.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{passMsg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang password baru"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={savingPass}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition disabled:opacity-60"
          >
            {savingPass ? 'Memperbarui Password...' : 'Perbarui Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
