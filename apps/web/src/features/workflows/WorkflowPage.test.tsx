import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCanvasConfig } from "./useCanvasConfig";
import { createFlowEdges, deleteSelectedEdges, WorkflowPage } from "./WorkflowPage";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

describe("WorkflowPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useCanvasConfig.setState({
      selectedAgentId: "",
      selectedWorkflowId: "",
      selectedNodeId: "",
      modelProviderId: "",
      knowledgeBaseIds: ["kb-after-sale"],
      userInput: "Order ORD-2048 asks whether refund is allowed",
      userFileInput: "",
      latestRun: null
    });
  });

  it("renders the workflow as a full editor canvas without the old left palette", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "blocked",
              toolHealthStatus: "degraded",
              nodes: [
                {
                  id: "node-trigger",
                  type: "trigger",
                  name: "User input",
                  status: "success",
                  config: {
                    inputFields: [
                      { id: "customer_question", label: "客户问题", variable: "userinput.customer_question", kind: "text", required: true },
                      { id: "support_file", label: "工单附件", variable: "userinput.support_file", kind: "file", required: false }
                    ]
                  }
                },
                { id: "node-retrieval", type: "retrieval", name: "Knowledge retrieval", status: "success" },
                { id: "node-llm", type: "llm", name: "Model decision", status: "success" }
              ]
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

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    expect(await screen.findByLabelText("工作流编辑器")).toHaveClass("workflow-editor");
    expect(screen.getByLabelText("工作流画布")).toHaveClass("workflow-canvas");
    expect(screen.queryByRole("complementary", { name: "节点配置" })).not.toBeInTheDocument();
    expect(screen.queryByText("User input", { selector: ".node-item strong" })).not.toBeInTheDocument();
  });

  it("shows the selected agent name and scenario in the editor header without preview or model status", async () => {
    useCanvasConfig.setState({
      selectedAgentId: "agent-after-sale",
      selectedWorkflowId: "workflow-after-sale"
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/agents")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "agent-after-sale",
              name: "After-sale assistant",
              scenario: "Answer refund and exchange questions from policy knowledge",
              owner: "Ning Wang",
              status: "ready",
              modelPolicy: "local-smoke",
              workflowId: "workflow-after-sale",
              knowledgeBaseIds: ["kb-after-sale"],
              toolIds: []
            }
          ]
        };
      }

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [{ id: "node-llm", type: "llm", name: "LLM", status: "success" }]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Local model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "local-smoke",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(<WorkflowPage />, { wrapper: Wrapper });

    expect(await screen.findByRole("heading", { name: "After-sale assistant" })).toBeInTheDocument();
    expect(screen.getByText("Answer refund and exchange questions from policy knowledge")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "预览" })).not.toBeInTheDocument();
    expect(screen.queryByText("local-smoke", { selector: ".workflow-editor-actions .status-pill" })).not.toBeInTheDocument();
  });

  it("supports the left toolbar actions for adding LLM nodes, comments, modes, and auto layout", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "用户输入", status: "success" },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" },
                { id: "node-output", type: "expose", name: "直接回复", status: "success" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Local model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "gpt-4o-mini",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "添加节点" }));
    for (const label of ["添加节点", "添加注释框", "指针模式", "手模式", "自动整理节点"]) {
      const button = screen.getByRole("button", { name: label });
      expect(button.querySelector("svg")).toBeInTheDocument();
      expect(button.textContent?.trim()).toBe("");
    }

    expect(await screen.findByRole("button", { name: "添加 LLM 节点" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加输出节点" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加条件节点" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加循环节点" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "添加 LLM 节点" }));

    expect(screen.queryByRole("button", { name: /LLM 2/ })).not.toBeInTheDocument();
    expect(screen.getByText("点击画布放置 LLM 节点")).toBeInTheDocument();
    const canvas = screen.getByLabelText("工作流画布");
    fireEvent.click(screen.getByRole("button", { name: "用户输入" }), { clientX: 480, clientY: 280 });
    expect(screen.queryByRole("button", { name: /LLM 2/ })).not.toBeInTheDocument();

    const pane = canvas.querySelector(".react-flow__pane");
    expect(pane).toBeInTheDocument();
    fireEvent(pane as Element, new MouseEvent("pointermove", { bubbles: true, clientX: 640, clientY: 320 }));
    const preview = screen.getByLabelText("待放置 LLM 节点");
    expect(preview).toHaveStyle({ left: "640px", top: "320px" });

    fireEvent(pane as Element, new MouseEvent("pointermove", { bubbles: true, clientX: 720, clientY: 360 }));
    expect(preview).toHaveStyle({ left: "720px", top: "360px" });

    fireEvent.click(pane as Element, { clientX: 720, clientY: 360 });

    const placedLlmButton = await screen.findByRole("button", { name: /LLM 2/ });
    expect(placedLlmButton).toBeInTheDocument();
    const placedLlmNode = placedLlmButton.closest(".react-flow__node");
    expect(placedLlmNode).toBeInTheDocument();
    expect(getComputedStyle(placedLlmNode as Element).position).toBe("absolute");
    expect(screen.queryByLabelText("待放置 LLM 节点")).not.toBeInTheDocument();
    expect(placedLlmButton.querySelector(".workflow-model-chip")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加注释框" }));
    expect(screen.getByText("点击画布放置注释框")).toBeInTheDocument();
    fireEvent.click(pane as Element, { clientX: 700, clientY: 360 });
    await waitFor(() => expect(screen.getAllByText("注释").length).toBeGreaterThan(0));
    expect(screen.queryByRole("complementary", { name: "节点配置" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加节点" }));
    fireEvent.click(screen.getByRole("button", { name: "添加条件节点" }));
    fireEvent.click(pane as Element, { clientX: 760, clientY: 390 });
    const conditionButton = await screen.findByRole("button", { name: "条件" });
    const conditionNode = conditionButton.closest(".react-flow__node");
    expect(conditionNode?.querySelector('.workflow-handle-right[data-handleid="true"]')).toBeInTheDocument();
    expect(conditionNode?.querySelector('.workflow-handle-right[data-handleid="default"]')).toBeInTheDocument();
    expect(screen.getByLabelText("条件变量")).toBeInTheDocument();
    expect(screen.getByLabelText("运算符")).toBeInTheDocument();
    expect(screen.getByLabelText("比较值")).toBeInTheDocument();
    expect(screen.getByLabelText("默认分支")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加节点" }));
    fireEvent.click(screen.getByRole("button", { name: "添加循环节点" }));
    fireEvent.click(pane as Element, { clientX: 800, clientY: 420 });
    const loopButton = await screen.findByRole("button", { name: "循环" });
    const loopNode = loopButton.closest(".react-flow__node");
    expect(loopNode?.querySelector('.workflow-handle-right[data-handleid="continue"]')).toBeInTheDocument();
    expect(loopNode?.querySelector('.workflow-handle-right[data-handleid="exit"]')).toBeInTheDocument();
    expect(screen.getByLabelText("最大迭代次数")).toHaveAttribute("min", "1");
    expect(screen.getByLabelText("最大迭代次数")).toHaveAttribute("max", "100");

    fireEvent.click(screen.getByRole("button", { name: "添加节点" }));
    fireEvent.click(screen.getByRole("button", { name: "添加输出节点" }));
    fireEvent.click(pane as Element, { clientX: 840, clientY: 450 });
    const placedOutputButton = await screen.findByRole("button", { name: "输出" });
    expect(placedOutputButton.querySelector(".workflow-node-icon")).toBeInTheDocument();
    expect(placedOutputButton.textContent).not.toContain("请配置输出变量");
    const placedOutputNode = placedOutputButton.closest(".react-flow__node");
    expect(placedOutputNode?.querySelector('.workflow-handle-left[data-handleid="left"]')).toBeInTheDocument();
    expect(placedOutputNode?.querySelector('.workflow-handle-right[data-handleid="right"]')).not.toBeInTheDocument();
    expect(screen.queryByLabelText("输出变量名")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "手模式" }));
    expect(screen.getByLabelText("工作流编辑器")).toHaveAttribute("data-canvas-mode", "pan");

    fireEvent.click(screen.getByRole("button", { name: "指针模式" }));
    expect(screen.getByLabelText("工作流编辑器")).toHaveAttribute("data-canvas-mode", "select");

    fireEvent.click(screen.getByRole("button", { name: "自动整理节点" }));
    expect(screen.getByText("已自动整理节点")).toBeInTheDocument();
  });

  it("places new nodes manually and keeps data flow based on manual left-right connections", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "用户输入", status: "success" },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" },
                { id: "node-output", type: "expose", name: "直接回复", status: "success" }
              ]
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

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        return { ok: true, json: async () => ({ id: "workflow-after-sale", agentId: "agent-after-sale", ...JSON.parse(String(init.body)) }) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    await screen.findByRole("button", { name: "LLM" });
    expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(0);
    expect(document.querySelector('[data-handlepos="right"]')).toBeInTheDocument();
    expect(document.querySelector('[data-handlepos="left"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加节点" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加 LLM 节点" }));
    expect(screen.queryByRole("button", { name: /LLM 2/ })).not.toBeInTheDocument();

    const pane = screen.getByLabelText("工作流画布").querySelector(".react-flow__pane");
    expect(pane).toBeInTheDocument();
    fireEvent.click(pane as Element, { clientX: 720, clientY: 360 });
    expect(await screen.findByRole("button", { name: "LLM 2" })).toBeInTheDocument();
    expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(0);
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT")).toBe(true));
    await waitFor(() => {
      const llmNode = document.querySelector('[data-id^="local-llm-"]') as HTMLElement | null;
      const transform = llmNode?.getAttribute("style")?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      expect(transform).not.toBeNull();
      const x = Number(transform?.[1]);
      const y = Number(transform?.[2]);
      expect(x).toBeGreaterThan(450);
      expect(x).toBeLessThan(650);
      expect(y).toBeGreaterThan(240);
      expect(y).toBeLessThan(340);
      expect(llmNode?.getAttribute("style")).not.toContain("translate(1120px,220px)");
    });
  });

  it("prepends the default user input node when a workflow has no trigger node", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [{ id: "node-llm", type: "llm", name: "LLM", status: "success" }]
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

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    expect(await screen.findByRole("button", { name: "用户输入" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "LLM" })).toBeInTheDocument();
    const userInputNode = document.querySelector('[data-id="node-trigger"]');
    const llmNode = document.querySelector('[data-id="node-llm"]');
    expect(userInputNode).toBeInTheDocument();
    expect(llmNode).toBeInTheDocument();
    expect((userInputNode as HTMLElement).getBoundingClientRect().left).toBeLessThanOrEqual((llmNode as HTMLElement).getBoundingClientRect().left);
  });

  it("renders only the default user input node when no workflow has been configured", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return { ok: true, json: async () => [] };
      }

      if (url.endsWith("/api/model-providers")) {
        return { ok: true, json: async () => [] };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    expect(await screen.findByRole("button", { name: "用户输入" })).toBeInTheDocument();
    expect(document.querySelector('[data-id="node-trigger"]')).toBeInTheDocument();
    expect(document.querySelector('[data-id="node-llm"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-id="node-output"]')).not.toBeInTheDocument();
  });

  it("never falls back to another agent workflow when the selected workflow is missing", async () => {
    useCanvasConfig.setState({
      selectedAgentId: "agent-missing-workflow",
      selectedWorkflowId: "flow-agent-missing-workflow"
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "flow-agent-other",
              agentId: "agent-other",
              name: "Other agent workflow",
              status: "draft",
              toolHealthStatus: "online",
              nodes: [{ id: "node-other-trigger", type: "trigger", name: "Other agent input", status: "success" }],
              edges: []
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers") || url.endsWith("/api/knowledge-bases") || url.endsWith("/api/agents")) {
        return { ok: true, json: async () => [] };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    expect(await screen.findByRole("button", { name: "用户输入" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Other agent input" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "用户输入" }));
    fireEvent.change(screen.getByLabelText("添加描述"), { target: { value: "只属于缺失工作流智能体" } });

    await new Promise((resolve) => window.setTimeout(resolve, 250));
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/api/workflows/flow-agent-other") && init?.method === "PUT")).toBe(false);
  });

  it("loads persisted workflow edges into the canvas state", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows") && !init?.method) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                {
                  id: "node-trigger",
                  type: "trigger",
                  name: "User input",
                  status: "success",
                  config: {
                    inputFields: [
                      { id: "customer_question", label: "客户问题", variable: "userinput.customer_question", kind: "text", required: true },
                      { id: "support_file", label: "工单附件", variable: "userinput.support_file", kind: "file", required: false }
                    ]
                  }
                },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" },
                {
                  id: "node-output",
                  type: "expose",
                  name: "输出",
                  status: "success",
                  config: { outputVariables: [{ id: "answer", name: "answer", value: "node-llm.text" }] }
                }
              ],
              edges: [
                { id: "edge-trigger-llm", source: "node-trigger", target: "node-llm" },
                { id: "edge-llm-output", source: "node-llm", target: "node-output" }
              ]
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

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    await screen.findByRole("heading", { name: "After-sale Agentflow" });
    fireEvent.click(screen.getByRole("button", { name: "自动整理节点" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workflows/workflow-after-sale",
        expect.objectContaining({
          method: "PUT"
        })
      )
    );
    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCall?.[1]?.body));
    expect(payload.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "edge-trigger-llm",
        source: "node-trigger",
        target: "node-llm"
      })
    ]));
    expect(payload.edges).toHaveLength(2);
  });

  it("restores persisted node positions when reopening a workflow", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-positioned",
              agentId: "agent-positioned",
              name: "Positioned workflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "用户输入", status: "success", position: { x: 37, y: 91 } },
                { id: "node-llm", type: "llm", name: "LLM", status: "success", position: { x: 481, y: 163 } }
              ],
              edges: []
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers") || url.endsWith("/api/knowledge-bases") || url.endsWith("/api/agents")) {
        return { ok: true, json: async () => [] };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    await screen.findByRole("button", { name: "LLM" });
    expect(document.querySelector('[data-id="node-trigger"]')?.getAttribute("style")).toContain("translate(37px,91px)");
    expect(document.querySelector('[data-id="node-llm"]')?.getAttribute("style")).toContain("translate(481px,163px)");
  });

  it("auto-arranges non-comment nodes from left to right and preserves comment positions", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-layout",
              agentId: "agent-layout",
              name: "Layout workflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "用户输入", status: "success", position: { x: 10, y: 20 } },
                { id: "node-comment", type: "comment", name: "说明", status: "success", position: { x: 900, y: 500 } },
                { id: "node-llm", type: "llm", name: "LLM", status: "success", position: { x: 400, y: 300 } },
                { id: "node-output", type: "expose", name: "输出", status: "success", position: { x: 700, y: 420 } }
              ],
              edges: []
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers") || url.endsWith("/api/knowledge-bases") || url.endsWith("/api/agents")) {
        return { ok: true, json: async () => [] };
      }

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-layout")) {
        return { ok: true, json: async () => ({ id: "workflow-layout", agentId: "agent-layout", ...JSON.parse(String(init.body)) }) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });
    await screen.findByRole("button", { name: "LLM" });

    fireEvent.click(screen.getByRole("button", { name: "自动整理节点" }));

    expect(document.querySelector('[data-id="node-trigger"]')?.getAttribute("style")).toContain("translate(220px,220px)");
    expect(document.querySelector('[data-id="node-llm"]')?.getAttribute("style")).toContain("translate(500px,220px)");
    expect(document.querySelector('[data-id="node-output"]')?.getAttribute("style")).toContain("translate(780px,220px)");
    expect(document.querySelector('[data-id="node-comment"]')?.getAttribute("style")).toContain("translate(900px,500px)");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workflows/workflow-layout", expect.objectContaining({ method: "PUT" })));
    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/workflows/workflow-layout") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCall?.[1]?.body));
    expect(payload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "node-trigger", position: { x: 220, y: 220 } }),
      expect.objectContaining({ id: "node-llm", position: { x: 500, y: 220 } }),
      expect.objectContaining({ id: "node-output", position: { x: 780, y: 220 } }),
      expect.objectContaining({ id: "node-comment", position: { x: 900, y: 500 } })
    ]));
  });

  it("deduplicates repeated node ids before rendering and saving", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows") && !init?.method) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-duplicated",
              agentId: "agent-duplicated",
              name: "Duplicated workflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "用户输入", status: "success", position: { x: 20, y: 20 } },
                { id: "node-llm", type: "llm", name: "LLM", status: "success", position: { x: 400, y: 200 } },
                { id: "node-llm", type: "llm", name: "LLM", status: "success", position: { x: 400, y: 200 } }
              ],
              edges: []
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers") || url.endsWith("/api/knowledge-bases") || url.endsWith("/api/agents")) {
        return { ok: true, json: async () => [] };
      }

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-duplicated")) {
        return { ok: true, json: async () => ({ id: "workflow-duplicated", agentId: "agent-duplicated", ...JSON.parse(String(init.body)) }) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });
    expect(await screen.findAllByRole("button", { name: "LLM" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "自动整理节点" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workflows/workflow-duplicated", expect.objectContaining({ method: "PUT" })));

    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/workflows/workflow-duplicated") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCall?.[1]?.body));
    expect(payload.nodes.map((node: { id: string }) => node.id)).toEqual(["node-trigger", "node-llm"]);
  });

  it("selects workflow nodes and switches the inspector by node type", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "blocked",
              toolHealthStatus: "degraded",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "User input", status: "success" },
                { id: "node-retrieval", type: "retrieval", name: "Knowledge retrieval", status: "success" },
                { id: "node-llm", type: "llm", name: "Model decision", status: "success" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Local model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "local-smoke",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    expect(screen.queryByRole("complementary", { name: "节点配置" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "用户输入" }));
    expect(await screen.findByRole("heading", { name: "用户输入" })).toBeInTheDocument();
    expect(screen.queryByText("trigger")).not.toBeInTheDocument();
    expect(screen.queryByText("上次运行")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("用户文字输入")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("用户文件上传输入")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭节点配置" }));
    expect(screen.queryByRole("complementary", { name: "节点配置" })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /Model decision/ }));

    expect(await screen.findByRole("heading", { name: "Model decision" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "配置：Model decision" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("模型配置")).toBeInTheDocument();
  });

  it("keeps only run and publish actions at the canvas top right while auto-saving workflow edits", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows") && !init?.method) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [{ id: "node-trigger", type: "trigger", name: "用户输入", status: "success", description: "" }],
              edges: []
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

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        return { ok: true, json: async () => ({ id: "workflow-after-sale", agentId: "agent-after-sale", ...JSON.parse(String(init.body)) }) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    const canvasActions = screen.getByLabelText("画布运行操作");
    expect(within(canvasActions).getByRole("button", { name: "测试运行" })).toBeInTheDocument();
    expect(within(canvasActions).getByRole("button", { name: "发布" })).toHaveTextContent(/^发布$/);
    expect(screen.queryByRole("button", { name: "环境变量" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "关闭调试" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "用户输入" }));
    const inspector = screen.getByRole("complementary", { name: "节点配置" });
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "运行调试" })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("button", { name: "测试运行" })).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("button", { name: "发布" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("添加描述"), { target: { value: "自动保存描述" } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workflows/workflow-after-sale",
        expect.objectContaining({ method: "PUT" })
      )
    );
    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCall?.[1]?.body));
    expect(payload.nodes[0].description).toBe("自动保存描述");
  });

  it("renders and saves the user input node input field contract and description", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows") && !init?.method) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                {
                  id: "node-trigger",
                  type: "trigger",
                  name: "用户输入",
                  status: "success",
                  description: "",
                  config: {
                    inputFields: [
                      {
                        id: "upload_file",
                        label: "upload_file",
                        variable: "upload_file",
                        kind: "file",
                        required: true,
                        legacy: false
                      },
                      {
                        id: "userinput.files",
                        label: "userinput.files",
                        variable: "userinput.files",
                        kind: "file[]",
                        required: false,
                        legacy: true
                      }
                    ]
                  }
                }
              ]
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

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        return { ok: true, json: async () => ({ id: "workflow-after-sale", agentId: "agent-after-sale", ...JSON.parse(String(init.body)) }) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    const userInputNode = await screen.findByRole("button", { name: "用户输入" });
    expect(within(userInputNode).queryByText("upload_file")).not.toBeInTheDocument();
    expect(within(userInputNode).queryByText("必填")).not.toBeInTheDocument();

    fireEvent.click(userInputNode);

    expect(await screen.findByRole("heading", { name: "用户输入" })).toBeInTheDocument();
    expect(screen.queryByText("trigger")).not.toBeInTheDocument();
    expect(screen.queryByText("上次运行")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("用户文字输入")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("用户文件上传输入")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("添加描述"), { target: { value: "用户上传售后文件作为工作流输入" } });
    expect(screen.getByText("输入字段")).toBeInTheDocument();
    expect(screen.queryByText("upload_file · upload_file")).not.toBeInTheDocument();
    expect(screen.queryByText("userinput.files")).not.toBeInTheDocument();
    expect(screen.queryByText("LEGACY")).not.toBeInTheDocument();
    expect(screen.queryByText("选中节点")).not.toBeInTheDocument();
    expect(screen.queryByText("模型")).not.toBeInTheDocument();
    expect(screen.queryByText("知识库数量")).not.toBeInTheDocument();
    expect(screen.queryByText("最新运行")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("节点配置")).queryByText("输出")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加输入字段" }));
    expect(await screen.findByRole("dialog", { name: "选择输入类型" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "多文件上传" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "文件上传" }));
    expect(screen.getByText("upload_file · upload_file")).toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workflows/workflow-after-sale",
        expect.objectContaining({
          method: "PUT"
        })
      )
    );
    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCall?.[1]?.body));
    expect(payload.nodes[0].name).toBe("用户输入");
    expect(payload.nodes[0].description).toBe("用户上传售后文件作为工作流输入");
    expect(payload.nodes[0].config.inputFields).toEqual([
      expect.objectContaining({ id: "upload_file", variable: "upload_file", kind: "file", required: false, legacy: false })
    ]);
  });

  it("only exposes the right connection handle on the default user input node", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [{ id: "node-trigger", type: "trigger", name: "User request", status: "success" }]
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

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    expect(await screen.findByRole("button", { name: "用户输入" })).toBeInTheDocument();
    const userInputNode = document.querySelector('[data-id="node-trigger"]');
    expect(userInputNode).toBeInTheDocument();
    expect((userInputNode as HTMLElement).querySelector(".workflow-handle-right")).toBeInTheDocument();
    expect((userInputNode as HTMLElement).querySelector(".workflow-handle-left")).not.toBeInTheDocument();
    const sourceHandle = (userInputNode as HTMLElement).querySelector(".workflow-handle-right");
    expect(getComputedStyle(sourceHandle as Element).pointerEvents).toBe("all");
  });

  it("uses stable left and right handle ids for manual node connections", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "User request", status: "success" },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" }
              ]
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

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    expect(await screen.findByRole("button", { name: "用户输入" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "LLM" })).toBeInTheDocument();
    const triggerNode = document.querySelector('[data-id="node-trigger"]');
    const llmNode = document.querySelector('[data-id="node-llm"]');

    expect((triggerNode as HTMLElement).querySelector('.workflow-handle-right[data-handleid="right"]')).toBeInTheDocument();
    const targetHandle = (llmNode as HTMLElement).querySelector('.workflow-handle-left[data-handleid="left"]');
    expect(targetHandle).toBeInTheDocument();
    expect(getComputedStyle(targetHandle as Element).zIndex).toBe("3");
  });

  it("configures output node variables from connected upstream variables", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows") && !init?.method) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                {
                  id: "node-trigger",
                  type: "trigger",
                  name: "User input",
                  status: "success",
                  config: {
                    inputFields: [{ id: "question", label: "问题", variable: "userinput.question", kind: "text", required: true }]
                  }
                },
                {
                  id: "node-llm",
                  type: "llm",
                  name: "LLM",
                  status: "success",
                  config: { modelProviderId: "model_provider_local" }
                },
                { id: "node-output-empty", type: "expose", name: "孤立输出", status: "success" },
                { id: "node-output", type: "expose", name: "输出", status: "success" }
              ],
              edges: [
                { id: "edge-trigger-llm", source: "node-trigger", target: "node-llm", sourceHandle: "right", targetHandle: "left" },
                { id: "edge-llm-output", source: "node-llm", target: "node-output", sourceHandle: "right", targetHandle: "left" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Local model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "local-smoke",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "孤立输出" }));
    expect(await screen.findByRole("heading", { name: "孤立输出" })).toBeInTheDocument();
    expect(screen.queryByText("设置")).not.toBeInTheDocument();
    expect(screen.queryByText("上次运行")).not.toBeInTheDocument();
    expect(screen.getByText("输出变量")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "添加输出变量" }));
    expect(screen.getByLabelText("输出变量名")).toHaveValue("");
    expect(screen.getByLabelText("设置变量值")).toHaveValue("");
    expect(screen.queryByRole("option", { name: /LLM/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("输出节点“孤立输出”输出变量名称不能为空")).toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "输出" }));
    expect(await screen.findByRole("heading", { name: "输出" })).toBeInTheDocument();
    const outputNode = document.querySelector('[data-id="node-output"]');
    expect(outputNode?.querySelector('.workflow-handle-left[data-handleid="left"]')).toBeInTheDocument();
    expect(outputNode?.querySelector('.workflow-handle-right[data-handleid="right"]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "添加输出变量" }));
    expect(screen.getByRole("group", { name: "LLM" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "用户输入" })).toBeInTheDocument();
    expect(screen.getByLabelText("设置变量值")).toHaveClass("workflow-output-selector");
    expect(screen.queryByRole("button", { name: /上移输出变量/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /下移输出变量/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "LLM / text String" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "LLM / reasoning_content String" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "LLM / usage Object" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "用户输入 / 问题 String" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("设置变量值"), { target: { value: "node-llm.text" } });
    expect(screen.getByLabelText("输出变量名")).toHaveValue("text");
    expect(screen.getByText("LLM / text String")).toBeInTheDocument();
    expect((screen.getByRole("button", { name: "输出" })).textContent).toContain("text ← LLM / text · String");

    fireEvent.change(screen.getByLabelText("输出变量名"), { target: { value: "bad name" } });
    expect(screen.getByText(/名称只能包含字母/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("输出变量名"), { target: { value: "text" } });

    fireEvent.click(screen.getByRole("button", { name: "添加输出变量" }));
    const valueSelectors = screen.getAllByLabelText("设置变量值");
    fireEvent.change(valueSelectors[1], { target: { value: "node-llm.usage" } });
    expect(screen.getAllByLabelText("输出变量名")[1]).toHaveValue("usage");
    expect(screen.queryByRole("button", { name: "上移输出变量 2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下移输出变量 1" })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("输出节点“孤立输出”输出变量名称不能为空")).toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT")).toBe(false);

    const emptyOutputNode = document.querySelector('[data-id="node-output-empty"]');
    fireEvent.click(within(emptyOutputNode as HTMLElement).getByRole("button", { name: "删除节点" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workflows/workflow-after-sale",
        expect.objectContaining({
          method: "PUT"
        })
      )
    );
    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCall?.[1]?.body));
    expect(payload.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "node-output",
          config: expect.objectContaining({
            outputVariables: [
              expect.objectContaining({ name: "text", valueSelector: ["node-llm", "text"], valueType: "String" }),
              expect.objectContaining({ name: "usage", valueSelector: ["node-llm", "usage"], valueType: "Object" })
            ]
          })
        })
      ])
    );

    const llmNode = document.querySelector('[data-id="node-llm"]');
    const putCallsBeforeDeletingLlm = fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT").length;
    fireEvent.click(within(llmNode as HTMLElement).getByRole("button", { name: "删除节点" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: "LLM / text String" })).not.toBeInTheDocument());
    expect(screen.queryByRole("option", { name: "用户输入 / 问题 String" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/输出节点“输出”引用了不可达变量 node-llm\./)).toBeInTheDocument());
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT")).toHaveLength(putCallsBeforeDeletingLlm);
  });

  it("shows knowledge base configuration when selecting a retrieval node", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "blocked",
              toolHealthStatus: "degraded",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "User input", status: "success" },
                { id: "node-retrieval", type: "retrieval", name: "Knowledge retrieval", status: "success" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return { ok: true, json: async () => [] };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "kb-after-sale",
              name: "After-sale policy base",
              source: "Uploaded docs",
              documentCount: 128,
              retrievalStrategy: "Hybrid + Rerank",
              qualityScore: 92,
              status: "ready"
            }
          ]
        };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: /Knowledge retrieval/ }));

    expect(await screen.findByRole("heading", { name: "配置：Knowledge retrieval" })).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>("After-sale policy base").checked).toBe(true);
  });

  it("opens a dynamic chat preview and supports multi-turn test runs", async () => {
    let runCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "售后工单 Agentflow",
              status: "blocked",
              toolHealthStatus: "degraded",
              nodes: [
                {
                  id: "node-trigger",
                  type: "trigger",
                  name: "User request",
                  status: "success",
                  config: {
                    inputFields: [
                      { id: "question", label: "问题", variable: "userinput.question", kind: "text", required: true },
                      { id: "attachment", label: "附件", variable: "userinput.attachment", kind: "file", required: false },
                      { id: "references", label: "参考文件", variable: "userinput.references", kind: "file[]", required: false }
                    ]
                  }
                },
                { id: "node-llm", type: "llm", name: "Configured model", status: "success" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Canvas demo model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "local-smoke",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "kb-after-sale",
              name: "售后政策库",
              source: "上传文档",
              documentCount: 128,
              retrievalStrategy: "Hybrid + Rerank",
              qualityScore: 92,
              status: "ready"
            }
          ]
        };
      }

      if (init?.method === "POST" && url.endsWith("/api/agents/agent-after-sale/runs/stream")) {
        runCount += 1;
        const answer = runCount === 1 ? "第一轮回复" : "第二轮回复";
        const chunks = [
          `${JSON.stringify({ type: "delta", text: answer.slice(0, 3) })}\n`,
          `${JSON.stringify({ type: "delta", text: answer.slice(3) })}\n`,
          `${JSON.stringify({ type: "done", runId: `run_canvas_${runCount}` })}\n`
        ];
        let chunkIndex = 0;
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => chunkIndex < chunks.length
                ? { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) }
                : { done: true, value: undefined }
            })
          }
        };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(<WorkflowPage />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: /Configured model/ }));
    await waitFor(() => expect(screen.getByLabelText("模型配置")).toHaveValue("model_provider_local"));
    fireEvent.click(screen.getByRole("button", { name: "测试运行" }));

    const preview = screen.getByRole("complementary", { name: "测试预览" });
    expect(within(preview).getByRole("heading", { name: "预览" })).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "关闭预览" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input, init]) => init?.method === "POST" && String(input).includes("/runs"))).toHaveLength(0);

    const question = within(preview).getByRole("textbox", { name: "问题" });
    const attachment = within(preview).getByLabelText<HTMLInputElement>("附件");
    const references = within(preview).getByLabelText<HTMLInputElement>("参考文件");
    const send = within(preview).getByRole("button", { name: "发送" });
    expect(send).toBeDisabled();
    expect(attachment.multiple).toBe(false);
    expect(references.multiple).toBe(true);

    fireEvent.change(question, { target: { value: "第一轮问题" } });
    fireEvent.change(attachment, { target: { files: [new File(["order"], "order.txt", { type: "text/plain" })] } });
    fireEvent.change(references, {
      target: {
        files: [
          new File(["one"], "one.txt", { type: "text/plain" }),
          new File(["two"], "two.txt", { type: "text/plain" })
        ]
      }
    });
    fireEvent.click(send);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agents/agent-after-sale/runs/stream", {
      body: JSON.stringify({
        userInput: "第一轮问题",
        modelProviderId: "model_provider_local",
        knowledgeBaseIds: ["kb-after-sale"],
        runCategory: "test",
        conversationHistory: []
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }));
    expect(await within(preview).findByText("第一轮回复")).toBeInTheDocument();
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["recent-runs"] }));
    expect(within(preview).getByText(/第一轮问题/)).toBeInTheDocument();
    expect(within(preview).getByText(/order.txt/)).toBeInTheDocument();

    fireEvent.change(question, { target: { value: "第二轮问题" } });
    fireEvent.click(send);

    expect(await within(preview).findByText("第二轮回复")).toBeInTheDocument();
    expect(within(preview).getByText("调试信息")).toBeInTheDocument();
    expect(within(preview).getByText("run_canvas_2")).toBeInTheDocument();
    expect(within(preview).getByText("历史消息数").nextSibling).toHaveTextContent("2");
    const streamCalls = fetchMock.mock.calls.filter(([input, init]) => init?.method === "POST" && String(input).endsWith("/runs/stream"));
    expect(JSON.parse(String(streamCalls[1]?.[1]?.body))).toEqual({
      userInput: "第二轮问题",
      modelProviderId: "model_provider_local",
      knowledgeBaseIds: ["kb-after-sale"],
      runCategory: "test",
      conversationHistory: [
        { role: "user", content: "第一轮问题\n附件：order.txt、one.txt、two.txt" },
        { role: "assistant", content: "第一轮回复" }
      ]
    });
    expect(within(preview).getByText(/第一轮问题/)).toBeInTheDocument();
    expect(within(preview).getByText(/第二轮问题/)).toBeInTheDocument();

    fireEvent.click(within(preview).getByRole("button", { name: "关闭预览" }));
    expect(screen.queryByRole("complementary", { name: "测试预览" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "测试运行" }));
    expect(screen.queryByText("第一轮回复")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "用户输入" }));
    expect(screen.queryByRole("complementary", { name: "测试预览" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "节点配置" })).toBeInTheDocument();
  });

  it("shows the streaming error message in the preview conversation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "Chat workflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                {
                  id: "node-trigger",
                  type: "trigger",
                  name: "User input",
                  status: "success",
                  config: {
                    inputFields: [
                      { id: "text_input_1", label: "text_input_1", variable: "userinput.text_input_1", kind: "text", required: true }
                    ]
                  }
                },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Local model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "local-smoke",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      if (init?.method === "POST" && url.endsWith("/api/agents/agent-after-sale/runs/stream")) {
        const chunks = [`${JSON.stringify({ type: "error", message: "模型上下文过长，请缩短历史后重试" })}\n`];
        let chunkIndex = 0;
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => chunkIndex < chunks.length
                ? { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) }
                : { done: true, value: undefined }
            })
          }
        };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "测试运行" }));
    const preview = screen.getByRole("complementary", { name: "测试预览" });
    fireEvent.change(within(preview).getByRole("textbox", { name: "text_input_1" }), { target: { value: "写一个 c++ 代码给我" } });
    fireEvent.click(within(preview).getByRole("button", { name: "发送" }));

    expect(await within(preview).findByText("模型上下文过长，请缩短历史后重试")).toBeInTheDocument();
    expect(within(preview).getByText("运行状态").nextSibling).toHaveTextContent("error");
    fireEvent.click(screen.getByRole("button", { name: "用户输入" }));
    expect(screen.queryByText("运行调试失败，请检查模型 API 配置。")).not.toBeInTheDocument();
  });

  it("keeps streamed assistant text when a later stream error arrives", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "Chat workflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                {
                  id: "node-trigger",
                  type: "trigger",
                  name: "User input",
                  status: "success",
                  config: {
                    inputFields: [
                      { id: "text_input_1", label: "text_input_1", variable: "userinput.text_input_1", kind: "text", required: true }
                    ]
                  }
                },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Local model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "local-smoke",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      if (init?.method === "POST" && url.endsWith("/api/agents/agent-after-sale/runs/stream")) {
        const chunks = [
          `${JSON.stringify({ type: "delta", text: "这是已经生成的 C++ 回答片段" })}\n`,
          `${JSON.stringify({ type: "error", message: "模型连接中断" })}\n`
        ];
        let chunkIndex = 0;
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => chunkIndex < chunks.length
                ? { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) }
                : { done: true, value: undefined }
            })
          }
        };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "测试运行" }));
    const preview = screen.getByRole("complementary", { name: "测试预览" });
    fireEvent.change(within(preview).getByRole("textbox", { name: "text_input_1" }), { target: { value: "写一个 c++ 代码给我" } });
    fireEvent.click(within(preview).getByRole("button", { name: "发送" }));

    expect(await within(preview).findByText("这是已经生成的 C++ 回答片段")).toBeInTheDocument();
    expect(within(preview).queryByText("模型连接中断")).not.toBeInTheDocument();
    expect(within(preview).getByText("运行状态").nextSibling).toHaveTextContent("partial");
  });

  it("edits comments inline without opening the inspector and saves every change", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/workflows") && !init?.method) {
        return {
          ok: true,
          json: async () => [{
            id: "workflow-after-sale",
            agentId: "agent-after-sale",
            name: "Comment workflow",
            status: "ready",
            toolHealthStatus: "online",
            nodes: [
              { id: "node-trigger", type: "trigger", name: "用户输入", status: "success" },
              { id: "node-comment", type: "comment", name: "注释", status: "success", description: "原始说明" }
            ]
          }]
        };
      }
      if (url.endsWith("/api/model-providers") || url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }
      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    const comment = await screen.findByText("原始说明");
    const commentNode = comment.closest(".workflow-comment-node") as HTMLElement;
    fireEvent.click(commentNode);
    expect(screen.queryByRole("complementary", { name: "节点配置" })).not.toBeInTheDocument();

    fireEvent.doubleClick(commentNode);
    const editor = screen.getByRole("textbox", { name: "编辑注释" });
    expect(editor).toHaveValue("原始说明");
    fireEvent.change(editor, { target: { value: "新的流程备注" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/workflows/workflow-after-sale",
      expect.objectContaining({ method: "PUT" })
    ));
    const saveCalls = fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCalls.at(-1)?.[1]?.body));
    expect(payload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "node-comment", description: "新的流程备注" })
    ]));
  });

  it("deletes only selected edges for Delete and Backspace", () => {
    const edges = [
      { id: "selected", source: "a", target: "b", selected: true },
      { id: "kept", source: "b", target: "c", selected: false }
    ];

    expect(deleteSelectedEdges(edges, "Delete").map((edge) => edge.id)).toEqual(["kept"]);
    expect(deleteSelectedEdges(edges, "Backspace").map((edge) => edge.id)).toEqual(["kept"]);
    expect(deleteSelectedEdges(edges, "Enter")).toBe(edges);
  });

  it("renders workflow connections as lines without arrow markers", () => {
    const [edge] = createFlowEdges([{ id: "edge-a", source: "node-a", target: "node-b", sourceHandle: "right", targetHandle: "left" }]);

    expect(edge).not.toHaveProperty("markerEnd");
  });

  it("hides node success status and allows deleting configurable nodes except the default user input", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/workflows")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "User input", status: "success" },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" },
                { id: "node-output", type: "expose", name: "Direct reply", status: "success" }
              ]
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

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    expect(await screen.findByRole("button", { name: "LLM" })).toBeInTheDocument();
    expect(document.querySelector(".workflow-canvas .status-pill")).not.toBeInTheDocument();
    const userInputNode = document.querySelector('[data-id="node-trigger"]');
    const llmNode = document.querySelector('[data-id="node-llm"]');
    expect(userInputNode).toBeInTheDocument();
    expect(llmNode).toBeInTheDocument();
    expect(within(userInputNode as HTMLElement).queryByRole("button", { name: "删除节点" })).not.toBeInTheDocument();

    fireEvent.click(within(llmNode as HTMLElement).getByRole("button", { name: "删除节点" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "LLM" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "用户输入" })).toBeInTheDocument();
  });

  it("removes edges that reference deleted nodes before saving", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows") && !init?.method) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                { id: "node-trigger", type: "trigger", name: "User input", status: "success" },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" },
                { id: "node-output", type: "expose", name: "Reply", status: "success" }
              ],
              edges: [
                { id: "edge-trigger-llm", source: "node-trigger", target: "node-llm" },
                { id: "edge-llm-output", source: "node-llm", target: "node-output" }
              ]
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

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        const payload = JSON.parse(String(init.body));
        const nodeIds = new Set(payload.nodes.map((node: { id: string }) => node.id));
        const hasDanglingEdge = payload.edges.some((edge: { source: string; target: string }) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target));
        if (hasDanglingEdge) {
          return { ok: false, status: 422, json: async () => ({ detail: "Dangling edge references deleted node" }) };
        }
        return { ok: true, json: async () => ({ id: "workflow-after-sale", agentId: "agent-after-sale", ...payload }) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    await screen.findByRole("button", { name: "LLM" });
    const llmNode = document.querySelector('[data-id="node-llm"]');
    expect(llmNode).toBeInTheDocument();

    fireEvent.click(within(llmNode as HTMLElement).getByRole("button", { name: "删除节点" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "LLM" })).not.toBeInTheDocument());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workflows/workflow-after-sale",
        expect.objectContaining({
          method: "PUT"
        })
      )
    );

    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCall?.[1]?.body));
    expect(payload.nodes.map((node: { id: string }) => node.id)).toEqual(["node-trigger", "node-output"]);
    expect(payload.edges).toEqual([]);
    expect(screen.queryByText("保存失败，请稍后重试。")).not.toBeInTheDocument();
  });

  it("saves configured workflow nodes to the persisted workflow API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/workflows") && !init?.method) {
        return {
          ok: true,
          json: async () => [
            {
              id: "workflow-after-sale",
              agentId: "agent-after-sale",
              name: "After-sale Agentflow",
              status: "ready",
              toolHealthStatus: "online",
              nodes: [
                {
                  id: "node-trigger",
                  type: "trigger",
                  name: "User input",
                  status: "success",
                  config: {
                    inputFields: [
                      { id: "customer_question", label: "客户问题", variable: "userinput.customer_question", kind: "text", required: true },
                      { id: "support_file", label: "工单附件", variable: "userinput.support_file", kind: "file", required: false }
                    ]
                  }
                },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" },
                {
                  id: "node-llm-review",
                  type: "llm",
                  name: "LLM Review",
                  status: "success",
                  config: {
                    modelProviderId: "model_provider_backup",
                    contextVariables: ["node-llm.text"],
                    systemPrompt: "Keep review independent",
                    userPrompt: "Review the answer",
                    retryOnFailure: false
                  }
                },
                {
                  id: "node-condition",
                  type: "condition",
                  name: "条件",
                  status: "success",
                  config: { variable: "node-llm.text", operator: "contains", compareValue: "通过", defaultBranch: "default" }
                },
                {
                  id: "node-loop-low",
                  type: "loop",
                  name: "循环下界",
                  status: "success",
                  config: { variable: "node-llm.text", operator: "not_empty", compareValue: "", maxIterations: 0 }
                },
                {
                  id: "node-loop-high",
                  type: "loop",
                  name: "循环上界",
                  status: "success",
                  config: { variable: "node-llm.text", operator: "not_empty", compareValue: "", maxIterations: 999 }
                },
                {
                  id: "node-expose",
                  type: "expose",
                  name: "输出",
                  status: "success",
                  config: { outputVariables: [{ id: "answer", name: "answer", value: "node-llm.text" }] }
                }
              ],
              edges: [
                { id: "edge-trigger-llm", source: "node-trigger", target: "node-llm", sourceHandle: "right", targetHandle: "left" },
                { id: "edge-llm-review", source: "node-llm", target: "node-llm-review", sourceHandle: "right", targetHandle: "left" },
                { id: "edge-review-condition", source: "node-llm-review", target: "node-condition", sourceHandle: "right", targetHandle: "left" },
                { id: "edge-condition-true", source: "node-condition", target: "node-loop-low", sourceHandle: "true", targetHandle: "left" },
                { id: "edge-condition-default", source: "node-condition", target: "node-loop-low", sourceHandle: "default", targetHandle: "left" },
                { id: "edge-loop-low-continue", source: "node-loop-low", target: "node-loop-high", sourceHandle: "continue", targetHandle: "left" },
                { id: "edge-loop-low-exit", source: "node-loop-low", target: "node-loop-high", sourceHandle: "exit", targetHandle: "left" },
                { id: "edge-loop-high-continue", source: "node-loop-high", target: "node-loop-high", sourceHandle: "continue", targetHandle: "left" },
                { id: "edge-loop-high-exit", source: "node-loop-high", target: "node-expose", sourceHandle: "exit", targetHandle: "left" }
              ]
            }
          ]
        };
      }

      if (url.endsWith("/api/model-providers")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "model_provider_local",
              name: "Local model",
              providerType: "openai-compatible",
              baseUrl: "mock://local",
              model: "local-smoke",
              apiKeyPreview: "sk-...ocal",
              status: "online",
              isDefault: true
            }
            ,
            {
              id: "model_provider_backup",
              name: "Backup model",
              providerType: "openai-compatible",
              baseUrl: "mock://backup",
              model: "backup-model",
              apiKeyPreview: "sk-...back",
              status: "online",
              isDefault: false
            }
          ]
        };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper().Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "用户输入" }));
    fireEvent.change(screen.getByLabelText("添加描述"), { target: { value: "用户输入节点描述" } });
    fireEvent.click(await screen.findByRole("button", { name: "LLM" }));
    await waitFor(() => expect(screen.getByLabelText("模型配置")).toHaveValue("model_provider_local"));
    expect(screen.getAllByText("local-smoke").length).toBeGreaterThan(0);
    expect(screen.queryByText("CHAT")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "LLM" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "配置：LLM" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("模型配置"), { target: { value: "model_provider_local" } });
    fireEvent.change(screen.getByLabelText("LLM 节点描述"), { target: { value: "用于生成售后回复" } });
    expect(screen.queryByRole("checkbox", { name: "用户输入文本 userinput.text" })).not.toBeInTheDocument();
    expect(screen.queryByText("设置")).not.toBeInTheDocument();
    expect(document.querySelector(".workflow-inspector-tabs")).not.toBeInTheDocument();
    expect(screen.getByText("local-smoke").closest(".workflow-model-chip")).toBeInTheDocument();
    expect(screen.getByLabelText("上下文配置")).toHaveValue("");
    expect(screen.getByRole("option", { name: "客户问题 · userinput.customer_question" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "工单附件 · userinput.support_file" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "用户输入文本 · userinput.text" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("上下文配置"), { target: { value: "userinput.customer_question" } });
    expect(screen.getByText("输出变量")).toBeInTheDocument();
    expect(screen.queryByText("结构化输出")).not.toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
    expect(screen.getAllByText("string")).toHaveLength(2);
    expect(screen.getByText("生成内容")).toBeInTheDocument();
    expect(screen.getByText("reasoning_content")).toBeInTheDocument();
    expect(screen.getByText("推理内容")).toBeInTheDocument();
    expect(screen.getByText("usage")).toBeInTheDocument();
    expect(screen.getByText("object")).toBeInTheDocument();
    expect(screen.getByText("模型用量信息")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("SYSTEM 提示词"), { target: { value: "你是售后政策助手，只回答政策内问题。" } });
    fireEvent.change(screen.getByLabelText("USER 提示词"), { target: { value: "基于上下文回答：{{userinput.text}}" } });
    const retrySwitch = screen.getByRole("switch", { name: "失败时重试" });
    expect(retrySwitch.closest(".llm-switch")).toBeInTheDocument();
    fireEvent.click(retrySwitch);
    fireEvent.click(screen.getByRole("button", { name: "LLM Review" }));
    await waitFor(() => expect(screen.getByLabelText("模型配置")).toHaveValue("model_provider_backup"));
    expect(screen.getByRole("heading", { name: "LLM Review" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "配置：LLM Review" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("上下文配置")).toHaveValue("node-llm.text");
    const llmReviewButton = screen.getByRole("button", { name: "LLM Review" });
    expect(llmReviewButton.querySelector(".workflow-node-title .workflow-node-icon")).toBeInTheDocument();
    expect(llmReviewButton.querySelector(".workflow-model-chip svg")).not.toBeInTheDocument();
    expect(screen.queryByText("选中节点")).not.toBeInTheDocument();
    expect(screen.queryByText("模型")).not.toBeInTheDocument();
    expect(screen.queryByText("知识库数量")).not.toBeInTheDocument();
    expect(screen.queryByText("最新运行")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("节点配置")).queryByText("输出")).not.toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workflows/workflow-after-sale",
        expect.objectContaining({
          method: "PUT"
        })
      )
    );

    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/workflows/workflow-after-sale") && init?.method === "PUT");
    const payload = JSON.parse(String(saveCall?.[1]?.body));
    expect(payload.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "node-trigger",
          name: "用户输入",
          description: "用户输入节点描述",
          config: expect.objectContaining({
            inputFields: expect.any(Array)
          })
        }),
        expect.objectContaining({
          id: "node-llm",
          description: "用于生成售后回复",
          config: expect.objectContaining({
            modelProviderId: "model_provider_local",
            contextVariables: ["userinput.customer_question"],
            systemPrompt: "你是售后政策助手，只回答政策内问题。",
            userPrompt: "基于上下文回答：{{userinput.text}}",
            retryOnFailure: true
          })
        }),
        expect.objectContaining({
          id: "node-llm-review",
          config: expect.objectContaining({
            modelProviderId: "model_provider_backup",
            contextVariables: ["node-llm.text"],
            systemPrompt: "Keep review independent",
            userPrompt: "Review the answer",
            retryOnFailure: false
          })
        }),
        expect.objectContaining({
          id: "node-condition",
          config: expect.objectContaining({ variable: "node-llm.text", operator: "contains", compareValue: "通过", defaultBranch: "default" })
        }),
        expect.objectContaining({ id: "node-loop-low", config: expect.objectContaining({ maxIterations: 10 }) }),
        expect.objectContaining({ id: "node-loop-high", config: expect.objectContaining({ maxIterations: 100 }) })
      ])
    );
    expect(payload.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "edge-trigger-llm", source: "node-trigger", target: "node-llm" }),
      expect.objectContaining({ id: "edge-llm-review", source: "node-llm", target: "node-llm-review" }),
      expect.objectContaining({ id: "edge-condition-true", sourceHandle: "true" }),
      expect.objectContaining({ id: "edge-condition-default", sourceHandle: "default" }),
      expect.objectContaining({ id: "edge-loop-low-continue", sourceHandle: "continue" }),
      expect.objectContaining({ id: "edge-loop-low-exit", sourceHandle: "exit" })
    ]));
    expect(payload.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
