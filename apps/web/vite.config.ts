import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    environment: "jsdom",
    passWithNoTests: true,
    setupFiles: ["./src/test/setup.ts"]
  }
});
