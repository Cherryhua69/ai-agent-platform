import type { Agent, KnowledgeBase, ModelProvider, RecentRun, ReleaseGate, RunTrace, Tool, Workflow } from "../../types/domain";

export const agents: Agent[] = [
  {
    id: "agent-after-sale",
    name: "售后政策助手",
    scenario: "订单售后、退款和质保政策问答",
    owner: "陈晓",
    status: "blocked",
    modelPolicy: "gpt-4.1 + fallback",
    workflowId: "workflow-after-sale",
    knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
    toolIds: ["tool-create-ticket", "tool-query-order", "tool-refund-request"]
  },
  {
    id: "agent-contract-review",
    name: "合同审阅助手",
    scenario: "合同条款抽取、风险提示和人工复核",
    owner: "王宁",
    status: "ready",
    modelPolicy: "gpt-4.1-mini + strict citation",
    workflowId: "workflow-contract-review",
    knowledgeBaseIds: ["kb-contract"],
    toolIds: ["tool-query-order"]
  }
];

export const workflows: Workflow[] = [
  {
    id: "workflow-after-sale",
    agentId: "agent-after-sale",
    name: "售后工单 Agentflow",
    status: "blocked",
    toolHealthStatus: "degraded",
    nodes: [{ id: "node-trigger", type: "trigger", name: "用户输入", status: "success", config: { inputFields: [] } }]
  }
];

export const knowledgeBases: KnowledgeBase[] = [
  {
    id: "kb-after-sale",
    name: "售后政策库",
    source: "上传文档 + 飞书同步",
    documentCount: 128,
    retrievalStrategy: "Hybrid + Rerank",
    qualityScore: 92,
    status: "ready"
  },
  {
    id: "kb-warranty",
    name: "质保条款库",
    source: "PDF",
    documentCount: 42,
    retrievalStrategy: "Vector",
    qualityScore: 78,
    status: "stale"
  }
];

export const tools: Tool[] = [
  {
    id: "tool-create-ticket",
    name: "create_ticket",
    type: "mcp",
    credential: "ticket-prod",
    permission: "Developer + Operator",
    health: "degraded",
    lastCalledAt: "10 分钟前"
  },
  {
    id: "tool-query-order",
    name: "query_order",
    type: "api",
    credential: "order-readonly",
    permission: "Agent scoped",
    health: "online",
    lastCalledAt: "2 分钟前"
  },
  {
    id: "tool-refund-request",
    name: "refund_request",
    type: "api",
    credential: "refund-write",
    permission: "Human approve",
    health: "guarded",
    lastCalledAt: "1 小时前"
  }
];

export const modelProviders: ModelProvider[] = [
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
];

export const releaseGates: ReleaseGate[] = [
  {
    id: "gate-after-sale",
    agentId: "agent-after-sale",
    status: "blocked",
    reasons: ["工具健康异常：create_ticket degraded", "关键用例失败：refund-ticket-create", "退款 API 属于高风险写操作，需要人工确认"],
    checkedAt: "2026-06-10T09:30:00.000Z"
  }
];

export const runTrace: RunTrace = {
  id: "run_8f23",
  agentId: "agent-after-sale",
  status: "success",
  runCategory: "test",
  failureReason: "create_ticket timeout",
  costCny: 0.06,
  finalOutput: "[local-smoke] 售后政策助手已根据知识库生成答复。",
  steps: [
    {
      id: "step-input",
      type: "trigger",
      title: "用户输入",
      status: "success",
      latencyMs: 18,
      inputSummary: "订单 ORD-2048 售后政策咨询"
    },
    {
      id: "step-retrieval",
      type: "retrieval",
      title: "Hybrid Retrieval",
      status: "success",
      latencyMs: 320,
      outputSummary: "命中 5 段政策，最高分 0.91"
    },
    {
      id: "step-rerank",
      type: "retrieval",
      title: "Rerank",
      status: "success",
      latencyMs: 146,
      outputSummary: "保留 Top 5 引用"
    },
    {
      id: "step-llm",
      type: "llm",
      title: "LLM Decision",
      status: "success",
      latencyMs: 1100,
      outputSummary: "分类为需要人工复核"
    },
    {
      id: "step-tool",
      type: "tool",
      title: "MCP Tool create_ticket",
      status: "failed",
      latencyMs: 8400,
      errorMessage: "create_ticket timeout"
    }
  ]
};

export const recentRuns: RecentRun[] = [];

export const fixtures = {
  agents,
  workflows,
  knowledgeBases,
  tools,
  modelProviders,
  releaseGates,
  runTrace,
  recentRuns
};
