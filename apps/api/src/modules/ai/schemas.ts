import { z } from "zod";

export const aiVolumeClassSchema = z.enum(["small", "medium", "large", "bulk"]);
export type AiVolumeClass = z.infer<typeof aiVolumeClassSchema>;

export const aiEstimateItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  estimatedWeightKg: z.number().nonnegative().optional(),
});
export type AiEstimateItem = z.infer<typeof aiEstimateItemSchema>;

export const aiWasteEstimateSchema = z.object({
  wasteType: z.string().min(1),
  items: z.array(aiEstimateItemSchema).min(1),
  estimatedWeightKg: z.number().positive(),
  volumeClass: aiVolumeClassSchema,
  hazardous: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
});
export type AiWasteEstimate = z.infer<typeof aiWasteEstimateSchema>;

export interface AiEstimateResponse {
  fallback: boolean;
  reason?: string;
  estimate?: AiWasteEstimate;
  quote?: {
    base: number;
    perKg: number;
    convenienceFee: number;
    surgeMultiplier: number;
    total: number;
    partnerEarning: number;
    platformCommission: number;
  };
  cacheHit?: boolean;
}

export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostPaise: number;
}

export interface AiProviderResult {
  rawResponse: string;
  estimate: AiWasteEstimate;
  usage: AiTokenUsage;
}
