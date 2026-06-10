import { KeyValueList, PageScaffold, Panel, StatusPill } from "../shared/ViewBlocks";

export function WorkflowPage() {
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
      <Panel title="Agentflow 画布" strong>
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
            {[
              ["Webhook Trigger", "订单售后事件", "ok"],
              ["RAG Retrieve", "售后政策库 / Hybrid", "info"],
              ["LLM Decision", "分类：自动 / 人工", "ok"],
              ["MCP Tool", "create_ticket timeout", "bad"],
              ["Human Review", "退款金额确认", "warn"]
            ].map(([title, desc, tone], index) => (
              <div className={`workflow-node node-${index + 1}`} key={title}>
                <strong>{title}</strong>
                <span>{desc}</span>
                <StatusPill tone={tone as "ok" | "warn" | "bad" | "info"}>{tone}</StatusPill>
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
                ["发布影响", <StatusPill tone="bad">下游工具异常</StatusPill>]
              ]}
            />
          </aside>
        </div>
      </Panel>
    </PageScaffold>
  );
}
