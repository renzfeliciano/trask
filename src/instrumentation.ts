// Next calls register() once when the server starts, before it takes traffic. Validating the environment here makes a
// deploy with a missing or malformed variable stop at start-up instead of failing on the first request that needs it.
export async function register(): Promise<void> {
  // The edge runtime has no Node env, and `next build` runs without secrets (page-data collection calls register too).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // A separate module, so the edge bundle of this file never sees process.exit.
  const { exitOnInvalidEnv } = await import("./instrumentation-node");
  exitOnInvalidEnv();
}
