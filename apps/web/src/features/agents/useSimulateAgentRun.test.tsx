import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSimulateAgentRun } from "./useSimulateAgentRun";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

describe("useSimulateAgentRun", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends canvas model and knowledge configuration to the run endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "run_12345678",
        agentId: "agent_12345678",
        status: "success",
        costCny: 0,
        finalOutput: "configured answer",
        steps: []
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSimulateAgentRun(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        agentId: "agent_12345678",
        userInput: "Can ORD-2048 refund?",
        modelProviderId: "model_provider_12345678",
        knowledgeBaseIds: ["kb-after-sale"]
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith("/api/agents/agent_12345678/runs", {
      body: JSON.stringify({
        userInput: "Can ORD-2048 refund?",
        modelProviderId: "model_provider_12345678",
        knowledgeBaseIds: ["kb-after-sale"]
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  });

  it("refreshes dashboard recent runs after a test run is created", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "run_created",
        agentId: "agent_12345678",
        status: "success",
        runCategory: "test",
        costCny: 0,
        finalOutput: "configured answer",
        steps: []
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSimulateAgentRun(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        agentId: "agent_12345678",
        userInput: "Can ORD-2048 refund?",
        modelProviderId: "model_provider_12345678",
        knowledgeBaseIds: ["kb-after-sale"]
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["recent-runs"] });
  });
});
