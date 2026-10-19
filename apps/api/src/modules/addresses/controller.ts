import type { Request, Response, NextFunction } from "express";
import { createAddressSchema } from "@sanitary/shared";
import { addressService } from "./service.js";
import { UnauthorizedError } from "../../errors/appError.js";

/**
 * Controller strictly validating inputs with Zod and returning formatted addresses.
 */
export class AddressController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const validated = createAddressSchema.parse(req.body);
      const address = await addressService.create(req.user.userId, validated);
      res.status(201).json(address);
    } catch (error) {
      next(error);
    }
  }

  public async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const addresses = await addressService.getByUserId(req.user.userId);
      res.status(200).json({ addresses });
    } catch (error) {
      next(error);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const address = await addressService.getById(req.params.id as string, req.user.userId);
      res.status(200).json(address);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      await addressService.delete(req.params.id as string, req.user.userId);
      res.status(200).json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const addressController = new AddressController();
