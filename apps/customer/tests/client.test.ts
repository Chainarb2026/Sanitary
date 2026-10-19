import { describe, it, expect, beforeEach } from "vitest";
import {
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens,
  clearStoredTokens,
} from "../src/api/client.js";

describe("Customer App Storage & API Client", () => {
  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      length: 0,
      key: () => null,
    };
  });

  it("correctly manages access and refresh tokens in storage", () => {
    expect(getStoredAccessToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();

    setStoredTokens("access_token_xyz", "refresh_token_abc");
    expect(getStoredAccessToken()).toBe("access_token_xyz");
    expect(getStoredRefreshToken()).toBe("refresh_token_abc");

    clearStoredTokens();
    expect(getStoredAccessToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });
});
