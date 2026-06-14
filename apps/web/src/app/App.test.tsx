import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { AppProviders } from "./providers";

const viewCases = [
  ["总览", "总览"],
  ["智能体", "Agent Studio"],
  ["工作流", "工作流"],
  ["知识库", "知识库"],
  ["工具", "工具"],
  ["运行记录", "运行记录"],
  ["发布", "发布"],
  ["模板", "模板"]
];

describe("App", () => {
  afterEach(() => {
    cleanup();
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

  it("支持 8 个主视图导航切换", async () => {
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
