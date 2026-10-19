import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { config } from "../../infra/config.js";
import { logger } from "../../infra/logger.js";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads_storage");

export interface PresignResult {
  uploadUrl: string;
  downloadUrl: string;
  key: string;
  method: "PUT";
  headers: Record<string, string>;
}

export class UploadService {
  private initialized = false;

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      this.initialized = true;
    } catch (err) {
      logger.error({ err }, "Failed to create uploads storage directory");
    }
  }

  public async generatePresignedUpload(
    fileName: string,
    contentType: string,
    hostHeader?: string,
  ): Promise<PresignResult> {
    await this.ensureDir();
    const ext = path.extname(fileName) || ".jpg";
    const key = `waste_${Date.now()}_${randomUUID().slice(0, 8)}${ext}`;

    const protocol = hostHeader?.includes("localhost") ? "http" : "https";
    const host = hostHeader || `localhost:${config.PORT}`;
    const baseUrl = `${protocol}://${host}`;

    const uploadUrl = `${baseUrl}/uploads/files/${key}`;
    const downloadUrl = `${baseUrl}/uploads/files/${key}`;

    return {
      uploadUrl,
      downloadUrl,
      key,
      method: "PUT",
      headers: {
        "Content-Type": contentType || "image/jpeg",
      },
    };
  }

  public async saveFile(key: string, data: Buffer): Promise<void> {
    await this.ensureDir();
    const sanitizedKey = path.basename(key);
    const filePath = path.join(UPLOADS_DIR, sanitizedKey);
    await fs.writeFile(filePath, data);
    logger.info({ key: sanitizedKey, sizeBytes: data.length }, "Direct upload stored successfully");
  }

  public async getFile(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    await this.ensureDir();
    const sanitizedKey = path.basename(key);
    const filePath = path.join(UPLOADS_DIR, sanitizedKey);
    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(sanitizedKey).toLowerCase();
      const contentType =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "image/jpeg";
      return { data, contentType };
    } catch {
      return null;
    }
  }
}

export const uploadService = new UploadService();
