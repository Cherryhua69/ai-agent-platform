import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("渲染控制台壳层和导航", () => {
    render(<AppShell activeView="dashboard" onNavigate={() => {}} />);

    expect(screen.getByText("AI Agent Platform")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /工作台/ })).toBeInTheDocument();
    expect(screen.getByText("测试环境")).toBeInTheDocument();
  });
});
