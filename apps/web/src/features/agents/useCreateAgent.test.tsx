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

  it("调用创建接口时提交名称、场景和模型策略，不提交负责人", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "agent_12345678",
        name: "售后政策助手",
        scenario: "售后问答",
        owner: "陈晓",
        status: "draft",
        modelPolicy: "gpt-4.1-mini + strict citation",
        workflowId: "flow_agent_12345678",
        knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
        toolIds: ["tool-ticket", "tool-order"]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateAgent(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        name: "售后政策助手",
        scenario: "售后问答",
        modelPolicy: "gpt-4.1-mini + strict citation"
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith("/api/agents", {
      body: JSON.stringify({
        name: "售后政策助手",
        scenario: "售后问答",
        modelPolicy: "gpt-4.1-mini + strict citation"
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("owner");
    expect(result.current.data?.workflowId).toBe("flow_agent_12345678");
  });
});