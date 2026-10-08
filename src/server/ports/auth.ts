import "server-only";

/** Who is making the request. Phase 0 has only this port; the Better Auth adapter arrives in Phase 1. */
export interface AuthPort {
  getSession(): Promise<{ userId: string; emailVerified: boolean } | null>;
}
