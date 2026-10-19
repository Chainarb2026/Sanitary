import crypto from "node:crypto";
import { config } from "../../infra/config.js";

/**
 * Generates a cryptographically random 6-digit pickup OTP and its HMAC-SHA256 digest.
 * Big-O: O(1) time, O(1) space.
 */
export function generatePickupOtp(): { rawOtp: string; hashedOtp: string } {
  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = hashPickupOtp(rawOtp);
  return { rawOtp, hashedOtp };
}

/**
 * Computes HMAC-SHA256 hash of the pickup OTP.
 * Big-O: O(1) time, O(1) space.
 */
export function hashPickupOtp(otp: string): string {
  return crypto.createHmac("sha256", config.OTP_SECRET).update(otp).digest("hex");
}

/**
 * Constant-time comparison between raw OTP and expected HMAC hash.
 * Big-O: O(1) time, O(1) space.
 */
export function verifyPickupOtp(rawOtp: string, expectedHash: string): boolean {
  const computedHash = hashPickupOtp(rawOtp);
  if (computedHash.length !== expectedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(expectedHash, "hex"));
}
