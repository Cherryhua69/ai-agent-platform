import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useTools } from "./useTools";

export function ToolsPage() {
  const toolsQuery = useTools();
  const tools = toolsQuery.data ?? [];

  return (
    <PageScaffold title="工具" description="统一管理 MCP Server、API Tool、凭据、权限和健康状态。">
      <Panel title="工具目录" meta={<StatusPill tone="warn">1 个风险</StatusPill>} strong>
        <SimpleTable
          columns={["工具", "类型", "凭据", "权限", "健康", "最近调用"]}
          rows={(tools.length
            ? tools
            : [
                {
                  id: "tool-create-ticket",
                  name: "create_ticket",
                  type: "mcp" as const,
                  credential: "ticket-prod",
                  permission: "Developer + Operator",
                  health: "degraded" as const,
                  lastCalledAt: "10 分钟前"
                }
              ]
          ).map((tool) => [
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
    </PageScaffold>
  );
}
