import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IWasteType {
  slug: string;
  name: string;
  description: string;
  basePrice: number; // Integer paise
  ratePerKg: number; // Integer paise
  commissionRate: number; // e.g. 0.15 for 15%
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type WasteTypeDocument = IWasteType & Document;

const wasteTypeSchema = new Schema<IWasteType>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    ratePerKg: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionRate: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.15,
    },
    unit: {
      type: String,
      required: true,
      default: "item",
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * INDEX EXPLANATION:
 * 1. Unique index on `slug` is defined inline in the schema definition.
 * 2. Compound index on `{ isActive: 1, createdAt: -1 }` accelerates customer catalog queries.
 */
wasteTypeSchema.index({ isActive: 1, createdAt: -1 });

export const WasteTypeModel: Model<IWasteType> =
  mongoose.models.WasteType ||
  mongoose.model<IWasteType>("WasteType", wasteTypeSchema, "wasteTypes");
