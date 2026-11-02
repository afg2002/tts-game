'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  RotateCcw,
  Send,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  ClueItem,
  QuizMaterial,
  UserProfile,
  formatDuration,
} from '@/types/medika';

interface CrosswordWorkspaceProps {
  material: QuizMaterial;
  profile: UserProfile;
  onBack: () => void;
  onSubmittedSuccess: (resultPayload: {
    attempt_id: string;
    material_index: number;
    score_visible: boolean;
    score: number | null;
    correct_words: number | null;
    total_words: number;
    all_completed: boolean;
  }) => void;
}

export default function CrosswordWorkspace({
  material,
  profile,
  onBack,
  onSubmittedSuccess,
}: CrosswordWorkspaceProps) {
  const draftStorageKey = `medika_draft_${profile.id}_${material.material_index}`;
  const timerStorageKey = `medika_timer_${profile.id}_${material.material_index}`;
  const startStorageKey = `medika_started_${profile.id}_${material.material_index}`;

  const [values, setValues] = useState<Record<string, string>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [startedAtIso, setStartedAtIso] = useState<string>(new Date().toISOString());
  const [cellSize, setCellSize] = useState<number>(32);

  const [activeDirection, setActiveDirection] = useState<'across' | 'down'>('across');
  const [activeClueIndex, setActiveClueIndex] = useState<number>(0);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [agreedOneTimeRule, setAgreedOneTimeRule] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load saved draft + timer from localStorage
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftStorageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          setValues(parsed);
        }
      } else {
        setValues({});
      }

      const savedElapsed = Number(localStorage.getItem(timerStorageKey) || '0');
      setElapsedSeconds(Number.isFinite(savedElapsed) && savedElapsed > 0 ? savedElapsed : 0);

      const savedStarted = localStorage.getItem(startStorageKey);
      if (savedStarted) {
        setStartedAtIso(savedStarted);
      } else {
        const nowIso = new Date().toISOString();
        localStorage.setItem(startStorageKey, nowIso);
        setStartedAtIso(nowIso);
      }
    } catch {
      // ignore storage errors
    }
  }, [draftStorageKey, startStorageKey, timerStorageKey]);

  // Persist draft on change
  useEffect(() => {
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(values));
    } catch {
      // ignore
    }
  }, [draftStorageKey, values]);

  // Live timer
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        try {
          localStorage.setItem(timerStorageKey, String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerStorageKey]);

  const activeCellsSet = useMemo(
    () => new Set(material.active_cells),
    [material.active_cells]
  );

  // Map start coordinate "r,c" -> gridNo
  const startNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    [...material.across_clues, ...material.down_clues].forEach((c) => {
      map.set(`${c.row},${c.col}`, c.gridNo);
    });
    return map;
  }, [material.across_clues, material.down_clues]);

  // Map each cell "r,c" -> which across/down clue index owns it
  const cellToCluesMap = useMemo(() => {
    const map: Record<string, { across?: number; down?: number }> = {};
    material.across_clues.forEach((clue, idx) => {
      for (let k = 0; k < clue.letters; k++) {
        const key = `${clue.row},${clue.col + k}`;
        map[key] = { ...map[key], across: idx };
      }
    });
    material.down_clues.forEach((clue, idx) => {
      for (let k = 0; k < clue.letters; k++) {
        const key = `${clue.row + k},${clue.col}`;
        map[key] = { ...map[key], down: idx };
      }
    });
    return map;
  }, [material.across_clues, material.down_clues]);

  const currentClue: ClueItem | undefined = useMemo(() => {
    const list =
      activeDirection === 'across' ? material.across_clues : material.down_clues;
    return list[activeClueIndex] || list[0];
  }, [activeClueIndex, activeDirection, material.across_clues, material.down_clues]);

  const highlightedWordCells = useMemo(() => {
    const set = new Set<string>();
    if (!currentClue) return set;
    const dr = activeDirection === 'across' ? 0 : 1;
    const dc = activeDirection === 'across' ? 1 : 0;
    for (let k = 0; k < currentClue.letters; k++) {
      set.add(`${currentClue.row + dr * k},${currentClue.col + dc * k}`);
    }
    return set;
  }, [activeDirection, currentClue]);

  // Compute completion stats for live header & pre-submit confirmation modal
  const progressStats = useMemo(() => {
    const filledCellsCount = material.active_cells.filter(
      (k) => values[k] && values[k].trim().length > 0
    ).length;

    const incompleteAcross: ClueItem[] = [];
    let completeAcrossCount = 0;
    material.across_clues.forEach((c) => {
      let ok = true;
      for (let k = 0; k < c.letters; k++) {
        if (!values[`${c.row},${c.col + k}`]) {
          ok = false;
          break;
        }
      }
      if (ok) completeAcrossCount++;
      else incompleteAcross.push(c);
    });

    const incompleteDown: ClueItem[] = [];
    let completeDownCount = 0;
    material.down_clues.forEach((c) => {
      let ok = true;
      for (let k = 0; k < c.letters; k++) {
        if (!values[`${c.row + k},${c.col}`]) {
          ok = false;
          break;
        }
      }
      if (ok) completeDownCount++;
      else incompleteDown.push(c);
    });

    const pct =
      material.total_cells > 0
        ? Math.round((filledCellsCount / material.total_cells) * 100)
        : 0;

    return {
      filledCellsCount,
      pct,
      completeAcrossCount,
      completeDownCount,
      incompleteAcross,
      incompleteDown,
      totalCompleteWords: completeAcrossCount + completeDownCount,
    };
  }, [material, values]);

  const focusCell = useCallback((key: string) => {
    const el = inputRefs.current[key];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const selectClue = useCallback(
    (dir: 'across' | 'down', idx: number) => {
      setActiveDirection(dir);
      setActiveClueIndex(idx);
      const clue =
        dir === 'across' ? material.across_clues[idx] : material.down_clues[idx];
      if (!clue) return;
      const dr = dir === 'across' ? 0 : 1;
      const dc = dir === 'across' ? 1 : 0;

      // Focus first empty cell in word, otherwise first cell
      let targetKey = `${clue.row},${clue.col}`;
      for (let k = 0; k < clue.letters; k++) {
        const candidate = `${clue.row + dr * k},${clue.col + dc * k}`;
        if (!values[candidate]) {
          targetKey = candidate;
          break;
        }
      }
      setFocusedKey(targetKey);
      setTimeout(() => focusCell(targetKey), 10);
    },
    [focusCell, material.across_clues, material.down_clues, values]
  );

  const handleCellClick = (key: string) => {
    const owners = cellToCluesMap[key] || {};
    if (focusedKey === key) {
      // Toggle direction if intersection
      if (activeDirection === 'across' && owners.down !== undefined) {
        setActiveDirection('down');
        setActiveClueIndex(owners.down);
      } else if (activeDirection === 'down' && owners.across !== undefined) {
        setActiveDirection('across');
        setActiveClueIndex(owners.across);
      }
      return;
    }

    setFocusedKey(key);
    if (activeDirection === 'across' && owners.across !== undefined) {
      setActiveClueIndex(owners.across);
    } else if (activeDirection === 'down' && owners.down !== undefined) {
      setActiveClueIndex(owners.down);
    } else if (owners.across !== undefined) {
      setActiveDirection('across');
      setActiveClueIndex(owners.across);
    } else if (owners.down !== undefined) {
      setActiveDirection('down');
      setActiveClueIndex(owners.down);
    }
  };

  const stepAlongWord = (fromKey: string, delta: 1 | -1) => {
    const [r, c] = fromKey.split(',').map(Number);
    const dr = activeDirection === 'across' ? 0 : delta;
    const dc = activeDirection === 'across' ? delta : 0;
    const nextKey = `${r + dr},${c + dc}`;
    if (activeCellsSet.has(nextKey)) {
      setFocusedKey(nextKey);
      focusCell(nextKey);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, key: string) => {
    const [r, c] = key.split(',').map(Number);

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (values[key]) {
        setValues((prev) => ({ ...prev, [key]: '' }));
      } else {
        const dr = activeDirection === 'across' ? 0 : -1;
        const dc = activeDirection === 'across' ? -1 : 0;
        const prevKey = `${r + dr},${c + dc}`;
        if (activeCellsSet.has(prevKey)) {
          setValues((prev) => ({ ...prev, [prevKey]: '' }));
          setFocusedKey(prevKey);
          focusCell(prevKey);
        }
      }
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      handleCellClick(key);
      return;
    }

    const moveMap: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };

    if (moveMap[e.key]) {
      e.preventDefault();
      const [dr, dc] = moveMap[e.key];
      const nextKey = `${r + dr},${c + dc}`;
      if (activeCellsSet.has(nextKey)) {
        setFocusedKey(nextKey);
        handleCellClick(nextKey);
        focusCell(nextKey);
      }
      return;
    }

    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      const ch = e.key.toUpperCase();
      setValues((prev) => ({ ...prev, [key]: ch }));
      stepAlongWord(key, 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const clean = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(-1);
    setValues((prev) => ({ ...prev, [key]: clean }));
    if (clean) {
      stepAlongWord(key, 1);
    }
  };

  const handleResetDraft = () => {
    setValues({});
    localStorage.removeItem(draftStorageKey);
    setShowResetConfirm(false);
  };

  const handleFinalSubmit = async () => {
    if (!agreedOneTimeRule) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase.rpc('submit_quiz_attempt', {
        p_material_index: material.material_index,
        p_submitted_cells: values,
        p_duration_seconds: elapsedSeconds,
        p_started_at: startedAtIso,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Clear local draft on successful lock
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(timerStorageKey);
      localStorage.removeItem(startStorageKey);

      setShowSubmitModal(false);
      onSubmittedSuccess(data);
    } catch (err: any) {
      setSubmitError(err?.message || 'Gagal mengirimkan jawaban TTS.');
    } finally {
      setSubmitting(false);
    }
  };

  const isClueComplete = (dir: 'across' | 'down', clue: ClueItem) => {
    const dr = dir === 'across' ? 0 : 1;
    const dc = dir === 'across' ? 1 : 0;
    for (let k = 0; k < clue.letters; k++) {
      if (!values[`${clue.row + dr * k},${clue.col + dc * k}`]) return false;
    }
    return true;
  };

  return (
    <div className="space-y-4">
      {/* Top Action & Progress Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition shrink-0"
            title="Kembali ke Daftar Materi"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-medika-100 text-medika-800 text-xs font-extrabold">
                MATERI {material.material_index + 1} / 11
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {profile.full_name} · <span className="font-mono">{profile.nim}</span> ·{' '}
                {profile.class_name}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              {material.name}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 font-mono">
            <Clock className="w-4 h-4 text-medika-600" />
            <span>{formatDuration(elapsedSeconds)}</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-medika-50 border border-medika-200 text-medika-800 text-xs font-bold">
            Huruf: {progressStats.filledCellsCount}/{material.total_cells} ({progressStats.pct}%)
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-clinical-50 border border-clinical-100 text-clinical-700 text-xs font-bold">
            Soal Lengkap: {progressStats.totalCompleteWords}/{material.total_questions}
          </div>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Isian
          </button>

          <button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setAgreedOneTimeRule(false);
              setShowSubmitModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md shadow-medika-600/20 transition"
          >
            <Send className="w-4 h-4" />
            Kumpulkan Jawaban
          </button>
        </div>
      </div>

      {/* Active Clue Banner */}
      {currentClue && (
        <div className="bg-gradient-to-r from-medika-900 to-clinical-900 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="px-3 py-1 rounded-xl bg-medika-500/30 border border-medika-400/40 text-medika-100 font-extrabold text-xs whitespace-nowrap shrink-0 mt-0.5">
              {activeDirection === 'across' ? '➡️ MENDATAR' : '⬇️ MENURUN'} #{currentClue.gridNo}
            </span>
            <div>
              <p className="text-sm font-medium leading-relaxed text-white">
                {currentClue.question}{' '}
                <span className="text-medika-300 font-mono text-xs font-bold">
                  [{currentClue.letters} huruf]
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                const nextDir = activeDirection === 'across' ? 'down' : 'across';
                setActiveDirection(nextDir);
                setActiveClueIndex(0);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition"
            >
              Ganti Arah
            </button>
          </div>
        </div>
      )}

      {/* Main Layout: Crossword Grid + Clues */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Crossword Grid */}
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-medika-600" />
              <span>
                Klik kotak 2x atau tekan <b>Spasi</b> untuk berpindah Mendatar/Menurun. Draft
                tersimpan otomatis.
              </span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCellSize((s) => Math.max(22, s - 4))}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition"
                title="Perkecil Papan"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCellSize(31)}
                className="px-2 py-1 rounded-lg hover:bg-white text-xs font-bold text-slate-700"
              >
                {Math.round((cellSize / 31) * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setCellSize((s) => Math.min(44, s + 4))}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition"
                title="Perbesar Papan"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-auto medika-scroll bg-slate-100 border border-slate-200 rounded-2xl p-3 sm:p-4 max-h-[650px]">
            <div
              className="grid gap-[2px] w-max mx-auto"
              style={{
                gridTemplateColumns: `repeat(${material.cols}, ${cellSize}px)`,
              }}
            >
              {Array.from({ length: material.rows }).map((_, r) =>
                Array.from({ length: material.cols }).map((__, c) => {
                  const key = `${r},${c}`;
                  const isCell = activeCellsSet.has(key);

                  if (!isCell) {
                    return (
                      <div
                        key={key}
                        style={{ width: cellSize, height: cellSize }}
                        className="bg-slate-800/95 rounded-[3px]"
                      />
                    );
                  }

                  const num = startNumberMap.get(key);
                  const isFocused = focusedKey === key;
                  const isInWord = highlightedWordCells.has(key);
                  const val = values[key] || '';

                  return (
                    <div
                      key={key}
                      style={{ width: cellSize, height: cellSize }}
                      onClick={() => handleCellClick(key)}
                      className={`relative rounded-[3px] border transition-colors ${
                        isFocused
                          ? 'bg-medika-200 border-medika-600 ring-2 ring-medika-600 z-10'
                          : isInWord
                          ? 'bg-medika-50 border-medika-400'
                          : val
                          ? 'bg-white border-slate-400'
                          : 'bg-white border-slate-300 hover:border-medika-400'
                      }`}
                    >
                      {num && (
                        <span className="absolute left-0.5 top-0 text-[8px] leading-none font-bold text-slate-500 pointer-events-none select-none z-10">
                          {num}
                        </span>
                      )}
                      <input
                        ref={(el) => {
                          inputRefs.current[key] = el;
                        }}
                        type="text"
                        inputMode="text"
                        maxLength={2}
                        autoComplete="off"
                        spellCheck={false}
                        value={val}
                        onFocus={() => setFocusedKey(key)}
                        onKeyDown={(e) => handleKeyDown(e, key)}
                        onChange={(e) => handleInputChange(e, key)}
                        className="w-full h-full bg-transparent border-0 outline-none text-center font-mono font-extrabold text-slate-900 uppercase p-0 cursor-pointer focus:cursor-text"
                        style={{
                          fontSize: Math.max(12, Math.floor(cellSize * 0.52)),
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Clues Panel (Mendatar & Menurun) */}
        <div className="xl:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5">
            {/* Mendatar */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                  <span className="w-6 h-6 rounded-lg bg-medika-100 text-medika-700 flex items-center justify-center">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                  Mendatar ({progressStats.completeAcrossCount}/{material.across_clues.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto medika-scroll pr-1">
                {material.across_clues.map((clue, idx) => {
                  const isActive = activeDirection === 'across' && activeClueIndex === idx;
                  const complete = isClueComplete('across', clue);
                  return (
                    <button
                      key={`across_${idx}`}
                      type="button"
                      onClick={() => selectClue('across', idx)}
                      className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm leading-relaxed transition flex items-start justify-between gap-2 ${
                        isActive
                          ? 'bg-medika-50 border-medika-500 ring-2 ring-medika-500/20'
                          : complete
                          ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50'
                          : 'bg-slate-50/80 border-slate-200 hover:bg-medika-50/40 hover:border-medika-300'
                      }`}
                    >
                      <div>
                        <span className="font-extrabold text-medika-700 mr-1.5">
                          {clue.gridNo}.
                        </span>
                        <span className="text-slate-700">{clue.question}</span>{' '}
                        <span className="text-[11px] font-mono font-semibold text-slate-400">
                          [{clue.letters} huruf]
                        </span>
                      </div>
                      {complete && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menurun */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                  <span className="w-6 h-6 rounded-lg bg-clinical-100 text-clinical-700 flex items-center justify-center">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </span>
                  Menurun ({progressStats.completeDownCount}/{material.down_clues.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto medika-scroll pr-1">
                {material.down_clues.map((clue, idx) => {
                  const isActive = activeDirection === 'down' && activeClueIndex === idx;
                  const complete = isClueComplete('down', clue);
                  return (
                    <button
                      key={`down_${idx}`}
                      type="button"
                      onClick={() => selectClue('down', idx)}
                      className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm leading-relaxed transition flex items-start justify-between gap-2 ${
                        isActive
                          ? 'bg-clinical-50 border-clinical-500 ring-2 ring-clinical-500/20'
                          : complete
                          ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50'
                          : 'bg-slate-50/80 border-slate-200 hover:bg-clinical-50/40 hover:border-clinical-300'
                      }`}
                    >
                      <div>
                        <span className="font-extrabold text-clinical-700 mr-1.5">
                          {clue.gridNo}.
                        </span>
                        <span className="text-slate-700">{clue.question}</span>{' '}
                        <span className="text-[11px] font-mono font-semibold text-slate-400">
                          [{clue.letters} huruf]
                        </span>
                      </div>
                      {complete && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Draft Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-900">
              Kosongkan Seluruh Kotak TTS?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Seluruh huruf yang sedang Anda ketik pada materi <b>{material.name}</b> akan
              dikosongkan (belum terkirim ke dosen).
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetDraft}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold"
              >
                Ya, Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRE-SUBMIT DETAILED CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-gradient-to-r from-medika-700 to-clinical-700 text-white p-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5" />
                Konfirmasi Akhir Pengumpulan TTS
              </div>
              <h2 className="text-xl font-extrabold mt-2">
                Periksa Kembali Rincian Jawaban Anda
              </h2>
              <p className="text-xs sm:text-sm text-medika-100 mt-1">
                Pastikan seluruh nomor soal pada materi <b>{material.name}</b> telah diperiksa
                sebelum dikunci permanen.
              </p>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto medika-scroll">
              {submitError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Student Identity Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Nama</span>
                  <span className="font-bold text-slate-900 text-sm">{profile.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">NIM</span>
                  <span className="font-mono font-bold text-medika-700 text-sm">
                    {profile.nim}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Kelas</span>
                  <span className="font-bold text-slate-900 text-sm">{profile.class_name}</span>
                </div>
              </div>

              {/* Completion Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 rounded-2xl border border-slate-200 bg-white">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Kotak Terisi
                  </div>
                  <div className="text-lg font-extrabold text-medika-700 mt-0.5">
                    {progressStats.filledCellsCount}/{material.total_cells}
                  </div>
                  <div className="text-[11px] text-slate-500">{progressStats.pct}% terisi</div>
                </div>

                <div className="p-3 rounded-2xl border border-slate-200 bg-white">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Mendatar
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {progressStats.completeAcrossCount}/{material.across_clues.length}
                  </div>
                  <div className="text-[11px] text-slate-500">soal lengkap</div>
                </div>

                <div className="p-3 rounded-2xl border border-slate-200 bg-white">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Menurun
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {progressStats.completeDownCount}/{material.down_clues.length}
                  </div>
                  <div className="text-[11px] text-slate-500">soal lengkap</div>
                </div>

                <div className="p-3 rounded-2xl border border-slate-200 bg-white">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Waktu Kerja
                  </div>
                  <div className="text-lg font-extrabold text-clinical-700 mt-0.5 font-mono">
                    {formatDuration(elapsedSeconds)}
                  </div>
                  <div className="text-[11px] text-slate-500">durasi aktif</div>
                </div>
              </div>

              {/* Warning if incomplete clues exist */}
              {progressStats.incompleteAcross.length > 0 ||
              progressStats.incompleteDown.length > 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Terdapat{' '}
                      {progressStats.incompleteAcross.length +
                        progressStats.incompleteDown.length}{' '}
                      soal yang belum terisi penuh!
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Klik nomor di bawah ini jika Anda ingin kembali melengkapi kotak yang masih
                    kosong sebelum mengirim:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {progressStats.incompleteAcross.map((c) => {
                      const idx = material.across_clues.findIndex((x) => x.no === c.no);
                      return (
                        <button
                          key={`inc_a_${c.no}`}
                          type="button"
                          onClick={() => {
                            setShowSubmitModal(false);
                            if (idx >= 0) selectClue('across', idx);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold transition"
                        >
                          Mendatar #{c.gridNo}
                        </button>
                      );
                    })}
                    {progressStats.incompleteDown.map((c) => {
                      const idx = material.down_clues.findIndex((x) => x.no === c.no);
                      return (
                        <button
                          key={`inc_d_${c.no}`}
                          type="button"
                          onClick={() => {
                            setShowSubmitModal(false);
                            if (idx >= 0) selectClue('down', idx);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold transition"
                        >
                          Menurun #{c.gridNo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    Luar biasa! Seluruh kotak huruf dan soal Mendatar & Menurun telah terisi
                    lengkap (100%).
                  </span>
                </div>
              )}

              {/* Mandatory 1x Attempt Rule Agreement */}
              <label className="flex items-start gap-3 p-4 rounded-2xl bg-medika-50/70 border border-medika-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedOneTimeRule}
                  onChange={(e) => setAgreedOneTimeRule(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-medika-600 rounded"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  <b className="text-slate-900 block mb-0.5">
                    Pernyataan Konfirmasi Pengiriman (1x Kesempatan):
                  </b>
                  Saya menyatakan telah memeriksa seluruh isian TTS pada materi{' '}
                  <b>{material.name}</b>. Saya memahami setiap kategori materi kesehatan hanya
                  dapat dikumpulkan <b>1 (satu) kali</b> dan tidak dapat diubah kembali setelah
                  dikirim.
                </span>
              </label>

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-bold transition"
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  disabled={!agreedOneTimeRule || submitting}
                  onClick={handleFinalSubmit}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-medika-600 to-clinical-600 hover:from-medika-700 hover:to-clinical-700 text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-medika-600/20 transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Mengirim & Menilai...' : 'Ya, Kirim Jawaban Sekarang'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
