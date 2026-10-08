import { describe, expect, it } from "vitest";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InternalError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@/server/errors/app-error";
import { toSafeError } from "@/server/errors/to-safe-error";

// Prisma is not installed yet, so the fake mirrors the shape of PrismaClientKnownRequestError.
function fakePrismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Invalid \`prisma.task.create()\` invocation (${code})`), {
    name: "PrismaClientKnownRequestError",
    code,
  });
}

describe("AppError subclasses", () => {
  it.each([
    [new ValidationError(), "VALIDATION", "Some fields need attention."],
    [new AuthenticationError(), "AUTHENTICATION", "Sign in to continue."],
    [new AuthorizationError(), "AUTHORIZATION", "You don't have access to do that."],
    [new NotFoundError(), "NOT_FOUND", "We couldn't find that."],
    [
      new ConflictError(),
      "CONFLICT",
      "This changed while you were editing. Refresh and try again.",
    ],
    [new RateLimitError(), "RATE_LIMIT", "Too many attempts. Wait a moment and try again."],
    [new InternalError(), "INTERNAL", "Something went wrong on our side. Try again."],
  ] as const)("%o maps to its code and default message", (err, code, message) => {
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(code);
    expect(err.message).toBe(message);
    expect(toSafeError(err)).toEqual({ code, message });
  });

  it("ValidationError keeps fieldErrors and exposes them in the safe error", () => {
    const fieldErrors = { title: ["Enter a title."], dueDate: ["Pick a future date."] };
    const err = new ValidationError(fieldErrors);

    expect(err.fieldErrors).toEqual(fieldErrors);
    expect(toSafeError(err)).toEqual({
      code: "VALIDATION",
      message: "Some fields need attention.",
      fieldErrors,
    });
  });

  it("AuthenticationError keeps a custom message", () => {
    const err = new AuthenticationError("Verify your email to continue.");

    expect(err.message).toBe("Verify your email to continue.");
    expect(toSafeError(err)).toEqual({
      code: "AUTHENTICATION",
      message: "Verify your email to continue.",
    });
  });

  it("RateLimitError keeps retryAfterSeconds", () => {
    expect(new RateLimitError(30).retryAfterSeconds).toBe(30);
  });

  it("InternalError keeps its cause but never exposes it in the safe error", () => {
    const cause = new Error("connect ECONNREFUSED 10.0.0.5:5432");
    const err = new InternalError(cause);

    expect(err.cause).toBe(cause);
    expect(JSON.stringify(toSafeError(err))).not.toContain("ECONNREFUSED");
  });
});

describe("toSafeError", () => {
  it("hides internal details of a plain Error", () => {
    const safe = toSafeError(new Error('relation "Task" does not exist'));

    expect(safe.code).toBe("INTERNAL");
    expect(safe.message).toBe("Something went wrong on our side. Try again.");
    expect(safe.message).not.toContain("relation");
  });

  it.each([["a string"], [null], [undefined], [{ message: "relation leaked" }]])(
    "maps non-Error value %o to INTERNAL",
    (thrown) => {
      expect(toSafeError(thrown)).toEqual({
        code: "INTERNAL",
        message: "Something went wrong on our side. Try again.",
      });
    },
  );

  it("maps Prisma P2002 (unique violation) to CONFLICT", () => {
    expect(toSafeError(fakePrismaError("P2002"))).toEqual({
      code: "CONFLICT",
      message: "This changed while you were editing. Refresh and try again.",
    });
  });

  it("maps Prisma P2025 (record not found) to NOT_FOUND", () => {
    expect(toSafeError(fakePrismaError("P2025"))).toEqual({
      code: "NOT_FOUND",
      message: "We couldn't find that.",
    });
  });

  it("maps any other Prisma code to INTERNAL without leaking the message", () => {
    const safe = toSafeError(fakePrismaError("P1001"));

    expect(safe.code).toBe("INTERNAL");
    expect(safe.message).not.toContain("prisma");
  });

  it("does not treat a non-Prisma error with a similar-looking code as Prisma", () => {
    const err = Object.assign(new Error("boom"), { code: "ECONNRESET" });

    expect(toSafeError(err).code).toBe("INTERNAL");
  });
});
