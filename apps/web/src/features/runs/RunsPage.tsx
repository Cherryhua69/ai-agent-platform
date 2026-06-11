import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useRunTrace } from "./useRunTrace";

export function RunsPage() {
  const traceQuery = useRunTrace();
  const trace = traceQuery.data;
  const steps = trace?.steps ?? [];

  return (
    <PageScaffold title="运行记录" description="查看最近一次运行的步骤、耗时、成本和失败归因。">
      <Panel title="Trace 步骤" meta={<StatusPill tone={trace?.status === "success" ? "ok" : "bad"}>{trace?.status ?? "failed"}</StatusPill>} strong>
        <div className="trace-layout">
          <aside>
            {(steps.length
              ? steps
              : [
                  { id: "fallback-input", title: "用户输入", status: "success", latencyMs: 18 },
                  { id: "fallback-tool", title: "MCP Tool", status: "failed", latencyMs: 8400, errorMessage: "create_ticket timeout" }
                ]
            ).map((step, index) => (
              <div className={step.status === "failed" ? "trace-step bad-step" : "trace-step"} key={step.id}>
                <strong>
                  {String(index + 1).padStart(2, "0")} {step.title}
                </strong>
                <span>{step.errorMessage ?? `${step.latencyMs}ms，已记录输入输出摘要`}</span>
              </div>
            ))}
          </aside>
          <section>
            <SimpleTable
              columns={["字段", "值"]}
              rows={[
                ["Run ID", trace?.id ?? "run_8f23"],
                ["Agent", trace?.agentId ?? "agent-after-sale"],
                ["成本", `¥${(trace?.costCny ?? 0.06).toFixed(2)}`],
                ["失败归因", steps.find((step) => step.status === "failed")?.errorMessage ?? "create_ticket timeout"]
              ]}
            />
            <pre>{JSON.stringify(trace ?? { runId: "run_8f23", gate: "blocked_by_tool_health", trace: ["input", "retrieval", "rerank", "llm", "mcp_tool"] }, null, 2)}</pre>
          </section>
        </div>
      </Panel>
    </PageScaffold>
  );
}
