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
  auditLogs: () => auditLogs,
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
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, departments, userDepartments, cycles, objectives, keyResults, krComments, notifications, auditLogs, insertUserSchema, loginSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      username: text("username").notNull().unique(),
      password: text("password"),
      authProvider: text("auth_provider").notNull().default("dingtalk"),
      displayName: text("display_name").notNull(),
      role: text("role").notNull().default("member"),
      departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
      dingtalkUserId: text("dingtalk_user_id").unique(),
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
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" })
    }, (table) => [
      uniqueIndex("user_departments_user_department_unique").on(table.userId, table.departmentId),
      index("user_departments_user_idx").on(table.userId),
      index("user_departments_department_idx").on(table.departmentId)
    ]);
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
      departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "restrict" }),
      cycle: text("cycle").notNull(),
      parentObjectiveId: varchar("parent_objective_id"),
      status: text("status").notNull().default("active"),
      isCollaborative: boolean("is_collaborative").notNull().default(false),
      collaborativeDeptIds: jsonb("collaborative_dept_ids").$type().default([]),
      collaborativeUserIds: jsonb("collaborative_user_ids").$type().default([]),
      linkedToParent: boolean("linked_to_parent").notNull().default(false),
      okrType: text("okr_type").notNull().default("\u627F\u8BFA\u578B"),
      createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").defaultNow()
    }, (table) => [
      index("objectives_department_idx").on(table.departmentId),
      index("objectives_created_by_idx").on(table.createdBy),
      index("objectives_cycle_idx").on(table.cycle)
    ]);
    keyResults = pgTable("key_results", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      objectiveId: varchar("objective_id").notNull().references(() => objectives.id, { onDelete: "cascade" }),
      title: text("title").notNull(),
      description: text("description").notNull().default(""),
      assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
      assigneeName: text("assignee_name").notNull().default(""),
      collaboratorId: varchar("collaborator_id").references(() => users.id, { onDelete: "set null" }),
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
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").defaultNow()
    }, (table) => [
      index("key_results_objective_idx").on(table.objectiveId),
      index("key_results_assignee_idx").on(table.assigneeId),
      index("key_results_collaborator_idx").on(table.collaboratorId),
      check("key_results_progress_check", sql`${table.progress} between 0 and 100`),
      check("key_results_weight_check", sql`${table.weight} > 0`),
      check("key_results_self_score_check", sql`${table.selfScore} is null or (${table.selfScore} >= 0 and ${table.selfScore} <= 1)`)
    ]);
    krComments = pgTable("kr_comments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      krId: varchar("kr_id").notNull().references(() => keyResults.id, { onDelete: "cascade" }),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      userName: text("user_name").notNull(),
      content: text("content").notNull(),
      mentionedUserIds: jsonb("mentioned_user_ids").$type().default([]),
      createdAt: timestamp("created_at").defaultNow()
    }, (table) => [
      index("kr_comments_kr_idx").on(table.krId),
      index("kr_comments_user_idx").on(table.userId)
    ]);
    notifications = pgTable("notifications", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      type: text("type").notNull().default("comment_mention"),
      title: text("title").notNull(),
      content: text("content").notNull(),
      relatedKrId: varchar("related_kr_id").references(() => keyResults.id, { onDelete: "set null" }),
      relatedObjectiveId: varchar("related_objective_id").references(() => objectives.id, { onDelete: "set null" }),
      fromUserId: varchar("from_user_id").references(() => users.id, { onDelete: "set null" }),
      fromUserName: text("from_user_name"),
      isRead: boolean("is_read").notNull().default(false),
      createdAt: timestamp("created_at").defaultNow()
    }, (table) => [
      index("notifications_user_read_idx").on(table.userId, table.isRead)
    ]);
    auditLogs = pgTable("audit_logs", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      requestId: varchar("request_id").notNull(),
      actorId: varchar("actor_id"),
      actorUsername: text("actor_username"),
      actorRole: text("actor_role"),
      action: text("action").notNull(),
      resourceType: text("resource_type").notNull(),
      resourceId: varchar("resource_id"),
      ipAddress: text("ip_address"),
      userAgent: text("user_agent"),
      changes: jsonb("changes").$type().default({}),
      success: boolean("success").notNull(),
      errorCode: text("error_code"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => [
      index("audit_logs_created_at_idx").on(table.createdAt),
      index("audit_logs_actor_idx").on(table.actorId),
      index("audit_logs_action_idx").on(table.action),
      index("audit_logs_resource_idx").on(table.resourceType, table.resourceId)
    ]);
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true,
      displayName: true,
      role: true,
      departmentId: true,
      authProvider: true,
      dingtalkUserId: true
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
  generateOKRAnalysis: () => generateOKRAnalysis,
  streamOKRAnalysis: () => streamOKRAnalysis
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
    model: OKR_ANALYSIS_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 4096
  });
  return response.choices[0]?.message?.content || "\u5206\u6790\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
}
async function* streamOKRAnalysis(data) {
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
  const stream = await openai.chat.completions.create({
    model: OKR_ANALYSIS_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 4096,
    stream: true
  });
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      yield content;
    }
  }
}
var apiKey, baseURL, openai, OKR_ANALYSIS_MODEL;
var init_ai_analysis = __esm({
  "server/ai-analysis.ts"() {
    "use strict";
    apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (!apiKey) {
      throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY \u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E");
    }
    openai = new OpenAI({
      apiKey,
      baseURL: baseURL || void 0
    });
    OKR_ANALYSIS_MODEL = process.env.AI_MODEL_OKR_ANALYSIS || "DeepSeek-V3.2";
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
init_db();
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
import { eq, or, inArray, and, asc, desc, gte, lte, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";

// server/validation.ts
import { z as z2 } from "zod";
var id = z2.string().min(1).max(128);
var shortText = z2.string().trim().min(1).max(300);
var optionalText = z2.string().trim().max(5e3).optional().default("");
var isoDate = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "\u65E5\u671F\u683C\u5F0F\u5FC5\u987B\u4E3A YYYY-MM-DD");
var role = z2.enum(["member", "center_head", "vp", "super_admin"]);
var okrType = z2.enum(["\u627F\u8BFA\u578B", "\u6311\u6218\u578B"]);
var strongPasswordSchema = z2.string().min(8).max(128).refine((value) => {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
  return classes.filter((pattern) => pattern.test(value)).length >= 3;
}, "\u5BC6\u7801\u81F3\u5C118\u4F4D\uFF0C\u5E76\u5305\u542B\u5927\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u7B26\u53F7\u4E2D\u7684\u81F3\u5C11\u4E09\u7C7B");
var loginBodySchema = z2.object({
  username: z2.string().trim().min(1).max(100),
  password: z2.string().min(1).max(128)
}).strict();
var dingtalkLoginBodySchema = z2.object({ authCode: z2.string().min(1).max(2048) }).strict();
var changePasswordBodySchema = z2.object({
  currentPassword: z2.string().min(1).max(128),
  newPassword: strongPasswordSchema
}).strict();
var createUserBodySchema = z2.object({
  displayName: z2.string().trim().min(1).max(100),
  role: role.exclude(["super_admin"]).default("member"),
  departmentId: id.nullable().optional(),
  departmentIds: z2.array(id).max(50).optional(),
  dingtalkUserId: z2.string().trim().min(1).max(256)
}).strict();
var updateUserBodySchema = z2.object({
  displayName: z2.string().trim().min(1).max(100).optional(),
  role: role.exclude(["super_admin"]).optional(),
  departmentIds: z2.array(id).max(50).optional()
}).strict();
var departmentBodySchema = z2.object({
  name: shortText,
  parentId: id.nullable().optional(),
  level: z2.number().int().min(0).max(10).optional()
}).strict();
var cycleBodySchema = z2.object({
  name: shortText,
  sortOrder: z2.number().int().min(0).max(1e4).optional()
}).strict();
var objectiveCreateBodySchema = z2.object({
  title: shortText,
  description: optionalText,
  departmentId: id,
  cycle: shortText,
  parentObjectiveId: id.nullable().optional(),
  isCollaborative: z2.boolean().optional().default(false),
  collaborativeDeptIds: z2.array(id).max(100).optional().default([]),
  collaborativeUserIds: z2.array(id).max(100).optional().default([]),
  linkedToParent: z2.boolean().optional().default(false),
  okrType: okrType.optional().default("\u627F\u8BFA\u578B")
}).strict();
var objectiveUpdateBodySchema = objectiveCreateBodySchema.partial().strict();
var keyResultBodyBaseSchema = z2.object({
  objectiveId: id,
  title: shortText,
  description: optionalText,
  assigneeId: id.nullable().optional(),
  assigneeName: z2.string().trim().max(100).optional().default(""),
  collaboratorId: id.nullable().optional(),
  collaboratorName: z2.string().trim().max(100).optional().default(""),
  startDate: isoDate,
  endDate: isoDate,
  weight: z2.number().positive().max(100).optional().default(1),
  okrType: okrType.optional().default("\u627F\u8BFA\u578B")
}).strict();
var keyResultCreateBodySchema = keyResultBodyBaseSchema.refine((value) => value.startDate <= value.endDate, {
  message: "\u622A\u6B62\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E\u5F00\u59CB\u65E5\u671F",
  path: ["endDate"]
});
var keyResultUpdateBodySchema = keyResultBodyBaseSchema.omit({ objectiveId: true }).partial().strict();
var reorderBodySchema = z2.object({
  orders: z2.array(z2.object({ id, sortOrder: z2.number().int().min(0).max(1e5) }).strict()).max(1e3)
}).strict();
var progressBodySchema = z2.object({
  progress: z2.number().int().min(0).max(100),
  note: z2.string().trim().min(1).max(5e3),
  images: z2.array(z2.string().max(2048)).max(20).optional(),
  entryId: z2.string().max(128).optional()
}).strict();
var scoreBodySchema = z2.object({
  score: z2.number().min(0).max(1),
  note: z2.string().trim().max(5e3).optional().default("")
}).strict();
var commentBodySchema = z2.object({
  krId: id,
  content: z2.string().trim().min(1).max(5e3),
  mentionedUserIds: z2.array(id).max(100).optional().default([])
}).strict();
function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const error = new Error(result.error.issues[0]?.message || "\u8BF7\u6C42\u6570\u636E\u65E0\u6548");
    error.status = 400;
    throw error;
  }
  return result.data;
}

// server/storage.ts
async function getUser(id2) {
  const [user] = await db.select().from(users).where(eq(users.id, id2));
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
  const hashed = data.password ? await bcrypt.hash(data.password, 12) : null;
  const [user] = await db.insert(users).values({ ...data, password: hashed }).returning();
  return user;
}
async function updateUser(id2, updates) {
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }
  const [user] = await db.update(users).set(updates).where(eq(users.id, id2)).returning();
  return user;
}
async function deleteUser(id2) {
  await db.delete(users).where(eq(users.id, id2));
}
async function getAllUsers() {
  return db.select().from(users);
}
async function verifyPassword(plaintext, hashed) {
  return bcrypt.compare(plaintext, hashed);
}
async function getObjective(id2) {
  const [objective] = await db.select().from(objectives).where(eq(objectives.id, id2));
  return objective;
}
async function getKeyResult(id2) {
  const [keyResult] = await db.select().from(keyResults).where(eq(keyResults.id, id2));
  return keyResult;
}
async function getComment(id2) {
  const [comment] = await db.select().from(krComments).where(eq(krComments.id, id2));
  return comment;
}
async function getNotification(id2) {
  const [notification] = await db.select().from(notifications).where(eq(notifications.id, id2));
  return notification;
}
async function getDepartments() {
  return db.select().from(departments);
}
async function createDepartment(data) {
  const [dept] = await db.insert(departments).values(data).returning();
  return dept;
}
async function updateDepartment(id2, updates) {
  const [dept] = await db.update(departments).set(updates).where(eq(departments.id, id2)).returning();
  return dept;
}
async function deleteDepartment(id2) {
  await db.delete(departments).where(or(eq(departments.id, id2), eq(departments.parentId, id2)));
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
  const sortObjs = (objs) => {
    return objs.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      const numA = parseInt(a.title.match(/O(\d+)/i)?.[1] || "0");
      const numB = parseInt(b.title.match(/O(\d+)/i)?.[1] || "0");
      return numA - numB;
    });
  };
  const allObjs = sortObjs(await db.select().from(objectives));
  if (user.role === "super_admin") return allObjs;
  const multiDeptIds = await getUserDepartmentIds(user.id);
  const baseDeptIds = multiDeptIds.length > 0 ? multiDeptIds : user.departmentId ? [user.departmentId] : [];
  const ownDeptIdSet = new Set(baseDeptIds);
  const relatedKRs = await db.select({ objectiveId: keyResults.objectiveId }).from(keyResults).where(or(eq(keyResults.assigneeId, user.id), eq(keyResults.collaboratorId, user.id)));
  const relatedObjectiveIds = new Set(relatedKRs.map((row) => row.objectiveId));
  let leadershipUserIds = /* @__PURE__ */ new Set();
  if (user.role === "vp" || user.role === "center_head") {
    const leadershipUsers = await db.select({ id: users.id }).from(users).where(
      or(eq(users.role, "vp"), eq(users.role, "center_head"))
    );
    leadershipUserIds = new Set(leadershipUsers.map((leader) => leader.id));
  }
  return allObjs.filter((obj) => {
    if (obj.createdBy === user.id) return true;
    if (ownDeptIdSet.has(obj.departmentId)) return true;
    if ((obj.collaborativeUserIds || []).includes(user.id)) return true;
    if ((obj.collaborativeDeptIds || []).some((departmentId) => ownDeptIdSet.has(departmentId))) return true;
    if (relatedObjectiveIds.has(obj.id)) return true;
    return !!obj.createdBy && leadershipUserIds.has(obj.createdBy);
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
async function createObjectiveInDb(data) {
  const [obj] = await db.insert(objectives).values({
    ...data,
    status: "active"
  }).returning();
  return obj;
}
async function updateObjectiveInDb(id2, updates) {
  const [obj] = await db.update(objectives).set(updates).where(eq(objectives.id, id2)).returning();
  return obj;
}
async function deleteObjectiveInDb(id2) {
  await db.delete(keyResults).where(eq(keyResults.objectiveId, id2));
  await db.delete(objectives).where(eq(objectives.id, id2));
}
async function getKeyResultsForObjectives(objectiveIds) {
  if (objectiveIds.length === 0) return [];
  const results = await db.select().from(keyResults).where(inArray(keyResults.objectiveId, objectiveIds));
  return results.sort((a, b) => {
    const numA = parseInt(a.title.match(/KR(\d+)/i)?.[1] || "0");
    const numB = parseInt(b.title.match(/KR(\d+)/i)?.[1] || "0");
    return numA - numB;
  });
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
async function updateKeyResultInDb(id2, updates) {
  console.log("updateKeyResultInDb called:", id2, updates);
  try {
    const [kr] = await db.update(keyResults).set(updates).where(eq(keyResults.id, id2)).returning();
    console.log("updateKeyResultInDb success:", kr?.id);
    return kr;
  } catch (err) {
    console.error("updateKeyResultInDb error:", err.message);
    throw err;
  }
}
async function deleteKeyResultInDb(id2) {
  await db.delete(keyResults).where(eq(keyResults.id, id2));
}
async function updateKRProgressInDb(id2, progress, note, images, entryId) {
  const [existing] = await db.select().from(keyResults).where(eq(keyResults.id, id2));
  if (!existing) return void 0;
  const normalizedImages = images && images.length > 0 ? images : void 0;
  const existingHistory = existing.progressHistory || [];
  let history;
  if (entryId) {
    const historyIndex = existingHistory.findIndex((entry) => entry.id === entryId);
    if (historyIndex === -1) return void 0;
    history = existingHistory.map((entry, index2) => index2 === historyIndex ? {
      ...entry,
      progress,
      note,
      images: normalizedImages
    } : entry);
  } else {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: (/* @__PURE__ */ new Date()).toISOString(),
      progress,
      note,
      images: normalizedImages
    };
    history = [...existingHistory, entry];
  }
  const latestProgress = history.length > 0 ? history[history.length - 1]?.progress ?? progress : progress;
  const now = /* @__PURE__ */ new Date();
  const end = new Date(existing.endDate);
  const start = new Date(existing.startDate);
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24));
  const elapsedDays = (now.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24);
  const expectedProgress = Math.min(100, elapsedDays / totalDays * 100);
  let status = "normal";
  if (latestProgress >= 100) status = "completed";
  else if (now > end) status = "overdue";
  else if (latestProgress < expectedProgress * 0.8) status = "behind";
  const [kr] = await db.update(keyResults).set({
    progress: latestProgress,
    status,
    progressHistory: history
  }).where(eq(keyResults.id, id2)).returning();
  return kr;
}
async function scoreKRInDb(id2, score, note) {
  const [kr] = await db.update(keyResults).set({
    selfScore: score,
    selfScoreNote: note
  }).where(eq(keyResults.id, id2)).returning();
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
    const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
    if (!adminPassword || !strongPasswordSchema.safeParse(adminPassword).success) {
      throw new Error("ADMIN_BOOTSTRAP_PASSWORD is required when the admin account does not exist");
    }
    console.log("Seeding default admin user...");
    await createUser({
      username: "admin",
      password: adminPassword,
      displayName: "\u8D85\u7EA7\u7BA1\u7406\u5458",
      role: "super_admin",
      departmentId: null,
      authProvider: "local",
      dingtalkUserId: null
    });
    console.log("Default admin created from the one-time bootstrap secret");
  } else {
    const updates = {};
    if (existingAdmin.authProvider !== "local") updates.authProvider = "local";
    if (!existingAdmin.password) {
      const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
      if (!adminPassword || !strongPasswordSchema.safeParse(adminPassword).success) {
        throw new Error("ADMIN_BOOTSTRAP_PASSWORD must satisfy the password policy when the admin has no password");
      }
      updates.password = adminPassword;
    }
    if (Object.keys(updates).length > 0) await updateUser(existingAdmin.id, updates);
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
async function updateCycle(id2, data) {
  const [cycle] = await db.update(cycles).set(data).where(eq(cycles.id, id2)).returning();
  return cycle;
}
async function deleteCycle(id2) {
  await db.delete(cycles).where(eq(cycles.id, id2));
}
async function getCommentsForKR(krId) {
  return db.select().from(krComments).where(eq(krComments.krId, krId));
}
async function createComment(data) {
  const [comment] = await db.insert(krComments).values(data).returning();
  return comment;
}
async function deleteComment(id2) {
  await db.delete(krComments).where(eq(krComments.id, id2));
}
async function getNotificationsForUser(userId) {
  return db.select().from(notifications).where(eq(notifications.userId, userId));
}
async function createNotification(data) {
  const [notif] = await db.insert(notifications).values(data).returning();
  return notif;
}
async function markNotificationRead(id2) {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id2));
}
async function markAllNotificationsRead(userId) {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}
async function getUnreadNotificationCount(userId) {
  const rows = await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return rows.length;
}
async function createAuditLog(data) {
  await db.insert(auditLogs).values(data);
}
async function getAuditLogs(filters) {
  const conditions = [];
  if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.resourceType) conditions.push(eq(auditLogs.resourceType, filters.resourceType));
  if (filters.success !== void 0) conditions.push(eq(auditLogs.success, filters.success));
  if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));
  const limit = Math.min(Math.max(filters.limit || 200, 1), 1e3);
  return db.select().from(auditLogs).where(conditions.length ? and(...conditions) : void 0).orderBy(desc(auditLogs.createdAt)).limit(limit);
}
async function deleteExpiredAuditLogs(retentionDays = 180) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1e3);
  const deleted = await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff)).returning({ id: auditLogs.id });
  return deleted.length;
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
async function getCenterDepartmentInfo(deptId) {
  console.log(`[DT Dept] getCenterDepartmentInfo called with deptId=${deptId}`);
  if (deptId === 1) return null;
  const dept = await getDepartmentDetail(deptId);
  if (!dept) return null;
  console.log(`[DT Dept] deptId=${deptId}, name="${dept.name}", parent_id=${dept.parent_id}`);
  const chain = [dept];
  let current = dept;
  for (let i = 0; i < 10; i++) {
    if (!current.parent_id || current.parent_id === 1) break;
    const upper = await getDepartmentDetail(current.parent_id);
    if (!upper) break;
    console.log(`[DT Dept] chain: name="${upper.name}", parent_id=${upper.parent_id}`);
    chain.push(upper);
    current = upper;
  }
  const companyIdx = chain.findIndex((d) => d.parent_id === 1);
  if (companyIdx < 0) {
    console.log(`[DT Dept] -> no company-level dept found, using current dept "${dept.name}"`);
    return { companyName: null, centerName: dept.name };
  }
  const companyName = chain[companyIdx].name;
  const targetIdx = companyIdx - 1;
  if (targetIdx >= 0) {
    console.log(`[DT Dept] -> company="${companyName}", center="${chain[targetIdx].name}"`);
    return { companyName, centerName: chain[targetIdx].name };
  }
  console.log(`[DT Dept] -> dept "${dept.name}" is direct child of root company, treating itself as center under "${companyName}"`);
  return { companyName, centerName: dept.name };
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

// server/authorization-policy.ts
function canManageObjective(user, objective) {
  return user.role === "super_admin" || objective.createdBy === user.id;
}
function canManageKeyResult(user, objective) {
  return canManageObjective(user, objective);
}
function canUpdateKeyResultProgress(user, objective, keyResult) {
  return canManageObjective(user, objective) || keyResult.assigneeId === user.id;
}
function canScoreKeyResult(user, objective, keyResult) {
  return canUpdateKeyResultProgress(user, objective, keyResult);
}

// server/authorization.ts
async function getReadableObjective(user, objectiveId) {
  const visible = await getObjectivesForUser(user);
  return visible.find((objective) => objective.id === objectiveId);
}
async function getManageableObjective(user, objectiveId) {
  const objective = await getObjective(objectiveId);
  return objective && canManageObjective(user, objective) ? objective : void 0;
}
async function getReadableKeyResult(user, keyResultId) {
  const keyResult = await getKeyResult(keyResultId);
  if (!keyResult) return void 0;
  const objective = await getReadableObjective(user, keyResult.objectiveId);
  return objective ? { keyResult, objective } : void 0;
}
async function getManageableKeyResult(user, keyResultId) {
  const keyResult = await getKeyResult(keyResultId);
  if (!keyResult) return void 0;
  const objective = await getObjective(keyResult.objectiveId);
  if (!objective || !canManageKeyResult(user, objective)) return void 0;
  return { keyResult, objective };
}

// server/security.ts
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
var loginFailures = /* @__PURE__ */ new Map();
var LOGIN_WINDOW_MS = 15 * 60 * 1e3;
var LOGIN_BLOCK_MS = 15 * 60 * 1e3;
var LOGIN_MAX_FAILURES = 5;
function loginKeys(req) {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "unknown";
  return [`ip:${req.ip}`, `account:${username}`];
}
function cleanupLoginFailures(now) {
  for (const [key, value] of loginFailures) {
    if (value.blockedUntil < now && now - value.lastFailure > LOGIN_WINDOW_MS) {
      loginFailures.delete(key);
    }
  }
}
function requestIdMiddleware(req, res, next) {
  const incoming = req.header("x-request-id");
  req.requestId = incoming && /^[A-Za-z0-9._-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
function allowedOrigins() {
  const origins = /* @__PURE__ */ new Set();
  const configured = [process.env.PUBLIC_HTTPS_ORIGIN, process.env.EXPO_PUBLIC_ORIGIN].filter((value) => !!value).map((value) => value.replace(/\/$/, ""));
  configured.forEach((origin) => origins.add(origin));
  if (process.env.REPLIT_DEV_DOMAIN) origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  if (process.env.REPLIT_DOMAINS) {
    process.env.REPLIT_DOMAINS.split(",").map((value) => value.trim()).filter(Boolean).forEach((domain) => origins.add(`https://${domain}`));
  }
  return origins;
}
function originGuard(req, res, next) {
  const origin = req.header("origin");
  if (!origin) return next();
  const isDevelopmentLocal = process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (isDevelopmentLocal || allowedOrigins().has(origin)) return next();
  return res.status(403).json({ message: "\u8BF7\u6C42\u6765\u6E90\u4E0D\u53D7\u4FE1\u4EFB" });
}
function issueCsrfToken(req, res) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString("hex");
  return res.json({ csrfToken: req.session.csrfToken });
}
function issueOauthState(req) {
  const state = randomBytes(32).toString("hex");
  req.session.oauthState = state;
  return state;
}
function consumeOauthState(req, supplied) {
  const expected = req.session.oauthState;
  delete req.session.oauthState;
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const expected = req.session.csrfToken;
  const supplied = req.header("x-csrf-token");
  if (!expected || !supplied) return res.status(403).json({ message: "CSRF \u6821\u9A8C\u5931\u8D25" });
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(403).json({ message: "CSRF \u6821\u9A8C\u5931\u8D25" });
  }
  next();
}
function loginRateLimit(req, res, next) {
  const now = Date.now();
  cleanupLoginFailures(now);
  const blocked = loginKeys(req).some((key) => (loginFailures.get(key)?.blockedUntil || 0) > now);
  if (blocked) {
    res.setHeader("Retry-After", Math.ceil(LOGIN_BLOCK_MS / 1e3));
    return res.status(429).json({ message: "\u767B\u5F55\u5C1D\u8BD5\u8FC7\u591A\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" });
  }
  next();
}
function recordLoginFailure(req) {
  const now = Date.now();
  for (const key of loginKeys(req)) {
    const current = loginFailures.get(key);
    const count = current && now - current.lastFailure <= LOGIN_WINDOW_MS ? current.count + 1 : 1;
    loginFailures.set(key, {
      count,
      lastFailure: now,
      blockedUntil: count >= LOGIN_MAX_FAILURES ? now + LOGIN_BLOCK_MS : 0
    });
  }
}
function clearLoginFailures(req) {
  loginKeys(req).forEach((key) => loginFailures.delete(key));
}
function regenerateSession(req) {
  const csrfToken = req.session.csrfToken;
  return new Promise((resolve3, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.csrfToken = csrfToken || randomBytes(32).toString("hex");
      resolve3();
    });
  });
}

// server/audit.ts
var SENSITIVE_KEYS = /* @__PURE__ */ new Set([
  "password",
  "currentPassword",
  "newPassword",
  "csrfToken",
  "cookie",
  "session",
  "secret",
  "key",
  "certificate"
]);
function sanitize(value) {
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitize);
  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.length > 500 ? `${value.slice(0, 500)}\u2026` : value;
  }
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !SENSITIVE_KEYS.has(key)).map(([key, entry]) => [key, sanitize(entry)])
  );
}
async function audit(req, data) {
  try {
    await createAuditLog({
      requestId: req.requestId,
      actorId: data.actor?.id || req.session?.userId || null,
      actorUsername: data.actor?.username || null,
      actorRole: data.actor?.role || null,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId || null,
      ipAddress: req.ip,
      userAgent: req.header("user-agent") || null,
      changes: sanitize(data.changes || {}),
      success: data.success ?? true,
      errorCode: data.errorCode || null
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "audit_write_failed",
      requestId: req.requestId,
      message: error instanceof Error ? error.message : "unknown"
    }));
  }
}

// server/routes.ts
var DUMMY_PASSWORD_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.8jNOM7Z5GvHyk1Iko9pZPZfK7w4M1mK";
async function readRawBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      const error = new Error("\u8BF7\u6C42\u4F53\u8FC7\u5927");
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
function detectImageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return { contentType: "image/gif", extension: "gif" };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return void 0;
}
function routeError(res, error, fallbackMessage) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ message: error instanceof Error ? error.message : fallbackMessage });
  }
  return res.status(500).json({ message: fallbackMessage });
}
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
  const sessionSecret = process.env.SESSION_SECRET;
  if (isProd && !sessionSecret) {
    throw new Error("SESSION_SECRET is required in production");
  }
  const sessionMiddleware = session({
    store: new PgStore({
      pool,
      createTableIfMissing: true
    }),
    secret: sessionSecret || "development-only-session-secret",
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
  app2.use("/api", originGuard);
  app2.get("/api/auth/csrf-token", issueCsrfToken);
  app2.use("/api", csrfProtection);
  app2.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      const { username, password } = parseBody(loginBodySchema, req.body);
      const user = await getUserByUsername(username);
      const eligible = !!user?.password;
      const passwordMatches = await verifyPassword(password, eligible ? user.password : DUMMY_PASSWORD_HASH);
      const valid = eligible && passwordMatches;
      if (!valid) {
        recordLoginFailure(req);
        await audit(req, { actor: user, action: "auth.login", resourceType: "session", success: false, errorCode: "INVALID_CREDENTIALS" });
        return res.status(401).json({ message: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" });
      }
      await regenerateSession(req);
      req.session.userId = user.id;
      clearLoginFailures(req);
      const { password: _, ...safeUser } = user;
      const deptIds = await getUserDepartmentIds(user.id);
      await audit(req, { actor: user, action: "auth.login", resourceType: "session" });
      return res.json({ user: { ...safeUser, departmentIds: deptIds } });
    } catch (err) {
      console.error("Login error:", err);
      return routeError(res, err, "\u767B\u5F55\u5931\u8D25");
    }
  });
  app2.get("/api/auth/dingtalk-config", (req, res) => {
    if (!isDingtalkConfigured()) {
      return res.json({ enabled: false });
    }
    return res.json({
      enabled: true,
      corpId: getDingtalkCorpId(),
      appKey: getDingtalkAppKey(),
      state: issueOauthState(req)
    });
  });
  async function syncDingtalkUserDept(userId, dtDeptIdList) {
    if (!dtDeptIdList || dtDeptIdList.length === 0) return;
    try {
      console.log(`[DT Sync] userId=${userId}, dtDeptIdList=${JSON.stringify(dtDeptIdList)}`);
      const knownDepts = [...await getDepartments()];
      const resolvedDeptIds = /* @__PURE__ */ new Set();
      for (const dtDeptId of dtDeptIdList) {
        console.log(`[DT Sync] Resolving dept_id=${dtDeptId}`);
        const deptInfo = await getCenterDepartmentInfo(dtDeptId);
        console.log(`[DT Sync] dept_id=${dtDeptId} -> deptInfo=${JSON.stringify(deptInfo)}`);
        if (!deptInfo?.centerName) continue;
        let companyDept = null;
        if (deptInfo.companyName) {
          companyDept = knownDepts.find((d) => d.name === deptInfo.companyName && !d.parentId) || null;
          if (!companyDept) {
            companyDept = await createDepartment({ name: deptInfo.companyName, parentId: null, level: 0 });
            knownDepts.push(companyDept);
          }
        }
        const targetParentId = companyDept?.id || null;
        const targetLevel = targetParentId ? 1 : 0;
        let centerDept = knownDepts.find((d) => d.name === deptInfo.centerName && d.parentId === targetParentId);
        if (!centerDept) {
          centerDept = knownDepts.find((d) => d.name === deptInfo.centerName);
          if (centerDept) {
            await updateDepartment(centerDept.id, { parentId: targetParentId, level: targetLevel });
            centerDept.parentId = targetParentId;
            centerDept.level = targetLevel;
          } else {
            centerDept = await createDepartment({
              name: deptInfo.centerName,
              parentId: targetParentId,
              level: targetLevel
            });
            knownDepts.push(centerDept);
          }
        } else if (centerDept.parentId !== targetParentId || centerDept.level !== targetLevel) {
          await updateDepartment(centerDept.id, { parentId: targetParentId, level: targetLevel });
          centerDept.parentId = targetParentId;
          centerDept.level = targetLevel;
        }
        resolvedDeptIds.add(centerDept.id);
      }
      if (resolvedDeptIds.size > 0) {
        await setUserDepartments(userId, Array.from(resolvedDeptIds));
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
      const { authCode } = parseBody(dingtalkLoginBodySchema, req.body);
      const dtUser = await getUserInfoByAuthCode(authCode);
      let user = await getUserByDingtalkId(dtUser.userid);
      if (user?.role === "super_admin") return res.status(403).json({ message: "\u7BA1\u7406\u5458\u8D26\u53F7\u53EA\u80FD\u4F7F\u7528\u672C\u5730\u5BC6\u7801\u767B\u5F55" });
      if (!user) {
        const newUser = await createUser({
          username: `dt_${dtUser.userid}`,
          password: null,
          authProvider: "dingtalk",
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
      await regenerateSession(req);
      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      const deptIds = await getUserDepartmentIds(user.id);
      await audit(req, { actor: user, action: "auth.dingtalk_login", resourceType: "session" });
      return res.json({ user: { ...safeUser, departmentIds: deptIds } });
    } catch (err) {
      console.error("DingTalk login error:", err);
      return res.status(500).json({ message: err?.message || "\u9489\u9489\u767B\u5F55\u5931\u8D25" });
    }
  });
  app2.post("/api/dingtalk/sync-org", requireAdmin, async (req, res) => {
    try {
      if (!isDingtalkConfigured()) {
        return res.status(400).json({ message: "\u9489\u9489\u672A\u914D\u7F6E" });
      }
      const dtDepts = await getDepartmentList();
      const dtUsers = await getAllDingtalkUsers();
      const actor = await getUser(req.session.userId);
      const existingDepts = await getDepartments();
      const existingUsers = await getAllUsers();
      let syncedDepts = 0;
      let syncedUsers = 0;
      const deptIdMap = /* @__PURE__ */ new Map();
      const knownDepts = [...existingDepts];
      const pendingDepts = [...dtDepts];
      while (pendingDepts.length > 0) {
        let progressed = false;
        for (let i = pendingDepts.length - 1; i >= 0; i--) {
          const dtDept = pendingDepts[i];
          const parentLocalId = dtDept.parent_id > 1 ? deptIdMap.get(dtDept.parent_id) || null : null;
          if (dtDept.parent_id > 1 && !parentLocalId) {
            continue;
          }
          const targetLevel = parentLocalId ? 1 : 0;
          const existing = knownDepts.find((d) => d.name === dtDept.name && d.parentId === parentLocalId);
          if (existing) {
            if (existing.level !== targetLevel || existing.parentId !== parentLocalId) {
              await updateDepartment(existing.id, { parentId: parentLocalId, level: targetLevel });
            }
            deptIdMap.set(dtDept.dept_id, existing.id);
          } else {
            const fallback = knownDepts.find((d) => d.name === dtDept.name && (!d.parentId || d.parentId !== parentLocalId));
            if (fallback) {
              await updateDepartment(fallback.id, { parentId: parentLocalId, level: targetLevel });
              fallback.parentId = parentLocalId;
              fallback.level = targetLevel;
              deptIdMap.set(dtDept.dept_id, fallback.id);
            } else {
              const newDept = await createDepartment({
                name: dtDept.name,
                parentId: parentLocalId,
                level: targetLevel
              });
              knownDepts.push(newDept);
              deptIdMap.set(dtDept.dept_id, newDept.id);
              syncedDepts++;
            }
          }
          pendingDepts.splice(i, 1);
          progressed = true;
        }
        if (!progressed) {
          console.warn("[DT Sync] Some departments could not be resolved with parent relationships:", pendingDepts.map((d) => ({ dept_id: d.dept_id, name: d.name, parent_id: d.parent_id })));
          break;
        }
      }
      for (const dtUser of dtUsers) {
        const existingUser = existingUsers.find((u) => u.dingtalkUserId === dtUser.userid);
        if (existingUser) {
          await syncDingtalkUserDept(existingUser.id, dtUser.dept_id_list);
        } else {
          const newUser = await createUser({
            username: `dt_${dtUser.userid}`,
            password: null,
            authProvider: "dingtalk",
            displayName: dtUser.name,
            role: "member",
            departmentId: null,
            dingtalkUserId: dtUser.userid
          });
          await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
          syncedUsers++;
        }
      }
      await audit(req, { actor, action: "dingtalk.sync_org", resourceType: "organization", changes: { syncedDepts, syncedUsers } });
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
      const state = typeof req.query.state === "string" ? req.query.state : void 0;
      if (!authCode || !isDingtalkConfigured() || !consumeOauthState(req, state)) {
        return res.redirect("/?dt_error=1");
      }
      const dtUser = await getUserInfoByAuthCode(authCode);
      let user = await getUserByDingtalkId(dtUser.userid);
      if (user?.role === "super_admin") return res.redirect("/?dt_error=1");
      if (!user) {
        const newUser = await createUser({
          username: `dt_${dtUser.userid}`,
          password: null,
          authProvider: "dingtalk",
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
      await regenerateSession(req);
      req.session.userId = user.id;
      await audit(req, { actor: user, action: "auth.dingtalk_callback", resourceType: "session" });
      return res.redirect("/");
    } catch (err) {
      console.error("DingTalk callback error:", err);
      return res.redirect("/?dt_error=1");
    }
  });
  app2.post("/api/auth/logout", async (req, res) => {
    const user = req.session.userId ? await getUser(req.session.userId) : void 0;
    await audit(req, { actor: user, action: "auth.logout", resourceType: "session" });
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
      const { currentPassword, newPassword } = parseBody(changePasswordBodySchema, req.body);
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      if (user.authProvider !== "local" || user.role !== "super_admin" || !user.password) {
        return res.status(403).json({ message: "\u8BE5\u8D26\u53F7\u4E0D\u652F\u6301\u5BC6\u7801\u767B\u5F55" });
      }
      const valid = await verifyPassword(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E" });
      await updateUser(user.id, { password: newPassword });
      await audit(req, { actor: user, action: "auth.password_change", resourceType: "user", resourceId: user.id });
      return res.json({ message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F" });
    } catch (err) {
      return routeError(res, err, "\u4FEE\u6539\u5BC6\u7801\u5931\u8D25");
    }
  });
  app2.get("/api/departments", requireAuth, async (_req, res) => {
    const deps = await getDepartments();
    return res.json(deps);
  });
  app2.post("/api/departments", requireAdmin, async (req, res) => {
    try {
      const actor = await getUser(req.session.userId);
      const { name, parentId, level } = parseBody(departmentBodySchema, req.body);
      const dept = await createDepartment({ name, parentId: parentId || null, level: level || 0 });
      await audit(req, { actor, action: "department.create", resourceType: "department", resourceId: dept.id, changes: { name, parentId, level } });
      return res.json(dept);
    } catch (err) {
      return routeError(res, err, "\u521B\u5EFA\u90E8\u95E8\u5931\u8D25");
    }
  });
  app2.put("/api/departments/:id", requireAdmin, async (req, res) => {
    try {
      const actor = await getUser(req.session.userId);
      const updates = parseBody(departmentBodySchema.partial().strict(), req.body);
      const dept = await updateDepartment(req.params.id, updates);
      if (!dept) return res.status(404).json({ message: "\u90E8\u95E8\u4E0D\u5B58\u5728" });
      await audit(req, { actor, action: "department.update", resourceType: "department", resourceId: dept.id, changes: updates });
      return res.json(dept);
    } catch (err) {
      return routeError(res, err, "\u66F4\u65B0\u90E8\u95E8\u5931\u8D25");
    }
  });
  app2.delete("/api/departments/:id", requireAdmin, async (req, res) => {
    try {
      const actor = await getUser(req.session.userId);
      await deleteDepartment(req.params.id);
      await audit(req, { actor, action: "department.delete", resourceType: "department", resourceId: req.params.id });
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
      const actor = await getUser(req.session.userId);
      const { name, sortOrder } = parseBody(cycleBodySchema, req.body);
      const cycle = await createCycle(name, sortOrder ?? 0);
      await audit(req, { actor, action: "cycle.create", resourceType: "cycle", resourceId: cycle.id, changes: { name, sortOrder } });
      return res.json(cycle);
    } catch (err) {
      if (err?.code === "23505") return res.status(400).json({ message: "\u8BE5\u5468\u671F\u540D\u79F0\u5DF2\u5B58\u5728" });
      return routeError(res, err, "\u521B\u5EFA\u5468\u671F\u5931\u8D25");
    }
  });
  app2.put("/api/cycles/:id", requireAdmin, async (req, res) => {
    try {
      const actor = await getUser(req.session.userId);
      const updates = parseBody(cycleBodySchema.partial().strict(), req.body);
      const cycle = await updateCycle(req.params.id, updates);
      if (!cycle) return res.status(404).json({ message: "\u5468\u671F\u4E0D\u5B58\u5728" });
      await audit(req, { actor, action: "cycle.update", resourceType: "cycle", resourceId: cycle.id, changes: updates });
      return res.json(cycle);
    } catch (err) {
      if (err?.code === "23505") return res.status(400).json({ message: "\u8BE5\u5468\u671F\u540D\u79F0\u5DF2\u5B58\u5728" });
      return routeError(res, err, "\u66F4\u65B0\u5468\u671F\u5931\u8D25");
    }
  });
  app2.delete("/api/cycles/:id", requireAdmin, async (req, res) => {
    try {
      const actor = await getUser(req.session.userId);
      await deleteCycle(req.params.id);
      await audit(req, { actor, action: "cycle.delete", resourceType: "cycle", resourceId: req.params.id });
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
      const actor = await getUser(req.session.userId);
      const { displayName, role: role2, departmentId, departmentIds, dingtalkUserId } = parseBody(createUserBodySchema, req.body);
      const username = `dt_${dingtalkUserId}`;
      const existing = await getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" });
      }
      const deptIds = departmentIds || (departmentId ? [departmentId] : []);
      const primaryDeptId = deptIds.length > 0 ? deptIds[0] : null;
      const user = await createUser({ username, password: null, authProvider: "dingtalk", dingtalkUserId, displayName, role: role2, departmentId: primaryDeptId });
      if (deptIds.length > 0) {
        await setUserDepartments(user.id, deptIds);
      }
      const { password: _, ...safeUser } = user;
      await audit(req, { actor, action: "user.create", resourceType: "user", resourceId: user.id, changes: { username, displayName, role: role2, departmentIds: deptIds, authProvider: "dingtalk" } });
      return res.json({ ...safeUser, departmentIds: deptIds });
    } catch (err) {
      return routeError(res, err, "\u521B\u5EFA\u7528\u6237\u5931\u8D25");
    }
  });
  app2.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const actor = await getUser(req.session.userId);
      const { departmentIds, ...rest } = parseBody(updateUserBodySchema, req.body);
      const userUpdates = { ...rest };
      if (departmentIds && Array.isArray(departmentIds)) {
        userUpdates.departmentId = departmentIds.length > 0 ? departmentIds[0] : null;
        await setUserDepartments(req.params.id, departmentIds);
      }
      const user = await updateUser(req.params.id, userUpdates);
      if (!user) return res.status(404).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { password: _, ...safeUser } = user;
      const deptIds = departmentIds || await getUserDepartmentIds(user.id);
      await audit(req, { actor, action: "user.update", resourceType: "user", resourceId: user.id, changes: { ...rest, departmentIds } });
      return res.json({ ...safeUser, departmentIds: deptIds });
    } catch (err) {
      return routeError(res, err, "\u66F4\u65B0\u7528\u6237\u5931\u8D25");
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
      const actor = await getUser(req.session.userId);
      if (req.params.id === req.session.userId) return res.status(400).json({ message: "\u4E0D\u80FD\u5220\u9664\u5F53\u524D\u767B\u5F55\u8D26\u53F7" });
      await deleteUser(req.params.id);
      await audit(req, { actor, action: "user.delete", resourceType: "user", resourceId: req.params.id });
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
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const obj = await getReadableObjective(user, req.params.id);
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
      const { title, description, departmentId, cycle, parentObjectiveId, isCollaborative, collaborativeDeptIds, collaborativeUserIds, linkedToParent, okrType: okrType2 } = parseBody(objectiveCreateBodySchema, req.body);
      if (user.role !== "super_admin") {
        const userDeptIds = await getUserDepartmentIds(user.id);
        const allowedDepts = userDeptIds.length > 0 ? userDeptIds : user.departmentId ? [user.departmentId] : [];
        if (!allowedDepts.includes(departmentId)) {
          return res.status(403).json({ message: "\u53EA\u80FD\u4E3A\u81EA\u5DF1\u6240\u5C5E\u4E2D\u5FC3\u521B\u5EFA\u76EE\u6807" });
        }
      }
      if (parentObjectiveId && !await getReadableObjective(user, parentObjectiveId)) {
        return res.status(404).json({ message: "\u4E0A\u7EA7\u76EE\u6807\u4E0D\u5B58\u5728" });
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
        okrType: okrType2 || "\u627F\u8BFA\u578B"
      });
      await audit(req, { actor: user, action: "objective.create", resourceType: "objective", resourceId: obj.id, changes: { title, departmentId, cycle, parentObjectiveId, isCollaborative, collaborativeDeptIds, collaborativeUserIds, linkedToParent, okrType: okrType2 } });
      return res.json(obj);
    } catch (err) {
      return routeError(res, err, "\u521B\u5EFA\u76EE\u6807\u5931\u8D25");
    }
  });
  app2.put("/api/objectives/:id", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const existing = await getManageableObjective(user, req.params.id);
      if (!existing) return res.status(404).json({ message: "\u76EE\u6807\u4E0D\u5B58\u5728" });
      const updates = parseBody(objectiveUpdateBodySchema, req.body);
      if (updates.departmentId && user.role !== "super_admin") {
        const departmentIds = await getUserDepartmentIds(user.id);
        const allowed = departmentIds.length ? departmentIds : user.departmentId ? [user.departmentId] : [];
        if (!allowed.includes(updates.departmentId)) return res.status(403).json({ message: "\u4E0D\u80FD\u5C06\u76EE\u6807\u79FB\u52A8\u5230\u5176\u4ED6\u4E2D\u5FC3" });
      }
      if (updates.parentObjectiveId && !await getReadableObjective(user, updates.parentObjectiveId)) {
        return res.status(404).json({ message: "\u4E0A\u7EA7\u76EE\u6807\u4E0D\u5B58\u5728" });
      }
      const obj = await updateObjectiveInDb(req.params.id, updates);
      await audit(req, { actor: user, action: "objective.update", resourceType: "objective", resourceId: req.params.id, changes: updates });
      return res.json(obj);
    } catch (err) {
      return routeError(res, err, "\u66F4\u65B0\u76EE\u6807\u5931\u8D25");
    }
  });
  app2.delete("/api/objectives/:id", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      if (!await getManageableObjective(user, req.params.id)) return res.status(404).json({ message: "\u76EE\u6807\u4E0D\u5B58\u5728" });
      await deleteObjectiveInDb(req.params.id);
      await audit(req, { actor: user, action: "objective.delete", resourceType: "objective", resourceId: req.params.id });
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
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { objectiveId, title, description, assigneeId, assigneeName, collaboratorId, collaboratorName, startDate, endDate, weight, okrType: okrType2 } = parseBody(keyResultCreateBodySchema, req.body);
      if (!await getManageableObjective(user, objectiveId)) return res.status(404).json({ message: "\u76EE\u6807\u4E0D\u5B58\u5728" });
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
        okrType: okrType2 || "\u627F\u8BFA\u578B"
      });
      await audit(req, { actor: user, action: "key_result.create", resourceType: "key_result", resourceId: kr.id, changes: { objectiveId, title, assigneeId, collaboratorId, startDate, endDate, weight, okrType: okrType2 } });
      return res.json(kr);
    } catch (err) {
      return routeError(res, err, "\u521B\u5EFA\u5173\u952E\u7ED3\u679C\u5931\u8D25");
    }
  });
  app2.put("/api/objectives/reorder", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { orders } = parseBody(reorderBodySchema, req.body);
      for (const item of orders) {
        if (!await getManageableObjective(user, item.id)) return res.status(404).json({ message: "\u76EE\u6807\u4E0D\u5B58\u5728" });
        await updateObjectiveInDb(item.id, { sortOrder: item.sortOrder });
      }
      await audit(req, { actor: user, action: "objective.reorder", resourceType: "objective", changes: { count: orders.length } });
      return res.json({ message: "\u6392\u5E8F\u5DF2\u4FDD\u5B58" });
    } catch (err) {
      console.error("Reorder Objective error:", err);
      return res.status(500).json({ message: err.message || "\u6392\u5E8F\u4FDD\u5B58\u5931\u8D25" });
    }
  });
  app2.put("/api/key-results/reorder", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { orders } = parseBody(reorderBodySchema, req.body);
      for (const item of orders) {
        if (!await getManageableKeyResult(user, item.id)) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
        await updateKeyResultInDb(item.id, { sortOrder: item.sortOrder });
      }
      await audit(req, { actor: user, action: "key_result.reorder", resourceType: "key_result", changes: { count: orders.length } });
      return res.json({ message: "\u6392\u5E8F\u5DF2\u4FDD\u5B58" });
    } catch (err) {
      console.error("Reorder KR error:", err);
      return res.status(500).json({ message: err.message || "\u6392\u5E8F\u4FDD\u5B58\u5931\u8D25" });
    }
  });
  app2.put("/api/key-results/:id", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      if (!await getManageableKeyResult(user, req.params.id)) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      const updates = parseBody(keyResultUpdateBodySchema, req.body);
      const kr = await updateKeyResultInDb(req.params.id, updates);
      await audit(req, { actor: user, action: "key_result.update", resourceType: "key_result", resourceId: req.params.id, changes: updates });
      return res.json(kr);
    } catch (err) {
      return routeError(res, err, "\u66F4\u65B0\u5173\u952E\u7ED3\u679C\u5931\u8D25");
    }
  });
  app2.delete("/api/key-results/:id", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      if (!await getManageableKeyResult(user, req.params.id)) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      await deleteKeyResultInDb(req.params.id);
      await audit(req, { actor: user, action: "key_result.delete", resourceType: "key_result", resourceId: req.params.id });
      return res.json({ message: "\u5DF2\u5220\u9664" });
    } catch (err) {
      return res.status(500).json({ message: "\u5220\u9664\u5173\u952E\u7ED3\u679C\u5931\u8D25" });
    }
  });
  app2.put("/api/key-results/:id/progress", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const resource = await getReadableKeyResult(user, req.params.id);
      if (!resource || !canUpdateKeyResultProgress(user, resource.objective, resource.keyResult)) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      const { progress, note, images, entryId } = parseBody(progressBodySchema, req.body);
      const kr = await updateKRProgressInDb(
        req.params.id,
        progress,
        note || "",
        images,
        entryId ? String(entryId) : void 0
      );
      if (!kr) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      await audit(req, { actor: user, action: "key_result.progress", resourceType: "key_result", resourceId: req.params.id, changes: { progress, entryId, imageCount: images?.length || 0 } });
      return res.json(kr);
    } catch (err) {
      return routeError(res, err, "\u66F4\u65B0\u8FDB\u5EA6\u5931\u8D25");
    }
  });
  app2.put("/api/key-results/:id/score", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const resource = await getReadableKeyResult(user, req.params.id);
      if (!resource || !canScoreKeyResult(user, resource.objective, resource.keyResult)) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      const { score, note } = parseBody(scoreBodySchema, req.body);
      const kr = await scoreKRInDb(req.params.id, score, note || "");
      if (!kr) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      await audit(req, { actor: user, action: "key_result.score", resourceType: "key_result", resourceId: req.params.id, changes: { score } });
      return res.json(kr);
    } catch (err) {
      return routeError(res, err, "\u8BC4\u5206\u5931\u8D25");
    }
  });
  app2.get("/api/export/okr", requireAuth, async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const allUsers = await getAllUsers();
      const allDepartments = await getDepartments();
      const allVisibleObjectives = await getObjectivesForUser(user);
      const visibleObjectiveIds = allVisibleObjectives.map((objective) => objective.id);
      const allVisibleKRs = visibleObjectiveIds.length > 0 ? await getKeyResultsForObjectives(visibleObjectiveIds) : [];
      const myDeptIds = await getUserDepartmentIds(user.id);
      const selectedDeptIds = typeof req.query.departmentIds === "string" && req.query.departmentIds ? req.query.departmentIds.split(",").map((id2) => id2.trim()).filter(Boolean) : [];
      const selectedUserId = typeof req.query.userId === "string" && req.query.userId ? req.query.userId : null;
      const selectedCycle = typeof req.query.cycle === "string" && req.query.cycle ? req.query.cycle : null;
      const userRole = user.role || "member";
      const isAdmin = userRole === "center_head" || userRole === "vp" || userRole === "super_admin";
      let filteredObjectives = [...allVisibleObjectives];
      if (!isAdmin) {
        const targetUserId = selectedUserId || user.id;
        filteredObjectives = filteredObjectives.filter((objective) => {
          if (objective.createdBy === targetUserId) return true;
          if (objective.createdBy === user.id) {
            return allVisibleKRs.some(
              (kr) => kr.objectiveId === objective.id && kr.assigneeId === targetUserId
            );
          }
          return false;
        });
        if (myDeptIds.length > 0) {
          filteredObjectives = filteredObjectives.filter(
            (objective) => myDeptIds.includes(objective.departmentId)
          );
        }
      } else {
        if (selectedDeptIds.length > 0) {
          filteredObjectives = filteredObjectives.filter(
            (objective) => selectedDeptIds.includes(objective.departmentId)
          );
        }
        if (selectedUserId) {
          filteredObjectives = filteredObjectives.filter((objective) => objective.createdBy === selectedUserId);
        }
      }
      if (selectedCycle) {
        filteredObjectives = filteredObjectives.filter((objective) => objective.cycle === selectedCycle);
      }
      const objectiveIdSet = new Set(filteredObjectives.map((objective) => objective.id));
      const filteredKRs = allVisibleKRs.filter((kr) => objectiveIdSet.has(kr.objectiveId));
      const commentsByKr = /* @__PURE__ */ new Map();
      for (const kr of filteredKRs) {
        commentsByKr.set(kr.id, await getCommentsForKR(kr.id));
      }
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const deptMap = new Map(allDepartments.map((dept) => [dept.id, dept]));
      const krsByObjective = /* @__PURE__ */ new Map();
      for (const kr of filteredKRs) {
        const current = krsByObjective.get(kr.objectiveId) || [];
        current.push(kr);
        krsByObjective.set(kr.objectiveId, current);
      }
      const summaryHeaders = [
        "\u90E8\u95E8",
        "\u5468\u671F",
        "\u76EE\u6807\u6807\u9898",
        "\u76EE\u6807\u63CF\u8FF0",
        "\u76EE\u6807\u521B\u5EFA\u4EBA",
        "\u5173\u952E\u7ED3\u679C\u6807\u9898",
        "\u5173\u952E\u7ED3\u679C\u63CF\u8FF0",
        "\u6267\u884C\u4EBA",
        "\u534F\u540C\u4EBA",
        "\u5F00\u59CB\u65E5\u671F",
        "\u622A\u6B62\u65E5\u671F",
        "\u6743\u91CD",
        "\u8FDB\u5EA6",
        "\u72B6\u6001",
        "OKR\u7C7B\u578B",
        "\u81EA\u8BC4\u5206",
        "\u81EA\u8BC4\u8BF4\u660E",
        "\u8FDB\u5EA6\u8BB0\u5F55\u6570",
        "\u8BC4\u8BBA\u6570",
        "\u6700\u65B0\u8BC4\u8BBA"
      ];
      summaryHeaders.push("\u6700\u65B0\u6267\u884C\u8BF4\u660E", "\u6700\u65B0\u6267\u884C\u8BF4\u660E\u65F6\u95F4");
      const progressHeaders = [
        "\u90E8\u95E8",
        "\u5468\u671F",
        "\u76EE\u6807\u6807\u9898",
        "\u5173\u952E\u7ED3\u679C\u6807\u9898",
        "\u8BB0\u5F55\u65E5\u671F",
        "\u8FDB\u5EA6",
        "\u5907\u6CE8",
        "\u56FE\u7247"
      ];
      const commentHeaders = [
        "\u90E8\u95E8",
        "\u5468\u671F",
        "\u76EE\u6807\u6807\u9898",
        "\u5173\u952E\u7ED3\u679C\u6807\u9898",
        "\u8BC4\u8BBA\u4EBA",
        "\u8BC4\u8BBA\u5185\u5BB9",
        "@\u63D0\u53CA",
        "\u8BC4\u8BBA\u65F6\u95F4"
      ];
      const summaryRows = [];
      const progressRows = [];
      const commentRows = [];
      for (const objective of filteredObjectives) {
        const dept = deptMap.get(objective.departmentId);
        const creator = objective.createdBy ? userMap.get(objective.createdBy) : null;
        const objectiveKRs = (krsByObjective.get(objective.id) || []).sort(
          (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
        );
        if (objectiveKRs.length === 0) {
          summaryRows.push([
            dept?.name || "",
            objective.cycle,
            objective.title,
            objective.description || "",
            creator?.displayName || "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            objective.okrType || "",
            "",
            "",
            0,
            0,
            ""
          ]);
          continue;
        }
        for (const kr of objectiveKRs) {
          const comments = commentsByKr.get(kr.id) || [];
          const progressHistory = kr.progressHistory || [];
          const latestComment = comments[comments.length - 1];
          const latestProgressEntry = progressHistory[progressHistory.length - 1];
          summaryRows.push([
            dept?.name || "",
            objective.cycle,
            objective.title,
            objective.description || "",
            creator?.displayName || "",
            kr.title,
            kr.description || "",
            kr.assigneeName || "",
            kr.collaboratorName || "",
            kr.startDate,
            kr.endDate,
            kr.weight,
            kr.progress,
            kr.status,
            kr.okrType || "",
            kr.selfScore ?? "",
            kr.selfScoreNote || "",
            progressHistory.length,
            comments.length,
            latestProgressEntry?.note || "",
            latestProgressEntry?.date || "",
            latestComment ? `${latestComment.userName}: ${latestComment.content}` : ""
          ]);
          for (const entry of progressHistory) {
            progressRows.push([
              dept?.name || "",
              objective.cycle,
              objective.title,
              kr.title,
              entry.date,
              entry.progress,
              entry.note || "",
              entry.images?.join("\n") || ""
            ]);
          }
          for (const comment of comments) {
            const mentionedNames = (comment.mentionedUserIds || []).map((mentionedId) => userMap.get(mentionedId)?.displayName || mentionedId).join(", ");
            commentRows.push([
              dept?.name || "",
              objective.cycle,
              objective.title,
              kr.title,
              comment.userName,
              comment.content,
              mentionedNames,
              comment.createdAt
            ]);
          }
        }
      }
      const wb = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
      const progressSheet = XLSX.utils.aoa_to_sheet([progressHeaders, ...progressRows]);
      const commentSheet = XLSX.utils.aoa_to_sheet([commentHeaders, ...commentRows]);
      summarySheet["!cols"] = summaryHeaders.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
      progressSheet["!cols"] = progressHeaders.map((header) => ({ wch: Math.max(header.length + 2, 16) }));
      commentSheet["!cols"] = commentHeaders.map((header) => ({ wch: Math.max(header.length + 2, 16) }));
      XLSX.utils.book_append_sheet(wb, summarySheet, "OKR\u6C47\u603B");
      XLSX.utils.book_append_sheet(wb, progressSheet, "\u8FDB\u5EA6\u8BB0\u5F55");
      XLSX.utils.book_append_sheet(wb, commentSheet, "\u8BC4\u8BBA\u8BB0\u5F55");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=okr_export_${stamp}.xlsx`);
      await audit(req, { actor: user, action: "okr.export", resourceType: "okr", changes: { objectiveCount: filteredObjectives.length, keyResultCount: filteredKRs.length } });
      return res.send(buf);
    } catch (err) {
      console.error("Export OKR error:", err);
      return res.status(500).json({ message: "\u5BFC\u51FA\u5931\u8D25" });
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
      const buf = await readRawBody(req, 10 * 1024 * 1024);
      if (buf.length === 0) return res.status(400).json({ message: "\u6CA1\u6709\u6587\u4EF6\u6570\u636E" });
      const detected = detectImageType(buf);
      if (!detected) return res.status(400).json({ message: "\u4EC5\u652F\u6301 PNG\u3001JPEG\u3001GIF \u548C WebP \u56FE\u7247" });
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${detected.extension}`;
      const url = await uploadFile(buf, fileName, detected.contentType);
      return res.json({ url });
    } catch (err) {
      console.error("Image upload error:", err);
      return routeError(res, err, "\u56FE\u7247\u4E0A\u4F20\u5931\u8D25");
    }
  });
  app2.post("/api/import/parse-excel", requireAuth, async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      const buf = await readRawBody(req, 10 * 1024 * 1024);
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return res.status(400).json({ message: "\u6587\u4EF6\u4E3A\u7A7A" });
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (jsonData.length < 2) return res.status(400).json({ message: "\u6587\u4EF6\u4E3A\u7A7A\u6216\u53EA\u6709\u8868\u5934" });
      if (jsonData.length > 1001) return res.status(400).json({ message: "\u5355\u6B21\u6700\u591A\u5BFC\u51651000\u884C" });
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
      return routeError(res, err, "\u6587\u4EF6\u89E3\u6790\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6\u683C\u5F0F\uFF08\u652F\u6301 .xlsx \u548C .csv\uFF09");
    }
  });
  app2.post("/api/import/okr", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0 || rows.length > 1e3) {
        return res.status(400).json({ message: "\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u6570\u636E" });
      }
      const allDepts = await getDepartments();
      const allUsers = await getAllUsers();
      const userMultiDepts = await getUserDepartmentIds(user.id);
      let defaultDeptId = userMultiDepts[0] || user.departmentId || "";
      if (!defaultDeptId && user.role === "super_admin" && allDepts.length > 0) {
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
        if (!row || typeof row !== "object") {
          errors.push(`\u7B2C${i + 2}\u884C: \u6570\u636E\u683C\u5F0F\u65E0\u6548`);
          continue;
        }
        const objTitle = row["\u76EE\u6807\u540D\u79F0"]?.trim();
        const objDesc = "";
        const krTitle = row["KR\u540D\u79F0"]?.trim();
        const krDesc = "";
        const okrType2 = row["OKR\u7C7B\u578B"]?.trim() || "\u627F\u8BFA\u578B";
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
            const allowedDepts = userMultiDepts.length ? userMultiDepts : user.departmentId ? [user.departmentId] : [];
            if (user.role === "super_admin" || allowedDepts.includes(dept.id)) deptId = dept.id;
            else errors.push(`\u7B2C${i + 2}\u884C: \u65E0\u6743\u5411\u90E8\u95E8"${deptName}"\u5BFC\u5165\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u90E8\u95E8`);
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
        let creatorId = user.id;
        if (user.role === "super_admin" && creatorDingtalkId) {
          const matchCreator = allUsers.find((u) => u.dingtalkUserId === creatorDingtalkId);
          if (matchCreator) {
            creatorId = matchCreator.id;
          } else {
            errors.push(`\u7B2C${i + 2}\u884C: \u521B\u5EFA\u4EBAID"${creatorDingtalkId}"\u672A\u5339\u914D\u5230\u7CFB\u7EDF\u7528\u6237\uFF0C\u5C06\u4F7F\u7528\u5F53\u524D\u767B\u5F55\u7528\u6237\u4F5C\u4E3A\u521B\u5EFA\u4EBA`);
          }
        }
        const objKey = `${objTitle}|${deptId}|${cycle}|${creatorId || user.id}`;
        if (!objectiveMap.has(objKey)) {
          const validOkrType = okrType2 === "\u6311\u6218\u578B" ? "\u6311\u6218\u578B" : "\u627F\u8BFA\u578B";
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
          const validKrType = okrType2 === "\u6311\u6218\u578B" ? "\u6311\u6218\u578B" : "\u627F\u8BFA\u578B";
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
      await audit(req, { actor: user, action: "okr.import", resourceType: "okr", changes: { importedObjectives, importedKRs, errorCount: errors.length } });
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
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const allDepts = await getDepartments();
      const allObjs = await getObjectivesForUser(user);
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
      const { cycle, departmentId, stream = false } = req.body;
      if (!cycle) return res.status(400).json({ message: "\u8BF7\u9009\u62E9\u5468\u671F" });
      if (typeof cycle !== "string" || cycle.length > 300 || departmentId && typeof departmentId !== "string" || typeof stream !== "boolean") {
        return res.status(400).json({ message: "\u8BF7\u6C42\u6570\u636E\u65E0\u6548" });
      }
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        console.error("AI_INTEGRATIONS_OPENAI_API_KEY \u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E");
        return res.status(500).json({
          message: "AI\u670D\u52A1\u914D\u7F6E\u9519\u8BEF\uFF1A\u7F3A\u5C11API\u5BC6\u94A5",
          debug: "\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u73AF\u5883\u53D8\u91CF\u914D\u7F6E"
        });
      }
      const { generateOKRAnalysis: generateOKRAnalysis2, streamOKRAnalysis: streamOKRAnalysis2 } = await Promise.resolve().then(() => (init_ai_analysis(), ai_analysis_exports));
      const allDepts = await getDepartments();
      let allObjs = await getObjectivesForUser(user);
      allObjs = allObjs.filter((o) => o.cycle === cycle);
      if (departmentId) {
        allObjs = allObjs.filter((o) => o.departmentId === departmentId);
      }
      const objIds = allObjs.map((o) => o.id);
      const allKRs = objIds.length > 0 ? await getKeyResultsForObjectives(objIds) : [];
      if (allObjs.length === 0) {
        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.write(`data: ${JSON.stringify({ content: "\u8BE5\u5468\u671F\u6682\u65E0OKR\u6570\u636E\uFF0C\u65E0\u6CD5\u751F\u6210\u5206\u6790\u62A5\u544A\u3002" })}

`);
          res.write(`data: ${JSON.stringify({ done: true })}

`);
          res.end();
          return;
        } else {
          return res.json({ analysis: "\u8BE5\u5468\u671F\u6682\u65E0OKR\u6570\u636E\uFF0C\u65E0\u6CD5\u751F\u6210\u5206\u6790\u62A5\u544A\u3002" });
        }
      }
      const deptName = departmentId ? allDepts.find((d) => d.id === departmentId)?.name : void 0;
      const analysisData = {
        objectives: allObjs,
        keyResults: allKRs,
        departments: allDepts,
        cycle,
        departmentName: deptName
      };
      await audit(req, { actor: user, action: "analytics.ai_analysis", resourceType: "analytics", changes: { cycle, departmentId, objectiveCount: allObjs.length, stream } });
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        try {
          for await (const chunk of streamOKRAnalysis2(analysisData)) {
            res.write(`data: ${JSON.stringify({ content: chunk })}

`);
          }
          res.write(`data: ${JSON.stringify({ done: true })}

`);
          res.end();
        } catch (streamError) {
          console.error("Stream error:", streamError);
          if (!res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: "AI\u5206\u6790\u8FC7\u7A0B\u4E2D\u51FA\u73B0\u9519\u8BEF" })}

`);
            res.end();
          }
        }
      } else {
        const analysis = await generateOKRAnalysis2(analysisData);
        return res.json({ analysis });
      }
    } catch (err) {
      console.error("AI analysis error:", err);
      if (err.message && err.message.includes("AI_INTEGRATIONS_OPENAI_API_KEY")) {
        return res.status(500).json({
          message: "AI\u670D\u52A1\u914D\u7F6E\u9519\u8BEF",
          debug: err.message
        });
      }
      return res.status(500).json({
        message: "AI \u5206\u6790\u751F\u6210\u5931\u8D25",
        debug: process.env.NODE_ENV === "development" ? err.message : void 0
      });
    }
  });
  app2.get("/api/kr-comments/:krId", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      if (!await getReadableKeyResult(user, req.params.krId)) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
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
      const { krId, content, mentionedUserIds } = parseBody(commentBodySchema, req.body);
      const mentions = mentionedUserIds || [];
      const resource = await getReadableKeyResult(user, krId);
      if (!resource) return res.status(404).json({ message: "\u5173\u952E\u7ED3\u679C\u4E0D\u5B58\u5728" });
      const comment = await createComment({
        krId,
        userId: user.id,
        userName: user.displayName,
        content,
        mentionedUserIds: mentions
      });
      if (mentions.length > 0) {
        const obj = resource.objective;
        for (const mentionedId of mentions) {
          if (mentionedId !== user.id) {
            await createNotification({
              userId: mentionedId,
              type: "comment_mention",
              title: `${user.displayName} \u5728\u8BC4\u8BBA\u4E2D\u63D0\u5230\u4E86\u4F60`,
              content: content.substring(0, 100),
              relatedKrId: krId,
              relatedObjectiveId: obj?.id,
              fromUserId: user.id,
              fromUserName: user.displayName
            });
          }
        }
      }
      await audit(req, { actor: user, action: "comment.create", resourceType: "comment", resourceId: comment.id, changes: { krId, mentionedUserIds: mentions } });
      return res.json(comment);
    } catch (err) {
      return routeError(res, err, "\u53D1\u9001\u8BC4\u8BBA\u5931\u8D25");
    }
  });
  app2.delete("/api/kr-comments/:id", requireAuth, async (req, res) => {
    try {
      const user = await getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "\u7528\u6237\u4E0D\u5B58\u5728" });
      const comment = await getComment(req.params.id);
      if (!comment || comment.userId !== user.id && user.role !== "super_admin") return res.status(404).json({ message: "\u8BC4\u8BBA\u4E0D\u5B58\u5728" });
      await deleteComment(req.params.id);
      await audit(req, { actor: user, action: "comment.delete", resourceType: "comment", resourceId: req.params.id, changes: { krId: comment.krId } });
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
      const notification = await getNotification(req.params.id);
      if (!notification || notification.userId !== req.session.userId) return res.status(404).json({ message: "\u901A\u77E5\u4E0D\u5B58\u5728" });
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
      const actor = await getUser(req.session.userId);
      const { keyResults: keyResults2, objectives: objectives2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { eq: eq2 } = await import("drizzle-orm");
      const deletedKRs = await db2.delete(keyResults2).returning();
      const deletedObjectives = await db2.delete(objectives2).returning();
      await audit(req, { actor, action: "okr.clear_all", resourceType: "okr", changes: { deletedObjectives: deletedObjectives.length, deletedKRs: deletedKRs.length } });
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
  app2.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    const logs = await getAuditLogs({
      actorId: typeof req.query.actorId === "string" ? req.query.actorId : void 0,
      action: typeof req.query.action === "string" ? req.query.action : void 0,
      resourceType: typeof req.query.resourceType === "string" ? req.query.resourceType : void 0,
      success: req.query.success === "true" ? true : req.query.success === "false" ? false : void 0,
      from: typeof req.query.from === "string" && !Number.isNaN(Date.parse(req.query.from)) ? new Date(req.query.from) : void 0,
      to: typeof req.query.to === "string" && !Number.isNaN(Date.parse(req.query.to)) ? new Date(req.query.to) : void 0,
      limit: typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : void 0
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json(logs);
  });
  app2.get("/api/admin/audit-logs/export", requireAdmin, async (req, res) => {
    const logs = await getAuditLogs({ limit: 1e3 });
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["\u65F6\u95F4", "\u8BF7\u6C42ID", "\u64CD\u4F5C\u8005", "\u89D2\u8272", "\u64CD\u4F5C", "\u8D44\u6E90\u7C7B\u578B", "\u8D44\u6E90ID", "IP", "\u7ED3\u679C", "\u9519\u8BEF\u7801"],
      ...logs.map((log2) => [log2.createdAt?.toISOString(), log2.requestId, log2.actorUsername, log2.actorRole, log2.action, log2.resourceType, log2.resourceId, log2.ipAddress, log2.success ? "\u6210\u529F" : "\u5931\u8D25", log2.errorCode])
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=audit_logs.csv");
    res.setHeader("Cache-Control", "no-store");
    return res.send(csv);
  });
  app2.post("/api/admin/audit-logs/cleanup", requireAdmin, async (req, res) => {
    const actor = await getUser(req.session.userId);
    const deleted = await deleteExpiredAuditLogs(180);
    await audit(req, { actor, action: "audit.cleanup", resourceType: "audit_log", changes: { deleted, retentionDays: 180 } });
    return res.json({ deleted });
  });
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { X509Certificate } from "node:crypto";
import helmet from "helmet";

// server/tls.ts
function parsePublicHttpsOrigin(value) {
  const origin = new URL(value);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error("PUBLIC_HTTPS_ORIGIN must be an HTTPS origin without path, query, fragment or credentials");
  }
  return origin;
}
function buildHttpsRedirect(publicOrigin, requestUrl) {
  const requestTarget = new URL(requestUrl || "/", "http://invalid.local");
  return new URL(`${requestTarget.pathname}${requestTarget.search}`, publicOrigin).toString();
}

// server/index.ts
var runtimeMode = (process.env.NODE_ENV || "development").trim();
if (runtimeMode !== "development" && runtimeMode !== "production") {
  throw new Error("NODE_ENV must be either development or production");
}
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
    if (process.env.PUBLIC_HTTPS_ORIGIN) {
      origins.add(process.env.PUBLIC_HTTPS_ORIGIN.replace(/\/$/, ""));
    }
    if (process.env.EXPO_PUBLIC_ORIGIN) {
      origins.add(process.env.EXPO_PUBLIC_ORIGIN.replace(/\/$/, ""));
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    const isAllowed = !origin || origins.has(origin) || process.env.NODE_ENV !== "production" && isLocalhost;
    if (!isAllowed) return res.status(403).json({ message: "\u8BF7\u6C42\u6765\u6E90\u4E0D\u53D7\u4FE1\u4EFB" });
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, X-Request-Id");
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
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      log(JSON.stringify({
        level: "info",
        event: "http_request",
        requestId: req.requestId,
        method: req.method,
        path: path3,
        statusCode: res.statusCode,
        durationMs: duration
      }));
    });
    next();
  });
}
function setupSecurityHeaders(app2) {
  const isProd = process.env.NODE_ENV === "production";
  app2.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        // HTTP is supported only for development and internal testing.
        "upgrade-insecure-requests": isProd ? [] : null
      }
    },
    hsts: isProd ? { maxAge: 31536e3, includeSubDomains: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  }));
  app2.use("/api/auth", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app2.use("/api/admin", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
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
  app.use(requestIdMiddleware);
  setupSecurityHeaders(app);
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  await registerRoutes(app);
  await seedDatabase();
  setupErrorHandler(app);
  const cleanupTimer = setInterval(() => {
    deleteExpiredAuditLogs(180).catch((error) => console.error("Audit retention cleanup failed:", error));
  }, 24 * 60 * 60 * 1e3);
  cleanupTimer.unref();
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const port = parseInt(process.env.PORT || "5000", 10);
    createHttpServer(app).listen({ port, host: "0.0.0.0" }, () => {
      log(`development HTTP server listening on port ${port}`);
    });
    return;
  }
  const certPath = process.env.HTTPS_CERT_PATH;
  const keyPath = process.env.HTTPS_KEY_PATH;
  const publicOrigin = process.env.PUBLIC_HTTPS_ORIGIN;
  if (!certPath || !keyPath || !publicOrigin) {
    throw new Error("HTTPS_CERT_PATH, HTTPS_KEY_PATH and PUBLIC_HTTPS_ORIGIN are required in production");
  }
  const parsedOrigin = parsePublicHttpsOrigin(publicOrigin);
  if (process.platform !== "win32" && (fs2.statSync(keyPath).mode & 63) !== 0) {
    throw new Error("HTTPS private key must not be readable by group or other users");
  }
  const cert = fs2.readFileSync(certPath, "utf8");
  const key = fs2.readFileSync(keyPath, "utf8");
  const certificate = new X509Certificate(cert);
  const expiresInDays = Math.floor((Date.parse(certificate.validTo) - Date.now()) / (24 * 60 * 60 * 1e3));
  if (expiresInDays <= 0) throw new Error("HTTPS certificate is expired");
  if (expiresInDays < 30) console.warn(`HTTPS certificate expires in ${expiresInDays} days`);
  const httpsPort = parseInt(process.env.HTTPS_PORT || "5000", 10);
  const httpPort = parseInt(process.env.HTTP_PORT || "5001", 10);
  createHttpsServer({ cert, key, minVersion: "TLSv1.2" }, app).listen({ port: httpsPort, host: "0.0.0.0" }, () => {
    log(`production HTTPS server listening on port ${httpsPort}`);
  });
  createHttpServer((req, res) => {
    const target = buildHttpsRedirect(parsedOrigin, req.url);
    res.writeHead(308, { Location: target, "Cache-Control": "no-store" });
    res.end();
  }).listen({ port: httpPort, host: "0.0.0.0" }, () => {
    log(`HTTP redirect server listening on port ${httpPort}`);
  });
})();
