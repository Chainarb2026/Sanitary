import { type AiProviderResult, type AiWasteEstimate, aiWasteEstimateSchema } from "./schemas.js";
import { CircuitBreaker } from "./circuitBreaker.js";
import { config } from "../../infra/config.js";
import { AppError } from "../../errors/appError.js";
import { logger } from "../../infra/logger.js";

export interface AiProvider {
  estimateWaste(imageUrl: string): Promise<AiProviderResult>;
}

export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 100,
): Promise<T> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await action();
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      attempt++;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn({ attempt, delay, err }, "AI provider call failed. Retrying with backoff...");
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Retry loop exhausted");
}

export class GeminiVisionAiProvider implements AiProvider {
  private circuitBreaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 10000 });
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey = config.GEMINI_API_KEY, timeoutMs = config.AI_TIMEOUT_MS) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  public getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  public async estimateWaste(imageUrl: string): Promise<AiProviderResult> {
    return this.circuitBreaker.execute(async () => {
      return retryWithBackoff(async () => {
        return this.callGeminiApi(imageUrl);
      });
    });
  }

  private async callGeminiApi(imageUrl: string): Promise<AiProviderResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const prompt = `Analyze this image of household waste. Return ONLY a valid JSON object matching this schema:
{
  "wasteType": "Small Bag" | "Medium" | "Bulk Furniture" | "Debris" | "Garden Waste" | "E-Waste" | "Scrap",
  "items": [{ "name": string, "quantity": number, "estimatedWeightKg": number }],
  "estimatedWeightKg": number,
  "volumeClass": "small" | "medium" | "large" | "bulk",
  "hazardous": boolean,
  "confidence": number (between 0.0 and 1.0)
}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: imageUrl, // or fetched base64
                  },
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(
          response.status,
          "GEMINI_API_ERROR",
          `Gemini API returned status ${response.status}`,
        );
      }

      interface GeminiApiResponse {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      }

      const json = (await response.json()) as GeminiApiResponse;
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

      // Clean markdown code blocks if wrapped by model
      const cleanedJsonStr = rawText
        .replace(/^```json\s*/, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");

      const parsedJson = JSON.parse(cleanedJsonStr);
      const validatedEstimate: AiWasteEstimate = aiWasteEstimateSchema.parse(parsedJson);

      const promptTokens = json.usageMetadata?.promptTokenCount ?? 350;
      const completionTokens = json.usageMetadata?.candidatesTokenCount ?? 150;
      const totalTokens = json.usageMetadata?.totalTokenCount ?? 500;
      // Approx 0.00001875 USD/1K tokens => ~1.5 paise per 1K tokens
      const estimatedCostPaise = Math.max(1, Math.round((totalTokens / 1000) * 2));

      return {
        rawResponse: rawText,
        estimate: validatedEstimate,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostPaise,
        },
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AppError(504, "AI_PROVIDER_TIMEOUT", "Gemini vision API request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class MockAiProvider implements AiProvider {
  private mockHandler?: (imageUrl: string) => Promise<AiProviderResult>;
  private circuitBreaker = new CircuitBreaker();

  public setMockHandler(handler: (imageUrl: string) => Promise<AiProviderResult>): void {
    this.mockHandler = handler;
  }

  public getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  public async estimateWaste(imageUrl: string): Promise<AiProviderResult> {
    return this.circuitBreaker.execute(async () => {
      if (this.mockHandler) {
        return this.mockHandler(imageUrl);
      }

      // Default mock success response
      const defaultEstimate: AiWasteEstimate = {
        wasteType: "Small Bag",
        items: [{ name: "Mixed Recyclables", quantity: 1, estimatedWeightKg: 4.5 }],
        estimatedWeightKg: 4.5,
        volumeClass: "small",
        hazardous: false,
        confidence: 0.92,
      };

      return {
        rawResponse: JSON.stringify(defaultEstimate),
        estimate: defaultEstimate,
        usage: {
          promptTokens: 280,
          completionTokens: 85,
          totalTokens: 365,
          estimatedCostPaise: 1,
        },
      };
    });
  }
}

let activeAiProvider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (!activeAiProvider) {
    if (config.AI_PROVIDER === "gemini") {
      activeAiProvider = new GeminiVisionAiProvider();
    } else {
      activeAiProvider = new MockAiProvider();
    }
  }
  return activeAiProvider;
}

export function setAiProvider(provider: AiProvider | null): void {
  activeAiProvider = provider;
}
