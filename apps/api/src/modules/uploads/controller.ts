import { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { uploadService } from "./service.js";
import { AppError } from "../../errors/appError.js";

const presignSchema = z.object({
  fileName: z.string().min(1).default("waste_capture.jpg"),
  contentType: z.string().min(1).default("image/jpeg"),
});

export class UploadController {
  public async presign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = presignSchema.parse(req.body);
      const host = req.get("host");
      const result = await uploadService.generatePresignedUpload(
        parsed.fileName,
        parsed.contentType,
        host,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.params["key"] as string;
      if (!key) {
        throw new AppError(400, "BAD_REQUEST", "Missing file key");
      }

      const body = req.body as Buffer;
      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        throw new AppError(400, "BAD_REQUEST", "No binary payload received");
      }

      await uploadService.saveFile(key, body);
      res.status(200).json({ success: true, key });
    } catch (err) {
      next(err);
    }
  }

  public async getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.params["key"] as string;
      const file = await uploadService.getFile(key);
      if (!file) {
        res.status(404).send("File not found");
        return;
      }

      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.status(200).send(file.data);
    } catch (err) {
      next(err);
    }
  }
}

export const uploadController = new UploadController();
