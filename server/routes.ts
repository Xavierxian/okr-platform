import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
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
  getUserByDingtalkId,
} from "./storage";
import {
  isDingtalkConfigured,
  getUserInfoByAuthCode,
  getDepartmentList,
  getAllDingtalkUsers,
  getDingtalkCorpId,
  getDingtalkAppKey,
  getParentDepartmentName,
} from "./dingtalk";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
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

export async function registerRoutes(app: Express): Promise<Server> {
  const PgStore = connectPgSimple(session);
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    app.set("trust proxy", 1);
  }

  const sessionMiddleware = session({
    store: new PgStore({
      pool: pool as any,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "okr-secret-key",
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

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "请输入用户名和密码" });
      }
      const user = await getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }
      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }
      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      const deptIds = await getUserDepartmentIds(user.id);
      return res.json({ user: { ...safeUser, departmentIds: deptIds } });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "登录失败" });
    }
  });

  app.get("/api/auth/dingtalk-config", (_req: Request, res: Response) => {
    if (!isDingtalkConfigured()) {
      return res.json({ enabled: false });
    }
    return res.json({
      enabled: true,
      corpId: getDingtalkCorpId(),
      appKey: getDingtalkAppKey(),
    });
  });

  async function syncDingtalkUserDept(userId: string, dtDeptIdList?: number[]) {
    if (!dtDeptIdList || dtDeptIdList.length === 0) return;
    try {
      const existingDepts = await getDepartments();
      const parentNames = new Set<string>();
      for (const dtDeptId of dtDeptIdList) {
        const parentName = await getParentDepartmentName(dtDeptId);
        if (parentName) parentNames.add(parentName);
      }
      const localDeptIds: string[] = [];
      for (const name of parentNames) {
        let dept = existingDepts.find(d => d.name === name);
        if (!dept) {
          dept = await createDepartment({ name, parentId: null, level: 0 });
        }
        localDeptIds.push(dept.id);
      }
      if (localDeptIds.length > 0) {
        await setUserDepartments(userId, localDeptIds);
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
      const { authCode } = req.body;
      if (!authCode) {
        return res.status(400).json({ message: "缺少钉钉授权码" });
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
          dingtalkUserId: dtUser.userid,
        });
        user = newUser;
        await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
      } else {
        await syncDingtalkUserDept(user.id, dtUser.dept_id_list);
      }

      req.session.userId = user!.id;
      const { password: _, ...safeUser } = user!;
      const deptIds = await getUserDepartmentIds(user!.id);
      return res.json({ user: { ...safeUser, departmentIds: deptIds } });
    } catch (err: any) {
      console.error("DingTalk login error:", err);
      return res.status(500).json({ message: err?.message || "钉钉登录失败" });
    }
  });

  app.post("/api/dingtalk/sync-org", requireAdmin, async (_req: Request, res: Response) => {
    try {
      if (!isDingtalkConfigured()) {
        return res.status(400).json({ message: "钉钉未配置" });
      }

      const dtDepts = await getDepartmentList();
      const dtUsers = await getAllDingtalkUsers();
      const existingDepts = await getDepartments();
      const existingUsers = await getAllUsers();

      let syncedDepts = 0;
      let syncedUsers = 0;
      const deptIdMap = new Map<number, string>();

      for (const dtDept of dtDepts) {
        const existing = existingDepts.find(d => d.name === dtDept.name);
        if (existing) {
          deptIdMap.set(dtDept.dept_id, existing.id);
        } else {
          const parentLocalId = dtDept.parent_id > 1 ? (deptIdMap.get(dtDept.parent_id) || null) : null;
          const level = parentLocalId ? 1 : 0;
          const newDept = await createDepartment({
            name: dtDept.name,
            parentId: parentLocalId,
            level,
          });
          deptIdMap.set(dtDept.dept_id, newDept.id);
          syncedDepts++;
        }
      }

      for (const dtUser of dtUsers) {
        const existingUser = existingUsers.find(u => u.dingtalkUserId === dtUser.userid);

        if (existingUser) {
          await syncDingtalkUserDept(existingUser.id, dtUser.dept_id_list);
        } else {
          const newUser = await createUser({
            username: `dt_${dtUser.userid}`,
            password: `dt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            displayName: dtUser.name,
            role: "member",
            departmentId: null,
            dingtalkUserId: dtUser.userid,
          });
          await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
          syncedUsers++;
        }
      }

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
          dingtalkUserId: dtUser.userid,
        });
        user = newUser;
        await syncDingtalkUserDept(newUser.id, dtUser.dept_id_list);
      } else {
        await syncDingtalkUserDept(user.id, dtUser.dept_id_list);
      }
      req.session.userId = user!.id;
      return res.redirect("/");
    } catch (err) {
      console.error("DingTalk callback error:", err);
      return res.redirect("/?dt_error=1");
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
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
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "请填写当前密码和新密码" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "新密码至少6个字符" });
      }
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const valid = await verifyPassword(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "当前密码不正确" });
      await updateUser(user.id, { password: newPassword } as any);
      return res.json({ message: "密码修改成功" });
    } catch (err) {
      return res.status(500).json({ message: "修改密码失败" });
    }
  });

  app.get("/api/departments", requireAuth, async (_req: Request, res: Response) => {
    const deps = await getDepartments();
    return res.json(deps);
  });

  app.post("/api/departments", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, parentId, level } = req.body;
      const dept = await createDepartment({ name, parentId: parentId || null, level: level || 0 });
      return res.json(dept);
    } catch (err) {
      return res.status(500).json({ message: "创建部门失败" });
    }
  });

  app.put("/api/departments/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const dept = await updateDepartment(req.params.id, req.body);
      return res.json(dept);
    } catch (err) {
      return res.status(500).json({ message: "更新部门失败" });
    }
  });

  app.delete("/api/departments/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await deleteDepartment(req.params.id);
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
      const { name, sortOrder } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "周期名称不能为空" });
      const cycle = await createCycle(name.trim(), sortOrder ?? 0);
      return res.json(cycle);
    } catch (err: any) {
      if (err?.code === '23505') return res.status(400).json({ message: "该周期名称已存在" });
      return res.status(500).json({ message: "创建周期失败" });
    }
  });

  app.put("/api/cycles/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, sortOrder } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      const cycle = await updateCycle(req.params.id, updates);
      return res.json(cycle);
    } catch (err: any) {
      if (err?.code === '23505') return res.status(400).json({ message: "该周期名称已存在" });
      return res.status(500).json({ message: "更新周期失败" });
    }
  });

  app.delete("/api/cycles/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await deleteCycle(req.params.id);
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
      const { username, password, displayName, role, departmentId, departmentIds } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "请填写完整信息" });
      }
      const existing = await getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "用户名已存在" });
      }
      const deptIds: string[] = departmentIds || (departmentId ? [departmentId] : []);
      const primaryDeptId = deptIds.length > 0 ? deptIds[0] : null;
      const user = await createUser({ username, password, displayName, role: role || "member", departmentId: primaryDeptId });
      if (deptIds.length > 0) {
        await setUserDepartments(user.id, deptIds);
      }
      const { password: _, ...safeUser } = user;
      return res.json({ ...safeUser, departmentIds: deptIds });
    } catch (err) {
      return res.status(500).json({ message: "创建用户失败" });
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { departmentIds, ...rest } = req.body;
      if (departmentIds && Array.isArray(departmentIds)) {
        rest.departmentId = departmentIds.length > 0 ? departmentIds[0] : null;
        await setUserDepartments(req.params.id, departmentIds);
      }
      const user = await updateUser(req.params.id, rest);
      if (!user) return res.status(404).json({ message: "用户不存在" });
      const { password: _, ...safeUser } = user;
      const deptIds = departmentIds || await getUserDepartmentIds(user.id);
      return res.json({ ...safeUser, departmentIds: deptIds });
    } catch (err) {
      return res.status(500).json({ message: "更新用户失败" });
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
      await deleteUser(req.params.id);
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
      const allObjs = await getAllObjectives();
      const obj = allObjs.find(o => o.id === req.params.id);
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
      const { title, description, departmentId, cycle, parentObjectiveId, isCollaborative, collaborativeDeptIds, collaborativeUserIds, linkedToParent, okrType } = req.body;
      if (user.role !== "super_admin") {
        const userDeptIds = await getUserDepartmentIds(user.id);
        const allowedDepts = userDeptIds.length > 0 ? userDeptIds : (user.departmentId ? [user.departmentId] : []);
        if (!allowedDepts.includes(departmentId)) {
          return res.status(403).json({ message: "只能为自己所属中心创建目标" });
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
        okrType: okrType || '承诺型',
      });
      return res.json(obj);
    } catch (err) {
      return res.status(500).json({ message: "创建目标失败" });
    }
  });

  app.put("/api/objectives/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const obj = await updateObjectiveInDb(req.params.id, req.body);
      return res.json(obj);
    } catch (err) {
      return res.status(500).json({ message: "更新目标失败" });
    }
  });

  app.delete("/api/objectives/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await deleteObjectiveInDb(req.params.id);
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
        okrType: okrType || '承诺型',
      });
      return res.json(kr);
    } catch (err) {
      return res.status(500).json({ message: "创建关键结果失败" });
    }
  });

  app.put("/api/key-results/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const kr = await updateKeyResultInDb(req.params.id, req.body);
      return res.json(kr);
    } catch (err) {
      return res.status(500).json({ message: "更新关键结果失败" });
    }
  });

  app.delete("/api/key-results/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await deleteKeyResultInDb(req.params.id);
      return res.json({ message: "已删除" });
    } catch (err) {
      return res.status(500).json({ message: "删除关键结果失败" });
    }
  });

  app.put("/api/key-results/:id/progress", requireAuth, async (req: Request, res: Response) => {
    try {
      const { progress, note, images } = req.body;
      const kr = await updateKRProgressInDb(req.params.id, progress, note || "", images);
      if (!kr) return res.status(404).json({ message: "关键结果不存在" });
      return res.json(kr);
    } catch (err) {
      return res.status(500).json({ message: "更新进度失败" });
    }
  });

  app.put("/api/key-results/:id/score", requireAuth, async (req: Request, res: Response) => {
    try {
      const { score, note } = req.body;
      const kr = await scoreKRInDb(req.params.id, score, note || "");
      if (!kr) return res.status(404).json({ message: "关键结果不存在" });
      return res.json(kr);
    } catch (err) {
      return res.status(500).json({ message: "评分失败" });
    }
  });

  app.get("/api/import/template", requireAdmin, async (req: Request, res: Response) => {
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

    const headers = ["部门", "目标名称", "KR名称", "执行人", "周期", "OKR类型", "关联上级", "权重"];
    const rows = [
      [deptName, "提高产品质量", "单元测试覆盖率达到80%", "", defaultCycle, "承诺型", "否", 1],
      [deptName, "提高产品质量", "代码审查通过率95%", "", defaultCycle, "承诺型", "否", 1],
      [deptName, "提升用户满意度", "NPS分数提升到8.5", "", defaultCycle, "挑战型", "是", 1],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 14 }, { wch: 20 }, { wch: 24 }, { wch: 12 },
      { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
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
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      await new Promise<void>((resolve) => req.on("end", resolve));
      const buf = Buffer.concat(chunks);

      if (buf.length === 0) return res.status(400).json({ message: "没有文件数据" });
      if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ message: "文件大小不能超过10MB" });

      const contentType = req.headers["content-type"] || "image/png";
      const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

      const url = await uploadFile(buf, fileName, contentType);
      return res.json({ url });
    } catch (err) {
      console.error("Image upload error:", err);
      return res.status(500).json({ message: "图片上传失败" });
    }
  });

  app.post("/api/import/parse-excel", requireAdmin, async (req: Request, res: Response) => {
    try {
      const XLSX = await import("xlsx");
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      await new Promise<void>((resolve) => req.on("end", resolve));
      const buf = Buffer.concat(chunks);
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return res.status(400).json({ message: "Excel文件为空" });
      const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (jsonData.length < 2) return res.status(400).json({ message: "Excel文件为空或只有表头" });
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
      return res.status(400).json({ message: "Excel文件解析失败，请检查文件格式" });
    }
  });

  app.post("/api/import/okr", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      if (user.role !== "super_admin") {
        return res.status(403).json({ message: "仅超级管理员可导入OKR" });
      }

      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "没有可导入的数据" });
      }

      const allDepts = await getDepartments();
      const allUsers = await getAllUsers();
      const userMultiDepts = await getUserDepartmentIds(user.id);
      const userAllowedDepts = userMultiDepts.length > 0 ? userMultiDepts : (user.departmentId ? [user.departmentId] : []);
      let defaultDeptId = userAllowedDepts[0] || "";
      if (!defaultDeptId) {
        if (user.role === "super_admin" && allDepts.length > 0) {
          defaultDeptId = allDepts[0].id;
        } else {
          return res.status(400).json({ message: "您未分配部门，无法导入" });
        }
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

        if (!objTitle) {
          errors.push(`第${i + 2}行: 目标名称不能为空`);
          continue;
        }

        let deptId = defaultDeptId;
        if (deptName) {
          const dept = allDepts.find(d => d.name === deptName);
          if (dept) {
            if (user.role === "super_admin" || userAllowedDepts.includes(dept.id)) {
              deptId = dept.id;
            } else {
              errors.push(`第${i + 2}行: 无权导入到部门"${deptName}"，使用默认部门`);
            }
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

        const objKey = `${objTitle}|${deptId}|${cycle}`;
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
            createdBy: user.id,
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
      const allDepts = await getDepartments();
      const allObjs = await getAllObjectives();
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
      const { cycle, departmentId } = req.body;
      if (!cycle) return res.status(400).json({ message: "请选择周期" });

      const { generateOKRAnalysis } = await import("./ai-analysis");
      const allDepts = await getDepartments();
      let allObjs = await getAllObjectives();
      allObjs = allObjs.filter(o => o.cycle === cycle);
      if (departmentId) {
        allObjs = allObjs.filter(o => o.departmentId === departmentId);
      }
      const objIds = allObjs.map(o => o.id);
      const allKRs = objIds.length > 0 ? await getKeyResultsForObjectives(objIds) : [];

      if (allObjs.length === 0) {
        return res.json({ analysis: '该周期暂无OKR数据，无法生成分析报告。' });
      }

      const deptName = departmentId ? allDepts.find(d => d.id === departmentId)?.name : undefined;
      const analysis = await generateOKRAnalysis({
        objectives: allObjs,
        keyResults: allKRs,
        departments: allDepts,
        cycle,
        departmentName: deptName,
      });
      return res.json({ analysis });
    } catch (err) {
      console.error("AI analysis error:", err);
      return res.status(500).json({ message: "AI 分析生成失败" });
    }
  });

  app.get("/api/kr-comments/:krId", requireAuth, async (req: Request, res: Response) => {
    try {
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
      const { krId, content, mentionedUserIds } = req.body;
      if (!krId || !content?.trim()) {
        return res.status(400).json({ message: "评论内容不能为空" });
      }
      const comment = await createComment({
        krId,
        userId: user.id,
        userName: user.displayName,
        content: content.trim(),
        mentionedUserIds: mentionedUserIds || [],
      });

      if (mentionedUserIds && mentionedUserIds.length > 0) {
        const allKRs = await getAllKeyResults();
        const kr = allKRs.find(k => k.id === krId);
        const allObjs = await getAllObjectives();
        const obj = kr ? allObjs.find(o => o.id === kr.objectiveId) : null;
        for (const mentionedId of mentionedUserIds) {
          if (mentionedId !== user.id) {
            await createNotification({
              userId: mentionedId,
              type: "comment_mention",
              title: `${user.displayName} 在评论中提到了你`,
              content: content.trim().substring(0, 100),
              relatedKrId: krId,
              relatedObjectiveId: obj?.id,
              fromUserId: user.id,
              fromUserName: user.displayName,
            });
          }
        }
      }

      return res.json(comment);
    } catch (err) {
      return res.status(500).json({ message: "发送评论失败" });
    }
  });

  app.delete("/api/kr-comments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await deleteComment(req.params.id);
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

  const httpServer = createServer(app);
  return httpServer;
}
