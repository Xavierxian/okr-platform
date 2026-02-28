import { eq, or, inArray, and } from "drizzle-orm";
import { db } from "./db";
import {
  users, departments, objectives, keyResults,
  type User, type InsertUser, type Department, type Objective, type KeyResult, type ProgressEntry,
} from "@shared/schema";
import bcrypt from "bcryptjs";

export async function getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user;
}

export async function createUser(data: InsertUser): Promise<User> {
  const hashed = await bcrypt.hash(data.password, 10);
  const [user] = await db.insert(users).values({ ...data, password: hashed }).returning();
  return user;
}

export async function updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }
  const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

export async function getAllUsers(): Promise<User[]> {
  return db.select().from(users);
}

export async function verifyPassword(plaintext: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hashed);
}

export async function getDepartments(): Promise<Department[]> {
  return db.select().from(departments);
}

export async function createDepartment(data: Omit<Department, "id">): Promise<Department> {
  const [dept] = await db.insert(departments).values(data).returning();
  return dept;
}

export async function updateDepartment(id: string, updates: Partial<Omit<Department, "id">>): Promise<Department | undefined> {
  const [dept] = await db.update(departments).set(updates).where(eq(departments.id, id)).returning();
  return dept;
}

export async function deleteDepartment(id: string): Promise<void> {
  await db.delete(departments).where(or(eq(departments.id, id), eq(departments.parentId, id)));
}

function getUserDeptIds(userDeptId: string | null, allDepts: Department[]): string[] {
  if (!userDeptId) return [];
  const ids = [userDeptId];
  const children = allDepts.filter(d => d.parentId === userDeptId);
  children.forEach(c => ids.push(c.id));
  const parent = allDepts.find(d => d.id === userDeptId);
  if (parent?.parentId) {
    ids.push(parent.parentId);
  }
  return [...new Set(ids)];
}

export async function getObjectivesForUser(user: User): Promise<Objective[]> {
  if (user.role === "super_admin") {
    return db.select().from(objectives);
  }
  const allDepts = await getDepartments();
  const deptIds = getUserDeptIds(user.departmentId, allDepts);

  const allObjs = await db.select().from(objectives);
  return allObjs.filter(obj => {
    if (deptIds.includes(obj.departmentId)) return true;
    if (obj.isCollaborative && obj.collaborativeDeptIds) {
      return (obj.collaborativeDeptIds as string[]).some(id => deptIds.includes(id));
    }
    return false;
  });
}

export async function getAllObjectives(): Promise<Objective[]> {
  return db.select().from(objectives);
}

export async function createObjectiveInDb(data: {
  title: string;
  description: string;
  departmentId: string;
  cycle: string;
  parentObjectiveId: string | null;
  isCollaborative: boolean;
  collaborativeDeptIds: string[];
  createdBy: string | null;
}): Promise<Objective> {
  const [obj] = await db.insert(objectives).values({
    ...data,
    status: "active",
  }).returning();
  return obj;
}

export async function updateObjectiveInDb(id: string, updates: Partial<Objective>): Promise<Objective | undefined> {
  const [obj] = await db.update(objectives).set(updates).where(eq(objectives.id, id)).returning();
  return obj;
}

export async function deleteObjectiveInDb(id: string): Promise<void> {
  await db.delete(keyResults).where(eq(keyResults.objectiveId, id));
  await db.delete(objectives).where(eq(objectives.id, id));
}

export async function getKeyResultsForObjectives(objectiveIds: string[]): Promise<KeyResult[]> {
  if (objectiveIds.length === 0) return [];
  return db.select().from(keyResults).where(inArray(keyResults.objectiveId, objectiveIds));
}

export async function getAllKeyResults(): Promise<KeyResult[]> {
  return db.select().from(keyResults);
}

export async function createKeyResultInDb(data: {
  objectiveId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  assigneeName: string;
  startDate: string;
  endDate: string;
  weight: number;
}): Promise<KeyResult> {
  const [kr] = await db.insert(keyResults).values({
    ...data,
    progress: 0,
    status: "normal",
    selfScore: null,
    selfScoreNote: "",
    progressHistory: [],
  }).returning();
  return kr;
}

export async function updateKeyResultInDb(id: string, updates: Partial<KeyResult>): Promise<KeyResult | undefined> {
  const [kr] = await db.update(keyResults).set(updates).where(eq(keyResults.id, id)).returning();
  return kr;
}

export async function deleteKeyResultInDb(id: string): Promise<void> {
  await db.delete(keyResults).where(eq(keyResults.id, id));
}

export async function updateKRProgressInDb(id: string, progress: number, note: string): Promise<KeyResult | undefined> {
  const [existing] = await db.select().from(keyResults).where(eq(keyResults.id, id));
  if (!existing) return undefined;

  const entry: ProgressEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString(),
    progress,
    note,
  };

  const history = [...(existing.progressHistory || []), entry];

  const now = new Date();
  const end = new Date(existing.endDate);
  const start = new Date(existing.startDate);
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);

  let status = "normal";
  if (progress >= 100) status = "completed";
  else if (now > end) status = "overdue";
  else if (progress < expectedProgress * 0.8) status = "behind";

  const [kr] = await db.update(keyResults).set({
    progress,
    status,
    progressHistory: history,
  }).where(eq(keyResults.id, id)).returning();
  return kr;
}

export async function scoreKRInDb(id: string, score: number, note: string): Promise<KeyResult | undefined> {
  const [kr] = await db.update(keyResults).set({
    selfScore: score,
    selfScoreNote: note,
  }).where(eq(keyResults.id, id)).returning();
  return kr;
}
