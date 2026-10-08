-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ColumnKind" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "taskSequence" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" TEXT NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Column" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "kind" "ColumnKind" NOT NULL,
    "wipLimit" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Column_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "columnId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NONE',
    "position" TEXT NOT NULL,
    "assigneeId" UUID,
    "dueAt" TIMESTAMPTZ(3),
    "startAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "estimate" INTEGER,
    "parentTaskId" UUID,
    "archivedAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLabel" (
    "workspaceId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "labelId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TaskLabel_pkey" PRIMARY KEY ("taskId","labelId")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "position" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "uploaderId" UUID,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "boardId" UUID,
    "taskId" UUID,
    "actorId" UUID,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgentHash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_id_workspaceId_key" ON "WorkspaceMember"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Board_workspaceId_archivedAt_idx" ON "Board"("workspaceId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Board_id_workspaceId_key" ON "Board"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Column_boardId_position_idx" ON "Column"("boardId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Column_id_workspaceId_key" ON "Column"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Task_columnId_position_idx" ON "Task"("columnId", "position");

-- CreateIndex
CREATE INDEX "Task_boardId_idx" ON "Task"("boardId");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_assigneeId_idx" ON "Task"("workspaceId", "assigneeId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_dueAt_idx" ON "Task"("workspaceId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_id_workspaceId_key" ON "Task"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_workspaceId_number_key" ON "Task"("workspaceId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Label_id_workspaceId_key" ON "Label"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Label_workspaceId_name_key" ON "Label"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "TaskLabel_labelId_idx" ON "TaskLabel"("labelId");

-- CreateIndex
CREATE INDEX "ChecklistItem_taskId_position_idx" ON "ChecklistItem"("taskId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_id_workspaceId_key" ON "ChecklistItem"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Comment_taskId_createdAt_idx" ON "Comment"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_id_workspaceId_key" ON "Comment"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Attachment_taskId_idx" ON "Attachment"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_id_workspaceId_key" ON "Attachment"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Activity_workspaceId_createdAt_idx" ON "Activity"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_taskId_createdAt_idx" ON "Activity"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_id_workspaceId_key" ON "Activity"("id", "workspaceId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Column" ADD CONSTRAINT "Column_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Column" ADD CONSTRAINT "Column_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_columnId_workspaceId_fkey" FOREIGN KEY ("columnId", "workspaceId") REFERENCES "Column"("id", "workspaceId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- Hand-edited: the column list (PostgreSQL 15+) nulls only parentTaskId, never workspaceId.
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_workspaceId_fkey" FOREIGN KEY ("parentTaskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE SET NULL ("parentTaskId") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_labelId_workspaceId_fkey" FOREIGN KEY ("labelId", "workspaceId") REFERENCES "Label"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Least-privilege grants for the runtime role (hand-written; Prisma does not manage grants).
-- trask_app is DML-only and never the owner. Activity is append-only and AuditEvent is insert-only by grant.
GRANT USAGE ON SCHEMA public TO trask_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "User", "Workspace", "WorkspaceMember", "Board", "Column", "Task", "Label", "TaskLabel",
  "ChecklistItem", "Comment", "Attachment"
TO trask_app;

GRANT SELECT, INSERT ON TABLE "Activity" TO trask_app;

GRANT INSERT ON TABLE "AuditEvent" TO trask_app;

-- Tables added by later migrations (run as trask_migrator) get ordinary DML for trask_app by default.
ALTER DEFAULT PRIVILEGES FOR ROLE trask_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trask_app;
