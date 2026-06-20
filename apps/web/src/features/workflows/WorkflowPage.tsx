import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent } from "react";
import { Bot, FileInput, FileOutput, Hand, Home, MessageSquarePlus, MousePointer2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import {
  Background,
  Controls,
  ConnectionLineType,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Agent, KnowledgeBase, ModelProvider, RunTrace, Workflow, WorkflowEdge, WorkflowInputField, WorkflowNode } from "../../types/domain";
import { useAgents } from "../agents/useAgents";
import { streamAgentRun } from "../agents/streamAgentRun";
import { useKnowledgeBases } from "../knowledge/useKnowledgeBases";
import { KeyValueList } from "../shared/ViewBlocks";
import { useModelProviders } from "../tools/useModelProviders";
import { useCanvasConfig } from "./useCanvasConfig";
import { useUpdateWorkflow } from "./useUpdateWorkflow";
import { useWorkflows } from "./useWorkflows";
import {
  getOutputVariableError,
  getOutputVariables,
  getReachableUpstreamVariables,
  getWorkflowValidationError,
  outputSelectorToValue,
  type OutputVariable
} from "./workflowVariables";

const nodePositions = [
  { x: 220, y: 220 },
  { x: 520, y: 200 },
  { x: 820, y: 220 },
  { x: 1120, y: 220 },
  { x: 1420, y: 220 }
];

const flowNodeSize = { width: 168, height: 96 };
const emptyAgents: Agent[] = [];
const emptyWorkflows: Workflow[] = [];
const emptyModelProviders: ModelProvider[] = [];
const emptyKnowledgeBases: KnowledgeBase[] = [];

type LlmNodeConfig = {
  modelProviderId: string;
  contextVariables: string[];
  systemPrompt: string;
  userPrompt: string;
  retryOnFailure: boolean;
};

const defaultInputFields: WorkflowInputField[] = [];

const fallbackNodes: WorkflowNode[] = [
  { id: "node-trigger", type: "trigger", name: "用户输入", status: "success", config: { inputFields: defaultInputFields } }
];

const LLM_DESCRIPTION = "AI 基于检索到的知识库内容结合用户问题，生成清晰、有帮助的回答。";
const defaultUserInputNode = fallbackNodes[0];

type CanvasMode = "select" | "pan";
type PendingPlacement = "llm" | "comment" | "expose" | "condition" | "loop" | null;
type PreviewMessage = { id: string; role: "user" | "assistant" | "error"; content: string };

type BranchNodeConfig = {
  variable: string;
  operator: string;
  compareValue: string;
  defaultBranch?: string;
  maxIterations?: number;
};

function getNodeTone(status: WorkflowNode["status"]) {
  if (status === "failed" || status === "blocked") {
    return "bad";
  }
  if (status === "warning") {
    return "warn";
  }
  return "ok";
}

function isDefaultUserInputNode(node: WorkflowNode) {
  return node.id === "node-trigger" || node.type === "trigger";
}

function getInputFields(node: WorkflowNode | undefined): WorkflowInputField[] {
  const inputFields = node?.config?.inputFields;
  if (!Array.isArray(inputFields) || inputFields.length === 0) {
    return defaultInputFields;
  }

  return inputFields
    .map((field) => {
      const value = field as Partial<WorkflowInputField>;
      return {
        id: String(value.id ?? value.variable ?? "input_field"),
        label: String(value.label ?? value.variable ?? value.id ?? "input_field"),
        variable: String(value.variable ?? value.id ?? value.label ?? "input_field"),
        kind: String(value.kind ?? "text"),
        required: Boolean(value.required),
        legacy: Boolean(value.legacy)
      };
    })
    .filter((field) => !field.legacy && !(field.id === "upload_file" && field.required));
}

function withDefaultTriggerConfig(node: WorkflowNode) {
  if (node.type !== "trigger") {
    return node;
  }

  return {
    ...node,
    name: "用户输入",
    config: {
      ...(node.config ?? {}),
      inputFields: getInputFields(node)
    }
  };
}

function ensureUserInputFirst(nodes: WorkflowNode[]) {
  const triggerNode = nodes.find((node) => node.type === "trigger");
  const otherNodes = nodes.filter((node) => node.id !== triggerNode?.id);
  return [withDefaultTriggerConfig(triggerNode ?? defaultUserInputNode), ...otherNodes];
}

function getNodeTypeLabel(type: WorkflowNode["type"]) {
  const labels: Record<WorkflowNode["type"], string> = {
    trigger: "开始",
    retrieval: "知识检索",
    llm: "LLM",
    tool: "工具",
    human: "人工确认",
    expose: "回复",
    comment: "注释",
    condition: "条件",
    loop: "循环"
  };
  return labels[type];
}

function getRunStatus(node: WorkflowNode, latestRun: RunTrace | null) {
  return latestRun?.steps.find((step) => step.type === node.type || step.title === node.name)?.status ?? node.status;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getBranchNodeConfig(node: WorkflowNode): BranchNodeConfig {
  return {
    variable: readString(node.config?.variable),
    operator: readString(node.config?.operator, node.type === "loop" ? "not_empty" : "eq"),
    compareValue: readString(node.config?.compareValue),
    defaultBranch: readString(node.config?.defaultBranch, "default"),
    maxIterations: normalizeMaxIterations(node.config?.maxIterations)
  };
}

function normalizeMaxIterations(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) {
    return 10;
  }
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function getLlmConfig(node: WorkflowNode | undefined, fallbackModelProviderId = ""): LlmNodeConfig {
  const config = node?.config ?? {};

  return {
    modelProviderId: readString(config.modelProviderId, fallbackModelProviderId),
    contextVariables: readStringArray(config.contextVariables),
    systemPrompt: readString(config.systemPrompt),
    userPrompt: readString(config.userPrompt),
    retryOnFailure: Boolean(config.retryOnFailure)
  };
}

function getModelLabel(modelProviders: ModelProvider[], modelProviderId: string) {
  const provider = modelProviders.find((item) => item.id === modelProviderId);
  return provider?.model ?? "";
}

type WorkflowFlowNodeData = {
  node: WorkflowNode;
  status: WorkflowNode["status"];
  canDelete: boolean;
  modelLabel?: string;
  nodeNames: Record<string, string>;
  onDelete: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onUpdateDescription: (nodeId: string, description: string) => void;
};

function WorkflowFlowNode({ data }: { data: WorkflowFlowNodeData }) {
  const { node, canDelete, modelLabel, nodeNames, onDelete, onSelect, onUpdateDescription } = data;
  const inputFields = node.type === "trigger" ? getInputFields(node) : [];
  const [isEditingComment, setIsEditingComment] = useState(false);

  function handleDelete(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    onDelete(node.id);
  }

  function handleSelect() {
    onSelect(node.id);
  }

  function handlePointerSelect(event: PointerEvent<HTMLElement>) {
    if (event.button === 0) {
      handleSelect();
    }
  }

  function handleCommentDoubleClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
    setIsEditingComment(true);
  }

  if (node.type === "comment") {
    return (
      <div
        className="workflow-comment-node"
        data-workflow-node-id={node.id}
        data-workflow-node-type="comment"
        onDoubleClick={handleCommentDoubleClick}
      >
        {canDelete ? (
          <button aria-label="删除节点" className="workflow-node-delete" onClick={handleDelete} title="删除" type="button">
            ×
          </button>
        ) : null}
        <strong>{node.name}</strong>
        {isEditingComment ? (
          <textarea
            aria-label="编辑注释"
            autoFocus
            onBlur={() => setIsEditingComment(false)}
            onChange={(event) => onUpdateDescription(node.id, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            value={node.description ?? ""}
          />
        ) : (
          <p>{node.description ?? "记录这个流程分支的说明。"}</p>
        )}
      </div>
    );
  }

  return (
    <>
      {node.type === "trigger" ? null : (
        <Handle className="workflow-handle workflow-handle-left" id="left" position={Position.Left} style={{ zIndex: 3 }} type="target" />
      )}
      <button
        aria-label={node.name}
        className="workflow-flow-node-button"
        data-workflow-node-id={node.id}
        onClick={handleSelect}
        onPointerDown={handlePointerSelect}
        title={node.name}
        type="button"
      >
        <span className="workflow-node-title">
          {node.type === "trigger" || node.type === "llm" || node.type === "expose" ? (
            <span className="workflow-node-icon" aria-hidden="true">
              {node.type === "trigger" ? <Home size={13} /> : node.type === "llm" ? <Bot size={13} /> : <FileOutput size={13} />}
            </span>
          ) : null}
          <strong>{node.name}</strong>
        </span>
        {node.type === "trigger" ? (
          <span className="workflow-input-fields">
            {inputFields.slice(0, 1).map((field) => (
              <span className="workflow-input-field-row" key={field.id}>
                <span className="workflow-input-field-name">
                  <FileInput aria-hidden="true" size={12} />
                  {field.label}
                </span>
                {field.required ? <small>必填</small> : null}
              </span>
            ))}
          </span>
        ) : node.type === "llm" ? (
          <span className="workflow-model-chip">
            <span>{modelLabel || "未选择模型"}</span>
          </span>
        ) : node.type === "expose" ? (
          <span className="workflow-output-summary">
            {getOutputVariables(node).slice(0, 3).map((item) => {
              const [sourceId, ...path] = item.valueSelector;
              return (
                <span key={item.id}>
                  {item.name || "未命名"} ← {nodeNames[sourceId] || sourceId || "未选择"} / {path.join(".") || "未选择"} · {item.valueType}
                </span>
              );
            })}
          </span>
        ) : (
          <span>{node.description ?? getNodeTypeLabel(node.type)}</span>
        )}
      </button>
      {canDelete ? (
        <button aria-label="删除节点" className="workflow-node-delete" onClick={handleDelete} title="删除" type="button">
          ×
        </button>
      ) : null}
      {node.type === "condition" ? (
        [...new Set(["true", readString(node.config?.defaultBranch, "default")])].map((handleId, index) => (
          <Handle
            className="workflow-handle workflow-handle-right"
            id={handleId}
            key={handleId}
            position={Position.Right}
            style={{ zIndex: 3, top: index === 0 ? "35%" : "70%" }}
            type="source"
          />
        ))
      ) : node.type === "loop" ? (
        ["continue", "exit"].map((handleId, index) => (
          <Handle
            className="workflow-handle workflow-handle-right"
            id={handleId}
            key={handleId}
            position={Position.Right}
            style={{ zIndex: 3, top: index === 0 ? "35%" : "70%" }}
            type="source"
          />
        ))
      ) : node.type === "expose" ? null : (
        <Handle className="workflow-handle workflow-handle-right" id="right" position={Position.Right} style={{ zIndex: 3 }} type="source" />
      )}
    </>
  );
}

const nodeTypes: NodeTypes = {
  workflow: WorkflowFlowNode
};

function createFlowEdges(edges: WorkflowEdge[] = []): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: "bezier",
    animated: false,
    className: "workflow-flow-edge",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: "#5f75a6"
    }
  }));
}

export function deleteSelectedEdges(edges: Edge[], key: string): Edge[] {
  if (key !== "Delete" && key !== "Backspace") {
    return edges;
  }
  return edges.filter((edge) => !edge.selected);
}

function createFlowNodes(
  nodes: WorkflowNode[],
  selectedNodeId: string,
  latestRun: RunTrace | null,
  onDeleteNode: (nodeId: string) => void = () => undefined,
  onSelectNode: (nodeId: string) => void = () => undefined,
  currentNodes: Node[] = [],
  modelProviders: ModelProvider[] = [],
  fallbackModelProviderId = "",
  onUpdateDescription: (nodeId: string, description: string) => void = () => undefined
): Node[] {
  const nodeNames = Object.fromEntries(nodes.map((node) => [node.id, node.name]));
  return nodes.map((node, index) => {
    const status = getRunStatus(node, latestRun);
    const isComment = node.type === "comment";
    const existingNode = currentNodes.find((currentNode) => currentNode.id === node.id);

    return {
      id: node.id,
      type: "workflow",
      position: existingNode?.position ?? node.position ?? nodePositions[index] ?? { x: 220 + index * 280, y: 220 },
      width: isComment ? 260 : flowNodeSize.width,
      height: isComment ? 140 : flowNodeSize.height,
      measured: isComment ? { width: 260, height: 140 } : flowNodeSize,
      style: { position: "absolute" },
      data: {
        node,
        status,
        canDelete: !isDefaultUserInputNode(node),
        modelLabel: node.type === "llm" ? getModelLabel(modelProviders, getLlmConfig(node, fallbackModelProviderId).modelProviderId) : undefined,
        nodeNames,
        onDelete: onDeleteNode,
        onSelect: onSelectNode,
        onUpdateDescription
      },
      selected: selectedNodeId === node.id,
      className: isComment ? "workflow-flow-node workflow-flow-comment" : `workflow-flow-node workflow-flow-node-${status}`
    };
  });
}

export function WorkflowPage() {
  const agentsQuery = useAgents();
  const workflowsQuery = useWorkflows();
  const modelProvidersQuery = useModelProviders();
  const knowledgeBasesQuery = useKnowledgeBases();
  const updateWorkflow = useUpdateWorkflow();
  const modelProviders = modelProvidersQuery.data ?? emptyModelProviders;
  const knowledgeBases = knowledgeBasesQuery.data ?? emptyKnowledgeBases;
  const {
    selectedAgentId,
    selectedWorkflowId,
    selectedNodeId,
    modelProviderId,
    knowledgeBaseIds,
    setSelectedNodeId,
    setModelProviderId,
    toggleKnowledgeBaseId,
    latestRun
  } = useCanvasConfig();
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("select");
  const [isNodeMenuOpen, setIsNodeMenuOpen] = useState(false);
  const [localNodes, setLocalNodes] = useState<WorkflowNode[]>([]);
  const [removedNodeIds, setRemovedNodeIds] = useState<string[]>([]);
  const [nodeConfigOverrides, setNodeConfigOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const [nodeDescriptionOverrides, setNodeDescriptionOverrides] = useState<Record<string, string>>({});
  const [layoutMessage, setLayoutMessage] = useState("");
  const [saveRevision, setSaveRevision] = useState(0);
  const hasLoadedWorkflowRef = useRef(false);
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement>(null);
  const [placementPreviewPosition, setPlacementPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([]);
  const [previewTextValues, setPreviewTextValues] = useState<Record<string, string>>({});
  const [previewFileValues, setPreviewFileValues] = useState<Record<string, File[]>>({});
  const [isPreviewStreaming, setIsPreviewStreaming] = useState(false);
  const [previewStreamError, setPreviewStreamError] = useState(false);
  const [isInputTypeMenuOpen, setIsInputTypeMenuOpen] = useState(false);
  const agents = agentsQuery.data ?? emptyAgents;
  const workflows = workflowsQuery.data ?? emptyWorkflows;
  const selectedWorkflow = workflows.find((item) => item.id === selectedWorkflowId) ?? workflows.find((item) => item.agentId === selectedAgentId);
  const workflow = selectedWorkflow ?? (!selectedWorkflowId && !selectedAgentId ? workflows[0] : undefined);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents.find((agent) => agent.workflowId === workflow?.id);
  const baseNodes = useMemo(() => ensureUserInputFirst(workflow?.nodes ?? fallbackNodes), [workflow?.nodes]);
  const nodes = useMemo(() => {
    const uniqueNodes = [...new Map([...baseNodes, ...localNodes].map((node) => [node.id, node])).values()];
    return uniqueNodes
        .filter((node) => !removedNodeIds.includes(node.id))
        .map((node) => ({
          ...node,
          description: nodeDescriptionOverrides[node.id] ?? node.description,
          config: {
            ...(node.config ?? {}),
            ...(nodeConfigOverrides[node.id] ?? {})
          }
        }));
  }, [baseNodes, localNodes, nodeConfigOverrides, nodeDescriptionOverrides, removedNodeIds]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const previewInputFields = useMemo<WorkflowInputField[]>(() => {
    const configuredFields = getInputFields(nodes.find((node) => node.type === "trigger"));
    return configuredFields.length > 0
      ? configuredFields
      : [{ id: "message", label: "消息", variable: "userinput.message", kind: "text", required: true }];
  }, [nodes]);
  const isPreviewReady = previewInputFields.every((field) => {
    if (!field.required) {
      return true;
    }
    return field.kind === "text"
      ? Boolean(previewTextValues[field.id]?.trim())
      : Boolean(previewFileValues[field.id]?.length);
  });
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setIsPreviewOpen(false);
      setIsInspectorOpen(nodes.find((node) => node.id === nodeId)?.type !== "comment");
    },
    [nodes, setSelectedNodeId]
  );
  const handleUpdateNodeDescription = useCallback(
    (nodeId: string, description: string) => {
      setNodeDescriptionOverrides((descriptions) => ({ ...descriptions, [nodeId]: description }));
      setSaveRevision((revision) => revision + 1);
    },
    []
  );
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(
    createFlowNodes(nodes, selectedNode?.id ?? "", latestRun, undefined, handleSelectNode, [], modelProviders, modelProviderId, handleUpdateNodeDescription)
  );
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>(createFlowEdges(workflow?.edges));

  useEffect(() => {
    function handleDeleteSelectedEdge(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      setFlowEdges((currentEdges) => {
        const nextEdges = deleteSelectedEdges(currentEdges, event.key);
        if (nextEdges.length === currentEdges.length) {
          return currentEdges;
        }
        setSaveRevision((revision) => revision + 1);
        return nextEdges;
      });
    }

    window.addEventListener("keydown", handleDeleteSelectedEdge);
    return () => window.removeEventListener("keydown", handleDeleteSelectedEdge);
  }, [setFlowEdges]);

  function markWorkflowDirty() {
    setSaveRevision((revision) => revision + 1);
  }

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const targetNode = nodes.find((node) => node.id === nodeId);
      if (!targetNode || isDefaultUserInputNode(targetNode)) {
        return;
      }

      setRemovedNodeIds((currentIds) => (currentIds.includes(nodeId) ? currentIds : [...currentIds, nodeId]));
      setLocalNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setFlowNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setFlowEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(nodes.find((node) => node.id !== nodeId)?.id ?? "");
        setIsInspectorOpen(false);
      }
      markWorkflowDirty();
    },
    [nodes, selectedNodeId, setFlowEdges, setFlowNodes, setSelectedNodeId]
  );

  useEffect(() => {
    if (!modelProviderId && modelProviders.length > 0) {
      setModelProviderId(modelProviders.find((provider) => provider.isDefault)?.id ?? modelProviders[0].id);
    }
  }, [modelProviderId, modelProviders, setModelProviderId]);

  useEffect(() => {
    if (!selectedNodeId && nodes[0]) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes, selectedNodeId, setSelectedNodeId]);

  useEffect(() => {
    setFlowNodes((currentNodes) =>
      createFlowNodes(nodes, selectedNode?.id ?? "", latestRun, handleDeleteNode, handleSelectNode, currentNodes, modelProviders, modelProviderId, handleUpdateNodeDescription)
    );
  }, [handleDeleteNode, handleSelectNode, handleUpdateNodeDescription, latestRun, modelProviderId, modelProviders, nodes, selectedNode?.id, setFlowNodes]);

  useEffect(() => {
    setFlowNodes(
      createFlowNodes(nodes, selectedNode?.id ?? "", latestRun, handleDeleteNode, handleSelectNode, [], modelProviders, modelProviderId, handleUpdateNodeDescription)
    );
    setFlowEdges(createFlowEdges(workflow?.edges));
    hasLoadedWorkflowRef.current = false;
  }, [setFlowEdges, workflow?.edges, workflow?.id]);

  useEffect(() => {
    if (workflow?.id) {
      hasLoadedWorkflowRef.current = true;
    }
  }, [workflow?.id]);

  const selectedLlmConfig = selectedNode?.type === "llm" ? getLlmConfig(selectedNode, modelProviderId) : null;
  const selectedModel = modelProviders.find((provider) => provider.id === (selectedLlmConfig?.modelProviderId || modelProviderId));
  const failedStep = latestRun?.steps.find((step) => step.status === "failed");

  function handleOpenPreview() {
    setIsInspectorOpen(false);
    setIsPreviewOpen(true);
  }

  function handleClosePreview() {
    setIsPreviewOpen(false);
    setPreviewMessages([]);
    setPreviewTextValues({});
    setPreviewFileValues({});
    setPreviewStreamError(false);
  }

  async function handleRunDebug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workflow || !isPreviewReady || isPreviewStreaming) {
      return;
    }

    const textFields = previewInputFields.filter((field) => field.kind === "text");
    const textParts = textFields
      .map((field) => ({ field, value: previewTextValues[field.id]?.trim() ?? "" }))
      .filter(({ value }) => Boolean(value));
    const userInputValue = textParts.map(({ value }) => value).join("\n");
    const visibleText = textParts.length <= 1
      ? userInputValue
      : textParts.map(({ field, value }) => `${field.label}：${value}`).join("\n");
    const fileNames = previewInputFields
      .filter((field) => field.kind !== "text")
      .flatMap((field) => previewFileValues[field.id] ?? [])
      .map((file) => file.name);
    const messageContent = [visibleText, fileNames.length > 0 ? `附件：${fileNames.join("、")}` : ""].filter(Boolean).join("\n");
    const messageId = `${Date.now()}-${previewMessages.length}`;

    const assistantMessageId = `${messageId}-assistant`;
    setPreviewMessages((messages) => [
      ...messages,
      { id: `${messageId}-user`, role: "user", content: messageContent },
      { id: assistantMessageId, role: "assistant", content: "" }
    ]);
    setPreviewTextValues({});
    setPreviewFileValues({});
    setPreviewStreamError(false);
    setIsPreviewStreaming(true);
    event.currentTarget.reset();
    const conversationHistory = previewMessages
      .filter((message): message is PreviewMessage & { role: "user" | "assistant" } => message.role !== "error" && Boolean(message.content))
      .slice(-20)
      .map(({ role, content }) => ({ role, content }));
    try {
      await streamAgentRun(
        {
        agentId: workflow?.agentId ?? "agent-after-sale",
        userInput: userInputValue || messageContent,
        modelProviderId: modelProviderId || undefined,
        knowledgeBaseIds,
        conversationHistory
        },
        (chunk) => {
          setPreviewMessages((messages) => messages.map((message) => (
            message.id === assistantMessageId ? { ...message, content: message.content + chunk } : message
          )));
        }
      );
    } catch {
      setPreviewStreamError(true);
      setPreviewMessages((messages) => messages.map((message) => (
        message.id === assistantMessageId
          ? { ...message, role: "error", content: "运行失败，请检查模型与工作流配置后重试。" }
          : message
      )));
    } finally {
      setIsPreviewStreaming(false);
    }
  }

  function getNodeConfig(node: WorkflowNode) {
    if (node.type === "trigger") {
      return {
        ...(node.config ?? {}),
        inputFields: getInputFields(node)
      };
    }
    if (node.type === "llm") {
      return getLlmConfig(node, modelProviderId);
    }
    if (node.type === "retrieval") {
      return { knowledgeBaseIds };
    }
    if (node.type === "loop") {
      return {
        ...(node.config ?? {}),
        maxIterations: normalizeMaxIterations(node.config?.maxIterations)
      };
    }
    if (node.type === "expose") {
      return { ...(node.config ?? {}), outputVariables: getOutputVariables(node) };
    }
    return node.config ?? {};
  }

  function saveWorkflowSnapshot(options: { silent?: boolean } = {}) {
    if (!workflow) {
      return;
    }

    const validationError = nodes.some((node) => node.type === "expose" && Array.isArray(node.config?.outputVariables))
      ? getWorkflowValidationError(nodes, flowEdges)
      : "";
    if (validationError) {
      setLayoutMessage(validationError);
      return;
    }

    const savedNodes = nodes.map((node) => {
      const flowNode = flowNodes.find((item) => item.id === node.id);
      return {
        ...node,
        position: flowNode?.position ?? node.position ?? { x: 0, y: 0 },
        config: getNodeConfig(node)
      };
    });
    const savedNodeIds = new Set(savedNodes.map((node) => node.id));
    const savedEdges = flowEdges
      .filter((edge) => savedNodeIds.has(edge.source) && savedNodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null
      }));

    updateWorkflow.mutate(
      {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        toolHealthStatus: workflow.toolHealthStatus,
        nodes: savedNodes,
        edges: savedEdges,
        viewport: workflow.viewport ?? { x: 0, y: 0, zoom: 1 }
      },
      {
        onSuccess: () => setLayoutMessage(options.silent ? "已自动保存" : "已保存工作流配置")
      }
    );
  }

  useEffect(() => {
    if (!workflow || saveRevision === 0 || !hasLoadedWorkflowRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => saveWorkflowSnapshot({ silent: true }), 150);
    return () => window.clearTimeout(timeoutId);
  }, [flowEdges, flowNodes, nodeConfigOverrides, nodeDescriptionOverrides, removedNodeIds, localNodes, saveRevision, workflow?.id]);

  function handleAddNode(type: Exclude<PendingPlacement, null>) {
    setPendingPlacement(type);
    setPlacementPreviewPosition(null);
    setIsNodeMenuOpen(false);
    setCanvasMode("select");
    const labels = { llm: " LLM 节点", comment: "注释框", expose: "输出节点", condition: "条件节点", loop: "循环节点" };
    setLayoutMessage(`点击画布放置${labels[type]}`);
  }

  function handleAddLlmNode() {
    handleAddNode("llm");
  }

  function getUpstreamContextOptions(node: WorkflowNode) {
    return getReachableUpstreamVariables(node.id, nodes, flowEdges);
  }

  function updateSelectedLlmConfig(config: Partial<LlmNodeConfig>) {
    if (!selectedNode || selectedNode.type !== "llm") {
      return;
    }

    updateSelectedNodeConfig({
      ...getLlmConfig(selectedNode, modelProviderId),
      ...config
    });
  }

  function toggleLlmContextVariable(variable: string) {
    if (!selectedNode || selectedNode.type !== "llm") {
      return;
    }

    updateSelectedLlmConfig({ contextVariables: variable ? [variable] : [] });
  }

  function handleAddComment() {
    handleAddNode("comment");
  }

  function handleAutoLayout() {
    setFlowNodes((currentNodes) => {
      let layoutIndex = 0;
      return currentNodes.map((node) => {
        const workflowNode = node.data.node as WorkflowNode;
        if (workflowNode.type === "comment") {
          return node;
        }

        const position = { x: 220 + layoutIndex * 280, y: 220 };
        layoutIndex += 1;
        return { ...node, position };
      });
    });
    setLayoutMessage("已自动整理节点");
    markWorkflowDirty();
  }

  function handleCanvasClick(event: MouseEvent) {
    if (!pendingPlacement) {
      return;
    }

    const isComment = pendingPlacement === "comment";
    const nodeSize = isComment ? { width: 260, height: 140 } : flowNodeSize;
    const canvasRect = event.currentTarget.getBoundingClientRect();
    const pointerPosition = reactFlowInstance?.screenToFlowPosition({ x: event.clientX, y: event.clientY }) ?? {
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top
    };
    const position = {
      x: pointerPosition.x - nodeSize.width / 2,
      y: pointerPosition.y - nodeSize.height / 2
    };
    const id = `local-${pendingPlacement}-${Date.now()}`;
    const nextNode: WorkflowNode =
      pendingPlacement === "llm"
        ? {
          id,
          type: "llm",
          name: `LLM ${nodes.filter((node) => node.type === "llm").length + 1}`,
          status: "success",
          description: LLM_DESCRIPTION
          }
        : pendingPlacement === "comment"
          ? {
          id,
          type: "comment",
          name: "注释",
          status: "success",
          description: "在这里记录流程说明、测试假设或团队协作备注。"
            }
          : pendingPlacement === "expose"
            ? { id, type: "expose", name: "输出", status: "success", config: { outputVariables: [] } }
            : pendingPlacement === "condition"
              ? {
                  id,
                  type: "condition",
                  name: "条件",
                  status: "success",
                  config: { variable: "", operator: "eq", compareValue: "", defaultBranch: "default" }
                }
              : {
                  id,
                  type: "loop",
                  name: "循环",
                  status: "success",
                  config: { variable: "", operator: "not_empty", compareValue: "", maxIterations: 10 }
                };

    setLocalNodes((currentNodes) => [...currentNodes, nextNode]);
    setFlowNodes((currentNodes) => [
      ...currentNodes,
      ...createFlowNodes(
        [nextNode],
        id,
        latestRun,
        undefined,
        handleSelectNode,
        [],
        modelProviders,
        modelProviderId,
        handleUpdateNodeDescription
      ).map((node) => ({ ...node, position }))
    ]);
    setSelectedNodeId(id);
    setIsInspectorOpen(!isComment);
    setPendingPlacement(null);
    setPlacementPreviewPosition(null);
    setLayoutMessage("");
    markWorkflowDirty();
  }

  function handleCanvasMouseMove(event: MouseEvent<Element>) {
    if (!pendingPlacement) {
      return;
    }

    const canvasRect = event.currentTarget.getBoundingClientRect();
    setPlacementPreviewPosition({
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top
    });
  }

  function handleEditorPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest(".workflow-node-delete")) {
      return;
    }

    const nodeElement = target.closest<HTMLElement>("[data-workflow-node-id]");
    if (nodeElement?.dataset.workflowNodeType === "comment") {
      return;
    }
    const nodeId = nodeElement?.dataset.workflowNodeId;
    if (nodeId) {
      handleSelectNode(nodeId);
    }
  }

  function handleConnect(connection: Connection) {
    setFlowEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          type: "bezier",
          animated: false,
          className: "workflow-flow-edge",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: "#5f75a6"
          }
        },
        currentEdges
      )
    );
    markWorkflowDirty();
  }

  function handleNodesChange(changes: Parameters<typeof onNodesChange>[0]) {
    onNodesChange(changes);
    if (changes.some((change) => change.type === "position" || change.type === "dimensions" || change.type === "remove")) {
      markWorkflowDirty();
    }
  }

  function handleEdgesChange(changes: Parameters<typeof onEdgesChange>[0]) {
    onEdgesChange(changes);
    if (changes.some((change) => change.type === "remove" || change.type === "select")) {
      markWorkflowDirty();
    }
  }

  function updateSelectedNodeConfig(config: Record<string, unknown>) {
    if (!selectedNode) {
      return;
    }

    setNodeConfigOverrides((currentConfig) => ({
      ...currentConfig,
      [selectedNode.id]: {
        ...(selectedNode.config ?? {}),
        ...(currentConfig[selectedNode.id] ?? {}),
        ...config
      }
    }));
    markWorkflowDirty();
  }

  function updateSelectedNodeDescription(description: string) {
    if (!selectedNode) {
      return;
    }

    setNodeDescriptionOverrides((currentDescriptions) => ({
      ...currentDescriptions,
      [selectedNode.id]: description
    }));
    markWorkflowDirty();
  }

  function createInputField(kind: WorkflowInputField["kind"]): WorkflowInputField {
    const existingFields = selectedNode ? getInputFields(selectedNode) : [];
    const nextIndex = existingFields.length + 1;
    const presets: Record<string, Pick<WorkflowInputField, "id" | "label" | "variable" | "kind">> = {
      text: {
        id: `text_input_${nextIndex}`,
        label: `text_input_${nextIndex}`,
        variable: `text_input_${nextIndex}`,
        kind: "text"
      },
      file: {
        id: nextIndex === 1 ? "upload_file" : `upload_file_${nextIndex}`,
        label: nextIndex === 1 ? "upload_file" : `upload_file_${nextIndex}`,
        variable: nextIndex === 1 ? "upload_file" : `upload_file_${nextIndex}`,
        kind: "file"
      },
      "file[]": {
        id: `files_${nextIndex}`,
        label: `files_${nextIndex}`,
        variable: `files_${nextIndex}`,
        kind: "file[]"
      }
    };

    return {
      ...presets[kind],
      required: false,
      legacy: false
    };
  }

  function handleAddInputField(kind: WorkflowInputField["kind"]) {
    if (!selectedNode) {
      return;
    }

    const nextField = createInputField(kind);
    updateSelectedNodeConfig({ inputFields: [...getInputFields(selectedNode), nextField] });
    setIsInputTypeMenuOpen(false);
  }

  function handleDeleteInputField(fieldId: string) {
    if (!selectedNode) {
      return;
    }

    updateSelectedNodeConfig({
      inputFields: getInputFields(selectedNode).filter((field) => field.id !== fieldId)
    });
  }

  function updateOutputVariables(outputVariables: OutputVariable[]) {
    updateSelectedNodeConfig({ outputVariables });
  }

  function handleAddOutputVariable() {
    updateOutputVariables([...getOutputVariables(selectedNode), { id: `output-${Date.now()}`, name: "", valueSelector: [], valueType: "String" }]);
  }

  function handleUpdateOutputVariableName(index: number, name: string) {
    updateOutputVariables(getOutputVariables(selectedNode).map((item, itemIndex) => (itemIndex === index ? { ...item, name } : item)));
  }

  function handleUpdateOutputVariableSelector(index: number, value: string, upstreamVariables: ReturnType<typeof getReachableUpstreamVariables>) {
    const selected = upstreamVariables.find((variable) => variable.value === value);
    if (!selected) return;
    const outputs = getOutputVariables(selectedNode);
    const usedNames = new Set(outputs.filter((_, itemIndex) => itemIndex !== index).map((item) => item.name));
    let name = outputs[index]?.name.trim() || selected.name;
    let suffix = 1;
    while (usedNames.has(name)) name = `${selected.name}_${suffix++}`;
    updateOutputVariables(outputs.map((item, itemIndex) => itemIndex === index
      ? { ...item, name, valueSelector: selected.valueSelector, valueType: selected.valueType }
      : item));
  }

  function handleDeleteOutputVariable(index: number) {
    updateOutputVariables(getOutputVariables(selectedNode).filter((_, itemIndex) => itemIndex !== index));
  }

  function handleMoveOutputVariable(index: number, direction: -1 | 1) {
    const outputs = getOutputVariables(selectedNode);
    const target = index + direction;
    if (target < 0 || target >= outputs.length) return;
    const next = [...outputs];
    [next[index], next[target]] = [next[target], next[index]];
    updateOutputVariables(next);
  }

  function renderNodeInspector() {
    if (!selectedNode) {
      return <p className="empty-note">请选择一个节点进行配置。</p>;
    }

    if (selectedNode.type === "trigger") {
      const inputFields = getInputFields(selectedNode);
      return (
        <div className="field-stack">
          <label className="field-stack workflow-description-field">
            <span>添加描述</span>
            <input
              aria-label="添加描述"
              placeholder="添加描述..."
              type="text"
              value={selectedNode.description ?? ""}
              onChange={(event) => updateSelectedNodeDescription(event.target.value)}
            />
          </label>
          <div className="workflow-inspector-tabs" aria-label="节点配置标签">
            <span>设置</span>
          </div>
          <section className="workflow-input-field-section">
            <div className="workflow-input-field-header">
              <strong>输入字段</strong>
              <button
                aria-label="添加输入字段"
                aria-expanded={isInputTypeMenuOpen}
                onClick={() => setIsInputTypeMenuOpen((value) => !value)}
                title="添加输入字段"
                type="button"
              >
                <Plus aria-hidden="true" size={16} />
              </button>
            </div>
            {isInputTypeMenuOpen ? (
              <div className="workflow-input-type-menu" aria-label="选择输入类型" role="dialog">
                <button aria-label="文本输入" onClick={() => handleAddInputField("text")} type="button">
                  <strong>文本输入</strong>
                  <span>用于接收用户输入的文字内容</span>
                </button>
                <button aria-label="文件上传" onClick={() => handleAddInputField("file")} type="button">
                  <strong>文件上传</strong>
                  <span>用于接收单个上传文件</span>
                </button>
              </div>
            ) : null}
            <div className="workflow-input-field-list">
              {inputFields.map((field) => (
                <div className="workflow-input-field-card" key={field.id}>
                  <span>
                    <FileInput aria-hidden="true" size={13} />
                    {field.legacy ? field.label : `${field.label} · ${field.variable}`}
                  </span>
                  <div>
                    {field.legacy ? <em>LEGACY</em> : null}
                    {field.required ? <small>必填</small> : <small>{field.kind === "file[]" ? "Array[File]" : field.kind}</small>}
                    {!field.legacy && !field.required ? (
                      <button aria-label={`删除输入字段 ${field.label}`} onClick={() => handleDeleteInputField(field.id)} type="button">
                        ×
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (selectedNode.type === "expose") {
      const outputVariables = getOutputVariables(selectedNode);
      const upstreamVariables = getUpstreamContextOptions(selectedNode);
      const upstreamGroups = [...new Map(upstreamVariables.map((variable) => [
        variable.nodeId,
        { label: variable.nodeName, variables: upstreamVariables.filter((item) => item.nodeId === variable.nodeId) }
      ])).values()];
      const outputError = getOutputVariableError(outputVariables);
      return (
        <section className="workflow-output-config" aria-label="输出变量">
          <div className="workflow-output-header">
            <strong>输出变量</strong>
            <span aria-label="必填">*</span>
            <button aria-label="添加输出变量" onClick={handleAddOutputVariable} type="button">
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>
          {outputVariables.map((item, index) => (
            <div className="workflow-output-row" key={item.id}>
              <input
                aria-label="输出变量名"
                onChange={(event) => handleUpdateOutputVariableName(index, event.target.value)}
                placeholder="变量名"
                required
                value={item.name}
              />
              <select
                aria-label="设置变量值"
                onChange={(event) => handleUpdateOutputVariableSelector(index, event.target.value, upstreamVariables)}
                required
                value={outputSelectorToValue(item.valueSelector)}
              >
                <option value="">请选择上游变量</option>
                {upstreamGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.variables.map((variable) => (
                      <option key={variable.value} value={variable.value}>
                        {variable.nodeName} / {variable.name} {variable.valueType}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="workflow-output-row-actions">
                <button aria-label={`上移输出变量 ${index + 1}`} disabled={index === 0} onClick={() => handleMoveOutputVariable(index, -1)} type="button">↑</button>
                <button aria-label={`下移输出变量 ${index + 1}`} disabled={index === outputVariables.length - 1} onClick={() => handleMoveOutputVariable(index, 1)} type="button">↓</button>
                <button aria-label={`删除输出变量 ${index + 1}`} onClick={() => handleDeleteOutputVariable(index)} type="button">×</button>
              </span>
            </div>
          ))}
          {outputVariables.length === 0 ? <p className="empty-note">点击加号添加输出变量。</p> : null}
          {outputVariables.length > 0 && outputError ? <p className="inline-error">{outputError}</p> : null}
        </section>
      );
    }

    if (selectedNode.type === "condition" || selectedNode.type === "loop") {
      const config = getBranchNodeConfig(selectedNode);
      const upstreamVariables = getUpstreamContextOptions(selectedNode);
      return (
        <div className="field-stack workflow-branch-config">
          <label className="field-stack">
            <span>变量</span>
            <select aria-label="条件变量" value={config.variable} onChange={(event) => updateSelectedNodeConfig({ variable: event.target.value })}>
              <option value="">请选择上游变量</option>
              {upstreamVariables.map((variable) => (
                <option key={variable.value} value={variable.value}>
                  {variable.nodeName} / {variable.name} {variable.valueType}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack">
            <span>运算符</span>
            <select aria-label="运算符" value={config.operator} onChange={(event) => updateSelectedNodeConfig({ operator: event.target.value })}>
              <option value="eq">等于</option>
              <option value="neq">不等于</option>
              <option value="contains">包含</option>
              <option value="gt">大于</option>
              <option value="lt">小于</option>
              <option value="empty">为空</option>
              <option value="not_empty">不为空</option>
            </select>
          </label>
          <label className="field-stack">
            <span>比较值</span>
            <input aria-label="比较值" value={config.compareValue} onChange={(event) => updateSelectedNodeConfig({ compareValue: event.target.value })} />
          </label>
          {selectedNode.type === "condition" ? (
            <label className="field-stack">
              <span>默认分支</span>
              <select aria-label="默认分支" value={config.defaultBranch} onChange={(event) => updateSelectedNodeConfig({ defaultBranch: event.target.value })}>
                <option value="default">默认出口</option>
              </select>
            </label>
          ) : (
            <label className="field-stack">
              <span>最大迭代次数</span>
              <input
                aria-label="最大迭代次数"
                max={100}
                min={1}
                type="number"
                value={config.maxIterations}
                onChange={(event) => updateSelectedNodeConfig({ maxIterations: Math.min(100, Math.max(1, Number(event.target.value) || 1)) })}
              />
            </label>
          )}
        </div>
      );
    }

    if (selectedNode.type === "retrieval") {
      return (
        <div className="field-stack">
          <span>知识库</span>
          {knowledgeBases.map((knowledgeBase) => (
            <label className="check-row" key={knowledgeBase.id}>
              <input
                aria-label={knowledgeBase.name}
                checked={knowledgeBaseIds.includes(knowledgeBase.id)}
                onChange={() => toggleKnowledgeBaseId(knowledgeBase.id)}
                type="checkbox"
              />
              {knowledgeBase.name}
            </label>
          ))}
          {knowledgeBases.length === 0 ? <p className="empty-note">暂无可选知识库。</p> : null}
        </div>
      );
    }

    if (selectedNode.type === "llm") {
      const llmConfig = getLlmConfig(selectedNode, modelProviderId);
      const contextOptions = getUpstreamContextOptions(selectedNode);

      return (
        <div className="field-stack llm-config-panel">
          <label className="field-stack workflow-description-field">
            <span>添加描述</span>
            <input
              aria-label="LLM 节点描述"
              onChange={(event) => updateSelectedNodeDescription(event.target.value)}
              placeholder="添加描述..."
              type="text"
              value={selectedNode.description ?? ""}
            />
          </label>
          <label className="field-stack">
            <span>模型配置</span>
            <select aria-label="模型配置" value={llmConfig.modelProviderId} onChange={(event) => updateSelectedLlmConfig({ modelProviderId: event.target.value })}>
              <option value="">请选择模型配置</option>
              {modelProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} / {provider.model}
                </option>
              ))}
            </select>
          </label>
          <section className="llm-context-config">
            <label className="field-stack">
              <span>上下文配置</span>
              <select
                aria-label="上下文配置"
                onChange={(event) => toggleLlmContextVariable(event.target.value)}
                value={llmConfig.contextVariables[0] ?? ""}
              >
                <option value="">不选择上游输出变量</option>
                {contextOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.name} · {option.value}
                  </option>
                ))}
              </select>
            </label>
            {contextOptions.length === 0 ? <p className="empty-note">连接上游节点后可选择上下文变量。</p> : null}
          </section>
          <label className="llm-prompt-card">
            <span>SYSTEM</span>
            <textarea
              aria-label="SYSTEM 提示词"
              onChange={(event) => updateSelectedLlmConfig({ systemPrompt: event.target.value })}
              placeholder="在这里写你的系统提示词，输入 / 可插入变量"
              rows={4}
              value={llmConfig.systemPrompt}
            />
          </label>
          <label className="llm-prompt-card">
            <span>USER</span>
            <textarea
              aria-label="USER 提示词"
              onChange={(event) => updateSelectedLlmConfig({ userPrompt: event.target.value })}
              placeholder="在这里写用户提示词，输入 / 可插入变量"
              rows={4}
              value={llmConfig.userPrompt}
            />
          </label>
          <section className="llm-output-variables" aria-label="输出变量">
            <strong>输出变量</strong>
            <div>
              <span>
                <code>text</code>
                <small>string</small>
              </span>
              <p>生成内容</p>
            </div>
            <div>
              <span>
                <code>reasoning_content</code>
                <small>string</small>
              </span>
              <p>推理内容</p>
            </div>
            <div>
              <span>
                <code>usage</code>
                <small>object</small>
              </span>
              <p>模型用量信息</p>
            </div>
          </section>
          <label className="llm-toggle-row">
            <span>
              <RotateCcw aria-hidden="true" size={14} />
              失败时重试
            </span>
            <span className="llm-switch">
              <input
                aria-label="失败时重试"
                checked={llmConfig.retryOnFailure}
                onChange={(event) => updateSelectedLlmConfig({ retryOnFailure: event.target.checked })}
                role="switch"
                type="checkbox"
              />
              <span aria-hidden="true" />
            </span>
          </label>
        </div>
      );
    }

    if (false && selectedNode.type === "llm") {
      return (
        <div className="field-stack">
          <p className="node-description">{selectedNode.description ?? LLM_DESCRIPTION}</p>
          <label className="field-stack">
            <span>模型 API</span>
            <select aria-label="模型 API" value={modelProviderId} onChange={(event) => setModelProviderId(event.target.value)}>
              <option value="">请选择模型配置</option>
              {modelProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} / {provider.model}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    if (selectedNode.type === "comment") {
      return (
        <div className="run-output workflow-comment-editor">
          <strong>{selectedNode.name}</strong>
          <p>{selectedNode.description}</p>
        </div>
      );
    }

    if (selectedNode.type === "tool") {
      return (
        <div className="run-output">
          <strong>工具节点</strong>
          <p>本轮展示工具节点状态，真实工具绑定和保存将在后端持久化阶段补充。</p>
        </div>
      );
    }

    if (selectedNode.type === "human") {
      return (
        <div className="run-output">
          <strong>人工确认</strong>
          <p>本轮展示人工确认节点，审批人和阻断规则将在后续版本配置。</p>
        </div>
      );
    }

    return (
      <div className="run-output">
        <strong>最终输出</strong>
        <p>{latestRun?.finalOutput ?? "运行调试后展示 finalOutput。"}</p>
      </div>
    );
  }

  return (
    <article className="view-page workflow-page" aria-label="工作流页面">
      <header className="workflow-editor-bar">
        <div>
          <h1>{selectedAgent?.name ?? workflow?.name ?? "工作流配置"}</h1>
          <span>{selectedAgent?.scenario || "配置智能体工作流"}</span>
        </div>
      </header>

      <div className="workflow-editor" aria-label="工作流编辑器" data-canvas-mode={canvasMode} onPointerDownCapture={handleEditorPointerDownCapture}>
        <nav className="workflow-tool-rail" aria-label="画布工具">
          <button aria-label="添加节点" aria-expanded={isNodeMenuOpen} onClick={() => setIsNodeMenuOpen((value) => !value)} title="添加节点" type="button">
            <Plus aria-hidden="true" />
          </button>
          <button aria-label="添加注释框" onClick={handleAddComment} title="添加注释框" type="button">
            <MessageSquarePlus aria-hidden="true" />
          </button>
          <button
            aria-label="指针模式"
            className={canvasMode === "select" ? "active" : undefined}
            onClick={() => setCanvasMode("select")}
            title="指针模式"
            type="button"
          >
            <MousePointer2 aria-hidden="true" />
          </button>
          <button
            aria-label="手模式"
            className={canvasMode === "pan" ? "active" : undefined}
            onClick={() => setCanvasMode("pan")}
            title="手模式"
            type="button"
          >
            <Hand aria-hidden="true" />
          </button>
          <button aria-label="自动整理节点" onClick={handleAutoLayout} title="自动整理节点" type="button">
            <Sparkles aria-hidden="true" />
          </button>
          {isNodeMenuOpen ? (
            <div className="node-add-menu" role="menu">
              <button aria-label="添加 LLM 节点" onClick={handleAddLlmNode} type="button">
                <strong>添加 LLM 节点</strong>
                <span>{LLM_DESCRIPTION}</span>
              </button>
              <button aria-label="添加输出节点" onClick={() => handleAddNode("expose")} type="button">
                <strong>输出</strong>
                <span>配置工作流对外暴露的输出变量</span>
              </button>
              <button aria-label="添加条件节点" onClick={() => handleAddNode("condition")} type="button">
                <strong>条件</strong>
                <span>根据上游变量选择执行分支</span>
              </button>
              <button aria-label="添加循环节点" onClick={() => handleAddNode("loop")} type="button">
                <strong>循环</strong>
                <span>按条件重复执行并限制迭代次数</span>
              </button>
            </div>
          ) : null}
        </nav>
        {layoutMessage ? <p className="workflow-layout-toast">{layoutMessage}</p> : null}

        <section className="workflow-canvas" aria-label="工作流画布">
          <div className="workflow-canvas-actions" aria-label="画布运行操作">
            <button aria-label="测试运行" className="workflow-run-button" onClick={handleOpenPreview} type="button">
              <span aria-hidden="true">▷</span>
              测试运行
            </button>
            <button aria-label="发布" className="workflow-publish-button" type="button">发布</button>
          </div>
          <ReactFlow
            connectOnClick={false}
            connectionLineStyle={{ stroke: "#2563eb", strokeWidth: 2.4 }}
            connectionLineType={ConnectionLineType.Bezier}
            connectionRadius={32}
            deleteKeyCode={null}
            fitView
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            nodesDraggable={canvasMode === "select"}
            nodesConnectable={canvasMode === "select"}
            elementsSelectable={canvasMode === "select"}
            onConnect={handleConnect}
            onEdgesChange={handleEdgesChange}
            onInit={setReactFlowInstance}
            onNodeClick={(_, node) => handleSelectNode(node.id)}
            onNodesChange={handleNodesChange}
            onPaneClick={handleCanvasClick}
            onPaneMouseLeave={() => setPlacementPreviewPosition(null)}
            onPaneMouseMove={handleCanvasMouseMove}
            panOnDrag={canvasMode === "pan"}
            zoomOnScroll
            minZoom={0.35}
            maxZoom={1.6}
          >
            <Background gap={18} size={1.1} color="#d9dee9" />
            <MiniMap pannable zoomable nodeColor="#8b94a8" />
            <Controls showInteractive={false} />
          </ReactFlow>
          {pendingPlacement && placementPreviewPosition ? (
            <div
              aria-label={`待放置${pendingPlacement === "llm" ? " LLM 节点" : pendingPlacement === "comment" ? "注释框" : pendingPlacement === "expose" ? "输出节点" : pendingPlacement === "condition" ? "条件节点" : "循环节点"}`}
              className={`workflow-placement-preview workflow-placement-preview-${pendingPlacement}`}
              style={{ left: placementPreviewPosition.x, top: placementPreviewPosition.y }}
            >
              <strong>
                {pendingPlacement === "llm"
                  ? `LLM ${nodes.filter((node) => node.type === "llm").length + 1}`
                  : pendingPlacement === "comment"
                    ? "注释"
                    : pendingPlacement === "expose"
                      ? "输出"
                      : pendingPlacement === "condition"
                        ? "条件"
                        : "循环"}
              </strong>
              <span>{pendingPlacement === "llm" ? LLM_DESCRIPTION : "点击画布完成放置。"}</span>
            </div>
          ) : null}
        </section>

        {isPreviewOpen ? (
          <aside className="inspector-panel workflow-preview-panel" aria-label="测试预览">
            <header className="workflow-preview-header">
              <h2>预览</h2>
              <button aria-label="关闭预览" className="inspector-close" onClick={handleClosePreview} title="关闭预览" type="button">
                <X aria-hidden="true" />
              </button>
            </header>

            <div aria-label="对话消息" className="workflow-preview-messages">
              {previewMessages.length === 0 ? (
                <div className="workflow-preview-empty">
                  <Bot aria-hidden="true" />
                  <p>填写下方内容，开始测试工作流。</p>
                </div>
              ) : (
                previewMessages.map((message) => (
                  <div className={`workflow-preview-message ${message.role}`} key={message.id}>
                    {(message.content || "正在生成...").split("\n").map((line, index) => <p key={`${message.id}-${index}`}>{line}</p>)}
                  </div>
                ))
              )}
            </div>

            <form className="workflow-preview-composer" onSubmit={handleRunDebug}>
              <div className="workflow-preview-fields">
                {previewInputFields.map((field) => (
                  <label className="workflow-preview-field" key={field.id}>
                    <span>{field.label}{field.required ? <em>必填</em> : null}</span>
                    {field.kind === "text" ? (
                      <textarea
                        aria-label={field.label}
                        onChange={(event) => setPreviewTextValues((values) => ({ ...values, [field.id]: event.target.value }))}
                        placeholder={`请输入${field.label}`}
                        rows={2}
                        value={previewTextValues[field.id] ?? ""}
                      />
                    ) : (
                      <input
                        aria-label={field.label}
                        multiple={field.kind === "file[]"}
                        onChange={(event) => setPreviewFileValues((values) => ({
                          ...values,
                          [field.id]: Array.from(event.target.files ?? [])
                        }))}
                        type="file"
                      />
                    )}
                  </label>
                ))}
              </div>
              <button aria-label="发送" className="workflow-preview-send" disabled={!isPreviewReady || isPreviewStreaming || !workflow} type="submit">
                {isPreviewStreaming ? "生成中..." : "发送"}
              </button>
            </form>
          </aside>
        ) : null}

        {isInspectorOpen ? (
          <aside className="inspector-panel" aria-label="节点配置">
            <button aria-label="关闭节点配置" className="inspector-close" onClick={() => setIsInspectorOpen(false)} title="关闭节点配置" type="button">
              <X aria-hidden="true" />
            </button>
            <div className="inspector-content">
              <div className="inspector-section">
                <h2>
                  {selectedNode?.type === "trigger"
                    ? "用户输入"
                    : selectedNode?.type === "llm" || selectedNode?.type === "expose"
                      ? selectedNode.name
                      : `配置：${selectedNode?.name ?? "未选择节点"}`}
                </h2>
                {selectedNode?.type === "trigger" || selectedNode?.type === "expose" ? null : <span>{selectedNode?.type ?? "node"}</span>}
                {renderNodeInspector()}
              </div>

              {selectedNode?.type === "trigger" || selectedNode?.type === "llm" || selectedNode?.type === "expose" ? null : (
                <>
                  <KeyValueList
                    items={[
                      ["选中节点", selectedNode?.name ?? "未选择"],
                      ["模型", selectedModel ? selectedModel.model : "未选择"],
                      ["知识库数量", String(knowledgeBaseIds.length)],
                      ["最新运行", latestRun ? latestRun.id : "等待运行调试"],
                      ["输出", latestRun?.finalOutput ? "已生成 finalOutput" : "运行调试后生成 finalOutput"]
                    ]}
                  />
                  {latestRun?.finalOutput ? (
                    <div className="run-output">
                      <strong>智能体调用结果</strong>
                      <p>{latestRun.finalOutput}</p>
                      <span>{failedStep ? `失败步骤：${failedStep.title}` : "全部步骤通过"}</span>
                    </div>
                  ) : null}
                </>
              )}
              {previewStreamError ? <p className="inline-error">运行调试失败，请检查模型 API 配置。</p> : null}
              {updateWorkflow.isError ? <p className="inline-error">保存失败，请稍后重试。</p> : null}
            </div>
          </aside>
        ) : null}
      </div>
    </article>
  );
}
