export type AgentStatus = "draft" | "ready" | "published" | "blocked";
export type HealthStatus = "online" | "degraded" | "offline" | "guarded";
export type GateStatus = "passed" | "blocked" | "review_required";
export type TraceStepStatus = "success" | "warning" | "failed" | "blocked";

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
  type: "trigger" | "retrieval" | "llm" | "tool" | "human" | "expose";
  name: string;
  status: TraceStepStatus;
};

export type Workflow = {
  id: string;
  agentId: string;
  name: string;
  status: "draft" | "ready" | "blocked";
  nodes: WorkflowNode[];
  toolHealthStatus: HealthStatus;
};

export type KnowledgeBase = {
  id: string;
  name: string;
  source: string;
  documentCount: number;
  retrievalStrategy: string;
  qualityScore: number;
  status: "ready" | "stale" | "processing";
};

export type Tool = {
  id: string;
  name: string;
  type: "mcp" | "api" | "trigger";
  credential: string;
  permission: string;
  health: HealthStatus;
  lastCalledAt: string;
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
  costCny: number;
  steps: TraceStep[];
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
