import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import type { ModelProvider } from "../../types/domain";
import { PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";
import { useCreateModelProvider } from "./useCreateModelProvider";
import { useModelProviders } from "./useModelProviders";
import { useTestModelProvider } from "./useTestModelProvider";
import { useTools } from "./useTools";
import { useUpdateModelProvider } from "./useUpdateModelProvider";

type ToolCategory = "mcp" | "api" | "model";
type DialogMode = "create" | "edit";

type ModelApiForm = {
  name: string;
  providerType: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  isDefault: boolean;
};

const emptyModelApiForm: ModelApiForm = {
  name: "",
  providerType: "openai-compatible",
  baseUrl: "",
  model: "",
  apiKey: "",
  isDefault: false
};

function formFromProvider(provider: ModelProvider): ModelApiForm {
  return {
    name: provider.name,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    model: provider.model,
    apiKey: "",
    isDefault: provider.isDefault
  };
}

export function ToolsPage() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("mcp");
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [selectedToolType, setSelectedToolType] = useState<ToolCategory>("model");
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [modelApiForm, setModelApiForm] = useState<ModelApiForm>(emptyModelApiForm);
  const toolsQuery = useTools();
  const modelProvidersQuery = useModelProviders();
  const createModelProvider = useCreateModelProvider();
  const testModelProvider = useTestModelProvider();
  const updateModelProvider = useUpdateModelProvider();
  const tools = toolsQuery.data ?? [];
  const modelProviders = modelProvidersQuery.data ?? [];
  const isSavingModelApi = createModelProvider.isPending || updateModelProvider.isPending;
  const modelApiError = createModelProvider.isError || updateModelProvider.isError;
  const testingProviderId = testModelProvider.variables?.id;

  const demoTools =
    tools.length > 0
      ? tools
      : [
          {
            id: "tool-create-ticket",
            name: "create_ticket",
            type: "mcp" as const,
            credential: "ticket-prod",
            permission: "Developer + Operator",
            health: "degraded" as const,
            lastCalledAt: "10 分钟前"
          },
          {
            id: "tool-query-order",
            name: "query_order",
            type: "api" as const,
            credential: "order-readonly",
            permission: "Agent scoped",
            health: "online" as const,
            lastCalledAt: "2 分钟前"
          },
          {
            id: "tool-refund-request",
            name: "refund_request",
            type: "api" as const,
            credential: "refund-write",
            permission: "Human approve",
            health: "guarded" as const,
            lastCalledAt: "1 小时前"
          }
        ];

  const mcpTools = demoTools.filter((tool) => tool.type === "mcp");
  const apiTools = demoTools.filter((tool) => tool.type === "api" || tool.type === "trigger");

  function openCreateDialog() {
    setDialogMode("create");
    setEditingProviderId(null);
    setModelApiForm(emptyModelApiForm);
    setSelectedToolType(activeCategory === "model" ? "model" : activeCategory);
    setIsToolDialogOpen(true);
  }

  function openEditDialog(provider: ModelProvider) {
    setDialogMode("edit");
    setEditingProviderId(provider.id);
    setModelApiForm(formFromProvider(provider));
    setSelectedToolType("model");
    setActiveCategory("model");
    setIsToolDialogOpen(true);
  }

  function closeDialog() {
    setIsToolDialogOpen(false);
    setDialogMode("create");
    setEditingProviderId(null);
    setModelApiForm(emptyModelApiForm);
  }

  function handleModelApiChange(field: keyof ModelApiForm, value: string | boolean) {
    setModelApiForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleSaveModelApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: modelApiForm.name.trim(),
      providerType: modelApiForm.providerType.trim(),
      baseUrl: modelApiForm.baseUrl.trim(),
      model: modelApiForm.model.trim(),
      apiKey: modelApiForm.apiKey,
      isDefault: modelApiForm.isDefault
    };

    const onSuccess = (provider: ModelProvider) => {
      closeDialog();
      setActiveCategory("model");
      testModelProvider.mutate({ id: provider.id });
    };

    if (dialogMode === "edit" && editingProviderId) {
      updateModelProvider.mutate({ id: editingProviderId, ...payload }, { onSuccess });
      return;
    }

    createModelProvider.mutate(payload, { onSuccess });
  }

  const toolDialog = isToolDialogOpen ? (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="tool-dialog-title">
        <div className="modal-head">
          <div>
            <strong id="tool-dialog-title">{dialogMode === "edit" ? "编辑模型 API" : "添加工具"}</strong>
            <span>{dialogMode === "edit" ? "修改模型 API 配置，API Key 留空则保持原密钥。" : "选择工具类型并填写对应配置。"}</span>
          </div>
          <button aria-label="关闭弹窗" className="modal-close" onClick={closeDialog} type="button">
            ×
          </button>
        </div>

        {dialogMode === "create" ? (
          <div className="tool-type-picker" role="radiogroup" aria-label="选择工具类型">
            <button className={selectedToolType === "mcp" ? "active" : undefined} onClick={() => setSelectedToolType("mcp")} type="button">
              MCP Server
            </button>
            <button className={selectedToolType === "api" ? "active" : undefined} onClick={() => setSelectedToolType("api")} type="button">
              API Tool
            </button>
            <button className={selectedToolType === "model" ? "active" : undefined} onClick={() => setSelectedToolType("model")} type="button">
              模型 API
            </button>
          </div>
        ) : null}

        {selectedToolType === "model" ? (
          <form className="tool-form" onSubmit={handleSaveModelApi}>
            <label className="field-stack">
              配置名称
              <input
                required
                value={modelApiForm.name}
                onChange={(event) => handleModelApiChange("name", event.target.value)}
                placeholder="例如：Qwen production"
              />
            </label>
            <label className="field-stack">
              协议
              <select value={modelApiForm.providerType} onChange={(event) => handleModelApiChange("providerType", event.target.value)}>
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="anthropic-compatible">Anthropic Compatible</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="field-stack">
              Base URL
              <input
                required
                value={modelApiForm.baseUrl}
                onChange={(event) => handleModelApiChange("baseUrl", event.target.value)}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              />
            </label>
            <label className="field-stack">
              模型
              <input required value={modelApiForm.model} onChange={(event) => handleModelApiChange("model", event.target.value)} placeholder="qwen-plus" />
            </label>
            <label className="field-stack">
              API Key
              <input
                required={dialogMode === "create"}
                type="password"
                value={modelApiForm.apiKey}
                onChange={(event) => handleModelApiChange("apiKey", event.target.value)}
                placeholder={dialogMode === "edit" ? "留空则保持原密钥" : "sk-..."}
              />
            </label>
            <label className="check-row">
              <input checked={modelApiForm.isDefault} type="checkbox" onChange={(event) => handleModelApiChange("isDefault", event.target.checked)} />
              设为默认模型 API
            </label>
            {modelApiError ? <p className="inline-error">模型 API 保存失败，请检查后端服务和表单内容。</p> : null}
            <div className="form-actions">
              <button className="btn" onClick={closeDialog} type="button">
                取消
              </button>
              <button className="btn primary" disabled={isSavingModelApi} type="submit">
                {isSavingModelApi ? "保存中..." : dialogMode === "edit" ? "保存修改" : "保存模型 API"}
              </button>
            </div>
          </form>
        ) : (
          <p className="inline-error">当前先开放模型 API 配置保存，{selectedToolType === "mcp" ? "MCP Server" : "API Tool"} 表单将在后续接入。</p>
        )}
      </section>
    </div>
  ) : null;

  const portalTarget = typeof document === "undefined" ? null : document.querySelector(".main-shell");

  return (
    <PageScaffold
      className="tools-page"
      title="工具"
      description="统一管理 MCP Server、API Tool 和模型 API，按类别添加与配置。"
      actions={
        <button className="btn primary" onClick={openCreateDialog} type="button">
          添加工具
        </button>
      }
    >
      <div className="tool-category-tabs" role="tablist" aria-label="工具类别">
        <button
          className={activeCategory === "mcp" ? "active" : undefined}
          role="tab"
          aria-selected={activeCategory === "mcp"}
          onClick={() => setActiveCategory("mcp")}
          type="button"
        >
          MCP Server <span>{mcpTools.length}</span>
        </button>
        <button
          className={activeCategory === "api" ? "active" : undefined}
          role="tab"
          aria-selected={activeCategory === "api"}
          onClick={() => setActiveCategory("api")}
          type="button"
        >
          API Tool <span>{apiTools.length}</span>
        </button>
        <button
          className={activeCategory === "model" ? "active" : undefined}
          role="tab"
          aria-selected={activeCategory === "model"}
          onClick={() => setActiveCategory("model")}
          type="button"
        >
          模型 API <span>{modelProviders.length}</span>
        </button>
      </div>

      {activeCategory === "mcp" ? (
        <Panel title="MCP Server" meta={<StatusPill tone={mcpTools.length ? "ok" : "warn"}>{mcpTools.length} 个配置</StatusPill>} strong>
          <SimpleTable
            columns={["工具", "类型", "凭据", "权限", "健康", "最近调用"]}
            rows={mcpTools.map((tool) => [
              tool.name,
              "MCP",
              tool.credential,
              tool.permission,
              <StatusPill key={tool.id} tone={tool.health === "online" ? "ok" : tool.health === "degraded" ? "bad" : "warn"}>
                {tool.health}
              </StatusPill>,
              tool.lastCalledAt
            ])}
          />
        </Panel>
      ) : null}

      {activeCategory === "api" ? (
        <Panel title="API Tool" meta={<StatusPill tone={apiTools.length ? "ok" : "warn"}>{apiTools.length} 个配置</StatusPill>} strong>
          <SimpleTable
            columns={["工具", "类型", "凭据", "权限", "健康", "最近调用"]}
            rows={apiTools.map((tool) => [
              tool.name,
              tool.type === "trigger" ? "TRIGGER" : "API",
              tool.credential,
              tool.permission,
              <StatusPill key={tool.id} tone={tool.health === "online" ? "ok" : tool.health === "degraded" ? "bad" : "warn"}>
                {tool.health}
              </StatusPill>,
              tool.lastCalledAt
            ])}
          />
        </Panel>
      ) : null}

      {activeCategory === "model" ? (
        <Panel title="模型 API" meta={<StatusPill tone={modelProviders.length ? "ok" : "warn"}>{modelProviders.length} 个配置</StatusPill>} strong>
          <SimpleTable
            columns={["名称", "协议", "Base URL", "模型", "密钥", "状态", "默认", "其它", "操作"]}
            rows={modelProviders.map((provider) => [
              provider.name,
              provider.providerType,
              provider.baseUrl,
              provider.model,
              provider.apiKeyPreview,
              <StatusPill key={provider.id} tone={provider.status === "online" ? "ok" : "warn"}>
                {provider.status}
              </StatusPill>,
              provider.isDefault ? "是" : "否",
              <button
                className="table-action"
                disabled={testModelProvider.isPending}
                key={`${provider.id}-test`}
                onClick={() => testModelProvider.mutate({ id: provider.id })}
                type="button"
              >
                {testModelProvider.isPending && testingProviderId === provider.id ? "测试中..." : "测试连接"}
              </button>,
              <button className="table-action" key={`${provider.id}-edit`} onClick={() => openEditDialog(provider)} type="button">
                编辑
              </button>
            ])}
          />
        </Panel>
      ) : null}

      {toolDialog ? (portalTarget ? createPortal(toolDialog, portalTarget) : toolDialog) : null}
    </PageScaffold>
  );
}
