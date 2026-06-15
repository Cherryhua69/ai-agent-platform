import { useEffect } from "react";
import { useSimulateAgentRun } from "../agents/useSimulateAgentRun";
import { useKnowledgeBases } from "../knowledge/useKnowledgeBases";
import { KeyValueList, PageScaffold, Panel, StatusPill } from "../shared/ViewBlocks";
import { useModelProviders } from "../tools/useModelProviders";
import { useCanvasConfig } from "./useCanvasConfig";
import { useWorkflows } from "./useWorkflows";

export function WorkflowPage() {
  const workflowsQuery = useWorkflows();
  const modelProvidersQuery = useModelProviders();
  const knowledgeBasesQuery = useKnowledgeBases();
  const simulateAgentRun = useSimulateAgentRun();
  const workflow = workflowsQuery.data?.[0];
  const modelProviders = modelProvidersQuery.data ?? [];
  const knowledgeBases = knowledgeBasesQuery.data ?? [];
  const {
    modelProviderId,
    knowledgeBaseIds,
    userInput,
    setModelProviderId,
    toggleKnowledgeBaseId,
    setUserInput,
    latestRun,
    setLatestRun
  } = useCanvasConfig();
  const nodes = workflow?.nodes ?? [
    { id: "node-trigger", type: "trigger", name: "User request", status: "success" },
    { id: "node-retrieval", type: "retrieval", name: "Knowledge retrieval", status: "success" },
    { id: "node-llm", type: "llm", name: "Configured model", status: "success" },
    { id: "node-output", type: "expose", name: "Final answer", status: "success" }
  ];

  useEffect(() => {
    if (!modelProviderId && modelProviders.length > 0) {
      setModelProviderId(modelProviders.find((provider) => provider.isDefault)?.id ?? modelProviders[0].id);
    }
  }, [modelProviderId, modelProviders, setModelProviderId]);

  const selectedModel = modelProviders.find((provider) => provider.id === modelProviderId);
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

  return (
    <PageScaffold
      title="工作流"
      description="在画布中配置智能体运行所需的模型 API、知识库和本次调用输入。"
      actions={
        <>
          <button className="btn" type="button">
            保存
          </button>
          <button className="btn primary" disabled={simulateAgentRun.isPending} onClick={handleRunDebug} type="button">
            {simulateAgentRun.isPending ? "运行中..." : "运行调试"}
          </button>
        </>
      }
    >
      <Panel
        title={workflow ? `${workflow.name} · ${nodes.length} 个节点` : "Agentflow 画布"}
        meta={<StatusPill tone={selectedModel ? "ok" : "warn"}>{selectedModel ? selectedModel.model : "未配置模型"}</StatusPill>}
        strong
      >
        <div className="workflow-shell">
          <aside className="node-palette">
            {["User input", "Knowledge", "Model API", "Final output"].map((node) => (
              <div className="node-item" key={node}>
                <strong>{node}</strong>
                <span>拖入画布创建节点</span>
              </div>
            ))}
          </aside>
          <section className="workflow-canvas" aria-label="工作流画布">
            {nodes.map((node, index) => (
              <div className={`workflow-node node-${index + 1}`} key={node.id}>
                <strong>{node.name}</strong>
                <span>{node.type}</span>
                <StatusPill tone={node.status === "failed" ? "bad" : node.status === "warning" ? "warn" : "ok"}>{node.status}</StatusPill>
              </div>
            ))}
          </section>
          <aside className="inspector-panel">
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

            <div className="field-stack">
              <span>知识库</span>
              {knowledgeBases.map((knowledgeBase) => (
                <label className="check-row" key={knowledgeBase.id}>
                  <input
                    checked={knowledgeBaseIds.includes(knowledgeBase.id)}
                    onChange={() => toggleKnowledgeBaseId(knowledgeBase.id)}
                    type="checkbox"
                  />
                  {knowledgeBase.name}
                </label>
              ))}
            </div>

            <label className="field-stack">
              <span>调用需求</span>
              <textarea aria-label="调用需求" value={userInput} onChange={(event) => setUserInput(event.target.value)} rows={4} />
            </label>

            <KeyValueList
              items={[
                ["选中节点", "Configured model"],
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
            {simulateAgentRun.isError ? <p className="inline-error">运行调试失败，请检查模型 API 配置。</p> : null}
          </aside>
        </div>
      </Panel>
    </PageScaffold>
  );
}
