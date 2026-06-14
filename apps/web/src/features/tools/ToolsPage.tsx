import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useCreateModelProvider } from "./useCreateModelProvider";
import { useModelProviders } from "./useModelProviders";
import { useTools } from "./useTools";

export function ToolsPage() {
  const toolsQuery = useTools();
  const modelProvidersQuery = useModelProviders();
  const createModelProvider = useCreateModelProvider();
  const tools = toolsQuery.data ?? [];
  const modelProviders = modelProvidersQuery.data ?? [];

  function handleCreateDemoProvider() {
    createModelProvider.mutate({
      name: "Canvas demo model",
      providerType: "openai-compatible",
      baseUrl: "mock://local",
      model: "local-smoke",
      apiKey: "sk-local",
      isDefault: modelProviders.length === 0
    });
  }

  return (
    <PageScaffold
      title="工具"
      description="统一管理 MCP Server、API Tool、模型 API、凭据、权限和健康状态。"
      actions={
        <button className="btn primary" disabled={createModelProvider.isPending} onClick={handleCreateDemoProvider} type="button">
          {createModelProvider.isPending ? "保存中..." : "添加模型配置"}
        </button>
      }
    >
      <Panel title="模型 API 配置" meta={<StatusPill tone={modelProviders.length ? "ok" : "warn"}>{modelProviders.length} 个配置</StatusPill>} strong>
        <SimpleTable
          columns={["名称", "协议", "Base URL", "模型", "密钥", "状态", "默认"]}
          rows={modelProviders.map((provider) => [
            provider.name,
            provider.providerType,
            provider.baseUrl,
            provider.model,
            provider.apiKeyPreview,
            <StatusPill key={provider.id} tone={provider.status === "online" ? "ok" : "warn"}>
              {provider.status}
            </StatusPill>,
            provider.isDefault ? "是" : "否"
          ])}
        />
      </Panel>

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
