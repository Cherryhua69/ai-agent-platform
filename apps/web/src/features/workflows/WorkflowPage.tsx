import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Bot, FileInput, Hand, Home, MessageSquarePlus, MousePointer2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
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
import { useSimulateAgentRun } from "../agents/useSimulateAgentRun";
import { useKnowledgeBases } from "../knowledge/useKnowledgeBases";
import { KeyValueList } from "../shared/ViewBlocks";
import { useModelProviders } from "../tools/useModelProviders";
import { useCanvasConfig } from "./useCanvasConfig";
import { useUpdateWorkflow } from "./useUpdateWorkflow";
import { useWorkflows } from "./useWorkflows";

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
type PendingPlacement = "llm" | "comment" | null;

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
    comment: "注释"
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
  onDelete: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
};

function WorkflowFlowNode({ data }: { data: WorkflowFlowNodeData }) {
  const { node, canDelete, modelLabel, onDelete, onSelect } = data;
  const inputFields = node.type === "trigger" ? getInputFields(node) : [];

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

  function handleCommentKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect();
    }
  }

  if (node.type === "comment") {
    return (
      <div
        className="workflow-comment-node"
        data-workflow-node-id={node.id}
        onClick={handleSelect}
        onKeyDown={handleCommentKeyDown}
        onPointerDown={handlePointerSelect}
        role="button"
        tabIndex={0}
      >
        {canDelete ? (
          <button aria-label="删除节点" className="workflow-node-delete" onClick={handleDelete} title="删除" type="button">
            ×
          </button>
        ) : null}
        <strong>{node.name}</strong>
        <p>{node.description ?? "记录这个流程分支的说明。"}</p>
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
          {node.type === "trigger" || node.type === "llm" ? (
            <span className="workflow-node-icon" aria-hidden="true">
              {node.type === "trigger" ? <Home size={13} /> : <Bot size={13} />}
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
        ) : (
          <span>{node.description ?? getNodeTypeLabel(node.type)}</span>
        )}
      </button>
      {canDelete ? (
        <button aria-label="删除节点" className="workflow-node-delete" onClick={handleDelete} title="删除" type="button">
          ×
        </button>
      ) : null}
      <Handle className="workflow-handle workflow-handle-right" id="right" position={Position.Right} style={{ zIndex: 3 }} type="source" />
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

function createFlowNodes(
  nodes: WorkflowNode[],
  selectedNodeId: string,
  latestRun: RunTrace | null,
  onDeleteNode: (nodeId: string) => void = () => undefined,
  onSelectNode: (nodeId: string) => void = () => undefined,
  currentNodes: Node[] = [],
  modelProviders: ModelProvider[] = [],
  fallbackModelProviderId = ""
): Node[] {
  return nodes.map((node, index) => {
    const status = getRunStatus(node, latestRun);
    const isComment = node.type === "comment";
    const existingNode = currentNodes.find((currentNode) => currentNode.id === node.id);

    return {
      id: node.id,
      type: "workflow",
      position: existingNode?.position ?? nodePositions[index] ?? { x: 220 + index * 280, y: 220 + (index % 2) * 130 },
      width: isComment ? 260 : flowNodeSize.width,
      height: isComment ? 140 : flowNodeSize.height,
      measured: isComment ? { width: 260, height: 140 } : flowNodeSize,
      style: { position: "absolute" },
      data: {
        node,
        status,
        canDelete: !isDefaultUserInputNode(node),
        modelLabel: node.type === "llm" ? getModelLabel(modelProviders, getLlmConfig(node, fallbackModelProviderId).modelProviderId) : undefined,
        onDelete: onDeleteNode,
        onSelect: onSelectNode
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
  const simulateAgentRun = useSimulateAgentRun();
  const updateWorkflow = useUpdateWorkflow();
  const modelProviders = modelProvidersQuery.data ?? emptyModelProviders;
  const knowledgeBases = knowledgeBasesQuery.data ?? emptyKnowledgeBases;
  const {
    selectedAgentId,
    selectedWorkflowId,
    selectedNodeId,
    modelProviderId,
    knowledgeBaseIds,
    userInput,
    setSelectedNodeId,
    setModelProviderId,
    toggleKnowledgeBaseId,
    latestRun,
    setLatestRun
  } = useCanvasConfig();
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("select");
  const [isNodeMenuOpen, setIsNodeMenuOpen] = useState(false);
  const [localNodes, setLocalNodes] = useState<WorkflowNode[]>([]);
  const [removedNodeIds, setRemovedNodeIds] = useState<string[]>([]);
  const [nodeConfigOverrides, setNodeConfigOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const [nodeDescriptionOverrides, setNodeDescriptionOverrides] = useState<Record<string, string>>({});
  const [layoutMessage, setLayoutMessage] = useState("");
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement>(null);
  const [placementPreviewPosition, setPlacementPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isInputTypeMenuOpen, setIsInputTypeMenuOpen] = useState(false);
  const agents = agentsQuery.data ?? emptyAgents;
  const workflows = workflowsQuery.data ?? emptyWorkflows;
  const workflow = workflows.find((item) => item.id === selectedWorkflowId) ?? workflows.find((item) => item.agentId === selectedAgentId) ?? workflows[0];
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents.find((agent) => agent.workflowId === workflow?.id);
  const baseNodes = useMemo(() => ensureUserInputFirst(workflow?.nodes ?? fallbackNodes), [workflow?.nodes]);
  const nodes = useMemo(
    () =>
      [...baseNodes, ...localNodes]
        .filter((node) => !removedNodeIds.includes(node.id))
        .map((node) => ({
          ...node,
          description: nodeDescriptionOverrides[node.id] ?? node.description,
          config: {
            ...(node.config ?? {}),
            ...(nodeConfigOverrides[node.id] ?? {})
          }
        })),
    [baseNodes, localNodes, nodeConfigOverrides, nodeDescriptionOverrides, removedNodeIds]
  );
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setIsInspectorOpen(true);
    },
    [setSelectedNodeId]
  );
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(
    createFlowNodes(nodes, selectedNode?.id ?? "", latestRun, undefined, handleSelectNode, [], modelProviders, modelProviderId)
  );
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>(createFlowEdges(workflow?.edges));

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
      createFlowNodes(nodes, selectedNode?.id ?? "", latestRun, handleDeleteNode, handleSelectNode, currentNodes, modelProviders, modelProviderId)
    );
  }, [handleDeleteNode, handleSelectNode, latestRun, modelProviderId, modelProviders, nodes, selectedNode?.id, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(createFlowEdges(workflow?.edges));
  }, [setFlowEdges, workflow?.edges, workflow?.id]);

  const selectedLlmConfig = selectedNode?.type === "llm" ? getLlmConfig(selectedNode, modelProviderId) : null;
  const selectedModel = modelProviders.find((provider) => provider.id === (selectedLlmConfig?.modelProviderId || modelProviderId));
  const failedStep = latestRun?.steps.find((step) => step.status === "failed");

  function handleRunDebug() {
    simulateAgentRun.mutate(
      {
        agentId: workflow?.agentId ?? "agent-after-sale",
        userInput,
        modelProviderId: modelProviderId || undefined,
        knowledgeBaseIds
      },
      {
        onSuccess: (run) => setLatestRun(run)
      }
    );
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
    return node.config ?? {};
  }

  function handleSaveWorkflow() {
    if (!workflow) {
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
        onSuccess: () => setLayoutMessage("已保存工作流配置")
      }
    );
  }

  function handleAddLlmNode() {
    setPendingPlacement("llm");
    setPlacementPreviewPosition(null);
    setIsNodeMenuOpen(false);
    setCanvasMode("select");
    setLayoutMessage("点击画布放置 LLM 节点");
  }

  function getUpstreamContextOptions(node: WorkflowNode) {
    const directSourceIds = flowEdges.filter((edge) => edge.target === node.id).map((edge) => edge.source);
    const candidates = nodes.filter((item) => directSourceIds.includes(item.id));

    return candidates
      .filter((item) => item.id !== node.id && item.type !== "comment")
      .flatMap((item) => {
        if (item.type === "trigger") {
          return getInputFields(item).map((field) => ({
            label: field.label,
            variable: field.variable
          }));
        }

        return [{ label: `${item.name} 输出`, variable: `${item.id}.text` }];
      });
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
    setPendingPlacement("comment");
    setPlacementPreviewPosition(null);
    setCanvasMode("select");
    setLayoutMessage("点击画布放置注释框");
  }

  function handleAutoLayout() {
    setFlowNodes((currentNodes) =>
      currentNodes.map((node, index) => ({
        ...node,
        position: nodePositions[index] ?? { x: 220 + index * 280, y: 220 + (index % 2) * 130 }
      }))
    );
    setLayoutMessage("已自动整理节点");
  }

  function handleCanvasClick(event: MouseEvent) {
    if (!pendingPlacement) {
      return;
    }

    const isLlm = pendingPlacement === "llm";
    const nodeSize = isLlm ? flowNodeSize : { width: 260, height: 140 };
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
    const nextNode: WorkflowNode = isLlm
      ? {
          id,
          type: "llm",
          name: `LLM ${nodes.filter((node) => node.type === "llm").length + 1}`,
          status: "success",
          description: LLM_DESCRIPTION
        }
      : {
          id,
          type: "comment",
          name: "注释",
          status: "success",
          description: "在这里记录流程说明、测试假设或团队协作备注。"
        };

    setLocalNodes((currentNodes) => [...currentNodes, nextNode]);
    setFlowNodes((currentNodes) => [
      ...currentNodes,
      ...createFlowNodes([nextNode], id, latestRun, undefined, handleSelectNode).map((node) => ({ ...node, position }))
    ]);
    setSelectedNodeId(id);
    setIsInspectorOpen(true);
    setPendingPlacement(null);
    setPlacementPreviewPosition(null);
    setLayoutMessage("");
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
  }

  function updateSelectedNodeDescription(description: string) {
    if (!selectedNode) {
      return;
    }

    setNodeDescriptionOverrides((currentDescriptions) => ({
      ...currentDescriptions,
      [selectedNode.id]: description
    }));
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
                  <option key={option.variable} value={option.variable}>
                    {option.label} · {option.variable}
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
          <p>自动保存 21:13:36 · 未发布</p>
          <h1>{selectedAgent?.name ?? workflow?.name ?? "工作流配置"}</h1>
          <span>{selectedAgent?.scenario || "配置智能体工作流"}</span>
        </div>
        <div className="workflow-editor-actions">
          <button className="btn" disabled={!workflow || updateWorkflow.isPending} onClick={handleSaveWorkflow} type="button">
            {updateWorkflow.isPending ? "保存中..." : "保存"}
          </button>
          <button className="btn primary" disabled={simulateAgentRun.isPending} onClick={handleRunDebug} type="button">
            {simulateAgentRun.isPending ? "运行中..." : "运行调试"}
          </button>
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
            </div>
          ) : null}
        </nav>
        {layoutMessage ? <p className="workflow-layout-toast">{layoutMessage}</p> : null}

        <section className="workflow-canvas" aria-label="工作流画布">
          <ReactFlow
            connectOnClick={false}
            connectionLineStyle={{ stroke: "#2563eb", strokeWidth: 2.4 }}
            connectionLineType={ConnectionLineType.Bezier}
            connectionRadius={32}
            fitView
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            nodesDraggable={canvasMode === "select"}
            nodesConnectable={canvasMode === "select"}
            elementsSelectable={canvasMode === "select"}
            onConnect={handleConnect}
            onEdgesChange={onEdgesChange}
            onInit={setReactFlowInstance}
            onNodeClick={(_, node) => handleSelectNode(node.id)}
            onNodesChange={onNodesChange}
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
              aria-label={pendingPlacement === "llm" ? "待放置 LLM 节点" : "待放置注释框"}
              className={`workflow-placement-preview workflow-placement-preview-${pendingPlacement}`}
              style={{ left: placementPreviewPosition.x, top: placementPreviewPosition.y }}
            >
              <strong>{pendingPlacement === "llm" ? `LLM ${nodes.filter((node) => node.type === "llm").length + 1}` : "注释"}</strong>
              <span>{pendingPlacement === "llm" ? LLM_DESCRIPTION : "记录流程说明、测试假设或协作备注。"}</span>
            </div>
          ) : null}
        </section>

        {isInspectorOpen ? (
          <aside className="inspector-panel" aria-label="节点配置">
            <button aria-label="关闭节点配置" className="inspector-close" onClick={() => setIsInspectorOpen(false)} title="关闭节点配置" type="button">
              <X aria-hidden="true" />
            </button>
            <div className="inspector-section">
              <h2>
                {selectedNode?.type === "trigger"
                  ? "用户输入"
                  : selectedNode?.type === "llm"
                    ? selectedNode.name
                    : `配置：${selectedNode?.name ?? "未选择节点"}`}
              </h2>
              {selectedNode?.type === "trigger" ? null : <span>{selectedNode?.type ?? "node"}</span>}
              {renderNodeInspector()}
            </div>

            {selectedNode?.type === "trigger" || selectedNode?.type === "llm" ? null : (
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
            {simulateAgentRun.isError ? <p className="inline-error">运行调试失败，请检查模型 API 配置。</p> : null}
            {updateWorkflow.isError ? <p className="inline-error">保存失败，请稍后重试。</p> : null}
          </aside>
        ) : null}
      </div>
    </article>
  );
}
