export type AgentStatus = "draft" | "ready" | "published" | "blocked";
export type HealthStatus = "online" | "degraded" | "offline" | "guarded";
export type GateStatus = "passed" | "blocked" | "review_required";
export type TraceStepStatus = "success" | "warning" | "failed" | "blocked";
export type RunCategory = "test" | "production";
export type ModelPurpose = "llm" | "embedding" | "rerank";
export type ModelProviderStatus = "online" | "offline";
export type KnowledgeChunkStrategy = "fixed" | "markdown" | "semantic";
export type KnowledgeRetrievalMode = "vector" | "hybrid";

export type Agent = {
  id: string;
  name: string;
  scenario: string;
  owner: string;
  status: AgentStatus;
  modelPolicy: string;
  workflowId: string;
  knowledgeBaseIds: string[];
  toolIds: string[];
};

export type WorkflowNode = {
  id: string;
  type: "trigger" | "retrieval" | "llm" | "tool" | "human" | "expose" | "comment" | "condition" | "loop";
  name: string;
  status: TraceStepStatus;
  description?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
};

export type WorkflowInputField = {
  id: string;
  label: string;
  variable: string;
  kind: "text" | "file" | "file[]" | string;
  required: boolean;
  legacy?: boolean;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type WorkflowViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type Workflow = {
  id: string;
  agentId: string;
  name: string;
  status: "draft" | "ready" | "blocked";
  nodes: WorkflowNode[];
  edges?: WorkflowEdge[];
  viewport?: WorkflowViewport;
  toolHealthStatus: HealthStatus;
};

export type KnowledgeBase = {
  id: string;
  name: string;
  description?: string | null;
  source: string;
  embeddingModelProviderId?: string | null;
  embeddingModelProviderName?: string | null;
  chunkStrategy: KnowledgeChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  retrievalMode: KnowledgeRetrievalMode;
  topK: number;
  similarityThreshold: number;
  returnCitations: boolean;
  documentCount: number;
  retrievalStrategy: string;
  qualityScore: number;
  status: "ready" | "stale" | "processing" | "draft";
};

export type KnowledgeDocument = {
  id: string;
  name: string;
  mimeType: string;
  sizeKb: number;
  status: string;
  segmentMode?: string;
  characterCount?: number;
  hitCount?: number;
  createdAt?: string | null;
};

export type Tool = {
  id: string;
  name: string;
  type: "mcp" | "api" | "model-api" | "trigger";
  credential: string;
  permission: string;
  health: HealthStatus;
  lastCalledAt: string;
};

export type ModelProvider = {
  id: string;
  name: string;
  providerType: "openai-compatible" | string;
  modelPurpose: ModelPurpose;
  baseUrl: string;
  model: string;
  apiKeyPreview: string;
  status: ModelProviderStatus;
  isDefault: boolean;
};

export type ReleaseGate = {
  id: string;
  agentId: string;
  status: GateStatus;
  reasons: string[];
  checkedAt: string;
  auditId?: string;
};

export type TraceStep = {
  id: string;
  type: WorkflowNode["type"];
  title: string;
  status: TraceStepStatus;
  latencyMs: number;
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
};

export type RunTrace = {
  id: string;
  agentId: string;
  status: TraceStepStatus;
  runCategory: RunCategory;
  failureReason?: string;
  costCny: number;
  finalOutput?: string;
  steps: TraceStep[];
};

export type RecentRun = {
  id: string;
  agentId: string;
  agentName: string;
  runTime?: string;
  failureReason: string;
  runCategory: RunCategory;
  status: "success" | "failed";
};

export type DashboardSummary = {
  runSuccessRate: {
    value: number;
    windowHours: number;
    totalRuns: number;
    successfulRuns: number;
  };
  publishedAgents: number;
  pendingAgents: Array<{
    id: string;
    name: string;
    description: string;
    status: "configuring";
  }>;
};

export type EvaluationRun = {
  id: string;
  datasetId: string;
  agentId: string;
  passRate: number;
  failedCases: string[];
  summary: {
    costCny: number;
    latencyMs: number;
  };
};
