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
    <PageScaffold className="dashboard-page" title="总览" description="用最少的信息确认平台是否可发布、哪里被阻断、下一步该处理什么。">
      <div className="metrics-grid">
        <MetricCard label="智能体" value={String(agents.length || 2)} detail="当前项目资产" tone="blue" bars={[48, 56, 62, 74, 66]} />
        <MetricCard label="运行成功率" value="94%" detail="近 24 小时" tone="mint" bars={[62, 70, 68, 78, 82]} />
        <MetricCard label="发布阻断" value={String(blockedGates.length || 1)} detail="需要处理后发布" tone="pink" bars={[35, 42, 50, 68, 84]} />
      </div>
      <div className="grid-two">
        <Panel title="近期运行" meta={<StatusPill tone={hasDegradedTool ? "bad" : "ok"}>{hasDegradedTool ? "有异常" : "稳定"}</StatusPill>} strong>
          <SimpleTable
            columns={["Run", "智能体", "归因", "状态", "负责人"]}
            rows={[
              ["run_8f23", agents[0]?.name ?? "售后政策助手", "create_ticket timeout", <StatusPill tone="bad">failed</StatusPill>, agents[0]?.owner ?? "陈晓"],
              ["run_3ac1", "合同审阅助手", "引用置信度不足", <StatusPill tone="warn">review</StatusPill>, "王宁"],
              ["run_922e", "数据查询助手", "权限策略阻断", <StatusPill tone="bad">blocked</StatusPill>, "周文"]
            ]}
          />
        </Panel>
        <Panel title="待处理">
          <KeyValueList
            items={(blockedGates[0]?.reasons ?? ["工具健康异常：create_ticket degraded", "关键评测用例失败"]).map((reason) => [
              reason,
              <StatusPill key={reason} tone="bad">
                阻断
              </StatusPill>
            ])}
          />
        </Panel>
      </div>
    </PageScaffold>
  );
}
