import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AgentStudioPage } from "./AgentStudioPage";

describe("AgentStudioPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("matches the branch Agent Studio layout exactly", () => {
    render(<AgentStudioPage />);

    expect(screen.getByRole("heading", { name: "Agent Studio" })).toBeInTheDocument();
    expect(screen.getByText("构建 / Agent Studio")).toBeInTheDocument();
    expect(screen.getByText("创建向导")).toBeInTheDocument();
    expect(screen.getByText("当前草稿资产")).toBeInTheDocument();
    expect(screen.getByText("模型与 Prompt")).toBeInTheDocument();
    expect(screen.getByText("工具与 MCP")).toBeInTheDocument();
    expect(screen.getByText("售后政策助手")).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1 + fallback")).toBeInTheDocument();
    expect(screen.getByText("售后政策库 / 质保条款库")).toBeInTheDocument();
    expect(screen.getByText("1 degraded")).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
