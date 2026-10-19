import { apiClient } from "./client.js";
import type { PricingBreakdown } from "./wasteTypes.js";

export interface PresignResponse {
  uploadUrl: string;
  downloadUrl: string;
  key: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface AiEstimateItem {
  name: string;
  quantity: number;
  estimatedWeightKg?: number;
  wasteTypeId?: string;
}

export interface AiWasteEstimate {
  wasteType: string;
  items: AiEstimateItem[];
  estimatedWeightKg: number;
  volumeClass: "SMALL" | "MEDIUM" | "LARGE" | "BULK";
  hazardous: boolean;
  confidence: number;
}

export interface AiEstimateResponse {
  fallback: boolean;
  estimate?: AiWasteEstimate;
  quote?: PricingBreakdown;
  cacheHit?: boolean;
}

export async function presignUpload(
  fileName = "waste_capture.jpg",
  contentType = "image/jpeg",
): Promise<PresignResponse> {
  return apiClient<PresignResponse>("/uploads/presign", {
    method: "POST",
    body: JSON.stringify({ fileName, contentType }),
  });
}

export async function uploadBinary(uploadUrl: string, blob: Blob): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: {
      "Content-Type": blob.type || "image/jpeg",
    },
  });

  if (!response.ok) {
    throw new Error(`Direct upload failed with status ${response.status}`);
  }
}

export async function estimateWaste(
  imageUrl: string,
  distanceKm = 2,
  isScheduled = false,
  surgeMultiplier = 1.0,
): Promise<AiEstimateResponse> {
  return apiClient<AiEstimateResponse>("/ai/estimate", {
    method: "POST",
    body: JSON.stringify({
      imageUrl,
      distanceKm,
      isScheduled,
      surgeMultiplier,
    }),
  });
}
