import type { KeyResult, Objective, User } from "@shared/schema";

export function canManageObjective(user: User, objective: Objective): boolean {
  return user.role === "super_admin" || objective.createdBy === user.id;
}

export function canManageKeyResult(user: User, objective: Objective): boolean {
  return canManageObjective(user, objective);
}

export function canUpdateKeyResultProgress(
  user: User,
  objective: Objective,
  keyResult: KeyResult,
): boolean {
  return canManageObjective(user, objective) || keyResult.assigneeId === user.id;
}

export function canScoreKeyResult(
  user: User,
  objective: Objective,
  keyResult: KeyResult,
): boolean {
  return canUpdateKeyResultProgress(user, objective, keyResult);
}

