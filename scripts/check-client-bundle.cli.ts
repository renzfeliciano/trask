// Entry point for `pnpm check:bundle`. Deliberately unconditional: no "is this the main module" guard, so it still runs
// when invoked through a symlinked path. The logic lives in check-client-bundle.ts.
import { runCheck } from "./check-client-bundle";

process.exitCode = await runCheck({ cwd: process.cwd(), env: process.env });
