import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
    oauthState?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const loginFailures = new Map<string, { count: number; blockedUntil: number; lastFailure: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

function loginKeys(req: Request): string[] {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "unknown";
  return [`ip:${req.ip}`, `account:${username}`];
}

function cleanupLoginFailures(now: number) {
  for (const [key, value] of loginFailures) {
    if (value.blockedUntil < now && now - value.lastFailure > LOGIN_WINDOW_MS) {
      loginFailures.delete(key);
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  req.requestId = incoming && /^[A-Za-z0-9._-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const configured = [process.env.PUBLIC_HTTPS_ORIGIN, process.env.EXPO_PUBLIC_ORIGIN]
    .filter((value): value is string => !!value)
    .map((value: string) => value.replace(/\/$/, ""));
  configured.forEach((origin) => origins.add(origin));
  if (process.env.REPLIT_DEV_DOMAIN) origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  if (process.env.REPLIT_DOMAINS) {
    process.env.REPLIT_DOMAINS.split(",").map((value: string) => value.trim()).filter(Boolean)
      .forEach((domain: string) => origins.add(`https://${domain}`));
  }
  return origins;
}

export function originGuard(req: Request, res: Response, next: NextFunction) {
  const origin = req.header("origin");
  if (!origin) return next();
  const isDevelopmentLocal = process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (isDevelopmentLocal || allowedOrigins().has(origin)) return next();
  return res.status(403).json({ message: "请求来源不受信任" });
}

export function issueCsrfToken(req: Request, res: Response) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString("hex");
  return res.json({ csrfToken: req.session.csrfToken });
}

export function issueOauthState(req: Request): string {
  const state = randomBytes(32).toString("hex");
  req.session.oauthState = state;
  return state;
}

export function consumeOauthState(req: Request, supplied: string | undefined): boolean {
  const expected = req.session.oauthState;
  delete req.session.oauthState;
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const expected = req.session.csrfToken;
  const supplied = req.header("x-csrf-token");
  if (!expected || !supplied) return res.status(403).json({ message: "CSRF 校验失败" });
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(403).json({ message: "CSRF 校验失败" });
  }
  next();
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  cleanupLoginFailures(now);
  const blocked = loginKeys(req).some((key) => (loginFailures.get(key)?.blockedUntil || 0) > now);
  if (blocked) {
    res.setHeader("Retry-After", Math.ceil(LOGIN_BLOCK_MS / 1000));
    return res.status(429).json({ message: "登录尝试过多，请稍后再试" });
  }
  next();
}

export function recordLoginFailure(req: Request) {
  const now = Date.now();
  for (const key of loginKeys(req)) {
    const current = loginFailures.get(key);
    const count = current && now - current.lastFailure <= LOGIN_WINDOW_MS ? current.count + 1 : 1;
    loginFailures.set(key, {
      count,
      lastFailure: now,
      blockedUntil: count >= LOGIN_MAX_FAILURES ? now + LOGIN_BLOCK_MS : 0,
    });
  }
}

export function clearLoginFailures(req: Request) {
  loginKeys(req).forEach((key) => loginFailures.delete(key));
}

export function regenerateSession(req: Request): Promise<void> {
  const csrfToken = req.session.csrfToken;
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.csrfToken = csrfToken || randomBytes(32).toString("hex");
      resolve();
    });
  });
}
