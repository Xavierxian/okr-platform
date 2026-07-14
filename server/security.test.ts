import test from "node:test";
import assert from "node:assert/strict";
import { strongPasswordSchema } from "./validation";
import { buildHttpsRedirect, parsePublicHttpsOrigin } from "./tls";
import * as authorization from "./authorization-policy";

const objective = {
  id: "objective-1",
  createdBy: "creator-1",
} as any;
const keyResult = {
  id: "kr-1",
  assigneeId: "assignee-1",
  collaboratorId: "collaborator-1",
} as any;

test("resource policy grants only intended write capabilities", () => {
  const admin = { id: "admin", role: "super_admin" } as any;
  const creator = { id: "creator-1", role: "member" } as any;
  const assignee = { id: "assignee-1", role: "member" } as any;
  const collaborator = { id: "collaborator-1", role: "member" } as any;
  const departmentMember = { id: "member-1", role: "member" } as any;

  assert.equal(authorization.canManageObjective(admin, objective), true);
  assert.equal(authorization.canManageObjective(creator, objective), true);
  assert.equal(authorization.canManageObjective(assignee, objective), false);
  assert.equal(authorization.canUpdateKeyResultProgress(assignee, objective, keyResult), true);
  assert.equal(authorization.canScoreKeyResult(assignee, objective, keyResult), true);
  assert.equal(authorization.canUpdateKeyResultProgress(collaborator, objective, keyResult), false);
  assert.equal(authorization.canManageObjective(departmentMember, objective), false);
});

test("password policy requires length and three character classes", () => {
  assert.equal(strongPasswordSchema.safeParse("Admin123!").success, true);
  assert.equal(strongPasswordSchema.safeParse("admin123").success, false);
  assert.equal(strongPasswordSchema.safeParse("A1!").success, false);
});

test("HTTPS redirect ignores an attacker-controlled Host header", () => {
  const origin = parsePublicHttpsOrigin("https://okr.example.com:5000");
  assert.equal(
    buildHttpsRedirect(origin, "/objective/1?next=https://evil.example"),
    "https://okr.example.com:5000/objective/1?next=https://evil.example",
  );
  assert.equal(buildHttpsRedirect(origin, "//evil.example/phish"), "https://okr.example.com:5000/phish");
  assert.throws(() => parsePublicHttpsOrigin("http://okr.example.com"));
  assert.throws(() => parsePublicHttpsOrigin("https://okr.example.com/path"));
});
