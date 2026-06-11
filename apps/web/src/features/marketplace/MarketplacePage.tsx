import { PageScaffold, StatusPill } from "../shared/ViewBlocks";

const templates = ["售后政策 Agent", "合同审阅 Flow", "知识库导入流水线", "MCP 工具包"];

export function MarketplacePage() {
  return (
    <PageScaffold title="模板" description="模板不再作为重点页面，只保留少量可复用入口，避免旧原型的内容堆叠。">
      <div className="cards-grid two-cols">
        {templates.map((template, index) => (
          <div className="asset-card reveal-item" key={template}>
            <strong>{template}</strong>
            <p>内置基础配置，可在创建智能体或工作流时复用。</p>
            <StatusPill tone={index === 0 ? "ok" : "info"}>{index === 0 ? "推荐" : "模板"}</StatusPill>
          </div>
        ))}
      </div>
    </PageScaffold>
  );
}
