import { createWorkspace, findMembershipRole } from "@/server/workspaces/membership-repository";
import { adminDb, createUser, resetDb } from "../helpers/db";

describe("membership repository", () => {
  beforeEach(resetDb);

  it("creates a workspace owned by the caller", async () => {
    const owner = await createUser();
    const ctx = { userId: owner.id };

    const { id } = await createWorkspace(ctx, { name: "Acme Launch", slug: "acme-launch" });

    expect(await findMembershipRole(ctx, id)).toBe("OWNER");
    const workspace = await adminDb.workspace.findUniqueOrThrow({
      where: { id },
      include: { members: true },
    });
    expect(workspace).toMatchObject({
      name: "Acme Launch",
      slug: "acme-launch",
      createdById: owner.id,
    });
    expect(workspace.members.map((m) => [m.userId, m.role])).toEqual([[owner.id, "OWNER"]]);
  });

  it("returns no role for a workspace the user does not belong to", async () => {
    const a = await createUser();
    const b = await createUser();
    const { id } = await createWorkspace({ userId: a.id }, { name: "Acme Launch", slug: "acme" });

    expect(await findMembershipRole({ userId: b.id }, id)).toBeNull();
  });

  it("returns the role of a co-member", async () => {
    const a = await createUser();
    const b = await createUser();
    const { id } = await createWorkspace({ userId: a.id }, { name: "Acme Launch", slug: "acme" });
    await adminDb.workspaceMember.create({
      data: { workspaceId: id, userId: b.id, role: "VIEWER" },
    });

    expect(await findMembershipRole({ userId: b.id }, id)).toBe("VIEWER");
  });
});
