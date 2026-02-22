import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

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
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: string;
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description: string;
  assignee: string;
  startDate: string;
  endDate: string;
  progress: number;
  weight: number;
  status: 'normal' | 'behind' | 'completed' | 'overdue' | 'paused';
  selfScore: number | null;
  selfScoreNote: string;
  createdAt: string;
  progressHistory: ProgressEntry[];
}

export interface ProgressEntry {
  id: string;
  date: string;
  progress: number;
  note: string;
}

const KEYS = {
  departments: 'okr_departments',
  objectives: 'okr_objectives',
  keyResults: 'okr_key_results',
};

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'dept_1', name: '技术部', parentId: null, level: 0 },
  { id: 'dept_2', name: '产品部', parentId: null, level: 0 },
  { id: 'dept_3', name: '市场部', parentId: null, level: 0 },
  { id: 'dept_4', name: '销售部', parentId: null, level: 0 },
  { id: 'dept_5', name: '前端组', parentId: 'dept_1', level: 1 },
  { id: 'dept_6', name: '后端组', parentId: 'dept_1', level: 1 },
  { id: 'dept_7', name: '设计组', parentId: 'dept_2', level: 1 },
];

async function getItem<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  return JSON.parse(raw);
}

async function setItem<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

export async function getDepartments(): Promise<Department[]> {
  const deps = await getItem<Department>(KEYS.departments);
  if (deps.length === 0) {
    await setItem(KEYS.departments, DEFAULT_DEPARTMENTS);
    return DEFAULT_DEPARTMENTS;
  }
  return deps;
}

export async function getObjectives(): Promise<Objective[]> {
  return getItem<Objective>(KEYS.objectives);
}

export async function getObjectiveById(id: string): Promise<Objective | undefined> {
  const all = await getObjectives();
  return all.find(o => o.id === id);
}

export async function createObjective(data: Omit<Objective, 'id' | 'createdAt' | 'status'>): Promise<Objective> {
  const all = await getObjectives();
  const obj: Objective = {
    ...data,
    id: Crypto.randomUUID(),
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  all.push(obj);
  await setItem(KEYS.objectives, all);
  return obj;
}

export async function updateObjective(id: string, updates: Partial<Objective>): Promise<void> {
  const all = await getObjectives();
  const idx = all.findIndex(o => o.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    await setItem(KEYS.objectives, all);
  }
}

export async function deleteObjective(id: string): Promise<void> {
  let all = await getObjectives();
  all = all.filter(o => o.id !== id);
  await setItem(KEYS.objectives, all);
  let krs = await getKeyResults();
  krs = krs.filter(kr => kr.objectiveId !== id);
  await setItem(KEYS.keyResults, krs);
}

export async function getKeyResults(): Promise<KeyResult[]> {
  return getItem<KeyResult>(KEYS.keyResults);
}

export async function getKeyResultsByObjective(objectiveId: string): Promise<KeyResult[]> {
  const all = await getKeyResults();
  return all.filter(kr => kr.objectiveId === objectiveId);
}

export async function createKeyResult(data: Omit<KeyResult, 'id' | 'createdAt' | 'progress' | 'status' | 'selfScore' | 'selfScoreNote' | 'progressHistory'>): Promise<KeyResult> {
  const all = await getKeyResults();
  const kr: KeyResult = {
    ...data,
    id: Crypto.randomUUID(),
    progress: 0,
    status: 'normal',
    selfScore: null,
    selfScoreNote: '',
    progressHistory: [],
    createdAt: new Date().toISOString(),
  };
  all.push(kr);
  await setItem(KEYS.keyResults, all);
  return kr;
}

export async function updateKeyResult(id: string, updates: Partial<KeyResult>): Promise<void> {
  const all = await getKeyResults();
  const idx = all.findIndex(kr => kr.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    await setItem(KEYS.keyResults, all);
  }
}

export async function updateKRProgress(id: string, progress: number, note: string): Promise<void> {
  const all = await getKeyResults();
  const idx = all.findIndex(kr => kr.id === id);
  if (idx >= 0) {
    const kr = all[idx];
    const entry: ProgressEntry = {
      id: Crypto.randomUUID(),
      date: new Date().toISOString(),
      progress,
      note,
    };
    kr.progress = progress;
    kr.progressHistory = [...(kr.progressHistory || []), entry];

    const now = new Date();
    const end = new Date(kr.endDate);
    const start = new Date(kr.startDate);
    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);

    if (progress >= 100) {
      kr.status = 'completed';
    } else if (now > end) {
      kr.status = 'overdue';
    } else if (progress < expectedProgress * 0.8) {
      kr.status = 'behind';
    } else {
      kr.status = 'normal';
    }

    all[idx] = kr;
    await setItem(KEYS.keyResults, all);
  }
}

export async function scoreKeyResult(id: string, score: number, note: string): Promise<void> {
  const all = await getKeyResults();
  const idx = all.findIndex(kr => kr.id === id);
  if (idx >= 0) {
    all[idx].selfScore = score;
    all[idx].selfScoreNote = note;
    await setItem(KEYS.keyResults, all);
  }
}

export async function deleteKeyResult(id: string): Promise<void> {
  let all = await getKeyResults();
  all = all.filter(kr => kr.id !== id);
  await setItem(KEYS.keyResults, all);
}

export function getCycleOptions(): string[] {
  const year = new Date().getFullYear();
  return [
    `${year} 第一季度`,
    `${year} 第二季度`,
    `${year} 第三季度`,
    `${year} 第四季度`,
    `${year} 年度`,
    `${year + 1} 第一季度`,
    `${year + 1} 第二季度`,
  ];
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'normal': return '#10B981';
    case 'behind': return '#F59E0B';
    case 'completed': return '#3B82F6';
    case 'overdue': return '#EF4444';
    case 'paused': return '#64748B';
    default: return '#94A3B8';
  }
}

export function getScoreLabel(score: number): string {
  if (score === 1) return '完全达成';
  if (score === 0.7) return '基本达成';
  if (score === 0.3) return '部分达成';
  return '未达成';
}

export function getScoreColor(score: number): string {
  if (score === 1) return '#10B981';
  if (score === 0.7) return '#3B82F6';
  if (score === 0.3) return '#F59E0B';
  return '#EF4444';
}
