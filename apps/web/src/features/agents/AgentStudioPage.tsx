import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { KeyValueList, PageScaffold, Panel, StatusPill } from "../shared/ViewBlocks";
import type { Agent, AgentStatus, GateStatus, HealthStatus } from "../../types/domain";
import { useAgents } from "./useAgents";
import { useCreateAgent } from "./useCreateAgent";

gsap.registerPlugin(useGSAP);

const defaultForm = {
  name: "",
  scenario: "",
  modelPolicy: "gpt-4.1 + fallback"
};

const statusLabelMap: Record<AgentStatus | GateStatus | HealthStatus, string> = {
  draft: "草稿",
  ready: "就绪",
  published: "已发布",
  blocked: "阻断",
  passed: "通过",
  review_required: "需复核",
  online: "在线",
  degraded: "异常",
  offline: "离线",
  guarded: "受控"
};

function toStatusLabel(status: string) {
  return statusLabelMap[status as keyof typeof statusLabelMap] ?? "未知";
}

function getAgentTone(status: Agent["status"]): "ok" | "warn" | "bad" | "info" | "gray" {
  if (status === "ready" || status === "published") {
    return "ok";
  }

  if (status === "blocked") {
    return "bad";
  }

  if (status === "draft") {
    return "info";
  }

  return "gray";
}

function formatResourceSummary(agent: Agent) {
  return `${agent.knowledgeBaseIds.length} 个知识库 / ${agent.toolIds.length} 个工具`;
}

export function AgentStudioPage() {
  const agentsQuery = useAgents();
  const createAgent = useCreateAgent();
  const assetsScrollRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);

  const agents = agentsQuery.data ?? [];
  const createdAgent = createAgent.data;
  const visibleAgents = useMemo(() => {
    if (!createdAgent || agents.some((agent) => agent.id === createdAgent.id)) {
      return agents;
    }

    return [createdAgent, ...agents];
  }, [agents, createdAgent]);
  const selectedAgent =
    visibleAgents.find((agent) => agent.id === selectedAgentId) ?? createdAgent ?? visibleAgents[0] ?? null;

  useEffect(() => {
    if (!selectedAgentId && visibleAgents[0]) {
      setSelectedAgentId(visibleAgents[0].id);
    }
  }, [selectedAgentId, visibleAgents]);

  useGSAP(
    () => {
      if (!assetsScrollRef.current) {
        return;
      }

      const rows = assetsScrollRef.current.querySelectorAll("tbody tr");
      if (!rows.length) {
        return;
      }

      gsap.fromTo(
        rows,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out", stagger: 0.03, overwrite: "auto" }
      );
    },
    { dependencies: [visibleAgents.length, selectedAgent?.id] }
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      scenario: form.scenario.trim(),
      modelPolicy: form.modelPolicy.trim()
    };

    if (!payload.name || !payload.scenario || !payload.modelPolicy) {
      return;
    }

    createAgent.mutate(payload, {
      onSuccess: (agent) => {
        setSelectedAgentId(agent.id);
        setCreatedMessage(`已创建智能体：${agent.name}`);
        setForm(defaultForm);
      }
    });
  }

  return (
    <PageScaffold
      title="智能体"
      description="创建、查看和管理智能体资产，聚焦基础配置、绑定资源与发布状态。"
      actions={
        <button className="btn primary" disabled={createAgent.isPending} type="submit" form="agent-create-form">
          {createAgent.isPending ? "创建中..." : "创建智能体"}
        </button>
      }
    >
      <div className="grid-two agent-workspace">
        <Panel title="创建智能体" strong>
          <form className="agent-form" id="agent-create-form" onSubmit={handleSubmit}>
            <label>
              <span>智能体名称</span>
              <input
                aria-label="智能体名称"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如：售后政策助手"
              />
            </label>
            <label>
              <span>应用场景</span>
              <textarea
                aria-label="应用场景"
                value={form.scenario}
                onChange={(event) => setForm((current) => ({ ...current, scenario: event.target.value }))}
                placeholder="描述智能体要处理的业务任务"
                rows={3}
              />
            </label>
            <label>
              <span>模型策略</span>
              <input
                aria-label="模型策略"
                value={form.modelPolicy}
                onChange={(event) => setForm((current) => ({ ...current, modelPolicy: event.target.value }))}
              />
            </label>
          </form>
          {createdMessage ? <p className="inline-success">{createdMessage}</p> : null}
          {createAgent.isError ? <p className="inline-error">创建失败，请检查 API 服务后重试。</p> : null}
        </Panel>

        <Panel
          title={selectedAgent ? `当前智能体：${selectedAgent.name}` : "当前智能体"}
          meta={
            selectedAgent ? (
              <StatusPill tone={getAgentTone(selectedAgent.status)}>{toStatusLabel(selectedAgent.status)}</StatusPill>
            ) : null
          }
        >
          {selectedAgent ? (
            <KeyValueList
              items={[
                ["智能体名称", selectedAgent.name],
                ["应用场景", selectedAgent.scenario],
                ["模型策略", selectedAgent.modelPolicy],
                ["工作流", selectedAgent.workflowId],
                ["知识库", selectedAgent.knowledgeBaseIds.join(" / ")],
                ["工具权限", selectedAgent.toolIds.join(" / ")],
                [
                  "发布检查",
                  <StatusPill key="release-check" tone={selectedAgent.status === "blocked" ? "bad" : "ok"}>
                    {selectedAgent.status === "blocked" ? "阻断" : "通过"}
                  </StatusPill>
                ]
              ]}
            />
          ) : (
            <p className="empty-state">暂无智能体，请先创建智能体。</p>
          )}
        </Panel>
      </div>

      <Panel title="智能体资产" className="agent-assets-panel">
        <div className="agent-assets-scroll" aria-label="智能体资产滚动预览" ref={assetsScrollRef}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>应用场景</th>
                  <th>模型策略</th>
                  <th>工作流</th>
                  <th>绑定资源</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleAgents.map((agent) => {
                  const selected = selectedAgent?.id === agent.id;
                  return (
                    <tr className={selected ? "selected" : undefined} key={agent.id}>
                      <td>
                        <strong>{agent.name}</strong>
                        {selected ? <span className="current-row-label">当前</span> : null}
                      </td>
                      <td>{agent.scenario}</td>
                      <td>{agent.modelPolicy}</td>
                      <td>{agent.workflowId}</td>
                      <td>{formatResourceSummary(agent)}</td>
                      <td>
                        <StatusPill tone={getAgentTone(agent.status)}>{toStatusLabel(agent.status)}</StatusPill>
                      </td>
                      <td>
                        <button className="table-action" type="button" onClick={() => setSelectedAgentId(agent.id)}>
                          查看 <span className="sr-only">{agent.name}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </PageScaffold>
  );
}