import { type FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import type { Agent } from "../../types/domain";
import { PageScaffold, StatusPill } from "../shared/ViewBlocks";
import { useAgents } from "./useAgents";
import { useCreateAgent } from "./useCreateAgent";
import { useDeleteAgent } from "./useDeleteAgent";
import { useUpdateAgent } from "./useUpdateAgent";

type AgentDialogMode = "create" | "edit";

type AgentStudioPageProps = {
  onConfigureAgent?: (agent: Agent) => void;
};

function getAgentPublishLabel(status: string) {
  return status === "published" ? "已发布" : "未发布";
}

export function AgentStudioPage({ onConfigureAgent }: AgentStudioPageProps) {
  const [dialogMode, setDialogMode] = useState<AgentDialogMode>("create");
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [openMenuAgentId, setOpenMenuAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const agentsQuery = useAgents();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  const agents = agentsQuery.data ?? [];
  const visibleAgents = agents;
  const portalTarget = typeof document === "undefined" ? null : document.querySelector(".main-shell");
  const isSavingAgent = createAgent.isPending || updateAgent.isPending;
  const agentSaveError = createAgent.isError || updateAgent.isError;

  function openCreateDialog() {
    setDialogMode("create");
    setEditingAgentId(null);
    setAgentName("");
    setAgentDescription("");
    setIsAgentDialogOpen(true);
  }

  function openEditDialog(agent: (typeof visibleAgents)[number]) {
    setDialogMode("edit");
    setEditingAgentId(agent.id);
    setAgentName(agent.name);
    setAgentDescription(agent.scenario);
    setOpenMenuAgentId(null);
    setIsAgentDialogOpen(true);
  }

  function closeDialog() {
    setIsAgentDialogOpen(false);
    setDialogMode("create");
    setEditingAgentId(null);
    setAgentName("");
    setAgentDescription("");
  }

  function handleSubmitCreateAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = agentName.trim();

    if (!name) {
      return;
    }

    const payload = {
      name,
      scenario: agentDescription.trim()
    };

    if (dialogMode === "edit" && editingAgentId) {
      updateAgent.mutate({ id: editingAgentId, ...payload }, { onSuccess: closeDialog });
      return;
    }

    createAgent.mutate(payload, { onSuccess: closeDialog });
  }

  function handleDeleteAgent(agentId: string) {
    setOpenMenuAgentId(null);
    deleteAgent.mutate(agentId);
  }

  const agentDialogTitle = dialogMode === "edit" ? "编辑智能体" : "创建智能体";
  const agentDialog = isAgentDialogOpen ? (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="agent-dialog-title">
        <div className="modal-head">
          <div>
            <strong id="agent-dialog-title">{agentDialogTitle}</strong>
            <span>{dialogMode === "edit" ? "修改智能体名称与描述，保存后会同步更新卡片。" : "填写基础信息后，会在智能体列表中生成一张新的智能体卡片。"}</span>
          </div>
          <button aria-label="关闭弹窗" className="modal-close" onClick={closeDialog} type="button">
            ×
          </button>
        </div>
        <form className="tool-form" onSubmit={handleSubmitCreateAgent}>
          <label className="field-stack">
            智能体名称
            <input
              onChange={(event) => setAgentName(event.target.value)}
              placeholder="例如：退款审核助手"
              required
              value={agentName}
            />
          </label>
          <label className="field-stack">
            描述
            <textarea
              onChange={(event) => setAgentDescription(event.target.value)}
              placeholder="可选，描述这个智能体负责的任务"
              rows={4}
              value={agentDescription}
            />
          </label>
          {agentSaveError ? <p className="inline-error">保存失败，请检查 API 服务。</p> : null}
          <div className="form-actions">
            <button className="btn" onClick={closeDialog} type="button">
              取消
            </button>
            <button className="btn primary" disabled={isSavingAgent || !agentName.trim()} type="submit">
              {isSavingAgent ? "保存中..." : dialogMode === "edit" ? "保存修改" : "确认创建"}
            </button>
          </div>
        </form>
      </section>
    </div>
  ) : null;

  return (
    <PageScaffold
      eyebrow="构建 / 智能体"
      title="智能体"
      description="创建、检查和管理智能体。模型 API、知识库和调用需求在工作流画布中配置，运行结果会同步展示在这里。"
      actions={
        <button className="btn primary" onClick={openCreateDialog} type="button">
          创建智能体
        </button>
      }
    >
      {agentDialog ? (portalTarget ? createPortal(agentDialog, portalTarget) : agentDialog) : null}
      {visibleAgents.length ? (
        <div className="agent-card-grid">
          {visibleAgents.map((agent) => (
            <article
              aria-label={agent.name}
              className="agent-card"
              key={agent.id}
              onClick={() => onConfigureAgent?.(agent)}
              tabIndex={onConfigureAgent ? 0 : undefined}
              onKeyDown={(event) => {
                if (!onConfigureAgent) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onConfigureAgent(agent);
                }
              }}
            >
              <div className="agent-card-head">
                <strong>{agent.name}</strong>
                <StatusPill tone={agent.status === "published" ? "ok" : "info"}>
                  {getAgentPublishLabel(agent.status)}
                </StatusPill>
              </div>
              <p className="agent-card-description">{agent.scenario || "暂未填写描述"}</p>
              <div className="agent-card-actions" onClick={(event) => event.stopPropagation()}>
                <button
                  aria-expanded={openMenuAgentId === agent.id}
                  aria-haspopup="menu"
                  aria-label={`打开${agent.name}操作菜单`}
                  className="agent-card-menu-trigger"
                  onClick={() => setOpenMenuAgentId((current) => (current === agent.id ? null : agent.id))}
                  type="button"
                >
                  ...
                </button>
                {openMenuAgentId === agent.id ? (
                  <div className="agent-card-menu" role="menu">
                    <button onClick={() => openEditDialog(agent)} role="menuitem" type="button">
                      编辑
                    </button>
                    <button disabled={deleteAgent.isPending} onClick={() => handleDeleteAgent(agent.id)} role="menuitem" type="button">
                      删除
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-note">暂无智能体，点击右上角创建智能体。</p>
      )}
    </PageScaffold>
  );
}
