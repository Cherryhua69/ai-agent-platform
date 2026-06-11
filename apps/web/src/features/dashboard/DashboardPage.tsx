import { KeyValueList, MetricCard, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useAgents } from "../agents/useAgents";
import { useReleaseGates } from "../releases/useReleaseGates";
import { useWorkflows } from "../workflows/useWorkflows";

export function DashboardPage() {
  const agentsQuery = useAgents();
  const workflowsQuery = useWorkflows();
  const gatesQuery = useReleaseGates();

  const agents = agentsQuery.data ?? [];
  const workflows = workflowsQuery.data ?? [];
  const gates = gatesQuery.data ?? [];
  const blockedGates = gates.filter((gate) => gate.status === "blocked");
  const hasDegradedTool = workflows.some((workflow) => workflow.toolHealthStatus === "degraded");

  return (
    <PageScaffold
      eyebrow="工作台 / 运行健康"
      title="企业 Agent 工作台"
      description="从 Agent 设计、工作流、知识、工具、评测、发布到审计的一体化入口。"
      actions={false}
    >
      <div className="metrics-grid">
        <MetricCard label="Agent" value={String(agents.length || 2)} detail="mock API 已接入" />
        <MetricCard label="Flow" value={String(workflows.length || 1)} detail="Agentflow / Chatflow / RAG" />
        <MetricCard label="知识命中率" value="86%" detail="Hybrid + Rerank" />
        <MetricCard label="异常工具" value={hasDegradedTool ? "1" : "0"} detail="create_ticket degraded" tone={hasDegradedTool ? "bad" : "ok"} />
        <MetricCard label="发布阻断" value={String(blockedGates.length || 1)} detail="评测 / 权限 / 工具" tone="bad" />
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
        <Panel title="风险待办">
          <KeyValueList
            items={(blockedGates[0]?.reasons ?? ["工具健康异常：create_ticket degraded", "关键评测用例失败"]).map((reason) => [
              reason,
              <StatusPill key={reason} tone="bad">阻断发布</StatusPill>
            ])}
          />
        </Panel>
      </div>
      <Panel title="最近异常运行">
        <SimpleTable
          columns={["Run", "Agent", "归因", "状态", "负责人"]}
          rows={[
            ["run_8f23", agents[0]?.name ?? "售后政策助手", "create_ticket timeout", <StatusPill tone="bad">failed</StatusPill>, agents[0]?.owner ?? "陈晓"],
            ["run_3ac1", "合同审阅 Flow", "引用置信度不足", <StatusPill tone="warn">review</StatusPill>, "王宁"],
            ["run_922e", "数据查询助手", "权限策略阻断", <StatusPill tone="bad">blocked</StatusPill>, "周文"]
          ]}
        />
      </Panel>
    </PageScaffold>
  );
}
