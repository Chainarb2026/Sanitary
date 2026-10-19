import type { Request, Response, NextFunction } from "express";
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from "@sanitary/shared";
import { authService } from "./service.js";
import { config } from "../../infra/config.js";

/**
 * Controller strictly responsible for input validation via Zod and HTTP dispatch.
 * No business logic resides here.
 */
export class AuthController {
  public async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = sendOtpSchema.parse(req.body);
      const otp = await authService.sendOtp(phone);
      const isDev = config.NODE_ENV !== "production" || process.env.NODE_ENV !== "production";
      res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        ...(isDev ? { devOtp: otp } : {}),
      });
    } catch (error) {
      next(error);
    }
  }

  public async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, otp } = verifyOtpSchema.parse(req.body);
      const result = await authService.verifyOtp(phone, otp);
      res.status(200).json({
        ...result,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  public async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const tokens = await authService.refreshTokens(refreshToken);
      res.status(200).json(tokens);
    } catch (error) {
      next(error);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      await authService.logout(refreshToken);
      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  }

  public async getMe(req: Request, res: Response): Promise<void> {
    res.status(200).json({ user: req.user });
  }
}

export const authController = new AuthController();
