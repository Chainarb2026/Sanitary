import { Router } from "express";
import { partnerController } from "./controller.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";

export const partnerRouter = Router();

// Partner onboarding & profile
partnerRouter.post("/partners/onboard", authenticate, (req, res, next) =>
  partnerController.onboard(req, res, next),
);

partnerRouter.get("/partners/profile", authenticate, (req, res, next) =>
  partnerController.getProfile(req, res, next),
);

// Administrative KYC review
partnerRouter.post("/partners/:id/approve", authenticate, requireRole("admin"), (req, res, next) =>
  partnerController.approveKyc(req, res, next),
);

partnerRouter.post("/partners/:id/reject", authenticate, requireRole("admin"), (req, res, next) =>
  partnerController.rejectKyc(req, res, next),
);

// Partner live presence and status
partnerRouter.post(
  "/partners/status",
  authenticate,
  requireRole("partner", "admin"),
  (req, res, next) => partnerController.toggleStatus(req, res, next),
);

// Location ping endpoint (server-side throttled)
partnerRouter.post(
  "/partners/location",
  authenticate,
  requireRole("partner", "admin"),
  (req, res, next) => partnerController.recordLocation(req, res, next),
);

// Geospatial lookup for nearby online partners
partnerRouter.get("/partners/nearby", (req, res, next) =>
  partnerController.findNearby(req, res, next),
);
