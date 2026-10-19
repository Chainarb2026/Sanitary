import { Router } from "express";
import { aiController } from "./controller.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";

export const aiRouter = Router();

// Customer uploads/submits waste photo for estimation and instant quote
aiRouter.post("/ai/estimate", authenticate, requireRole("customer"), (req, res, next) =>
  aiController.estimate(req, res, next),
);

// Partner records physical scale weight on pickup with GPS & fraud checks
aiRouter.post("/bookings/:id/weigh", authenticate, requireRole("partner"), (req, res, next) =>
  aiController.recordWeight(req, res, next),
);

// Admin retrieves model estimation accuracy metrics and fraud statistics
aiRouter.get("/admin/ai-accuracy", authenticate, requireRole("admin"), (req, res, next) =>
  aiController.getAccuracyMetrics(req, res, next),
);
