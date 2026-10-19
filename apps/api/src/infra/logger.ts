import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

/**
 * Creates a child logger with a bound requestId.
 * Big-O: O(1) time, O(1) space.
 */
export function createRequestLogger(requestId: string): pino.Logger {
  return logger.child({ requestId });
}
