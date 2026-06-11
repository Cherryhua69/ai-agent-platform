import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright-real-api",
  testMatch: "**/*.pw.ts",
  use: {
    baseURL: process.env.REAL_API_WEB_URL ?? "http://127.0.0.1:5176"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }]
});
