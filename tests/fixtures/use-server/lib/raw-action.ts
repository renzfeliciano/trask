"use server";

// A "use server" module outside src/features/: every export becomes a callable endpoint, so the guard must find it.
export async function rawExport(input: unknown): Promise<unknown> {
  return Promise.resolve(input);
}
