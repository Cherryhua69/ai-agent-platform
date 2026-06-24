import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("DashboardPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("在近期运行中展示运行时间并放在异常原因之前", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/dashboard/summary")) {
          return {
            ok: true,
            json: async () => ({
              runSuccessRate: {
                value: 100,
                windowHours: 24,
                totalRuns: 1,
                successfulRuns: 1
              },
              publishedAgents: 0,
              pendingAgents: []
            })
          };
        }
        if (url.endsWith("/api/agents")) {
          return { ok: true, json: async () => [] };
        }
        if (url.endsWith("/api/release-gates")) {
          return { ok: true, json: async () => [] };
        }
        if (url.endsWith("/api/runs/recent")) {
          return {
            ok: true,
            json: async () => [
              {
                id: "run_recent_001",
                agentId: "agent-chat",
                agentName: "AI对话小助手",
                runTime: "2026-06-23T11:30:05",
                failureReason: "无",
                runCategory: "test",
                status: "success"
              }
            ]
          };
        }
        return { ok: true, json: async () => [] };
      })
    );

    render(<DashboardPage />, { wrapper: createWrapper() });

    const headers = await screen.findAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["名称", "运行时间", "异常原因", "类别", "状态"]);
    expect(await screen.findByText("run_recent_001")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("2026/06/23 11:30")).toBeInTheDocument();
  });

  it("使用真实总览摘要展示成功率、已发布和待完成，空近期运行时不渲染预览假数据", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/dashboard/summary")) {
          return {
            ok: true,
            json: async () => ({
              runSuccessRate: {
                value: 50,
                windowHours: 24,
                totalRuns: 2,
                successfulRuns: 1
              },
              publishedAgents: 0,
              pendingAgents: [
                {
                  id: "agent-configuring",
                  name: "客服助手",
                  description: "处理售后咨询",
                  status: "configuring"
                }
              ]
            })
          };
        }
        if (url.endsWith("/api/agents")) {
          return { ok: true, json: async () => [] };
        }
        if (url.endsWith("/api/release-gates")) {
          return { ok: true, json: async () => [] };
        }
        if (url.endsWith("/api/runs/recent")) {
          return { ok: true, json: async () => [] };
        }
        return { ok: true, json: async () => [] };
      })
    );

    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByText("近 24 小时，1/2 次成功")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("发布功能暂未实现")).toBeInTheDocument();
    expect(screen.getByText("客服助手")).toBeInTheDocument();
    expect(screen.getByText("处理售后咨询")).toBeInTheDocument();
    expect(screen.getByText("配置中")).toBeInTheDocument();
    expect(screen.queryByText("run_8f23")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".mini-bars")).toHaveLength(0);
    expect(container.querySelector(".metric-visual-agent")).toBeInTheDocument();
    expect(container.querySelector(".metric-visual-rate")).toBeInTheDocument();
    expect(container.querySelector(".metric-visual-publish")).toBeInTheDocument();
  });

  it("总览指标卡覆盖面板 flex 布局，保证动效居中", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/globals.css"), "utf8");

    expect(css).toMatch(/\.dashboard-page\s+\.metric-card\s*{[^}]*display:\s*grid;/s);
    expect(css).toMatch(/\.dashboard-page\s+\.metric-card\s*{[^}]*justify-items:\s*center;/s);
  });
});
