import { KeyValueList, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useReleaseGates } from "./useReleaseGates";

export function ReleasePage() {
  const gatesQuery = useReleaseGates();
  const gate = gatesQuery.data?.[0];
  const reasons = gate?.reasons ?? ["工具健康异常：create_ticket degraded", "关键评测用例失败"];

  return (
    <PageScaffold
      title="发布"
      description="只保留发布渠道、门禁状态和阻断原因，帮助判断能不能上线。"
      actions={
        <>
          <button className="btn" type="button">
            发布检查
          </button>
          <button className="btn primary" type="button">
            发布测试环境
          </button>
        </>
      }
    >
      <div className="grid-two">
        <Panel title="渠道配置" meta={<StatusPill tone="warn">待检查</StatusPill>} strong>
          <SimpleTable
            columns={["渠道", "路径 / 入口", "认证", "状态"]}
            rows={[
              ["API", "/api/agents/after-sale/run", "API Key", <StatusPill key="api" tone="warn">待发布</StatusPill>],
              ["Web Chat", "/chat/after-sale", "Workspace", <StatusPill key="web" tone="ok">published</StatusPill>],
              ["Embedded Chatbot", "script snippet", "Domain allowlist", <StatusPill key="embed">ready</StatusPill>],
              ["MCP Server", "after-sale-flow as tools", "OAuth 预留", <StatusPill key="mcp">draft</StatusPill>]
            ]}
          />
        </Panel>
        <Panel title="发布门禁" meta={<StatusPill tone={gate?.status === "blocked" ? "bad" : "ok"}>{gate?.status ?? "blocked"}</StatusPill>}>
          <KeyValueList
            items={[
              ...(gate?.auditId ? [["审计记录", gate.auditId] as [string, React.ReactNode]] : []),
              ...reasons.map((reason) => [reason, <StatusPill key={reason} tone="bad">blocked</StatusPill>] as [string, React.ReactNode])
            ]}
          />
        </Panel>
      </div>
    </PageScaffold>
  );
}
