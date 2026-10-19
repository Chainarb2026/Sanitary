import type { Request, Response, NextFunction } from "express";
import {
  partnerOnboardSchema,
  partnerKycReviewSchema,
  partnerStatusToggleSchema,
  partnerLocationPingSchema,
  findNearbyQuerySchema,
} from "@sanitary/shared";
import { partnerService } from "./service.js";
import { UnauthorizedError } from "../../errors/appError.js";

/**
 * Controller handling HTTP requests for partner onboarding, KYC reviews, and presence.
 */
export class PartnerController {
  public async onboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const validated = partnerOnboardSchema.parse(req.body);
      const partner = await partnerService.onboard(req.user.userId, req.user.phone, validated);
      res.status(201).json(partner);
    } catch (error) {
      next(error);
    }
  }

  public async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const partner = await partnerService.getByUserId(req.user.userId);
      res.status(200).json(partner);
    } catch (error) {
      next(error);
    }
  }

  public async approveKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const partnerId = req.params.id as string;
      const partner = await partnerService.reviewKyc(partnerId, "APPROVED");
      res.status(200).json({ success: true, partner });
    } catch (error) {
      next(error);
    }
  }

  public async rejectKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const partnerId = req.params.id as string;
      const { rejectionReason } = partnerKycReviewSchema.parse({
        status: "REJECTED",
        rejectionReason: req.body?.rejectionReason,
      });

      const partner = await partnerService.reviewKyc(partnerId, "REJECTED", rejectionReason);
      res.status(200).json({ success: true, partner });
    } catch (error) {
      next(error);
    }
  }

  public async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const { isOnline } = partnerStatusToggleSchema.parse(req.body);
      const partner = await partnerService.getByUserId(req.user.userId);
      const updated = await partnerService.toggleOnlineStatus(partner._id, isOnline);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  public async recordLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const { latitude, longitude } = partnerLocationPingSchema.parse(req.body);
      const partner = await partnerService.getByUserId(req.user.userId);
      const result = await partnerService.recordLocation(partner._id, latitude, longitude);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async findNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = findNearbyQuerySchema.parse(req.query);
      const partners = await partnerService.findNearby(
        query.latitude,
        query.longitude,
        query.radiusKm,
        query.limit,
      );
      res.status(200).json({ partners });
    } catch (error) {
      next(error);
    }
  }
}

export const partnerController = new PartnerController();
