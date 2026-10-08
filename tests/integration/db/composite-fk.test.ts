import { adminDb, createUser, resetDb } from "../helpers/db";

async function seedWorkspace(slug: string) {
  const workspace = await adminDb.workspace.create({ data: { name: slug, slug } });
  const board = await adminDb.board.create({
    data: { workspaceId: workspace.id, name: "Board", position: "a0" },
  });
  const column = await adminDb.column.create({
    data: {
      workspaceId: workspace.id,
      boardId: board.id,
      name: "To do",
      position: "a0",
      kind: "TODO",
    },
  });
  const label = await adminDb.label.create({
    data: { workspaceId: workspace.id, name: "Bug", color: "#F87171" },
  });
  return { workspace, board, column, label };
}

type Seed = Awaited<ReturnType<typeof seedWorkspace>>;

function taskData(seed: Seed, number: number, extra: Record<string, unknown> = {}) {
  return {
    workspaceId: seed.workspace.id,
    boardId: seed.board.id,
    columnId: seed.column.id,
    number,
    title: `Task ${String(number)}`,
    position: "a0",
    ...extra,
  };
}

const FOREIGN_KEY_VIOLATION = { code: "P2003" };

describe("composite foreign keys", () => {
  beforeEach(resetDb);

  it("accepts a task whose board and column belong to its own workspace", async () => {
    const w1 = await seedWorkspace("w1");
    const task = await adminDb.task.create({ data: taskData(w1, 1) });
    expect(task.workspaceId).toBe(w1.workspace.id);
  });

  it("rejects a task whose column belongs to another workspace", async () => {
    const w1 = await seedWorkspace("w1");
    const w2 = await seedWorkspace("w2");
    await expect(
      adminDb.task.create({ data: taskData(w1, 1, { columnId: w2.column.id }) }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("rejects a task whose board belongs to another workspace", async () => {
    const w1 = await seedWorkspace("w1");
    const w2 = await seedWorkspace("w2");
    await expect(
      adminDb.task.create({ data: taskData(w1, 1, { boardId: w2.board.id }) }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("rejects a task whose column belongs to another board of the same workspace", async () => {
    const w1 = await seedWorkspace("w1");
    const otherBoard = await adminDb.board.create({
      data: { workspaceId: w1.workspace.id, name: "Other", position: "a1" },
    });
    const otherColumn = await adminDb.column.create({
      data: {
        workspaceId: w1.workspace.id,
        boardId: otherBoard.id,
        name: "To do",
        position: "a0",
        kind: "TODO",
      },
    });
    await expect(
      adminDb.task.create({ data: taskData(w1, 1, { columnId: otherColumn.id }) }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("rejects a column placed on another workspace's board", async () => {
    const w1 = await seedWorkspace("w1");
    const w2 = await seedWorkspace("w2");
    await expect(
      adminDb.column.create({
        data: {
          workspaceId: w1.workspace.id,
          boardId: w2.board.id,
          name: "Doing",
          position: "a1",
          kind: "IN_PROGRESS",
        },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("rejects a task label that links another workspace's label", async () => {
    const w1 = await seedWorkspace("w1");
    const w2 = await seedWorkspace("w2");
    const task = await adminDb.task.create({ data: taskData(w1, 1) });

    await expect(
      adminDb.taskLabel.create({
        data: { workspaceId: w1.workspace.id, taskId: task.id, labelId: w2.label.id },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);

    const own = await adminDb.taskLabel.create({
      data: { workspaceId: w1.workspace.id, taskId: task.id, labelId: w1.label.id },
    });
    expect(own.labelId).toBe(w1.label.id);
  });

  it("rejects a checklist item, comment and attachment on another workspace's task", async () => {
    const w1 = await seedWorkspace("w1");
    const w2 = await seedWorkspace("w2");
    const foreignTask = await adminDb.task.create({ data: taskData(w2, 1) });

    await expect(
      adminDb.checklistItem.create({
        data: {
          workspaceId: w1.workspace.id,
          taskId: foreignTask.id,
          content: "x",
          position: "a0",
        },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
    await expect(
      adminDb.comment.create({
        data: { workspaceId: w1.workspace.id, taskId: foreignTask.id, body: "x" },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
    await expect(
      adminDb.attachment.create({
        data: {
          workspaceId: w1.workspace.id,
          taskId: foreignTask.id,
          storageKey: "k",
          fileName: "f.txt",
          mimeType: "text/plain",
          sizeBytes: 1,
          sha256: "0".repeat(64),
        },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("rejects a parent task from another workspace", async () => {
    const w1 = await seedWorkspace("w1");
    const w2 = await seedWorkspace("w2");
    const foreignParent = await adminDb.task.create({ data: taskData(w2, 1) });
    await expect(
      adminDb.task.create({ data: taskData(w1, 1, { parentTaskId: foreignParent.id }) }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("clears only parentTaskId when a parent task is deleted", async () => {
    const w1 = await seedWorkspace("w1");
    const parent = await adminDb.task.create({ data: taskData(w1, 1) });
    const child = await adminDb.task.create({ data: taskData(w1, 2, { parentTaskId: parent.id }) });

    await adminDb.task.delete({ where: { id: parent.id } });

    const after = await adminDb.task.findUniqueOrThrow({ where: { id: child.id } });
    expect(after.parentTaskId).toBeNull();
    expect(after.workspaceId).toBe(w1.workspace.id);
  });

  it("keeps a task and clears the assignee when the user is deleted", async () => {
    const w1 = await seedWorkspace("w1");
    const user = await createUser();
    const task = await adminDb.task.create({
      data: taskData(w1, 1, { assigneeId: user.id, createdById: user.id }),
    });

    await adminDb.user.delete({ where: { id: user.id } });

    const after = await adminDb.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.assigneeId).toBeNull();
    expect(after.createdById).toBeNull();
  });

  it("refuses to delete a column that still holds tasks", async () => {
    const w1 = await seedWorkspace("w1");
    await adminDb.task.create({ data: taskData(w1, 1) });
    await expect(adminDb.column.delete({ where: { id: w1.column.id } })).rejects.toMatchObject(
      FOREIGN_KEY_VIOLATION,
    );
  });

  it("cascades a workspace deletion to its boards, columns and tasks and leaves other workspaces alone", async () => {
    const w1 = await seedWorkspace("w1");
    const w2 = await seedWorkspace("w2");
    await adminDb.task.create({ data: taskData(w1, 1) });
    await adminDb.task.create({ data: taskData(w2, 1) });

    await adminDb.workspace.delete({ where: { id: w1.workspace.id } });

    const where = { workspaceId: w1.workspace.id };
    expect(await adminDb.board.count({ where })).toBe(0);
    expect(await adminDb.column.count({ where })).toBe(0);
    expect(await adminDb.task.count({ where })).toBe(0);
    expect(await adminDb.label.count({ where })).toBe(0);
    expect(await adminDb.task.count({ where: { workspaceId: w2.workspace.id } })).toBe(1);
  });
});
