-- Composite tenant foreign keys refuse key updates (Ruling R23). With ON UPDATE CASCADE, changing a parent's
-- workspaceId would rewrite its whole subtree into another workspace, and referential actions bypass row-level security.

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_taskId_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistItem" DROP CONSTRAINT "ChecklistItem_taskId_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Column" DROP CONSTRAINT "Column_boardId_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_taskId_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_boardId_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_columnId_boardId_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_parentTaskId_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "TaskLabel" DROP CONSTRAINT "TaskLabel_labelId_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "TaskLabel" DROP CONSTRAINT "TaskLabel_taskId_workspaceId_fkey";

-- AddForeignKey
ALTER TABLE "Column" ADD CONSTRAINT "Column_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_boardId_workspaceId_fkey" FOREIGN KEY ("boardId", "workspaceId") REFERENCES "Board"("id", "workspaceId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_columnId_boardId_workspaceId_fkey" FOREIGN KEY ("columnId", "boardId", "workspaceId") REFERENCES "Column"("id", "boardId", "workspaceId") ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
-- Hand-edited (as in the init migration): the column list nulls only parentTaskId, never workspaceId.
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_workspaceId_fkey" FOREIGN KEY ("parentTaskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE SET NULL ("parentTaskId") ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_labelId_workspaceId_fkey" FOREIGN KEY ("labelId", "workspaceId") REFERENCES "Label"("id", "workspaceId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_taskId_workspaceId_fkey" FOREIGN KEY ("taskId", "workspaceId") REFERENCES "Task"("id", "workspaceId") ON DELETE CASCADE ON UPDATE RESTRICT;
