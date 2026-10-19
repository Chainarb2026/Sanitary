import { Schema, model, type Document, type Types } from "mongoose";
import { type Paise } from "@sanitary/shared";

export type PaymentMethod = "UPI" | "CASH";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface IPayment extends Document {
  bookingId: Types.ObjectId;
  customerId: string;
  partnerId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountPaise: Paise;
  partnerEarningPaise: Paise;
  platformFeePaise: Paise;
  transactionId: string;
  paymentLinkId?: string;
  paymentUrl?: string;
  qrCodeUrl?: string;
  gatewayPaymentId?: string;
  idempotencyKey: string;
  webhookEvents: string[];
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    partnerId: {
      type: String,
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ["UPI", "CASH"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    partnerEarningPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFeePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    transactionId: {
      type: String,
      required: true,
      index: true,
    },
    paymentLinkId: {
      type: String,
    },
    paymentUrl: {
      type: String,
    },
    qrCodeUrl: {
      type: String,
    },
    gatewayPaymentId: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    webhookEvents: {
      type: [String],
      default: [],
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const PaymentModel = model<IPayment>("Payment", paymentSchema);
