var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  cycles: () => cycles,
  departments: () => departments,
  insertUserSchema: () => insertUserSchema,
  keyResults: () => keyResults,
  krComments: () => krComments,
  loginSchema: () => loginSchema,
  notifications: () => notifications,
  objectives: () => objectives,
  userDepartments: () => userDepartments,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, departments, userDepartments, cycles, objectives, keyResults, krComments, notifications, insertUserSchema, loginSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      username: text("username").notNull().unique(),
      password: text("password").notNull(),
      displayName: text("display_name").notNull(),
      role: text("role").notNull().default("member"),
      departmentId: varchar("department_id"),
      dingtalkUserId: text("dingtalk_user_id"),
      createdAt: timestamp("created_at").defaultNow()
    });
    departments = pgTable("departments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull(),
      parentId: varchar("parent_id"),
      level: integer("level").notNull().default(0)
    });
    userDepartments = pgTable("user_departments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      departmentId: varchar("department_id").notNull()
    });
    cycles = pgTable("cycles", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull().unique(),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").defaultNow()
    });
    objectives = pgTable("objectives", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      title: text("title").notNull(),
      description: text("description").notNull().default(""),
      departmentId: varchar("department_id").notNull(),
      cycle: text("cycle").notNull(),
      parentObjectiveId: varchar("parent_objective_id"),
      status: text("status").notNull().default("active"),
      isCollaborative: boolean("is_collaborative").notNull().default(false),
      collaborativeDeptIds: jsonb("collaborative_dept_ids").$type().default([]),
      collaborativeUserIds: jsonb("collaborative_user_ids").$type().default([]),
      linkedToParent: boolean("linked_to_parent").notNull().default(false),
      okrType: text("okr_type").notNull().default("\u627F\u8BFA\u578B"),
      createdBy: varchar("created_by"),
      createdAt: timestamp("created_at").defaultNow()
    });
    keyResults = pgTable("key_results", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      objectiveId: varchar("objective_id").notNull(),
      title: text("title").notNull(),
      description: text("description").notNull().default(""),
      assigneeId: varchar("assignee_id"),
      assigneeName: text("assignee_name").notNull().default(""),
      collaboratorId: varchar("collaborator_id"),
      collaboratorName: text("collaborator_name").notNull().default(""),
      startDate: text("start_date").notNull(),
      endDate: text("end_date").notNull(),
      progress: integer("progress").notNull().default(0),
      weight: real("weight").notNull().default(1),
      status: text("status").notNull().default("normal"),
      okrType: text("okr_type").notNull().default("\u627F\u8BFA\u578B"),
      selfScore: real("self_score"),
      selfScoreNote: text("self_score_note").notNull().default(""),
      progressHistory: jsonb("progress_history").$type().default([]),
      createdAt: timestamp("created_at").defaultNow()
    });
    krComments = pgTable("kr_comments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      krId: varchar("kr_id").notNull(),
      userId: varchar("user_id").notNull(),
      userName: text("user_name").notNull(),
      content: text("content").notNull(),
      mentionedUserIds: jsonb("mentioned_user_ids").$type().default([]),
      createdAt: timestamp("created_at").defaultNow()
    });
    notifications = pgTable("notifications", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      type: text("type").notNull().default("comment_mention"),
      title: text("title").notNull(),
      content: text("content").notNull(),
      relatedKrId: varchar("related_kr_id"),
      relatedObjectiveId: varchar("related_objective_id"),
      fromUserId: varchar("from_user_id"),
      fromUserName: text("from_user_name"),
      isRead: boolean("is_read").notNull().default(false),
      createdAt: timestamp("created_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true,
      displayName: true,
      role: true,
      departmentId: true
    });
    loginSchema = z.object({
      username: z.string().min(1),
      password: z.string().min(1)
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  pool: () => pool
});
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/ai-analysis.ts
var ai_analysis_exports = {};
__export(ai_analysis_exports, {
  generateOKRAnalysis: () => generateOKRAnalysis
});
import OpenAI from "openai";
async function generateOKRAnalysis(data) {
  const { objectives: objectives2, keyResults: keyResults2, departments: departments2, cycle, departmentName } = data;
  const totalObj = objectives2.length;
  const totalKR = keyResults2.length;
  const completedKR = keyResults2.filter((kr) => kr.status === "completed").length;
  const behindKR = keyResults2.filter((kr) => kr.status === "behind").length;
  const overdueKR = keyResults2.filter((kr) => kr.status === "overdue").length;
  const avgProgress = totalKR > 0 ? Math.round(keyResults2.reduce((s, kr) => s + kr.progress, 0) / totalKR) : 0;
  const scoredKR = keyResults2.filter((kr) => kr.selfScore !== null && kr.selfScore !== void 0);
  const avgScore = scoredKR.length > 0 ? (scoredKR.reduce((s, kr) => s + kr.selfScore, 0) / scoredKR.length).toFixed(2) : "\u6682\u65E0";
  const deptBreakdown = departments2.map((dept) => {
    const deptObjs = objectives2.filter((o) => o.departmentId === dept.id);
    const deptKRs = keyResults2.filter((kr) => deptObjs.some((o) => o.id === kr.objectiveId));
    const deptAvg = deptKRs.length > 0 ? Math.round(deptKRs.reduce((s, kr) => s + kr.progress, 0) / deptKRs.length) : 0;
    const deptScored = deptKRs.filter((kr) => kr.selfScore !== null && kr.selfScore !== void 0);
    const deptAvgScore = deptScored.length > 0 ? (deptScored.reduce((s, kr) => s + kr.selfScore, 0) / deptScored.length).toFixed(2) : "\u6682\u65E0";
    return {
      name: dept.name,
      objectives: deptObjs.length,
      krs: deptKRs.length,
      avgProgress: deptAvg,
      avgScore: deptAvgScore,
      completed: deptKRs.filter((kr) => kr.status === "completed").length,
      behind: deptKRs.filter((kr) => kr.status === "behind").length,
      overdue: deptKRs.filter((kr) => kr.status === "overdue").length
    };
  }).filter((d) => d.krs > 0);
  const objDetails = objectives2.map((obj) => {
    const objKRs = keyResults2.filter((kr) => kr.objectiveId === obj.id);
    return {
      title: obj.title,
      type: obj.okrType || "\u627F\u8BFA\u578B",
      department: departments2.find((d) => d.id === obj.departmentId)?.name || "\u672A\u77E5",
      krs: objKRs.map((kr) => ({
        title: kr.title,
        progress: kr.progress,
        status: kr.status,
        selfScore: kr.selfScore,
        type: kr.okrType || "\u627F\u8BFA\u578B"
      }))
    };
  });
  const scope = departmentName ? `${departmentName}\u90E8\u95E8` : "\u5168\u7EC4\u7EC7";
  const prompt = `\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684OKR\u7BA1\u7406\u987E\u95EE\u3002\u8BF7\u57FA\u4E8E\u4EE5\u4E0B${cycle}\u5468\u671F${scope}\u7684OKR\u6570\u636E\uFF0C\u64B0\u5199\u4E00\u4EFD\u5168\u9762\u7684\u5206\u6790\u62A5\u544A\u3002

## \u6574\u4F53\u6570\u636E
- \u76EE\u6807\u6570: ${totalObj}
- \u5173\u952E\u7ED3\u679C\u6570: ${totalKR}
- \u5DF2\u5B8C\u6210KR: ${completedKR}
- \u8FDB\u5EA6\u6EDE\u540EKR: ${behindKR}
- \u5DF2\u903E\u671FKR: ${overdueKR}
- \u5E73\u5747\u8FDB\u5EA6: ${avgProgress}%
- \u5E73\u5747\u81EA\u8BC4\u5206: ${avgScore}

## \u5404\u90E8\u95E8\u6570\u636E
${deptBreakdown.map((d) => `- ${d.name}: ${d.objectives}\u4E2A\u76EE\u6807, ${d.krs}\u4E2AKR, \u5E73\u5747\u8FDB\u5EA6${d.avgProgress}%, \u5E73\u5747\u81EA\u8BC4${d.avgScore}, \u5DF2\u5B8C\u6210${d.completed}, \u6EDE\u540E${d.behind}, \u903E\u671F${d.overdue}`).join("\n")}

## \u5404\u76EE\u6807\u8BE6\u60C5
${objDetails.map((o) => `### ${o.title} (${o.type}, ${o.department})
${o.krs.map((kr) => `  - ${kr.title}: \u8FDB\u5EA6${kr.progress}%, \u72B6\u6001${kr.status}, \u81EA\u8BC4${kr.selfScore ?? "\u672A\u8BC4"}, \u7C7B\u578B${kr.type}`).join("\n")}`).join("\n\n")}

\u8BF7\u6309\u4EE5\u4E0B\u7ED3\u6784\u8F93\u51FA\u5206\u6790\u62A5\u544A\uFF08\u4F7F\u7528Markdown\u683C\u5F0F\uFF09\uFF1A
1. **\u603B\u4F53\u8BC4\u4F30** - \u5BF9\u672C\u5468\u671FOKR\u6267\u884C\u60C5\u51B5\u7684\u6574\u4F53\u8BC4\u4EF7
2. **\u4EAE\u70B9\u4E0E\u6210\u5C31** - \u505A\u5F97\u597D\u7684\u65B9\u9762
3. **\u98CE\u9669\u4E0E\u95EE\u9898** - \u9700\u8981\u5173\u6CE8\u7684\u98CE\u9669\u9879\u548C\u95EE\u9898
4. **\u90E8\u95E8\u5BF9\u6BD4\u5206\u6790** - \u5404\u90E8\u95E8\u7684\u8868\u73B0\u5BF9\u6BD4
5. **\u6539\u8FDB\u5EFA\u8BAE** - \u5177\u4F53\u7684\u3001\u53EF\u6267\u884C\u7684\u6539\u8FDB\u5EFA\u8BAE
6. **\u4E0B\u5468\u671F\u5C55\u671B** - \u5BF9\u4E0B\u4E2A\u5468\u671F\u7684\u5EFA\u8BAE\u548C\u91CD\u70B9\u65B9\u5411

\u8BF7\u7528\u7B80\u6D01\u3001\u4E13\u4E1A\u7684\u4E2D\u6587\u64B0\u5199\uFF0C\u7A81\u51FA\u6570\u636E\u9A71\u52A8\u7684\u6D1E\u5BDF\u3002`;
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 4096
  });
  return response.choices[0]?.message?.content || "\u5206\u6790\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
}
var openai;
var init_ai_analysis = __esm({
  "server/ai-analysis.ts"() {
    "use strict";
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    });
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
init_db();
import { createServer } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

// server/file-upload.ts
import { Storage } from "@google-cloud/storage";
import * as fs from "fs";
import * as path from "path";
var bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
function getStorage() {
  return new Storage({ apiEndpoint: "https://storage.googleapis.com" });
}
var LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "assets", "uploads");
function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
}
async function uploadFile(buffer, fileName, contentType) {
  if (bucketId) {
    const storage = getStorage();
    const bucket = storage.bucket(bucketId);
    const filePath = `public/progress-images/${fileName}`;
    const file = bucket.file(filePath);
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: "public, max-age=31536000" }
    });
    await file.makePublic();
    return file.publicUrl();
  }
  ensureLocalDir();
  const localPath = path.join(LOCAL_UPLOAD_DIR, fileName);
  fs.writeFileSync(localPath, buffer);
  return `/assets/uploads/${fileName}`;
}

// server/storage.ts
init_db();
init_schema();
import { eq, or, inArray, and, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
async function getUser(id) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}
async function getUserByUsername(username) {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user;
}
async function getUserByDingtalkId(dingtalkUserId) {
  const [user] = await db.select().from(users).where(eq(users.dingtalkUserId, dingtalkUserId));
  return user;
}
async function createUser(data) {
  const hashed = await bcrypt.hash(data.password, 10);
  const [user] = await db.insert(users).values({ ...data, password: hashed }).returning();
  return user;
}
async function updateUser(id, updates) {
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }
  const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
  return user;
}
async function deleteUser(id) {
  await db.delete(users).where(eq(users.id, id));
}
async function getAllUsers() {
  return db.select().from(users);
}
async function verifyPassword(plaintext, hashed) {
  return bcrypt.compare(plaintext, hashed);
}
async function getDepartments() {
  return db.select().from(departments);
}
async function createDepartment(data) {
  const [dept] = await db.insert(departments).values(data).returning();
  return dept;
}
async function updateDepartment(id, updates) {
  const [dept] = await db.update(departments).set(updates).where(eq(departments.id, id)).returning();
  return dept;
}
async function deleteDepartment(id) {
  await db.delete(departments).where(or(eq(departments.id, id), eq(departments.parentId, id)));
}
function getUserDeptIds(userDeptId, allDepts) {
  if (!userDeptId) return [];
  const ids = [userDeptId];
  const children = allDepts.filter((d) => d.parentId === userDeptId);
  children.forEach((c) => ids.push(c.id));
  const parent = allDepts.find((d) => d.id === userDeptId);
  if (parent?.parentId) {
    ids.push(parent.parentId);
  }
  return [...new Set(ids)];
}
async function getUsersByDepartment(departmentId) {
  return db.select().from(users).where(eq(users.departmentId, departmentId));
}
async function getUserDepartmentIds(userId) {
  const rows = await db.select().from(userDepartments).where(eq(userDepartments.userId, userId));
  return rows.map((r) => r.departmentId);
}
async function setUserDepartments(userId, departmentIds) {
  await db.delete(userDepartments).where(eq(userDepartments.userId, userId));
  if (departmentIds.length > 0) {
    await db.insert(userDepartments).values(departmentIds.map((deptId) => ({ userId, departmentId: deptId })));
  }
}
async function getAllUserDepartments() {
  return db.select().from(userDepartments);
}
async function getObjectivesForUser(user) {
  if (user.role === "super_admin" || user.role === "vp") {
    return db.select().from(objectives);
  }
  const allObjs = await db.select().from(objectives);
  if (user.role === "center_head") {
    const allUsers = await getAllUsers();
    const centerHeadIds = new Set(allUsers.filter((u) => u.role === "center_head").map((u) => u.id));
    return allObjs.filter((obj) => {
      if (obj.createdBy && centerHeadIds.has(obj.createdBy)) return true;
      return false;
    });
  }
  const allDepts = await getDepartments();
  const multiDeptIds = await getUserDepartmentIds(user.id);
  const allUserDeptIds = [];
  const baseDeptIds = multiDeptIds.length > 0 ? multiDeptIds : user.departmentId ? [user.departmentId] : [];
  for (const did of baseDeptIds) {
    const expanded = getUserDeptIds(did, allDepts);
    expanded.forEach((id) => {
      if (!allUserDeptIds.includes(id)) allUserDeptIds.push(id);
    });
  }
  return allObjs.filter((obj) => {
    if (allUserDeptIds.includes(obj.departmentId)) return true;
    return false;
  });
}
async function getKRsAssignedToUser(userId) {
  const allKRs = await db.select().from(keyResults).where(eq(keyResults.assigneeId, userId));
  if (allKRs.length === 0) return [];
  const objIds = [...new Set(allKRs.map((kr) => kr.objectiveId))];
  const objs = await db.select().from(objectives).where(inArray(objectives.id, objIds));
  const objMap = new Map(objs.map((o) => [o.id, o]));
  return allKRs.filter((kr) => objMap.has(kr.objectiveId)).map((kr) => ({ kr, objective: objMap.get(kr.objectiveId) }));
}
async function getKRsCollaboratingUser(userId) {
  const allKRs = await db.select().from(keyResults).where(eq(keyResults.collaboratorId, userId));
  if (allKRs.length === 0) return [];
  const objIds = [...new Set(allKRs.map((kr) => kr.objectiveId))];
  const objs = await db.select().from(objectives).where(inArray(objectives.id, objIds));
  const objMap = new Map(objs.map((o) => [o.id, o]));
  return allKRs.filter((kr) => objMap.has(kr.objectiveId)).map((kr) => ({ kr, objective: objMap.get(kr.objectiveId) }));
}
async function getAllObjectives() {
  return db.select().from(objectives);
}
async function createObjectiveInDb(data) {
  const [obj] = await db.insert(objectives).values({
    ...data,
    status: "active"
  }).returning();
  return obj;
}
async function updateObjectiveInDb(id, updates) {
  const [obj] = await db.update(objectives).set(updates).where(eq(objectives.id, id)).returning();
  return obj;
}
async function deleteObjectiveInDb(id) {
  await db.delete(keyResults).where(eq(keyResults.objectiveId, id));
  await db.delete(objectives).where(eq(objectives.id, id));
}
async function getKeyResultsForObjectives(objectiveIds) {
  if (objectiveIds.length === 0) return [];
  return db.select().from(keyResults).where(inArray(keyResults.objectiveId, objectiveIds));
}
async function getAllKeyResults() {
  return db.select().from(keyResults);
}
async function createKeyResultInDb(data) {
  const [kr] = await db.insert(keyResults).values({
    ...data,
    collaboratorId: data.collaboratorId || null,
    collaboratorName: data.collaboratorName || "",
    progress: 0,
    status: "normal",
    selfScore: null,
    selfScoreNote: "",
    progressHistory: []
  }).returning();
  return kr;
}
async function updateKeyResultInDb(id, updates) {
  const [kr] = await db.update(keyResults).set(updates).where(eq(keyResults.id, id)).returning();
  return kr;
}
async function deleteKeyResultInDb(id) {
  await db.delete(keyResults).where(eq(keyResults.id, id));
}
async function updateKRProgressInDb(id, progress, note, images) {
  const [existing] = await db.select().from(keyResults).where(eq(keyResults.id, id));
  if (!existing) return void 0;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: (/* @__PURE__ */ new Date()).toISOString(),
    progress,
    note,
    images: images && images.length > 0 ? images : void 0
  };
  const history = [...existing.progressHistory || [], entry];
  const now = /* @__PURE__ */ new Date();
  const end = new Date(existing.endDate);
  const start = new Date(existing.startDate);
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24));
  const elapsedDays = (now.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24);
  const expectedProgress = Math.min(100, elapsedDays / totalDays * 100);
  let status = "normal";
  if (progress >= 100) status = "completed";
  else if (now > end) status = "overdue";
  else if (progress < expectedProgress * 0.8) status = "behind";
  const [kr] = await db.update(keyResults).set({
    progress,
    status,
    progressHistory: history
  }).where(eq(keyResults.id, id)).returning();
  return kr;
}
async function scoreKRInDb(id, score, note) {
  const [kr] = await db.update(keyResults).set({
    selfScore: score,
    selfScoreNote: note
  }).where(eq(keyResults.id, id)).returning();
  return kr;
}
var DEFAULT_DEPARTMENTS = [
  { name: "\u6280\u672F\u90E8", parentId: null, level: 0 },
  { name: "\u4EA7\u54C1\u90E8", parentId: null, level: 0 },
  { name: "\u8BBE\u8BA1\u90E8", parentId: null, level: 0 },
  { name: "\u5E02\u573A\u90E8", parentId: null, level: 0 },
  { name: "\u8FD0\u8425\u90E8", parentId: null, level: 0 },
  { name: "\u4EBA\u529B\u8D44\u6E90\u90E8", parentId: null, level: 0 }
];
async function seedDatabase() {
  const existingAdmin = await getUserByUsername("admin");
  if (!existingAdmin) {
    console.log("Seeding default admin user...");
    await createUser({
      id: "admin_1",
      username: "admin",
      password: "admin123",
      displayName: "\u8D85\u7EA7\u7BA1\u7406\u5458",
      role: "super_admin",
      departmentId: null
    });
    console.log("Default admin created: admin / admin123");
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
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const defaultCycles = [
      { name: `${year} \u7B2C\u4E00\u5B63\u5EA6`, sortOrder: 1 },
      { name: `${year} \u7B2C\u4E8C\u5B63\u5EA6`, sortOrder: 2 },
      { name: `${year} \u7B2C\u4E09\u5B63\u5EA6`, sortOrder: 3 },
      { name: `${year} \u7B2C\u56DB\u5B63\u5EA6`, sortOrder: 4 },
      { name: `${year} \u5E74\u5EA6`, sortOrder: 5 }
    ];
    for (const c of defaultCycles) {
      await createCycle(c.name, c.sortOrder);
    }
    console.log(`Seeded ${defaultCycles.length} cycles`);
  }
}
async function getCycles() {
  return db.select().from(cycles).orderBy(asc(cycles.sortOrder));
}
async function createCycle(name, sortOrder) {
  const [cycle] = await db.insert(cycles).values({ name, sortOrder }).returning();
  return cycle;
}
async function updateCycle(id, data) {
  const [cycle] = await db.update(cycles).set(data).where(eq(cycles.id, id)).returning();
  return cycle;
}
async function deleteCycle(id) {
  await db.delete(cycles).where(eq(cycles.id, id));
}
async function getCommentsForKR(krId) {
  return db.select().from(krComments).where(eq(krComments.krId, krId));
}
async function createComment(data) {
  const [comment] = await db.insert(krComments).values(data).returning();
  return comment;
}
async function deleteComment(id) {
  await db.delete(krComments).where(eq(krComments.id, id));
}
async function getNotificationsForUser(userId) {
  return db.select().from(notifications).where(eq(notifications.userId, userId));
}
async function createNotification(data) {
  const [notif] = await db.insert(notifications).values(data).returning();
  return notif;
}
async function markNotificationRead(id) {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}
async function markAllNotificationsRead(userId) {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}
async function getUnreadNotificationCount(userId) {
  const rows = await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return rows.length;
}

// server/dingtalk.ts
var DINGTALK_API = "https://oapi.dingtalk.com";
var DINGTALK_API_V2 = "https://api.dingtalk.com";
var cachedToken = null;
function isDingtalkConfigured() {
  return !!(process.env.DINGTALK_APP_KEY && process.env.DINGTALK_APP_SECRET);
}
async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const appKey = process.env.DINGTALK_APP_KEY;
  const appSecret = process.env.DINGTALK_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error("\u9489\u9489\u5E94\u7528\u672A\u914D\u7F6E AppKey/AppSecret");
  }
  const res = await fetch(`${DINGTALK_API}/gettoken?appkey=${appKey}&appsecret=${appSecret}`);
  const data = await res.json();
  if (data.errcode !== 0) {
    throw new Error(`\u83B7\u53D6\u9489\u9489 access_token \u5931\u8D25: ${data.errmsg}`);
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1e3
  };
  return cachedToken.token;
}
async function getUserInfoByAuthCode(authCode) {
  const token = await getAccessToken();
  const userIdRes = await fetch(`${DINGTALK_API}/topapi/v2/user/getuserinfo?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: authCode })
  });
  const userIdData = await userIdRes.json();
  if (userIdData.errcode === 0 && userIdData.result?.userid) {
    const userid = userIdData.result.userid;
    const detailRes = await fetch(`${DINGTALK_API}/topapi/v2/user/get?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid, language: "zh_CN" })
    });
    const detailData = await detailRes.json();
    if (detailData.errcode !== 0) {
      throw new Error(`\u83B7\u53D6\u9489\u9489\u7528\u6237\u8BE6\u60C5\u5931\u8D25: ${detailData.errmsg}`);
    }
    return {
      userid: detailData.result.userid,
      name: detailData.result.name,
      avatar: detailData.result.avatar,
      dept_id_list: detailData.result.dept_id_list || []
    };
  }
  try {
    const userToken = await getUserAccessToken(authCode);
    const res = await fetch(`${DINGTALK_API_V2}/v1.0/contact/users/me`, {
      method: "GET",
      headers: {
        "x-acs-dingtalk-access-token": userToken,
        "Content-Type": "application/json"
      }
    });
    if (res.ok) {
      const userData = await res.json();
      const unionId = userData.unionId;
      if (unionId) {
        const uidRes = await fetch(`${DINGTALK_API}/topapi/user/getbyunionid?access_token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unionid: unionId })
        });
        const uidData = await uidRes.json();
        if (uidData.errcode === 0 && uidData.result?.userid) {
          const detailRes2 = await fetch(`${DINGTALK_API}/topapi/v2/user/get?access_token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userid: uidData.result.userid, language: "zh_CN" })
          });
          const detailData2 = await detailRes2.json();
          return {
            userid: uidData.result.userid,
            name: userData.nick || userData.name,
            avatar: userData.avatarUrl,
            dept_id_list: detailData2.errcode === 0 ? detailData2.result?.dept_id_list || [] : []
          };
        }
      }
    }
  } catch {
  }
  throw new Error("\u83B7\u53D6\u9489\u9489\u7528\u6237\u4FE1\u606F\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
}
async function getDepartmentDetail(deptId) {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${DINGTALK_API}/topapi/v2/department/get?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dept_id: deptId, language: "zh_CN" })
    });
    const data = await res.json();
    if (data.errcode !== 0) {
      console.error(`\u83B7\u53D6\u9489\u9489\u90E8\u95E8\u8BE6\u60C5\u5931\u8D25: ${data.errmsg}`);
      return null;
    }
    return {
      dept_id: data.result.dept_id,
      name: data.result.name,
      parent_id: data.result.parent_id
    };
  } catch (err) {
    console.error("\u83B7\u53D6\u9489\u9489\u90E8\u95E8\u8BE6\u60C5\u5F02\u5E38:", err);
    return null;
  }
}
async function getParentDepartmentName(deptId) {
  console.log(`[DT Dept] getParentDepartmentName called with deptId=${deptId}`);
  if (deptId === 1) return null;
  const dept = await getDepartmentDetail(deptId);
  if (!dept) return null;
  console.log(`[DT Dept] deptId=${deptId}, name="${dept.name}", parent_id=${dept.parent_id}`);
  if (!dept.parent_id || dept.parent_id <= 0) return null;
  const chain = [dept];
  let current = dept;
  for (let i = 0; i < 10; i++) {
    if (current.parent_id === 1) break;
    const upper = await getDepartmentDetail(current.parent_id);
    if (!upper) break;
    console.log(`[DT Dept] chain: name="${upper.name}", parent_id=${upper.parent_id}`);
    chain.push(upper);
    current = upper;
  }
  const companyIdx = chain.findIndex((d) => d.parent_id === 1);
  if (companyIdx < 0) {
    console.log(`[DT Dept] -> no company-level dept found, returning "${dept.name}"`);
    return dept.name;
  }
  const targetIdx = companyIdx - 1;
  if (targetIdx >= 0) {
    console.log(`[DT Dept] -> company="${chain[companyIdx].name}", returning center="${chain[targetIdx].name}"`);
    return chain[targetIdx].name;
  }
  if (companyIdx === 0) {
    console.log(`[DT Dept] -> dept "${dept.name}" is direct child of root company, returning itself`);
    return dept.name;
  }
  return dept.name;
}
async function getUserAccessToken(authCode) {
  const appKey = process.env.DINGTALK_APP_KEY;
  const appSecret = process.env.DINGTALK_APP_SECRET;
  const res = await fetch(`${DINGTALK_API_V2}/v1.0/oauth2/userAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: appKey,
      clientSecret: appSecret,
      code: authCode,
      grantType: "authorization_code"
    })
  });
  if (!res.ok) {
    throw new Error("\u83B7\u53D6\u9489\u9489\u7528\u6237 token \u5931\u8D25");
  }
  const data = await res.json();
  return data.accessToken;
}
async function getDepartmentList() {
  const token = await getAccessToken();
  const allDepts = [];
  const fetchSubDepts = async (deptId) => {
    const res = await fetch(`${DINGTALK_API}/topapi/v2/department/listsub?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dept_id: deptId, language: "zh_CN" })
    });
    const data = await res.json();
    if (data.errcode !== 0) {
      console.error(`\u83B7\u53D6\u9489\u9489\u90E8\u95E8\u5217\u8868\u5931\u8D25: ${data.errmsg}`);
      return;
    }
    for (const dept of data.result || []) {
      allDepts.push({
        dept_id: dept.dept_id,
        name: dept.name,
        parent_id: dept.parent_id
      });
      await fetchSubDepts(dept.dept_id);
    }
  };
  await fetchSubDepts(1);
  return allDepts;
}
async function getDepartmentUsers(deptId) {
  const token = await getAccessToken();
  const allUsers = [];
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const res = await fetch(`${DINGTALK_API}/topapi/v2/user/list?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dept_id: deptId,
        cursor,
        size: 100,
        language: "zh_CN"
      })
    });
    const data = await res.json();
    if (data.errcode !== 0) {
      console.error(`\u83B7\u53D6\u90E8\u95E8\u7528\u6237\u5931\u8D25: ${data.errmsg}`);
      break;
    }
    const list = data.result?.list || [];
    for (const u of list) {
      allUsers.push({
        userid: u.userid,
        name: u.name,
        dept_id_list: u.dept_id_list || [],
        title: u.title,
        avatar: u.avatar
      });
    }
    hasMore = data.result?.has_more || false;
    cursor = data.result?.next_cursor || 0;
  }
  return allUsers;
}
async function getAllDingtalkUsers() {
  const depts = await getDepartmentList();
  const allUsers = /* @__PURE__ */ new Map();
  for (const dept of depts) {
    const users2 = await getDepartmentUsers(dept.dept_id);
    for (const u of users2) {
      if (!allUsers.has(u.userid)) {
        allUsers.set(u.userid, u);
      }
    }
  }
  return Array.from(allUsers.values());
}
function getDingtalkCorpId() {
  return process.env.DINGTALK_CORP_ID || "";
}
function getDingtalkAppKey() {
  return process.env.DINGTALK_APP_KEY || "";
}

// server/routes.ts
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "\u672A\u767B\u5F55" });
  }
  next();
}
async function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "\u672A\u767B\u5F55" });
  }
  const user = await getUser(req.session.userId);
  if (!user || user.role !== "super_admin") {
    return res.status(403).json({ message: "\u6743\u9650\u4E0D\u8DB3" });
  }
  next();
}
async function registerRoutes(app2) {
  const PgStore = connectPgSimple(session);
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    app2.set("trust proxy", 1);
  }
  const sessionMiddleware = session({
    store: new PgStore({
      pool,
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || "okr-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1e3,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax"
    }
  });
  app2.use("/api", sessionMiddleware);
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "\u8BF7\u8F93\u5165\u7528\u6237\u540D\u548C\u5BC6\u7801" });
      }
      const user = await getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" });
      }
      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" });
      }
      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      const deptIds = await getUserDepartmentIds(user.id);
      return res.json({ user: { ...safeUser, departmentIds: deptIds } });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "\u767B\u5F55\u5931\u8D25" });
    }
  });
  app2.get("/api/auth/dingtalk-config", (_req, res) => {
    if (!isDingtalkConfigured()) {
      return res.json({ enabled: false });
    }
    return res.json({
      enabled: true,
      corpId: getDingtalkCorpId(),
      appKey: getDingtalkAppKey()
    });
  });
  async function syncDingtalkUserDept(userId, dtDeptIdList) {
    if (!dtDeptIdList || dtDeptIdList.length === 0) return;
    try {
      console.log(`[DT Sync] userId=${userId}, dtDeptIdList=${JSON.stringify(dtDeptIdList)}`);
      const existingDepts = await getDepartments();
      const parentNames = /* @__PURE__ */ new Set();
      for (const dtDeptId of dtDeptIdList) {
        console.log(`[DT Sync] Resolving dept_id=${dtDeptId}`);
        const parentName = await getParentDepartmentName(dtDeptId);
        console.log(`[DT Sync] dept_id=${dtDeptId} -> parentName=${parentName}`);
        if (parentName) parentNames.add(parentName);
      }
      const localDeptIds = [];
      for (const name of parentNames) {
        let dept = existingDepts.find((d) => d.name === name);
        if (!dept) {
          dept = await createDepartment({ name, parentId: null, level: 0 });
        }
        localDeptIds.push(dept.id);
      }
      if (localDeptIds.length > 0) {
        await setUserDepartments(userId, localDeptIds);
      }
    } catch (err) {
      console.error("\u540C\u6B65\u9489\u9489\u7528\u6237\u90E8\u95E8\u5931\u8D25:", err);
    }
  }
  app2.post("/api/auth/dingtalk-login", async (req, res) => {
    try {
      if (!isDingtalkConfigured()) {
        return res.status(400).json({ message: "\u9489\u9489\u767B\u5F55\u672A\u914D\u7F6E" });
      }
      const { authCode } = req.body;
      if (!authCode) {
        return res.status(400).json({ message: "\u7F3A\u5C11\u9489\u9489\u6388\u6743\u7801" });
      }
      const dtUser = await getUserInfoByAuthCode(authCode);
      let user = await getUserByDingtalkId(dtUser.userid);
      if (!user) {
        const newUser = await createUser({
          username: `dt_${dtUser.userid}`,
          password: `dt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          displayName: dtUser.name,
          role: "member",
          departmentId: null,
          dingtalkUserId: dtUser.userid
        });
        user = newUser;
        await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
      } else {
        await syncDingtalkUserDept(user.id, dtUser.dept_id_list);
      }
      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      const deptIds = await getUserDepartmentIds(user.id);
      return res.json({ user: { ...safeUser, departmentIds: deptIds } });
    } catch (err) {
      console.error("DingTalk login error:", err);
      return res.status(500).json({ message: err?.message || "\u9489\u9489\u767B\u5F55\u5931\u8D25" });
    }
  });
  app2.post("/api/dingtalk/sync-org", requireAdmin, async (_req, res) => {
    try {
      if (!isDingtalkConfigured()) {
        return res.status(400).json({ message: "\u9489\u9489\u672A\u914D\u7F6E" });
      }
      const dtDepts = await getDepartmentList();
      const dtUsers = await getAllDingtalkUsers();
      const existingDepts = await getDepartments();
      const existingUsers = await getAllUsers();
      let syncedDepts = 0;
      let syncedUsers = 0;
      const deptIdMap = /* @__PURE__ */ new Map();
      for (const dtDept of dtDepts) {
        const existing = existingDepts.find((d) => d.name === dtDept.name);
        if (existing) {
          deptIdMap.set(dtDept.dept_id, existing.id);
        } else {
          const parentLocalId = dtDept.parent_id > 1 ? deptIdMap.get(dtDept.parent_id) || null : null;
          const level = parentLocalId ? 1 : 0;
          const newDept = await createDepartment({
            name: dtDept.name,
            parentId: parentLocalId,
            level
          });
          deptIdMap.set(dtDept.dept_id, newDept.id);
          syncedDepts++;
        }
      }
      for (const dtUser of dtUsers) {
        const existingUser = existingUsers.find((u) => u.dingtalkUserId === dtUser.userid);
        if (existingUser) {
          await syncDingtalkUserDept(existingUser.id, dtUser.dept_id_list);
        } else {
          const newUser = await createUser({
            username: `dt_${dtUser.userid}`,
            password: `dt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            displayName: dtUser.name,
            role: "member",
            departmentId: null,
            dingtalkUserId: dtUser.userid
          });
          await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
          syncedUsers++;
        }
      }
      return res.json({
        message: `\u540C\u6B65\u5B8C\u6210: \u65B0\u589E ${syncedDepts} \u4E2A\u90E8\u95E8, ${syncedUsers} \u4E2A\u7528\u6237`,
        syncedDepts,
        syncedUsers
      });
    } catch (err) {
      console.error("Org sync error:", err);
      return res.status(500).json({ message: err?.message || "\u540C\u6B65\u5931\u8D25" });
    }
  });
  app2.get("/api/auth/dingtalk-callback", async (req, res) => {
    try {
      const authCode = req.query.authCode || req.query.code;
      if (!authCode || !isDingtalkConfigured()) {
        return res.redirect("/?dt_error=1");
      }
      const dtUser = await getUserInfoByAuthCode(authCode);
      let user = await getUserByDingtalkId(dtUser.userid);
      if (!user) {
        const newUser = await createUser({
          username: `dt_${dtUser.userid}`,
          password: `dt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          displayName: dtUser.name,
          role: "member",
          departmentId: null,
          dingtalkUserId: dtUser.userid
        });
        user = newUser;
        await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
      } else {
        await syncDingtalkUserDept(user.id, dtUser.dept_id_list);
      }
      req.session.userId = user.id;
      return res.redirect("/");
    } catch (err) {
      console.error("DingTalk callback error:", err);
      return res.redirect("/?dt_error=1");
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "\u9000\u51FA\u5931\u8D25" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "\u5DF2\u9000\u51FA" });
    });
  });
  app2.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "\u672A\u767B\u5F55" });
    }
    const user = await getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
    }
    const { password: _, ...safeUser } = user;
    const deptIds = await getUserDepartmentIds(user.id);
    return res.json({ user: { ...safeUser, departmentIds: deptIds } });
  });
  app2.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "\u8BF7\u586B\u5199\u5F53\u524D\u5BC6\u7801\u548C\u65B0\u5BC6\u7801" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "\u65B0\u5BC6\u7801\u81F3\u5C116\u4E2A\u5B57\u7B26" });
      }
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const valid = await verifyPassword(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E" });
      await updateUser(user.id, { password: newPassword });
      return res.json({ message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F" });
    } catch (err) {
      return res.status(500).json({ message: "\u4FEE\u6539\u5BC6\u7801\u5931\u8D25" });
    }
  });
  app2.get("/api/departments", requireAuth, async (_req, res) => {
    const deps = await getDepartments();
    return res.json(deps);
  });
  app2.post("/api/departments", requireAdmin, async (req, res) => {
    try {
      const { name, parentId, level } = req.body;
      const dept = await createDepartment({ name, parentId: parentId || null, level: level || 0 });
      return res.json(dept);
    } catch (err) {
      return res.status(500).json({ message: "\u521B\u5EFA\u90E8\u95E8\u5931\u8D25" });
    }
  });
  app2.put("/api/departments/:id", requireAdmin, async (req, res) => {
    try {
      const dept = await updateDepartment(req.params.id, req.body);
      return res.json(dept);
    } catch (err) {
      return res.status(500).json({ message: "\u66F4\u65B0\u90E8\u95E8\u5931\u8D25" });
    }
  });
  app2.delete("/api/departments/:id", requireAdmin, async (req, res) => {
    try {
      await deleteDepartment(req.params.id);
      return res.json({ message: "\u5DF2\u5220\u9664" });
    } catch (err) {
      return res.status(500).json({ message: "\u5220\u9664\u90E8\u95E8\u5931\u8D25" });
    }
  });
  app2.get("/api/cycles", requireAuth, async (_req, res) => {
    const all = await getCycles();
    return res.json(all);
  });
  app2.post("/api/cycles", requireAdmin, async (req, res) => {
    try {
      const { name, sortOrder } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "\u5468\u671F\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" });
      const cycle = await createCycle(name.trim(), sortOrder ?? 0);
      return res.json(cycle);
    } catch (err) {
      if (err?.code === "23505") return res.status(400).json({ message: "\u8BE5\u5468\u671F\u540D\u79F0\u5DF2\u5B58\u5728" });
      return res.status(500).json({ message: "\u521B\u5EFA\u5468\u671F\u5931\u8D25" });
    }
  });
  app2.put("/api/cycles/:id", requireAdmin, async (req, res) => {
    try {
      const { name, sortOrder } = req.body;
      const updates = {};
      if (name !== void 0) updates.name = name.trim();
      if (sortOrder !== void 0) updates.sortOrder = sortOrder;
      const cycle = await updateCycle(req.params.id, updates);
      return res.json(cycle);
    } catch (err) {
      if (err?.code === "23505") return res.status(400).json({ message: "\u8BE5\u5468\u671F\u540D\u79F0\u5DF2\u5B58\u5728" });
      return res.status(500).json({ message: "\u66F4\u65B0\u5468\u671F\u5931\u8D25" });
    }
  });
  app2.delete("/api/cycles/:id", requireAdmin, async (req, res) => {
    try {
      await deleteCycle(req.params.id);
      return res.json({ message: "\u5DF2\u5220\u9664" });
    } catch (err) {
      return res.status(500).json({ message: "\u5220\u9664\u5468\u671F\u5931\u8D25" });
    }
  });
  app2.get("/api/users", requireAdmin, async (_req, res) => {
    const all = await getAllUsers();
    const allUD = await getAllUserDepartments();
    const safe = all.map(({ password, ...u }) => ({
      ...u,
      departmentIds: allUD.filter((ud) => ud.userId === u.id).map((ud) => ud.departmentId)
    }));
    return res.json(safe);
  });
  app2.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, displayName, role, departmentId, departmentIds } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F" });
      }
      const existing = await getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" });
      }
      const deptIds = departmentIds || (departmentId ? [departmentId] : []);
      const primaryDeptId = deptIds.length > 0 ? deptIds[0] : null;
      const user = await createUser({ username, password, displayName, role: role || "member", departmentId: primaryDeptId });
      if (deptIds.length > 0) {
        await setUserDepartments(user.id, deptIds);
      }
      const { password: _, ...safeUser } = user;
      return res.json({ ...safeUser, departmentIds: deptIds });
    } catch (err) {
      return res.status(500).json({ message: "\u521B\u5EFA\u7528\u6237\u5931\u8D25" });
    }
  });
  app2.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { departmentIds, ...rest } = req.body;
      if (departmentIds && Array.isArray(departmentIds)) {
        rest.departmentId = departmentIds.length > 0 ? departmentIds[0] : null;
        await setUserDepartments(req.params.id, departmentIds);
      }
      const user = await updateUser(req.params.id, rest);
      if (!user) return res.status(404).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { password: _, ...safeUser } = user;
      const deptIds = departmentIds || await getUserDepartmentIds(user.id);
      return res.json({ ...safeUser, departmentIds: deptIds });
    } catch (err) {
      return res.status(500).json({ message: "\u66F4\u65B0\u7528\u6237\u5931\u8D25" });
    }
  });
  app2.get("/api/users/by-department/:deptId", requireAuth, async (req, res) => {
    try {
      const deptUsers = await getUsersByDepartment(req.params.deptId);
      const safe = deptUsers.map(({ password, ...u }) => u);
      return res.json(safe);
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u90E8\u95E8\u7528\u6237\u5931\u8D25" });
    }
  });
  app2.get("/api/users/all-safe", requireAuth, async (_req, res) => {
    try {
      const all = await getAllUsers();
      const allUD = await getAllUserDepartments();
      const safe = all.map(({ password, ...u }) => ({
        ...u,
        departmentIds: allUD.filter((ud) => ud.userId === u.id).map((ud) => ud.departmentId)
      }));
      return res.json(safe);
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u7528\u6237\u5217\u8868\u5931\u8D25" });
    }
  });
  app2.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      await deleteUser(req.params.id);
      return res.json({ message: "\u5DF2\u5220\u9664" });
    } catch (err) {
      return res.status(500).json({ message: "\u5220\u9664\u7528\u6237\u5931\u8D25" });
    }
  });
  app2.get("/api/objectives", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const objs = await getObjectivesForUser(user);
      return res.json(objs);
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u76EE\u6807\u5931\u8D25" });
    }
  });
  app2.get("/api/objectives/:id", requireAuth, async (req, res) => {
    try {
      const allObjs = await getAllObjectives();
      const obj = allObjs.find((o) => o.id === req.params.id);
      if (!obj) return res.status(404).json({ message: "\u76EE\u6807\u4E0D\u5B58\u5728" });
      const krs = await getKeyResultsForObjectives([obj.id]);
      return res.json({ objective: obj, keyResults: krs });
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u76EE\u6807\u5931\u8D25" });
    }
  });
  app2.post("/api/objectives", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { title, description, departmentId, cycle, parentObjectiveId, isCollaborative, collaborativeDeptIds, collaborativeUserIds, linkedToParent, okrType } = req.body;
      if (user.role !== "super_admin") {
        const userDeptIds = await getUserDepartmentIds(user.id);
        const allowedDepts = userDeptIds.length > 0 ? userDeptIds : user.departmentId ? [user.departmentId] : [];
        if (!allowedDepts.includes(departmentId)) {
          return res.status(403).json({ message: "\u53EA\u80FD\u4E3A\u81EA\u5DF1\u6240\u5C5E\u4E2D\u5FC3\u521B\u5EFA\u76EE\u6807" });
        }
      }
      const obj = await createObjectiveInDb({
        title,
        description: description || "",
        departmentId,
        cycle,
        parentObjectiveId: parentObjectiveId || null,
        isCollaborative: isCollaborative || false,
        collaborativeDeptIds: collaborativeDeptIds || [],
        collaborativeUserIds: collaborativeUserIds || [],
        createdBy: req.session.userId || null,
        linkedToParent: linkedToParent || false,
        okrType: okrType || "\u627F\u8BFA\u578B"
      });
      return res.json(obj);
    } catch (err) {
      return res.status(500).json({ message: "\u521B\u5EFA\u76EE\u6807\u5931\u8D25" });
    }
  });
  app2.put("/api/objectives/:id", requireAuth, async (req, res) => {
    try {
      const obj = await updateObjectiveInDb(req.params.id, req.body);
      return res.json(obj);
    } catch (err) {
      return res.status(500).json({ message: "\u66F4\u65B0\u76EE\u6807\u5931\u8D25" });
    }
  });
  app2.delete("/api/objectives/:id", requireAuth, async (req, res) => {
    try {
      await deleteObjectiveInDb(req.params.id);
      return res.json({ message: "\u5DF2\u5220\u9664" });
    } catch (err) {
      return res.status(500).json({ message: "\u5220\u9664\u76EE\u6807\u5931\u8D25" });
    }
  });
  app2.get("/api/key-results", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const objs = await getObjectivesForUser(user);
      const objIds = objs.map((o) => o.id);
      const krs = await getKeyResultsForObjectives(objIds);
      return res.json(krs);
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u5173\u952E\u7ED3\u679C\u5931\u8D25" });
    }
  });
  app2.get("/api/key-results/assigned-to-me", requireAuth, async (req, res) => {
    try {
      const results = await getKRsAssignedToUser(req.session.userId);
      return res.json(results);
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u534F\u540CKR\u5931\u8D25" });
    }
  });
  app2.get("/api/key-results/collaborating", requireAuth, async (req, res) => {
    try {
      const results = await getKRsCollaboratingUser(req.session.userId);
      return res.json(results);
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u8DE8\u90E8\u95E8\u534F\u540CKR\u5931\u8D25" });
    }
  });
  app2.post("/api/key-results", requireAuth, async (req, res) => {
    try {
      const { objectiveId, title, description, assigneeId, assigneeName, collaboratorId, collaboratorName, startDate, endDate, weight, okrType } = req.body;
      const kr = await createKeyResultInDb({
        objectiveId,
        title,
        description: description || "",
        assigneeId: assigneeId || null,
        assigneeName: assigneeName || "",
        collaboratorId: collaboratorId || null,
        collaboratorName: collaboratorName || "",
        startDate,
        endDate,
        weight: weight || 1,
        okrType: okrType || "\u627F\u8BFA\u578B"
      });
      return res.json(kr);
    } catch (err) {
      return res.status(500).json({ message: "\u521B\u5EFA\u5173\u952E\u7ED3\u679C\u5931\u8D25" });
    }
  });
  app2.put("/api/key-results/:id", requireAuth, async (req, res) => {
    try {
      const kr = await updateKeyResultInDb(req.params.id, req.body);
      return res.json(kr);
    } catch (err) {
      return res.status(500).json({ message: "\u66F4\u65B0\u5173\u952E\u7ED3\u679C\u5931\u8D25" });
    }
  });
  app2.delete("/api/key-results/:id", requireAuth, async (req, res) => {
    try {
      await deleteKeyResultInDb(req.params.id);
      return res.json({ message: "\u5DF2\u5220\u9664" });
    } catch (err) {
      return res.status(500).json({ message: "\u5220\u9664\u5173\u952E\u7ED3\u679C\u5931\u8D25" });
    }
  });
  app2.put("/api/key-results/:id/progress", requireAuth, async (req, res) => {
    try {
      const { progress, note, images } = req.body;
      const kr = await updateKRProgressInDb(req.params.id, progress, note || "", images);
      if (!kr) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      return res.json(kr);
    } catch (err) {
      return res.status(500).json({ message: "\u66F4\u65B0\u8FDB\u5EA6\u5931\u8D25" });
    }
  });
  app2.put("/api/key-results/:id/score", requireAuth, async (req, res) => {
    try {
      const { score, note } = req.body;
      const kr = await scoreKRInDb(req.params.id, score, note || "");
      if (!kr) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      return res.json(kr);
    } catch (err) {
      return res.status(500).json({ message: "\u8BC4\u5206\u5931\u8D25" });
    }
  });
  app2.get("/api/import/template", requireAuth, async (req, res) => {
    const XLSX = await import("xlsx");
    const now = /* @__PURE__ */ new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const defaultCycle = `${now.getFullYear()} \u7B2C${quarter === 1 ? "\u4E00" : quarter === 2 ? "\u4E8C" : quarter === 3 ? "\u4E09" : "\u56DB"}\u5B63\u5EA6`;
    const user = await getUser(req.session.userId);
    const allDepts = await getDepartments();
    let deptName = "";
    if (user?.departmentId) {
      const dept = allDepts.find((d) => d.id === user.departmentId);
      deptName = dept?.name || "";
    }
    const creatorDingtalkId = user?.dingtalkUserId || "";
    const headers = ["\u90E8\u95E8", "\u76EE\u6807\u540D\u79F0", "KR\u540D\u79F0", "\u6267\u884C\u4EBA", "\u5468\u671F", "OKR\u7C7B\u578B", "\u5173\u8054\u4E0A\u7EA7", "\u6743\u91CD", "\u521B\u5EFA\u4EBAID"];
    const rows = [
      [deptName, "\u63D0\u9AD8\u4EA7\u54C1\u8D28\u91CF", "\u5355\u5143\u6D4B\u8BD5\u8986\u76D6\u7387\u8FBE\u523080%", "", defaultCycle, "\u627F\u8BFA\u578B", "\u5426", 1, creatorDingtalkId],
      [deptName, "\u63D0\u9AD8\u4EA7\u54C1\u8D28\u91CF", "\u4EE3\u7801\u5BA1\u67E5\u901A\u8FC7\u738795%", "", defaultCycle, "\u627F\u8BFA\u578B", "\u5426", 1, creatorDingtalkId],
      [deptName, "\u63D0\u5347\u7528\u6237\u6EE1\u610F\u5EA6", "NPS\u5206\u6570\u63D0\u5347\u52308.5", "", defaultCycle, "\u6311\u6218\u578B", "\u662F", 1, creatorDingtalkId]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 20 },
      { wch: 24 },
      { wch: 12 },
      { wch: 16 },
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 20 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OKR\u5BFC\u5165\u6A21\u677F");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=okr_import_template.xlsx");
    return res.send(buf);
  });
  app2.post("/api/upload/image", requireAuth, async (req, res) => {
    try {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      await new Promise((resolve3) => req.on("end", resolve3));
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) return res.status(400).json({ message: "\u6CA1\u6709\u6587\u4EF6\u6570\u636E" });
      if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ message: "\u6587\u4EF6\u5927\u5C0F\u4E0D\u80FD\u8D85\u8FC710MB" });
      const contentType = req.headers["content-type"] || "image/png";
      const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
      const url = await uploadFile(buf, fileName, contentType);
      return res.json({ url });
    } catch (err) {
      console.error("Image upload error:", err);
      return res.status(500).json({ message: "\u56FE\u7247\u4E0A\u4F20\u5931\u8D25" });
    }
  });
  app2.post("/api/import/parse-excel", requireAuth, async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      await new Promise((resolve3) => req.on("end", resolve3));
      const buf = Buffer.concat(chunks);
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return res.status(400).json({ message: "\u6587\u4EF6\u4E3A\u7A7A" });
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (jsonData.length < 2) return res.status(400).json({ message: "\u6587\u4EF6\u4E3A\u7A7A\u6216\u53EA\u6709\u8868\u5934" });
      const headers = jsonData[0].map((h) => String(h).trim());
      if (!headers.includes("\u76EE\u6807\u540D\u79F0")) {
        return res.status(400).json({ message: "\u7F3A\u5C11\u5FC5\u8981\u5217: \u76EE\u6807\u540D\u79F0\u3002\u8BF7\u4F7F\u7528\u6A21\u677F\u6587\u4EF6\u3002" });
      }
      const rows = [];
      for (let i = 1; i < jsonData.length; i++) {
        const vals = jsonData[i];
        if (!vals || vals.length === 0) continue;
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = vals[idx] != null ? String(vals[idx]).trim() : "";
        });
        if (row["\u76EE\u6807\u540D\u79F0"]) rows.push(row);
      }
      return res.json({ rows });
    } catch (err) {
      console.error("Parse excel error:", err);
      return res.status(400).json({ message: "\u6587\u4EF6\u89E3\u6790\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6\u683C\u5F0F\uFF08\u652F\u6301 .xlsx \u548C .csv\uFF09" });
    }
  });
  app2.post("/api/import/okr", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u6570\u636E" });
      }
      const allDepts = await getDepartments();
      const allUsers = await getAllUsers();
      const userMultiDepts = await getUserDepartmentIds(user.id);
      let defaultDeptId = userMultiDepts[0] || user.departmentId || "";
      if (!defaultDeptId && allDepts.length > 0) {
        defaultDeptId = allDepts[0].id;
      }
      if (!defaultDeptId) {
        return res.status(400).json({ message: "\u7CFB\u7EDF\u4E2D\u5C1A\u65E0\u90E8\u95E8\uFF0C\u8BF7\u5148\u521B\u5EFA\u90E8\u95E8" });
      }
      const now = /* @__PURE__ */ new Date();
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      const defaultCycle = `${now.getFullYear()} \u7B2C${quarter === 1 ? "\u4E00" : quarter === 2 ? "\u4E8C" : quarter === 3 ? "\u4E09" : "\u56DB"}\u5B63\u5EA6`;
      const defaultEndDate = new Date(now.getFullYear(), quarter * 3, 0).toISOString().split("T")[0];
      const objectiveMap = /* @__PURE__ */ new Map();
      const errors = [];
      let importedObjectives = 0;
      let importedKRs = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const objTitle = row["\u76EE\u6807\u540D\u79F0"]?.trim();
        const objDesc = "";
        const krTitle = row["KR\u540D\u79F0"]?.trim();
        const krDesc = "";
        const okrType = row["OKR\u7C7B\u578B"]?.trim() || "\u627F\u8BFA\u578B";
        const linkedToParentStr = row["\u5173\u8054\u4E0A\u7EA7"]?.trim() || "\u5426";
        const linkedToParent = linkedToParentStr === "\u662F";
        const assigneeName = row["\u6267\u884C\u4EBA"]?.trim() || "";
        const weightStr = row["\u6743\u91CD"]?.trim() || "1";
        const parsed = parseFloat(weightStr);
        const weight = Number.isFinite(parsed) ? parsed : 1;
        const cycle = row["\u5468\u671F"]?.trim() || defaultCycle;
        const deptName = row["\u90E8\u95E8"]?.trim() || "";
        const creatorDingtalkId = row["\u521B\u5EFA\u4EBAID"]?.trim() || "";
        if (!objTitle) {
          errors.push(`\u7B2C${i + 2}\u884C: \u76EE\u6807\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A`);
          continue;
        }
        let deptId = defaultDeptId;
        if (deptName) {
          const dept = allDepts.find((d) => d.name === deptName);
          if (dept) {
            deptId = dept.id;
          } else {
            errors.push(`\u7B2C${i + 2}\u884C: \u90E8\u95E8"${deptName}"\u4E0D\u5B58\u5728\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u90E8\u95E8`);
          }
        }
        let assigneeId = null;
        let resolvedAssigneeName = "";
        if (assigneeName) {
          const matchUser = allUsers.find((u) => u.displayName === assigneeName || u.username === assigneeName);
          if (matchUser) {
            assigneeId = matchUser.id;
            resolvedAssigneeName = matchUser.displayName;
          } else {
            resolvedAssigneeName = assigneeName;
            errors.push(`\u7B2C${i + 2}\u884C: \u6267\u884C\u4EBA"${assigneeName}"\u672A\u5339\u914D\u5230\u7CFB\u7EDF\u7528\u6237`);
          }
        }
        let creatorId = null;
        if (creatorDingtalkId) {
          const matchCreator = allUsers.find((u) => u.dingtalkUserId === creatorDingtalkId);
          if (matchCreator) {
            creatorId = matchCreator.id;
          } else {
            errors.push(`\u7B2C${i + 2}\u884C: \u521B\u5EFA\u4EBAID"${creatorDingtalkId}"\u672A\u5339\u914D\u5230\u7CFB\u7EDF\u7528\u6237\uFF0C\u5C06\u4F7F\u7528\u5F53\u524D\u767B\u5F55\u7528\u6237\u4F5C\u4E3A\u521B\u5EFA\u4EBA`);
          }
        }
        const objKey = `${objTitle}|${deptId}|${cycle}|${creatorId || user.id}`;
        if (!objectiveMap.has(objKey)) {
          const validOkrType = okrType === "\u6311\u6218\u578B" ? "\u6311\u6218\u578B" : "\u627F\u8BFA\u578B";
          const obj = await createObjectiveInDb({
            title: objTitle,
            description: objDesc,
            departmentId: deptId,
            cycle,
            parentObjectiveId: null,
            isCollaborative: false,
            collaborativeDeptIds: [],
            collaborativeUserIds: [],
            createdBy: creatorId || user.id,
            // 使用创建人ID（钉钉ID匹配的用户）或当前登录用户
            linkedToParent,
            okrType: validOkrType
          });
          objectiveMap.set(objKey, obj);
          importedObjectives++;
        }
        if (krTitle) {
          const obj = objectiveMap.get(objKey);
          const validKrType = okrType === "\u6311\u6218\u578B" ? "\u6311\u6218\u578B" : "\u627F\u8BFA\u578B";
          await createKeyResultInDb({
            objectiveId: obj.id,
            title: krTitle,
            description: krDesc,
            assigneeId,
            assigneeName: resolvedAssigneeName,
            startDate: now.toISOString().split("T")[0],
            endDate: defaultEndDate,
            weight,
            okrType: validKrType
          });
          importedKRs++;
        }
      }
      return res.json({
        message: `\u5BFC\u5165\u5B8C\u6210: ${importedObjectives} \u4E2A\u76EE\u6807, ${importedKRs} \u4E2A\u5173\u952E\u7ED3\u679C`,
        importedObjectives,
        importedKRs,
        errors
      });
    } catch (err) {
      console.error("Import error:", err);
      return res.status(500).json({ message: "\u5BFC\u5165\u5931\u8D25" });
    }
  });
  app2.get("/api/analytics/department-rankings", requireAuth, async (req, res) => {
    try {
      const cycle = req.query.cycle || "";
      const allDepts = await getDepartments();
      const allObjs = await getAllObjectives();
      const filteredObjs = cycle ? allObjs.filter((o) => o.cycle === cycle) : allObjs;
      const objIds = filteredObjs.map((o) => o.id);
      const allKRs = objIds.length > 0 ? await getKeyResultsForObjectives(objIds) : [];
      const rankings = allDepts.map((dept) => {
        const deptObjs = filteredObjs.filter((o) => o.departmentId === dept.id);
        const deptKRs = allKRs.filter((kr) => deptObjs.some((o) => o.id === kr.objectiveId));
        const avgProgress = deptKRs.length > 0 ? Math.round(deptKRs.reduce((s, kr) => s + kr.progress, 0) / deptKRs.length) : 0;
        const scored = deptKRs.filter((kr) => kr.selfScore !== null && kr.selfScore !== void 0);
        const avgScore = scored.length > 0 ? parseFloat((scored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / scored.length).toFixed(2)) : 0;
        const completed = deptKRs.filter((kr) => kr.status === "completed").length;
        const completionRate = deptKRs.length > 0 ? Math.round(completed / deptKRs.length * 100) : 0;
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          objectiveCount: deptObjs.length,
          krCount: deptKRs.length,
          avgProgress,
          avgScore,
          completionRate,
          completedCount: completed,
          behindCount: deptKRs.filter((kr) => kr.status === "behind").length,
          overdueCount: deptKRs.filter((kr) => kr.status === "overdue").length
        };
      }).filter((d) => d.krCount > 0).sort((a, b) => b.avgProgress - a.avgProgress);
      const cycles2 = [...new Set(allObjs.map((o) => o.cycle))].sort();
      return res.json({ rankings, cycles: cycles2 });
    } catch (err) {
      console.error("Rankings error:", err);
      return res.status(500).json({ message: "\u83B7\u53D6\u6392\u540D\u5931\u8D25" });
    }
  });
  app2.post("/api/analytics/ai-analysis", requireAuth, async (req, res) => {
    try {
      const { cycle, departmentId } = req.body;
      if (!cycle) return res.status(400).json({ message: "\u8BF7\u9009\u62E9\u5468\u671F" });
      const { generateOKRAnalysis: generateOKRAnalysis2 } = await Promise.resolve().then(() => (init_ai_analysis(), ai_analysis_exports));
      const allDepts = await getDepartments();
      let allObjs = await getAllObjectives();
      allObjs = allObjs.filter((o) => o.cycle === cycle);
      if (departmentId) {
        allObjs = allObjs.filter((o) => o.departmentId === departmentId);
      }
      const objIds = allObjs.map((o) => o.id);
      const allKRs = objIds.length > 0 ? await getKeyResultsForObjectives(objIds) : [];
      if (allObjs.length === 0) {
        return res.json({ analysis: "\u8BE5\u5468\u671F\u6682\u65E0OKR\u6570\u636E\uFF0C\u65E0\u6CD5\u751F\u6210\u5206\u6790\u62A5\u544A\u3002" });
      }
      const deptName = departmentId ? allDepts.find((d) => d.id === departmentId)?.name : void 0;
      const analysis = await generateOKRAnalysis2({
        objectives: allObjs,
        keyResults: allKRs,
        departments: allDepts,
        cycle,
        departmentName: deptName
      });
      return res.json({ analysis });
    } catch (err) {
      console.error("AI analysis error:", err);
      return res.status(500).json({ message: "AI \u5206\u6790\u751F\u6210\u5931\u8D25" });
    }
  });
  app2.get("/api/kr-comments/:krId", requireAuth, async (req, res) => {
    try {
      const comments = await getCommentsForKR(req.params.krId);
      return res.json(comments);
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u8BC4\u8BBA\u5931\u8D25" });
    }
  });
  app2.post("/api/kr-comments", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { krId, content, mentionedUserIds } = req.body;
      if (!krId || !content?.trim()) {
        return res.status(400).json({ message: "\u8BC4\u8BBA\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" });
      }
      const comment = await createComment({
        krId,
        userId: user.id,
        userName: user.displayName,
        content: content.trim(),
        mentionedUserIds: mentionedUserIds || []
      });
      if (mentionedUserIds && mentionedUserIds.length > 0) {
        const allKRs = await getAllKeyResults();
        const kr = allKRs.find((k) => k.id === krId);
        const allObjs = await getAllObjectives();
        const obj = kr ? allObjs.find((o) => o.id === kr.objectiveId) : null;
        for (const mentionedId of mentionedUserIds) {
          if (mentionedId !== user.id) {
            await createNotification({
              userId: mentionedId,
              type: "comment_mention",
              title: `${user.displayName} \u5728\u8BC4\u8BBA\u4E2D\u63D0\u5230\u4E86\u4F60`,
              content: content.trim().substring(0, 100),
              relatedKrId: krId,
              relatedObjectiveId: obj?.id,
              fromUserId: user.id,
              fromUserName: user.displayName
            });
          }
        }
      }
      return res.json(comment);
    } catch (err) {
      return res.status(500).json({ message: "\u53D1\u9001\u8BC4\u8BBA\u5931\u8D25" });
    }
  });
  app2.delete("/api/kr-comments/:id", requireAuth, async (req, res) => {
    try {
      await deleteComment(req.params.id);
      return res.json({ message: "\u5DF2\u5220\u9664" });
    } catch (err) {
      return res.status(500).json({ message: "\u5220\u9664\u8BC4\u8BBA\u5931\u8D25" });
    }
  });
  app2.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifs = await getNotificationsForUser(req.session.userId);
      return res.json(notifs);
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u901A\u77E5\u5931\u8D25" });
    }
  });
  app2.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await getUnreadNotificationCount(req.session.userId);
      return res.json({ count });
    } catch (err) {
      return res.status(500).json({ message: "\u83B7\u53D6\u672A\u8BFB\u6570\u5931\u8D25" });
    }
  });
  app2.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await markNotificationRead(req.params.id);
      return res.json({ message: "\u5DF2\u6807\u8BB0\u5DF2\u8BFB" });
    } catch (err) {
      return res.status(500).json({ message: "\u6807\u8BB0\u5931\u8D25" });
    }
  });
  app2.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await markAllNotificationsRead(req.session.userId);
      return res.json({ message: "\u5DF2\u5168\u90E8\u6807\u8BB0\u5DF2\u8BFB" });
    } catch (err) {
      return res.status(500).json({ message: "\u6807\u8BB0\u5931\u8D25" });
    }
  });
  app2.delete("/api/okr/clear-all", requireAdmin, async (req, res) => {
    try {
      const { keyResults: keyResults2, objectives: objectives2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { eq: eq2 } = await import("drizzle-orm");
      const deletedKRs = await db2.delete(keyResults2).returning();
      const deletedObjectives = await db2.delete(objectives2).returning();
      return res.json({
        message: `\u5DF2\u6E05\u9664\u6240\u6709 OKR \u6570\u636E`,
        deletedObjectives: deletedObjectives.length,
        deletedKRs: deletedKRs.length
      });
    } catch (err) {
      console.error("Clear OKR error:", err);
      return res.status(500).json({ message: "\u6E05\u9664\u5931\u8D25" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs2.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const webBuildDir = path2.resolve(process.cwd(), "static-build", "web");
  const webBuildExists = fs2.existsSync(path2.join(webBuildDir, "index.html"));
  log("Serving static Expo files with dynamic manifest routing");
  log(`Web build available: ${webBuildExists}`);
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path === "/" || req.path === "/manifest") {
      const platform = req.header("expo-platform");
      if (platform && (platform === "ios" || platform === "android")) {
        return serveExpoManifest(platform, res);
      }
    }
    if (webBuildExists) {
      return next();
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use("/uploads", express.static(path2.resolve(process.cwd(), "uploads")));
  if (webBuildExists) {
    app2.use(express.static(webBuildDir));
    app2.get("/{*splat}", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      const platform = req.header("expo-platform");
      if (platform) return next();
      const indexPath = path2.join(webBuildDir, "index.html");
      if (fs2.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
    log("Serving Expo Web build from static-build/web");
  }
  app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  app.get("/healthz", (_req, res) => res.status(200).send("ok"));
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  await seedDatabase();
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  const isWindows = process.platform === "win32";
  server.listen(
    {
      port,
      host: "0.0.0.0",
      ...isWindows ? {} : { reusePort: true }
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
