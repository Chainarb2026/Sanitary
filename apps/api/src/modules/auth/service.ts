import crypto from "node:crypto";
import { otpStore } from "./otpStore.js";
import { refreshTokenStore } from "./refreshStore.js";
import { getSmsProvider } from "./smsProvider.js";
import { userService } from "../users/service.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { AppError } from "../../errors/appError.js";
import { ERROR_CODES, type AuthTokens, type AuthUser, type UserRole } from "@sanitary/shared";

export interface VerifyOtpResult {
  tokens: AuthTokens;
  user: AuthUser;
}

/**
 * Service orchestrating authentication workflows.
 */
export class AuthService {
  /**
   * Generates a 6-digit OTP, stores HMAC in Redis, and dispatches via SMS provider.
   * Big-O: O(1) time, O(1) space.
   */
  public async sendOtp(phone: string): Promise<string> {
    // Generate secure 6-digit numeric OTP (100000 - 999999)
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Store in Redis with TTL
    await otpStore.saveOtp(phone, otp);

    // Dispatch SMS via configured provider
    const sms = getSmsProvider();
    await sms.sendOtp(phone, otp);

    return otp;
  }

  /**
   * Verifies submitted OTP against Redis, provisions/loads user, and mints token family.
   * Big-O: O(log N) user lookup/insert + O(1) crypto and Redis operations.
   */
  public async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResult> {
    // Verify and consume OTP in Redis
    await otpStore.verifyAndConsumeOtp(phone, otp);

    // Find or create user via UserService
    const userDoc = await userService.findOrCreateByPhone(phone);
    const userId = userDoc._id.toString();

    // Initialize refresh token family in Redis
    const { familyId, jti } = await refreshTokenStore.createFamily();

    const accessToken = generateAccessToken({
      sub: userId,
      role: userDoc.role,
      phone: userDoc.phone,
    });

    const refreshToken = generateRefreshToken({
      sub: userId,
      jti,
      familyId,
    });

    const user: AuthUser = {
      id: userId,
      phone: userDoc.phone,
      role: userDoc.role,
      name: userDoc.name,
      isActive: userDoc.isActive,
    };

    return {
      tokens: { accessToken, refreshToken },
      user,
    };
  }

  /**
   * Rotates refresh token, detecting reuse, and issues new token pair.
   * Big-O: O(log N) user verification + O(1) Redis token rotation.
   */
  public async refreshTokens(rawRefreshToken: string): Promise<AuthTokens> {
    const payload = verifyRefreshToken(rawRefreshToken);

    // Rotate token in Redis with reuse check
    const nextJti = await refreshTokenStore.rotateToken(payload.familyId, payload.jti);

    // Validate user still exists and is active
    const user = await userService.findById(payload.sub);
    if (!user || !user.isActive) {
      await refreshTokenStore.revokeFamily(payload.familyId);
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, "User account is inactive or disabled");
    }

    const nextAccessToken = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      phone: user.phone,
    });

    const nextRefreshToken = generateRefreshToken({
      sub: user._id.toString(),
      jti: nextJti,
      familyId: payload.familyId,
    });

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    };
  }

  /**
   * Terminates active session family upon logout.
   */
  public async logout(rawRefreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(rawRefreshToken);
      await refreshTokenStore.revokeFamily(payload.familyId);
    } catch {
      // Idempotent: even if token is already expired/malformed, proceed cleanly
    }
  }

  /**
   * Provisions a user with a specific role (useful for seed/admin/testing).
   */
  public async registerUserWithRole(phone: string, role: UserRole): Promise<AuthUser> {
    const existing = await userService.findByPhone(phone);
    if (existing) {
      return {
        id: existing._id.toString(),
        phone: existing.phone,
        role: existing.role,
        name: existing.name,
        isActive: existing.isActive,
      };
    }
    const created = await userService.create({ phone, role });
    return {
      id: created._id.toString(),
      phone: created.phone,
      role: created.role,
      name: created.name,
      isActive: created.isActive,
    };
  }
}

export const authService = new AuthService();
