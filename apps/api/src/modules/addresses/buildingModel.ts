import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IBuilding {
  name: string;
  address: string;
  pincode: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  gateInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BuildingDocument = IBuilding & Document;

const buildingSchema = new Schema<IBuilding>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
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
    gateInfo: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * INDEX EXPLANATION:
 * 2dsphere index on `location` permits geospatial proximity matching
 * for gated communities, apartment complexes, and tech parks.
 */
buildingSchema.index({ location: "2dsphere" });
buildingSchema.index({ pincode: 1 });

export const BuildingModel: Model<IBuilding> =
  mongoose.models.Building || mongoose.model<IBuilding>("Building", buildingSchema, "buildings");
