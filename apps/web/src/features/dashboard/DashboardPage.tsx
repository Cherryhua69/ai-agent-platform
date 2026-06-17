import { MetricCard, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
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
  const owner = agents[0]?.owner ?? "陈晓";

  return (
    <PageScaffold className="dashboard-page" title="总览" description="">
      <div className="metrics-grid">
        <MetricCard label="智能体" value={String(agents.length || 2)} detail="当前项目数量" tone="blue" bars={[48, 56, 62, 74, 66]} />
        <MetricCard label="运行成功率" value="94%" detail="近 24 小时" tone="mint" bars={[62, 70, 68, 78, 82]} />
        <MetricCard label="已发布" value={String(blockedGates.length || 1)} detail="当前已发布" tone="pink" bars={[35, 42, 50, 68, 84]} />
      </div>
      <div className="grid-two">
        <Panel title="近期运行" strong>
          <div className="dashboard-run-table">
            <SimpleTable
              columns={["名称", "异常原因", "状态"]}
              rows={[
                [
                  <span className="run-subject" key="run-8f23">
                    <strong>{agents[0]?.name ?? "售后政策助手"}</strong>
                    <small>run_8f23 · 2 分钟前</small>
                  </span>,
                  <span className="run-reason" key="reason-8f23">
                    工具 create_ticket 超时，工单未写入
                  </span>,
                  <StatusPill key="status-8f23" tone="bad">
                    失败
                  </StatusPill>
                ],
                [
                  <span className="run-subject" key="run-3ac1">
                    <strong>合同审阅助手</strong>
                    <small>run_3ac1 · 18 分钟前</small>
                  </span>,
                  <span className="run-reason" key="reason-3ac1">
                    引用置信度不足，等待人工复核
                  </span>,
                  <StatusPill key="status-3ac1" tone="bad">
                    失败
                  </StatusPill>
                ],
                [
                  <span className="run-subject" key="run-922e">
                    <strong>数据查询助手</strong>
                    <small>run_922e · 42 分钟前</small>
                  </span>,
                  <span className="run-reason" key="reason-922e">
                    无
                  </span>,
                  <StatusPill key="status-922e" tone="ok">
                    成功
                  </StatusPill>
                ]
              ]}
            />
          </div>
        </Panel>
        <Panel title="待完成" meta={<StatusPill tone="info">3 个智能体</StatusPill>}>
          <div className="todo-list">
            <article className="todo-item urgent">
              <div>
                <strong>{agents[0]?.name ?? "售后政策助手"}</strong>
              </div>
              <StatusPill tone="info">配置中</StatusPill>
            </article>
            <article className="todo-item">
              <div>
                <strong>合同审阅助手</strong>
              </div>
              <StatusPill tone="info">配置中</StatusPill>
            </article>
            <article className="todo-item">
              <div>
                <strong>数据查询助手</strong>
              </div>
              <StatusPill tone="info">配置中</StatusPill>
            </article>
          </div>
        </Panel>
      </div>
    </PageScaffold>
  );
}
