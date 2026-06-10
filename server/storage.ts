import { eq, or, inArray, and, asc } from "drizzle-orm";
import { db } from "./db";
import {
  users, departments, objectives, keyResults, cycles, userDepartments, krComments, notifications,
  type User, type InsertUser, type Department, type Objective, type KeyResult, type ProgressEntry, type Cycle, type UserDepartment, type KRComment, type Notification,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { createDecipheriv } from "node:crypto";

const AES_CONFIG_KEY = "Bai%2018Son^9120";

function decryptAesEcbBase64(value: string, key = AES_CONFIG_KEY): string {
  try {
    const decipher = createDecipheriv("aes-128-ecb", Buffer.from(key, "utf8"), null);
    decipher.setAutoPadding(true);
    return Buffer.concat([
      decipher.update(Buffer.from(value, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return value;
  }
}

function getAdminSeedPassword(): string {
  const encryptedPassword = process.env.ADMIN_PASSWORD_AES?.trim();
  if (!encryptedPassword) {
    throw new Error("ADMIN_PASSWORD_AES environment variable is required to seed or sync the admin password");
  }
  return decryptAesEcbBase64(encryptedPassword);
}

export async function getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user;
}

export async function getUserByDingtalkId(dingtalkUserId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.dingtalkUserId, dingtalkUserId));
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

export async function getUsersByDepartment(departmentId: string): Promise<User[]> {
  return db.select().from(users).where(eq(users.departmentId, departmentId));
}

export async function getUserDepartmentIds(userId: string): Promise<string[]> {
  const rows = await db.select().from(userDepartments).where(eq(userDepartments.userId, userId));
  return rows.map(r => r.departmentId);
}

export async function setUserDepartments(userId: string, departmentIds: string[]): Promise<void> {
  await db.delete(userDepartments).where(eq(userDepartments.userId, userId));
  if (departmentIds.length > 0) {
    await db.insert(userDepartments).values(departmentIds.map(deptId => ({ userId, departmentId: deptId })));
  }
}

export async function getAllUserDepartments(): Promise<UserDepartment[]> {
  return db.select().from(userDepartments);
}

export async function getObjectivesForUser(user: User): Promise<Objective[]> {
  const sortObjs = (objs: Objective[]) => {
    return objs.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      const numA = parseInt(a.title.match(/O(\d+)/i)?.[1] || '0');
      const numB = parseInt(b.title.match(/O(\d+)/i)?.[1] || '0');
      return numA - numB;
    });
  };

  if (user.role === "super_admin") {
    const objs = await db.select().from(objectives);
    return sortObjs(objs);
  }

  if (user.role === "vp" || user.role === "center_head") {
    const allObjs = sortObjs(await db.select().from(objectives));
    const multiDeptIds = await getUserDepartmentIds(user.id);
    const baseDeptIds = multiDeptIds.length > 0
      ? multiDeptIds
      : (user.departmentId ? [user.departmentId] : []);
    const ownDeptIdSet = new Set(baseDeptIds);

    const leadershipUsers = await db.select().from(users).where(
      or(eq(users.role, "vp"), eq(users.role, "center_head"))
    );
    const leadershipUserIds = new Set(leadershipUsers.map(u => u.id));

    return allObjs.filter(obj => {
      if (ownDeptIdSet.has(obj.departmentId)) return true;
      return !!obj.createdBy && leadershipUserIds.has(obj.createdBy);
    });
  }

  const allObjs = sortObjs(await db.select().from(objectives));
  const multiDeptIds = await getUserDepartmentIds(user.id);
  const baseDeptIds = multiDeptIds.length > 0
    ? multiDeptIds
    : (user.departmentId ? [user.departmentId] : []);

  return allObjs.filter(obj => {
    if (baseDeptIds.includes(obj.departmentId)) return true;
    return false;
  });
}

export async function getKRsAssignedToUser(userId: string): Promise<{ kr: KeyResult; objective: Objective }[]> {
  const allKRs = await db.select().from(keyResults).where(eq(keyResults.assigneeId, userId));
  if (allKRs.length === 0) return [];
  const objIds = [...new Set(allKRs.map(kr => kr.objectiveId))];
  const objs = await db.select().from(objectives).where(inArray(objectives.id, objIds));
  const objMap = new Map(objs.map(o => [o.id, o]));
  return allKRs
    .filter(kr => objMap.has(kr.objectiveId))
    .map(kr => ({ kr, objective: objMap.get(kr.objectiveId)! }));
}

export async function getKRsCollaboratingUser(userId: string): Promise<{ kr: KeyResult; objective: Objective }[]> {
  const allKRs = await db.select().from(keyResults).where(eq(keyResults.collaboratorId, userId));
  if (allKRs.length === 0) return [];
  const objIds = [...new Set(allKRs.map(kr => kr.objectiveId))];
  const objs = await db.select().from(objectives).where(inArray(objectives.id, objIds));
  const objMap = new Map(objs.map(o => [o.id, o]));
  return allKRs
    .filter(kr => objMap.has(kr.objectiveId))
    .map(kr => ({ kr, objective: objMap.get(kr.objectiveId)! }));
}

export async function getCollaborativeKRsForUser(userId: string): Promise<KeyResult[]> {
  const allObjs = await db.select().from(objectives);
  const collabObjIds = allObjs
    .filter(obj => obj.isCollaborative && (obj.collaborativeUserIds as string[] || []).includes(userId))
    .map(obj => obj.id);
  if (collabObjIds.length === 0) return [];
  return db.select().from(keyResults).where(inArray(keyResults.objectiveId, collabObjIds));
}

export async function getAllObjectives(): Promise<Objective[]> {
  // 按 sortOrder 排序，如果相同则按标题中的数字排序
  const objs = await db.select().from(objectives).orderBy(asc(objectives.sortOrder));
  return objs.sort((a, b) => {
    // 如果 sortOrder 不同，按 sortOrder 排序
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    // 否则按标题中的数字排序
    const numA = parseInt(a.title.match(/O(\d+)/i)?.[1] || '0');
    const numB = parseInt(b.title.match(/O(\d+)/i)?.[1] || '0');
    return numA - numB;
  });
}

export async function createObjectiveInDb(data: {
  title: string;
  description: string;
  departmentId: string;
  cycle: string;
  parentObjectiveId: string | null;
  isCollaborative: boolean;
  collaborativeDeptIds: string[];
  collaborativeUserIds?: string[];
  createdBy: string | null;
  linkedToParent?: boolean;
  okrType?: string;
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
  const results = await db.select().from(keyResults).where(inArray(keyResults.objectiveId, objectiveIds));
  // 按标题中的数字排序（KR1、KR2、KR3...）
  return results.sort((a, b) => {
    const numA = parseInt(a.title.match(/KR(\d+)/i)?.[1] || '0');
    const numB = parseInt(b.title.match(/KR(\d+)/i)?.[1] || '0');
    return numA - numB;
  });
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
  collaboratorId?: string | null;
  collaboratorName?: string;
  startDate: string;
  endDate: string;
  weight: number;
  okrType?: string;
}): Promise<KeyResult> {
  const [kr] = await db.insert(keyResults).values({
    ...data,
    collaboratorId: data.collaboratorId || null,
    collaboratorName: data.collaboratorName || "",
    progress: 0,
    status: "normal",
    selfScore: null,
    selfScoreNote: "",
    progressHistory: [],
  }).returning();
  return kr;
}

export async function updateKeyResultInDb(id: string, updates: Partial<KeyResult>): Promise<KeyResult | undefined> {
  console.log("updateKeyResultInDb called:", id, updates);
  try {
    const [kr] = await db.update(keyResults).set(updates).where(eq(keyResults.id, id)).returning();
    console.log("updateKeyResultInDb success:", kr?.id);
    return kr;
  } catch (err: any) {
    console.error("updateKeyResultInDb error:", err.message);
    throw err;
  }
}

export async function deleteKeyResultInDb(id: string): Promise<void> {
  await db.delete(keyResults).where(eq(keyResults.id, id));
}

export async function updateKRProgressInDb(
  id: string,
  progress: number,
  note: string,
  images?: string[],
  entryId?: string
): Promise<KeyResult | undefined> {
  const [existing] = await db.select().from(keyResults).where(eq(keyResults.id, id));
  if (!existing) return undefined;
  const normalizedImages = images && images.length > 0 ? images : undefined;
  const existingHistory = existing.progressHistory || [];
  let history: ProgressEntry[];

  if (entryId) {
    const historyIndex = existingHistory.findIndex(entry => entry.id === entryId);
    if (historyIndex === -1) return undefined;
    history = existingHistory.map((entry, index) => (
      index === historyIndex
        ? {
            ...entry,
            progress,
            note,
            images: normalizedImages,
          }
        : entry
    ));
  } else {
    const entry: ProgressEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString(),
      progress,
      note,
      images: normalizedImages,
    };
    history = [...existingHistory, entry];
  }

  const latestProgress = history.length > 0
    ? (history[history.length - 1]?.progress ?? progress)
    : progress;

  const now = new Date();
  const end = new Date(existing.endDate);
  const start = new Date(existing.startDate);
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);

  let status = "normal";
  if (latestProgress >= 100) status = "completed";
  else if (now > end) status = "overdue";
  else if (latestProgress < expectedProgress * 0.8) status = "behind";

  const [kr] = await db.update(keyResults).set({
    progress: latestProgress,
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

const DEFAULT_DEPARTMENTS = [
  { name: "技术部", parentId: null, level: 0 },
  { name: "产品部", parentId: null, level: 0 },
  { name: "设计部", parentId: null, level: 0 },
  { name: "市场部", parentId: null, level: 0 },
  { name: "运营部", parentId: null, level: 0 },
  { name: "人力资源部", parentId: null, level: 0 },
];

export async function seedDatabase(): Promise<void> {
  const existingAdmin = await getUserByUsername("admin");
  const adminPassword = getAdminSeedPassword();
  if (!existingAdmin) {
    console.log("Seeding default admin user...");
    await createUser({
      id: "admin_1",
      username: "admin",
      password: adminPassword,
      displayName: "超级管理员",
      role: "super_admin",
      departmentId: null,
    });
    console.log("Default admin created from ADMIN_PASSWORD_AES");
  } else {
    await updateUser(existingAdmin.id, { password: adminPassword } as any);
    console.log("Admin password synced from ADMIN_PASSWORD_AES");
  }

  const existingDepts = await getDepartments();
  if (existingDepts.length === 0) {
    console.log("Seeding default departments...");
    for (const dept of DEFAULT_DEPARTMENTS) {
      await createDepartment(dept);
    }
    console.log(`Seeded ${DEFAULT_DEPARTMENTS.length} departments`);
  }

  const existingCycles = await getCycles();
  if (existingCycles.length === 0) {
    console.log("Seeding default cycles...");
    const year = new Date().getFullYear();
    const defaultCycles = [
      { name: `${year} 第一季度`, sortOrder: 1 },
      { name: `${year} 第二季度`, sortOrder: 2 },
      { name: `${year} 第三季度`, sortOrder: 3 },
      { name: `${year} 第四季度`, sortOrder: 4 },
      { name: `${year} 年度`, sortOrder: 5 },
    ];
    for (const c of defaultCycles) {
      await createCycle(c.name, c.sortOrder);
    }
    console.log(`Seeded ${defaultCycles.length} cycles`);
  }
}

export async function getCycles(): Promise<Cycle[]> {
  return db.select().from(cycles).orderBy(asc(cycles.sortOrder));
}

export async function createCycle(name: string, sortOrder: number): Promise<Cycle> {
  const [cycle] = await db.insert(cycles).values({ name, sortOrder }).returning();
  return cycle;
}

export async function updateCycle(id: string, data: { name?: string; sortOrder?: number }): Promise<Cycle | undefined> {
  const [cycle] = await db.update(cycles).set(data).where(eq(cycles.id, id)).returning();
  return cycle;
}

export async function deleteCycle(id: string): Promise<void> {
  await db.delete(cycles).where(eq(cycles.id, id));
}

export async function getCommentsForKR(krId: string): Promise<KRComment[]> {
  return db.select().from(krComments).where(eq(krComments.krId, krId));
}

export async function createComment(data: {
  krId: string;
  userId: string;
  userName: string;
  content: string;
  mentionedUserIds: string[];
}): Promise<KRComment> {
  const [comment] = await db.insert(krComments).values(data).returning();
  return comment;
}

export async function deleteComment(id: string): Promise<void> {
  await db.delete(krComments).where(eq(krComments.id, id));
}

export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
  return db.select().from(notifications).where(eq(notifications.userId, userId));
}

export async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedKrId?: string;
  relatedObjectiveId?: string;
  fromUserId?: string;
  fromUserName?: string;
}): Promise<Notification> {
  const [notif] = await db.insert(notifications).values(data).returning();
  return notif;
}

export async function markNotificationRead(id: string): Promise<void> {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const rows = await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return rows.length;
}
