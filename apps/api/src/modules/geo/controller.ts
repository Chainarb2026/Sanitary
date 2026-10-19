import type { Request, Response, NextFunction } from "express";
import { reverseGeocodeQuerySchema, searchLocationsQuerySchema } from "@sanitary/shared";
import { geoCodingService } from "./service.js";

export class GeoController {
  public async reverse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng } = reverseGeocodeQuerySchema.parse(req.query);
      const result = await geoCodingService.reverseGeocode(lat, lng);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, city } = searchLocationsQuerySchema.parse(req.query);
      const results = await geoCodingService.search(q, city);
      res.status(200).json({ items: results });
    } catch (error) {
      next(error);
    }
  }

  public async detectIp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const forwarded = req.headers["x-forwarded-for"];
      const clientIp =
        typeof forwarded === "string"
          ? forwarded.split(",")[0]?.trim() || req.ip || ""
          : req.ip || "";

      const result = await geoCodingService.detectIp(clientIp);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const geoController = new GeoController();
