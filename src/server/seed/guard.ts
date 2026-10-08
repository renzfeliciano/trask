import "server-only";

// An allow-list, so an unset or misspelled NODE_ENV is refused rather than treated as safe.
const SEEDABLE_ENVIRONMENTS: readonly string[] = ["development", "test"];

/** Throws unless the seed script may write demo data in this environment. Production is always refused. */
export function assertSeedAllowed(nodeEnv: string): void {
  if (SEEDABLE_ENVIRONMENTS.includes(nodeEnv)) return;
  throw new Error(
    `Refusing to seed: NODE_ENV must be "development" or "test", got ${JSON.stringify(nodeEnv)}. Seeding never runs in production.`,
  );
}
