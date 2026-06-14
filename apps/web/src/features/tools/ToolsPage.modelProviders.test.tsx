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

  it("shows configured model providers from the API", async () => {
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
              baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              model: "qwen-plus",
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

    fireEvent.click(screen.getByRole("tab", { name: /模型 API/ }));

    await waitFor(() => expect(screen.getByText("Qwen production")).toBeInTheDocument());
    expect(screen.getByText("qwen-plus")).toBeInTheDocument();
    expect(screen.getByText("openai-compatible")).toBeInTheDocument();
  });

  it("creates a model API configuration from the add tool modal", async () => {
    const providers: unknown[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.endsWith("/api/model-providers") && init?.method === "POST") {
          const payload = JSON.parse(String(init.body));
          const provider = {
            id: "model_provider_created",
            name: payload.name,
            providerType: payload.providerType,
            baseUrl: payload.baseUrl,
            model: payload.model,
            apiKeyPreview: "sk-...test",
            status: "guarded",
            isDefault: payload.isDefault
          };
          providers.push(provider);
          return jsonResponse(provider, 201);
        }

        if (path.endsWith("/api/model-providers/model_provider_created/test") && init?.method === "POST") {
          const provider = providers[0] as { status: string };
          provider.status = "online";
          return jsonResponse({ status: "success", output: "ok" });
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
    fireEvent.click(screen.getByRole("button", { name: "模型 API" }));
    fireEvent.change(screen.getByLabelText("配置名称"), { target: { value: "Qwen production" } });
    fireEvent.change(screen.getByLabelText("Base URL"), { target: { value: "https://dashscope.aliyuncs.com/compatible-mode/v1" } });
    fireEvent.change(screen.getByLabelText("模型"), { target: { value: "qwen-plus" } });
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-test" } });
    fireEvent.click(screen.getByLabelText("设为默认模型 API"));
    fireEvent.click(screen.getByRole("button", { name: "保存模型 API" }));

    await waitFor(() => expect(screen.getByText("Qwen production")).toBeInTheDocument());
    expect(screen.getByText("qwen-plus")).toBeInTheDocument();
    expect(screen.getByText("是")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("online")).toBeInTheDocument());
  });

  it("updates a model API configuration from the edit modal", async () => {
    const providers = [
      {
        id: "model_provider_qwen",
        name: "Qwen production",
        providerType: "openai-compatible",
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

    fireEvent.click(screen.getByRole("tab", { name: /模型 API/ }));
    await waitFor(() => expect(screen.getByText("Qwen production")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(screen.getByRole("dialog", { name: "编辑模型 API" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("配置名称"), { target: { value: "Qwen staging" } });
    fireEvent.change(screen.getByLabelText("模型"), { target: { value: "qwen-max" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(screen.getByText("Qwen staging")).toBeInTheDocument());
    expect(screen.getByText("qwen-max")).toBeInTheDocument();
  });

  it("tests a model API connection from the list and refreshes status", async () => {
    const providers = [
      {
        id: "model_provider_qwen",
        name: "Qwen production",
        providerType: "openai-compatible",
        baseUrl: "mock://local",
        model: "qwen-plus",
        apiKeyPreview: "sk-...test",
        status: "guarded",
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

    fireEvent.click(screen.getByRole("tab", { name: /模型 API/ }));
    await waitFor(() => expect(screen.getByText("guarded")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    await waitFor(() => expect(screen.getByText("online")).toBeInTheDocument());
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" }, status });
}
