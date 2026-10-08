import "server-only";
import type { ErrorCode } from "@/lib/result";

/** Base class for errors whose message is safe to show to the user. */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION";
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(fieldErrors?: Record<string, string[]>) {
    super("Some fields need attention.");
    this.fieldErrors = fieldErrors;
  }
}

export class AuthenticationError extends AppError {
  readonly code = "AUTHENTICATION";

  constructor(message = "Sign in to continue.") {
    super(message);
  }
}

export class AuthorizationError extends AppError {
  readonly code = "AUTHORIZATION";

  constructor() {
    super("You don't have access to do that.");
  }
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";

  constructor() {
    super("We couldn't find that.");
  }
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";

  constructor() {
    super("This changed while you were editing. Refresh and try again.");
  }
}

export class RateLimitError extends AppError {
  readonly code = "RATE_LIMIT";
  readonly retryAfterSeconds: number | undefined;

  constructor(retryAfterSeconds?: number) {
    super("Too many attempts. Wait a moment and try again.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Wraps an unexpected failure. The cause is kept for logging and is never part of the safe error. */
export class InternalError extends AppError {
  readonly code = "INTERNAL";

  constructor(cause?: unknown) {
    super(
      "Something went wrong on our side. Try again.",
      cause === undefined ? undefined : { cause },
    );
  }
}
