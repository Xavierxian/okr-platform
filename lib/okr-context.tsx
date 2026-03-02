import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { apiRequest } from './query-client';
import { useAuth } from './auth-context';

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  cycle: string;
  parentObjectiveId: string | null;
  status: string;
  isCollaborative: boolean;
  collaborativeDeptIds: string[];
  collaborativeUserIds: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  assigneeName: string;
  collaboratorId: string | null;
  collaboratorName: string;
  startDate: string;
  endDate: string;
  progress: number;
  weight: number;
  status: string;
  selfScore: number | null;
  selfScoreNote: string;
  progressHistory: { id: string; date: string; progress: number; note: string }[];
  createdAt: string;
}

export interface Cycle {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface AssignedKRItem {
  kr: KeyResult;
  objective: Objective;
}

interface OKRContextValue {
  departments: Department[];
  cycles: Cycle[];
  objectives: Objective[];
  keyResults: KeyResult[];
  assignedKRs: AssignedKRItem[];
  collaboratingKRs: AssignedKRItem[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addObjective: (data: any) => Promise<Objective>;
  editObjective: (id: string, updates: any) => Promise<void>;
  removeObjective: (id: string) => Promise<void>;
  addKeyResult: (data: any) => Promise<KeyResult>;
  editKeyResult: (id: string, updates: any) => Promise<void>;
  removeKeyResult: (id: string) => Promise<void>;
  reportProgress: (id: string, progress: number, note: string, images?: string[]) => Promise<void>;
  submitScore: (id: string, score: number, note: string) => Promise<void>;
}

const OKRContext = createContext<OKRContextValue | null>(null);

export function OKRProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [assignedKRs, setAssignedKRs] = useState<AssignedKRItem[]>([]);
  const [collaboratingKRs, setCollaboratingKRs] = useState<AssignedKRItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [depsRes, cyclesRes, objsRes, krsRes, assignedRes, collabRes] = await Promise.all([
        apiRequest("GET", "/api/departments"),
        apiRequest("GET", "/api/cycles"),
        apiRequest("GET", "/api/objectives"),
        apiRequest("GET", "/api/key-results"),
        apiRequest("GET", "/api/key-results/assigned-to-me"),
        apiRequest("GET", "/api/key-results/collaborating"),
      ]);
      const [deps, cyc, objs, krs, assigned, collab] = await Promise.all([
        depsRes.json(),
        cyclesRes.json(),
        objsRes.json(),
        krsRes.json(),
        assignedRes.json(),
        collabRes.json(),
      ]);
      setDepartments(deps);
      setCycles(cyc);
      setObjectives(objs);
      setKeyResults(krs);
      setAssignedKRs(assigned);
      setCollaboratingKRs(collab);
    } catch (err) {
      console.log("OKR refresh error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const uid = user?.id || null;
    if (uid !== lastUserId.current) {
      lastUserId.current = uid;
      if (uid) {
        refresh();
      } else {
        setDepartments([]);
        setCycles([]);
        setObjectives([]);
        setKeyResults([]);
        setAssignedKRs([]);
        setCollaboratingKRs([]);
        setIsLoading(false);
      }
    }
  }, [user, refresh]);

  const addObjective = useCallback(async (data: any) => {
    const res = await apiRequest("POST", "/api/objectives", data);
    const obj = await res.json();
    setObjectives(prev => [...prev, obj]);
    return obj;
  }, []);

  const editObjective = useCallback(async (id: string, updates: any) => {
    await apiRequest("PUT", `/api/objectives/${id}`, updates);
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }, []);

  const removeObjective = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/objectives/${id}`);
    setObjectives(prev => prev.filter(o => o.id !== id));
    setKeyResults(prev => prev.filter(kr => kr.objectiveId !== id));
  }, []);

  const addKeyResult = useCallback(async (data: any) => {
    const res = await apiRequest("POST", "/api/key-results", data);
    const kr = await res.json();
    setKeyResults(prev => [...prev, kr]);
    return kr;
  }, []);

  const editKeyResult = useCallback(async (id: string, updates: any) => {
    await apiRequest("PUT", `/api/key-results/${id}`, updates);
    setKeyResults(prev => prev.map(kr => kr.id === id ? { ...kr, ...updates } : kr));
  }, []);

  const removeKeyResult = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/key-results/${id}`);
    setKeyResults(prev => prev.filter(kr => kr.id !== id));
  }, []);

  const reportProgress = useCallback(async (id: string, progress: number, note: string, images?: string[]) => {
    const res = await apiRequest("PUT", `/api/key-results/${id}/progress`, { progress, note, images });
    const updatedKR = await res.json();
    setKeyResults(prev => prev.map(kr => kr.id === id ? updatedKR : kr));
    await refresh();
  }, [refresh]);

  const submitScore = useCallback(async (id: string, score: number, note: string) => {
    const res = await apiRequest("PUT", `/api/key-results/${id}/score`, { score, note });
    const updatedKR = await res.json();
    setKeyResults(prev => prev.map(kr => kr.id === id ? updatedKR : kr));
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({
    departments, cycles, objectives, keyResults, assignedKRs, collaboratingKRs, isLoading,
    refresh, addObjective, editObjective, removeObjective,
    addKeyResult, editKeyResult, removeKeyResult,
    reportProgress, submitScore,
  }), [departments, cycles, objectives, keyResults, assignedKRs, collaboratingKRs, isLoading, refresh, addObjective, editObjective, removeObjective, addKeyResult, editKeyResult, removeKeyResult, reportProgress, submitScore]);

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
