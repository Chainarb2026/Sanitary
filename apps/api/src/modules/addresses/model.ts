import mongoose, { Schema, type Document, type Model } from "mongoose";
import { ADDRESS_LABELS, type AddressLabel } from "@sanitary/shared";

export interface IAddress {
  userId: mongoose.Types.ObjectId;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  buildingId?: mongoose.Types.ObjectId;
  label: AddressLabel;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AddressDocument = IAddress & Document;

const addressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    buildingId: {
      type: Schema.Types.ObjectId,
      ref: "Building",
    },
    label: {
      type: String,
      enum: ADDRESS_LABELS,
      default: "home",
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
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
 * 1. `2dsphere` index on `location` is mandatory for geospatial radius pickup lookups.
 * 2. Compound index on `{ userId: 1, isDefault: -1 }` accelerates customer primary address seeks.
 * 3. Sparse index on `{ buildingId: 1 }` allows instant aggregation of building-specific pickups.
 */
addressSchema.index({ location: "2dsphere" });
addressSchema.index({ userId: 1, isDefault: -1 });
addressSchema.index({ buildingId: 1 }, { sparse: true });

export const AddressModel: Model<IAddress> =
  mongoose.models.Address || mongoose.model<IAddress>("Address", addressSchema, "addresses");
