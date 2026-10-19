import { Schema, model, type Document } from "mongoose";
import { type Paise } from "@sanitary/shared";

export type PayoutStatus = "REQUESTED" | "PROCESSING" | "PROCESSED" | "FAILED";
export type PayoutMethod = "UPI" | "BANK_TRANSFER";

export interface IPayoutAccountDetails {
  upiId?: string;
  accountNumber?: string;
  ifsc?: string;
  beneficiaryName?: string;
}

export interface IPayout extends Document {
  partnerId: string;
  amountPaise: Paise;
  status: PayoutStatus;
  payoutMethod: PayoutMethod;
  accountDetails: IPayoutAccountDetails;
  transactionId: string;
  failureReason?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    partnerId: {
      type: String,
      required: true,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["REQUESTED", "PROCESSING", "PROCESSED", "FAILED"],
      default: "REQUESTED",
      index: true,
    },
    payoutMethod: {
      type: String,
      enum: ["UPI", "BANK_TRANSFER"],
      required: true,
    },
    accountDetails: {
      upiId: { type: String },
      accountNumber: { type: String },
      ifsc: { type: String },
      beneficiaryName: { type: String },
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    failureReason: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const PayoutModel = model<IPayout>("Payout", payoutSchema);
