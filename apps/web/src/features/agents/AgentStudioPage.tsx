import { useState } from "react";
import { KeyValueList, PageScaffold, Panel, StatusPill } from "../shared/ViewBlocks";
import { useCreateAgent } from "./useCreateAgent";

const steps = ["基础信息", "模型与 Prompt", "知识与变量", "工具与 MCP", "评测集", "发布策略"];

export function AgentStudioPage() {
  const createAgent = useCreateAgent();
  const [createdWorkflowId, setCreatedWorkflowId] = useState<string | null>(null);

  const createdAgent = createAgent.data;

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
              ["发布检查", <StatusPill tone="bad">blocked</StatusPill>]
            ]}
          />
          {createdAgent ? (
            <p className="inline-success">
              已创建草稿：{createdAgent.name}
              <br />
              <span>{createdAgent.workflowId}</span>
            </p>
          ) : null}
          {createAgent.isError ? <p className="inline-error">创建失败，请检查 API 服务。</p> : null}
        </Panel>
      </div>
    </PageScaffold>
  );
}
