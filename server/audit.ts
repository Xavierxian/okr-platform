import type { Request } from "express";
import type { User } from "@shared/schema";
import { createAuditLog } from "./storage";

const SENSITIVE_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "csrfToken",
  "cookie",
  "session",
  "secret",
  "key",
  "certificate",
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitize);
  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEYS.has(key))
      .map(([key, entry]) => [key, sanitize(entry)]),
  );
}

export async function audit(
  req: Request,
  data: {
    actor?: User | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    changes?: Record<string, unknown>;
    success?: boolean;
    errorCode?: string | null;
  },
): Promise<void> {
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
      changes: sanitize(data.changes || {}) as Record<string, unknown>,
      success: data.success ?? true,
      errorCode: data.errorCode || null,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "audit_write_failed",
      requestId: req.requestId,
      message: error instanceof Error ? error.message : "unknown",
    }));
  }
}

