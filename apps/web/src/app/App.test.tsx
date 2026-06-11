import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { AppProviders } from "./providers";

const viewCases = [
  ["工作台", "企业 Agent 工作台"],
  ["竞品策略", "竞品能力对标"],
  ["Agent Studio", "Agent Studio"],
  ["工作流", "工作流编排"],
  ["知识库", "知识库与 RAG Pipeline"],
  ["工具与 MCP", "工具与 MCP 生态"],
  ["评测与观测", "评测与观测"],
  ["发布渠道", "发布渠道"],
  ["模板市场", "模板市场"],
  ["治理设置", "治理设置"]
];

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  it("工作台不显示暂未接入闭环的操作按钮", async () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    expect(await screen.findByRole("heading", { name: "企业 Agent 工作台" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导入资产" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建 Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看阻断" })).not.toBeInTheDocument();
  });

  it("支持 10 个一级视图导航切换", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    for (const [button, title] of viewCases) {
      await user.click(screen.getByRole("button", { name: new RegExp(button) }));
      expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    }
  });
});
