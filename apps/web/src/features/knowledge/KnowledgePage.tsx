import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useKnowledgeBases } from "./useKnowledgeBases";

export function KnowledgePage() {
  const knowledgeQuery = useKnowledgeBases();
  const knowledgeBases = knowledgeQuery.data ?? [];

  return (
    <PageScaffold title="知识库" description="管理可检索内容、索引状态和检索策略。页面只保留资产表和处理流水线。">
      <div className="grid-two">
        <Panel title="知识资产" meta={<StatusPill>平台资源</StatusPill>} strong>
          <SimpleTable
            columns={["名称", "来源", "文档", "检索策略", "质量", "状态"]}
            rows={(knowledgeBases.length
              ? knowledgeBases
              : [
                  {
                    id: "kb-fallback",
                    name: "售后政策库",
                    source: "上传文档 + 飞书同步",
                    documentCount: 128,
                    retrievalStrategy: "Hybrid + Rerank",
                    qualityScore: 92,
                    status: "ready" as const
                  }
                ]
            ).map((item) => [
              item.name,
              item.source,
              item.documentCount,
              item.retrievalStrategy,
              item.qualityScore,
              <StatusPill key={item.id} tone={item.status === "ready" ? "ok" : "warn"}>
                {item.status}
              </StatusPill>
            ])}
          />
        </Panel>
        <Panel title="处理流水线">
          <div className="timeline-list">
            {["文档解析", "清洗去重", "语义切分", "Embedding", "Hybrid Search", "Rerank"].map((step, index) => (
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
