'use client';

import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AuthScreen() {
  const {
    settings,
    classes,
    googleProviderEnabled,
    signInWithIdentifier,
    registerStudent,
    signInWithGoogle,
  } = useAuth();

  const activeClasses = classes.filter((c) => c.is_active);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regNim, setRegNim] = useState('');
  const [regClass, setRegClass] = useState(activeClasses[0]?.name || '');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      await signInWithIdentifier(identifier, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal melakukan login.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!regName.trim() || !regNim.trim() || !(regClass || activeClasses[0]?.name)) {
      setError('Nama Lengkap, NIM, dan Kelas wajib diisi lengkap.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password minimal harus terdiri dari 6 karakter.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      await registerStudent({
        email: regEmail,
        password: regPassword,
        fullName: regName,
        nim: regNim,
        className: regClass || activeClasses[0]?.name || '',
        phone: regPhone,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Gagal mendaftarkan akun mahasiswa.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('provider is not enabled')) {
        setError(
          'Login Google belum diaktifkan pada server autentikasi. Silakan masuk atau daftar menggunakan Email / NIM dan Password.'
        );
      } else {
        setError(msg || 'Gagal memulai login Google.');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medika-950 via-medika-900 to-clinical-900 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle clinical background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-15">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-medika-400 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-clinical-500 blur-3xl" />
      </div>

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden border border-white/20 relative z-10">
        {/* Left Branding Hero */}
        <div className="lg:col-span-6 bg-gradient-to-br from-medika-700 via-medika-800 to-clinical-900 text-white p-8 sm:p-11 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-semibold tracking-wide uppercase mb-6">
              <Stethoscope className="w-4 h-4 text-medika-200" />
              <span>{settings.institution_name}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Portal Evaluasi TTS Terminologi Kesehatan
            </h1>
            <p className="mt-3 text-medika-100 text-base leading-relaxed">
              {settings.program_name} · {settings.course_name} ({settings.academic_year})
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3.5 bg-white/10 border border-white/15 rounded-2xl p-4">
                <div className="p-2.5 rounded-xl bg-medika-500/30 text-medika-100 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    11 Sistem Organ Keperawatan Lengkap
                  </h3>
                  <p className="text-xs text-medika-100/90 mt-0.5 leading-relaxed">
                    Pencernaan, Pernapasan, Kardiovaskuler, Perkemihan, Endokrin,
                    Muskuloskeletal, Panca Indera, Reproduksi Pria & Wanita, Saraf, serta
                    Imun dan Hematologi.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 bg-white/10 border border-white/15 rounded-2xl p-4">
                <div className="p-2.5 rounded-xl bg-medika-500/30 text-medika-100 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Identitas Akademik Terintegrasi Kelas
                  </h3>
                  <p className="text-xs text-medika-100/90 mt-0.5 leading-relaxed">
                    Wajib Nama Lengkap, NIM, dan Kelas untuk perekapan buku nilai otomatis
                    dosen pengampu per kelas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 bg-white/10 border border-white/15 rounded-2xl p-4">
                <div className="p-2.5 rounded-xl bg-medika-500/30 text-medika-100 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Evaluasi Terkunci 1x Submit per Materi
                  </h3>
                  <p className="text-xs text-medika-100/90 mt-0.5 leading-relaxed">
                    Setiap kategori materi dikerjakan 1 kali dengan konfirmasi rincian
                    sebelum pengiriman untuk menjamin objektivitas penilaian.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-medika-100/80">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-medika-300" />
              <span>Sistem Penilaian Digital Keperawatan</span>
            </div>
            <span className="font-mono">320 Soal Medis</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-6 p-7 sm:p-11 flex flex-col justify-center bg-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                {mode === 'login' ? 'Masuk ke Akun Anda' : 'Registrasi Mahasiswa'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {mode === 'login'
                  ? 'Gunakan NIM atau Email terdaftar untuk melanjutkan.'
                  : 'Lengkapi identitas Nama, NIM, dan Kelas dengan benar.'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-medika-50 border border-medika-200 flex items-center justify-center text-medika-700 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
          </div>

          {settings.allow_self_registration && (
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`py-2.5 text-sm font-bold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-white text-medika-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk (Login)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  if (!regClass && activeClasses[0]) setRegClass(activeClasses[0].name);
                }}
                className={`py-2.5 text-sm font-bold rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-white text-medika-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daftar Mahasiswa
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-medika-50 border border-medika-200 text-medika-800 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-medika-600 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email atau NIM Mahasiswa
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Masukkan NIM atau alamat email Anda"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white font-bold text-sm shadow-lg shadow-medika-600/20 transition disabled:opacity-60"
              >
                {submitting ? 'Memverifikasi Akun...' : 'Masuk ke Portal Evaluasi'}
              </button>

              {googleProviderEnabled && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-slate-400 font-semibold">
                        Atau masuk dengan
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2.5 transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.3 14.2c-.2-.7-.4-1.4-.4-2.2s.2-1.5.4-2.2L1.6 7C.6 9 0 11.2 0 12s.6 3 1.6 5l3.7-2.8z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c3 0 5.5-1 7.3-2.7l-3.7-2.9c-1 .7-2.2 1.1-3.6 1.1-3.1 0-5.8-2.1-6.7-5L1.6 16.3C3.5 20.4 7.4 23 12 23z"
                      />
                    </svg>
                    <span>Lanjutkan dengan Google</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-400">
                    Pengguna baru wajib melengkapi identitas Nama, NIM, & Kelas saat pertama masuk.
                  </p>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lengkap Mahasiswa <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Masukkan nama lengkap sesuai presensi akademik"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    NIM (Wajib) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regNim}
                    onChange={(e) => setRegNim(e.target.value.toUpperCase())}
                    placeholder="Masukkan Nomor Induk Mahasiswa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kelas (Wajib) <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={regClass}
                    onChange={(e) => setRegClass(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm bg-white"
                  >
                    <option value="" disabled>
                      -- Pilih Kelas --
                    </option>
                    {activeClasses.map((cls) => (
                      <option key={cls.id} value={cls.name}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Aktif <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="email@mahasiswa.ac.id"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0812xxxxxxxx (Opsional)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Password <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min. 6 karakter"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ulangi Password <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-medika-600 focus:ring-4 focus:ring-medika-500/15 outline-none text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white font-bold text-sm shadow-lg shadow-medika-600/20 transition disabled:opacity-60 mt-2"
              >
                {submitting
                  ? 'Mendaftarkan Akun...'
                  : 'Daftar & Masuk ke Portal Mahasiswa'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
