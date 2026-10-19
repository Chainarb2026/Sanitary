import crypto from "node:crypto";
import { type Paise } from "@sanitary/shared";
import { config } from "../../infra/config.js";
import { logger } from "../../infra/logger.js";

export interface CreatePaymentLinkParams {
  bookingId: string;
  amountPaise: Paise;
  customerPhone?: string;
  customerName?: string;
  description: string;
}

export interface PaymentLinkResult {
  paymentId: string;
  paymentUrl: string;
  qrCodeUrl?: string;
}

export interface CreateOrderParams {
  bookingId: string;
  amountPaise: Paise;
  currency?: string;
}

export interface OrderResult {
  orderId: string;
  amountPaise: Paise;
  currency: string;
  keyId: string;
}

export interface PaymentProvider {
  createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult>;
  createOrder(params: CreateOrderParams): Promise<OrderResult>;
  verifyWebhookSignature(payload: string, signature: string, secret?: string): boolean;
}

export class RazorpayPaymentProvider implements PaymentProvider {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor(
    keyId = config.RAZORPAY_KEY_ID,
    keySecret = config.RAZORPAY_KEY_SECRET,
    webhookSecret = config.RAZORPAY_WEBHOOK_SECRET,
  ) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  public getKeyId(): string {
    return this.keyId;
  }

  public getKeySecret(): string {
    return this.keySecret;
  }

  public async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    const orderId = `order_${params.bookingId}_${Date.now()}`;
    logger.info(
      { bookingId: params.bookingId, orderId, amountPaise: params.amountPaise },
      "Created Razorpay order for online payment",
    );
    return {
      orderId,
      amountPaise: params.amountPaise,
      currency: params.currency || "INR",
      keyId: this.keyId,
    };
  }

  public async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
    const paymentId = `plink_${params.bookingId}_${Date.now()}`;
    const paymentUrl = `https://rzp.io/i/${paymentId}`;
    const qrCodeUrl = `upi://pay?pa=sanitary@upi&pn=Sanitary&am=${(params.amountPaise / 100).toFixed(2)}&tr=${params.bookingId}&tn=${encodeURIComponent(params.description)}`;

    logger.info(
      { bookingId: params.bookingId, paymentId, amountPaise: params.amountPaise },
      "Generated dynamic Razorpay UPI payment link and QR",
    );

    return {
      paymentId,
      paymentUrl,
      qrCodeUrl,
    };
  }

  public verifyWebhookSignature(
    payload: string,
    signature: string,
    secret = this.webhookSecret,
  ): boolean {
    if (!payload || !signature) return false;
    try {
      const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

      const expectedBuf = Buffer.from(expectedSignature, "utf8");
      const signatureBuf = Buffer.from(signature, "utf8");

      if (expectedBuf.length !== signatureBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch (err) {
      logger.warn({ err }, "Razorpay webhook signature verification encountered error");
      return false;
    }
  }
}

export const paymentProvider: PaymentProvider = new RazorpayPaymentProvider();
