import mongoose, { Schema, type Document, type Model } from "mongoose";
import { KYC_STATUSES, VEHICLE_TYPES, type KycStatus, type VehicleType } from "@sanitary/shared";

export interface IPartnerKyc {
  documentType: string;
  documentNumber: string;
  documentUrl: string;
  status: KycStatus;
  rejectionReason?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

export interface IPartner {
  userId: mongoose.Types.ObjectId;
  phone: string;
  name: string;
  vehicleType: VehicleType;
  serviceRadiusKm: number;
  isOnline: boolean;
  kyc: IPartnerKyc;
  isActive: boolean;
  rating?: number;
  acceptanceRate?: number;
  recentLoad?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerDocument = IPartner & Document;

const partnerKycSchema = new Schema<IPartnerKyc>(
  {
    documentType: { type: String, required: true },
    documentNumber: { type: String, required: true },
    documentUrl: { type: String, required: true },
    status: {
      type: String,
      enum: KYC_STATUSES,
      default: "PENDING",
      required: true,
    },
    rejectionReason: { type: String },
    submittedAt: { type: Date, default: Date.now, required: true },
    reviewedAt: { type: Date },
  },
  { _id: false },
);

const partnerSchema = new Schema<IPartner>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      enum: VEHICLE_TYPES,
      default: "two_wheeler",
      required: true,
    },
    serviceRadiusKm: {
      type: Number,
      default: 10,
      required: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
      required: true,
    },
    kyc: {
      type: partnerKycSchema,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 1.0,
      max: 5.0,
    },
    acceptanceRate: {
      type: Number,
      default: 1.0,
      min: 0.0,
      max: 1.0,
    },
    recentLoad: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * INDEX EXPLANATION:
 * 1. Unique indexes on `userId` and `phone` are defined inline in schema fields.
 * 2. Compound index on `{ "kyc.status": 1, isOnline: 1 }` allows administrative filtering of eligible active partners.
 */
partnerSchema.index({ "kyc.status": 1, isOnline: 1 });

export const PartnerModel: Model<IPartner> =
  mongoose.models.Partner || mongoose.model<IPartner>("Partner", partnerSchema, "partners");
