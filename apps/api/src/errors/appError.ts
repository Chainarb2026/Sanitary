import { ERROR_CODES, type ErrorCode } from "@sanitary/shared";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown> | Array<unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown> | Array<unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request", details?: Record<string, unknown> | Array<unknown>) {
    super(400, ERROR_CODES.BAD_REQUEST, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, ERROR_CODES.NOT_FOUND, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, ERROR_CODES.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, ERROR_CODES.FORBIDDEN, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: Record<string, unknown>) {
    super(409, ERROR_CODES.CONFLICT, message, details);
  }
}
