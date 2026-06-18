import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AppProviders } from "./providers";

const viewCases = [
  ["总览", "总览"],
  ["智能体", "智能体"],
  ["知识库", "知识库"],
  ["工具", "工具"],
  ["运行记录", "运行记录"],
  ["发布", "发布"],
  ["模板", "模板"]
];

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("总览保持轻量，不显示旧原型的全局操作和顶部栏", async () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    expect(await screen.findByRole("heading", { name: "总览" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导入资产" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建 Agent" })).not.toBeInTheDocument();
    expect(screen.queryByText("测试环境")).not.toBeInTheDocument();
  });

  it("不再显示评测观察、治理和竞品策略入口", async () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    expect(await screen.findByRole("heading", { name: "总览" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /评测观察/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /治理/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /竞品策略/ })).not.toBeInTheDocument();
  });

  it("支持 7 个主视图导航切换，工作流不再作为侧边栏入口", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    expect(screen.queryByRole("button", { name: "工作流" })).not.toBeInTheDocument();

    for (const [button, title] of viewCases) {
      await user.click(screen.getByRole("button", { name: new RegExp(button) }));
      expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    }
  });

  it("点击智能体卡片进入对应工作流配置", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/agents")) {
          return {
            ok: true,
            json: async () => [
              {
                id: "agent-contract-review",
                name: "Contract review assistant",
                scenario: "Extract contract clauses and identify risks",
                owner: "Ning Wang",
                status: "ready",
                modelPolicy: "gpt-4.1-mini + strict citation",
                workflowId: "workflow-contract-review",
                knowledgeBaseIds: ["kb-contract"],
                toolIds: ["tool-query-order"]
              }
            ]
          };
        }
        if (url.endsWith("/api/workflows")) {
          return {
            ok: true,
            json: async () => [
              {
                id: "workflow-contract-review",
                agentId: "agent-contract-review",
                name: "Contract review Agentflow",
                status: "ready",
                toolHealthStatus: "online",
                nodes: [{ id: "node-contract", type: "llm", name: "Contract risk check", status: "success" }]
              }
            ]
          };
        }
        if (url.endsWith("/api/model-providers")) {
          return { ok: true, json: async () => [] };
        }
        if (url.endsWith("/api/knowledge-bases")) {
          return { ok: true, json: async () => [] };
        }
        return { ok: true, json: async () => [] };
      })
    );

    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    await user.click(screen.getByRole("button", { name: /智能体/ }));
    await user.click(await screen.findByRole("article", { name: "Contract review assistant" }));

    expect(await screen.findByRole("heading", { name: "Contract review assistant" })).toBeInTheDocument();
    expect(await screen.findByText("Extract contract clauses and identify risks")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "预览" })).not.toBeInTheDocument();
    expect(screen.queryByText("未配置模型")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contract risk check" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Contract risk check" }));
    expect(await screen.findByRole("heading", { name: "Contract risk check" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "配置：Contract risk check" })).not.toBeInTheDocument();
  });
});
