import type { Request, Response, NextFunction } from "express";
import { getRedisClient } from "./redis.js";
import { AppError } from "../errors/appError.js";
import { ERROR_CODES } from "@sanitary/shared";
import { logger } from "./logger.js";

const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_updated')
local tokens = tonumber(data[1])
local last_updated = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  last_updated = now
else
  local delta = math.max(0, now - last_updated)
  local refilled = delta * refill_rate
  tokens = math.min(capacity, tokens + refilled)
  last_updated = now
end

if tokens >= cost then
  tokens = tokens - cost
  redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
  local ttl = math.ceil(capacity / refill_rate)
  redis.call('EXPIRE', key, math.max(ttl, 60))
  return { 1, math.floor(tokens), 0 }
else
  local needed = cost - tokens
  local retry_after = math.ceil(needed / refill_rate)
  return { 0, math.floor(tokens), retry_after }
end
`;

export interface RateLimiterOptions {
  keyPrefix: string;
  capacity: number;
  refillRatePerSec: number;
  cost?: number;
  keyExtractor?: (req: Request) => string;
}

/**
 * Creates an Express middleware applying Redis token-bucket rate limiting via Lua script.
 * Big-O: O(1) Redis eval execution.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    keyPrefix,
    capacity,
    refillRatePerSec,
    cost = 1,
    keyExtractor = (req) => req.ip || req.socket.remoteAddress || "global",
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = getRedisClient();
      const clientKey = keyExtractor(req);
      const redisKey = `ratelimit:${keyPrefix}:${clientKey}`;
      const now = Date.now() / 1000;

      const result = (await client.eval(
        TOKEN_BUCKET_LUA,
        1,
        redisKey,
        capacity.toString(),
        refillRatePerSec.toString(),
        cost.toString(),
        now.toString(),
      )) as [number, number, number];

      const [allowed, remaining, retryAfter] = result;

      res.setHeader("X-RateLimit-Limit", capacity);
      res.setHeader("X-RateLimit-Remaining", remaining);

      if (allowed === 1) {
        next();
      } else {
        res.setHeader("Retry-After", retryAfter);
        next(
          new AppError(
            429,
            ERROR_CODES.RATE_LIMITED,
            "Too many requests. Please slow down and try again later.",
            { retryAfterSeconds: retryAfter },
          ),
        );
      }
    } catch (err) {
      // In case of transient Redis failure, log and fail-open to avoid service outage
      logger.warn({ err }, "Rate limiter check bypassed due to Redis error");
      next();
    }
  };
}
