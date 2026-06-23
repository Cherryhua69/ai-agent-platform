import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("main mock mode", () => {
  it("只在显式开启 VITE_USE_MOCK_API=true 时启动 MSW 预览数据", () => {
    const mainSource = readFileSync(resolve(__dirname, "../main.tsx"), "utf8");

    expect(mainSource).toContain('import.meta.env.VITE_USE_MOCK_API === "true"');
    expect(mainSource).not.toContain('import.meta.env.VITE_USE_MOCK_API !== "false"');
  });
});
