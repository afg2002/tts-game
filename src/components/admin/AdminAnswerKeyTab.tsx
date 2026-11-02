'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Eye,
  Grid,
  KeyRound,
  Lock,
  Printer,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { QuizAnswerKey, QuizMaterial } from '@/types/medika';

interface AdminAnswerKeyTabProps {
  materials: QuizMaterial[];
  onMaterialsChanged: () => Promise<void>;
}

export default function AdminAnswerKeyTab({
  materials,
  onMaterialsChanged,
}: AdminAnswerKeyTabProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [answerKey, setAnswerKey] = useState<QuizAnswerKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'both' | 'table' | 'grid'>('both');
  const [toggling, setToggling] = useState(false);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.material_index === selectedIndex) || materials[0],
    [materials, selectedIndex]
  );

  useEffect(() => {
    let mounted = true;
    async function loadKey() {
      setLoading(true);
      const { data } = await supabase
        .from('quiz_answer_keys')
        .select('*')
        .eq('material_index', selectedIndex)
        .maybeSingle();
      if (mounted) {
        setAnswerKey((data as QuizAnswerKey) || null);
        setLoading(false);
      }
    }
    loadKey();
    return () => {
      mounted = false;
    };
  }, [selectedIndex]);

  const startNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedMaterial) return map;
    [...selectedMaterial.across_clues, ...selectedMaterial.down_clues].forEach((c) => {
      map.set(`${c.row},${c.col}`, c.gridNo);
    });
    return map;
  }, [selectedMaterial]);

  const filteredAcross = useMemo(() => {
    if (!answerKey) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return answerKey.across_answers;
    return answerKey.across_answers.filter(
      (item) =>
        item.answer.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        String(item.gridNo) === q
    );
  }, [answerKey, searchTerm]);

  const filteredDown = useMemo(() => {
    if (!answerKey) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return answerKey.down_answers;
    return answerKey.down_answers.filter(
      (item) =>
        item.answer.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        String(item.gridNo) === q
    );
  }, [answerKey, searchTerm]);

  const handleToggleMaterialActive = async () => {
    if (!selectedMaterial) return;
    setToggling(true);
    try {
      await supabase
        .from('quiz_materials')
        .update({ is_active: !selectedMaterial.is_active })
        .eq('material_index', selectedMaterial.material_index);
      await onMaterialsChanged();
    } finally {
      setToggling(false);
    }
  };

  if (!selectedMaterial) return null;

  return (
    <div className="space-y-6">
      {/* Top Selector & Controls */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-700">
                <Lock className="w-3.5 h-3.5" />
                Akses Rahasia Khusus Dosen / Admin
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Kunci Jawaban Resmi & Pengaturan Materi TTS
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print">
            <button
              type="button"
              disabled={toggling}
              onClick={handleToggleMaterialActive}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition ${
                selectedMaterial.is_active
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {selectedMaterial.is_active ? (
                <>
                  <ToggleRight className="w-4 h-4 text-emerald-600" />
                  Materi Aktif (Bisa Dikerjakan)
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-slate-500" />
                  Materi Ditutup Sementara
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              Cetak Kunci Jawaban
            </button>
          </div>
        </div>

        {/* Material Pills */}
        <div className="mt-4 flex flex-wrap gap-2 no-print">
          {materials.map((m) => (
            <button
              key={m.material_index}
              type="button"
              onClick={() => setSelectedIndex(m.material_index)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                selectedIndex === m.material_index
                  ? 'bg-medika-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>
                {m.material_index + 1}. {m.name}
              </span>
              {!m.is_active && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[9px]">
                  TUTUP
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter & View Switcher */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari istilah medis, nomor kotak, atau kata kunci soal..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 focus:border-medika-600 outline-none text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(
              [
                ['both', 'Tabel + Papan TTS'],
                ['table', 'Tabel Kunci Saja'],
                ['grid', 'Papan TTS Saja'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewMode(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === key
                    ? 'bg-white text-medika-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 font-medium bg-white rounded-3xl border border-slate-200">
          Memuat kunci jawaban materi...
        </div>
      ) : answerKey ? (
        <div className="space-y-6">
          {/* Visual Solution Grid */}
          {(viewMode === 'both' || viewMode === 'grid') && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                  <Grid className="w-5 h-5 text-medika-600" />
                  Papan Solusi Penuh: {selectedMaterial.name} ({selectedMaterial.rows}×
                  {selectedMaterial.cols})
                </h3>
                <span className="text-xs font-bold text-medika-700 bg-medika-50 px-3 py-1 rounded-full border border-medika-200">
                  {selectedMaterial.total_questions} Soal · {selectedMaterial.total_cells}{' '}
                  Kotak Huruf
                </span>
              </div>

              <div className="overflow-auto medika-scroll bg-slate-100 border border-slate-200 rounded-2xl p-4 max-h-[540px]">
                <div
                  className="grid gap-[2px] w-max mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${selectedMaterial.cols}, 28px)`,
                  }}
                >
                  {Array.from({ length: selectedMaterial.rows }).map((_, r) =>
                    Array.from({ length: selectedMaterial.cols }).map((__, c) => {
                      const key = `${r},${c}`;
                      const ch = answerKey.grid_solution[key];
                      if (!ch) {
                        return (
                          <div
                            key={key}
                            className="w-7 h-7 bg-slate-800/95 rounded-[3px]"
                          />
                        );
                      }
                      const num = startNumberMap.get(key);
                      return (
                        <div
                          key={key}
                          className="w-7 h-7 bg-emerald-50 border border-emerald-400 rounded-[3px] relative flex items-center justify-center font-mono font-extrabold text-xs text-emerald-950"
                        >
                          {num && (
                            <span className="absolute left-0.5 top-0 text-[7px] leading-none text-slate-500 font-sans">
                              {num}
                            </span>
                          )}
                          <span>{ch}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Answer Key Tables (Mendatar & Menurun) */}
          {(viewMode === 'both' || viewMode === 'table') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mendatar */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                  <span className="w-7 h-7 rounded-xl bg-medika-100 text-medika-700 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                  Kunci Jawaban Mendatar ({filteredAcross.length})
                </h3>
                <div className="space-y-3">
                  {filteredAcross.map((item) => (
                    <div
                      key={`ak_a_${item.no}`}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-extrabold text-slate-500">
                          Kotak #{item.gridNo} (Soal {item.no})
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-medika-600 text-white font-mono font-extrabold text-xs tracking-wider">
                          {item.answer} ({item.letters})
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {item.question}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Menurun */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                  <span className="w-7 h-7 rounded-xl bg-clinical-100 text-clinical-700 flex items-center justify-center">
                    <ArrowDown className="w-4 h-4" />
                  </span>
                  Kunci Jawaban Menurun ({filteredDown.length})
                </h3>
                <div className="space-y-3">
                  {filteredDown.map((item) => (
                    <div
                      key={`ak_d_${item.no}`}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-extrabold text-slate-500">
                          Kotak #{item.gridNo} (Soal {item.no})
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-clinical-600 text-white font-mono font-extrabold text-xs tracking-wider">
                          {item.answer} ({item.letters})
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {item.question}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
