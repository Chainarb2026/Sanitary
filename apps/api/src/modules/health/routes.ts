import { Router } from "express";
import { healthController } from "./controller.js";

export const healthRouter = Router();

healthRouter.get("/health", (req, res) => healthController.getHealth(req, res));
healthRouter.get("/ready", (req, res, next) => healthController.getReady(req, res, next));
