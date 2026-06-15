import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCanvasConfig } from "./useCanvasConfig";
import { WorkflowPage } from "./WorkflowPage";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("WorkflowPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useCanvasConfig.setState({
      modelProviderId: "",
      knowledgeBaseIds: ["kb-after-sale"],
      userInput: "Order ORD-2048 asks whether refund is allowed",
      latestRun: null
    });
  });

  it("runs the canvas debug flow with configured model and knowledge bases", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "售后工单 Agentflow",
              status: "blocked",
              toolHealthStatus: "degraded",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "User request", status: "success" },
                { id: "node-llm", type: "llm", name: "Configured model", status: "success" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Canvas demo model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "local-smoke",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "kb-after-sale",
              name: "售后政策库",
              source: "上传文档",
              documentCount: 128,
              retrievalStrategy: "Hybrid + Rerank",
              qualityScore: 92,
              status: "ready"
            }
          ]
        };
      }

      if (init?.method === "POST" && url.endsWith("/api/agents/agent-after-sale/runs")) {
        return {
          ok: true,
          json: async () => ({
            id: "run_canvas",
            agentId: "agent-after-sale",
            status: "success",
            costCny: 0.06,
            finalOutput: "Configured model answer",
            steps: [{ id: "step-llm", type: "llm", title: "LLM Decision", status: "success", latencyMs: 120 }]
          })
        };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper() });

    await screen.findByText("Canvas demo model / local-smoke");
    await waitFor(() => expect(screen.getByLabelText("模型 API")).toHaveValue("model_provider_local"));
    fireEvent.click(screen.getByRole("button", { name: "运行调试" }));

    await waitFor(() => expect(screen.getByText("Configured model answer")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/agents/agent-after-sale/runs", {
      body: JSON.stringify({
        userInput: "Order ORD-2048 asks whether refund is allowed",
        modelProviderId: "model_provider_local",
        knowledgeBaseIds: ["kb-after-sale"]
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  });
});
