import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  });

  it("可以通过真实 API 创建 Agent 草稿并展示返回结果", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "agent_12345678",
          name: "售后政策助手",
          scenario: "售后问答与工单分流",
          owner: "陈晓",
          status: "draft",
          modelPolicy: "gpt-4.1 + fallback",
          workflowId: "flow_agent_12345678",
          knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
          toolIds: ["tool-ticket", "tool-order"]
        })
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: "创建草稿 Agent" }));

    await waitFor(() => expect(screen.getByText("已创建草稿：售后政策助手")).toBeInTheDocument());
    expect(screen.getAllByText("flow_agent_12345678")).toHaveLength(2);
  });

  it("可以触发试运行并展示最新 Trace 摘要", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST" && String(_input).endsWith("/api/agents")) {
          return {
            ok: true,
            json: async () => ({
              id: "agent_12345678",
              name: "售后政策助手",
              scenario: "售后问答与工单分流",
              owner: "陈晓",
              status: "draft",
              modelPolicy: "gpt-4.1 + fallback",
              workflowId: "flow_agent_12345678",
              knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
              toolIds: ["tool-ticket", "tool-order"]
            })
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: "run_12345678",
            agentId: "agent_12345678",
            status: "blocked",
            costCny: 0.09,
            steps: [
              { id: "step_input", type: "trigger", title: "用户输入", status: "success", latencyMs: 18 },
              {
                id: "step_tool_health",
                type: "tool",
                title: "检查工具健康状态",
                status: "failed",
                latencyMs: 42,
                errorMessage: "create_ticket degraded"
              }
            ]
          })
        };
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: "创建草稿 Agent" }));
    await waitFor(() => expect(screen.getByText("已创建草稿：售后政策助手")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "试运行" }));

    await waitFor(() => expect(screen.getByText("最新运行：run_12345678")).toBeInTheDocument());
    expect(screen.getByText("失败步骤：检查工具健康状态")).toBeInTheDocument();
  });
});
