import { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { payoutService } from "./service.js";
import { PayoutModel } from "./model.js";
import { ledgerService } from "../ledger/service.js";

const requestPayoutSchema = z.object({
  amountPaise: z.number().int().min(1, "amountPaise must be a positive integer"),
  payoutMethod: z.enum(["UPI", "BANK_TRANSFER"]),
  accountDetails: z.object({
    upiId: z.string().optional(),
    accountNumber: z.string().optional(),
    ifsc: z.string().optional(),
    beneficiaryName: z.string().optional(),
  }),
});

export class PayoutController {
  public async requestPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = requestPayoutSchema.parse(req.body);
      const partnerId = req.user!.userId;

      const payout = await payoutService.requestPayout(
        partnerId,
        parsed.amountPaise,
        parsed.payoutMethod,
        parsed.accountDetails,
      );

      res.status(201).json(payout);
    } catch (err) {
      next(err);
    }
  }

  public async getMyPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const partnerId = req.user!.userId;
      const payouts = await PayoutModel.find({ partnerId }).sort({ createdAt: -1 }).lean().exec();
      res.status(200).json({ payouts });
    } catch (err) {
      next(err);
    }
  }

  public async getWalletBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountType = req.user!.role === "partner" ? "partner" : "customer";
      const accountId = req.user!.userId;

      const balancePaise = await ledgerService.getBalance(accountType, accountId);
      res.status(200).json({
        accountType,
        accountId,
        balancePaise,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const payoutController = new PayoutController();
