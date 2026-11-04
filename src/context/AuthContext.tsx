'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { fetchGoogleProviderStatus, supabase } from '@/lib/supabase';
import { FALLBACK_PUBLIC_MATERIALS } from '@/data/fallbackMaterials';
import {
  AppSettings,
  ClassItem,
  QuizMaterial,
  UserProfile,
} from '@/types/medika';

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  institution_name: 'Medika Keperawatan',
  program_name: 'Program Studi S1 Keperawatan',
  course_name: 'Evaluasi Terminologi Kesehatan',
  academic_year: '2026/2027',
  show_score_immediately: true,
  student_detail_visibility: 'after_all_completed',
  show_correct_word_in_student_review: true,
  allow_self_registration: true,
};

interface RegisterStudentInput {
  email: string;
  password: string;
  fullName: string;
  nim: string;
  className: string;
  phone?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  settings: AppSettings;
  classes: ClassItem[];
  materials: QuizMaterial[];
  googleProviderEnabled: boolean;
  loading: boolean;
  signInWithIdentifier: (identifier: string, password: string) => Promise<void>;
  registerStudent: (input: RegisterStudentInput) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  completeStudentOnboarding: (input: {
    fullName: string;
    nim: string;
    className: string;
    phone?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshClasses: () => Promise<void>;
  refreshMaterials: () => Promise<void>;
  refreshAuthProviders: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [materials, setMaterials] = useState<QuizMaterial[]>(
    FALLBACK_PUBLIC_MATERIALS as unknown as QuizMaterial[]
  );
  const [googleProviderEnabled, setGoogleProviderEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAuthProviders = useCallback(async () => {
    const enabled = await fetchGoogleProviderStatus();
    setGoogleProviderEnabled(enabled);
    return enabled;
  }, []);

  const refreshSettings = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      setSettings(data as AppSettings);
    }
  }, []);

  const refreshClasses = useCallback(async () => {
    const { data } = await supabase
      .from('classes')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (data) {
      setClasses(data as ClassItem[]);
    }
  }, []);

  const refreshMaterials = useCallback(async () => {
    const { data } = await supabase
      .from('quiz_materials')
      .select('*')
      .order('material_index', { ascending: true });
    if (data && data.length > 0) {
      setMaterials(data as QuizMaterial[]);
    }
  }, []);

  const fetchUserProfile = useCallback(async (authUser: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (data) {
      if (!data.is_active) {
        await supabase.auth.signOut();
        setProfile(null);
        throw new Error(
          'Akun Anda saat ini dinonaktifkan oleh Administrator. Hubungi dosen pengampu.'
        );
      }
      setProfile(data as UserProfile);
      return;
    }

    if (!error) {
      // Fallback profile row creation if trigger didn't run
      const meta = authUser.user_metadata || {};
      const { data: inserted } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
          full_name: meta.full_name || meta.name || '',
          nim: meta.nim ? String(meta.nim).trim().toUpperCase() : null,
          class_name: meta.class_name || '',
          role: 'student',
        })
        .select('*')
        .single();
      if (inserted) {
        setProfile(inserted as UserProfile);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (currentUser) {
      await fetchUserProfile(currentUser);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        await Promise.all([
          refreshSettings(),
          refreshClasses(),
          refreshMaterials(),
          refreshAuthProviders(),
        ]);
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchUserProfile(initialSession.user);
        }
      } catch (err) {
        console.error('Bootstrap error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setTimeout(() => {
          if (mounted && nextSession.user) {
            fetchUserProfile(nextSession.user).catch((err) => {
              console.error(err);
            });
          }
        }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [
    fetchUserProfile,
    refreshAuthProviders,
    refreshClasses,
    refreshMaterials,
    refreshSettings,
  ]);

  const signInWithIdentifier = async (identifier: string, password: string) => {
    const clean = identifier.trim();
    if (!clean) {
      throw new Error('Masukkan Email atau NIM terlebih dahulu.');
    }

    let emailToUse = clean.toLowerCase();
    if (!clean.includes('@')) {
      const { data: resolvedEmail, error: rpcErr } = await supabase.rpc(
        'resolve_login_identifier',
        { p_identifier: clean }
      );
      if (rpcErr || !resolvedEmail) {
        throw new Error(
          `NIM "${clean.toUpperCase()}" tidak ditemukan. Pastikan NIM sudah terdaftar atau gunakan alamat Email Anda.`
        );
      }
      emailToUse = resolvedEmail;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Email/NIM atau Password yang Anda masukkan salah.');
      }
      throw new Error(error.message);
    }

    if (data.user) {
      await fetchUserProfile(data.user);
    }
  };

  const registerStudent = async (input: RegisterStudentInput) => {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.fullName.trim().replace(/\s+/g, ' ');
    const cleanNim = input.nim.trim().toUpperCase();
    const cleanClass = input.className.trim().replace(/\s+/g, ' ');
    const cleanPhone = (input.phone || '').trim();

    if (!cleanName || !cleanNim || !cleanClass) {
      throw new Error('Nama Lengkap, NIM, dan Kelas wajib diisi lengkap.');
    }

    const { data: nimAvailable, error: nimCheckErr } = await supabase.rpc(
      'check_nim_available',
      { p_nim: cleanNim, p_exclude_user_id: null }
    );

    if (nimCheckErr) {
      throw new Error('Gagal memeriksa ketersediaan NIM: ' + nimCheckErr.message);
    }
    if (!nimAvailable) {
      throw new Error(`NIM "${cleanNim}" sudah terdaftar. Silakan login atau periksa kembali NIM Anda.`);
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: input.password,
      options: {
        data: {
          full_name: cleanName,
          nim: cleanNim,
          class_name: cleanClass,
        },
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        throw new Error('Email ini sudah terdaftar. Silakan masuk melalui menu Login.');
      }
      throw new Error(error.message);
    }

    if (data.user) {
      const { error: updErr } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          nim: cleanNim,
          class_name: cleanClass,
          phone: cleanPhone,
        })
        .eq('id', data.user.id);

      if (updErr) {
        console.warn('Update profile after signup warning:', updErr.message);
      }
      await fetchUserProfile(data.user);
    }
  };

  const signInWithGoogle = async () => {
    const enabled = await refreshAuthProviders();
    if (!enabled) {
      throw new Error(
        'Provider Login Google belum diaktifkan di Supabase Dashboard (Authentication → Providers → Google). Silakan masuk menggunakan Email / NIM dan Password.'
      );
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.url && typeof window !== 'undefined') {
      window.location.assign(data.url);
    }
  };

  const completeStudentOnboarding = async ({
    fullName,
    nim,
    className,
    phone,
  }: {
    fullName: string;
    nim: string;
    className: string;
    phone?: string;
  }) => {
    if (!user) throw new Error('Sesi pengguna tidak ditemukan.');

    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    const cleanNim = nim.trim().toUpperCase();
    const cleanClass = className.trim().replace(/\s+/g, ' ');

    if (!cleanName || !cleanNim || !cleanClass) {
      throw new Error('Nama Lengkap, NIM, dan Kelas wajib diisi.');
    }

    const { data: nimAvailable, error: checkErr } = await supabase.rpc(
      'check_nim_available',
      { p_nim: cleanNim, p_exclude_user_id: user.id }
    );
    if (checkErr) throw new Error(checkErr.message);
    if (!nimAvailable) {
      throw new Error(`NIM "${cleanNim}" sudah terdaftar pada akun lain.`);
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: cleanName,
        nim: cleanNim,
        class_name: cleanClass,
        phone: (phone || '').trim(),
      })
      .eq('id', user.id);

    if (error) {
      throw new Error(error.message);
    }

    await refreshProfile();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        settings,
        classes,
        materials,
        googleProviderEnabled,
        loading,
        signInWithIdentifier,
        registerStudent,
        signInWithGoogle,
        completeStudentOnboarding,
        signOut,
        refreshProfile,
        refreshSettings,
        refreshClasses,
        refreshMaterials,
        refreshAuthProviders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
