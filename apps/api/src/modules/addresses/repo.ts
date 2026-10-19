import mongoose from "mongoose";
import { AddressModel, type IAddress } from "./model.js";
import type { AddressLabel } from "@sanitary/shared";

export interface AddressRecord extends Omit<IAddress, "userId" | "buildingId"> {
  _id: string;
  userId: string;
  buildingId?: string;
}

export interface CreateAddressData {
  userId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  buildingId?: string;
  label: AddressLabel;
  isDefault: boolean;
}

/**
 * Data Access Repository for customer addresses.
 */
export class AddressRepo {
  public async findByUserId(userId: string): Promise<AddressRecord[]> {
    const docs = await AddressModel.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean()
      .exec();

    return docs.map((doc) => ({
      ...doc,
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
      buildingId: doc.buildingId?.toString(),
    }));
  }

  public async findById(id: string): Promise<AddressRecord | null> {
    const doc = await AddressModel.findById(id).lean().exec();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
      buildingId: doc.buildingId?.toString(),
    };
  }

  public async create(data: CreateAddressData): Promise<AddressRecord> {
    const doc = await AddressModel.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      location: {
        type: "Point",
        coordinates: [data.longitude, data.latitude], // GeoJSON [lng, lat]
      },
      buildingId: data.buildingId ? new mongoose.Types.ObjectId(data.buildingId) : undefined,
      label: data.label,
      isDefault: data.isDefault,
    });

    return {
      userId: doc.userId.toString(),
      addressLine1: doc.addressLine1,
      addressLine2: doc.addressLine2,
      city: doc.city,
      state: doc.state,
      pincode: doc.pincode,
      location: doc.location,
      buildingId: doc.buildingId?.toString(),
      label: doc.label,
      isDefault: doc.isDefault,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      _id: doc._id.toString(),
    };
  }

  public async unsetDefaults(userId: string): Promise<void> {
    await AddressModel.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), isDefault: true },
      { $set: { isDefault: false } },
    ).exec();
  }

  public async deleteById(id: string, userId: string): Promise<boolean> {
    const res = await AddressModel.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();
    return Boolean(res);
  }
}

export const addressRepo = new AddressRepo();
