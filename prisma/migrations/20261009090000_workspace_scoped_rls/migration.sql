-- Workspace-scoped row-level security (Ruling R39). createAction authorizes the caller's role in ONE workspace, but the
-- policies only asked "is the user a member of the row's workspace", i.e. of ANY of their workspaces. An OWNER of W1 who
-- is a VIEWER of W2 could pass { workspaceId: W1, boardId: <a W2 board> } and the database would accept the write to W2.
--
-- Repositories for workspace-owned data now run through withWorkspace(ctx) (src/db/tenant.ts), which sets
-- `app.workspace_id` next to `app.user_id`, transaction-locally. Every tenant policy additionally requires the row to
-- belong to that workspace whenever it is set. withTenant (no workspace) keeps the membership-only rule for reads that
-- span the user's workspaces (list my workspaces and memberships).

-- The workspace the current transaction is scoped to, or NULL when only a user context is set.
CREATE FUNCTION app.current_workspace_id() RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $$ SELECT nullif(current_setting('app.workspace_id', true), '')::uuid $$;

ALTER FUNCTION app.current_workspace_id() OWNER TO trask_migrator;
REVOKE EXECUTE ON FUNCTION app.current_workspace_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_workspace_id() TO trask_app;

-- Workspace: still no INSERT policy (creation goes through app.create_workspace).
ALTER POLICY tenant_isolation_select ON "Workspace"
  USING (app.is_member(id) AND (app.current_workspace_id() IS NULL OR id = app.current_workspace_id()));

ALTER POLICY tenant_isolation_update ON "Workspace"
  USING (app.is_member(id) AND (app.current_workspace_id() IS NULL OR id = app.current_workspace_id()))
  WITH CHECK (app.is_member(id) AND (app.current_workspace_id() IS NULL OR id = app.current_workspace_id()));

ALTER POLICY tenant_isolation_delete ON "Workspace"
  USING (app.is_member(id) AND (app.current_workspace_id() IS NULL OR id = app.current_workspace_id()));

-- Every table that carries workspaceId (AuditEvent stays outside RLS, Ruling R5).
ALTER POLICY tenant_isolation ON "WorkspaceMember"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "Board"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "Column"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "Task"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "Label"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "TaskLabel"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "ChecklistItem"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "Comment"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "Attachment"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));

ALTER POLICY tenant_isolation ON "Activity"
  USING (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()))
  WITH CHECK (app.is_member("workspaceId") AND (app.current_workspace_id() IS NULL OR "workspaceId" = app.current_workspace_id()));
