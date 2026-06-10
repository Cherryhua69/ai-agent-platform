import { PageScaffold, StatusPill } from "../shared/ViewBlocks";

const templates = ["客服售后 Agent", "合同审阅 Flow", "数据查询助手", "知识库导入流水线", "MCP 工具包", "发布门禁模板"];

export function MarketplacePage() {
  return (
    <PageScaffold
      eyebrow="资产 / Template Market"
      title="模板市场"
      description="将 Agent、Flow、Prompt、知识导入和发布配置打包复用。"
    >
      <div className="cards-grid three">
        {templates.map((template, index) => (
          <div className="asset-card reveal-item" key={template}>
            <strong>{template}</strong>
            <p>内置可复用配置，覆盖知识、工具、评测和发布门禁。</p>
            <StatusPill tone={index === 2 ? "warn" : "info"}>{index === 0 ? "推荐" : "模板"}</StatusPill>
          </div>
        ))}
      </div>
    </PageScaffold>
  );
}
