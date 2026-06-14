import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCanvasConfig } from "../workflows/useCanvasConfig";
import { AgentStudioPage } from "./AgentStudioPage";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("AgentStudioPage", () => {
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

  it("matches the branch Agent Studio view without local action buttons", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "agent-after-sale",
            name: "售后政策助手",
            scenario: "订单售后、退款和质保政策问答",
            owner: "陈晓",
            status: "blocked",
            modelPolicy: "gpt-4.1 + fallback",
            workflowId: "workflow-after-sale",
            knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
            toolIds: ["tool-create-ticket"]
          }
        ]
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "Agent Studio" })).toBeInTheDocument();
    expect(screen.getByText("构建 / Agent Studio")).toBeInTheDocument();
    expect(screen.getByText("售后政策助手")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "试运行" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建草稿 Agent" })).not.toBeInTheDocument();
  });

  it("shows the latest canvas run result when workflow debug has produced output", async () => {
    useCanvasConfig.setState({
      modelProviderId: "model_provider_local",
      knowledgeBaseIds: ["kb-after-sale"],
      userInput: "Can ORD-2048 refund?",
      latestRun: {
        id: "run_canvas",
        agentId: "agent-after-sale",
        status: "success",
        costCny: 0.06,
        finalOutput: "Configured model answer",
        steps: [{ id: "step-llm", type: "llm", title: "LLM Decision", status: "success", latencyMs: 120 }]
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => []
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText("智能体调用结果")).toBeInTheDocument());
    expect(screen.getByText("Configured model answer")).toBeInTheDocument();
    expect(screen.getByText("全部步骤通过")).toBeInTheDocument();
  });
});
