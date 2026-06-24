import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("main API mode", () => {
  it("不再加载前端 MSW 假数据入口", () => {
    const mainSource = readFileSync(resolve(__dirname, "../main.tsx"), "utf8");

    expect(mainSource).not.toContain("VITE_USE_MOCK_API");
    expect(mainSource).not.toContain("./lib/mock/browser");
    expect(existsSync(resolve(__dirname, "../lib/mock"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../../public/mockServiceWorker.js"))).toBe(false);
  });
});
