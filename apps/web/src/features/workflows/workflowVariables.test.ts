import { describe, expect, it } from "vitest";
import type { WorkflowEdge, WorkflowNode } from "../../types/domain";
import {
  getDeclaredNodeOutputs,
  getOutputVariableError,
  getOutputVariables,
  getReachableUpstreamVariables,
  getWorkflowValidationError
} from "./workflowVariables";

describe("workflowVariables", () => {
  const nodes: WorkflowNode[] = [
    {
      id: "trigger",
      type: "trigger",
      name: "用户输入",
      status: "success",
      config: {
        inputFields: [{ id: "question", label: "问题", variable: "userinput.question", kind: "text", required: true }]
      }
    },
    { id: "retrieval", type: "retrieval", name: "知识检索", status: "success" },
    { id: "llm", type: "llm", name: "LLM", status: "success" },
    {
      id: "expose",
      type: "expose",
      name: "输出",
      status: "success",
      config: { outputVariables: [{ name: "answer", value: "llm.text" }] }
    },
    { id: "condition", type: "condition", name: "条件", status: "success" },
    { id: "loop", type: "loop", name: "循环", status: "success" },
    { id: "comment", type: "comment", name: "注释", status: "success" }
  ];

  it("按节点类型声明可用输出", () => {
    expect(getDeclaredNodeOutputs(nodes[0])).toEqual([
      { nodeId: "trigger", nodeName: "用户输入", name: "问题", value: "userinput.question", valueSelector: ["userinput", "question"], valueType: "String" }
    ]);
    expect(getDeclaredNodeOutputs(nodes[1])).toEqual([
      { nodeId: "retrieval", nodeName: "知识检索", name: "result", value: "retrieval.result", valueSelector: ["retrieval", "result"], valueType: "Array[Object]" }
    ]);
    expect(getDeclaredNodeOutputs(nodes[2])).toEqual([
      { nodeId: "llm", nodeName: "LLM", name: "text", value: "llm.text", valueSelector: ["llm", "text"], valueType: "String" },
      { nodeId: "llm", nodeName: "LLM", name: "reasoning_content", value: "llm.reasoning_content", valueSelector: ["llm", "reasoning_content"], valueType: "String" },
      { nodeId: "llm", nodeName: "LLM", name: "usage", value: "llm.usage", valueSelector: ["llm", "usage"], valueType: "Object" }
    ]);
    expect(getDeclaredNodeOutputs(nodes[4])).toEqual([]);
    expect(getDeclaredNodeOutputs(nodes[5])).toEqual([]);
    expect(getDeclaredNodeOutputs(nodes[6])).toEqual([]);
  });

  it("递归收集所有可达上游变量并在环路中终止", () => {
    const edges: WorkflowEdge[] = [
      { id: "e1", source: "trigger", target: "retrieval" },
      { id: "e2", source: "retrieval", target: "llm" },
      { id: "e3", source: "llm", target: "expose" },
      { id: "cycle", source: "expose", target: "retrieval" }
    ];

    expect(getReachableUpstreamVariables("expose", nodes, edges).map((item) => item.value)).toEqual([
      "llm.text",
      "llm.reasoning_content",
      "llm.usage",
      "retrieval.result",
      "userinput.question"
    ]);
  });

  it("解析输出节点的配置草稿", () => {
    expect(getOutputVariables(nodes[3])).toEqual([
      { id: "output-0", name: "answer", valueSelector: ["llm", "text"], valueType: "String" }
    ]);
    expect(getOutputVariables({ ...nodes[3], config: { outputVariables: [
      { id: "usage", name: "usage_tokens", valueSelector: ["llm", "usage", "total_tokens"], valueType: "Number" },
      { name: "", value: "llm.text" },
      null
    ] } })).toEqual([
      { id: "usage", name: "usage_tokens", valueSelector: ["llm", "usage", "total_tokens"], valueType: "Number" },
      { id: "output-1", name: "", valueSelector: ["llm", "text"], valueType: "String" },
      { id: "output-2", name: "", valueSelector: [], valueType: "String" }
    ]);
  });

  it("即时校验输出变量名称、重复项和结构化选择器", () => {
    expect(getOutputVariableError([{ id: "1", name: "bad name", valueSelector: ["llm", "text"], valueType: "String" }])).toContain("字母");
    expect(getOutputVariableError([
      { id: "1", name: "answer", valueSelector: ["llm", "text"], valueType: "String" },
      { id: "2", name: "answer", valueSelector: ["llm", "usage"], valueType: "Object" }
    ])).toContain("重复");
    expect(getOutputVariableError([{ id: "1", name: "answer", valueSelector: [], valueType: "String" }])).toContain("变量值");
    expect(getOutputVariableError([{ id: "1", name: "answer", valueSelector: ["llm", "text"], valueType: "Mystery" }])).toContain("类型");
    expect(getOutputVariableError([{ id: "1", name: "answer_1", valueSelector: ["llm", "text"], valueType: "String" }])).toBe("");
  });

  it("在分支汇合、重复边和断边场景中稳定派生上游变量", () => {
    const graphNodes: WorkflowNode[] = [
      nodes[0],
      { id: "left", type: "llm", name: "左分支", status: "success" },
      { id: "right", type: "retrieval", name: "右分支", status: "success" },
      nodes[3]
    ];
    const graphEdges: WorkflowEdge[] = [
      { id: "a", source: "trigger", target: "left" },
      { id: "a-duplicate", source: "trigger", target: "left" },
      { id: "b", source: "trigger", target: "right" },
      { id: "c", source: "left", target: "expose" },
      { id: "d", source: "right", target: "expose" }
    ];

    const values = getReachableUpstreamVariables("expose", graphNodes, graphEdges).map((item) => item.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toEqual(expect.arrayContaining(["userinput.question", "left.text", "right.result"]));
    expect(getReachableUpstreamVariables("expose", graphNodes, graphEdges.filter((edge) => edge.id !== "c")).map((item) => item.value)).not.toContain("left.text");
  });

  it("校验输出引用和最小图拓扑契约", () => {
    const validNodes: WorkflowNode[] = [nodes[0], nodes[2], nodes[3]];
    const validEdges: WorkflowEdge[] = [
      { id: "trigger-llm", source: "trigger", target: "llm" },
      { id: "llm-expose", source: "llm", target: "expose" }
    ];
    expect(getWorkflowValidationError(validNodes, validEdges)).toBe("");
    expect(getWorkflowValidationError(validNodes, validEdges.filter((edge) => edge.id !== "llm-expose"))).toContain("不可达");
    expect(getWorkflowValidationError(
      [...validNodes, { ...nodes[3], id: "another-expose", name: "另一个输出" }],
      [...validEdges, { id: "llm-another", source: "llm", target: "another-expose" }]
    )).toContain("恰好一个输出节点");
    expect(getWorkflowValidationError(validNodes, [...validEdges, { id: "bad", source: "expose", target: "llm" }])).toContain("不能有出边");
    expect(getWorkflowValidationError([
      nodes[0],
      nodes[2],
      { ...nodes[3], config: { outputVariables: [{ name: "bad name", valueSelector: ["llm", "text"], valueType: "String" }] } }
    ], validEdges)).toContain("字母");

    const condition = { ...nodes[4], config: { defaultBranch: "default" } };
    const conditionOutput = { ...nodes[3], config: { outputVariables: [{ name: "answer", value: "userinput.question" }] } };
    expect(getWorkflowValidationError([nodes[0], condition, conditionOutput], [
      { id: "in", source: "trigger", target: "condition" },
      { id: "true", source: "condition", target: "expose", sourceHandle: "true" }
    ])).toContain("default");

    const loop = { ...nodes[5], config: { maxIterations: 10 } };
    const loopOutput = { ...nodes[3], config: { outputVariables: [{ name: "answer", value: "userinput.question" }] } };
    expect(getWorkflowValidationError([nodes[0], loop, loopOutput], [
      { id: "in", source: "trigger", target: "loop" },
      { id: "continue", source: "loop", target: "loop", sourceHandle: "continue" },
      { id: "other", source: "loop", target: "expose", sourceHandle: "other" }
    ])).toContain("exit");
  });
});
