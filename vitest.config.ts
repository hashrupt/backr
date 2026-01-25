import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [
      ["src/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/lib/**", "src/components/**"],
      exclude: ["src/**/__tests__/**", "src/**/__mocks__/**", "src/generated/**"],
    },
  },
});
