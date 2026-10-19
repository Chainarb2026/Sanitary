import crypto from "node:crypto";
import { config } from "../infra/config.js";
import { AppError } from "../errors/appError.js";
import { ERROR_CODES, type AccessTokenPayload, type RefreshTokenPayload } from "@sanitary/shared";

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Signs a standard JWT with HS256 using native Node crypto.
 * Big-O: O(1) time, O(1) space.
 */
export function signJwt<T extends object>(payload: T, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies and decodes an HS256 JWT using constant-time signature comparison.
 * Big-O: O(1) time, O(1) space.
 */
export function verifyJwt<T extends { exp: number }>(token: string, secret: string): T {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError(401, ERROR_CODES.INVALID_TOKEN, "Malformed JWT structure");
  }

  const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    throw new AppError(401, ERROR_CODES.INVALID_TOKEN, "Invalid JWT signature");
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(encodedPayload)) as T;
    const nowEpoch = Math.floor(Date.now() / 1000);

    if (decoded.exp && decoded.exp < nowEpoch) {
      throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, "JWT has expired");
    }

    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, ERROR_CODES.INVALID_TOKEN, "Corrupted JWT payload");
  }
}

/**
 * Generates an Access Token with short expiry.
 */
export function generateAccessToken(payload: Omit<AccessTokenPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AccessTokenPayload = {
    ...payload,
    iat: now,
    exp: now + config.ACCESS_TOKEN_TTL_SECONDS,
  };
  return signJwt(fullPayload, config.JWT_SECRET);
}

/**
 * Verifies an Access Token.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return verifyJwt<AccessTokenPayload>(token, config.JWT_SECRET);
}

/**
 * Generates a Refresh Token with family tracking metadata.
 */
export function generateRefreshToken(payload: Omit<RefreshTokenPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: RefreshTokenPayload = {
    ...payload,
    iat: now,
    exp: now + config.REFRESH_TOKEN_TTL_SECONDS,
  };
  return signJwt(fullPayload, config.JWT_SECRET);
}

/**
 * Verifies a Refresh Token.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return verifyJwt<RefreshTokenPayload>(token, config.JWT_SECRET);
}
