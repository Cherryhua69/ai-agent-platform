import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../app/providers";
import { releaseGates } from "../../lib/mock/fixtures";
import { useReleaseGates } from "./useReleaseGates";

function wrapper({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}

describe("useReleaseGates", () => {
  it("从 mock API 读取 blocked 发布门禁原因", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify(releaseGates), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    try {
      const { result } = renderHook(() => useReleaseGates(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0].status).toBe("blocked");
      expect(result.current.data?.[0].reasons).toContain("工具健康异常：create_ticket degraded");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
