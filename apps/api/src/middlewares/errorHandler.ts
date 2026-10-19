import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ERROR_CODES, InvalidStateTransitionError, type ApiErrorPayload } from "@sanitary/shared";
import { AppError } from "../errors/appError.js";
import { logger } from "../infra/logger.js";

/**
 * Global error handling middleware enforcing uniform error payload shape:
 * { error: { code, message, details? } }
 * Big-O: O(k) where k is the number of Zod validation issues, O(k) space.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const reqLog = req.log || logger;

  // 1. Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
      code: e.code,
    }));

    const payload: ApiErrorPayload = {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Validation failed",
        details,
      },
    };

    reqLog.warn({ validationErrors: details }, "Request validation error");
    res.status(400).json(payload);
    return;
  }

  // 2. Booking state-machine invalid transition errors
  if (err instanceof InvalidStateTransitionError) {
    const payload: ApiErrorPayload = {
      error: {
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: err.message,
        details: { from: err.from, to: err.to },
      },
    };

    reqLog.warn(
      { transition: { from: err.from, to: err.to } },
      "Invalid state transition attempted",
    );
    res.status(409).json(payload);
    return;
  }

  // 3. Application domain errors
  if (err instanceof AppError) {
    const payload: ApiErrorPayload = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };

    if (err.statusCode >= 500) {
      reqLog.error({ err, statusCode: err.statusCode }, err.message);
    } else {
      reqLog.warn({ err, statusCode: err.statusCode }, err.message);
    }

    res.status(err.statusCode).json(payload);
    return;
  }

  // 4. Malformed JSON Body parser errors
  if (err instanceof SyntaxError && "body" in err) {
    const payload: ApiErrorPayload = {
      error: {
        code: ERROR_CODES.BAD_REQUEST,
        message: "Invalid JSON body format",
      },
    };

    reqLog.warn({ err }, "Malformed JSON in request body");
    res.status(400).json(payload);
    return;
  }

  // 5. Unhandled / Internal Server Errors
  reqLog.error({ err }, "Unhandled server error");

  const payload: ApiErrorPayload = {
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "An internal server error occurred",
    },
  };

  res.status(500).json(payload);
}
