import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../app/providers";
import { useReleaseGates } from "./useReleaseGates";

function wrapper({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}

describe("useReleaseGates", () => {
  it("从发布门禁 API 读取 blocked 原因", async () => {
    const originalFetch = globalThis.fetch;
    const releaseGates = [
      {
        id: "gate-after-sale",
        agentId: "agent-after-sale",
        status: "blocked",
        reasons: ["工具健康异常：create_ticket degraded"],
        checkedAt: "2026-06-10T09:30:00.000Z"
      }
    ];
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
