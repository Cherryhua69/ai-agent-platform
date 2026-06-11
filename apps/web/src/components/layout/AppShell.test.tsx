import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("渲染无顶部栏的轻量控制台壳层", () => {
    render(<AppShell activeView="dashboard" onNavigate={() => {}} />);

    expect(screen.getByText("AI Agent")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /总览/ })).toBeInTheDocument();
    expect(screen.queryByText("测试环境")).not.toBeInTheDocument();
  });
});
