import { existsSync } from "node:fs";

// Integration tests talk to the local test Postgres from docker-compose. Variables already set (for example by CI) win.
if (existsSync(".env.test")) process.loadEnvFile(".env.test");
