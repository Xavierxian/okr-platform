import type { KeyResult, Objective, User } from "@shared/schema";
import {
  getKeyResult,
  getObjective,
  getObjectivesForUser,
} from "./storage";
import { canManageKeyResult, canManageObjective } from "./authorization-policy";
export { canManageKeyResult, canManageObjective, canScoreKeyResult, canUpdateKeyResultProgress } from "./authorization-policy";

export async function getReadableObjective(
  user: User,
  objectiveId: string,
): Promise<Objective | undefined> {
  const visible = await getObjectivesForUser(user);
  return visible.find((objective) => objective.id === objectiveId);
}

export async function getManageableObjective(
  user: User,
  objectiveId: string,
): Promise<Objective | undefined> {
  const objective = await getObjective(objectiveId);
  return objective && canManageObjective(user, objective) ? objective : undefined;
}

export async function getReadableKeyResult(
  user: User,
  keyResultId: string,
): Promise<{ keyResult: KeyResult; objective: Objective } | undefined> {
  const keyResult = await getKeyResult(keyResultId);
  if (!keyResult) return undefined;
  const objective = await getReadableObjective(user, keyResult.objectiveId);
  return objective ? { keyResult, objective } : undefined;
}

export async function getManageableKeyResult(
  user: User,
  keyResultId: string,
): Promise<{ keyResult: KeyResult; objective: Objective } | undefined> {
  const keyResult = await getKeyResult(keyResultId);
  if (!keyResult) return undefined;
  const objective = await getObjective(keyResult.objectiveId);
  if (!objective || !canManageKeyResult(user, objective)) return undefined;
  return { keyResult, objective };
}
