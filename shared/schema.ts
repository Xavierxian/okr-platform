import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password"),
  authProvider: text("auth_provider").notNull().default("dingtalk"),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("member"),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  dingtalkUserId: text("dingtalk_user_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const departments = pgTable("departments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
  level: integer("level").notNull().default(0),
});

export const userDepartments = pgTable("user_departments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("user_departments_user_department_unique").on(table.userId, table.departmentId),
  index("user_departments_user_idx").on(table.userId),
  index("user_departments_department_idx").on(table.departmentId),
]);

export const cycles = pgTable("cycles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const objectives = pgTable("objectives", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "restrict" }),
  cycle: text("cycle").notNull(),
  parentObjectiveId: varchar("parent_objective_id"),
  status: text("status").notNull().default("active"),
  isCollaborative: boolean("is_collaborative").notNull().default(false),
  collaborativeDeptIds: jsonb("collaborative_dept_ids").$type<string[]>().default([]),
  collaborativeUserIds: jsonb("collaborative_user_ids").$type<string[]>().default([]),
  linkedToParent: boolean("linked_to_parent").notNull().default(false),
  okrType: text("okr_type").notNull().default("承诺型"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("objectives_department_idx").on(table.departmentId),
  index("objectives_created_by_idx").on(table.createdBy),
  index("objectives_cycle_idx").on(table.cycle),
]);

export const keyResults = pgTable("key_results", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  okrType: text("okr_type").notNull().default("承诺型"),
  selfScore: real("self_score"),
  selfScoreNote: text("self_score_note").notNull().default(""),
  progressHistory: jsonb("progress_history").$type<ProgressEntry[]>().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("key_results_objective_idx").on(table.objectiveId),
  index("key_results_assignee_idx").on(table.assigneeId),
  index("key_results_collaborator_idx").on(table.collaboratorId),
  check("key_results_progress_check", sql`${table.progress} between 0 and 100`),
  check("key_results_weight_check", sql`${table.weight} > 0`),
  check("key_results_self_score_check", sql`${table.selfScore} is null or (${table.selfScore} >= 0 and ${table.selfScore} <= 1)`),
]);

export const krComments = pgTable("kr_comments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  krId: varchar("kr_id").notNull().references(() => keyResults.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  content: text("content").notNull(),
  mentionedUserIds: jsonb("mentioned_user_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("kr_comments_kr_idx").on(table.krId),
  index("kr_comments_user_idx").on(table.userId),
]);

export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("comment_mention"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  relatedKrId: varchar("related_kr_id").references(() => keyResults.id, { onDelete: "set null" }),
  relatedObjectiveId: varchar("related_objective_id").references(() => objectives.id, { onDelete: "set null" }),
  fromUserId: varchar("from_user_id").references(() => users.id, { onDelete: "set null" }),
  fromUserName: text("from_user_name"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("notifications_user_read_idx").on(table.userId, table.isRead),
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  actorId: varchar("actor_id"),
  actorUsername: text("actor_username"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  changes: jsonb("changes").$type<Record<string, unknown>>().default({}),
  success: boolean("success").notNull(),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("audit_logs_created_at_idx").on(table.createdAt),
  index("audit_logs_actor_idx").on(table.actorId),
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
]);

export interface ProgressEntry {
  id: string;
  date: string;
  progress: number;
  note: string;
  images?: string[];
}

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  role: true,
  departmentId: true,
  authProvider: true,
  dingtalkUserId: true,
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserDepartment = typeof userDepartments.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Cycle = typeof cycles.$inferSelect;
export type Objective = typeof objectives.$inferSelect;
export type KeyResult = typeof keyResults.$inferSelect;
export type KRComment = typeof krComments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
