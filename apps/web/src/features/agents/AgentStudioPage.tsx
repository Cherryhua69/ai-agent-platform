import { KeyValueList, PageScaffold, Panel, StatusPill } from "../shared/ViewBlocks";

const steps = ["基础信息", "模型与 Prompt", "知识与变量", "工具与 MCP", "评测集", "发布策略"];

export function AgentStudioPage() {
  return (
    <PageScaffold
      eyebrow="构建 / Agent Studio"
      title="Agent Studio"
      description="覆盖 Agent 创建向导、模型与 Prompt、知识与变量、工具与 MCP、评测集和发布策略。"
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
              ["Agent", "售后政策助手"],
              ["模型策略", "gpt-4.1 + fallback"],
              ["知识库", "售后政策库 / 质保条款库"],
              ["工具健康", <StatusPill tone="bad">1 degraded</StatusPill>],
              ["发布检查", <StatusPill tone="bad">blocked</StatusPill>]
            ]}
          />
        </Panel>
      </div>
    </PageScaffold>
  );
}
