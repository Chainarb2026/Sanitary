import { type Paise } from "@sanitary/shared";
import {
  PayoutModel,
  type IPayout,
  type PayoutMethod,
  type IPayoutAccountDetails,
} from "./model.js";
import { ledgerService, type LedgerEntryInput } from "../ledger/service.js";
import { addSettlementJob } from "./queue.js";
import { config } from "../../infra/config.js";
import { AppError, NotFoundError } from "../../errors/appError.js";
import { logger } from "../../infra/logger.js";

export class PayoutService {
  /**
   * Partner requests wallet payout.
   * Checks balance and enqueues settlement job.
   */
  public async requestPayout(
    partnerId: string,
    amountPaise: Paise,
    payoutMethod: PayoutMethod,
    accountDetails: IPayoutAccountDetails,
  ): Promise<IPayout> {
    if (amountPaise < config.MIN_PAYOUT_AMOUNT_PAISE) {
      throw new AppError(
        400,
        "MINIMUM_PAYOUT_AMOUNT",
        `Minimum payout amount is ${config.MIN_PAYOUT_AMOUNT_PAISE} paise`,
      );
    }

    const currentBalance = await ledgerService.getBalance("partner", partnerId);
    if (currentBalance < amountPaise) {
      throw new AppError(
        400,
        "INSUFFICIENT_WALLET_BALANCE",
        `Insufficient wallet balance: current balance is ${currentBalance} paise, requested ${amountPaise} paise`,
      );
    }

    const transactionId = `payout_${partnerId}_${Date.now()}`;

    const payout = await PayoutModel.create({
      partnerId,
      amountPaise,
      status: "REQUESTED",
      payoutMethod,
      accountDetails,
      transactionId,
    });

    try {
      await addSettlementJob(payout._id.toString());
    } catch (err) {
      logger.warn(
        { err, payoutId: payout._id },
        "Failed to enqueue BullMQ settlement job immediately",
      );
    }

    return payout;
  }

  /**
   * Processes settlement payout for partner:
   * Double-entry ledger: Debit Partner, Credit Platform.
   */
  public async processSettlement(payoutId: string): Promise<IPayout> {
    const payout = await PayoutModel.findById(payoutId).exec();
    if (!payout) {
      throw new NotFoundError(`Payout record not found: '${payoutId}'`);
    }

    if (payout.status !== "REQUESTED") {
      logger.info({ payoutId, status: payout.status }, "Payout not in REQUESTED status. Skipping.");
      return payout;
    }

    const currentBalance = await ledgerService.getBalance("partner", payout.partnerId);
    if (currentBalance < payout.amountPaise) {
      payout.status = "FAILED";
      payout.failureReason = "Insufficient balance at settlement time";
      await payout.save();
      throw new AppError(
        400,
        "INSUFFICIENT_BALANCE_AT_SETTLEMENT",
        "Partner wallet balance insufficient at settlement time",
      );
    }

    const transactionId = payout.transactionId;
    const idempotencyKey = `payout_settle_${payout._id.toString()}`;

    // Record double-entry ledger transaction
    const entries: LedgerEntryInput[] = [
      {
        accountType: "partner",
        accountId: payout.partnerId,
        type: "debit",
        amountPaise: payout.amountPaise,
        idempotencyKey: `${idempotencyKey}:debit:partner`,
        description: `Disbursement payout to partner account (${payout.payoutMethod})`,
        metadata: { payoutId: payout._id.toString(), method: payout.payoutMethod },
      },
      {
        accountType: "platform",
        accountId: "platform",
        type: "credit",
        amountPaise: payout.amountPaise,
        idempotencyKey: `${idempotencyKey}:credit:platform`,
        description: `Disbursement payout clearing from platform account`,
        metadata: { payoutId: payout._id.toString(), method: payout.payoutMethod },
      },
    ];

    await ledgerService.recordTransaction({
      transactionId,
      entries,
    });

    payout.status = "PROCESSED";
    payout.processedAt = new Date();
    await payout.save();

    logger.info(
      { payoutId, partnerId: payout.partnerId, amountPaise: payout.amountPaise },
      "Payout settlement processed successfully",
    );

    return payout;
  }
}

export const payoutService = new PayoutService();
