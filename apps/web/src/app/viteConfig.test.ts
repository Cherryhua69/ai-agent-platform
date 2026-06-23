import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("viteConfig", () => {
  it("本地开发时将 API 请求代理到后端服务", () => {
    const config = readFileSync(resolve(__dirname, "../../vite.config.ts"), "utf-8");

    expect(config).toContain('"/api"');
    expect(config).toContain("http://127.0.0.1:8001");
  });
});
