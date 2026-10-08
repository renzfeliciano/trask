import { describe, expect, it } from "vitest";
import { ROLES, ROLE_RANK, atLeast, canAssignRole, type Role } from "@/server/authz/roles";
import { PERMISSION_MIN_ROLE, assertCan, can, type Permission } from "@/server/authz/permissions";
import { AuthorizationError } from "@/server/errors/app-error";

// The expected table is spelled out literally on purpose: it must not be derived from the implementation.
const EXPECTED_ALLOWED: Record<Permission, Role[]> = {
  "workspace.read": ["VIEWER", "MEMBER", "ADMIN", "OWNER"],
  "board.read": ["VIEWER", "MEMBER", "ADMIN", "OWNER"],
  "task.read": ["VIEWER", "MEMBER", "ADMIN", "OWNER"],
  "member.read": ["VIEWER", "MEMBER", "ADMIN", "OWNER"],
  "board.create": ["MEMBER", "ADMIN", "OWNER"],
  "board.update": ["MEMBER", "ADMIN", "OWNER"],
  "task.create": ["MEMBER", "ADMIN", "OWNER"],
  "task.update": ["MEMBER", "ADMIN", "OWNER"],
  "task.delete": ["MEMBER", "ADMIN", "OWNER"],
  "workspace.update": ["ADMIN", "OWNER"],
  "board.delete": ["ADMIN", "OWNER"],
  "member.invite": ["ADMIN", "OWNER"],
  "member.remove": ["ADMIN", "OWNER"],
  "member.updateRole": ["ADMIN", "OWNER"],
  "workspace.delete": ["OWNER"],
};

const EXPECTED_ENTRIES = Object.entries(EXPECTED_ALLOWED) as [Permission, Role[]][];
const ALL_PERMISSIONS = EXPECTED_ENTRIES.map(([permission]) => permission);

const CASES: [Role, Permission, boolean][] = EXPECTED_ENTRIES.flatMap(([permission, allowed]) =>
  ROLES.map((role): [Role, Permission, boolean] => [role, permission, allowed.includes(role)]),
);

describe("roles", () => {
  it("ranks roles VIEWER < MEMBER < ADMIN < OWNER", () => {
    expect(ROLES).toEqual(["VIEWER", "MEMBER", "ADMIN", "OWNER"]);
    expect(ROLE_RANK).toEqual({ VIEWER: 1, MEMBER: 2, ADMIN: 3, OWNER: 4 });
  });

  it("atLeast compares by rank", () => {
    expect(atLeast("ADMIN", "MEMBER")).toBe(true);
    expect(atLeast("ADMIN", "ADMIN")).toBe(true);
    expect(atLeast("MEMBER", "ADMIN")).toBe(false);
  });

  it.each([
    ["ADMIN", "MEMBER", true],
    ["ADMIN", "ADMIN", true],
    ["ADMIN", "OWNER", false],
    ["MEMBER", "VIEWER", false],
    ["OWNER", "OWNER", true],
  ] as const)("canAssignRole(%s, %s) is %s", (actor, target, expected) => {
    expect(canAssignRole(actor, target)).toBe(expected);
  });
});

describe("permissions", () => {
  it("covers every permission in the expected table", () => {
    expect(Object.keys(PERMISSION_MIN_ROLE).sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it.each(CASES)("can(%s, %s) is %s", (role, permission, expected) => {
    expect(can(role, permission)).toBe(expected);
  });

  it("assertCan throws AuthorizationError when the role is too low", () => {
    expect(() => {
      assertCan({ role: "VIEWER" }, "task.create");
    }).toThrow(AuthorizationError);
  });

  it("assertCan returns when the role is sufficient", () => {
    expect(() => {
      assertCan({ role: "MEMBER" }, "task.create");
    }).not.toThrow();
  });
});
