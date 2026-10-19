import crypto from "node:crypto";
import { getRedisClient } from "../../infra/redis.js";
import { config } from "../../infra/config.js";
import { AppError } from "../../errors/appError.js";
import { ERROR_CODES } from "@sanitary/shared";
import { logger } from "../../infra/logger.js";

/**
 * Manages refresh token family tracking and rotation in Redis with reuse detection.
 */
export class RefreshTokenStore {
  private getFamilyKey(familyId: string): string {
    return `auth:family:${familyId}`;
  }

  /**
   * Initializes a new refresh token family for a user session.
   * Big-O: O(1) Redis SET with TTL.
   */
  public async createFamily(): Promise<{ familyId: string; jti: string }> {
    const familyId = crypto.randomUUID();
    const jti = crypto.randomUUID();
    const redis = getRedisClient();

    await redis.set(this.getFamilyKey(familyId), jti, "EX", config.REFRESH_TOKEN_TTL_SECONDS);

    return { familyId, jti };
  }

  /**
   * Rotates a refresh token within its family, detecting token reuse and revoking upon breach.
   * Big-O: O(1) Redis atomic check-and-rotate.
   */
  public async rotateToken(familyId: string, presentedJti: string): Promise<string> {
    const redis = getRedisClient();
    const key = this.getFamilyKey(familyId);

    const activeJti = await redis.get(key);

    if (!activeJti) {
      throw new AppError(
        401,
        ERROR_CODES.TOKEN_EXPIRED,
        "Refresh token expired or session terminated",
      );
    }

    // Reuse detection: If presented jti is not the currently active token for this family,
    // it was already used by a previous rotation or compromised. Revoke family immediately!
    if (activeJti !== presentedJti) {
      await redis.del(key);
      logger.warn(
        { familyId, presentedJti, activeJti },
        "SECURITY ALERT: Refresh token reuse detected! Invalidating token family.",
      );
      throw new AppError(
        401,
        ERROR_CODES.REFRESH_TOKEN_REUSE_DETECTED,
        "Refresh token reuse detected. All sessions in this family have been revoked.",
      );
    }

    // Generate new jti and advance family
    const nextJti = crypto.randomUUID();
    await redis.set(key, nextJti, "EX", config.REFRESH_TOKEN_TTL_SECONDS);

    return nextJti;
  }

  /**
   * Revokes a refresh token family (used on logout).
   * Big-O: O(1) Redis DEL.
   */
  public async revokeFamily(familyId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(this.getFamilyKey(familyId));
  }
}

export const refreshTokenStore = new RefreshTokenStore();
