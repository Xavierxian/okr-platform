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
  updateKRProgressInDb, scoreKRInDb, getUsersByDepartment,
  getKRsAssignedToUser, getKRsCollaboratingUser,
  getCycles, createCycle, updateCycle, deleteCycle,
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
        maxAge: undefined,
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
      const safe = all.map(({ password, ...u }) => u);
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

  app.post("/api/objectives", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });
      const { title, description, departmentId, cycle, parentObjectiveId, isCollaborative, collaborativeDeptIds, collaborativeUserIds, linkedToParent, okrType } = req.body;
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

  app.get("/api/import/template", requireAuth, async (req: Request, res: Response) => {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const defaultCycle = `${now.getFullYear()} 第${quarter === 1 ? '一' : quarter === 2 ? '二' : quarter === 3 ? '三' : '四'}季度`;

    const user = await getUser(req.session.userId!);
    const allDepts = await getDepartments();
    const allUsers = await getAllUsers();

    let deptName = "";
    if (user?.departmentId) {
      const dept = allDepts.find(d => d.id === user.departmentId);
      deptName = dept?.name || "";
    }

    const csvContent = `目标名称,OKR类型,关联上级,KR名称,执行人,权重,周期,部门
提高产品质量,承诺型,否,单元测试覆盖率达到80%,,1,${defaultCycle},${deptName}
提高产品质量,承诺型,否,代码审查通过率95%,,1,${defaultCycle},${deptName}
提升用户满意度,挑战型,是,NPS分数提升到8.5,,1,${defaultCycle},${deptName}`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=okr_import_template.csv");
    const bom = "\uFEFF";
    return res.send(bom + csvContent);
  });

  app.post("/api/import/okr", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "用户不存在" });

      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "没有可导入的数据" });
      }

      const allDepts = await getDepartments();
      const allUsers = await getAllUsers();
      let defaultDeptId = user.departmentId || "";
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
            if (user.role === "super_admin" || dept.id === user.departmentId) {
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

  const httpServer = createServer(app);
  return httpServer;
}
