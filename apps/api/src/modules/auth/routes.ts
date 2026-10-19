import { Router } from "express";
import { authController } from "./controller.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import { createRateLimiter } from "../../infra/rateLimiter.js";

export const authRouter = Router();

// Token bucket rate limiter: 5 tokens max, refills 1 token every 12s (5/min capacity)
const sendOtpLimiter = createRateLimiter({
  keyPrefix: "auth:send-otp",
  capacity: 5,
  refillRatePerSec: 0.1,
  keyExtractor: (req) =>
    typeof req.body?.phone === "string" ? req.body.phone : req.ip || "unknown",
});

// Token bucket rate limiter: 10 tokens max, refills 1 token every 6s (10/min capacity)
const verifyOtpLimiter = createRateLimiter({
  keyPrefix: "auth:verify-otp",
  capacity: 10,
  refillRatePerSec: 0.2,
  keyExtractor: (req) =>
    typeof req.body?.phone === "string" ? req.body.phone : req.ip || "unknown",
});

authRouter.post("/auth/send-otp", sendOtpLimiter, (req, res, next) =>
  authController.sendOtp(req, res, next),
);

authRouter.post("/auth/verify-otp", verifyOtpLimiter, (req, res, next) =>
  authController.verifyOtp(req, res, next),
);

authRouter.post("/auth/refresh", (req, res, next) => authController.refresh(req, res, next));

authRouter.post("/auth/logout", (req, res, next) => authController.logout(req, res, next));

authRouter.get("/auth/me", authenticate, (req, res) => authController.getMe(req, res));

// Role-guarded testing endpoints verifying RBAC enforcement
authRouter.get("/auth/test-admin", authenticate, requireRole("admin"), (_req, res) => {
  res.status(200).json({ success: true, message: "Admin access granted" });
});

authRouter.get("/auth/test-partner", authenticate, requireRole("partner"), (_req, res) => {
  res.status(200).json({ success: true, message: "Partner access granted" });
});
