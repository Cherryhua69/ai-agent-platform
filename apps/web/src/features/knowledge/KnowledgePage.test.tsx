import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgePage } from "./KnowledgePage";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("KnowledgePage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("只在知识库卡片中展示名称、描述和右下角操作菜单", async () => {
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ name: "售后政策库", description: "售后资料" })]
    });

    render(<KnowledgePage />, { wrapper });

    const card = await screen.findByRole("article", { name: "售后政策库" });

    expect(within(card).getByText("售后政策库")).toBeInTheDocument();
    expect(within(card).getByText("售后资料")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "打开售后政策库操作菜单" })).toBeInTheDocument();
    expect(within(card).queryByText("BGE 嵌入模型")).not.toBeInTheDocument();
    expect(within(card).queryByText("TopK 6")).not.toBeInTheDocument();
    expect(within(card).queryByText("阈值 0.72")).not.toBeInTheDocument();
    expect(within(card).queryByText("1 个文件")).not.toBeInTheDocument();
    expect(screen.queryByText("知识资产")).not.toBeInTheDocument();
    expect(screen.queryByText("1 个知识库")).not.toBeInTheDocument();
    expect(screen.queryByText("处理流水线")).not.toBeInTheDocument();
  });

  it("没有知识库时展示空状态，不显示默认假数据", async () => {
    stubKnowledgeFetch({ knowledgeBases: [] });

    render(<KnowledgePage />, { wrapper });

    expect(await screen.findByText("暂无知识库")).toBeInTheDocument();
    expect(screen.getByText("创建一个知识库后，可以在这里管理资料集合和已上传文件。")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "施工方案审核库" })).not.toBeInTheDocument();
  });

  it("通过卡片菜单编辑知识库名称和描述", async () => {
    const savedPayloads: Array<Record<string, unknown>> = [];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ name: "售后政策库", description: "售后资料" })],
      onUpdate: (payload) => savedPayloads.push(payload)
    });

    render(<KnowledgePage />, { wrapper });

    const card = await screen.findByRole("article", { name: "售后政策库" });
    fireEvent.click(within(card).getByRole("button", { name: "打开售后政策库操作菜单" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "编辑" }));

    const dialog = screen.getByRole("dialog", { name: "编辑知识库" });
    expect(within(dialog).getByLabelText("名称")).toHaveValue("售后政策库");
    expect(within(dialog).getByLabelText("描述")).toHaveValue("售后资料");
    expect(within(dialog).queryByLabelText("Embedding 模型")).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("名称"), { target: { value: "施工方案审核库" } });
    fireEvent.change(within(dialog).getByLabelText("描述"), { target: { value: "用于施工方案审核的参考资料" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存修改" }));

    await waitFor(() =>
      expect(savedPayloads[0]).toMatchObject({
        name: "施工方案审核库",
        description: "用于施工方案审核的参考资料"
      })
    );
  });

  it("通过卡片菜单删除知识库", async () => {
    const deletedIds: string[] = [];
    const knowledgeBases = [knowledgeBase({ id: "kb_support", name: "售后政策库", description: "售后资料" })];
    stubKnowledgeFetch({
      knowledgeBases,
      onDelete: (id) => {
        deletedIds.push(id);
        knowledgeBases.splice(0, knowledgeBases.length);
      }
    });

    render(<KnowledgePage />, { wrapper });

    const card = await screen.findByRole("article", { name: "售后政策库" });
    fireEvent.click(within(card).getByRole("button", { name: "打开售后政策库操作菜单" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "删除" }));
    const dialog = screen.getByRole("dialog", { name: "删除知识库" });
    expect(within(dialog).getByText(/确定删除/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(deletedIds).toEqual(["kb_support"]));
  });

  it("删除接口失败后打开编辑弹窗不显示保存失败提示", async () => {
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "售后政策库", description: "售后资料" })],
      deleteStatus: 500
    });

    render(<KnowledgePage />, { wrapper });

    const card = await screen.findByRole("article", { name: "售后政策库" });
    fireEvent.click(within(card).getByRole("button", { name: "打开售后政策库操作菜单" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "删除" }));

    const deleteDialog = screen.getByRole("dialog", { name: "删除知识库" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "确认删除" }));
    expect(await within(deleteDialog).findByText("知识库删除失败，请稍后重试。")).toBeInTheDocument();
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "取消" }));

    fireEvent.click(within(card).getByRole("button", { name: "打开售后政策库操作菜单" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "编辑" }));

    const dialog = screen.getByRole("dialog", { name: "编辑知识库" });
    expect(within(dialog).queryByText("知识库保存失败，请稍后重试。")).not.toBeInTheDocument();
  });

  it("点击知识库卡片后展示已上传文件列表", async () => {
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "售后政策库", description: "售后资料" })],
      documents: [
        {
          id: "doc_plan",
          name: "危险性较大的分部分项工程专项施工方案.pdf",
          mimeType: "application/pdf",
          sizeKb: 5900,
          status: "uploaded",
          segmentMode: "通用",
          characterCount: 17200,
          hitCount: 6,
          createdAt: "2026-06-16 04:32"
        }
      ]
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "售后政策库" }));

    const title = await screen.findByRole("heading", { name: "售后政策库" });
    expect(title).toHaveClass("knowledge-documents-title");
    expect(within(screen.getByLabelText("知识库详情操作")).getByRole("button", { name: "返回知识库" })).toBeInTheDocument();
    expect(await screen.findByText("危险性较大的分部分项工程专项施工方案.pdf")).toBeInTheDocument();
    expect(screen.getByText("通用")).toBeInTheDocument();
    expect(screen.getByText("17.2k")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("2026-06-16 04:32")).toBeInTheDocument();
    expect(screen.getByText("可用")).toBeInTheDocument();
  });
});

function stubKnowledgeFetch({
  knowledgeBases,
  documents = [],
  onUpdate,
  onDelete,
  deleteStatus = 204
}: {
  knowledgeBases: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  deleteStatus?: number;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (/\/api\/knowledge-bases\/[^/]+\/documents$/.test(path)) {
        return jsonResponse(documents);
      }
      if (/\/api\/knowledge-bases\/[^/]+$/.test(path) && init?.method === "DELETE") {
        if (deleteStatus === 204) {
          onDelete?.(path.split("/").pop() ?? "");
        }
        return new Response(null, { status: deleteStatus });
      }
      if (/\/api\/knowledge-bases\/[^/]+$/.test(path) && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body));
        onUpdate?.(payload);
        return jsonResponse({ ...knowledgeBases[0], ...payload });
      }
      if (path.endsWith("/api/knowledge-bases")) {
        return jsonResponse(knowledgeBases);
      }
      if (path.endsWith("/api/model-providers")) {
        return jsonResponse([]);
      }
      return jsonResponse([]);
    })
  );
}

function knowledgeBase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "kb_support",
    name: "售后政策库",
    description: "售后资料",
    source: "upload",
    embeddingModelProviderId: null,
    embeddingModelProviderName: null,
    chunkStrategy: "markdown",
    chunkSize: 800,
    chunkOverlap: 120,
    retrievalMode: "hybrid",
    topK: 6,
    similarityThreshold: 0.72,
    returnCitations: true,
    documentCount: 1,
    retrievalStrategy: "Hybrid",
    qualityScore: 90,
    status: "ready",
    ...overrides
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" }, status });
}
