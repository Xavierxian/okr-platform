import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  Department, Objective, KeyResult,
  getDepartments, getObjectives, getKeyResults,
  createObjective, updateObjective, deleteObjective,
  createKeyResult, updateKeyResult, deleteKeyResult,
  updateKRProgress, scoreKeyResult,
} from './storage';

interface OKRContextValue {
  departments: Department[];
  objectives: Objective[];
  keyResults: KeyResult[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addObjective: (data: Omit<Objective, 'id' | 'createdAt' | 'status'>) => Promise<Objective>;
  editObjective: (id: string, updates: Partial<Objective>) => Promise<void>;
  removeObjective: (id: string) => Promise<void>;
  addKeyResult: (data: Omit<KeyResult, 'id' | 'createdAt' | 'progress' | 'status' | 'selfScore' | 'selfScoreNote' | 'progressHistory'>) => Promise<KeyResult>;
  editKeyResult: (id: string, updates: Partial<KeyResult>) => Promise<void>;
  removeKeyResult: (id: string) => Promise<void>;
  reportProgress: (id: string, progress: number, note: string) => Promise<void>;
  submitScore: (id: string, score: number, note: string) => Promise<void>;
}

const OKRContext = createContext<OKRContextValue | null>(null);

export function OKRProvider({ children }: { children: ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const [deps, objs, krs] = await Promise.all([
      getDepartments(),
      getObjectives(),
      getKeyResults(),
    ]);
    setDepartments(deps);
    setObjectives(objs);
    setKeyResults(krs);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addObjective = useCallback(async (data: Omit<Objective, 'id' | 'createdAt' | 'status'>) => {
    const obj = await createObjective(data);
    setObjectives(prev => [...prev, obj]);
    return obj;
  }, []);

  const editObjective = useCallback(async (id: string, updates: Partial<Objective>) => {
    await updateObjective(id, updates);
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }, []);

  const removeObjective = useCallback(async (id: string) => {
    await deleteObjective(id);
    setObjectives(prev => prev.filter(o => o.id !== id));
    setKeyResults(prev => prev.filter(kr => kr.objectiveId !== id));
  }, []);

  const addKeyResult = useCallback(async (data: Omit<KeyResult, 'id' | 'createdAt' | 'progress' | 'status' | 'selfScore' | 'selfScoreNote' | 'progressHistory'>) => {
    const kr = await createKeyResult(data);
    setKeyResults(prev => [...prev, kr]);
    return kr;
  }, []);

  const editKeyResult = useCallback(async (id: string, updates: Partial<KeyResult>) => {
    await updateKeyResult(id, updates);
    setKeyResults(prev => prev.map(kr => kr.id === id ? { ...kr, ...updates } : kr));
  }, []);

  const removeKeyResult = useCallback(async (id: string) => {
    await deleteKeyResult(id);
    setKeyResults(prev => prev.filter(kr => kr.id !== id));
  }, []);

  const reportProgress = useCallback(async (id: string, progress: number, note: string) => {
    await updateKRProgress(id, progress, note);
    await refresh();
  }, [refresh]);

  const submitScore = useCallback(async (id: string, score: number, note: string) => {
    await scoreKeyResult(id, score, note);
    setKeyResults(prev => prev.map(kr => kr.id === id ? { ...kr, selfScore: score, selfScoreNote: note } : kr));
  }, []);

  const value = useMemo(() => ({
    departments, objectives, keyResults, isLoading,
    refresh, addObjective, editObjective, removeObjective,
    addKeyResult, editKeyResult, removeKeyResult,
    reportProgress, submitScore,
  }), [departments, objectives, keyResults, isLoading, refresh, addObjective, editObjective, removeObjective, addKeyResult, editKeyResult, removeKeyResult, reportProgress, submitScore]);

  return (
    <OKRContext.Provider value={value}>
      {children}
    </OKRContext.Provider>
  );
}

export function useOKR() {
  const ctx = useContext(OKRContext);
  if (!ctx) throw new Error('useOKR must be used within OKRProvider');
  return ctx;
}
