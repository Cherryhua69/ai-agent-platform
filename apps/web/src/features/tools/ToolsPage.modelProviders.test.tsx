import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolsPage } from "./ToolsPage";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("ToolsPage model providers", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows configured model providers with Chinese purpose and status labels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith("/api/model-providers")) {
          return jsonResponse([
            {
              id: "model_provider_qwen",
              name: "Qwen production",
              providerType: "openai-compatible",
              modelPurpose: "llm",
              baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              model: "qwen-plus",
              apiKeyPreview: "sk-...test",
              status: "online",
              isDefault: true
            },
            {
              id: "model_provider_embedding",
              name: "Qwen embedding",
              providerType: "openai-compatible",
              modelPurpose: "embedding",
              baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              model: "text-embedding-v3",
              apiKeyPreview: "sk-...test",
              status: "offline",
              isDefault: false
            }
          ]);
        }

        return jsonResponse([]);
      })
    );

    render(<ToolsPage />, { wrapper });

    fireEvent.click(screen.getByRole("tab", { name: /模型配置/ }));

    await waitFor(() => expect(screen.getByText("Qwen production")).toBeInTheDocument());
    expect(screen.getByText("推理 1")).toBeInTheDocument();
    expect(screen.getByText("嵌入 1")).toBeInTheDocument();
    expect(screen.getByText("重排 0")).toBeInTheDocument();
    expect(screen.getByLabelText("模型配置分类统计")).toHaveClass("model-provider-summary");
    expect(screen.queryByText(/\d+ 个配置/)).not.toBeInTheDocument();
    expect(screen.getByText("推理模型")).toBeInTheDocument();
    expect(screen.getByText("嵌入模型")).toBeInTheDocument();
    expect(screen.getByText("在线")).toBeInTheDocument();
    expect(screen.getByText("离线")).toBeInTheDocument();
    expect(screen.queryByText("online")).not.toBeInTheDocument();
    expect(screen.queryByText("offline")).not.toBeInTheDocument();
  });

  it("creates an embedding model configuration and automatically tests it", async () => {
    const providers: Array<Record<string, unknown>> = [];
    const savedPayloads: Array<Record<string, unknown>> = [];
    let testCalled = false;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.endsWith("/api/model-providers") && init?.method === "POST") {
          const payload = JSON.parse(String(init.body));
          savedPayloads.push(payload);
          const provider = {
            id: "model_provider_created",
            name: payload.name,
            providerType: payload.providerType,
            modelPurpose: payload.modelPurpose,
            baseUrl: payload.baseUrl,
            model: payload.model,
            apiKeyPreview: "sk-...test",
            status: "offline",
            isDefault: payload.isDefault
          };
          providers.push(provider);
          return jsonResponse(provider, 201);
        }

        if (path.endsWith("/api/model-providers/model_provider_created/test") && init?.method === "POST") {
          testCalled = true;
          providers[0].status = "online";
          return jsonResponse({ status: "success", output: "嵌入模型连接正常，返回 3 维向量。" });
        }

        if (path.endsWith("/api/model-providers")) {
          return jsonResponse(providers);
        }

        return jsonResponse([]);
      })
    );

    render(<ToolsPage />, { wrapper });

    fireEvent.click(screen.getByRole("button", { name: "添加工具" }));
    expect(screen.getByRole("dialog", { name: "添加工具" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "模型配置" }));
    fireEvent.change(screen.getByLabelText("配置名称"), { target: { value: "Qwen embedding" } });
    fireEvent.change(screen.getByLabelText("模型用途"), { target: { value: "embedding" } });
    fireEvent.change(screen.getByLabelText("Base URL"), { target: { value: "https://dashscope.aliyuncs.com/compatible-mode/v1" } });
    expect(screen.getByLabelText("Embedding 模型名")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Embedding 模型名"), { target: { value: "bge-m3" } });
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-test" } });
    fireEvent.click(screen.getByRole("button", { name: "保存模型配置" }));

    await waitFor(() => expect(screen.getByText("Qwen embedding")).toBeInTheDocument());
    expect(savedPayloads[0]).toMatchObject({ modelPurpose: "embedding", model: "bge-m3" });
    await waitFor(() => expect(testCalled).toBe(true));
    await waitFor(() => expect(screen.getByText("在线")).toBeInTheDocument());
  });

  it("updates a model configuration from the edit modal", async () => {
    const providers = [
      {
        id: "model_provider_qwen",
        name: "Qwen production",
        providerType: "openai-compatible",
        modelPurpose: "llm",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
        apiKeyPreview: "sk-...test",
        status: "online",
        isDefault: true
      }
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.endsWith("/api/model-providers/model_provider_qwen") && init?.method === "PUT") {
          const payload = JSON.parse(String(init.body));
          providers[0] = {
            ...providers[0],
            name: payload.name,
            providerType: payload.providerType,
            modelPurpose: payload.modelPurpose,
            baseUrl: payload.baseUrl,
            model: payload.model,
            apiKeyPreview: payload.apiKey ? "sk-...next" : providers[0].apiKeyPreview,
            isDefault: payload.isDefault
          };
          return jsonResponse(providers[0]);
        }

        if (path.endsWith("/api/model-providers/model_provider_qwen/test") && init?.method === "POST") {
          providers[0].status = "online";
          return jsonResponse({ status: "success", output: "ok" });
        }

        if (path.endsWith("/api/model-providers")) {
          return jsonResponse(providers);
        }

        return jsonResponse([]);
      })
    );

    render(<ToolsPage />, { wrapper });

    fireEvent.click(screen.getByRole("tab", { name: /模型配置/ }));
    await waitFor(() => expect(screen.getByText("Qwen production")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(screen.getByRole("dialog", { name: "编辑模型配置" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("配置名称"), { target: { value: "Qwen staging" } });
    fireEvent.change(screen.getByLabelText("模型用途"), { target: { value: "embedding" } });
    fireEvent.change(screen.getByLabelText("Embedding 模型名"), { target: { value: "bge-m3" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(screen.getByText("Qwen staging")).toBeInTheDocument());
    expect(screen.getByText("bge-m3")).toBeInTheDocument();
    expect(screen.getByText("嵌入模型")).toBeInTheDocument();
  });

  it("tests a model connection from the list and refreshes status", async () => {
    const providers = [
      {
        id: "model_provider_qwen",
        name: "Qwen production",
        providerType: "openai-compatible",
        modelPurpose: "llm",
        baseUrl: "mock://local",
        model: "qwen-plus",
        apiKeyPreview: "sk-...test",
        status: "offline",
        isDefault: true
      }
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.endsWith("/api/model-providers/model_provider_qwen/test") && init?.method === "POST") {
          providers[0].status = "online";
          return jsonResponse({ status: "success", output: "ok" });
        }
        if (path.endsWith("/api/model-providers")) {
          return jsonResponse(providers);
        }
        return jsonResponse([]);
      })
    );

    render(<ToolsPage />, { wrapper });

    fireEvent.click(screen.getByRole("tab", { name: /模型配置/ }));
    await waitFor(() => expect(screen.getByText("离线")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    await waitFor(() => expect(screen.getByText("在线")).toBeInTheDocument());
  });

  it("automatically tests every model provider when entering the model configuration page", async () => {
    const providers = [
      {
        id: "model_provider_luban",
        name: "Luban",
        providerType: "openai-compatible",
        modelPurpose: "llm",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "Luban",
        apiKeyPreview: "sk-...test",
        status: "offline",
        isDefault: true
      },
      {
        id: "model_provider_text2vec",
        name: "text2vec-large-chinese",
        providerType: "openai-compatible",
        modelPurpose: "embedding",
        baseUrl: "http://127.0.0.1:8000/v1",
        model: "text2vec-large-chinese",
        apiKeyPreview: "sk-...test",
        status: "offline",
        isDefault: false
      }
    ];
    const testedIds: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        const match = path.match(/\/api\/model-providers\/([^/]+)\/test$/);
        if (match && init?.method === "POST") {
          testedIds.push(match[1]);
          const provider = providers.find((item) => item.id === match[1]);
          if (provider) {
            provider.status = "online";
          }
          return jsonResponse({ status: "success", output: "ok" });
        }
        if (path.endsWith("/api/model-providers")) {
          return jsonResponse(providers);
        }
        return jsonResponse([]);
      })
    );

    render(<ToolsPage />, { wrapper });

    fireEvent.click(screen.getByRole("tab", { name: /模型配置/ }));

    await waitFor(() => expect(testedIds).toEqual(["model_provider_luban", "model_provider_text2vec"]));
    await waitFor(() => expect(screen.getAllByText("在线")).toHaveLength(2));
  });

  it("renders model providers without first-row highlight and keeps original table alignment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith("/api/model-providers")) {
          return jsonResponse([
            {
              id: "model_provider_new",
              name: "最新模型",
              providerType: "openai-compatible",
              modelPurpose: "llm",
              baseUrl: "mock://local",
              model: "new-model",
              apiKeyPreview: "sk-...test",
              status: "online",
              isDefault: false
            },
            {
              id: "model_provider_old",
              name: "旧模型",
              providerType: "openai-compatible",
              modelPurpose: "embedding",
              baseUrl: "mock://local",
              model: "old-model",
              apiKeyPreview: "sk-...test",
              status: "offline",
              isDefault: true
            }
          ]);
        }
        return jsonResponse([]);
      })
    );

    render(<ToolsPage />, { wrapper });

    fireEvent.click(screen.getByRole("tab", { name: /模型配置/ }));

    await waitFor(() => expect(screen.getByText("最新模型")).toBeInTheDocument());
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).not.toHaveClass("selected");

    const firstRowCells = rows[0].querySelectorAll("td");
    expect(firstRowCells[6]).not.toHaveClass("cell-center");
    expect(firstRowCells[8]).not.toHaveClass("cell-center");
    expect(firstRowCells[9]).not.toHaveClass("cell-center");
    expect(firstRowCells[0]).not.toHaveClass("cell-center");
  });

  it("shows purpose-specific default labels in the table and form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith("/api/model-providers")) {
          return jsonResponse([
            {
              id: "model_provider_luban",
              name: "Luban",
              providerType: "openai-compatible",
              modelPurpose: "llm",
              baseUrl: "mock://local",
              model: "Luban",
              apiKeyPreview: "sk-...test",
              status: "online",
              isDefault: true
            },
            {
              id: "model_provider_text2vec",
              name: "text2vec-large-chinese",
              providerType: "openai-compatible",
              modelPurpose: "embedding",
              baseUrl: "mock://local",
              model: "text2vec-large-chinese",
              apiKeyPreview: "sk-...test",
              status: "online",
              isDefault: true
            }
          ]);
        }
        return jsonResponse([]);
      })
    );

    render(<ToolsPage />, { wrapper });

    fireEvent.click(screen.getByRole("tab", { name: /模型配置/ }));

    await waitFor(() => expect(screen.getByText("默认推理")).toBeInTheDocument());
    expect(screen.getByText("默认嵌入")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加工具" }));
    fireEvent.click(screen.getByRole("button", { name: "模型配置" }));
    expect(screen.getByLabelText("设为默认推理模型")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("模型用途"), { target: { value: "embedding" } });
    expect(screen.getByLabelText("设为默认嵌入模型")).toBeInTheDocument();
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" }, status });
}
