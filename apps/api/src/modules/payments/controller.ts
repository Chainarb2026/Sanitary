import { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { paymentService } from "./service.js";
import { AppError } from "../../errors/appError.js";

const initiateUpiSchema = z.object({
  bookingId: z.string().min(1, "bookingId is required"),
});

const createOrderSchema = z.object({
  bookingId: z.string().min(1, "bookingId is required"),
});

const verifyRazorpaySchema = z.object({
  bookingId: z.string().min(1, "bookingId is required"),
  razorpayPaymentId: z.string().min(1, "razorpayPaymentId is required"),
  razorpayOrderId: z.string().optional(),
  razorpaySignature: z.string().optional(),
});

const collectCashSchema = z.object({
  bookingId: z.string().min(1, "bookingId is required"),
});

export class PaymentController {
  public async createRazorpayOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createOrderSchema.parse(req.body);
      const customerId = req.user!.userId;

      const result = await paymentService.createRazorpayOrder(parsed.bookingId, customerId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async verifyRazorpay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = verifyRazorpaySchema.parse(req.body);
      const customerId = req.user!.userId;

      const result = await paymentService.verifyRazorpayPayment({
        bookingId: parsed.bookingId,
        customerId,
        razorpayPaymentId: parsed.razorpayPaymentId,
        razorpayOrderId: parsed.razorpayOrderId,
        razorpaySignature: parsed.razorpaySignature,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async initiateUpi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = initiateUpiSchema.parse(req.body);
      const customerId = req.user!.userId;

      const result = await paymentService.initiateUpiPayment(parsed.bookingId, customerId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async collectCash(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = collectCashSchema.parse(req.body);
      const partnerId = req.user!.userId;

      const result = await paymentService.processCashPayment(parsed.bookingId, partnerId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = (req.headers["x-razorpay-signature"] as string) || "";
      const rawBody = req.rawBody || JSON.stringify(req.body);

      if (!signature) {
        throw new AppError(400, "MISSING_SIGNATURE", "Missing x-razorpay-signature header");
      }

      const result = await paymentService.handleWebhook(rawBody, signature);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();
