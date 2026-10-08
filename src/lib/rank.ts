import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

// fractional-indexing 4.x accepts its bounds in either order; callers here must always pass them
// ascending, so a swapped or equal pair is a bug in the caller and is rejected loudly.
function assertAscending(before: string | null, after: string | null): void {
  if (before !== null && after !== null && before >= after) {
    throw new RangeError("rank: `before` must sort strictly below `after`");
  }
}

/** Returns an ordering key that sorts strictly between `before` and `after` (null = open end). */
export function rankBetween(before: string | null, after: string | null): string {
  assertAscending(before, after);
  return generateKeyBetween(before, after);
}

/** Returns `count` strictly increasing ordering keys that all sort between `before` and `after`. */
export function ranksBetween(count: number, before: string | null, after: string | null): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("rank: `count` must be a non-negative integer");
  }
  assertAscending(before, after);
  return generateNKeysBetween(before, after, count);
}
