import { KeyValueList, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";

export function ReleasePage() {
  return (
    <PageScaffold
      eyebrow="上线 / Channels"
      title="发布渠道"
      description="快速暴露 API、Web Chat、Embedded Chatbot、MCP Server 和企业 IM，同时加入门禁与回滚治理。"
      actions={
        <>
          <button className="btn" type="button">发布检查</button>
          <button className="btn primary" type="button">发布测试环境</button>
        </>
      }
    >
      <div className="grid-two">
        <Panel title="渠道配置" meta={<StatusPill tone="warn">待检查</StatusPill>} strong>
          <SimpleTable
            columns={["渠道", "路径 / 入口", "认证", "状态"]}
            rows={[
              ["API", "/api/agents/after-sale/run", "API Key", <StatusPill tone="warn">待发布</StatusPill>],
              ["Web Chat", "/chat/after-sale", "Workspace", <StatusPill tone="ok">published</StatusPill>],
              ["Embedded Chatbot", "script snippet", "Domain allowlist", <StatusPill>ready</StatusPill>],
              ["MCP Server", "after-sale-flow as tools", "OAuth 预留", <StatusPill>draft</StatusPill>]
            ]}
          />
        </Panel>
        <Panel title="发布门禁" meta={<StatusPill tone="bad">blocked</StatusPill>}>
          <KeyValueList
            items={[
              ["关键评测", <StatusPill tone="bad">1 失败</StatusPill>],
              ["工具健康", <StatusPill tone="bad">create_ticket degraded</StatusPill>],
              ["知识库索引", <StatusPill tone="ok">ready</StatusPill>],
              ["高风险规则", <StatusPill tone="warn">退款 API 需确认</StatusPill>]
            ]}
          />
        </Panel>
      </div>
    </PageScaffold>
  );
}
