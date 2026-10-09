# Secret rotation runbook

Use this when a secret may have leaked: gitleaks flags a commit, a value was pasted into a chat, issue or
log, a laptop is lost, or someone who had access leaves. **Rotate first, investigate second.** Deleting
a commit does not un-leak a secret.

Secrets in TRASK: the two database passwords (`DATABASE_URL`, `MIGRATION_DATABASE_URL`),
`ENCRYPTION_KEY`, the Neon account and its API keys, and the GitHub account and its tokens. The values in
`.env.test` are test-only and public by design; never reuse them anywhere else.

## `DATABASE_URL` (`trask_app`)

Neon keeps role passwords per branch. Rotate on every branch the leaked URL belongs to.

1. Generate a password: `openssl rand -hex 24` (hex avoids characters that need escaping in URLs).
2. In the Neon SQL editor on that branch, as `neondb_owner`:
   ```sql
   ALTER ROLE trask_app WITH PASSWORD '<new>';
   ```
   (The Neon console's "Reset password" for the role does the same.)
3. Production (`main`): update `DATABASE_URL` in Vercel > Settings > Environment Variables, then
   redeploy (Vercel applies env changes only to new deployments). Between steps 2 and 3 new connections
   fail and `/api/health` answers 503; keep that window short.
4. Close sessions that were opened with the old password:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE usename = 'trask_app' AND pid <> pg_backend_pid();
   ```
5. Update your local `.env` for `dev`.
6. Check: `/api/health` returns `{"status":"ok"}`; `scripts/verify-db-roles.ts` with the new URL prints
   `rolbypassrls=false, owner=false`.

## `MIGRATION_DATABASE_URL` (`trask_migrator`)

The migrator owns the schema, so treat a leak as a possible schema change.

1. `ALTER ROLE trask_migrator WITH PASSWORD '<new>';` on each affected branch, then terminate its
   sessions (step 4 above with `usename = 'trask_migrator'`).
2. Update `.env` and wherever `pnpm db:deploy` runs. It is never in Vercel.
3. Look for tampering, with `.env` pointing at the affected branch:
   - `pnpm exec prisma migrate status` reports no unknown migrations;
   - `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
     prints `-- This is an empty migration.`;
   - `scripts/verify-db-roles.ts` with the `trask_app` URL passes.

   Prisma does not compare RLS policies, grants or the `app` functions. Review them in the Neon SQL
   editor against `prisma/migrations/`: `SELECT * FROM pg_policies;` and
   `SELECT proname, prosecdef, proconfig FROM pg_proc WHERE pronamespace = 'app'::regnamespace;`.

4. If anything looks wrong, restore the branch with Neon's point-in-time restore to before the leak.

## `ENCRYPTION_KEY`

Phase 0 stores nothing encrypted, so today rotation is: generate a new key
(`node -e "console.log(crypto.randomBytes(32).toString('base64'))"`), set it in Vercel and `.env`,
redeploy.

Once encrypted values exist: payloads look like `v1.<iv>.<tag>.<ciphertext>` and carry no key id, so a
new key cannot read old data. Rotation then needs a one-off script that decrypts each value with the old
key and re-encrypts it with the new one, in a transaction, before the old key is removed. Add key ids
(or a `v2` format) before the first feature stores encrypted data.

## Neon account

Change the password, review project members, and revoke API keys in Neon > Account settings > API keys.
Then rotate both role passwords above: the owner can read them.

## GitHub

- **Personal access tokens:** revoke in Settings > Developer settings; create new ones with the smallest
  scope and an expiry.
- **A secret committed to the repository:** rotate it (sections above) first. Rewriting history
  (`git filter-repo`) is optional cleanup, needs branch protection lifted for the force push, and does
  not remove forks, clones or cached views; ask GitHub Support to purge cached views if needed.
- **CI:** the Phase 0 workflow uses no repository secrets, and its `GITHUB_TOKEN` is read-only
  (`permissions: contents: read`). If Renovate or another app is suspected, uninstall it in
  Settings > Integrations, then reinstall.
- Keep two-factor authentication on the account.

## Afterwards

Write down what leaked, when, how it was found and what was rotated, in a private security advisory on
the repository. If user data may have been read, that becomes an incident with its own notifications.
