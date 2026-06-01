import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // Les specs e2e tournent avec Playwright (cf. playwright.config.ts).
    exclude: ["src/tests/e2e/**", "node_modules/**", ".next/**"],
    globals: true,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
