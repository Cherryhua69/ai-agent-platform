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
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    expect(screen.getByText("待处理")).toBeInTheDocument();
  });

  it("shows failed document error and can trigger reprocessing", async () => {
    const processingJobs: string[] = [];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      documents: [
        {
          id: "doc_failed",
          name: "failed-policy.txt",
          mimeType: "text/plain",
          sizeKb: 1,
          status: "failed",
          segmentMode: "通用",
          characterCount: 128,
          hitCount: 0,
          errorMessage: "embedding backend unavailable",
          createdAt: "2026-06-16 04:32"
        }
      ],
      onProcessingJob: (id) => processingJobs.push(id)
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));

    expect(await screen.findByText("failed-policy.txt")).toBeInTheDocument();
    expect(screen.getByText("处理失败")).toBeInTheDocument();
    expect(screen.getByText("embedding backend unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新处理" }));

    await waitFor(() => expect(processingJobs).toEqual(["kb_support"]));
  });

  it("shows uploaded documents as pending and can start processing before segment preview", async () => {
    const processingJobs: string[] = [];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      documents: [
        {
          id: "doc_uploaded",
          name: "uploaded-policy.txt",
          mimeType: "text/plain",
          sizeKb: 1,
          status: "uploaded",
          segmentMode: "通用",
          characterCount: 128,
          hitCount: 0,
          createdAt: "2026-06-16 04:32"
        }
      ],
      onProcessingJob: (id) => processingJobs.push(id)
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));

    expect(await screen.findByText("uploaded-policy.txt")).toBeInTheDocument();
    expect(screen.getByText("待处理")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "处理文档" }));

    await waitFor(() => expect(processingJobs).toEqual(["kb_support"]));
  });

  it("deletes a document from knowledge base detail", async () => {
    const deletedDocuments: string[] = [];
    const documents = [
      {
        id: "doc_policy",
        name: "policy.txt",
        mimeType: "text/plain",
        sizeKb: 1,
        status: "available",
        segmentMode: "通用",
        characterCount: 128,
        hitCount: 0,
        createdAt: "2026-06-16 04:32"
      }
    ];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      documents,
      onDeleteDocument: (_knowledgeBaseId, documentId) => {
        deletedDocuments.push(documentId);
        documents.splice(0, documents.length);
      }
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    fireEvent.click(await screen.findByRole("button", { name: "删除文档 policy.txt" }));

    await waitFor(() => expect(deletedDocuments).toEqual(["doc_policy"]));
  });

  it("uploads a text file from document detail and starts processing", async () => {
    const uploadedFiles: string[] = [];
    const processingJobs: string[] = [];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      onUploadDocument: (_id, file) => uploadedFiles.push(file.name),
      onProcessingJob: (id) => processingJobs.push(id)
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    const file = new File(["Refund policy upload content"], "policy.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("上传知识库文件"), { target: { files: [file] } });

    await waitFor(() => expect(uploadedFiles).toEqual(["policy.txt"]));
    await waitFor(() => expect(processingJobs).toEqual(["kb_support"]));
  });

  it("accepts pdf uploads from document detail", async () => {
    const uploadedFiles: string[] = [];
    const processingJobs: string[] = [];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      onUploadDocument: (_id, file) => uploadedFiles.push(file.name),
      onProcessingJob: (id) => processingJobs.push(id)
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    expect(screen.getByLabelText("上传知识库文件")).toHaveAttribute("accept", expect.stringContaining(".pdf"));
    const file = new File(["%PDF-1.4"], "policy.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传知识库文件"), { target: { files: [file] } });

    await waitFor(() => expect(uploadedFiles).toEqual(["policy.pdf"]));
    await waitFor(() => expect(processingJobs).toEqual(["kb_support"]));
  });

  it("shows the latest processing job status in document detail", async () => {
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      processingJobs: [
        {
          id: "job_latest",
          knowledgeBaseId: "kb_support",
          status: "failed",
          chunksCreated: 0,
          errorMessage: "embedding backend unavailable",
          createdAt: "2026-06-16 04:30",
          startedAt: "2026-06-16 04:31",
          finishedAt: "2026-06-16 04:32"
        }
      ]
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));

    expect(await screen.findByText("最近处理：处理失败")).toBeInTheDocument();
    expect(screen.getByText("完成时间 2026-06-16 04:32")).toBeInTheDocument();
    expect(screen.getByText("embedding backend unavailable")).toBeInTheDocument();
  });

  it("shows document segment preview after selecting a document", async () => {
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      documents: [
        {
          id: "doc_policy",
          name: "policy.txt",
          mimeType: "text/plain",
          sizeKb: 1,
          status: "available",
          segmentMode: "通用",
          characterCount: 128,
          hitCount: 0,
          createdAt: "2026-06-16 04:32"
        }
      ],
      segments: [
        {
          id: "seg_1",
          knowledgeBaseId: "kb_support",
          documentId: "doc_policy",
          position: 1,
          content: "Refund policy requires status verification before issuing payment.",
          characterCount: 63,
          tokenCount: 8,
          status: "available"
        }
      ]
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    fireEvent.click(await screen.findByRole("button", { name: "查看分段 policy.txt" }));

    const preview = await screen.findByLabelText("分段预览");
    expect(within(preview).getByText("分段预览")).toBeInTheDocument();
    expect(within(preview).getByText("policy.txt")).toBeInTheDocument();
    expect(await within(preview).findByText("#1")).toBeInTheDocument();
    expect(within(preview).getByText("8 tokens")).toBeInTheDocument();
    expect(within(preview).getByText("Refund policy requires status verification before issuing payment.")).toBeInTheDocument();
  });

  it("runs a knowledge retrieval test and shows matches with citations", async () => {
    const searchQueries: string[] = [];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      searchResponse: {
        query: "refund",
        matches: [
          {
            segmentId: "seg_1",
            documentId: "doc_policy",
            documentName: "policy.txt",
            content: "Refund policy requires status verification before issuing payment.",
            text: "Refund policy requires status verification before issuing payment.",
            position: 1,
            score: 0.86,
            metadata: { retriever: "local_keyword" }
          }
        ],
        citations: [
          {
            segmentId: "seg_1",
            documentId: "doc_policy",
            documentName: "policy.txt",
            snippet: "Refund policy requires status verification before issuing payment.",
            position: 1
          }
        ]
      },
      onSearch: (_knowledgeBaseId, query) => searchQueries.push(query)
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    fireEvent.change(await screen.findByLabelText("检索问题"), { target: { value: "refund" } });
    fireEvent.click(screen.getByRole("button", { name: "检索测试" }));

    await waitFor(() => expect(searchQueries).toEqual(["refund"]));
    const searchPanel = await screen.findByLabelText("检索测试结果");
    expect(within(searchPanel).getByText("policy.txt")).toBeInTheDocument();
    expect(within(searchPanel).getByText("#1")).toBeInTheDocument();
    expect(within(searchPanel).getByText("相似度 0.86")).toBeInTheDocument();
    expect(within(searchPanel).getByText("local_keyword")).toBeInTheDocument();
    expect(within(searchPanel).getByText("Refund policy requires status verification before issuing payment.")).toBeInTheDocument();
    expect(within(searchPanel).getByText("引用来源")).toBeInTheDocument();
  });

  it("shows an empty state when retrieval has no matches", async () => {
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      searchResponse: { query: "unknown", matches: [], citations: [] }
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    fireEvent.change(await screen.findByLabelText("检索问题"), { target: { value: "unknown" } });
    fireEvent.click(screen.getByRole("button", { name: "检索测试" }));

    expect(await screen.findByText("未命中相关分段，请检查文档是否已处理，或调整 TopK / 相似度阈值。")).toBeInTheDocument();
  });

  it("generates a RAG answer with citations from knowledge detail", async () => {
    const answerQueries: string[] = [];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      answerResponse: {
        query: "refund policy",
        answer: "退款前需要先核验订单状态。[1]",
        modelProviderId: "model_llm",
        modelProviderName: "Mock Answer LLM",
        matches: [],
        citations: [
          {
            segmentId: "seg_1",
            documentId: "doc_policy",
            documentName: "policy.txt",
            snippet: "Refund policy requires status verification.",
            position: 1
          }
        ]
      },
      onAnswer: (_knowledgeBaseId, query) => answerQueries.push(query)
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    fireEvent.change(await screen.findByLabelText("检索问题"), { target: { value: "refund policy" } });
    fireEvent.click(screen.getByRole("button", { name: "生成回答" }));

    await waitFor(() => expect(answerQueries).toEqual(["refund policy"]));
    const answerPanel = await screen.findByLabelText("RAG 回答结果");
    expect(within(answerPanel).getByText("Mock Answer LLM")).toBeInTheDocument();
    expect(within(answerPanel).getByText("退款前需要先核验订单状态。[1]")).toBeInTheDocument();
    expect(within(answerPanel).getByText("policy.txt #1")).toBeInTheDocument();
  });

  it("streams a RAG answer and shows the trace run id", async () => {
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      streamAnswerEvents: [
        { type: "retrieval_started", runId: "rag_stream", query: "refund policy" },
        { type: "retrieval_completed", runId: "rag_stream", matchCount: 1, citations: [] },
        { type: "answer_delta", runId: "rag_stream", text: "退款前" },
        { type: "answer_delta", runId: "rag_stream", text: "需要核验订单状态。" },
        {
          type: "completed",
          runId: "rag_stream",
          answer: "退款前需要核验订单状态。",
          citations: [
            {
              segmentId: "seg_1",
              documentId: "doc_policy",
              documentName: "policy.txt",
              snippet: "Refund policy requires status verification.",
              position: 1
            }
          ]
        }
      ]
    });

    render(<KnowledgePage />, { wrapper });

    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    fireEvent.change(await screen.findByLabelText("检索问题"), { target: { value: "refund policy" } });
    fireEvent.click(screen.getByRole("button", { name: "流式回答" }));

    const answerPanel = await screen.findByLabelText("RAG 回答结果");
    expect(await within(answerPanel).findByText("退款前需要核验订单状态。")).toBeInTheDocument();
    expect(within(answerPanel).getByText("Trace rag_stream")).toBeInTheDocument();
    expect(within(answerPanel).getByText("policy.txt #1")).toBeInTheDocument();
  });

  it("polls processing jobs while the latest job is queued or running", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const processingJobRequests: number[] = [];
    stubKnowledgeFetch({
      knowledgeBases: [knowledgeBase({ id: "kb_support", name: "Support KB", description: "Support docs" })],
      processingJobs: [
        {
          id: "job_running",
          knowledgeBaseId: "kb_support",
          status: "running",
          chunksCreated: 0,
          createdAt: "2026-06-16 04:30",
          startedAt: "2026-06-16 04:31",
          finishedAt: null
        }
      ],
      onProcessingJobsRequest: () => processingJobRequests.push(Date.now())
    });

    render(<KnowledgePage />, { wrapper });
    fireEvent.click(await screen.findByRole("article", { name: "Support KB" }));
    expect(await screen.findByText("最近处理：处理中")).toBeInTheDocument();

    await waitFor(() =>
      expect(setIntervalSpy.mock.calls.some(([, timeout]) => timeout === 3000)).toBe(true)
    );
    expect(processingJobRequests.length).toBeGreaterThan(0);
  });
});

function stubKnowledgeFetch({
  knowledgeBases,
  documents = [],
  processingJobs = [],
  segments = [],
  searchResponse = { query: "", matches: [], citations: [] },
  answerResponse = { query: "", answer: "", matches: [], citations: [], modelProviderId: "", modelProviderName: "" },
  streamAnswerEvents = [],
  onUpdate,
  onDelete,
  onProcessingJob,
  onProcessingJobsRequest,
  onUploadDocument,
  onDeleteDocument,
  onSearch,
  onAnswer,
  deleteStatus = 204
}: {
  knowledgeBases: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  processingJobs?: Array<Record<string, unknown>>;
  segments?: Array<Record<string, unknown>>;
  searchResponse?: Record<string, unknown>;
  answerResponse?: Record<string, unknown>;
  streamAnswerEvents?: Array<Record<string, unknown>>;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  onProcessingJob?: (id: string) => void;
  onProcessingJobsRequest?: () => void;
  onUploadDocument?: (id: string, file: File) => void;
  onDeleteDocument?: (knowledgeBaseId: string, documentId: string) => void;
  onSearch?: (knowledgeBaseId: string, query: string) => void;
  onAnswer?: (knowledgeBaseId: string, query: string) => void;
  deleteStatus?: number;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (/\/api\/knowledge-bases\/[^/]+\/documents$/.test(path)) {
        return jsonResponse(documents);
      }
      if (/\/api\/knowledge-bases\/[^/]+\/documents\/[^/]+\/segments$/.test(path)) {
        return jsonResponse(segments);
      }
      if (/\/api\/knowledge-bases\/[^/]+\/search$/.test(path) && init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        onSearch?.(path.split("/").at(-2) ?? "", payload.query);
        return jsonResponse(searchResponse);
      }
      if (/\/api\/knowledge-bases\/[^/]+\/answer$/.test(path) && init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        onAnswer?.(path.split("/").at(-2) ?? "", payload.query);
        return jsonResponse(answerResponse);
      }
      if (/\/api\/knowledge-bases\/[^/]+\/answer\/stream$/.test(path) && init?.method === "POST") {
        const body = streamAnswerEvents.map((event) => JSON.stringify(event)).join("\n") + "\n";
        return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
      }
      if (/\/api\/knowledge-bases\/[^/]+\/documents\/[^/]+$/.test(path) && init?.method === "DELETE") {
        const parts = path.split("/");
        onDeleteDocument?.(parts.at(-3) ?? "", parts.at(-1) ?? "");
        return new Response(null, { status: 204 });
      }
      if (/\/api\/knowledge-bases\/[^/]+\/processing-jobs$/.test(path) && (!init?.method || init.method === "GET")) {
        onProcessingJobsRequest?.();
        return jsonResponse(processingJobs);
      }
      if (/\/api\/knowledge-bases\/[^/]+\/processing-jobs$/.test(path) && init?.method === "POST") {
        const knowledgeBaseId = path.split("/").at(-2) ?? "";
        onProcessingJob?.(knowledgeBaseId);
        return jsonResponse({ id: "job_test", knowledgeBaseId, status: "queued", chunksCreated: 0 });
      }
      if (/\/api\/knowledge-bases\/[^/]+\/documents\/upload$/.test(path) && init?.method === "POST") {
        const knowledgeBaseId = path.split("/").at(-3) ?? "";
        const formData = init.body as FormData;
        const file = formData.get("file") as File;
        onUploadDocument?.(knowledgeBaseId, file);
        return jsonResponse({
          id: "doc_uploaded",
          name: file.name,
          mimeType: file.type,
          sizeKb: 1,
          status: "uploaded",
          characterCount: 28,
          hitCount: 0,
          errorMessage: null
        });
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
