import { defineConfig } from "prisma/config";

// Prisma 7 does not read .env files itself. Under NODE_ENV=test the local test database settings are used.
try {
  process.loadEnvFile(process.env["NODE_ENV"] === "test" ? ".env.test" : ".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const migrationUrl = process.env["MIGRATION_DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Migrations run as trask_migrator over the direct connection. The URL is left out (not env()) when unset so
    // `prisma generate` works on a fresh checkout and in CI without any database settings.
    ...(migrationUrl === undefined ? {} : { url: migrationUrl }),
  },
});
