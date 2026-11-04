'use client';

import React, { useState } from 'react';
import { AlertCircle, ClipboardCheck, LogOut, Stethoscope } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingProfileScreen() {
  const { profile, settings, completeStudentOnboarding, signOut } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [nim, setNim] = useState(profile?.nim || '');
  const [className, setClassName] = useState(profile?.class_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !nim.trim() || !className.trim()) {
      setError('Nama Lengkap, NIM, dan Kelas wajib diisi sebelum melanjutkan.');
      return;
    }

    setSaving(true);
    try {
      await completeStudentOnboarding({
        fullName,
        nim,
        className: className.trim(),
        phone,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Gagal menyimpan identitas mahasiswa.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medika-900 via-medika-800 to-clinical-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-medika-600 to-clinical-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{settings.institution_name}</span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="text-xs font-semibold text-white/90 hover:text-white flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
          <h1 className="text-2xl font-extrabold mt-4 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6" />
            Lengkapi Identitas Mahasiswa
          </h1>
          <p className="text-sm text-medika-100 mt-1">
            Akun Anda ({profile?.email}) berhasil terhubung. Lengkapi Nama Lengkap, NIM,
            dan Kelas (wajib) agar nilai evaluasi TTS Anda tercatat di buku nilai dosen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Lengkap Sesuai Presensi <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama lengkap Anda"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nomor Induk Mahasiswa (NIM) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={nim}
              onChange={(e) => setNim(e.target.value.toUpperCase())}
              placeholder="Masukkan NIM Anda"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Kelas Perkuliahan <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Ketik kelas Anda (misal: 1A)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nomor WhatsApp / HP (Opsional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812xxxxxxxx"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white font-bold text-sm shadow-lg shadow-medika-600/20 transition disabled:opacity-60"
          >
            {saving ? 'Menyimpan Data Akademik...' : 'Simpan Identitas & Mulai Evaluasi TTS'}
          </button>
        </form>
      </div>
    </div>
  );
}
