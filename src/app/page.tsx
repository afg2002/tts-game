'use client';

import React from 'react';
import { Lock, LogOut, Stethoscope } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { isStudentProfileComplete } from '@/types/medika';
import AuthScreen from '@/components/AuthScreen';
import OnboardingProfileScreen from '@/components/OnboardingProfileScreen';
import AdminPortal from '@/components/AdminPortal';
import StudentPortal from '@/components/StudentPortal';

function MedikaAppRouter() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-medika-600 to-clinical-600 text-white flex items-center justify-center shadow-lg animate-pulse mb-4">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">
          Medika Keperawatan
        </h2>
        <p className="text-xs font-medium text-slate-500 mt-1">
          Menghubungkan ke Portal Evaluasi TTS Kesehatan...
        </p>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  if (!profile.is_active) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-lg p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Akun Dinonaktifkan Sementara
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Akun Anda (<b>{profile.email}</b>) saat ini berstatus nonaktif. Silakan
            hubungi Dosen Pengampu atau Admin Program Studi Keperawatan.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Akun
          </button>
        </div>
      </div>
    );
  }

  if (profile.role === 'admin') {
    return <AdminPortal />;
  }

  // Mandatory identity gate for students (e.g., first-time Google OAuth login)
  if (!isStudentProfileComplete(profile)) {
    return <OnboardingProfileScreen />;
  }

  return <StudentPortal />;
}

export default function HomePage() {
  return (
    <AuthProvider>
      <MedikaAppRouter />
    </AuthProvider>
  );
}
