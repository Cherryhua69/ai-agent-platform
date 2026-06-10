import { KeyValueList, MetricCard, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";

export function DashboardPage() {
  return (
    <PageScaffold
      eyebrow="工作台 / 运行健康"
      title="企业 Agent 工作台"
      description="从 Agent 设计、工作流、知识、工具、评测、发布到审计的一体化入口。"
    >
      <div className="metrics-grid">
        <MetricCard label="Agent" value="42" detail="14 个生产可用" />
        <MetricCard label="Flow" value="96" detail="Agentflow / Chatflow / RAG" />
        <MetricCard label="知识命中率" value="86%" detail="Hybrid + Rerank" />
        <MetricCard label="工具成功率" value="92%" detail="MCP 超时偏高" tone="warn" />
        <MetricCard label="发布阻断" value="5" detail="评测 / 权限 / 工具" tone="bad" />
        <MetricCard label="平均成本" value="¥0.06" detail="每次运行" />
      </div>
      <div className="grid-two">
        <Panel title="主路径闭环" meta={<StatusPill>MVP</StatusPill>} strong>
          <div className="badge-row">
            {["创建 Agent", "编排 Flow", "绑定知识/工具", "调试 Trace", "评测门禁", "发布 API", "审计回溯"].map((item) => (
              <StatusPill key={item}>{item}</StatusPill>
            ))}
          </div>
          <div className="cards-grid three">
            <div className="asset-card">
              <strong>Dify 启发</strong>
              <p>生产级 workflow + RAG + observability。</p>
            </div>
            <div className="asset-card">
              <strong>Flowise 启发</strong>
              <p>Agentflow、Tracing、Evaluations、人机协作。</p>
            </div>
            <div className="asset-card">
              <strong>RAGFlow 启发</strong>
              <p>文档解析、Hybrid Search、Rerank 和引用来源。</p>
            </div>
          </div>
        </Panel>
        <Panel title="风险待办" meta={<button className="btn">查看阻断</button>}>
          <KeyValueList
            items={[
              ["工单 MCP 延迟超过 8s", <StatusPill tone="bad">阻断发布</StatusPill>],
              ["质保条款库索引过期", <StatusPill tone="warn">需重建</StatusPill>],
              ["退款 API 需要人工确认", <StatusPill tone="warn">高风险</StatusPill>]
            ]}
          />
        </Panel>
      </div>
      <Panel title="最近异常运行">
        <SimpleTable
          columns={["Run", "Agent", "归因", "状态", "负责人"]}
          rows={[
            ["run_8f23", "售后政策助手", "create_ticket timeout", <StatusPill tone="bad">failed</StatusPill>, "陈晓"],
            ["run_3ac1", "合同审阅 Flow", "引用置信度不足", <StatusPill tone="warn">review</StatusPill>, "王宁"],
            ["run_922e", "数据查询助手", "权限策略阻断", <StatusPill tone="bad">blocked</StatusPill>, "周文"]
          ]}
        />
      </Panel>
    </PageScaffold>
  );
}
