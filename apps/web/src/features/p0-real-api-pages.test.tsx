import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgePage } from "./knowledge/KnowledgePage";
import { ReleasePage } from "./releases/ReleasePage";
import { RunsPage } from "./runs/RunsPage";
import { ToolsPage } from "./tools/ToolsPage";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function stubFetchByPath(payloads: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      const payload = payloads[path];

      if (!payload) {
        return new Response("not found", { status: 404 });
      }

      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    })
  );
}

describe("P0 真实 API 页面", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("知识库页面展示真实知识库接口数据", async () => {
    stubFetchByPath({
      "/api/knowledge-bases": [
        {
          id: "kb-after-sale",
          name: "售后政策库",
          source: "上传文档 + 飞书同步",
          documentCount: 128,
          retrievalStrategy: "Hybrid + Rerank",
          qualityScore: 92,
          status: "ready"
        }
      ]
    });

    render(<KnowledgePage />, { wrapper });

    await waitFor(() => expect(screen.getByText("售后政策库")).toBeInTheDocument());
    expect(screen.getByText("Hybrid + Rerank")).toBeInTheDocument();
  });

  it("工具页面展示真实工具接口数据", async () => {
    stubFetchByPath({
      "/api/tools": [
        {
          id: "tool-create-ticket",
          name: "create_ticket",
          type: "mcp",
          credential: "ticket-prod",
          permission: "Developer + Operator",
          health: "degraded",
          lastCalledAt: "10 分钟前"
        }
      ]
    });

    render(<ToolsPage />, { wrapper });

    await waitFor(() => expect(screen.getByText("create_ticket")).toBeInTheDocument());
    expect(screen.getByText("10 分钟前")).toBeInTheDocument();
  });

  it("运行记录页面展示真实 Trace 数据", async () => {
    stubFetchByPath({
      "/api/runs/run_8f23/trace": {
        id: "run_8f23",
        agentId: "agent-after-sale",
        status: "blocked",
        costCny: 0.09,
        steps: [
          {
            id: "step_tool_health",
            type: "tool",
            title: "检查工具健康状态",
            status: "failed",
            latencyMs: 42,
            errorMessage: "create_ticket degraded"
          }
        ]
      }
    });

    render(<RunsPage />, { wrapper });

    await waitFor(() => expect(screen.getAllByText(/检查工具健康状态/).length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("create_ticket degraded").length).toBeGreaterThanOrEqual(1);
  });

  it("发布页面展示真实发布门禁原因", async () => {
    stubFetchByPath({
      "/api/release-gates": [
        {
          id: "gate_agent-after-sale",
          agentId: "agent-after-sale",
          status: "blocked",
          reasons: ["工具健康异常：create_ticket degraded"],
          checkedAt: "2026-06-10T09:30:00.000Z",
          auditId: "audit_12345678"
        }
      ]
    });

    render(<ReleasePage />, { wrapper });

    await waitFor(() => expect(screen.getByText("工具健康异常：create_ticket degraded")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("audit_12345678")).toBeInTheDocument());
  });
});
