import type { WorkflowEdge, WorkflowInputField, WorkflowNode } from "../../types/domain";

export type WorkflowVariableOption = {
  nodeId: string;
  nodeName: string;
  name: string;
  value: string;
  valueType: "String" | "Object" | "Array[Object]" | "File" | "Array[File]";
};

export type OutputVariable = {
  id: string;
  name: string;
  value: string;
};

function readInputFields(node: WorkflowNode): WorkflowInputField[] {
  return Array.isArray(node.config?.inputFields)
    ? node.config.inputFields.filter(
        (field): field is WorkflowInputField =>
          Boolean(field) && typeof field === "object" && typeof (field as WorkflowInputField).variable === "string"
      )
    : [];
}

export function getDeclaredNodeOutputs(node: WorkflowNode): WorkflowVariableOption[] {
  if (node.type === "trigger") {
    return readInputFields(node).map((field) => ({
      nodeId: node.id,
      nodeName: node.name,
      name: field.label,
      value: field.variable,
      valueType: field.kind === "file[]" ? "Array[File]" : field.kind === "file" ? "File" : "String"
    }));
  }

  if (node.type === "llm") {
    return [
      { nodeId: node.id, nodeName: node.name, name: "text", value: `${node.id}.text`, valueType: "String" },
      { nodeId: node.id, nodeName: node.name, name: "reasoning_content", value: `${node.id}.reasoning_content`, valueType: "String" },
      { nodeId: node.id, nodeName: node.name, name: "usage", value: `${node.id}.usage`, valueType: "Object" }
    ];
  }

  if (node.type === "retrieval") {
    return [{ nodeId: node.id, nodeName: node.name, name: "result", value: `${node.id}.result`, valueType: "Array[Object]" }];
  }

  return [];
}

export function getReachableUpstreamVariables(targetNodeId: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowVariableOption[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incomingByTarget = new Map<string, string[]>();

  for (const edge of edges) {
    incomingByTarget.set(edge.target, [...(incomingByTarget.get(edge.target) ?? []), edge.source]);
  }

  const visited = new Set<string>([targetNodeId]);
  const variables: WorkflowVariableOption[] = [];

  function visit(nodeId: string) {
    for (const sourceId of incomingByTarget.get(nodeId) ?? []) {
      if (visited.has(sourceId)) {
        continue;
      }
      visited.add(sourceId);
      const source = nodeById.get(sourceId);
      if (!source) {
        continue;
      }
      variables.push(...getDeclaredNodeOutputs(source));
      visit(sourceId);
    }
  }

  visit(targetNodeId);
  return variables;
}

export function getOutputVariables(node: WorkflowNode | undefined): OutputVariable[] {
  if (node?.type !== "expose" || !Array.isArray(node.config?.outputVariables)) {
    return [];
  }

  return node.config.outputVariables.map((item, index) => {
    const value = item && typeof item === "object" ? (item as Partial<OutputVariable>) : {};
    return {
      id: typeof value.id === "string" && value.id ? value.id : `output-${index}`,
      name: typeof value.name === "string" ? value.name : "",
      value: typeof value.value === "string" ? value.value : ""
    };
  });
}

export function getWorkflowValidationError(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const exposes = nodes.filter((node) => node.type === "expose");

  for (const expose of exposes) {
    const outputs = getOutputVariables(expose);
    if (outputs.length === 0) {
      return `输出节点“${expose.name}”至少需要配置一个输出变量`;
    }
    const names = outputs.map((item) => item.name.trim());
    if (outputs.some((item) => !item.name.trim() || !item.value.trim()) || new Set(names).size !== names.length) {
      return `输出节点“${expose.name}”的变量名称和值不能为空，且名称必须唯一`;
    }
    const reachableValues = new Set(getReachableUpstreamVariables(expose.id, nodes, edges).map((item) => item.value));
    const unreachable = outputs.find((item) => !reachableValues.has(item.value));
    if (unreachable) {
      return `输出节点“${expose.name}”引用了不可达变量 ${unreachable.value}`;
    }
  }

  if (nodes.filter((node) => node.type === "trigger").length !== 1) {
    return "工作流必须恰好包含一个开始节点";
  }
  if (exposes.length !== 1) {
    return "工作流必须恰好一个输出节点";
  }
  if (edges.some((edge) => edge.source === exposes[0].id)) {
    return `输出节点“${exposes[0].name}”不能有出边`;
  }

  for (const node of nodes) {
    const handles = new Set(edges.filter((edge) => edge.source === node.id).map((edge) => edge.sourceHandle).filter(Boolean));
    if (node.type === "condition") {
      const defaultBranch = typeof node.config?.defaultBranch === "string" && node.config.defaultBranch ? node.config.defaultBranch : "default";
      if (!handles.has("true")) {
        return `条件节点“${node.name}”缺少 true 分支出边`;
      }
      if (!handles.has(defaultBranch)) {
        return `条件节点“${node.name}”缺少 ${defaultBranch} 分支出边`;
      }
    }
    if (node.type === "loop") {
      if (!handles.has("continue")) {
        return `循环节点“${node.name}”缺少 continue 分支出边`;
      }
      if (!handles.has("exit")) {
        return `循环节点“${node.name}”缺少 exit 分支出边`;
      }
    }
  }

  return "";
}
