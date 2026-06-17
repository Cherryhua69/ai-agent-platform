import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCanvasConfig } from "./useCanvasConfig";
import { WorkflowPage } from "./WorkflowPage";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
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
                { id: "node-trigger", type: "trigger", name: "User input", status: "success" },
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

    render(<WorkflowPage />, { wrapper: createWrapper() });

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

    render(<WorkflowPage />, { wrapper: createWrapper() });

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

    render(<WorkflowPage />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "添加节点" }));
    for (const label of ["添加节点", "添加注释框", "指针模式", "手模式", "自动整理节点"]) {
      const button = screen.getByRole("button", { name: label });
      expect(button.querySelector("svg")).toBeInTheDocument();
      expect(button.textContent?.trim()).toBe("");
    }

    expect(await screen.findByRole("button", { name: "添加 LLM 节点" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "添加 LLM 节点" }));

    expect(screen.queryByRole("button", { name: /LLM 2/ })).not.toBeInTheDocument();
    expect(screen.getByText("点击画布放置 LLM 节点")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("工作流画布"), { clientX: 640, clientY: 320 });

    expect(await screen.findByRole("button", { name: /LLM 2/ })).toBeInTheDocument();
    expect(screen.getAllByText("AI 基于检索到的知识库内容结合用户问题，生成清晰、有帮助的回答。").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "添加注释框" }));
    expect(screen.getByText("点击画布放置注释框")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("工作流画布"), { clientX: 700, clientY: 360 });
    await waitFor(() => expect(screen.getAllByText("注释").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "手模式" }));
    expect(screen.getByLabelText("工作流编辑器")).toHaveAttribute("data-canvas-mode", "pan");

    fireEvent.click(screen.getByRole("button", { name: "指针模式" }));
    expect(screen.getByLabelText("工作流编辑器")).toHaveAttribute("data-canvas-mode", "select");

    fireEvent.click(screen.getByRole("button", { name: "自动整理节点" }));
    expect(screen.getByText("已自动整理节点")).toBeInTheDocument();
  });

  it("places new nodes manually and keeps data flow based on manual left-right connections", async () => {
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
        return { ok: true, json: async () => [] };
      }

      if (url.endsWith("/api/knowledge-bases")) {
        return { ok: true, json: async () => [] };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "LLM" });
    expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(0);
    expect(document.querySelector('[data-handlepos="right"]')).toBeInTheDocument();
    expect(document.querySelector('[data-handlepos="left"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加节点" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加 LLM 节点" }));
    expect(screen.queryByRole("button", { name: /LLM 2/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("工作流画布"), { clientX: 720, clientY: 360 });
    expect(await screen.findByRole("button", { name: "LLM 2" })).toBeInTheDocument();
    expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(0);
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

    render(<WorkflowPage />, { wrapper: createWrapper() });

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

    render(<WorkflowPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "用户输入" })).toBeInTheDocument();
    expect(document.querySelector('[data-id="node-trigger"]')).toBeInTheDocument();
    expect(document.querySelector('[data-id="node-llm"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-id="node-output"]')).not.toBeInTheDocument();
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
                { id: "node-trigger", type: "trigger", name: "User input", status: "success" },
                { id: "node-llm", type: "llm", name: "LLM", status: "success" }
              ],
              edges: [{ id: "edge-trigger-llm", source: "node-trigger", target: "node-llm" }]
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

    render(<WorkflowPage />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { name: "After-sale Agentflow" });
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

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
    expect(payload.edges).toEqual([
      expect.objectContaining({
        id: "edge-trigger-llm",
        source: "node-trigger",
        target: "node-llm"
      })
    ]);
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

    render(<WorkflowPage />, { wrapper: createWrapper() });

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

    expect(await screen.findByRole("heading", { name: "配置：Model decision" })).toBeInTheDocument();
    expect(screen.getByLabelText("模型 API")).toBeInTheDocument();
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

    render(<WorkflowPage />, { wrapper: createWrapper() });

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
    expect(screen.queryByText("输出")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加输入字段" }));
    expect(await screen.findByRole("dialog", { name: "选择输入类型" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "多文件上传" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "文件上传" }));
    expect(screen.getByText("upload_file · upload_file")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

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

    render(<WorkflowPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "用户输入" })).toBeInTheDocument();
    const userInputNode = document.querySelector('[data-id="node-trigger"]');
    expect(userInputNode).toBeInTheDocument();
    expect((userInputNode as HTMLElement).querySelector(".workflow-handle-right")).toBeInTheDocument();
    expect((userInputNode as HTMLElement).querySelector(".workflow-handle-left")).not.toBeInTheDocument();
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

    render(<WorkflowPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "用户输入" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "LLM" })).toBeInTheDocument();
    const triggerNode = document.querySelector('[data-id="node-trigger"]');
    const llmNode = document.querySelector('[data-id="node-llm"]');

    expect((triggerNode as HTMLElement).querySelector('.workflow-handle-right[data-handleid="right"]')).toBeInTheDocument();
    expect((llmNode as HTMLElement).querySelector('.workflow-handle-left[data-handleid="left"]')).toBeInTheDocument();
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

    render(<WorkflowPage />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: /Knowledge retrieval/ }));

    expect(await screen.findByRole("heading", { name: "配置：Knowledge retrieval" })).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>("After-sale policy base").checked).toBe(true);
  });

  it("runs the canvas debug flow with configured model and knowledge bases", async () => {
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
                { id: "node-trigger", type: "trigger", name: "User request", status: "success" },
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

      if (init?.method === "POST" && url.endsWith("/api/agents/agent-after-sale/runs")) {
        return {
          ok: true,
          json: async () => ({
            id: "run_canvas",
            agentId: "agent-after-sale",
            status: "success",
            costCny: 0.06,
            finalOutput: "Configured model answer",
            steps: [{ id: "step-llm", type: "llm", title: "LLM Decision", status: "success", latencyMs: 120 }]
          })
        };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: /Configured model/ }));
    await waitFor(() => expect(screen.getByLabelText("模型 API")).toHaveValue("model_provider_local"));
    fireEvent.click(screen.getByRole("button", { name: "运行调试" }));

    await waitFor(() => expect(screen.getByText("Configured model answer")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/agents/agent-after-sale/runs", {
      body: JSON.stringify({
        userInput: "Order ORD-2048 asks whether refund is allowed",
        modelProviderId: "model_provider_local",
        knowledgeBaseIds: ["kb-after-sale"]
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
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

    render(<WorkflowPage />, { wrapper: createWrapper() });

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

    render(<WorkflowPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "LLM" });
    const llmNode = document.querySelector('[data-id="node-llm"]');
    expect(llmNode).toBeInTheDocument();

    fireEvent.click(within(llmNode as HTMLElement).getByRole("button", { name: "删除节点" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "LLM" })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

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
                { id: "node-trigger", type: "trigger", name: "User input", status: "success" },
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

      if (init?.method === "PUT" && url.endsWith("/api/workflows/workflow-after-sale")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowPage />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "用户输入" }));
    fireEvent.change(screen.getByLabelText("添加描述"), { target: { value: "用户输入节点描述" } });
    fireEvent.click(await screen.findByRole("button", { name: "LLM" }));
    await waitFor(() => expect(screen.getByLabelText("模型 API")).toHaveValue("model_provider_local"));
    fireEvent.change(screen.getByLabelText("模型 API"), { target: { value: "model_provider_local" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

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
        expect.objectContaining({ id: "node-llm", config: expect.objectContaining({ modelProviderId: "model_provider_local" }) })
      ])
    );
    expect(payload.edges).toEqual([]);
    expect(payload.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
