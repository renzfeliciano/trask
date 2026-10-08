-- Row-level security: the database guarantees that trask_app only reads and writes rows of workspaces the current
-- user belongs to, even if application code forgets a filter. Hand-written; Prisma does not manage RLS.
--
-- How it works:
--   * The app sets `app.user_id` with set_config(..., is_local => true) in the same transaction as each query
--     (src/db/tenant.ts). It reverts at COMMIT/ROLLBACK, so it never survives on a pooled connection.
--   * Without that setting app.current_user_id() is NULL, app.is_member() is false, and every policy hides every row.
--   * RLS is ENABLEd, not FORCEd: trask_app is not the table owner, so policies always apply to it, while the
--     SECURITY DEFINER functions below run as the owner (trask_migrator) and read WorkspaceMember without recursing
--     into its own policy.
--   * AuditEvent stays outside RLS: trask_app can only INSERT into it (Ruling R5).

-- Helper functions live in their own schema, owned by the migrator. trask_app may call them, never create objects there.
CREATE SCHEMA app AUTHORIZATION trask_migrator;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO trask_app;

-- The user the current transaction acts for, or NULL when no tenant context is set.
CREATE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- True when the current user is a member of workspace `ws`. SECURITY DEFINER so that policies on WorkspaceMember can
-- call it without recursion; the pinned search_path stops a caller from shadowing the tables it reads.
CREATE FUNCTION app.is_member(ws uuid) RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public."WorkspaceMember" m
      WHERE m."workspaceId" = ws AND m."userId" = app.current_user_id()
    )
  $$;

-- The only way trask_app can create a workspace: the current user (never a caller-chosen one) becomes its OWNER.
CREATE FUNCTION app.create_workspace(p_name text, p_slug text) RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    DECLARE
      v_user uuid := app.current_user_id();
      v_workspace uuid := uuidv7();
    BEGIN
      IF v_user IS NULL THEN
        RAISE EXCEPTION 'app.create_workspace requires a tenant context (app.user_id is not set)'
          USING ERRCODE = 'insufficient_privilege';
      END IF;

      INSERT INTO public."Workspace" (id, name, slug, "createdById", "updatedAt")
      VALUES (v_workspace, p_name, p_slug, v_user, now());

      INSERT INTO public."WorkspaceMember" (id, "workspaceId", "userId", role, "updatedAt")
      VALUES (uuidv7(), v_workspace, v_user, 'OWNER', now());

      RETURN v_workspace;
    END
  $$;

ALTER FUNCTION app.current_user_id() OWNER TO trask_migrator;
ALTER FUNCTION app.is_member(uuid) OWNER TO trask_migrator;
ALTER FUNCTION app.create_workspace(text, text) OWNER TO trask_migrator;

-- Functions are executable by PUBLIC by default; only trask_app gets them.
REVOKE EXECUTE ON FUNCTION app.current_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.is_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.create_workspace(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO trask_app;
GRANT EXECUTE ON FUNCTION app.is_member(uuid) TO trask_app;
GRANT EXECUTE ON FUNCTION app.create_workspace(text, text) TO trask_app;

-- Workspace: visible, editable and deletable by its members. No INSERT policy: creation goes through
-- app.create_workspace, which also writes the OWNER membership.
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON "Workspace" FOR SELECT USING (app.is_member(id));
CREATE POLICY tenant_isolation_update ON "Workspace" FOR UPDATE USING (app.is_member(id)) WITH CHECK (app.is_member(id));
CREATE POLICY tenant_isolation_delete ON "Workspace" FOR DELETE USING (app.is_member(id));

-- Every table that carries workspaceId (AuditEvent excepted, see above).
ALTER TABLE "WorkspaceMember" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WorkspaceMember" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "Board" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Board" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "Column" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Column" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Task" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "Label" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Label" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "TaskLabel" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TaskLabel" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ChecklistItem" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Comment" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Attachment" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));

ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Activity" USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"));
