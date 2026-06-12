# 智能体页面实际功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将智能体页面完善为可填写创建、可选择查看、状态中文化的真实资产管理页面，并移除试运行与 Trace 内容。

**Architecture:** 后端继续使用现有 FastAPI + Repository 结构，只扩展 Agent 创建 DTO、持久化模型和返回映射。前端继续使用 React Query hooks 获取和创建 Agent，页面内维护当前选中 Agent，并通过小型状态映射函数把接口枚举转换成中文展示。

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, pytest, React, TypeScript, React Query, Vitest, Testing Library, GSAP, CSS.

---

## 文件结构

- Modify: `apps/api/app/modules/agent/schemas.py`
  - 让 `AgentCreate` 接收 `modelPolicy`，并保留默认模型策略以兼容旧调用。
- Modify: `apps/api/app/modules/agent/models.py`
  - 增加 `model_policy` 持久化字段。
- Modify: `apps/api/app/modules/agent/repository.py`
  - 创建和列表读取时使用持久化的模型策略。
- Modify: `apps/api/tests/test_agent_repository.py`
  - 覆盖 `modelPolicy` 创建和 session factory 持久化。
- Modify: `apps/api/tests/test_p0_routes.py`
  - 覆盖 `/api/agents` 创建接口接收并返回 `modelPolicy`。
- Modify: `apps/web/src/features/agents/useCreateAgent.ts`
  - 创建请求体增加 `modelPolicy`。
- Modify: `apps/web/src/features/agents/useCreateAgent.test.tsx`
  - 验证请求体包含 `modelPolicy`，不包含负责人。
- Modify: `apps/web/src/features/agents/AgentStudioPage.tsx`
  - 改为真实创建表单、当前 Agent 详情、资产表选择；移除试运行。
- Modify: `apps/web/src/features/agents/AgentStudioPage.test.tsx`
  - 覆盖中文按钮、表单提交、中文状态、选择资产、移除运行内容。
- Modify: `apps/web/src/styles/globals.css`
  - 增加智能体表单、选中行、资源摘要的样式。

---

### Task 1: 后端 Agent 创建字段测试

**Files:**
- Modify: `apps/api/tests/test_agent_repository.py`
- Modify: `apps/api/tests/test_p0_routes.py`

- [ ] **Step 1: 写失败测试**

在 `apps/api/tests/test_agent_repository.py` 中保留现有测试，并把内容调整为：

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.agent.models import AgentModel
from app.modules.agent.repository import AgentRepository
from app.modules.agent.schemas import AgentCreate


def test_create_agent_draft_uses_submitted_model_policy():
    repo = AgentRepository()

    agent = repo.create(
        AgentCreate(
            name="售后政策助手",
            scenario="售后问答",
            modelPolicy="gpt-4.1-mini + strict citation",
        )
    )

    assert agent.id.startswith("agent_")
    assert agent.name == "售后政策助手"
    assert agent.status == "draft"
    assert agent.model_policy == "gpt-4.1-mini + strict citation"


def test_create_agent_draft_keeps_default_model_policy_for_legacy_payloads():
    repo = AgentRepository()

    agent = repo.create(AgentCreate(name="售后政策助手", scenario="售后问答"))

    assert agent.model_policy == "gpt-4.1 + fallback"


def test_agent_repository_persists_model_policy_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[AgentModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = AgentRepository(session_factory=session_factory)
    created = writer.create(
        AgentCreate(
            name="售后政策助手",
            scenario="售后问答",
            modelPolicy="gpt-4.1-mini + strict citation",
        )
    )

    reader = AgentRepository(session_factory=session_factory)
    agents = reader.list()

    assert [agent.id for agent in agents] == [created.id]
    assert agents[0].name == "售后政策助手"
    assert agents[0].scenario == "售后问答"
    assert agents[0].workflow_id == f"flow_{created.id}"
    assert agents[0].model_policy == "gpt-4.1-mini + strict citation"
```

在 `apps/api/tests/test_p0_routes.py` 中更新 `test_create_and_list_agents` 的创建请求与断言：

```python
def test_create_and_list_agents():
    created = client.post(
        "/api/agents",
        json={
            "name": "售后政策助手",
            "scenario": "售后问答",
            "modelPolicy": "gpt-4.1-mini + strict citation",
        },
    )
    assert created.status_code == 201
    created_body = created.json()
    assert created_body["name"] == "售后政策助手"
    assert created_body["modelPolicy"] == "gpt-4.1-mini + strict citation"
    assert created_body["status"] == "draft"

    listed = client.get("/api/agents")
    assert listed.status_code == 200
    agent = next(item for item in listed.json() if item["id"] == created_body["id"])
    assert agent["name"] == "售后政策助手"
    assert agent["modelPolicy"] == "gpt-4.1-mini + strict citation"
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
cd H:\AI\ai-agent-platform\apps\api
pytest tests/test_agent_repository.py tests/test_p0_routes.py -q
```

Expected:

```text
FAILED tests/test_agent_repository.py::test_create_agent_draft_uses_submitted_model_policy
FAILED tests/test_agent_repository.py::test_agent_repository_persists_model_policy_with_session_factory
```

失败原因应指向 `AgentCreate` 不接受 `modelPolicy` 或 `AgentModel` 没有 `model_policy` 字段。

- [ ] **Step 3: 提交测试红灯**

```powershell
git add apps/api/tests/test_agent_repository.py apps/api/tests/test_p0_routes.py
git commit -m "test: cover agent model policy creation"
```

---

### Task 2: 后端 Agent 创建实现

**Files:**
- Modify: `apps/api/app/modules/agent/schemas.py`
- Modify: `apps/api/app/modules/agent/models.py`
- Modify: `apps/api/app/modules/agent/repository.py`

- [ ] **Step 1: 更新 AgentCreate schema**

在 `apps/api/app/modules/agent/schemas.py` 中把 `AgentCreate` 改成：

```python
class AgentCreate(BaseModel):
    name: str = Field(min_length=1)
    scenario: str = Field(min_length=1)
    model_policy: str = Field(default="gpt-4.1 + fallback", alias="modelPolicy", min_length=1)
```

`AgentRead` 保持当前结构：

```python
class AgentRead(BaseModel):
    id: str
    name: str
    scenario: str
    owner: str
    status: str
    model_policy: str = Field(alias="modelPolicy")
    workflow_id: str = Field(alias="workflowId")
    knowledge_base_ids: list[str] = Field(alias="knowledgeBaseIds")
    tool_ids: list[str] = Field(alias="toolIds")
```

- [ ] **Step 2: 更新 SQLAlchemy 模型**

在 `apps/api/app/modules/agent/models.py` 中给 `AgentModel` 增加字段：

```python
model_policy: Mapped[str] = mapped_column(String(120), nullable=False, default="gpt-4.1 + fallback")
```

字段位置放在 `status` 后面：

```python
status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
model_policy: Mapped[str] = mapped_column(String(120), nullable=False, default="gpt-4.1 + fallback")
created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
```

- [ ] **Step 3: 更新 repository 创建与读取**

在 `apps/api/app/modules/agent/repository.py` 中，创建 `AgentRead` 时使用 `payload.model_policy`：

```python
agent = AgentRead(
    id=agent_id,
    name=payload.name,
    scenario=payload.scenario,
    owner="陈晓",
    status="draft",
    modelPolicy=payload.model_policy,
    workflowId=f"flow_{agent_id}",
    knowledgeBaseIds=["kb-after-sale", "kb-warranty"],
    toolIds=["tool-ticket", "tool-order"],
)
```

保存 `AgentModel` 时写入 `model_policy`：

```python
AgentModel(
    id=agent.id,
    name=agent.name,
    scenario=agent.scenario,
    status=agent.status,
    model_policy=agent.model_policy,
)
```

在 `_to_read_model` 中使用 `agent.model_policy`：

```python
return AgentRead(
    id=agent.id,
    name=agent.name,
    scenario=agent.scenario,
    owner="陈晓",
    status=agent.status,
    modelPolicy=agent.model_policy,
    workflowId=f"flow_{agent.id}",
    knowledgeBaseIds=["kb-after-sale", "kb-warranty"],
    toolIds=["tool-ticket", "tool-order"],
)
```

- [ ] **Step 4: 运行后端测试确认通过**

Run:

```powershell
cd H:\AI\ai-agent-platform\apps\api
pytest tests/test_agent_repository.py tests/test_p0_routes.py -q
```

Expected:

```text
passed
```

- [ ] **Step 5: 提交后端实现**

```powershell
git add apps/api/app/modules/agent/schemas.py apps/api/app/modules/agent/models.py apps/api/app/modules/agent/repository.py
git commit -m "feat: persist agent model policy"
```

---

### Task 3: 前端创建 hook 测试与实现

**Files:**
- Modify: `apps/web/src/features/agents/useCreateAgent.test.tsx`
- Modify: `apps/web/src/features/agents/useCreateAgent.ts`

- [ ] **Step 1: 写失败测试**

把 `apps/web/src/features/agents/useCreateAgent.test.tsx` 中的测试改为：

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCreateAgent } from "./useCreateAgent";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useCreateAgent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("调用创建接口时提交名称、场景和模型策略，不提交负责人", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "agent_12345678",
        name: "售后政策助手",
        scenario: "售后问答",
        owner: "陈晓",
        status: "draft",
        modelPolicy: "gpt-4.1-mini + strict citation",
        workflowId: "flow_agent_12345678",
        knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
        toolIds: ["tool-ticket", "tool-order"]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateAgent(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        name: "售后政策助手",
        scenario: "售后问答",
        modelPolicy: "gpt-4.1-mini + strict citation"
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith("/api/agents", {
      body: JSON.stringify({
        name: "售后政策助手",
        scenario: "售后问答",
        modelPolicy: "gpt-4.1-mini + strict citation"
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("owner");
    expect(result.current.data?.workflowId).toBe("flow_agent_12345678");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web test useCreateAgent
```

Expected:

```text
FAIL
```

失败原因应指向 `mutate` payload 类型不支持 `modelPolicy`，或请求体没有提交 `modelPolicy`。

- [ ] **Step 3: 更新 hook 类型**

在 `apps/web/src/features/agents/useCreateAgent.ts` 中把 payload 类型改为导出类型：

```ts
export type CreateAgentPayload = {
  name: string;
  scenario: string;
  modelPolicy: string;
};
```

保持 mutation 调用路径不变：

```ts
export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAgentPayload) => postJson<Agent, CreateAgentPayload>("/api/agents", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
    }
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web test useCreateAgent
```

Expected:

```text
PASS
```

- [ ] **Step 5: 提交 hook 改动**

```powershell
git add apps/web/src/features/agents/useCreateAgent.ts apps/web/src/features/agents/useCreateAgent.test.tsx
git commit -m "feat: submit agent model policy from web"
```

---

### Task 4: 智能体页面测试

**Files:**
- Modify: `apps/web/src/features/agents/AgentStudioPage.test.tsx`

- [ ] **Step 1: 写失败测试**

将 `apps/web/src/features/agents/AgentStudioPage.test.tsx` 替换为：

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentStudioPage } from "./AgentStudioPage";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const existingAgents = [
  {
    id: "agent-after-sale",
    name: "售后政策助手",
    scenario: "售后问答与工单分流",
    owner: "陈晓",
    status: "blocked",
    modelPolicy: "gpt-4.1 + fallback",
    workflowId: "workflow-after-sale",
    knowledgeBaseIds: ["kb-after-sale", "kb-warranty"],
    toolIds: ["tool-create-ticket", "tool-query-order"]
  },
  {
    id: "agent-contract",
    name: "合同审阅助手",
    scenario: "合同风险提示",
    owner: "王宁",
    status: "ready",
    modelPolicy: "gpt-4.1-mini + strict citation",
    workflowId: "workflow-contract",
    knowledgeBaseIds: ["kb-contract"],
    toolIds: ["tool-query-order"]
  }
];

describe("AgentStudioPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("展示创建智能体表单，并移除试运行与 Trace 内容", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => existingAgents
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    expect(await screen.findByLabelText("智能体名称")).toBeInTheDocument();
    expect(screen.getByLabelText("应用场景")).toBeInTheDocument();
    expect(screen.getByLabelText("模型策略")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建智能体" })).toBeInTheDocument();
    expect(screen.queryByText("创建草稿 Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("试运行")).not.toBeInTheDocument();
    expect(screen.queryByText("最新运行")).not.toBeInTheDocument();
    expect(screen.queryByText("Trace 成本")).not.toBeInTheDocument();
  });

  it("提交表单创建智能体，自动选中新智能体，并使用中文状态", async () => {
    const createdAgent = {
      id: "agent-order",
      name: "订单查询助手",
      scenario: "订单状态查询",
      owner: "系统默认",
      status: "draft",
      modelPolicy: "gpt-4.1-mini + strict citation",
      workflowId: "flow_agent-order",
      knowledgeBaseIds: ["kb-order"],
      toolIds: ["tool-query-order"]
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" && String(input).endsWith("/api/agents")) {
        return {
          ok: true,
          json: async () => createdAgent
        };
      }

      return {
        ok: true,
        json: async () => existingAgents
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    fireEvent.change(await screen.findByLabelText("智能体名称"), { target: { value: "订单查询助手" } });
    fireEvent.change(screen.getByLabelText("应用场景"), { target: { value: "订单状态查询" } });
    fireEvent.change(screen.getByLabelText("模型策略"), { target: { value: "gpt-4.1-mini + strict citation" } });
    fireEvent.click(screen.getByRole("button", { name: "创建智能体" }));

    await waitFor(() => expect(screen.getByText("已创建智能体：订单查询助手")).toBeInTheDocument());
    expect(screen.getByText("flow_agent-order")).toBeInTheDocument();
    expect(screen.getAllByText("草稿").length).toBeGreaterThan(0);
    expect(JSON.parse(String(fetchMock.mock.calls.find((call) => call[1]?.method === "POST")?.[1]?.body))).toEqual({
      name: "订单查询助手",
      scenario: "订单状态查询",
      modelPolicy: "gpt-4.1-mini + strict citation"
    });
  });

  it("点击资产表中的查看后切换当前智能体详情", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => existingAgents
      })
    );

    render(<AgentStudioPage />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "查看 合同审阅助手" }));

    expect(screen.getByText("当前智能体：合同审阅助手")).toBeInTheDocument();
    expect(screen.getByText("workflow-contract")).toBeInTheDocument();
    expect(screen.getByText("就绪")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web test AgentStudioPage
```

Expected:

```text
FAIL
```

失败原因应包括找不到“智能体名称”表单 label、仍存在旧按钮或无法点击“查看 合同审阅助手”。

- [ ] **Step 3: 提交页面测试红灯**

```powershell
git add apps/web/src/features/agents/AgentStudioPage.test.tsx
git commit -m "test: cover real agent page workflow"
```

---

### Task 5: 智能体页面实现

**Files:**
- Modify: `apps/web/src/features/agents/AgentStudioPage.tsx`

- [ ] **Step 1: 替换页面实现**

将 `apps/web/src/features/agents/AgentStudioPage.tsx` 改为以下结构：

```tsx
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
```

- [ ] **Step 2: 运行页面测试确认主要行为通过**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web test AgentStudioPage
```

Expected:

```text
PASS
```

如果失败原因是 `sr-only` 类不存在但按钮可访问名正常，继续 Task 6 补样式后重跑。

- [ ] **Step 3: 运行 hook 测试防止回归**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web test useCreateAgent
```

Expected:

```text
PASS
```

- [ ] **Step 4: 提交页面实现**

```powershell
git add apps/web/src/features/agents/AgentStudioPage.tsx
git commit -m "feat: build real agent management page"
```

---

### Task 6: 智能体页面样式

**Files:**
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: 写样式前运行页面测试**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web test AgentStudioPage
```

Expected:

```text
PASS
```

如果这里失败，先回到 Task 5 修正行为，不用样式掩盖行为问题。

- [ ] **Step 2: 增加表单与表格选中样式**

在 `apps/web/src/styles/globals.css` 中追加：

```css
.agent-workspace {
  align-items: stretch;
}

.agent-form {
  display: grid;
  gap: 14px;
}

.agent-form label {
  display: grid;
  gap: 8px;
  color: var(--muted-text);
  font-size: 13px;
  font-weight: 700;
}

.agent-form input,
.agent-form textarea {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 10px 12px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.76);
  font: inherit;
  outline: none;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.agent-form textarea {
  resize: vertical;
  line-height: 1.5;
}

.agent-form input:focus,
.agent-form textarea:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(83, 129, 168, 0.18);
  background: #fff;
}

.table-action {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 12px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.72);
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.table-action:hover,
.table-action:focus-visible {
  border-color: var(--brand);
  background: #fff;
  transform: translateY(-1px);
}

.current-row-label {
  display: inline-flex;
  margin-left: 8px;
  border: 1px solid rgba(83, 129, 168, 0.26);
  border-radius: 999px;
  padding: 2px 8px;
  color: var(--brand);
  background: rgba(205, 231, 251, 0.46);
  font-size: 12px;
  font-weight: 800;
}

.empty-state {
  margin: 0;
  color: var(--muted-text);
  line-height: 1.6;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 3: 运行页面测试**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web test AgentStudioPage
```

Expected:

```text
PASS
```

- [ ] **Step 4: 提交样式**

```powershell
git add apps/web/src/styles/globals.css
git commit -m "style: polish agent management page"
```

---

### Task 7: 全量验证与收尾

**Files:**
- Verify only.

- [ ] **Step 1: 运行前端单元测试**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web test
```

Expected:

```text
PASS
```

- [ ] **Step 2: 运行前端类型检查**

Run:

```powershell
corepack pnpm --filter @ai-agent-platform/web typecheck
```

Expected:

```text
PASS
```

- [ ] **Step 3: 运行后端测试**

Run:

```powershell
cd H:\AI\ai-agent-platform\apps\api
pytest
```

Expected:

```text
passed
```

- [ ] **Step 4: 检查工作区状态**

Run:

```powershell
git status --short
```

Expected:

```text
只看到本轮未提交文件，或工作区干净；不能出现意外回退用户既有改动。
```

- [ ] **Step 5: 如需最终提交，提交剩余验证修正**

如果 Task 7 中因为测试修正产生了文件变更：

```powershell
git add <changed-files>
git commit -m "test: verify agent management page"
```

---

## 自检结果

- 规格覆盖：计划覆盖创建表单、无负责人、状态中文化、资产表选择、移除试运行与 Trace、后端 `modelPolicy` 持久化。
- 占位扫描：计划不包含未定义占位步骤，每个代码改动步骤都给出具体目标代码或测试代码。
- 类型一致性：前端创建 payload 统一为 `name/scenario/modelPolicy`；后端 Pydantic 字段统一为 `model_policy`，接口别名为 `modelPolicy`。
- 范围控制：本计划不实现工作流深度跳转、版本管理、运行调试或发布历史。
