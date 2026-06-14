import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
          return new Response(
            JSON.stringify([
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
            ]),
            { headers: { "Content-Type": "application/json" }, status: 200 }
          );
        }

        return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" }, status: 200 });
      })
    );

    render(<ToolsPage />, { wrapper });

    await waitFor(() => expect(screen.getByText("Qwen production")).toBeInTheDocument());
    expect(screen.getByText("qwen-plus")).toBeInTheDocument();
    expect(screen.getByText("openai-compatible")).toBeInTheDocument();
  });
});
