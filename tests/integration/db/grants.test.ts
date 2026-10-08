import { withTenant } from "@/db/tenant";
import { adminDb, appDb, createUser, resetDb } from "../helpers/db";

const PERMISSION_DENIED = /permission denied/;

/** A user who is a member of a fresh workspace; row-level security limits trask_app to such workspaces. */
async function seedMember(slug: string) {
  const user = await createUser();
  const workspace = await adminDb.workspace.create({ data: { name: slug, slug } });
  await adminDb.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: user.id, role: "MEMBER" },
  });
  return { ctx: { userId: user.id }, workspace };
}

describe("trask_app grants", () => {
  beforeEach(resetDb);

  it("runs as a role that cannot bypass row-level security or own the schema objects", async () => {
    const [role] = await adminDb.$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; rolcreatedb: boolean }[]
    >`SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = 'trask_app'`;
    expect(role).toEqual({
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
      rolcreatedb: false,
    });

    const [owner] = await adminDb.$queryRaw<{ tableowner: string }[]>`
      SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Task'`;
    expect(owner?.tableowner).toBe("trask_migrator");
  });

  it("allows ordinary reads and writes on work tables", async () => {
    const { ctx, workspace } = await seedMember("grants-w");
    const db = withTenant(ctx);
    const board = await db.board.create({
      data: { workspaceId: workspace.id, name: "Board", position: "a0" },
    });
    await db.board.update({ where: { id: board.id }, data: { name: "Renamed" } });
    expect(await db.board.count()).toBe(1);
    await db.board.delete({ where: { id: board.id } });
    expect(await db.board.count()).toBe(0);
  });

  it("makes Activity append-only", async () => {
    const { ctx, workspace } = await seedMember("grants-a");
    const db = withTenant(ctx);
    const activity = await db.activity.create({
      data: {
        workspaceId: workspace.id,
        type: "task.created",
        entityType: "task",
        entityId: workspace.id,
      },
    });
    expect(await db.activity.count()).toBe(1);
    await expect(
      db.activity.update({ where: { id: activity.id }, data: { type: "task.deleted" } }),
    ).rejects.toThrow(PERMISSION_DENIED);
    await expect(db.activity.delete({ where: { id: activity.id } })).rejects.toThrow(
      PERMISSION_DENIED,
    );
  });

  it("makes AuditEvent insert-only", async () => {
    const actor = await createUser();
    // createMany sends no RETURNING clause, which an INSERT-only grant requires.
    await appDb.auditEvent.createMany({ data: [{ actorId: actor.id, action: "auth.sign_in" }] });
    expect(await adminDb.auditEvent.count()).toBe(1);

    await expect(appDb.auditEvent.findMany()).rejects.toThrow(PERMISSION_DENIED);
    await expect(appDb.auditEvent.updateMany({ data: { action: "x" } })).rejects.toThrow(
      PERMISSION_DENIED,
    );
    await expect(appDb.auditEvent.deleteMany()).rejects.toThrow(PERMISSION_DENIED);
  });

  it("cannot change the schema", async () => {
    await expect(appDb.$executeRaw`CREATE TABLE "Rogue" (id int)`).rejects.toThrow(
      /permission denied/,
    );
    await expect(appDb.$executeRaw`DROP TABLE "Task"`).rejects.toThrow(/must be owner/);
  });
});
