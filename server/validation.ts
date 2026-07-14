import { z } from "zod";

const id = z.string().min(1).max(128);
const shortText = z.string().trim().min(1).max(300);
const optionalText = z.string().trim().max(5000).optional().default("");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD");
const role = z.enum(["member", "center_head", "vp", "super_admin"]);
const okrType = z.enum(["承诺型", "挑战型"]);

export const strongPasswordSchema = z.string().min(8).max(128).refine((value) => {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
  return classes.filter((pattern) => pattern.test(value)).length >= 3;
}, "密码至少8位，并包含大小写字母、数字、符号中的至少三类");

export const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(128),
}).strict();

export const dingtalkLoginBodySchema = z.object({ authCode: z.string().min(1).max(2048) }).strict();

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPasswordSchema,
}).strict();

export const createUserBodySchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  role: role.exclude(["super_admin"]).default("member"),
  departmentId: id.nullable().optional(),
  departmentIds: z.array(id).max(50).optional(),
  dingtalkUserId: z.string().trim().min(1).max(256),
}).strict();

export const updateUserBodySchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  role: role.exclude(["super_admin"]).optional(),
  departmentIds: z.array(id).max(50).optional(),
}).strict();

export const departmentBodySchema = z.object({
  name: shortText,
  parentId: id.nullable().optional(),
  level: z.number().int().min(0).max(10).optional(),
}).strict();

export const cycleBodySchema = z.object({
  name: shortText,
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict();

export const objectiveCreateBodySchema = z.object({
  title: shortText,
  description: optionalText,
  departmentId: id,
  cycle: shortText,
  parentObjectiveId: id.nullable().optional(),
  isCollaborative: z.boolean().optional().default(false),
  collaborativeDeptIds: z.array(id).max(100).optional().default([]),
  collaborativeUserIds: z.array(id).max(100).optional().default([]),
  linkedToParent: z.boolean().optional().default(false),
  okrType: okrType.optional().default("承诺型"),
}).strict();

export const objectiveUpdateBodySchema = objectiveCreateBodySchema.partial().strict();

const keyResultBodyBaseSchema = z.object({
  objectiveId: id,
  title: shortText,
  description: optionalText,
  assigneeId: id.nullable().optional(),
  assigneeName: z.string().trim().max(100).optional().default(""),
  collaboratorId: id.nullable().optional(),
  collaboratorName: z.string().trim().max(100).optional().default(""),
  startDate: isoDate,
  endDate: isoDate,
  weight: z.number().positive().max(100).optional().default(1),
  okrType: okrType.optional().default("承诺型"),
}).strict();

export const keyResultCreateBodySchema = keyResultBodyBaseSchema.refine((value) => value.startDate <= value.endDate, {
  message: "截止日期不能早于开始日期",
  path: ["endDate"],
});

export const keyResultUpdateBodySchema = keyResultBodyBaseSchema.omit({ objectiveId: true }).partial().strict();

export const reorderBodySchema = z.object({
  orders: z.array(z.object({ id, sortOrder: z.number().int().min(0).max(100000) }).strict()).max(1000),
}).strict();

export const progressBodySchema = z.object({
  progress: z.number().int().min(0).max(100),
  note: z.string().trim().min(1).max(5000),
  images: z.array(z.string().max(2048)).max(20).optional(),
  entryId: z.string().max(128).optional(),
}).strict();

export const scoreBodySchema = z.object({
  score: z.number().min(0).max(1),
  note: z.string().trim().max(5000).optional().default(""),
}).strict();

export const commentBodySchema = z.object({
  krId: id,
  content: z.string().trim().min(1).max(5000),
  mentionedUserIds: z.array(id).max(100).optional().default([]),
}).strict();

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const error = new Error(result.error.issues[0]?.message || "请求数据无效") as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  return result.data;
}
