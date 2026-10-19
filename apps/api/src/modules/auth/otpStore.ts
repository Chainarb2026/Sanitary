import crypto from "node:crypto";
import { getRedisClient } from "../../infra/redis.js";
import { config } from "../../infra/config.js";
import { AppError } from "../../errors/appError.js";
import { ERROR_CODES } from "@sanitary/shared";

function hashOtp(otp: string): string {
  return crypto.createHmac("sha256", config.OTP_SECRET).update(otp).digest("hex");
}

/**
 * Manages storage and verification of HMAC-hashed OTPs in Redis.
 */
export class OtpStore {
  private getRedisKey(phone: string): string {
    return `otp:${phone}`;
  }

  /**
   * Saves HMAC-hashed OTP with 5-minute TTL.
   * Big-O: O(1) Redis hash set and expire.
   */
  public async saveOtp(phone: string, otp: string): Promise<void> {
    const redis = getRedisClient();
    const key = this.getRedisKey(phone);
    const hashed = hashOtp(otp);

    await redis
      .multi()
      .hset(key, "hash", hashed, "attempts", "0")
      .expire(key, config.OTP_TTL_SECONDS)
      .exec();
  }

  /**
   * Verifies OTP against HMAC hash and enforces attempt limits.
   * Big-O: O(1) Redis operations and constant-time buffer comparison.
   */
  public async verifyAndConsumeOtp(phone: string, inputOtp: string): Promise<void> {
    const redis = getRedisClient();
    const key = this.getRedisKey(phone);

    const [storedHash, attemptsStr] = await redis.hmget(key, "hash", "attempts");

    const isDevMasterOtp =
      config.NODE_ENV === "development" && (inputOtp === "123456" || inputOtp === "999999");

    if (!storedHash || attemptsStr === null) {
      if (isDevMasterOtp) {
        return; // Dev master OTP bypass
      }
      throw new AppError(
        400,
        ERROR_CODES.OTP_EXPIRED,
        "OTP has expired or was not requested. Please request a new OTP.",
      );
    }

    const currentAttempts = attemptsStr ? parseInt(attemptsStr, 10) || 0 : 0;

    if (currentAttempts >= config.OTP_MAX_ATTEMPTS && !isDevMasterOtp) {
      await redis.del(key);
      throw new AppError(
        429,
        ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
        "Maximum OTP attempts exceeded. Request a new OTP.",
      );
    }

    // Increment attempt count before verifying
    const newAttempts = currentAttempts + 1;
    await redis.hset(key, "attempts", newAttempts.toString());

    const inputHash = hashOtp(inputOtp);
    const isMatch =
      (inputHash.length === storedHash.length &&
        crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash))) ||
      isDevMasterOtp;

    if (!isMatch) {
      const remaining = config.OTP_MAX_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        await redis.del(key);
        throw new AppError(
          429,
          ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
          "Maximum OTP attempts exceeded. Request a new OTP.",
        );
      }
      throw new AppError(
        400,
        ERROR_CODES.INVALID_OTP,
        `Invalid OTP. ${remaining} attempt(s) remaining.`,
        { remainingAttempts: remaining },
      );
    }

    // On successful verification, delete OTP to prevent replay attacks
    await redis.del(key);
  }
}

export const otpStore = new OtpStore();
