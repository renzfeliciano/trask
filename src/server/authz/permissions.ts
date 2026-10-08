import "server-only";
import { AuthorizationError } from "@/server/errors/app-error";
import { atLeast, type Role } from "./roles";

/** Single source of truth: each permission and the lowest role that holds it. */
export const PERMISSION_MIN_ROLE = {
  "workspace.read": "VIEWER",
  "board.read": "VIEWER",
  "task.read": "VIEWER",
  "member.read": "VIEWER",
  "board.create": "MEMBER",
  "board.update": "MEMBER",
  "task.create": "MEMBER",
  "task.update": "MEMBER",
  "task.delete": "MEMBER",
  "workspace.update": "ADMIN",
  "board.delete": "ADMIN",
  "member.invite": "ADMIN",
  "member.remove": "ADMIN",
  "member.updateRole": "ADMIN",
  "workspace.delete": "OWNER",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSION_MIN_ROLE;

export function can(role: Role, permission: Permission): boolean {
  // `permission` is the closed `Permission` union, never a user-supplied string.
  // eslint-disable-next-line security/detect-object-injection
  return atLeast(role, PERMISSION_MIN_ROLE[permission]);
}

export function assertCan(ctx: { role: Role }, permission: Permission): void {
  if (!can(ctx.role, permission)) {
    throw new AuthorizationError();
  }
}
