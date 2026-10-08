import "server-only";

/** Structured logging port. Callers pass context as an object and a constant message. */
export interface Logger {
  debug(obj: object, msg: string): void;
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
  child(bindings: object): Logger;
}
