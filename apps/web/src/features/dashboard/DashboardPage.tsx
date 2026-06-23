import { MetricCard, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useAgents } from "../agents/useAgents";
import { useDashboardSummary } from "./useDashboardSummary";
import { useRecentRuns } from "./useRecentRuns";

const statusLabels = {
  success: "成功",
  failed: "失败"
} as const;

const statusTones = {
  success: "ok",
  failed: "bad"
} as const;

const runCategoryLabels = {
  test: "测试运行",
  production: "正式运行"
} as const;

function formatRunTime(value?: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DashboardPage() {
  const agentsQuery = useAgents();
  const dashboardSummaryQuery = useDashboardSummary();
  const recentRunsQuery = useRecentRuns();

  const agents = agentsQuery.data ?? [];
  const recentRuns = recentRunsQuery.data ?? [];
  const summary = dashboardSummaryQuery.data;
  const runSuccessRate = summary?.runSuccessRate;
  const pendingAgents = summary?.pendingAgents ?? [];

  return (
    <PageScaffold className="dashboard-page" title="总览" description="系统总体信息预览">
      <div className="metrics-grid">
        <MetricCard label="智能体" value={String(agents.length)} detail="当前智能体数量" tone="blue" bars={[48, 56, 62, 74, 66]} />
        <MetricCard
          label="运行成功率"
          value={`${runSuccessRate?.value ?? 0}%`}
          detail={`近 ${runSuccessRate?.windowHours ?? 24} 小时，${runSuccessRate?.successfulRuns ?? 0}/${runSuccessRate?.totalRuns ?? 0} 次成功`}
          tone="mint"
          bars={[62, 70, 68, 78, 82]}
        />
        <MetricCard label="已发布" value={String(summary?.publishedAgents ?? 0)} detail="发布功能暂未实现" tone="pink" bars={[35, 42, 50, 68, 84]} />
      </div>
      <div className="grid-two">
        <Panel title="近期运行" strong>
          <div className="dashboard-run-table">
            <SimpleTable
              columns={["名称", "运行时间", "异常原因", "类别", "状态"]}
              rows={recentRuns.map((run) => [
                <span className="run-subject" key={`${run.id}-name`}>
                  <strong>{run.agentName}</strong>
                  <small>{run.id}</small>
                </span>,
                <span className="run-time" key={`${run.id}-time`}>
                  {formatRunTime(run.runTime)}
                </span>,
                <span className="run-reason" key={`${run.id}-reason`}>
                  {run.failureReason || "无"}
                </span>,
                <span className="run-category" key={`${run.id}-category`}>
                  {runCategoryLabels[run.runCategory]}
                </span>,
                <StatusPill key={`${run.id}-status`} tone={statusTones[run.status]}>
                  {statusLabels[run.status]}
                </StatusPill>
              ])}
            />
          </div>
        </Panel>
        <Panel title="待完成">
          <div className="todo-list">
            {pendingAgents.map((agent, index) => (
              <article className={index === 0 ? "todo-item urgent" : "todo-item"} key={agent.id}>
                <div>
                  <strong>{agent.name}</strong>
                  <span>{agent.description || "暂无描述"}</span>
                </div>
                <StatusPill tone="info">配置中</StatusPill>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </PageScaffold>
  );
}
