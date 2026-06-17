import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../types/domain";
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

const listedAgent = {
  id: "agent-after-sale",
  name: "售后政策助手",
  scenario: "订单售后、退款和质保政策问答",
  owner: "陈晓",
  status: "blocked",
  modelPolicy: "gpt-4.1 + fallback",
  workflowId: "workflow-after-sale",
  knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
  toolIds: ["tool-create-ticket"]
};

const publishedAgent = {
  ...listedAgent,
  id: "agent-published",
  name: "已发布助手",
  scenario: "已经完成发布的智能体",
  status: "published",
  workflowId: "workflow-published"
};

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

  it("keeps only the create agent action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [listedAgent]
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "智能体" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建智能体" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看详情" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "试运行" })).not.toBeInTheDocument();
  });

  it("only renders agent cards without workflow draft or asset wrapper panels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [listedAgent]
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("article", { name: "售后政策助手" })).toBeInTheDocument();
    expect(screen.queryByText("创建流程")).not.toBeInTheDocument();
    expect(screen.queryByText("当前草稿")).not.toBeInTheDocument();
    expect(screen.queryByText("智能体资产")).not.toBeInTheDocument();
  });

  it("shows larger descriptions and only Chinese publish status on agent cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [listedAgent, publishedAgent]
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    const firstCard = await screen.findByRole("article", { name: "售后政策助手" });
    expect(firstCard.querySelector(".agent-card-description")).toHaveTextContent("订单售后、退款和质保政策问答");
    expect(firstCard.querySelector("dl")).not.toBeInTheDocument();
    expect(screen.queryByText("模型")).not.toBeInTheDocument();
    expect(screen.queryByText("负责人")).not.toBeInTheDocument();
    expect(screen.queryByText("工作流")).not.toBeInTheDocument();
    expect(screen.queryByText("blocked")).not.toBeInTheDocument();
    expect(screen.queryByText("published")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "售后政策助手" })).toHaveTextContent("未发布");
    expect(screen.getByRole("article", { name: "已发布助手" })).toHaveTextContent("已发布");
  });

  it("edits and deletes agents from the card action menu", async () => {
    let storedAgents = [listedAgent];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH" && String(input).endsWith("/api/agents/agent-after-sale")) {
        storedAgents = [
          {
            ...listedAgent,
            name: "升级后的售后助手",
            scenario: "覆盖售后升级、退款和质保"
          }
        ];
        return {
          ok: true,
          json: async () => storedAgents[0]
        };
      }

      if (init?.method === "DELETE" && String(input).endsWith("/api/agents/agent-after-sale")) {
        storedAgents = [];
        return {
          ok: true,
          json: async () => undefined
        };
      }

      return {
        ok: true,
        json: async () => storedAgents
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    const card = await screen.findByRole("article", { name: "售后政策助手" });
    expect(card.closest(".agent-card-grid")).toHaveClass("agent-card-grid");

    await userEvent.click(screen.getByRole("button", { name: "打开售后政策助手操作菜单" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "编辑" }));

    const dialog = screen.getByRole("dialog", { name: "编辑智能体" });
    const nameInput = screen.getByLabelText("智能体名称");
    const descriptionInput = screen.getByLabelText("描述");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "升级后的售后助手");
    await userEvent.clear(descriptionInput);
    await userEvent.type(descriptionInput, "覆盖售后升级、退款和质保");
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/agents/agent-after-sale"),
        expect.objectContaining({
          body: JSON.stringify({ name: "升级后的售后助手", scenario: "覆盖售后升级、退款和质保" }),
          method: "PATCH"
        })
      )
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(await screen.findByRole("article", { name: "升级后的售后助手" })).toHaveTextContent("覆盖售后升级、退款和质保");

    await userEvent.click(screen.getByRole("button", { name: "打开升级后的售后助手操作菜单" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "删除" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/agents/agent-after-sale"), expect.objectContaining({ method: "DELETE" }))
    );
    expect(screen.queryByRole("article", { name: "升级后的售后助手" })).not.toBeInTheDocument();
    expect(screen.getByText("暂无智能体，点击右上角创建智能体。")).toBeInTheDocument();
  });

  it("clicks the agent card body to request workflow configuration without triggering from the menu", async () => {
    const onConfigureAgent = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [listedAgent]
      })
    );

    render(<AgentStudioPage onConfigureAgent={onConfigureAgent} />, { wrapper: createWrapper() });

    await userEvent.click(await screen.findByRole("article", { name: "售后政策助手" }));

    expect(onConfigureAgent).toHaveBeenCalledWith(expect.objectContaining<Partial<Agent>>({ id: "agent-after-sale", workflowId: "workflow-after-sale" }));

    await userEvent.click(screen.getByRole("button", { name: "打开售后政策助手操作菜单" }));
    expect(onConfigureAgent).toHaveBeenCalledTimes(1);
  });

  it("opens a dialog to create an agent and shows agents as cards", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" && String(input).endsWith("/api/agents")) {
        return {
          ok: true,
          json: async () => ({
            ...listedAgent,
            id: "agent_12345678",
            name: "退款审核助手",
            scenario: "自动判断订单退款条件",
            status: "draft",
            workflowId: "flow_agent_12345678"
          })
        };
      }

      return {
        ok: true,
        json: async () => [listedAgent]
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("article", { name: "售后政策助手" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "创建智能体" }));

    const dialog = screen.getByRole("dialog", { name: "创建智能体" });
    expect(dialog.tagName).toBe("SECTION");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.querySelector("form.tool-form")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("智能体名称"), "退款审核助手");
    await userEvent.type(screen.getByLabelText("描述"), "自动判断订单退款条件");
    await userEvent.click(screen.getByRole("button", { name: "确认创建" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/agents"),
        expect.objectContaining({
          body: JSON.stringify({ name: "退款审核助手", scenario: "自动判断订单退款条件" }),
          method: "POST"
        })
      )
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(await screen.findByRole("article", { name: "退款审核助手" })).toBeInTheDocument();
    expect(screen.getByText("自动判断订单退款条件")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "退款审核助手" })).toHaveTextContent("未发布");
  });

  it("allows creating an agent without a description", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" && String(input).endsWith("/api/agents")) {
        return {
          ok: true,
          json: async () => ({
            ...listedAgent,
            id: "agent_12345678",
            name: "线索分配助手",
            scenario: "",
            status: "draft",
            workflowId: "flow_agent_12345678"
          })
        };
      }

      return {
        ok: true,
        json: async () => []
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    await userEvent.click(await screen.findByRole("button", { name: "创建智能体" }));
    await userEvent.type(screen.getByLabelText("智能体名称"), "线索分配助手");
    await userEvent.click(screen.getByRole("button", { name: "确认创建" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/agents"),
        expect.objectContaining({
          body: JSON.stringify({ name: "线索分配助手", scenario: "" }),
          method: "POST"
        })
      )
    );
    expect(await screen.findByRole("article", { name: "线索分配助手" })).toBeInTheDocument();
    expect(screen.getByText("暂未填写描述")).toBeInTheDocument();
  });

});
