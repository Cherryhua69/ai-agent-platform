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
      eyebrow="构建 / Flow Builder"
      title="工作流编排"
      description="支持 Agentflow、Chatflow、RAG Pipeline、触发器和 Human in the Loop，并可暴露为 API 或 MCP Server。"
      actions={
        <>
          <button className="btn" type="button">保存 Flow</button>
          <button className="btn primary" type="button">运行调试</button>
        </>
      }
    >
      <Panel
        title={workflow ? `${workflow.name}（${workflow.nodes.length} 个节点）` : "Agentflow 画布"}
        meta={<StatusPill tone={workflow?.toolHealthStatus === "degraded" ? "bad" : "info"}>{workflow?.toolHealthStatus ?? "mock"}</StatusPill>}
        strong
      >
        <div className="workflow-shell">
          <aside className="node-palette">
            {["Trigger", "LLM", "Knowledge Retrieval", "MCP Tool", "Human Review", "Expose"].map((node) => (
              <div className="node-item" key={node}>
                <strong>{node}</strong>
                <span>可拖入编排画布</span>
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
                ["节点", "RAG Retrieve"],
                ["知识库", "售后政策库"],
                ["检索策略", "Hybrid + Rerank"],
                ["Top K", "5"],
                ["节点数量", String(nodes.length)],
                ["发布影响", <StatusPill tone={workflow?.toolHealthStatus === "degraded" ? "bad" : "ok"}>{workflow?.toolHealthStatus === "degraded" ? "下游工具异常" : "可发布"}</StatusPill>]
              ]}
            />
          </aside>
        </div>
      </Panel>
    </PageScaffold>
  );
}
