import { partnerRepo, type PartnerRecord, type CreatePartnerData } from "./repo.js";
import { geoService } from "./geoService.js";
import { userService } from "../users/service.js";
import { userRepo } from "../users/repo.js";
import { config } from "../../infra/config.js";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} from "../../errors/appError.js";
import type { KycStatus, NearbyPartner } from "@sanitary/shared";

/**
 * Service encapsulating partner lifecycle, KYC verification, and presence management.
 */
export class PartnerService {
  /**
   * Onboards a partner with initial KYC documentation.
   */
  public async onboard(
    userId: string,
    phone: string,
    data: Omit<CreatePartnerData, "userId" | "phone">,
  ): Promise<PartnerRecord> {
    const existing = await partnerRepo.findByUserId(userId);
    if (existing) {
      throw new ConflictError("Partner profile already exists for this account");
    }

    // Elevate user's role to partner in database
    await userRepo.updateById(userId, { role: "partner" });

    return partnerRepo.create({
      userId,
      phone,
      ...data,
    });
  }

  /**
   * Retrieves partner profile by User ID.
   */
  public async getByUserId(userId: string): Promise<PartnerRecord> {
    const partner = await partnerRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Partner profile not found");
    }
    return partner;
  }

  /**
   * Retrieves partner profile by Partner ID.
   */
  public async getById(id: string): Promise<PartnerRecord> {
    const partner = await partnerRepo.findById(id);
    if (!partner) {
      throw new NotFoundError(`Partner with ID '${id}' not found`);
    }
    return partner;
  }

  /**
   * Administrative KYC review: APPROVE or REJECT partner documentation.
   */
  public async reviewKyc(
    partnerId: string,
    status: KycStatus,
    rejectionReason?: string,
  ): Promise<PartnerRecord> {
    const partner = await partnerRepo.findById(partnerId);
    if (!partner) {
      throw new NotFoundError(`Partner with ID '${partnerId}' not found`);
    }

    const updated = await partnerRepo.updateKycStatus(partnerId, status, rejectionReason);
    if (!updated) {
      throw new NotFoundError(`Partner with ID '${partnerId}' not found`);
    }

    // Elevate user role in Users collection upon KYC approval
    if (status === "APPROVED") {
      await userService.create({ phone: updated.phone, role: "partner" });
    } else if (status === "REJECTED") {
      // Remove from live geospatial tracking if rejected
      await geoService.removeLocation(partnerId);
    }

    return updated;
  }

  /**
   * Toggles partner online/offline state.
   * Gated: Only partners with APPROVED KYC may go online.
   */
  public async toggleOnlineStatus(partnerId: string, isOnline: boolean): Promise<PartnerRecord> {
    const partner = await partnerRepo.findById(partnerId);
    if (!partner) {
      throw new NotFoundError("Partner not found");
    }

    if (isOnline && partner.kyc.status !== "APPROVED") {
      throw new ForbiddenError(
        `Cannot go online: KYC status is '${partner.kyc.status}'. Partner documentation must be APPROVED.`,
      );
    }

    const updated = await partnerRepo.updateOnlineStatus(partnerId, isOnline);
    if (!updated) {
      throw new NotFoundError("Partner not found");
    }

    if (!isOnline) {
      await geoService.removeLocation(partnerId);
    }

    return updated;
  }

  /**
   * Records a live GPS location ping for an active online partner.
   */
  public async recordLocation(
    partnerId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ recorded: boolean; throttled: boolean }> {
    const partner = await partnerRepo.findById(partnerId);
    if (!partner) {
      throw new NotFoundError("Partner not found");
    }

    if (!partner.isOnline) {
      throw new BadRequestError("Partner must be set to online before sending location pings");
    }

    if (partner.kyc.status !== "APPROVED") {
      throw new ForbiddenError("Only partners with approved KYC can emit location pings");
    }

    return geoService.recordLocationPing(partnerId, latitude, longitude);
  }

  /**
   * Queries nearby live partners from Redis GEO.
   */
  public async findNearby(
    lat: number,
    lng: number,
    radiusKm?: number,
    limit?: number,
  ): Promise<NearbyPartner[]> {
    return geoService.findNearby(lat, lng, radiusKm, limit);
  }

  public async findByIds(ids: string[]): Promise<PartnerRecord[]> {
    return partnerRepo.findByIds(ids);
  }
}

export const partnerService = new PartnerService();
