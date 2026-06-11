import { KeyValueList, PageScaffold, Panel, StatusPill } from "../shared/ViewBlocks";
import { useWorkflows } from "./useWorkflows";

export function WorkflowPage() {
  const workflowsQuery = useWorkflows();
  const workflow = workflowsQuery.data?.[0];
  const nodes = workflow?.nodes ?? [
    { id: "node-trigger", type: "trigger", name: "Webhook Trigger", status: "success" },
    { id: "node-retrieval", type: "retrieval", name: "RAG Retrieve", status: "success" },
    { id: "node-llm", type: "llm", name: "LLM Decision", status: "success" },
    { id: "node-tool", type: "tool", name: "create_ticket", status: "failed" },
    { id: "node-human", type: "human", name: "Human Review", status: "warning" }
  ];

  return (
    <PageScaffold
      title="工作流"
      description="保留节点库、画布和属性面板三件核心工具，去掉原型式说明，让编辑器更像真实生产界面。"
      actions={
        <>
          <button className="btn" type="button">
            保存
          </button>
          <button className="btn primary" type="button">
            运行调试
          </button>
        </>
      }
    >
      <Panel
        title={workflow ? `${workflow.name} · ${workflow.nodes.length} 个节点` : "Agentflow 画布"}
        meta={<StatusPill tone={workflow?.toolHealthStatus === "degraded" ? "bad" : "info"}>{workflow?.toolHealthStatus ?? "mock"}</StatusPill>}
        strong
      >
        <div className="workflow-shell">
          <aside className="node-palette">
            {["Trigger", "LLM", "Knowledge", "MCP Tool", "Human Review"].map((node) => (
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
            <KeyValueList
              items={[
                ["选中节点", "RAG Retrieve"],
                ["知识库", "售后政策库"],
                ["检索策略", "Hybrid + Rerank"],
                ["Top K", "5"],
                ["节点数量", String(nodes.length)],
                [
                  "发布影响",
                  <StatusPill key="publish-impact" tone={workflow?.toolHealthStatus === "degraded" ? "bad" : "ok"}>
                    {workflow?.toolHealthStatus === "degraded" ? "下游工具异常" : "可发布"}
                  </StatusPill>
                ]
              ]}
            />
          </aside>
        </div>
      </Panel>
    </PageScaffold>
  );
}
