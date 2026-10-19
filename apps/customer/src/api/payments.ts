import { apiClient } from "./client.js";

export interface PaymentInitiationResult {
  paymentId: string;
  transactionId?: string;
  amountPaise: number;
  paymentUrl?: string;
  qrCodeUrl?: string;
  method: string;
  status: string;
}

export async function initiateUpiPayment(bookingId: string): Promise<PaymentInitiationResult> {
  return apiClient<PaymentInitiationResult>("/payments/upi/initiate", {
    method: "POST",
    body: JSON.stringify({ bookingId }),
  });
}

export interface RazorpayOrderResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  bookingId: string;
}

export async function createRazorpayOrder(bookingId: string): Promise<RazorpayOrderResult> {
  return apiClient<RazorpayOrderResult>("/payments/razorpay/order", {
    method: "POST",
    body: JSON.stringify({ bookingId }),
  });
}

export async function verifyRazorpayPayment(data: {
  bookingId: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
}): Promise<VerifyPaymentResult> {
  return apiClient<VerifyPaymentResult>("/payments/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
