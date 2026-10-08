import "server-only";

export const ROLES = ["VIEWER", "MEMBER", "ADMIN", "OWNER"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

/** True when `role` ranks at or above `min`. */
export function atLeast(role: Role, min: Role): boolean {
  // Both keys are the closed `Role` union, never user-supplied strings.
  // eslint-disable-next-line security/detect-object-injection
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Assigning roles is a management action: only ADMIN and above, and never above the actor's own rank. */
export function canAssignRole(actor: Role, target: Role): boolean {
  return atLeast(actor, "ADMIN") && atLeast(actor, target);
}
