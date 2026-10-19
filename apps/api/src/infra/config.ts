import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

// Attempt to load .env file if present (Node 20.6+ native feature)
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
} catch {
  // Ignored if .env is missing or invalid; schema will validate required vars
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  MONGO_URI: z
    .string()
    .min(1, "MONGO_URI is required")
    .default("mongodb://127.0.0.1:27017/sanitary?replicaSet=rs0"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required").default("redis://127.0.0.1:6379"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters")
    .default("sanitary-super-secret-jwt-key-2026-secure!"),
  OTP_SECRET: z
    .string()
    .min(16, "OTP_SECRET must be at least 16 characters")
    .default("sanitary-super-secret-otp-hmac-key-2026!"),
  OTP_TTL_SECONDS: z.coerce.number().int().min(30).default(300), // 5 minutes
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900), // 15 minutes
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).default(604800), // 7 days
  SMS_PROVIDER: z.enum(["dev", "mock", "twilio", "fast2sms", "2factor"]).default("dev"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  FAST2SMS_API_KEY: z.string().optional(),
  TWO_FACTOR_API_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().default("rzp_test_sanitary_key_123"),
  RAZORPAY_KEY_SECRET: z.string().default("rzp_test_secret_sanitary_secure_456"),
  RAZORPAY_WEBHOOK_SECRET: z.string().default("rzp_webhook_secret_sanitary_test_789"),
  MIN_PARTNER_WALLET_BALANCE_PAISE: z.coerce.number().int().default(-50000), // -500 INR overdraft floor
  MIN_PAYOUT_AMOUNT_PAISE: z.coerce.number().int().min(100).default(10000), // 100 INR minimum payout
  AI_PROVIDER: z.enum(["gemini", "mock"]).default("mock"),
  GEMINI_API_KEY: z.string().default("test-gemini-api-key"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(500).default(5000),
  AI_MAX_DAILY_REQUESTS_PER_USER: z.coerce.number().int().min(1).default(20),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Loads and validates environment variables.
 * Fails fast and terminates execution if configuration is invalid.
 * Big-O: O(1) time, O(1) space.
 */
export function loadConfig(envInput: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(envInput);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new Error(`[CONFIG_FATAL] Invalid environment configuration:\n${errorDetails}`);
  }
  return result.data;
}

export const config = loadConfig(process.env);
