import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { createRequestLogger } from "../infra/logger.js";

/**
 * Middleware ensuring every incoming request has a unique requestId
 * and a bound child logger.
 * Big-O: O(1) time, O(1) space.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.headers["x-request-id"];
  const id = typeof headerId === "string" && headerId.trim() ? headerId : crypto.randomUUID();

  req.id = id;
  req.log = createRequestLogger(id);

  res.setHeader("X-Request-Id", id);
  next();
}
