import "server-only";
import { getDb } from "@/db/client";

/** Whether the database answers `SELECT 1` within `timeoutMs`. Never throws: errors and timeouts both mean false. */
export async function pingDatabase(timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
  });
  try {
    const query = Promise.resolve(getDb().$queryRaw`SELECT 1`).then(() => true as const);
    // If the timeout wins, the query may still reject later; that must not become an unhandled rejection.
    query.catch(() => undefined);
    return await Promise.race([query, timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
