import mongoose from "mongoose";
import { PartnerModel, type IPartner } from "./model.js";
import type { KycStatus, VehicleType } from "@sanitary/shared";

export interface PartnerRecord extends Omit<IPartner, "userId"> {
  _id: string;
  userId: string;
}

export interface CreatePartnerData {
  userId: string;
  phone: string;
  name: string;
  vehicleType: VehicleType;
  serviceRadiusKm: number;
  documentType: string;
  documentNumber: string;
  documentUrl: string;
}

/**
 * Data Access Repository for Partners collection.
 */
export class PartnerRepo {
  public async findByUserId(userId: string): Promise<PartnerRecord | null> {
    const doc = await PartnerModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .lean()
      .exec();

    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
    };
  }

  public async findById(id: string): Promise<PartnerRecord | null> {
    const doc = await PartnerModel.findById(id).lean().exec();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
    };
  }

  public async findByPhone(phone: string): Promise<PartnerRecord | null> {
    const doc = await PartnerModel.findOne({ phone }).lean().exec();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
    };
  }

  public async create(data: CreatePartnerData): Promise<PartnerRecord> {
    const doc = await PartnerModel.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      phone: data.phone,
      name: data.name,
      vehicleType: data.vehicleType,
      serviceRadiusKm: data.serviceRadiusKm,
      isOnline: false,
      isActive: true,
      kyc: {
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        documentUrl: data.documentUrl,
        status: "PENDING",
        submittedAt: new Date(),
      },
    });

    return {
      userId: doc.userId.toString(),
      phone: doc.phone,
      name: doc.name,
      vehicleType: doc.vehicleType,
      serviceRadiusKm: doc.serviceRadiusKm,
      isOnline: doc.isOnline,
      isActive: doc.isActive,
      kyc: {
        documentType: doc.kyc.documentType,
        documentNumber: doc.kyc.documentNumber,
        documentUrl: doc.kyc.documentUrl,
        status: doc.kyc.status,
        rejectionReason: doc.kyc.rejectionReason,
        submittedAt: doc.kyc.submittedAt,
        reviewedAt: doc.kyc.reviewedAt,
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      _id: doc._id.toString(),
    };
  }

  public async updateKycStatus(
    id: string,
    status: KycStatus,
    rejectionReason?: string,
  ): Promise<PartnerRecord | null> {
    const doc = await PartnerModel.findByIdAndUpdate(
      id,
      {
        $set: {
          "kyc.status": status,
          "kyc.rejectionReason": rejectionReason,
          "kyc.reviewedAt": new Date(),
          ...(status === "REJECTED" ? { isOnline: false } : {}),
        },
      },
      { new: true },
    )
      .lean()
      .exec();

    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
    };
  }

  public async updateOnlineStatus(id: string, isOnline: boolean): Promise<PartnerRecord | null> {
    const doc = await PartnerModel.findByIdAndUpdate(id, { $set: { isOnline } }, { new: true })
      .lean()
      .exec();

    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
    };
  }

  public async findByIds(ids: string[]): Promise<PartnerRecord[]> {
    const validObjectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const docs = await PartnerModel.find({ _id: { $in: validObjectIds } })
      .lean()
      .exec();

    return docs.map((doc) => ({
      ...doc,
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
    }));
  }
}

export const partnerRepo = new PartnerRepo();
