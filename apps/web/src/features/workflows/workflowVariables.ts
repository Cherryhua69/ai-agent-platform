import type { WorkflowEdge, WorkflowInputField, WorkflowNode } from "../../types/domain";

export type WorkflowVariableOption = {
  nodeId: string;
  nodeName: string;
  name: string;
  value: string;
  valueSelector: string[];
  valueType: string;
};

export type OutputVariable = {
  id: string;
  name: string;
  valueSelector: string[];
  valueType: string;
};

const OUTPUT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const OUTPUT_VALUE_TYPES = new Set([
  "String", "Number", "Boolean", "Object", "File",
  "Array[String]", "Array[Number]", "Array[Boolean]", "Array[Object]", "Array[File]"
]);

export function outputSelectorToValue(valueSelector: string[]): string {
  return valueSelector.join(".");
}

function legacyValueType(valueSelector: string[]): string {
  const field = valueSelector[1] ?? "";
  if (field === "usage") return "Object";
  if (field === "result") return "Array[Object]";
  return "String";
}

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
      valueSelector: ["userinput", field.variable.split(".").at(-1) ?? field.variable],
      valueType: field.kind === "file[]" ? "Array[File]" : field.kind === "file" ? "File" : "String"
    }));
  }

  if (node.type === "llm") {
    return [
      { nodeId: node.id, nodeName: node.name, name: "text", value: `${node.id}.text`, valueSelector: [node.id, "text"], valueType: "String" },
      { nodeId: node.id, nodeName: node.name, name: "reasoning_content", value: `${node.id}.reasoning_content`, valueSelector: [node.id, "reasoning_content"], valueType: "String" },
      { nodeId: node.id, nodeName: node.name, name: "usage", value: `${node.id}.usage`, valueSelector: [node.id, "usage"], valueType: "Object" }
    ];
  }

  if (node.type === "retrieval") {
    return [{ nodeId: node.id, nodeName: node.name, name: "result", value: `${node.id}.result`, valueSelector: [node.id, "result"], valueType: "Array[Object]" }];
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
    const value = item && typeof item === "object"
      ? (item as Partial<OutputVariable> & { value?: unknown })
      : {};
    const valueSelector = Array.isArray(value.valueSelector)
      ? value.valueSelector.filter((part): part is string => typeof part === "string" && Boolean(part))
      : typeof value.value === "string" && value.value
        ? value.value.split(".").filter(Boolean)
        : [];
    return {
      id: typeof value.id === "string" && value.id ? value.id : `output-${index}`,
      name: typeof value.name === "string" ? value.name : "",
      valueSelector,
      valueType: typeof value.valueType === "string" && value.valueType ? value.valueType : legacyValueType(valueSelector)
    };
  });
}

export function getOutputVariableError(outputs: OutputVariable[]): string {
  if (outputs.length === 0) return "至少需要配置一个输出变量";
  if (outputs.some((item) => !item.name.trim())) return "输出变量名称不能为空";
  if (outputs.some((item) => !OUTPUT_NAME_PATTERN.test(item.name.trim()))) return "输出变量名称只能包含字母、数字和下划线，且不能以数字开头";
  const names = outputs.map((item) => item.name.trim());
  if (new Set(names).size !== names.length) return "输出变量名称不能重复";
  if (outputs.some((item) => item.valueSelector.length < 2)) return "输出变量值不能为空";
  if (outputs.some((item) => !OUTPUT_VALUE_TYPES.has(item.valueType))) return "输出变量类型不受支持";
  return "";
}

export function getWorkflowValidationError(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const exposes = nodes.filter((node) => node.type === "expose");

  for (const expose of exposes) {
    const outputs = getOutputVariables(expose);
    const outputError = getOutputVariableError(outputs);
    if (outputError) return `输出节点“${expose.name}”${outputError}`;
    const reachableValues = new Set(getReachableUpstreamVariables(expose.id, nodes, edges).map((item) => item.value));
    const unreachable = outputs.find((item) => !reachableValues.has(outputSelectorToValue(item.valueSelector.slice(0, 2))));
    if (unreachable) {
      return `输出节点“${expose.name}”引用了不可达变量 ${outputSelectorToValue(unreachable.valueSelector)}`;
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
