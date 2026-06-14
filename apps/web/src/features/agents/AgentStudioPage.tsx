import { useCanvasConfig } from "../workflows/useCanvasConfig";
import { KeyValueList, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useAgents } from "./useAgents";
import { useCreateAgent } from "./useCreateAgent";

const steps = ["基础信息", "模型与 Prompt", "知识与变量", "工具与 MCP", "评测集", "发布策略"];

export function AgentStudioPage() {
  const agentsQuery = useAgents();
  const createAgent = useCreateAgent();
  const { modelProviderId, knowledgeBaseIds, userInput, latestRun } = useCanvasConfig();

  const agents = agentsQuery.data ?? [];
  const createdAgent = createAgent.data;
  const primaryAgent = createdAgent ?? agents[0];
  const failedStep = latestRun?.steps.find((step) => step.status === "failed");

  function handleCreateAgent() {
    createAgent.mutate({
      name: "售后政策助手",
      scenario: "售后问答与工单分流"
    });
  }

  return (
    <PageScaffold
      eyebrow="构建 / 智能体"
      title="智能体"
      description="创建、检查和管理智能体。模型 API、知识库和调用需求在工作流画布中配置，运行结果会同步展示在这里。"
      actions={
        <button className="btn primary" disabled={createAgent.isPending} onClick={handleCreateAgent} type="button">
          {createAgent.isPending ? "创建中..." : "创建智能体"}
        </button>
      }
    >
      <div className="grid-two">
        <Panel title="创建流程" strong>
          <div className="wizard-list">
            {steps.map((step, index) => (
              <div className={index === 0 ? "wizard-step active" : "wizard-step"} key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="当前草稿">
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
          {createdAgent ? (
            <p className="inline-success">
              已创建智能体：{createdAgent.name}
              <br />
              <span>{createdAgent.workflowId}</span>
            </p>
          ) : null}
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
          {createAgent.isError ? <p className="inline-error">创建失败，请检查 API 服务。</p> : null}
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
