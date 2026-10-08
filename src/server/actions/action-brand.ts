import "server-only";

// Module-private, so only createAction can mark a function as a wrapped action.
const ACTION_BRAND = Symbol("trask.action");

/** Marks a function as produced by createAction. The mark is non-enumerable and cannot be changed or removed. */
export function brandAction<F extends (...args: never[]) => unknown>(fn: F): F {
  Object.defineProperty(fn, ACTION_BRAND, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return fn;
}

export function isAction(value: unknown): boolean {
  return typeof value === "function" && Object.hasOwn(value, ACTION_BRAND);
}

/** Names of a module's exported functions that were not built with createAction. Non-function exports are ignored. */
export function findUnwrappedExports(mod: Record<string, unknown>): string[] {
  return Object.entries(mod)
    .filter(([, value]) => typeof value === "function" && !isAction(value))
    .map(([name]) => name);
}
