import { z } from "zod";
import { createActionFactory } from "@/server/actions/create-action";
import type { Logger } from "@/server/ports/logger";

// A module shaped like a feature's actions file: one wrapped action, one raw function, and non-function exports.
const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
};

const createAction = createActionFactory({
  auth: { getSession: () => Promise.resolve(null) },
  findRole: () => Promise.resolve(null),
  logger: silentLogger,
});

export const wrappedAction = createAction({
  name: "fixture.wrapped",
  input: z.object({}),
  public: true,
  handler: () => Promise.resolve("ok"),
});

export function rawExport(input: unknown): Promise<unknown> {
  return Promise.resolve(input);
}

export const LIMIT = 10;
