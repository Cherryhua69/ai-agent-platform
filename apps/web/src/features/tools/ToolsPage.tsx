import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";

export function ToolsPage() {
  return (
    <PageScaffold
      eyebrow="构建 / MCP Tools"
      title="工具与 MCP 生态"
      description="统一治理 MCP Server、API Tool、Trigger、凭据、权限、工具健康和插件市场入口。"
    >
      <div className="grid-two">
        <Panel title="工具目录" meta={<StatusPill tone="warn">4 个风险</StatusPill>} strong>
          <SimpleTable
            columns={["工具", "类型", "凭据", "权限", "健康", "最近调用"]}
            rows={[
              ["create_ticket", "MCP", "ticket-prod", "Developer + Operator", <StatusPill tone="bad">degraded</StatusPill>, "10 分钟前"],
              ["query_order", "API Tool", "order-readonly", "Agent scoped", <StatusPill tone="ok">online</StatusPill>, "2 分钟前"],
              ["refund_request", "API Tool", "refund-write", "Human approve", <StatusPill tone="warn">guarded</StatusPill>, "1 小时前"]
            ]}
          />
        </Panel>
        <Panel title="插件市场与凭据治理">
          <div className="cards-grid two-cols">
            {["企业系统", "MCP Server", "Credentials", "Tool Health"].map((item) => (
              <div className="asset-card" key={item}>
                <strong>{item}</strong>
                <p>统一 schema、权限、凭据轮换和健康状态。</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageScaffold>
  );
}
