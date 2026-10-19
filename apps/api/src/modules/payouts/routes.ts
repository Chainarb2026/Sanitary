import { Router } from "express";
import { payoutController } from "./controller.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";

export const payoutRouter = Router();

// Partner requests payout
payoutRouter.post("/payouts/request", authenticate, requireRole("partner"), (req, res, next) =>
  payoutController.requestPayout(req, res, next),
);

// Partner views payout requests
payoutRouter.get("/payouts/my", authenticate, requireRole("partner"), (req, res, next) =>
  payoutController.getMyPayouts(req, res, next),
);

// User views wallet balance snapshot
payoutRouter.get("/wallet/balance", authenticate, (req, res, next) =>
  payoutController.getWalletBalance(req, res, next),
);
