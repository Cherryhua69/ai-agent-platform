import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";

export function StrategyPage() {
  return (
    <PageScaffold
      eyebrow="策略 / Competitive Landscape"
      title="竞品能力对标"
      description="沉淀 Dify、Coze、Flowise、Langflow、RAGFlow、AnythingLLM、n8n 的能力边界，明确本项目 MVP 取舍。"
    >
      <Panel title="能力矩阵" strong>
        <SimpleTable
          columns={["产品", "优势", "短板", "本项目策略"]}
          rows={[
            ["Dify", "Workflow、RAG、应用发布成熟", "企业审计与门禁需增强", <StatusPill>吸收主闭环</StatusPill>],
            ["Coze", "插件生态与模板丰富", "私有化治理弱", <StatusPill tone="warn">强化治理</StatusPill>],
            ["Flowise", "Agentflow 和可视化编排强", "生产级发布门禁不足", <StatusPill>强化发布</StatusPill>],
            ["RAGFlow", "文档解析和检索链路强", "Agent 协作弱", <StatusPill>吸收 RAG</StatusPill>]
          ]}
        />
      </Panel>
      <div className="cards-grid three">
        {["私有化部署优先", "评测门禁前置", "Trace 与审计一体化"].map((item) => (
          <div className="asset-card reveal-item" key={item}>
            <strong>{item}</strong>
            <p>面向企业研发与运营场景，优先保障可控、可解释、可回滚。</p>
          </div>
        ))}
      </div>
    </PageScaffold>
  );
}
