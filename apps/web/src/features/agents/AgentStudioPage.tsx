import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useRef, useState } from "react";
import { KeyValueList, PageScaffold, Panel, StatusPill } from "../shared/ViewBlocks";
import { useCreateAgent } from "./useCreateAgent";
import { useSimulateAgentRun } from "./useSimulateAgentRun";

gsap.registerPlugin(useGSAP);

const steps = ["基础信息", "模型与 Prompt", "知识与变量", "工具与 MCP", "评测集", "发布策略"];

export function AgentStudioPage() {
  const createAgent = useCreateAgent();
  const simulateAgentRun = useSimulateAgentRun();
  const runSummaryRef = useRef<HTMLParagraphElement | null>(null);
  const [createdWorkflowId, setCreatedWorkflowId] = useState<string | null>(null);

  const createdAgent = createAgent.data;
  const latestRun = simulateAgentRun.data;
  const failedStep = latestRun?.steps.find((step) => step.status === "failed");

  useGSAP(
    () => {
      if (!latestRun || !runSummaryRef.current) {
        return;
      }

      gsap.fromTo(runSummaryRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" });
    },
    { dependencies: [latestRun?.id], scope: runSummaryRef }
  );

  function handleCreateDraft() {
    createAgent.mutate(
      {
        name: "售后政策助手",
        scenario: "售后问答与工单分流"
      },
      {
        onSuccess: (agent) => setCreatedWorkflowId(agent.workflowId)
      }
    );
  }

  function handleSimulateRun() {
    simulateAgentRun.mutate(createdAgent?.id ?? "agent-after-sale");
  }

  return (
    <PageScaffold
      eyebrow="构建 / Agent Studio"
      title="Agent Studio"
      description="覆盖 Agent 创建向导、模型与 Prompt、知识与变量、工具与 MCP、评测集和发布策略。"
      actions={
        <>
          <button className="btn" type="button">
            从模板创建
          </button>
          <button className="btn" disabled={simulateAgentRun.isPending} onClick={handleSimulateRun} type="button">
            {simulateAgentRun.isPending ? "运行中..." : "试运行"}
          </button>
          <button className="btn primary" disabled={createAgent.isPending} onClick={handleCreateDraft} type="button">
            {createAgent.isPending ? "创建中..." : "创建草稿 Agent"}
          </button>
        </>
      }
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
              ["Agent", createdAgent?.name ?? "售后政策助手"],
              ["模型策略", createdAgent?.modelPolicy ?? "gpt-4.1 + fallback"],
              ["工作流", createdWorkflowId ?? createdAgent?.workflowId ?? "flow-after-sale"],
              ["知识库", createdAgent ? createdAgent.knowledgeBaseIds.join(" / ") : "售后政策库 / 质保条款库"],
              ["工具健康", <StatusPill tone="bad">1 degraded</StatusPill>],
              ["发布检查", <StatusPill tone="bad">blocked</StatusPill>],
              ["最新运行", latestRun ? latestRun.id : "等待试运行"],
              ["Trace 成本", latestRun ? `¥${latestRun.costCny.toFixed(2)}` : "未产生"]
            ]}
          />
          {createdAgent ? (
            <p className="inline-success">
              已创建草稿：{createdAgent.name}
              <br />
              <span>{createdAgent.workflowId}</span>
            </p>
          ) : null}
          {latestRun ? (
            <p className="inline-success" ref={runSummaryRef}>
              最新运行：{latestRun.id}
              <br />
              <span>{failedStep ? `失败步骤：${failedStep.title}` : "全部步骤通过"}</span>
            </p>
          ) : null}
          {simulateAgentRun.isError ? <p className="inline-error">试运行失败，请检查 API 服务。</p> : null}
          {createAgent.isError ? <p className="inline-error">创建失败，请检查 API 服务。</p> : null}
        </Panel>
      </div>
    </PageScaffold>
  );
}
