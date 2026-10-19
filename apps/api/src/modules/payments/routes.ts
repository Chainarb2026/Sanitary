import { Router } from "express";
import { paymentController } from "./controller.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";

export const paymentRouter = Router();

// Customer initiates dynamic UPI payment
paymentRouter.post(
  "/payments/upi/initiate",
  authenticate,
  requireRole("customer"),
  (req, res, next) => paymentController.initiateUpi(req, res, next),
);

// Customer creates Razorpay order
paymentRouter.post(
  "/payments/razorpay/order",
  authenticate,
  requireRole("customer"),
  (req, res, next) => paymentController.createRazorpayOrder(req, res, next),
);

// Customer verifies Razorpay payment completion
paymentRouter.post(
  "/payments/razorpay/verify",
  authenticate,
  requireRole("customer"),
  (req, res, next) => paymentController.verifyRazorpay(req, res, next),
);

// Partner confirms cash collected in person
paymentRouter.post(
  "/payments/cash/collect",
  authenticate,
  requireRole("partner"),
  (req, res, next) => paymentController.collectCash(req, res, next),
);

// Webhook endpoint (unauthenticated, HMAC-signature verified)
paymentRouter.post("/payments/webhook", (req, res, next) =>
  paymentController.handleWebhook(req, res, next),
);
