import { useCanvasConfig } from "../workflows/useCanvasConfig";
import { KeyValueList, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useAgents } from "./useAgents";

const steps = ["基础信息", "模型与 Prompt", "知识与变量", "工具与 MCP", "评测集", "发布策略"];

export function AgentStudioPage() {
  const agentsQuery = useAgents();
  const agents = agentsQuery.data ?? [];
  const { modelProviderId, knowledgeBaseIds, userInput, latestRun } = useCanvasConfig();
  const failedStep = latestRun?.steps.find((step) => step.status === "failed");
  const primaryAgent = agents[0];

  return (
    <PageScaffold
      eyebrow="构建 / Agent Studio"
      title="Agent Studio"
      description="覆盖 Agent 创建向导、模型与 Prompt、知识与变量、工具与 MCP、评测集和发布策略。运行调试在工作流画布中完成，结果会同步展示在这里。"
    >
      <div className="grid-two">
        <Panel title="创建向导" strong>
          <div className="wizard-list">
            {steps.map((step, index) => (
              <div className={index === 0 ? "wizard-step active" : "wizard-step"} key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="当前草稿资产">
          <KeyValueList
            items={[
              ["Agent", primaryAgent?.name ?? "售后政策助手"],
              ["模型配置", modelProviderId || "请先在工具页添加并在画布中选择"],
              ["工作流", primaryAgent?.workflowId ?? "flow-after-sale"],
              ["知识库", knowledgeBaseIds.length ? knowledgeBaseIds.join(" / ") : "未选择"],
              ["调用需求", userInput],
              ["最新运行", latestRun ? latestRun.id : "等待画布运行调试"],
              ["Trace 成本", latestRun ? `¥${latestRun.costCny.toFixed(2)}` : "未产生"]
            ]}
          />
          {latestRun ? (
            <p className="inline-success">
              最新运行：{latestRun.id}
              <br />
              <span>{failedStep ? `失败步骤：${failedStep.title}` : "全部步骤通过"}</span>
            </p>
          ) : null}
          {latestRun?.finalOutput ? (
            <div className="run-output">
              <strong>智能体调用结果</strong>
              <p>{latestRun.finalOutput}</p>
            </div>
          ) : null}
        </Panel>
      </div>
      <Panel title="智能体资产">
        <SimpleTable
          columns={["名称", "场景", "模型", "负责人", "状态"]}
          rows={(agents.length ? agents : [primaryAgent].filter(Boolean)).map((agent) => [
            agent?.name,
            agent?.scenario,
            modelProviderId || agent?.modelPolicy,
            agent?.owner,
            <StatusPill key={agent?.id} tone={agent?.status === "blocked" ? "bad" : agent?.status === "ready" ? "ok" : "info"}>
              {agent?.status}
            </StatusPill>
          ])}
        />
      </Panel>
    </PageScaffold>
  );
}
