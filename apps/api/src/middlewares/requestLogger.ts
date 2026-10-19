import type { Request, Response, NextFunction } from "express";

/**
 * Middleware logging incoming requests and completed responses with duration in ms.
 * Big-O: O(1) time, O(1) space.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    req.log.info(
      {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        userAgent: req.headers["user-agent"],
      },
      "HTTP request completed",
    );
  });

  next();
}
