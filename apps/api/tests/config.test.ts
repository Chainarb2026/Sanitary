import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/infra/config.js";

describe("Configuration Loader", () => {
  it("loads valid default configuration", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      PORT: "4000",
    });

    expect(config.NODE_ENV).toBe("test");
    expect(config.PORT).toBe(4000);
    expect(config.MONGO_URI).toBeDefined();
    expect(config.REDIS_URL).toBeDefined();
  });

  it("fails fast with fatal error message on invalid configuration", () => {
    expect(() =>
      loadConfig({
        PORT: "-1", // Invalid port
      }),
    ).toThrow("[CONFIG_FATAL]");

    expect(() =>
      loadConfig({
        NODE_ENV: "invalid_env" as unknown as "development",
      }),
    ).toThrow("[CONFIG_FATAL]");
  });
});
