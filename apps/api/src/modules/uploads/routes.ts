import express, { Router } from "express";
import { uploadController } from "./controller.js";
import { authenticate } from "../../middlewares/auth.js";

export const uploadRouter = Router();

// Presign upload request for authenticated users
uploadRouter.post("/uploads/presign", authenticate, (req, res, next) =>
  uploadController.presign(req, res, next),
);

// Direct binary PUT upload endpoint (supports S3-like PUT /uploads/files/:key)
uploadRouter.put(
  "/uploads/files/:key",
  express.raw({ type: "*/*", limit: "15mb" }),
  (req, res, next) => uploadController.uploadFile(req, res, next),
);

// Serve uploaded files
uploadRouter.get("/uploads/files/:key", (req, res, next) =>
  uploadController.getFile(req, res, next),
);
