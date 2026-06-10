import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";

export function KnowledgePage() {
  return (
    <PageScaffold
      eyebrow="构建 / Knowledge"
      title="知识库与 RAG Pipeline"
      description="把文档解析、清洗、语义切分、Embedding、Hybrid Search、Rerank 和引用预览做成可治理流水线。"
    >
      <div className="grid-two">
        <Panel title="知识资产" meta={<StatusPill>平台级资源</StatusPill>} strong>
          <SimpleTable
            columns={["名称", "来源", "文档", "检索策略", "质量", "状态"]}
            rows={[
              ["售后政策库", "上传 + 飞书预留", "128", "Hybrid + Rerank", "92", <StatusPill tone="ok">ready</StatusPill>],
              ["质保条款库", "PDF", "42", "Vector", "78", <StatusPill tone="warn">stale</StatusPill>],
              ["工单历史库", "API", "8,420", "Keyword + Vector", "83", <StatusPill tone="ok">ready</StatusPill>]
            ]}
          />
        </Panel>
        <Panel title="处理流水线">
          <div className="timeline-list">
            {["解析 DeepDoc / OCR / 表格", "清洗与去重", "语义切分 18,420 chunks", "Embedding", "Hybrid Search", "Rerank 阈值校准"].map((step, index) => (
              <div className="timeline-item" key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageScaffold>
  );
}
