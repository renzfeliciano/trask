-- Test and local Postgres bootstrap. Passwords here are test-only and match .env.test.
-- Production and Neon roles use generated passwords and only the two CREATE ROLE statements below.
-- Keep this file to plain one-statement-per-line SQL so it also runs outside psql.

-- Owns the database and the schema objects, runs migrations. CREATEDB lets `prisma migrate dev` make its shadow database (local and test only).
CREATE ROLE trask_migrator LOGIN PASSWORD 'trask_migrator_test' NOSUPERUSER NOCREATEROLE NOBYPASSRLS CREATEDB;

-- Runtime role: DML only, never the owner, never bypasses row-level security.
CREATE ROLE trask_app LOGIN PASSWORD 'trask_app_test' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;

CREATE DATABASE trask_test OWNER trask_migrator;

REVOKE ALL ON DATABASE trask_test FROM PUBLIC;

GRANT CONNECT ON DATABASE trask_test TO trask_app;
