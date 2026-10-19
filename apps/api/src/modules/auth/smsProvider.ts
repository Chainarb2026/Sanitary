import { logger } from "../../infra/logger.js";
import { config } from "../../infra/config.js";
import { AppError } from "../../errors/appError.js";

export interface SmsProvider {
  sendOtp(phone: string, otp: string): Promise<void>;
}

/**
 * Dev SMS provider for local development and testing.
 * Emits OTP to logs rather than invoking paid telecommunications carriers.
 */
export class DevSmsProvider implements SmsProvider {
  public async sendOtp(phone: string, otp: string): Promise<void> {
    logger.info({ phone, otp }, `[SMS_DEV] Generated OTP for ${phone}: ${otp}`);
  }
}

/**
 * Twilio SMS Gateway Provider for international and production SMS delivery.
 */
export class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid?: string, authToken?: string, fromNumber?: string) {
    this.accountSid = accountSid || config.TWILIO_ACCOUNT_SID || "";
    this.authToken = authToken || config.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = fromNumber || config.TWILIO_PHONE_NUMBER || "";

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      logger.warn(
        "TwilioSmsProvider initialized without full credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER). Dispatches will fail unless credentials are provided.",
      );
    }
  }

  public async sendOtp(phone: string, otp: string): Promise<void> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      throw new AppError(
        500,
        "SMS_PROVIDER_NOT_CONFIGURED",
        "Twilio credentials missing. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables.",
      );
    }

    const authHeader = "Basic " + Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const body = new URLSearchParams({
      To: phone,
      From: this.fromNumber,
      Body: `Your Sanitary verification code is: ${otp}. Valid for 5 minutes. Do not share this with anyone.`,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      logger.error({ status: response.status, body: errBody, phone }, "Twilio SMS dispatch failed");
      throw new AppError(502, "SMS_DISPATCH_FAILED", "Failed to dispatch SMS through Twilio gateway.");
    }

    logger.info({ phone }, "Twilio SMS dispatched successfully");
  }
}

/**
 * Fast2SMS Gateway Provider for high-throughput Indian (+91) OTP delivery.
 */
export class Fast2SmsProvider implements SmsProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.FAST2SMS_API_KEY || "";
    if (!this.apiKey) {
      logger.warn("Fast2SmsProvider initialized without FAST2SMS_API_KEY.");
    }
  }

  public async sendOtp(phone: string, otp: string): Promise<void> {
    if (!this.apiKey) {
      throw new AppError(
        500,
        "SMS_PROVIDER_NOT_CONFIGURED",
        "Fast2SMS API key missing. Configure FAST2SMS_API_KEY in environment variables.",
      );
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "otp",
        variables_values: otp,
        numbers: cleanPhone,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logger.error({ status: response.status, body: errBody, phone: cleanPhone }, "Fast2SMS dispatch failed");
      throw new AppError(502, "SMS_DISPATCH_FAILED", "Failed to dispatch SMS through Fast2SMS gateway.");
    }

    const data = (await response.json().catch(() => ({}))) as {
      return?: boolean;
      message?: string[] | string;
    };

    if (data.return === false) {
      const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message || "Fast2SMS rejected dispatch";
      logger.error({ data, phone: cleanPhone }, "Fast2SMS returned failure response");
      throw new AppError(502, "SMS_DISPATCH_FAILED", `Fast2SMS error: ${msg}`);
    }

    logger.info({ phone: cleanPhone }, "Fast2SMS OTP dispatched successfully");
  }
}

/**
 * 2Factor.in Gateway Provider for DLT-compliant Indian OTP SMS.
 */
export class TwoFactorSmsProvider implements SmsProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.TWO_FACTOR_API_KEY || "";
    if (!this.apiKey) {
      logger.warn("TwoFactorSmsProvider initialized without TWO_FACTOR_API_KEY.");
    }
  }

  public async sendOtp(phone: string, otp: string): Promise<void> {
    if (!this.apiKey) {
      throw new AppError(
        500,
        "SMS_PROVIDER_NOT_CONFIGURED",
        "2Factor API key missing. Configure TWO_FACTOR_API_KEY in environment variables.",
      );
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const response = await fetch(
      `https://2factor.in/API/V1/${this.apiKey}/SMS/${cleanPhone}/${otp}/Sanitary`,
      { method: "GET" },
    );

    if (!response.ok) {
      const errBody = await response.text();
      logger.error({ status: response.status, body: errBody, phone: cleanPhone }, "2Factor SMS dispatch failed");
      throw new AppError(502, "SMS_DISPATCH_FAILED", "Failed to dispatch SMS through 2Factor gateway.");
    }

    logger.info({ phone: cleanPhone }, "2Factor OTP dispatched successfully");
  }
}

function createConfiguredProvider(): SmsProvider {
  switch (config.SMS_PROVIDER) {
    case "twilio":
      return new TwilioSmsProvider();
    case "fast2sms":
      return new Fast2SmsProvider();
    case "2factor":
      return new TwoFactorSmsProvider();
    case "dev":
    case "mock":
    default:
      return new DevSmsProvider();
  }
}

let activeProvider: SmsProvider = createConfiguredProvider();

export function getSmsProvider(): SmsProvider {
  return activeProvider;
}

export function setSmsProvider(provider: SmsProvider): void {
  activeProvider = provider;
}

