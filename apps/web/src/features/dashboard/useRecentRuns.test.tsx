import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRecentRuns } from "./useRecentRuns";
import type { RecentRun } from "../../types/domain";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useRecentRuns", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("总览页挂载时即使有缓存也重新拉取近期运行", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 30_000
        }
      }
    });
    queryClient.setQueryData<RecentRun[]>(["recent-runs"], [
      {
        id: "run_cached",
        agentId: "agent-chat",
        agentName: "AI对话小助手",
        runTime: "2026-06-23T11:00:00",
        failureReason: "无",
        runCategory: "test",
        status: "success"
      }
    ]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          id: "run_latest",
          agentId: "agent-chat",
          agentName: "AI对话小助手",
          runTime: "2026-06-23T11:35:00",
          failureReason: "无",
          runCategory: "test",
          status: "success"
        }
      ]
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecentRuns(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runs/recent"));
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe("run_latest"));
  });
});
