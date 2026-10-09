// Mentions "use server" without being a "use server" module: the import below ends the directive prologue, so
// none of the strings in this file is a directive.
import { z } from "zod";

export const schema = z.object({});

export const marker = "use server";

export function plainHelper(): string {
  return marker;
}
