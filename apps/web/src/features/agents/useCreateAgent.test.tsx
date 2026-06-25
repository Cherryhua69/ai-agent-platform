import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCreateAgent } from "./useCreateAgent";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useCreateAgent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("调用真实 API 创建 Agent 并返回前端字段", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "agent_12345678",
        name: "售后政策助手",
        scenario: "售后问答",
        owner: "陈晓",
        status: "draft",
        modelPolicy: "gpt-4.1 + fallback",
        workflowId: "flow_agent_12345678",
        knowledgeBaseIds: ["kb-support", "kb-policy"],
        toolIds: ["tool-ticket", "tool-order"]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateAgent(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ name: "售后政策助手", scenario: "售后问答" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith("/api/agents", {
      body: JSON.stringify({ name: "售后政策助手", scenario: "售后问答" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    expect(result.current.data?.workflowId).toBe("flow_agent_12345678");
  });
});
