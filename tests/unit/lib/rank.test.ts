import { describe, expect, it } from "vitest";
import { rankBetween, ranksBetween } from "@/lib/rank";

function isStrictlyIncreasing(keys: string[]): boolean {
  return keys.every((key, i) => i === 0 || (keys[i - 1] as string) < key);
}

describe("rankBetween", () => {
  it("returns a non-empty key for an empty list", () => {
    expect(rankBetween(null, null).length).toBeGreaterThan(0);
  });

  it("returns a key strictly between two neighbours", () => {
    const a = rankBetween(null, null);
    const b = rankBetween(a, null);
    const mid = rankBetween(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);
  });

  it("sorts after the last key when appending and before the first when prepending", () => {
    const first = rankBetween(null, null);
    expect(rankBetween(first, null) > first).toBe(true);
    expect(rankBetween(null, first) < first).toBe(true);
  });

  it("keeps strict order across 500 inserts at the front", () => {
    const keys = [rankBetween(null, null)];
    for (let i = 0; i < 500; i++) {
      keys.unshift(rankBetween(null, keys[0] as string));
    }
    expect(keys).toHaveLength(501);
    expect(isStrictlyIncreasing(keys)).toBe(true);
  });

  it("keeps strict order across repeated inserts into the same gap", () => {
    const low = rankBetween(null, null);
    let high = rankBetween(low, null);
    const inserted: string[] = [];
    for (let i = 0; i < 200; i++) {
      high = rankBetween(low, high);
      inserted.unshift(high);
    }
    expect(isStrictlyIncreasing([low, ...inserted])).toBe(true);
  });

  it("throws RangeError when before is greater than after", () => {
    expect(() => rankBetween("b", "a")).toThrow(RangeError);
  });

  it("throws RangeError when before equals after", () => {
    const a = rankBetween(null, null);
    expect(() => rankBetween(a, a)).toThrow(RangeError);
  });
});

describe("ranksBetween", () => {
  it("returns strictly increasing keys for an empty list", () => {
    const keys = ranksBetween(5, null, null);
    expect(keys).toHaveLength(5);
    expect(isStrictlyIncreasing(keys)).toBe(true);
  });

  it("returns keys that all fall strictly between the bounds", () => {
    const a = rankBetween(null, null);
    const b = rankBetween(a, null);
    const keys = ranksBetween(20, a, b);
    expect(keys).toHaveLength(20);
    expect(isStrictlyIncreasing([a, ...keys, b])).toBe(true);
  });

  it("returns an empty array for a count of zero", () => {
    expect(ranksBetween(0, null, null)).toEqual([]);
  });

  it("throws RangeError when before is not below after", () => {
    expect(() => ranksBetween(3, "b", "a")).toThrow(RangeError);
  });

  it("throws RangeError for a negative or non-integer count", () => {
    expect(() => ranksBetween(-1, null, null)).toThrow(RangeError);
    expect(() => ranksBetween(1.5, null, null)).toThrow(RangeError);
  });
});
