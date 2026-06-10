import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useTools } from "./useTools";

export function ToolsPage() {
  const toolsQuery = useTools();
  const tools = toolsQuery.data ?? [];

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
            rows={(tools.length ? tools : [
              {
                id: "tool-create-ticket",
                name: "create_ticket",
                type: "mcp" as const,
                credential: "ticket-prod",
                permission: "Developer + Operator",
                health: "degraded" as const,
                lastCalledAt: "10 分钟前"
              }
            ]).map((tool) => [
              tool.name,
              tool.type.toUpperCase(),
              tool.credential,
              tool.permission,
              <StatusPill key={tool.id} tone={tool.health === "online" ? "ok" : tool.health === "degraded" ? "bad" : "warn"}>
                {tool.health}
              </StatusPill>,
              tool.lastCalledAt
            ])}
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
