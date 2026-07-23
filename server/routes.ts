import type { Express, Request as ExpressRequest, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { uploadFile } from "./file-upload";
import {
  getUser, getUserByUsername, createUser, updateUser, deleteUser, getAllUsers, verifyPassword,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getObjectivesForUser, getAllObjectives, createObjectiveInDb, updateObjectiveInDb, deleteObjectiveInDb,
  getKeyResultsForObjectives, getAllKeyResults, createKeyResultInDb, updateKeyResultInDb, deleteKeyResultInDb,
  updateKRProgressInDb, scoreKRInDb, getUsersByDepartment,
  getKRsAssignedToUser, getKRsCollaboratingUser,
  getCycles, createCycle, updateCycle, deleteCycle,
  getUserDepartmentIds, setUserDepartments, getAllUserDepartments,
  getCommentsForKR, createComment, deleteComment,
  getNotificationsForUser, createNotification, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount,
  getUserByDingtalkId, getObjective, getKeyResult, getComment, getNotification,
  getAuditLogs, deleteExpiredAuditLogs,
} from "./storage";
import {
  isDingtalkConfigured,
  getUserInfoByAuthCode,
  getDepartmentList,
  getAllDingtalkUsers,
  getDingtalkCorpId,
  getDingtalkAppKey,
  getCenterDepartmentInfo,
} from "./dingtalk";
import {
  canManageObjective,
  canScoreKeyResult,
  canUpdateKeyResultProgress,
  getManageableKeyResult,
  getManageableObjective,
  getReadableKeyResult,
  getReadableObjective,
} from "./authorization";
import {
  changePasswordBodySchema,
  commentBodySchema,
  createUserBodySchema,
  cycleBodySchema,
  departmentBodySchema,
  dingtalkLoginBodySchema,
  keyResultCreateBodySchema,
  keyResultUpdateBodySchema,
  loginBodySchema,
  objectiveCreateBodySchema,
  objectiveUpdateBodySchema,
  parseBody,
  progressBodySchema,
  reorderBodySchema,
  scoreBodySchema,
  updateUserBodySchema,
} from "./validation";
import {
  clearLoginFailures,
  consumeOauthState,
  csrfProtection,
  issueCsrfToken,
  issueOauthState,
  loginRateLimit,
  originGuard,
  recordLoginFailure,
  regenerateSession,
} from "./security";
import { audit } from "./audit";

type Request = ExpressRequest<Record<string, string>>;
const DUMMY_PASSWORD_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.8jNOM7Z5GvHyk1Iko9pZPZfK7w4M1mK";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

async function readRawBody(req: Request, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      const error = new Error("请求体过大") as Error & { status?: number };
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function detectImageType(buffer: Buffer): { contentType: string; extension: string } | undefined {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return { contentType: "image/gif", extension: "gif" };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return undefined;
}

function routeError(res: Response, error: unknown, fallbackMessage: string) {
  const status = typeof error === "object" && error && "status" in error
    ? Number((error as { status?: number }).status)
    : 500;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ message: error instanceof Error ? error.message : fallbackMessage });
  }
  return res.status(500).json({ message: fallbackMessage });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "未登录" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "未登录" });
  }
  const user = await getUser(req.session.userId);
  if (!user || user.role !== "super_admin") {
    return res.status(403).json({ message: "权限不足" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<void> {
  const PgStore = connectPgSimple(session);
  const isProd = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET;
  if (isProd && !sessionSecret) {
    throw new Error("SESSION_SECRET is required in production");
  }

  const sessionMiddleware = session({
    store: new PgStore({
      pool: pool as any,
      createTableIfMissing: true,
    }),
    secret: sessionSecret || "development-only-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
    },
  });

  app.use("/api", sessionMiddleware);
  app.use("/api", originGuard);
  app.get("/api/auth/csrf-token", issueCsrfToken);
  app.use("/api", csrfProtection);

  app.post("/api/auth/login", loginRateLimit, async (req: Request, res: Response) => {
    try {
      const { username, password } = parseBody(loginBodySchema, req.body);
      const user = await getUserByUsername(username);
      // Any account with a password may use local login. DingTalk-only accounts
      // have no password and therefore continue to require DingTalk authentication.
      const eligible = !!user?.password;
      const passwordMatches = await verifyPassword(password, eligible ? user.password! : DUMMY_PASSWORD_HASH);
      const valid = eligible && passwordMatches;
      if (!valid) {
        recordLoginFailure(req);
        await audit(req, { actor: user, action: "auth.login", resourceType: "session", success: false, errorCode: "INVALID_CREDENTIALS" });
        return res.status(401).json({ message: "用户名或密码错误" });
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
      return routeError(res, err, "登录失败");
    }
  });

  app.get("/api/auth/dingtalk-config", (req: Request, res: Response) => {
    if (!isDingtalkConfigured()) {
      return res.json({ enabled: false });
    }
    return res.json({
      enabled: true,
      corpId: getDingtalkCorpId(),
      appKey: getDingtalkAppKey(),
      state: issueOauthState(req),
    });
  });

  async function syncDingtalkUserDept(userId: string, dtDeptIdList?: number[]) {
    if (!dtDeptIdList || dtDeptIdList.length === 0) return;
    try {
      console.log(`[DT Sync] userId=${userId}, dtDeptIdList=${JSON.stringify(dtDeptIdList)}`);
      const knownDepts = [...await getDepartments()];
      const resolvedDeptIds = new Set<string>();
      for (const dtDeptId of dtDeptIdList) {
        console.log(`[DT Sync] Resolving dept_id=${dtDeptId}`);
        const deptInfo = await getCenterDepartmentInfo(dtDeptId);
        console.log(`[DT Sync] dept_id=${dtDeptId} -> deptInfo=${JSON.stringify(deptInfo)}`);
        if (!deptInfo?.centerName) continue;

        let companyDept = null as typeof knownDepts[number] | null;
        if (deptInfo.companyName) {
          companyDept = knownDepts.find(d => d.name === deptInfo.companyName && !d.parentId) || null;
          if (!companyDept) {
            companyDept = await createDepartment({ name: deptInfo.companyName, parentId: null, level: 0 });
            knownDepts.push(companyDept);
          }
        }

        const targetParentId = companyDept?.id || null;
        const targetLevel = targetParentId ? 1 : 0;
        let centerDept = knownDepts.find(d => d.name === deptInfo.centerName && d.parentId === targetParentId);

        if (!centerDept) {
          centerDept = knownDepts.find(d => d.name === deptInfo.centerName);
          if (centerDept) {
            await updateDepartment(centerDept.id, { parentId: targetParentId, level: targetLevel });
            centerDept.parentId = targetParentId;
            centerDept.level = targetLevel;
          } else {
            centerDept = await createDepartment({
              name: deptInfo.centerName,
              parentId: targetParentId,
              level: targetLevel,
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
      console.error("同步钉钉用户部门失败:", err);
    }
  }

  app.post("/api/auth/dingtalk-login", async (req: Request, res: Response) => {
    try {
      if (!isDingtalkConfigured()) {
        return res.status(400).json({ message: "钉钉登录未配置" });
      }
      const { authCode } = parseBody(dingtalkLoginBodySchema, req.body);

      const dtUser = await getUserInfoByAuthCode(authCode);
      let user = await getUserByDingtalkId(dtUser.userid);
      if (user?.role === "super_admin") return res.status(403).json({ message: "管理员账号只能使用本地密码登录" });

      if (!user) {
        const newUser = await createUser({
          username: `dt_${dtUser.userid}`,
          password: null,
          authProvider: "dingtalk",
          displayName: dtUser.name,
          role: "member",
          departmentId: null,
          dingtalkUserId: dtUser.userid,
        });
        user = newUser;
        await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
      } else {
        await syncDingtalkUserDept(user.id, dtUser.dept_id_list);
      }

      await regenerateSession(req);
      req.session.userId = user!.id;
      const { password: _, ...safeUser } = user!;
      const deptIds = await getUserDepartmentIds(user!.id);
      await audit(req, { actor: user, action: "auth.dingtalk_login", resourceType: "session" });
      return res.json({ user: { ...safeUser, departmentIds: deptIds } });
    } catch (err: any) {
      console.error("DingTalk login error:", err);
      return res.status(500).json({ message: err?.message || "钉钉登录失败" });
    }
  });

  app.post("/api/dingtalk/sync-org", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (!isDingtalkConfigured()) {
        return res.status(400).json({ message: "钉钉未配置" });
      }

      const dtDepts = await getDepartmentList();
      const dtUsers = await getAllDingtalkUsers();
      const actor = await getUser(req.session.userId!);
      const existingDepts = await getDepartments();
      const existingUsers = await getAllUsers();

      let syncedDepts = 0;
      let syncedUsers = 0;
      const deptIdMap = new Map<number, string>();
      const knownDepts = [...existingDepts];
      const pendingDepts = [...dtDepts];

      while (pendingDepts.length > 0) {
        let progressed = false;

        for (let i = pendingDepts.length - 1; i >= 0; i--) {
          const dtDept = pendingDepts[i];
          const parentLocalId = dtDept.parent_id > 1 ? (deptIdMap.get(dtDept.parent_id) || null) : null;

          if (dtDept.parent_id > 1 && !parentLocalId) {
            continue;
          }

          const targetLevel = parentLocalId ? 1 : 0;
          const existing = knownDepts.find(d => d.name === dtDept.name && d.parentId === parentLocalId);

          if (existing) {
            if (existing.level !== targetLevel || existing.parentId !== parentLocalId) {
              await updateDepartment(existing.id, { parentId: parentLocalId, level: targetLevel });
            }
            deptIdMap.set(dtDept.dept_id, existing.id);
          } else {
            const fallback = knownDepts.find(d => d.name === dtDept.name && (!d.parentId || d.parentId !== parentLocalId));
            if (fallback) {
              await updateDepartment(fallback.id, { parentId: parentLocalId, level: targetLevel });
              fallback.parentId = parentLocalId;
              fallback.level = targetLevel;
              deptIdMap.set(dtDept.dept_id, fallback.id);
            } else {
              const newDept = await createDepartment({
                name: dtDept.name,
                parentId: parentLocalId,
                level: targetLevel,
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
          console.warn("[DT Sync] Some departments could not be resolved with parent relationships:", pendingDepts.map(d => ({ dept_id: d.dept_id, name: d.name, parent_id: d.parent_id })));
          break;
        }
      }

      for (const dtUser of dtUsers) {
        const existingUser = existingUsers.find(u => u.dingtalkUserId === dtUser.userid);

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
            dingtalkUserId: dtUser.userid,
          });
          await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
          syncedUsers++;
        }
      }

      await audit(req, { actor, action: "dingtalk.sync_org", resourceType: "organization", changes: { syncedDepts, syncedUsers } });
      return res.json({
        message: `同步完成: 新增 ${syncedDepts} 个部门, ${syncedUsers} 个用户`,
        syncedDepts,
        syncedUsers,
      });
    } catch (err: any) {
      console.error("Org sync error:", err);
      return res.status(500).json({ message: err?.message || "同步失败" });
    }
  });

  app.get("/api/auth/dingtalk-callback", async (req: Request, res: Response) => {
    try {
      const authCode = req.query.authCode as string || req.query.code as string;
      const state = typeof req.query.state === "string" ? req.query.state : undefined;
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
          dingtalkUserId: dtUser.userid,
        });
        user = newUser;
        await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
      } else {
        await syncDingtalkUserDept(user.id, dtUser.dept_id_list);
      }
      await regenerateSession(req);
      req.session.userId = user!.id;
      await audit(req, { actor: user, action: "auth.dingtalk_callback", resourceType: "session" });
      return res.redirect("/");
    } catch (err) {
      console.error("DingTalk callback error:", err);
      return res.redirect("/?dt_error=1");
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const user = req.session.userId ? await getUser(req.session.userId) : undefined;
    await audit(req, { actor: user, action: "auth.logout", resourceType: "session" });
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "退出失败" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "已退出" });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "未登录" });
    }
    const user = await getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "用户不存在" });
    }
    const { password: _, ...safeUser } = user;
    const deptIds = await getUserDepartmentIds(user.id);
    return res.json({ user: { ...safeUser, departmentIds: deptIds } });
  });

  app.put("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = parseBody(changePasswordBodySchema, req.body);
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      if (user.authProvider !== "local" || user.role !== "super_admin" || !user.password) {
        return res.status(403).json({ message: "该账号不支持密码登录" });
      }
      const valid = await verifyPassword(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "当前密码不正确" });
      await updateUser(user.id, { password: newPassword } as any);
      await audit(req, { actor: user, action: "auth.password_change", resourceType: "user", resourceId: user.id });
      return res.json({ message: "密码修改成功" });
    } catch (err) {
      return routeError(res, err, "修改密码失败");
    }
  });

  app.get("/api/departments", requireAuth, async (_req: Request, res: Response) => {
    const deps = await getDepartments();
    return res.json(deps);
  });

  app.post("/api/departments", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      const { name, parentId, level } = parseBody(departmentBodySchema, req.body);
      const dept = await createDepartment({ name, parentId: parentId || null, level: level || 0 });
      await audit(req, { actor, action: "department.create", resourceType: "department", resourceId: dept.id, changes: { name, parentId, level } });
      return res.json(dept);
    } catch (err) {
      return routeError(res, err, "创建部门失败");
    }
  });

  app.put("/api/departments/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      const updates = parseBody(departmentBodySchema.partial().strict(), req.body);
      const dept = await updateDepartment(req.params.id, updates);
      if (!dept) return res.status(404).json({ message: "部门不存在" });
      await audit(req, { actor, action: "department.update", resourceType: "department", resourceId: dept.id, changes: updates });
      return res.json(dept);
    } catch (err) {
      return routeError(res, err, "更新部门失败");
    }
  });

  app.delete("/api/departments/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      await deleteDepartment(req.params.id);
      await audit(req, { actor, action: "department.delete", resourceType: "department", resourceId: req.params.id });
      return res.json({ message: "已删除" });
    } catch (err) {
      return res.status(500).json({ message: "删除部门失败" });
    }
  });

  app.get("/api/cycles", requireAuth, async (_req: Request, res: Response) => {
    const all = await getCycles();
    return res.json(all);
  });

  app.post("/api/cycles", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      const { name, sortOrder } = parseBody(cycleBodySchema, req.body);
      const cycle = await createCycle(name, sortOrder ?? 0);
      await audit(req, { actor, action: "cycle.create", resourceType: "cycle", resourceId: cycle.id, changes: { name, sortOrder } });
      return res.json(cycle);
    } catch (err: any) {
      if (err?.code === '23505') return res.status(400).json({ message: "该周期名称已存在" });
      return routeError(res, err, "创建周期失败");
    }
  });

  app.put("/api/cycles/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      const updates = parseBody(cycleBodySchema.partial().strict(), req.body);
      const cycle = await updateCycle(req.params.id, updates);
      if (!cycle) return res.status(404).json({ message: "周期不存在" });
      await audit(req, { actor, action: "cycle.update", resourceType: "cycle", resourceId: cycle.id, changes: updates });
      return res.json(cycle);
    } catch (err: any) {
      if (err?.code === '23505') return res.status(400).json({ message: "该周期名称已存在" });
      return routeError(res, err, "更新周期失败");
    }
  });

  app.delete("/api/cycles/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      await deleteCycle(req.params.id);
      await audit(req, { actor, action: "cycle.delete", resourceType: "cycle", resourceId: req.params.id });
      return res.json({ message: "已删除" });
    } catch (err) {
      return res.status(500).json({ message: "删除周期失败" });
    }
  });

  app.get("/api/users", requireAdmin, async (_req: Request, res: Response) => {
    const all = await getAllUsers();
    const allUD = await getAllUserDepartments();
    const safe = all.map(({ password, ...u }) => ({
      ...u,
      departmentIds: allUD.filter(ud => ud.userId === u.id).map(ud => ud.departmentId),
    }));
    return res.json(safe);
  });

  app.post("/api/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      const { displayName, role, departmentId, departmentIds, dingtalkUserId } = parseBody(createUserBodySchema, req.body);
      const username = `dt_${dingtalkUserId}`;
      const existing = await getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "用户名已存在" });
      }
      const deptIds: string[] = departmentIds || (departmentId ? [departmentId] : []);
      const primaryDeptId = deptIds.length > 0 ? deptIds[0] : null;
      const user = await createUser({ username, password: null, authProvider: "dingtalk", dingtalkUserId, displayName, role, departmentId: primaryDeptId });
      if (deptIds.length > 0) {
        await setUserDepartments(user.id, deptIds);
      }
      const { password: _, ...safeUser } = user;
      await audit(req, { actor, action: "user.create", resourceType: "user", resourceId: user.id, changes: { username, displayName, role, departmentIds: deptIds, authProvider: "dingtalk" } });
      return res.json({ ...safeUser, departmentIds: deptIds });
    } catch (err) {
      return routeError(res, err, "创建用户失败");
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      const { departmentIds, ...rest } = parseBody(updateUserBodySchema, req.body);
      const userUpdates: Record<string, unknown> = { ...rest };
      if (departmentIds && Array.isArray(departmentIds)) {
        userUpdates.departmentId = departmentIds.length > 0 ? departmentIds[0] : null;
        await setUserDepartments(req.params.id, departmentIds);
      }
      const user = await updateUser(req.params.id, userUpdates as any);
      if (!user) return res.status(404).json({ message: "用户不存在" });
      const { password: _, ...safeUser } = user;
      const deptIds = departmentIds || await getUserDepartmentIds(user.id);
      await audit(req, { actor, action: "user.update", resourceType: "user", resourceId: user.id, changes: { ...rest, departmentIds } });
      return res.json({ ...safeUser, departmentIds: deptIds });
    } catch (err) {
      return routeError(res, err, "更新用户失败");
    }
  });

  app.get("/api/users/by-department/:deptId", requireAuth, async (req: Request, res: Response) => {
    try {
      const deptUsers = await getUsersByDepartment(req.params.deptId);
      const safe = deptUsers.map(({ password, ...u }) => u);
      return res.json(safe);
    } catch (err) {
      return res.status(500).json({ message: "获取部门用户失败" });
    }
  });

  app.get("/api/users/all-safe", requireAuth, async (_req: Request, res: Response) => {
    try {
      const all = await getAllUsers();
      const allUD = await getAllUserDepartments();
      const safe = all.map(({ password, ...u }) => ({
        ...u,
        departmentIds: allUD.filter(ud => ud.userId === u.id).map(ud => ud.departmentId),
      }));
      return res.json(safe);
    } catch (err) {
      return res.status(500).json({ message: "获取用户列表失败" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      if (req.params.id === req.session.userId) return res.status(400).json({ message: "不能删除当前登录账号" });
      await deleteUser(req.params.id);
      await audit(req, { actor, action: "user.delete", resourceType: "user", resourceId: req.params.id });
      return res.json({ message: "已删除" });
    } catch (err) {
      return res.status(500).json({ message: "删除用户失败" });
    }
  });

  app.get("/api/objectives", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const objs = await getObjectivesForUser(user);
      return res.json(objs);
    } catch (err) {
      return res.status(500).json({ message: "获取目标失败" });
    }
  });

  app.get("/api/objectives/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const obj = await getReadableObjective(user, req.params.id);
      if (!obj) return res.status(404).json({ message: "目标不存在" });
      const krs = await getKeyResultsForObjectives([obj.id]);
      return res.json({ objective: obj, keyResults: krs });
    } catch (err) {
      return res.status(500).json({ message: "获取目标失败" });
    }
  });

  app.post("/api/objectives", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const { title, description, departmentId, cycle, parentObjectiveId, isCollaborative, collaborativeDeptIds, collaborativeUserIds, linkedToParent, okrType } = parseBody(objectiveCreateBodySchema, req.body);
      if (user.role !== "super_admin") {
        const userDeptIds = await getUserDepartmentIds(user.id);
        const allowedDepts = userDeptIds.length > 0 ? userDeptIds : (user.departmentId ? [user.departmentId] : []);
        if (!allowedDepts.includes(departmentId)) {
          return res.status(403).json({ message: "只能为自己所属中心创建目标" });
        }
      }
      if (parentObjectiveId && !await getReadableObjective(user, parentObjectiveId)) {
        return res.status(404).json({ message: "上级目标不存在" });
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
        okrType: okrType || '承诺型',
      });
      await audit(req, { actor: user, action: "objective.create", resourceType: "objective", resourceId: obj.id, changes: { title, departmentId, cycle, parentObjectiveId, isCollaborative, collaborativeDeptIds, collaborativeUserIds, linkedToParent, okrType } });
      return res.json(obj);
    } catch (err) {
      return routeError(res, err, "创建目标失败");
    }
  });

  app.put("/api/objectives/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const existing = await getManageableObjective(user, req.params.id);
      if (!existing) return res.status(404).json({ message: "目标不存在" });
      const updates = parseBody(objectiveUpdateBodySchema, req.body);
      if (updates.departmentId && user.role !== "super_admin") {
        const departmentIds = await getUserDepartmentIds(user.id);
        const allowed = departmentIds.length ? departmentIds : (user.departmentId ? [user.departmentId] : []);
        if (!allowed.includes(updates.departmentId)) return res.status(403).json({ message: "不能将目标移动到其他中心" });
      }
      if (updates.parentObjectiveId && !await getReadableObjective(user, updates.parentObjectiveId)) {
        return res.status(404).json({ message: "上级目标不存在" });
      }
      const obj = await updateObjectiveInDb(req.params.id, updates);
      await audit(req, { actor: user, action: "objective.update", resourceType: "objective", resourceId: req.params.id, changes: updates });
      return res.json(obj);
    } catch (err) {
      return routeError(res, err, "更新目标失败");
    }
  });

  app.delete("/api/objectives/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      if (!await getManageableObjective(user, req.params.id)) return res.status(404).json({ message: "目标不存在" });
      await deleteObjectiveInDb(req.params.id);
      await audit(req, { actor: user, action: "objective.delete", resourceType: "objective", resourceId: req.params.id });
      return res.json({ message: "已删除" });
    } catch (err) {
      return res.status(500).json({ message: "删除目标失败" });
    }
  });

  app.get("/api/key-results", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const objs = await getObjectivesForUser(user);
      const objIds = objs.map(o => o.id);
      const krs = await getKeyResultsForObjectives(objIds);
      return res.json(krs);
    } catch (err) {
      return res.status(500).json({ message: "获取关键结果失败" });
    }
  });

  app.get("/api/key-results/assigned-to-me", requireAuth, async (req: Request, res: Response) => {
    try {
      const results = await getKRsAssignedToUser(req.session.userId!);
      return res.json(results);
    } catch (err) {
      return res.status(500).json({ message: "获取协同KR失败" });
    }
  });

  app.get("/api/key-results/collaborating", requireAuth, async (req: Request, res: Response) => {
    try {
      const results = await getKRsCollaboratingUser(req.session.userId!);
      return res.json(results);
    } catch (err) {
      return res.status(500).json({ message: "获取跨部门协同KR失败" });
    }
  });

  app.post("/api/key-results", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const { objectiveId, title, description, assigneeId, assigneeName, collaboratorId, collaboratorName, startDate, endDate, weight, okrType } = parseBody(keyResultCreateBodySchema, req.body);
      if (!await getManageableObjective(user, objectiveId)) return res.status(404).json({ message: "目标不存在" });
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
        okrType: okrType || '承诺型',
      });
      await audit(req, { actor: user, action: "key_result.create", resourceType: "key_result", resourceId: kr.id, changes: { objectiveId, title, assigneeId, collaboratorId, startDate, endDate, weight, okrType } });
      return res.json(kr);
    } catch (err) {
      return routeError(res, err, "创建关键结果失败");
    }
  });

  // Objective 排序 API - 必须在 /:id 路由之前定义
  app.put("/api/objectives/reorder", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const { orders } = parseBody(reorderBodySchema, req.body);
      for (const item of orders) {
        if (!await getManageableObjective(user, item.id)) return res.status(404).json({ message: "目标不存在" });
        await updateObjectiveInDb(item.id, { sortOrder: item.sortOrder });
      }
      await audit(req, { actor: user, action: "objective.reorder", resourceType: "objective", changes: { count: orders.length } });
      return res.json({ message: "排序已保存" });
    } catch (err: any) {
      console.error("Reorder Objective error:", err);
      return res.status(500).json({ message: err.message || "排序保存失败" });
    }
  });

  // KR 排序 API - 必须在 /:id 路由之前定义
  app.put("/api/key-results/reorder", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const { orders } = parseBody(reorderBodySchema, req.body);
      for (const item of orders) {
        if (!await getManageableKeyResult(user, item.id)) return res.status(404).json({ message: "关键结果不存在" });
        await updateKeyResultInDb(item.id, { sortOrder: item.sortOrder });
      }
      await audit(req, { actor: user, action: "key_result.reorder", resourceType: "key_result", changes: { count: orders.length } });
      return res.json({ message: "排序已保存" });
    } catch (err: any) {
      console.error("Reorder KR error:", err);
      return res.status(500).json({ message: err.message || "排序保存失败" });
    }
  });

  app.put("/api/key-results/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      if (!await getManageableKeyResult(user, req.params.id)) return res.status(404).json({ message: "关键结果不存在" });
      const updates = parseBody(keyResultUpdateBodySchema, req.body);
      const kr = await updateKeyResultInDb(req.params.id, updates);
      await audit(req, { actor: user, action: "key_result.update", resourceType: "key_result", resourceId: req.params.id, changes: updates });
      return res.json(kr);
    } catch (err) {
      return routeError(res, err, "更新关键结果失败");
    }
  });

  app.delete("/api/key-results/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      if (!await getManageableKeyResult(user, req.params.id)) return res.status(404).json({ message: "关键结果不存在" });
      await deleteKeyResultInDb(req.params.id);
      await audit(req, { actor: user, action: "key_result.delete", resourceType: "key_result", resourceId: req.params.id });
      return res.json({ message: "已删除" });
    } catch (err) {
      return res.status(500).json({ message: "删除关键结果失败" });
    }
  });

  app.put("/api/key-results/:id/progress", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const resource = await getReadableKeyResult(user, req.params.id);
      if (!resource || !canUpdateKeyResultProgress(user, resource.objective, resource.keyResult)) return res.status(404).json({ message: "关键结果不存在" });
      const { progress, note, images, entryId } = parseBody(progressBodySchema, req.body);
      const kr = await updateKRProgressInDb(
        req.params.id,
        progress,
        note || "",
        images,
        entryId ? String(entryId) : undefined
      );
      if (!kr) return res.status(404).json({ message: "关键结果不存在" });
      await audit(req, { actor: user, action: "key_result.progress", resourceType: "key_result", resourceId: req.params.id, changes: { progress, entryId, imageCount: images?.length || 0 } });
      return res.json(kr);
    } catch (err) {
      return routeError(res, err, "更新进度失败");
    }
  });

  app.put("/api/key-results/:id/score", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const resource = await getReadableKeyResult(user, req.params.id);
      if (!resource || !canScoreKeyResult(user, resource.objective, resource.keyResult)) return res.status(404).json({ message: "关键结果不存在" });
      const { score, note } = parseBody(scoreBodySchema, req.body);
      const kr = await scoreKRInDb(req.params.id, score, note || "");
      if (!kr) return res.status(404).json({ message: "关键结果不存在" });
      await audit(req, { actor: user, action: "key_result.score", resourceType: "key_result", resourceId: req.params.id, changes: { score } });
      return res.json(kr);
    } catch (err) {
      return routeError(res, err, "评分失败");
    }
  });

  app.get("/api/export/okr", requireAuth, async (req: Request, res: Response) => {
    try {
      const XLSX = await import("xlsx");
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });

      const allUsers = await getAllUsers();
      const allDepartments = await getDepartments();
      const allVisibleObjectives = await getObjectivesForUser(user);
      const visibleObjectiveIds = allVisibleObjectives.map((objective) => objective.id);
      const allVisibleKRs = visibleObjectiveIds.length > 0
        ? await getKeyResultsForObjectives(visibleObjectiveIds)
        : [];
      const myDeptIds = await getUserDepartmentIds(user.id);

      const selectedDeptIds = typeof req.query.departmentIds === "string" && req.query.departmentIds
        ? req.query.departmentIds.split(",").map((id) => id.trim()).filter(Boolean)
        : [];
      const selectedUserId = typeof req.query.userId === "string" && req.query.userId
        ? req.query.userId
        : null;
      const selectedCycle = typeof req.query.cycle === "string" && req.query.cycle
        ? req.query.cycle
        : null;

      const userRole = user.role || "member";
      const isAdmin = userRole === "center_head" || userRole === "vp" || userRole === "super_admin";

      let filteredObjectives = [...allVisibleObjectives];

      if (!isAdmin) {
        const targetUserId = selectedUserId || user.id;
        filteredObjectives = filteredObjectives.filter((objective) => {
          if (objective.createdBy === targetUserId) return true;
          if (objective.createdBy === user.id) {
            return allVisibleKRs.some(
              (kr) => kr.objectiveId === objective.id && kr.assigneeId === targetUserId,
            );
          }
          return false;
        });

        if (myDeptIds.length > 0) {
          filteredObjectives = filteredObjectives.filter((objective) =>
            myDeptIds.includes(objective.departmentId),
          );
        }
      } else {
        if (selectedDeptIds.length > 0) {
          filteredObjectives = filteredObjectives.filter((objective) =>
            selectedDeptIds.includes(objective.departmentId),
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
      const commentsByKr = new Map<string, Awaited<ReturnType<typeof getCommentsForKR>>>();

      for (const kr of filteredKRs) {
        commentsByKr.set(kr.id, await getCommentsForKR(kr.id));
      }

      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const deptMap = new Map(allDepartments.map((dept) => [dept.id, dept]));
      const krsByObjective = new Map<string, typeof filteredKRs>();

      for (const kr of filteredKRs) {
        const current = krsByObjective.get(kr.objectiveId) || [];
        current.push(kr);
        krsByObjective.set(kr.objectiveId, current);
      }

      const summaryHeaders = [
        "部门",
        "周期",
        "目标标题",
        "目标描述",
        "目标创建人",
        "关键结果标题",
        "关键结果描述",
        "执行人",
        "协同人",
        "开始日期",
        "截止日期",
        "权重",
        "进度",
        "状态",
        "OKR类型",
        "自评分",
        "自评说明",
        "进度记录数",
        "评论数",
        "最新评论",
      ];
      summaryHeaders.push("最新执行说明", "最新执行说明时间");
      const progressHeaders = [
        "部门",
        "周期",
        "目标标题",
        "关键结果标题",
        "记录日期",
        "进度",
        "备注",
        "图片",
      ];
      const commentHeaders = [
        "部门",
        "周期",
        "目标标题",
        "关键结果标题",
        "评论人",
        "评论内容",
        "@提及",
        "评论时间",
      ];

      const summaryRows: any[][] = [];
      const progressRows: any[][] = [];
      const commentRows: any[][] = [];

      for (const objective of filteredObjectives) {
        const dept = deptMap.get(objective.departmentId);
        const creator = objective.createdBy ? userMap.get(objective.createdBy) : null;
        const objectiveKRs = (krsByObjective.get(objective.id) || []).sort(
          (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
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
            "",
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
            latestComment ? `${latestComment.userName}: ${latestComment.content}` : "",
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
              entry.images?.join("\n") || "",
            ]);
          }

          for (const comment of comments) {
            const mentionedNames = (comment.mentionedUserIds || [])
              .map((mentionedId) => userMap.get(mentionedId)?.displayName || mentionedId)
              .join(", ");
            commentRows.push([
              dept?.name || "",
              objective.cycle,
              objective.title,
              kr.title,
              comment.userName,
              comment.content,
              mentionedNames,
              comment.createdAt,
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

      XLSX.utils.book_append_sheet(wb, summarySheet, "OKR汇总");
      XLSX.utils.book_append_sheet(wb, progressSheet, "进度记录");
      XLSX.utils.book_append_sheet(wb, commentSheet, "评论记录");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=okr_export_${stamp}.xlsx`);
      await audit(req, { actor: user, action: "okr.export", resourceType: "okr", changes: { objectiveCount: filteredObjectives.length, keyResultCount: filteredKRs.length } });
      return res.send(buf);
    } catch (err) {
      console.error("Export OKR error:", err);
      return res.status(500).json({ message: "导出失败" });
    }
  });

  app.get("/api/import/template", requireAuth, async (req: Request, res: Response) => {
    const XLSX = await import("xlsx");
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const defaultCycle = `${now.getFullYear()} 第${quarter === 1 ? '一' : quarter === 2 ? '二' : quarter === 3 ? '三' : '四'}季度`;

    const user = await getUser(req.session.userId!);
    const allDepts = await getDepartments();

    let deptName = "";
    if (user?.departmentId) {
      const dept = allDepts.find(d => d.id === user.departmentId);
      deptName = dept?.name || "";
    }

    // 获取当前用户的钉钉ID作为默认创建人ID
    const creatorDingtalkId = user?.dingtalkUserId || "";

    const headers = ["部门", "目标名称", "KR名称", "执行人", "周期", "OKR类型", "关联上级", "权重", "创建人ID"];
    const rows = [
      [deptName, "提高产品质量", "单元测试覆盖率达到80%", "", defaultCycle, "承诺型", "否", 1, creatorDingtalkId],
      [deptName, "提高产品质量", "代码审查通过率95%", "", defaultCycle, "承诺型", "否", 1, creatorDingtalkId],
      [deptName, "提升用户满意度", "NPS分数提升到8.5", "", defaultCycle, "挑战型", "是", 1, creatorDingtalkId],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 14 }, { wch: 20 }, { wch: 24 }, { wch: 12 },
      { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OKR导入模板");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=okr_import_template.xlsx");
    return res.send(buf);
  });

  app.post("/api/upload/image", requireAuth, async (req: Request, res: Response) => {
    try {
      const buf = await readRawBody(req, 10 * 1024 * 1024);

      if (buf.length === 0) return res.status(400).json({ message: "没有文件数据" });
      const detected = detectImageType(buf);
      if (!detected) return res.status(400).json({ message: "仅支持 PNG、JPEG、GIF 和 WebP 图片" });
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${detected.extension}`;

      const url = await uploadFile(buf, fileName, detected.contentType);
      return res.json({ url });
    } catch (err) {
      console.error("Image upload error:", err);
      return routeError(res, err, "图片上传失败");
    }
  });

  app.post("/api/import/parse-excel", requireAuth, async (req: Request, res: Response) => {
    try {
      const XLSX = await import("xlsx");
      const buf = await readRawBody(req, 10 * 1024 * 1024);
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return res.status(400).json({ message: "文件为空" });
      const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (jsonData.length < 2) return res.status(400).json({ message: "文件为空或只有表头" });
      if (jsonData.length > 1001) return res.status(400).json({ message: "单次最多导入1000行" });
      const headers = jsonData[0].map((h: any) => String(h).trim());
      if (!headers.includes("目标名称")) {
        return res.status(400).json({ message: "缺少必要列: 目标名称。请使用模板文件。" });
      }
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const vals = jsonData[i];
        if (!vals || vals.length === 0) continue;
        const row: Record<string, string> = {};
        headers.forEach((h: string, idx: number) => { row[h] = vals[idx] != null ? String(vals[idx]).trim() : ''; });
        if (row["目标名称"]) rows.push(row);
      }
      return res.json({ rows });
    } catch (err) {
      console.error("Parse excel error:", err);
      return routeError(res, err, "文件解析失败，请检查文件格式（支持 .xlsx 和 .csv）");
    }
  });

  app.post("/api/import/okr", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });

      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0 || rows.length > 1000) {
        return res.status(400).json({ message: "没有可导入的数据" });
      }

      const allDepts = await getDepartments();
      const allUsers = await getAllUsers();
      const userMultiDepts = await getUserDepartmentIds(user.id);
      let defaultDeptId = userMultiDepts[0] || user.departmentId || "";
      if (!defaultDeptId && user.role === "super_admin" && allDepts.length > 0) {
        defaultDeptId = allDepts[0].id;
      }
      if (!defaultDeptId) {
        return res.status(400).json({ message: "系统中尚无部门，请先创建部门" });
      }

      const now = new Date();
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      const defaultCycle = `${now.getFullYear()} 第${quarter === 1 ? '一' : quarter === 2 ? '二' : quarter === 3 ? '三' : '四'}季度`;
      const defaultEndDate = new Date(now.getFullYear(), quarter * 3, 0).toISOString().split("T")[0];

      const objectiveMap = new Map<string, any>();
      const errors: string[] = [];
      let importedObjectives = 0;
      let importedKRs = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== "object") {
          errors.push(`第${i + 2}行: 数据格式无效`);
          continue;
        }
        const objTitle = row["目标名称"]?.trim();
        const objDesc = "";
        const krTitle = row["KR名称"]?.trim();
        const krDesc = "";
        const okrType = row["OKR类型"]?.trim() || "承诺型";
        const linkedToParentStr = row["关联上级"]?.trim() || "否";
        const linkedToParent = linkedToParentStr === "是";
        const assigneeName = row["执行人"]?.trim() || "";
        const weightStr = row["权重"]?.trim() || "1";
        const parsed = parseFloat(weightStr);
        const weight = Number.isFinite(parsed) ? parsed : 1;
        const cycle = row["周期"]?.trim() || defaultCycle;
        const deptName = row["部门"]?.trim() || "";
        const creatorDingtalkId = row["创建人ID"]?.trim() || "";

        if (!objTitle) {
          errors.push(`第${i + 2}行: 目标名称不能为空`);
          continue;
        }

        let deptId = defaultDeptId;
        if (deptName) {
          const dept = allDepts.find(d => d.name === deptName);
          if (dept) {
            const allowedDepts = userMultiDepts.length ? userMultiDepts : (user.departmentId ? [user.departmentId] : []);
            if (user.role === "super_admin" || allowedDepts.includes(dept.id)) deptId = dept.id;
            else errors.push(`第${i + 2}行: 无权向部门"${deptName}"导入，使用默认部门`);
          } else {
            errors.push(`第${i + 2}行: 部门"${deptName}"不存在，使用默认部门`);
          }
        }

        let assigneeId: string | null = null;
        let resolvedAssigneeName = "";
        if (assigneeName) {
          const matchUser = allUsers.find(u => u.displayName === assigneeName || u.username === assigneeName);
          if (matchUser) {
            assigneeId = matchUser.id;
            resolvedAssigneeName = matchUser.displayName;
          } else {
            resolvedAssigneeName = assigneeName;
            errors.push(`第${i + 2}行: 执行人"${assigneeName}"未匹配到系统用户`);
          }
        }

        // 根据创建人ID（钉钉ID）查找用户
        let creatorId: string | null = user.id;
        if (user.role === "super_admin" && creatorDingtalkId) {
          const matchCreator = allUsers.find(u => u.dingtalkUserId === creatorDingtalkId);
          if (matchCreator) {
            creatorId = matchCreator.id;
          } else {
            errors.push(`第${i + 2}行: 创建人ID"${creatorDingtalkId}"未匹配到系统用户，将使用当前登录用户作为创建人`);
          }
        }

        const objKey = `${objTitle}|${deptId}|${cycle}|${creatorId || user.id}`;
        if (!objectiveMap.has(objKey)) {
          const validOkrType = okrType === "挑战型" ? "挑战型" : "承诺型";
          const obj = await createObjectiveInDb({
            title: objTitle,
            description: objDesc,
            departmentId: deptId,
            cycle,
            parentObjectiveId: null,
            isCollaborative: false,
            collaborativeDeptIds: [],
            collaborativeUserIds: [],
            createdBy: creatorId || user.id, // 使用创建人ID（钉钉ID匹配的用户）或当前登录用户
            linkedToParent,
            okrType: validOkrType,
          });
          objectiveMap.set(objKey, obj);
          importedObjectives++;
        }

        if (krTitle) {
          const obj = objectiveMap.get(objKey);
          const validKrType = okrType === "挑战型" ? "挑战型" : "承诺型";
          await createKeyResultInDb({
            objectiveId: obj.id,
            title: krTitle,
            description: krDesc,
            assigneeId,
            assigneeName: resolvedAssigneeName,
            startDate: now.toISOString().split("T")[0],
            endDate: defaultEndDate,
            weight,
            okrType: validKrType,
          });
          importedKRs++;
        }
      }

      await audit(req, { actor: user, action: "okr.import", resourceType: "okr", changes: { importedObjectives, importedKRs, errorCount: errors.length } });
      return res.json({
        message: `导入完成: ${importedObjectives} 个目标, ${importedKRs} 个关键结果`,
        importedObjectives,
        importedKRs,
        errors,
      });
    } catch (err) {
      console.error("Import error:", err);
      return res.status(500).json({ message: "导入失败" });
    }
  });

  app.get("/api/analytics/department-rankings", requireAuth, async (req: Request, res: Response) => {
    try {
      const cycle = req.query.cycle as string || '';
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const allDepts = await getDepartments();
      const allObjs = await getObjectivesForUser(user);
      const filteredObjs = cycle ? allObjs.filter(o => o.cycle === cycle) : allObjs;
      const objIds = filteredObjs.map(o => o.id);
      const allKRs = objIds.length > 0 ? await getKeyResultsForObjectives(objIds) : [];

      const rankings = allDepts.map(dept => {
        const deptObjs = filteredObjs.filter(o => o.departmentId === dept.id);
        const deptKRs = allKRs.filter(kr => deptObjs.some(o => o.id === kr.objectiveId));
        const avgProgress = deptKRs.length > 0 ? Math.round(deptKRs.reduce((s, kr) => s + kr.progress, 0) / deptKRs.length) : 0;
        const scored = deptKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);
        const avgScore = scored.length > 0 ? parseFloat((scored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / scored.length).toFixed(2)) : 0;
        const completed = deptKRs.filter(kr => kr.status === 'completed').length;
        const completionRate = deptKRs.length > 0 ? Math.round((completed / deptKRs.length) * 100) : 0;
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          objectiveCount: deptObjs.length,
          krCount: deptKRs.length,
          avgProgress,
          avgScore,
          completionRate,
          completedCount: completed,
          behindCount: deptKRs.filter(kr => kr.status === 'behind').length,
          overdueCount: deptKRs.filter(kr => kr.status === 'overdue').length,
        };
      }).filter(d => d.krCount > 0).sort((a, b) => b.avgProgress - a.avgProgress);

      const cycles = [...new Set(allObjs.map(o => o.cycle))].sort();
      return res.json({ rankings, cycles });
    } catch (err) {
      console.error("Rankings error:", err);
      return res.status(500).json({ message: "获取排名失败" });
    }
  });

  app.post("/api/analytics/ai-analysis", requireAuth, async (req: Request, res: Response) => {
    try {
      const { cycle, departmentId, stream = false } = req.body;
      if (!cycle) return res.status(400).json({ message: "请选择周期" });
      if (typeof cycle !== "string" || cycle.length > 300 || (departmentId && typeof departmentId !== "string") || typeof stream !== "boolean") {
        return res.status(400).json({ message: "请求数据无效" });
      }
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });

      // 检查环境变量
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        console.error("AI_INTEGRATIONS_OPENAI_API_KEY 环境变量未设置");
        return res.status(500).json({ 
          message: "AI服务配置错误：缺少API密钥",
          debug: "请检查服务器环境变量配置"
        });
      }

      const { generateOKRAnalysis, streamOKRAnalysis } = await import("./ai-analysis");
      const allDepts = await getDepartments();
      let allObjs = await getObjectivesForUser(user);
      allObjs = allObjs.filter(o => o.cycle === cycle);
      if (departmentId) {
        allObjs = allObjs.filter(o => o.departmentId === departmentId);
      }
      const objIds = allObjs.map(o => o.id);
      const allKRs = objIds.length > 0 ? await getKeyResultsForObjectives(objIds) : [];

      if (allObjs.length === 0) {
        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.write(`data: ${JSON.stringify({ content: '该周期暂无OKR数据，无法生成分析报告。' })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          return;
        } else {
          return res.json({ analysis: '该周期暂无OKR数据，无法生成分析报告。' });
        }
      }

      const deptName = departmentId ? allDepts.find(d => d.id === departmentId)?.name : undefined;
      const analysisData = {
        objectives: allObjs,
        keyResults: allKRs,
        departments: allDepts,
        cycle,
        departmentName: deptName,
      };
      await audit(req, { actor: user, action: "analytics.ai_analysis", resourceType: "analytics", changes: { cycle, departmentId, objectiveCount: allObjs.length, stream } });

      if (stream) {
        // 流式响应
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        try {
          for await (const chunk of streamOKRAnalysis(analysisData)) {
            res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          }
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        } catch (streamError) {
          console.error("Stream error:", streamError);
          if (!res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: "AI分析过程中出现错误" })}\n\n`);
            res.end();
          }
        }
      } else {
        // 非流式响应（保持向后兼容）
        const analysis = await generateOKRAnalysis(analysisData);
        return res.json({ analysis });
      }
    } catch (err: any) {
      console.error("AI analysis error:", err);
      // 提供更详细的错误信息
      if (err.message && err.message.includes("AI_INTEGRATIONS_OPENAI_API_KEY")) {
        return res.status(500).json({ 
          message: "AI服务配置错误",
          debug: err.message
        });
      }
      return res.status(500).json({ 
        message: "AI 分析生成失败",
        debug: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  app.get("/api/kr-comments/:krId", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      if (!await getReadableKeyResult(user, req.params.krId)) return res.status(404).json({ message: "关键结果不存在" });
      const comments = await getCommentsForKR(req.params.krId);
      return res.json(comments);
    } catch (err) {
      return res.status(500).json({ message: "获取评论失败" });
    }
  });

  app.post("/api/kr-comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const { krId, content, mentionedUserIds } = parseBody(commentBodySchema, req.body);
      const mentions = mentionedUserIds || [];
      const resource = await getReadableKeyResult(user, krId);
      if (!resource) return res.status(404).json({ message: "关键结果不存在" });
      const comment = await createComment({
        krId,
        userId: user.id,
        userName: user.displayName,
        content,
        mentionedUserIds: mentions,
      });

      if (mentions.length > 0) {
        const obj = resource.objective;
        for (const mentionedId of mentions) {
          if (mentionedId !== user.id) {
            await createNotification({
              userId: mentionedId,
              type: "comment_mention",
              title: `${user.displayName} 在评论中提到了你`,
              content: content.substring(0, 100),
              relatedKrId: krId,
              relatedObjectiveId: obj?.id,
              fromUserId: user.id,
              fromUserName: user.displayName,
            });
          }
        }
      }

      await audit(req, { actor: user, action: "comment.create", resourceType: "comment", resourceId: comment.id, changes: { krId, mentionedUserIds: mentions } });
      return res.json(comment);
    } catch (err) {
      return routeError(res, err, "发送评论失败");
    }
  });

  app.delete("/api/kr-comments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const comment = await getComment(req.params.id);
      if (!comment || (comment.userId !== user.id && user.role !== "super_admin")) return res.status(404).json({ message: "评论不存在" });
      await deleteComment(req.params.id);
      await audit(req, { actor: user, action: "comment.delete", resourceType: "comment", resourceId: req.params.id, changes: { krId: comment.krId } });
      return res.json({ message: "已删除" });
    } catch (err) {
      return res.status(500).json({ message: "删除评论失败" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const notifs = await getNotificationsForUser(req.session.userId!);
      return res.json(notifs);
    } catch (err) {
      return res.status(500).json({ message: "获取通知失败" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const count = await getUnreadNotificationCount(req.session.userId!);
      return res.json({ count });
    } catch (err) {
      return res.status(500).json({ message: "获取未读数失败" });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const notification = await getNotification(req.params.id);
      if (!notification || notification.userId !== req.session.userId) return res.status(404).json({ message: "通知不存在" });
      await markNotificationRead(req.params.id);
      return res.json({ message: "已标记已读" });
    } catch (err) {
      return res.status(500).json({ message: "标记失败" });
    }
  });

  app.put("/api/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    try {
      await markAllNotificationsRead(req.session.userId!);
      return res.json({ message: "已全部标记已读" });
    } catch (err) {
      return res.status(500).json({ message: "标记失败" });
    }
  });

  // 清除所有 OKR 数据（仅超级管理员可用）
  app.delete("/api/okr/clear-all", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = await getUser(req.session.userId!);
      const { keyResults, objectives } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      
      // 先删除所有关键结果
      const deletedKRs = await db.delete(keyResults).returning();
      // 再删除所有目标
      const deletedObjectives = await db.delete(objectives).returning();
      await audit(req, { actor, action: "okr.clear_all", resourceType: "okr", changes: { deletedObjectives: deletedObjectives.length, deletedKRs: deletedKRs.length } });
      
      return res.json({ 
        message: `已清除所有 OKR 数据`,
        deletedObjectives: deletedObjectives.length,
        deletedKRs: deletedKRs.length
      });
    } catch (err) {
      console.error("Clear OKR error:", err);
      return res.status(500).json({ message: "清除失败" });
    }
  });

  app.get("/api/admin/audit-logs", requireAdmin, async (req: Request, res: Response) => {
    const logs = await getAuditLogs({
      actorId: typeof req.query.actorId === "string" ? req.query.actorId : undefined,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      resourceType: typeof req.query.resourceType === "string" ? req.query.resourceType : undefined,
      success: req.query.success === "true" ? true : req.query.success === "false" ? false : undefined,
      from: typeof req.query.from === "string" && !Number.isNaN(Date.parse(req.query.from)) ? new Date(req.query.from) : undefined,
      to: typeof req.query.to === "string" && !Number.isNaN(Date.parse(req.query.to)) ? new Date(req.query.to) : undefined,
      limit: typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json(logs);
  });

  app.get("/api/admin/audit-logs/export", requireAdmin, async (req: Request, res: Response) => {
    const logs = await getAuditLogs({ limit: 1000 });
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["时间", "请求ID", "操作者", "角色", "操作", "资源类型", "资源ID", "IP", "结果", "错误码"],
      ...logs.map((log) => [log.createdAt?.toISOString(), log.requestId, log.actorUsername, log.actorRole, log.action, log.resourceType, log.resourceId, log.ipAddress, log.success ? "成功" : "失败", log.errorCode]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=audit_logs.csv");
    res.setHeader("Cache-Control", "no-store");
    return res.send(csv);
  });

  app.post("/api/admin/audit-logs/cleanup", requireAdmin, async (req: Request, res: Response) => {
    const actor = await getUser(req.session.userId!);
    const deleted = await deleteExpiredAuditLogs(180);
    await audit(req, { actor, action: "audit.cleanup", resourceType: "audit_log", changes: { deleted, retentionDays: 180 } });
    return res.json({ deleted });
  });

}
