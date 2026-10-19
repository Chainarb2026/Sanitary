import { Schema, model, type Document } from "mongoose";
import { type Paise } from "@sanitary/shared";

export type LedgerAccountType = "customer" | "partner" | "platform";
export type LedgerEntryType = "debit" | "credit";

export interface ILedgerEntry extends Document {
  transactionId: string;
  accountType: LedgerAccountType;
  accountId: string; // userId, partnerId, or "platform"
  type: LedgerEntryType;
  amountPaise: Paise; // strictly positive integer paise
  currency: string;
  idempotencyKey: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ledgerEntrySchema = new Schema<ILedgerEntry>(
  {
    transactionId: {
      type: String,
      required: true,
      index: true,
    },
    accountType: {
      type: String,
      enum: ["customer", "partner", "platform"],
      required: true,
    },
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: "INR",
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // append-only: no updatedAt mutations
    versionKey: false,
  },
);

// Compound index for fast account ledger traversals and balance queries
ledgerEntrySchema.index({ accountType: 1, accountId: 1, createdAt: -1 });

export const LedgerEntryModel = model<ILedgerEntry>("LedgerEntry", ledgerEntrySchema);
