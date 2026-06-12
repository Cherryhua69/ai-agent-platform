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

const existingAgents = [
  {
    id: "agent-after-sale",
    name: "售后政策助手",
    scenario: "售后问答与工单分流",
    owner: "陈晓",
    status: "blocked",
    modelPolicy: "gpt-4.1 + fallback",
    workflowId: "workflow-after-sale",
    knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
    toolIds: ["tool-create-ticket", "tool-query-order"]
  },
  {
    id: "agent-contract",
    name: "合同审阅助手",
    scenario: "合同风险提示",
    owner: "王宁",
    status: "ready",
    modelPolicy: "gpt-4.1-mini + strict citation",
    workflowId: "workflow-contract",
    knowledgeBaseIds: ["kb-contract"],
    toolIds: ["tool-query-order"]
  }
];

describe("AgentStudioPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("展示创建智能体表单，并移除试运行与 Trace 内容", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => existingAgents
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    expect(await screen.findByLabelText("智能体名称")).toBeInTheDocument();
    expect(screen.getByLabelText("应用场景")).toBeInTheDocument();
    expect(screen.getByLabelText("模型策略")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建智能体" })).toBeInTheDocument();
    expect(screen.queryByText("创建草稿 Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("试运行")).not.toBeInTheDocument();
    expect(screen.queryByText("最新运行")).not.toBeInTheDocument();
    expect(screen.queryByText("Trace 成本")).not.toBeInTheDocument();
  });

  it("提交表单创建智能体，自动选中新智能体，并使用中文状态", async () => {
    const createdAgent = {
      id: "agent-order",
      name: "订单查询助手",
      scenario: "订单状态查询",
      owner: "系统默认",
      status: "draft",
      modelPolicy: "gpt-4.1-mini + strict citation",
      workflowId: "flow_agent-order",
      knowledgeBaseIds: ["kb-order"],
      toolIds: ["tool-query-order"]
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" && String(input).endsWith("/api/agents")) {
        return {
          ok: true,
          json: async () => createdAgent
        };
      }

      return {
        ok: true,
        json: async () => existingAgents
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    fireEvent.change(await screen.findByLabelText("智能体名称"), { target: { value: "订单查询助手" } });
    fireEvent.change(screen.getByLabelText("应用场景"), { target: { value: "订单状态查询" } });
    fireEvent.change(screen.getByLabelText("模型策略"), { target: { value: "gpt-4.1-mini + strict citation" } });
    fireEvent.click(screen.getByRole("button", { name: "创建智能体" }));

    await waitFor(() => expect(screen.getByText("已创建智能体：订单查询助手")).toBeInTheDocument());
    expect(screen.getAllByText("flow_agent-order").length).toBeGreaterThan(0);
    expect(screen.getAllByText("草稿").length).toBeGreaterThan(0);
    expect(JSON.parse(String(fetchMock.mock.calls.find((call) => call[1]?.method === "POST")?.[1]?.body))).toEqual({
      name: "订单查询助手",
      scenario: "订单状态查询",
      modelPolicy: "gpt-4.1-mini + strict citation"
    });
  });

  it("点击资产表中的查看后切换当前智能体详情", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => existingAgents
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "查看 合同审阅助手" }));

    expect(screen.getByText("当前智能体：合同审阅助手")).toBeInTheDocument();
    expect(screen.getAllByText("workflow-contract").length).toBeGreaterThan(0);
    expect(screen.getAllByText("就绪").length).toBeGreaterThan(0);
  });
});