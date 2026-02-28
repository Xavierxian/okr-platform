import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import {
  getUser, getUserByUsername, createUser, updateUser, deleteUser, getAllUsers, verifyPassword,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getObjectivesForUser, getAllObjectives, createObjectiveInDb, updateObjectiveInDb, deleteObjectiveInDb,
  getKeyResultsForObjectives, getAllKeyResults, createKeyResultInDb, updateKeyResultInDb, deleteKeyResultInDb,
  updateKRProgressInDb, scoreKRInDb,
} from "./storage";

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

  app.use(
    session({
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
        secure: false,
        sameSite: "lax",
      },
    })
  );

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
      return res.json({ user: safeUser });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "登录失败" });
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
    return res.json({ user: safeUser });
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

  app.get("/api/users", requireAdmin, async (_req: Request, res: Response) => {
    const all = await getAllUsers();
    const safe = all.map(({ password, ...u }) => u);
    return res.json(safe);
  });

  app.post("/api/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { username, password, displayName, role, departmentId } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "请填写完整信息" });
      }
      const existing = await getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "用户名已存在" });
      }
      const user = await createUser({ username, password, displayName, role: role || "member", departmentId: departmentId || null });
      const { password: _, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err) {
      return res.status(500).json({ message: "创建用户失败" });
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await updateUser(req.params.id, req.body);
      if (!user) return res.status(404).json({ message: "用户不存在" });
      const { password: _, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err) {
      return res.status(500).json({ message: "更新用户失败" });
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

  app.post("/api/objectives", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const { title, description, departmentId, cycle, parentObjectiveId, isCollaborative, collaborativeDeptIds } = req.body;
      if (user.role !== "super_admin" && departmentId !== user.departmentId) {
        return res.status(403).json({ message: "只能为自己部门创建目标" });
      }
      const obj = await createObjectiveInDb({
        title,
        description: description || "",
        departmentId,
        cycle,
        parentObjectiveId: parentObjectiveId || null,
        isCollaborative: isCollaborative || false,
        collaborativeDeptIds: collaborativeDeptIds || [],
        createdBy: req.session.userId || null,
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

  app.post("/api/key-results", requireAuth, async (req: Request, res: Response) => {
    try {
      const { objectiveId, title, description, assigneeId, assigneeName, startDate, endDate, weight } = req.body;
      const kr = await createKeyResultInDb({
        objectiveId,
        title,
        description: description || "",
        assigneeId: assigneeId || null,
        assigneeName: assigneeName || "",
        startDate,
        endDate,
        weight: weight || 1,
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
      const { progress, note } = req.body;
      const kr = await updateKRProgressInDb(req.params.id, progress, note || "");
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

  const httpServer = createServer(app);
  return httpServer;
}
