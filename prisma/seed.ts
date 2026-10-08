// Development and test seed. Run with `pnpm db:seed`; the guard refuses production before anything touches the database.
import { assertSeedAllowed } from "@/server/seed/guard";

// Scripts outside Next do not get .env loaded for them (.env.example sets NODE_ENV=development for this). Variables
// already in the environment win.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// Next's ambient types declare NODE_ENV as always set; a bare `tsx` run can leave it unset, which the guard refuses.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- unset at runtime despite the type
assertSeedAllowed(process.env.NODE_ENV ?? "");

// Demo data (realistic boards, tasks and a demo account) arrives in Phase 1.
console.info("Seed: nothing to insert yet.");
