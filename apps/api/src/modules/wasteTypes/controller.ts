import type { Request, Response, NextFunction } from "express";
import {
  createWasteTypeSchema,
  updateWasteTypeSchema,
  calculateQuoteSchema,
} from "@sanitary/shared";
import { wasteTypeService } from "./service.js";

/**
 * Waste Types Controller strictly handling Zod validation and HTTP responses.
 */
export class WasteTypeController {
  public async getActiveCatalog(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await wasteTypeService.getActiveCatalog();
      res.status(200).json({ items, wasteTypes: items });
    } catch (error) {
      next(error);
    }
  }

  public async getAllForAdmin(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await wasteTypeService.getAllForAdmin();
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await wasteTypeService.getById(req.params.id as string);
      res.status(200).json(item);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createWasteTypeSchema.parse(req.body);
      const item = await wasteTypeService.create(validated);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateWasteTypeSchema.parse(req.body);
      const item = await wasteTypeService.update(req.params.id as string, validated);
      res.status(200).json(item);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await wasteTypeService.delete(req.params.id as string);
      res.status(200).json({ success: true, message: "Waste type removed from catalog" });
    } catch (error) {
      next(error);
    }
  }

  public async calculateQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = calculateQuoteSchema.parse(req.body);
      const quote = await wasteTypeService.calculateQuote(validated);
      res.status(200).json(quote);
    } catch (error) {
      next(error);
    }
  }
}

export const wasteTypeController = new WasteTypeController();
