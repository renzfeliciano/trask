import "server-only";
import type { SafeError } from "@/lib/result";
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";

const PRISMA_CODE_PATTERN = /^P\d{4}$/;

// Prisma is detected by the shape of its known-request errors, so this module never imports the client.
function prismaErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) return undefined;
  const { code } = err;
  return typeof code === "string" && PRISMA_CODE_PATTERN.test(code) ? code : undefined;
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  switch (prismaErrorCode(err)) {
    case "P2002":
      return new ConflictError();
    case "P2025":
      return new NotFoundError();
    default:
      return new InternalError(err);
  }
}

/** Maps anything thrown to the error shape that may reach the client; internal details never pass through. */
export function toSafeError(err: unknown): SafeError {
  const appError = toAppError(err);
  const safe: SafeError = { code: appError.code, message: appError.message };
  if (appError instanceof ValidationError && appError.fieldErrors) {
    safe.fieldErrors = appError.fieldErrors;
  }
  return safe;
}
