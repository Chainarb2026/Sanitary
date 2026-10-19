import { Router } from "express";
import { bookingController } from "./controller.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import { createRateLimiter } from "../../infra/rateLimiter.js";

export const bookingRouter = Router();

// Customer endpoints
bookingRouter.post(
  "/",
  authenticate,
  requireRole("customer"),
  createRateLimiter({
    capacity: 20,
    refillRatePerSec: 1, // 1 per sec
    keyPrefix: "ratelimit:bookings:create:",
  }),
  (req, res, next) => bookingController.create(req, res).catch(next),
);

bookingRouter.get("/", authenticate, requireRole("customer"), (req, res, next) =>
  bookingController.getCustomerBookings(req, res).catch(next),
);

// Partner endpoints
bookingRouter.get("/partner", authenticate, requireRole("partner"), (req, res, next) =>
  bookingController.getPartnerBookings(req, res).catch(next),
);

bookingRouter.post("/:id/verify-otp", authenticate, requireRole("partner"), (req, res, next) =>
  bookingController.verifyOtp(req, res).catch(next),
);

bookingRouter.post("/:id/accept", authenticate, requireRole("partner"), (req, res, next) =>
  bookingController.accept(req, res).catch(next),
);

// Admin endpoints
bookingRouter.get("/admin", authenticate, requireRole("admin"), (req, res, next) =>
  bookingController.getAdminBookings(req, res).catch(next),
);

// General status transition endpoint (Partner or Admin)
bookingRouter.post(
  "/:id/transition",
  authenticate,
  requireRole("partner", "admin"),
  (req, res, next) => bookingController.transition(req, res).catch(next),
);

// Customer cancellation endpoint
bookingRouter.post("/:id/cancel", authenticate, requireRole("customer"), (req, res, next) =>
  bookingController.cancel(req, res).catch(next),
);

// Demo / Staging partner matching endpoint
bookingRouter.post("/:id/demo-match", authenticate, (req, res, next) =>
  bookingController.demoMatchPartner(req, res).catch(next),
);

// Single booking retrieval
bookingRouter.get("/:id", authenticate, (req, res, next) =>
  bookingController.getById(req, res).catch(next),
);
