import { describe, expect, it } from "vitest";
import type { WorkflowEdge, WorkflowNode } from "../../types/domain";
import { getDeclaredNodeOutputs, getOutputVariables, getReachableUpstreamVariables, getWorkflowValidationError } from "./workflowVariables";

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
      { nodeId: "trigger", nodeName: "用户输入", name: "问题", value: "userinput.question", valueType: "String" }
    ]);
    expect(getDeclaredNodeOutputs(nodes[1])).toEqual([
      { nodeId: "retrieval", nodeName: "知识检索", name: "result", value: "retrieval.result", valueType: "Array[Object]" }
    ]);
    expect(getDeclaredNodeOutputs(nodes[2])).toEqual([
      { nodeId: "llm", nodeName: "LLM", name: "text", value: "llm.text", valueType: "String" },
      { nodeId: "llm", nodeName: "LLM", name: "reasoning_content", value: "llm.reasoning_content", valueType: "String" },
      { nodeId: "llm", nodeName: "LLM", name: "usage", value: "llm.usage", valueType: "Object" }
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
    expect(getOutputVariables(nodes[3])).toEqual([{ id: "output-0", name: "answer", value: "llm.text" }]);
    expect(getOutputVariables({ ...nodes[3], config: { outputVariables: [{ name: "", value: "llm.text" }, null] } })).toEqual([
      { id: "output-0", name: "", value: "llm.text" },
      { id: "output-1", name: "", value: "" }
    ]);
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
