import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@sanitary/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@sanitary/shared/": path.resolve(__dirname, "packages/shared/src") + "/",
    },
  },
});
