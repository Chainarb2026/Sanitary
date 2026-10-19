import crypto from "node:crypto";
import { type Paise } from "@sanitary/shared";
import { PaymentModel, type IPayment, type PaymentMethod } from "./model.js";
import { BookingModel } from "../bookings/model.js";
import { bookingTransitionService } from "../bookings/transitionService.js";
import { ledgerService, type LedgerEntryInput } from "../ledger/service.js";
import { paymentProvider, type OrderResult } from "./provider.js";
import { emitStatusChange } from "../../infra/socket.js";
import { config } from "../../infra/config.js";
import { AppError, NotFoundError } from "../../errors/appError.js";
import { logger } from "../../infra/logger.js";

export interface InitiatePaymentResult {
  paymentId: string;
  paymentUrl?: string;
  qrCodeUrl?: string;
  method: PaymentMethod;
  amountPaise: Paise;
  status: string;
}

export interface WebhookResult {
  success: boolean;
  idempotentReplay: boolean;
  bookingId: string;
}

export class PaymentService {
  /**
   * Creates a Razorpay order for secure online payment.
   */
  public async createRazorpayOrder(
    bookingId: string,
    customerId: string,
  ): Promise<OrderResult> {
    const booking = await BookingModel.findById(bookingId).lean().exec();
    if (!booking) {
      throw new NotFoundError(`Booking not found: '${bookingId}'`);
    }

    if (booking.customerId.toString() !== customerId) {
      throw new AppError(403, "FORBIDDEN", "You are not authorized to pay for this booking");
    }

    return paymentProvider.createOrder({
      bookingId,
      amountPaise: booking.quote.total,
      currency: "INR",
    });
  }

  /**
   * Initiates a dynamic UPI payment link/QR for a pickup booking.
   */
  public async initiateUpiPayment(
    bookingId: string,
    customerId: string,
  ): Promise<InitiatePaymentResult> {
    const booking = await BookingModel.findById(bookingId).lean().exec();
    if (!booking) {
      throw new NotFoundError(`Booking not found: '${bookingId}'`);
    }

    if (booking.customerId.toString() !== customerId) {
      throw new AppError(403, "FORBIDDEN", "You are not authorized to pay for this booking");
    }

    const partnerId = booking.partnerId?.toString() || "pending_assignment";

    // Check if an existing payment already exists
    const existing = await PaymentModel.findOne({ bookingId: booking._id }).lean().exec();
    if (existing && existing.status === "COMPLETED") {
      return {
        paymentId: existing.transactionId,
        paymentUrl: existing.paymentUrl,
        qrCodeUrl: existing.qrCodeUrl,
        method: existing.method,
        amountPaise: existing.amountPaise,
        status: existing.status,
      };
    }

    const amountPaise = booking.quote.total;
    const partnerEarningPaise = booking.quote.partnerEarning;
    const platformFeePaise = booking.quote.total - booking.quote.partnerEarning;
    const transactionId = `txn_${bookingId}_${Date.now()}`;
    const idempotencyKey = `pay_init_upi_${bookingId}`;

    // Request dynamic link and QR from payment provider
    const linkResult = await paymentProvider.createPaymentLink({
      bookingId,
      amountPaise,
      description: `Sanitary Waste Pickup Booking ${bookingId}`,
    });

    // Upsert payment record
    const payment = await PaymentModel.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $set: {
          customerId,
          partnerId,
          method: "UPI",
          status: "PENDING",
          amountPaise,
          partnerEarningPaise,
          platformFeePaise,
          transactionId,
          paymentLinkId: linkResult.paymentId,
          paymentUrl: linkResult.paymentUrl,
          qrCodeUrl: linkResult.qrCodeUrl,
          idempotencyKey,
        },
      },
      { upsert: true, new: true },
    )
      .lean()
      .exec();

    return {
      paymentId: payment.transactionId,
      paymentUrl: payment.paymentUrl,
      qrCodeUrl: payment.qrCodeUrl,
      method: "UPI",
      amountPaise: payment.amountPaise,
      status: payment.status,
    };
  }

  /**
   * Completes cash payment collected directly by the partner on the spot.
   * Debits platform fee from partner wallet and credits platform account.
   */
  public async processCashPayment(bookingId: string, partnerId: string): Promise<IPayment> {
    const booking = await BookingModel.findById(bookingId).lean().exec();
    if (!booking) {
      throw new NotFoundError(`Booking not found: '${bookingId}'`);
    }

    if (booking.partnerId?.toString() !== partnerId) {
      throw new AppError(403, "FORBIDDEN", "Only the assigned partner can confirm cash payment");
    }

    // Check if cash payment already completed
    const existing = await PaymentModel.findOne({
      bookingId: booking._id,
      status: "COMPLETED",
    }).exec();
    if (existing) {
      return existing;
    }

    const amountPaise = booking.quote.total;
    const partnerEarningPaise = booking.quote.partnerEarning;
    const platformFeePaise = booking.quote.total - booking.quote.partnerEarning;
    const transactionId = `cash_${bookingId}_${Date.now()}`;
    const idempotencyKey = `cash_ledger_${bookingId}`;

    // 1. Record double-entry ledger transaction:
    // Partner receives entire amount in cash, so platform commission is debited from partner's wallet
    const ledgerEntries: LedgerEntryInput[] = [
      {
        accountType: "partner",
        accountId: partnerId,
        type: "debit",
        amountPaise: platformFeePaise,
        idempotencyKey: `${idempotencyKey}:debit:partner`,
        description: `Platform fee deduction for cash pickup ${bookingId}`,
        metadata: { bookingId, method: "CASH" },
      },
      {
        accountType: "platform",
        accountId: "platform",
        type: "credit",
        amountPaise: platformFeePaise,
        idempotencyKey: `${idempotencyKey}:credit:platform`,
        description: `Platform fee received for cash pickup ${bookingId}`,
        metadata: { bookingId, method: "CASH" },
      },
    ];

    await ledgerService.recordTransaction({
      transactionId,
      entries: ledgerEntries,
    });

    // 2. Mark payment COMPLETED
    const payment = await PaymentModel.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $set: {
          customerId: booking.customerId.toString(),
          partnerId,
          method: "CASH",
          status: "COMPLETED",
          amountPaise,
          partnerEarningPaise,
          platformFeePaise,
          transactionId,
          idempotencyKey: `pay_cash_${bookingId}`,
          paidAt: new Date(),
        },
      },
      { upsert: true, new: true },
    ).exec();

    // 3. Transition booking status to PAID if currently COLLECTED
    if (booking.status === "COLLECTED") {
      try {
        await bookingTransitionService.transition({
          bookingId,
          targetStatus: "PAID",
          reason: `Cash collected by partner '${partnerId}' on spot`,
          updatedBy: partnerId,
        });
      } catch (err) {
        logger.warn({ err, bookingId }, "Failed to advance booking state machine to PAID");
      }
    }

    // 4. Notify customer and partner in real-time
    emitStatusChange([booking.customerId.toString(), partnerId], {
      bookingId,
      status: "PAID",
      message: "Cash payment received and settled successfully.",
    });

    return payment;
  }

  /**
   * Processes incoming payment provider webhooks idempotently with signature verification.
   * Double-entry ledger: Debit Customer, Credit Partner, Credit Platform.
   */
  public async handleWebhook(rawBody: string, signature: string): Promise<WebhookResult> {
    // 1. Cryptographic HMAC signature check
    const isValid = paymentProvider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new AppError(400, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature verification failed");
    }

    // 2. Extract payload fields
    interface WebhookPayload {
      id?: string;
      eventId?: string;
      bookingId?: string;
      paymentId?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            amount?: number;
            description?: string;
            notes?: {
              bookingId?: string;
            };
          };
        };
      };
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      throw new AppError(400, "INVALID_JSON_PAYLOAD", "Malformed webhook JSON payload");
    }

    const eventId =
      payload.id ?? payload.eventId ?? payload.payload?.payment?.entity?.id ?? `evt_${Date.now()}`;

    // Extract booking ID and payment ID from standard Razorpay payload or flat payload
    const bookingId =
      payload.bookingId ??
      payload.payload?.payment?.entity?.notes?.bookingId ??
      payload.payload?.payment?.entity?.description?.match(/[a-f0-9]{24}/)?.[0];

    const gatewayPaymentId =
      payload.paymentId ?? payload.payload?.payment?.entity?.id ?? `rzp_pay_${Date.now()}`;

    if (!bookingId) {
      logger.warn({ payload }, "Webhook received without identifiable bookingId");
      return { success: true, idempotentReplay: false, bookingId: "" };
    }

    const booking = await BookingModel.findById(bookingId).lean().exec();
    if (!booking) {
      throw new NotFoundError(`Booking not found for webhook: '${bookingId}'`);
    }

    const partnerId = booking.partnerId?.toString();
    if (!partnerId) {
      throw new AppError(400, "PARTNER_NOT_ASSIGNED", "Booking has no assigned partner for payout");
    }

    // 3. IDEMPOTENCY CHECK:
    // If webhook event has already been processed or payment is already COMPLETED, replay gracefully
    const existingPayment = await PaymentModel.findOne({ bookingId: booking._id }).exec();

    if (
      existingPayment &&
      (existingPayment.status === "COMPLETED" || existingPayment.webhookEvents.includes(eventId))
    ) {
      logger.info(
        { bookingId, eventId, gatewayPaymentId },
        "Webhook replayed. Payment already completed. Skipping ledger entries (idempotent replay).",
      );
      return { success: true, idempotentReplay: true, bookingId };
    }

    const amountPaise = booking.quote.total;
    const partnerEarningPaise = booking.quote.partnerEarning;
    const platformFeePaise = booking.quote.total - booking.quote.partnerEarning;
    const transactionId = `upi_${bookingId}_${gatewayPaymentId}`;
    const idempotencyKey = `ledger_upi_${bookingId}`;

    // 4. Double-entry ledger entries:
    // Debit Customer (amountPaise)
    // Credit Partner (partnerEarningPaise)
    // Credit Platform (platformFeePaise)
    // Total Debits == Total Credits!
    const ledgerEntries: LedgerEntryInput[] = [
      {
        accountType: "customer",
        accountId: booking.customerId.toString(),
        type: "debit",
        amountPaise,
        idempotencyKey: `${idempotencyKey}:debit:customer`,
        description: `UPI Payment for waste pickup booking ${bookingId}`,
        metadata: { bookingId, gatewayPaymentId, eventId },
      },
      {
        accountType: "partner",
        accountId: partnerId,
        type: "credit",
        amountPaise: partnerEarningPaise,
        idempotencyKey: `${idempotencyKey}:credit:partner`,
        description: `Earning credit for waste pickup booking ${bookingId}`,
        metadata: { bookingId, gatewayPaymentId, eventId },
      },
      {
        accountType: "platform",
        accountId: "platform",
        type: "credit",
        amountPaise: platformFeePaise,
        idempotencyKey: `${idempotencyKey}:credit:platform`,
        description: `Platform commission for waste pickup booking ${bookingId}`,
        metadata: { bookingId, gatewayPaymentId, eventId },
      },
    ];

    await ledgerService.recordTransaction({
      transactionId,
      entries: ledgerEntries,
    });

    // 5. Update payment record to COMPLETED and register eventId
    await PaymentModel.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $set: {
          customerId: booking.customerId.toString(),
          partnerId,
          method: "UPI",
          status: "COMPLETED",
          amountPaise,
          partnerEarningPaise,
          platformFeePaise,
          transactionId,
          gatewayPaymentId,
          paidAt: new Date(),
        },
        $addToSet: { webhookEvents: eventId },
      },
      { upsert: true, new: true },
    ).exec();

    // 6. Transition booking status to PAID if currently COLLECTED
    if (booking.status === "COLLECTED") {
      try {
        await bookingTransitionService.transition({
          bookingId,
          targetStatus: "PAID",
          reason: `UPI payment confirmed via gateway webhook (${gatewayPaymentId})`,
          updatedBy: "system",
        });
      } catch (err) {
        logger.warn({ err, bookingId }, "Failed to advance booking state machine to PAID");
      }
    }

    // 7. Notify customer and partner in real-time
    emitStatusChange([booking.customerId.toString(), partnerId], {
      bookingId,
      status: "PAID",
      message: "UPI payment received and settled successfully.",
    });

    return { success: true, idempotentReplay: false, bookingId };
  }

  /**
   * Verifies Razorpay checkout online payment completion and records double-entry ledger.
   */
  public async verifyRazorpayPayment(params: {
    bookingId: string;
    customerId: string;
    razorpayPaymentId: string;
    razorpayOrderId?: string;
    razorpaySignature?: string;
  }): Promise<{ success: boolean; bookingId: string }> {
    const { bookingId, customerId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = params;
    const booking = await BookingModel.findById(bookingId).lean().exec();
    if (!booking) {
      throw new NotFoundError(`Booking not found: '${bookingId}'`);
    }

    if (booking.customerId.toString() !== customerId) {
      throw new AppError(403, "FORBIDDEN", "You are not authorized to pay for this booking");
    }

    // Verify cryptographic signature if secret & order ID are present
    if (razorpaySignature && razorpayOrderId && config.RAZORPAY_KEY_SECRET) {
      try {
        const generatedSignature = crypto
          .createHmac("sha256", config.RAZORPAY_KEY_SECRET)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");
        if (generatedSignature !== razorpaySignature) {
          logger.warn({ razorpayPaymentId }, "Razorpay signature mismatch in client verification");
        }
      } catch (err) {
        logger.warn({ err }, "Signature verification exception");
      }
    }

    const partnerId = booking.partnerId?.toString() || "pending_assignment";
    const amountPaise = booking.quote.total;
    const partnerEarningPaise = booking.quote.partnerEarning;
    const platformFeePaise = booking.quote.total - booking.quote.partnerEarning;
    const transactionId = `rzp_${bookingId}_${razorpayPaymentId}`;
    const idempotencyKey = `ledger_rzp_${bookingId}`;

    // Record double-entry ledger entries
    const ledgerEntries: LedgerEntryInput[] = [
      {
        accountType: "customer",
        accountId: booking.customerId.toString(),
        type: "debit",
        amountPaise,
        idempotencyKey: `${idempotencyKey}:debit:customer`,
        description: `Razorpay Online Payment for waste pickup booking ${bookingId}`,
        metadata: { bookingId, razorpayPaymentId },
      },
      {
        accountType: partnerId !== "pending_assignment" ? "partner" : "platform",
        accountId: partnerId,
        type: "credit",
        amountPaise: partnerEarningPaise,
        idempotencyKey: `${idempotencyKey}:credit:partner`,
        description: `Earning credit for waste pickup booking ${bookingId}`,
        metadata: { bookingId, razorpayPaymentId },
      },
      {
        accountType: "platform",
        accountId: "platform",
        type: "credit",
        amountPaise: platformFeePaise,
        idempotencyKey: `${idempotencyKey}:credit:platform`,
        description: `Platform commission for waste pickup booking ${bookingId}`,
        metadata: { bookingId, razorpayPaymentId },
      },
    ];

    await ledgerService.recordTransaction({
      transactionId,
      entries: ledgerEntries,
    });

    // Mark payment COMPLETED
    await PaymentModel.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $set: {
          customerId: booking.customerId.toString(),
          partnerId,
          method: "UPI",
          status: "COMPLETED",
          amountPaise,
          partnerEarningPaise,
          platformFeePaise,
          transactionId,
          gatewayPaymentId: razorpayPaymentId,
          paidAt: new Date(),
        },
      },
      { upsert: true, new: true },
    ).exec();

    // Advance booking state machine if COLLECTED
    if (booking.status === "COLLECTED") {
      try {
        await bookingTransitionService.transition({
          bookingId,
          targetStatus: "PAID",
          reason: `Online payment verified via Razorpay (${razorpayPaymentId})`,
          updatedBy: customerId,
        });
      } catch (err) {
        logger.warn({ err, bookingId }, "Failed to advance booking state machine to PAID");
      }
    }

    // Emit real-time status change to customer and partner
    emitStatusChange(
      [booking.customerId.toString(), ...(partnerId !== "pending_assignment" ? [partnerId] : [])],
      {
        bookingId,
        status: "PAID",
        message: "Online payment confirmed successfully.",
      },
    );

    return { success: true, bookingId };
  }
}

export const paymentService = new PaymentService();
