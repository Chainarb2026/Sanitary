import { Router } from "express";
import { addressController } from "./controller.js";
import { authenticate } from "../../middlewares/auth.js";

export const addressRouter = Router();

addressRouter.post("/addresses", authenticate, (req, res, next) =>
  addressController.create(req, res, next),
);

addressRouter.get("/addresses", authenticate, (req, res, next) =>
  addressController.getMine(req, res, next),
);

addressRouter.get("/addresses/:id", authenticate, (req, res, next) =>
  addressController.getById(req, res, next),
);

addressRouter.delete("/addresses/:id", authenticate, (req, res, next) =>
  addressController.delete(req, res, next),
);
