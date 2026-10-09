import { withTenant, withWorkspace } from "@/db/tenant";
import { createWorkspace } from "@/server/workspaces/membership-repository";
import { inspectCurrentRole, rlsExemptions } from "../../../scripts/rls-exemption";
import { adminDb, appDb, createUser, resetDb } from "../helpers/db";

const PERMISSION_DENIED = /permission denied/;
const RLS_VIOLATION = /row-level security/;

/** A user who owns a workspace with one board, arranged as the owner role (outside row-level security). */
async function seedTenant(slug: string) {
  const user = await createUser();
  const workspace = await adminDb.workspace.create({
    data: { name: slug, slug, createdById: user.id },
  });
  await adminDb.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
  });
  const board = await adminDb.board.create({
    data: { workspaceId: workspace.id, name: "Roadmap", position: "a0" },
  });
  return { user, workspace, board, ctx: { userId: user.id } };
}

type Tenant = Awaited<ReturnType<typeof seedTenant>>;

describe("row-level security", () => {
  let a: Tenant;
  let b: Tenant;

  beforeEach(async () => {
    await resetDb();
    a = await seedTenant("w-a");
    b = await seedTenant("w-b");
  });

  it("member sees own workspace rows", async () => {
    const db = withTenant(a.ctx);
    expect((await db.board.findMany()).map((board) => board.id)).toEqual([a.board.id]);
    expect((await db.workspace.findMany()).map((ws) => ws.id)).toEqual([a.workspace.id]);
  });

  it("other tenant sees nothing", async () => {
    const db = withTenant(b.ctx);
    expect((await db.board.findMany()).map((board) => board.id)).toEqual([b.board.id]);
    expect(await db.board.findFirst({ where: { id: a.board.id } })).toBeNull();
    expect(await db.workspace.findUnique({ where: { id: a.workspace.id } })).toBeNull();
    expect(await db.workspaceMember.findMany({ where: { workspaceId: a.workspace.id } })).toEqual(
      [],
    );
  });

  it("cannot write into another workspace", async () => {
    const db = withTenant(b.ctx);
    await expect(
      db.board.create({ data: { workspaceId: a.workspace.id, name: "Intrusion", position: "a1" } }),
    ).rejects.toThrow(RLS_VIOLATION);
    // Moving an own row into another workspace fails the policy's WITH CHECK.
    await expect(
      db.board.update({ where: { id: b.board.id }, data: { workspaceId: a.workspace.id } }),
    ).rejects.toThrow(RLS_VIOLATION);
    // Other tenants' rows are invisible to UPDATE and DELETE, so nothing is touched.
    expect(
      (await db.board.updateMany({ where: { id: a.board.id }, data: { name: "Hijacked" } })).count,
    ).toBe(0);
    expect((await db.board.deleteMany({ where: { id: a.board.id } })).count).toBe(0);
    await expect(
      db.workspaceMember.create({
        data: { workspaceId: a.workspace.id, userId: b.user.id, role: "OWNER" },
      }),
    ).rejects.toThrow(RLS_VIOLATION);

    const untouched = await adminDb.board.findUniqueOrThrow({ where: { id: a.board.id } });
    expect(untouched.name).toBe("Roadmap");
    expect(await adminDb.workspaceMember.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
  });

  it("only creates workspaces through app.create_workspace", async () => {
    await expect(
      withTenant(a.ctx).workspace.create({ data: { name: "Direct", slug: "direct" } }),
    ).rejects.toThrow(RLS_VIOLATION);
    await expect(
      appDb.$queryRaw`SELECT app.create_workspace('Anonymous', 'anonymous')`,
    ).rejects.toThrow(/tenant context/);
    expect(await adminDb.workspace.count()).toBe(2);
  });

  it("shows co-members only in workspaces the user belongs to", async () => {
    await adminDb.workspaceMember.create({
      data: { workspaceId: a.workspace.id, userId: b.user.id, role: "MEMBER" },
    });

    const seenByB = await withTenant(b.ctx).workspaceMember.findMany({
      select: { workspaceId: true, userId: true },
    });
    expect(seenByB).toHaveLength(3);
    expect(seenByB).toEqual(
      expect.arrayContaining([
        { workspaceId: a.workspace.id, userId: a.user.id },
        { workspaceId: a.workspace.id, userId: b.user.id },
        { workspaceId: b.workspace.id, userId: b.user.id },
      ]),
    );

    const seenByA = await withTenant(a.ctx).workspaceMember.findMany({
      select: { workspaceId: true, userId: true },
    });
    expect(seenByA).toHaveLength(2);
    expect(seenByA.every((member) => member.workspaceId === a.workspace.id)).toBe(true);
  });

  it("no context returns no rows", async () => {
    expect(await appDb.board.findMany()).toEqual([]);
    expect(await appDb.workspace.findMany()).toEqual([]);
    expect(await appDb.workspaceMember.findMany()).toEqual([]);
  });

  it("tenant context does not leak across queries", async () => {
    const [inside] = await withTenant(a.ctx).$queryRaw<{ pid: number; userId: string | null }[]>`
      SELECT pg_backend_pid() AS pid, app.current_user_id()::text AS "userId"`;
    expect(inside?.userId).toBe(a.user.id);

    // node-postgres hands out the most recently released connection, so this bare query reuses the one above.
    const [after] = await appDb.$queryRaw<{ pid: number; userId: string | null }[]>`
      SELECT pg_backend_pid() AS pid, current_setting('app.user_id', true) AS "userId"`;
    expect(after?.pid).toBe(inside?.pid);
    expect(after?.userId ?? "").toBe("");
    expect(await appDb.board.findMany()).toEqual([]);
  });

  it("rejects a user id that is not a UUID", () => {
    expect(() => withTenant({ userId: "' OR true --" })).toThrow(/UUID/);
    expect(() => withTenant({ userId: "" })).toThrow(/UUID/);
  });

  it("app role cannot bypass RLS", async () => {
    // Ownership counts through role membership too (Postgres checks has_privs_of_role), so a
    // `GRANT trask_migrator TO trask_app` would show up here as owner and memberOfMigrator.
    const role = await inspectCurrentRole(appDb);
    expect(role).toEqual({
      name: "trask_app",
      rolsuper: false,
      rolbypassrls: false,
      owner: false,
      memberOfMigrator: false,
    });
    expect(rlsExemptions(role)).toEqual([]);

    // The same check flags the owner role.
    expect(rlsExemptions(await inspectCurrentRole(adminDb))).toEqual([
      "trask_migrator has the privileges of a table or function owner",
      "trask_migrator is a member of trask_migrator",
    ]);
  });

  it("enables row-level security on every tenant table", async () => {
    // Every table that carries workspaceId, plus Workspace itself. AuditEvent is outside RLS by design (Ruling R5).
    const tables = await adminDb.$queryRaw<
      { table: string; rls: boolean; forced: boolean; policies: number }[]
    >`
      SELECT c.relname AS "table", c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
             (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
        AND (c.relname = 'Workspace' OR EXISTS (
          SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'workspaceId' AND NOT a.attisdropped))
        AND c.relname <> 'AuditEvent'
      ORDER BY c.relname`;
    expect(tables.map((t) => t.table)).toEqual([
      "Activity",
      "Attachment",
      "Board",
      "ChecklistItem",
      "Column",
      "Comment",
      "Label",
      "Task",
      "TaskLabel",
      "Workspace",
      "WorkspaceMember",
    ]);
    for (const table of tables) {
      expect(table, table.table).toMatchObject({ rls: true, forced: false });
      expect(table.policies, table.table).toBeGreaterThan(0);
    }

    // Every policy filters on membership AND the transaction's workspace (when set): USING always, WITH CHECK
    // wherever rows can be written (Ruling R39).
    const policies = await adminDb.$queryRaw<
      { table: string; name: string; cmd: string; qual: string | null; withCheck: string | null }[]
    >`
      SELECT tablename AS "table", policyname AS name, cmd, qual, with_check AS "withCheck"
      FROM pg_policies WHERE schemaname = 'public'`;
    expect(policies).toHaveLength(13);
    for (const policy of policies) {
      const label = `${policy.table}.${policy.name}`;
      const key = policy.table === "Workspace" ? "id" : '"workspaceId"';
      const expected = `(app.is_member(${key}) AND ((app.current_workspace_id() IS NULL) OR (${key} = app.current_workspace_id())))`;
      expect(policy.qual, label).toBe(expected);
      if (policy.cmd === "ALL" || policy.cmd === "UPDATE")
        expect(policy.withCheck, label).toBe(expected);
    }
  });

  it("runs the membership functions as the owner with a pinned search_path and no PUBLIC execute", async () => {
    const functions = await adminDb.$queryRaw<
      {
        name: string;
        definer: boolean;
        owner: string;
        config: string[] | null;
        publicExecute: boolean;
      }[]
    >`
      SELECT p.proname AS name, p.prosecdef AS definer, pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config,
             p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) acl WHERE acl.grantee = 0) AS "publicExecute"
      FROM pg_proc p WHERE p.pronamespace = 'app'::regnamespace ORDER BY p.proname`;
    expect(functions.map((fn) => fn.name)).toEqual([
      "create_workspace",
      "current_user_id",
      "current_workspace_id",
      "is_member",
    ]);
    for (const fn of functions) {
      expect(fn, fn.name).toMatchObject({ owner: "trask_migrator", publicExecute: false });
    }
    for (const fn of functions.filter((f) => !f.name.startsWith("current_"))) {
      expect(fn, fn.name).toMatchObject({ definer: true, config: ["search_path=public, pg_temp"] });
    }

    const [schema] = await adminDb.$queryRaw<{ owner: string; appCanCreate: boolean }[]>`
      SELECT pg_get_userbyid(nspowner) AS owner, has_schema_privilege('trask_app', oid, 'CREATE') AS "appCanCreate"
      FROM pg_namespace WHERE nspname = 'app'`;
    expect(schema).toEqual({ owner: "trask_migrator", appCanCreate: false });
  });

  it("audit events are append-only", async () => {
    const db = withTenant(a.ctx);
    // createMany sends no RETURNING clause, which the INSERT-only grant requires.
    await db.auditEvent.createMany({
      data: [{ workspaceId: a.workspace.id, actorId: a.user.id, action: "workspace.viewed" }],
    });
    expect(await adminDb.auditEvent.count()).toBe(1);

    await expect(db.auditEvent.findMany()).rejects.toThrow(PERMISSION_DENIED);
    await expect(db.auditEvent.updateMany({ data: { action: "x" } })).rejects.toThrow(
      PERMISSION_DENIED,
    );
    await expect(db.auditEvent.deleteMany()).rejects.toThrow(PERMISSION_DENIED);
    await expect(appDb.auditEvent.findMany()).rejects.toThrow(PERMISSION_DENIED);
  });
});

describe("workspace-scoped row-level security (Ruling R39)", () => {
  // U is OWNER of W1 and VIEWER of W2. createAction authorizes one workspace, so a repository running for U in W1
  // must not reach W2's rows even though U is a member there.
  let user: { id: string };
  let w1: { workspaceId: string; boardId: string };
  let w2: { workspaceId: string; boardId: string };

  async function boardIn(workspaceId: string, name: string): Promise<string> {
    const board = await adminDb.board.create({ data: { workspaceId, name, position: "a0" } });
    return board.id;
  }

  beforeEach(async () => {
    await resetDb();
    user = await createUser();
    const other = await createUser();
    const ws1 = await createWorkspace({ userId: user.id }, { name: "One", slug: "w-one" });
    const ws2 = await createWorkspace({ userId: other.id }, { name: "Two", slug: "w-two" });
    await adminDb.workspaceMember.create({
      data: { workspaceId: ws2.id, userId: user.id, role: "VIEWER" },
    });
    w1 = { workspaceId: ws1.id, boardId: await boardIn(ws1.id, "Roadmap one") };
    w2 = { workspaceId: ws2.id, boardId: await boardIn(ws2.id, "Roadmap two") };
  });

  it("cannot read, update or delete another workspace's rows, even as its member", async () => {
    const db = withWorkspace({ userId: user.id, workspaceId: w1.workspaceId });
    expect((await db.board.findMany()).map((board) => board.id)).toEqual([w1.boardId]);
    expect(await db.board.findFirst({ where: { id: w2.boardId } })).toBeNull();
    expect((await db.workspace.findMany()).map((ws) => ws.id)).toEqual([w1.workspaceId]);
    expect(
      (await db.workspaceMember.findMany()).every((m) => m.workspaceId === w1.workspaceId),
    ).toBe(true);

    expect(
      (await db.board.updateMany({ where: { id: w2.boardId }, data: { name: "Hijacked" } })).count,
    ).toBe(0);
    expect((await db.board.deleteMany({ where: { id: w2.boardId } })).count).toBe(0);
    expect(
      (await db.workspace.updateMany({ where: { id: w2.workspaceId }, data: { name: "Mine" } }))
        .count,
    ).toBe(0);

    const untouched = await adminDb.board.findUniqueOrThrow({ where: { id: w2.boardId } });
    expect(untouched.name).toBe("Roadmap two");
    expect(
      await adminDb.workspace.findUniqueOrThrow({ where: { id: w2.workspaceId } }),
    ).toMatchObject({ name: "Two" });
  });

  it("cannot insert into or move rows into another workspace", async () => {
    const db = withWorkspace({ userId: user.id, workspaceId: w1.workspaceId });
    await expect(
      db.board.create({ data: { workspaceId: w2.workspaceId, name: "Intrusion", position: "a1" } }),
    ).rejects.toThrow(RLS_VIOLATION);
    await expect(
      db.board.update({ where: { id: w1.boardId }, data: { workspaceId: w2.workspaceId } }),
    ).rejects.toThrow(RLS_VIOLATION);
    expect(await adminDb.board.count({ where: { workspaceId: w2.workspaceId } })).toBe(1);
  });

  it("reads and writes the workspace it is scoped to", async () => {
    const inW2 = withWorkspace({ userId: user.id, workspaceId: w2.workspaceId });
    expect((await inW2.board.findMany()).map((board) => board.id)).toEqual([w2.boardId]);
    expect(await inW2.board.findFirst({ where: { id: w1.boardId } })).toBeNull();

    const inW1 = withWorkspace({ userId: user.id, workspaceId: w1.workspaceId });
    await inW1.board.create({
      data: { workspaceId: w1.workspaceId, name: "Next", position: "a1" },
    });
    expect(await adminDb.board.count({ where: { workspaceId: w1.workspaceId } })).toBe(2);
  });

  it("sees nothing in a workspace the user is not a member of", async () => {
    const stranger = await createUser();
    const db = withWorkspace({ userId: stranger.id, workspaceId: w1.workspaceId });
    expect(await db.board.findMany()).toEqual([]);
    expect(await db.workspace.findMany()).toEqual([]);
  });

  it("keeps withTenant for reads across the user's workspaces", async () => {
    const boards = await withTenant({ userId: user.id }).board.findMany({ select: { id: true } });
    expect(boards.map((board) => board.id).sort()).toEqual([w1.boardId, w2.boardId].sort());
  });

  it("normalizes the workspace id to lowercase and rejects malformed ids", async () => {
    const db = withWorkspace({ userId: user.id, workspaceId: w1.workspaceId.toUpperCase() });
    const [row] = await db.$queryRaw<{ workspaceId: string | null }[]>`
      SELECT current_setting('app.workspace_id', true) AS "workspaceId"`;
    expect(row?.workspaceId).toBe(w1.workspaceId);
    expect((await db.board.findMany()).map((board) => board.id)).toEqual([w1.boardId]);

    expect(() => withWorkspace({ userId: user.id, workspaceId: "' OR true --" })).toThrow(/UUID/);
    expect(() => withWorkspace({ userId: "", workspaceId: w1.workspaceId })).toThrow(/UUID/);
  });

  it("no context still returns no rows", async () => {
    expect(await appDb.board.findMany()).toEqual([]);
    expect(await appDb.workspace.findMany()).toEqual([]);
  });

  it("workspace context does not leak across pooled queries", async () => {
    const [inside] = await withWorkspace({ userId: user.id, workspaceId: w1.workspaceId })
      .$queryRaw<
      { pid: number; workspaceId: string | null }[]
    >`SELECT pg_backend_pid() AS pid, app.current_workspace_id()::text AS "workspaceId"`;
    expect(inside?.workspaceId).toBe(w1.workspaceId);

    // node-postgres hands out the most recently released connection, so these bare queries reuse the one above.
    const [after] = await appDb.$queryRaw<
      { pid: number; userId: string | null; workspaceId: string | null }[]
    >`
      SELECT pg_backend_pid() AS pid, current_setting('app.user_id', true) AS "userId",
             current_setting('app.workspace_id', true) AS "workspaceId"`;
    expect(after?.pid).toBe(inside?.pid);
    expect(after?.userId ?? "").toBe("");
    expect(after?.workspaceId ?? "").toBe("");

    // A cross-workspace read on the same connection right after is not narrowed by the earlier workspace scope.
    const [tenant] = await withTenant({ userId: user.id }).$queryRaw<
      { pid: number; workspaceId: string | null }[]
    >`SELECT pg_backend_pid() AS pid, app.current_workspace_id()::text AS "workspaceId"`;
    expect(tenant?.pid).toBe(inside?.pid);
    expect(tenant?.workspaceId).toBeNull();
  });
});
