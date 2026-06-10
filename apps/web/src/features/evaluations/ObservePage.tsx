import { MetricCard, PageScaffold, Panel, StatusPill } from "../shared/ViewBlocks";
import { useRunTrace } from "../runs/useRunTrace";

export function ObservePage() {
  const traceQuery = useRunTrace();
  const trace = traceQuery.data;
  const steps = trace?.steps ?? [];

  return (
    <PageScaffold
      eyebrow="上线 / Evaluation & Trace"
      title="评测与观测"
      description="用数据集、发布结论、失败归因、Trace 步骤、成本和延迟解释上线风险。"
    >
      <div className="metrics-grid four">
        <MetricCard label="通过率" value="94.6%" detail="核心用例稳定" />
        <MetricCard label="平均延迟" value="1.9s" detail="目标 < 2.5s" />
        <MetricCard label="工具成功率" value="88%" detail="低于门禁" tone="bad" />
        <MetricCard label="知识命中" value="86%" detail="无结果 32 次" />
      </div>
      <Panel title="Trace 步骤" strong>
        <div className="trace-layout">
          <aside>
            {(steps.length ? steps : [
              { id: "fallback-input", title: "用户输入", status: "success", latencyMs: 18 },
              { id: "fallback-tool", title: "MCP Tool", status: "failed", latencyMs: 8400, errorMessage: "create_ticket timeout" }
            ]).map((step, index) => (
              <div className={step.status === "failed" ? "trace-step bad-step" : "trace-step"} key={step.id}>
                <strong>{String(index + 1).padStart(2, "0")} {step.title}</strong>
                <span>{step.errorMessage ?? `${step.latencyMs}ms，已记录输入输出摘要`}</span>
              </div>
            ))}
          </aside>
          <section>
            <div className="cards-grid three">
              <div className="asset-card"><strong>发布结论</strong><StatusPill tone="bad">blocked</StatusPill></div>
              <div className="asset-card"><strong>失败归因</strong><p>MCP 超时</p></div>
              <div className="asset-card"><strong>可复现</strong><p>Run + Dataset Case</p></div>
            </div>
            <pre>{JSON.stringify(trace ?? { runId: "run_8f23", gate: "blocked_by_tool_health", trace: ["input", "retrieval", "rerank", "llm", "mcp_tool"] }, null, 2)}</pre>
          </section>
        </div>
      </Panel>
    </PageScaffold>
  );
}
