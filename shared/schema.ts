import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("member"),
  departmentId: varchar("department_id"),
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
  userId: varchar("user_id").notNull(),
  departmentId: varchar("department_id").notNull(),
});

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
  departmentId: varchar("department_id").notNull(),
  cycle: text("cycle").notNull(),
  parentObjectiveId: varchar("parent_objective_id"),
  status: text("status").notNull().default("active"),
  isCollaborative: boolean("is_collaborative").notNull().default(false),
  collaborativeDeptIds: jsonb("collaborative_dept_ids").$type<string[]>().default([]),
  collaborativeUserIds: jsonb("collaborative_user_ids").$type<string[]>().default([]),
  linkedToParent: boolean("linked_to_parent").notNull().default(false),
  okrType: text("okr_type").notNull().default("承诺型"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const keyResults = pgTable("key_results", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  okrType: text("okr_type").notNull().default("承诺型"),
  selfScore: real("self_score"),
  selfScoreNote: text("self_score_note").notNull().default(""),
  progressHistory: jsonb("progress_history").$type<ProgressEntry[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export interface ProgressEntry {
  id: string;
  date: string;
  progress: number;
  note: string;
}

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  role: true,
  departmentId: true,
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
