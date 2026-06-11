import { afterEach, describe, expect, it, vi } from "vitest";

describe("getJson", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("使用 VITE_API_BASE_URL 拼接真实 API 地址", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8000");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getJson } = await import("./client");
    const result = await getJson<{ status: string }>("/health");

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/health");
  });
});
