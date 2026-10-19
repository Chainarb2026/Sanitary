import { Router } from "express";
import { geoController } from "./controller.js";

export const geoRouter = Router();

geoRouter.get("/geo/reverse", (req, res, next) => geoController.reverse(req, res, next));
geoRouter.get("/geo/search", (req, res, next) => geoController.search(req, res, next));
geoRouter.get("/geo/ip-detect", (req, res, next) => geoController.detectIp(req, res, next));
