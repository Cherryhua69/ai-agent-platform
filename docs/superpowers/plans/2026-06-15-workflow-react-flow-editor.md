# Workflow React Flow Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现前端真实工作流配置闭环：从智能体卡片进入对应工作流，使用 React Flow 选择节点配置，并复用现有运行接口完成测试。

**Architecture:** 工作流配置状态继续集中在 `useCanvasConfig`。`WorkflowPage` 负责把后端工作流节点映射为 React Flow nodes/edges，并根据选中节点渲染右侧配置面板。运行测试继续调用 `useSimulateAgentRun`，成功后把结果写入 `latestRun` 并回显到画布和结果区。

**Tech Stack:** React 19、TypeScript、Vite、TanStack Query、Zustand、Vitest、Testing Library、`@xyflow/react`。

---

## File Structure

- Modify: `apps/web/package.json`
  - 新增 `@xyflow/react` 依赖。
- Modify: `apps/web/src/features/workflows/useCanvasConfig.ts`
  - 新增 `selectedNodeId`、`setSelectedNodeId`，并在切换智能体工作流时重置选中节点。
- Modify: `apps/web/src/features/workflows/WorkflowPage.tsx`
  - 替换当前手写 DOM 画布为 React Flow。
  - 增加节点类型配置面板。
  - 运行测试后把 `latestRun` 写回状态。
- Modify: `apps/web/src/styles/globals.css`
  - 增加 React Flow 容器、节点、边和响应式样式。
- Modify: `apps/web/src/features/workflows/WorkflowPage.test.tsx`
  - 覆盖节点选择、配置面板切换、运行请求体和输出回显。
- Modify: `apps/web/src/app/App.test.tsx`
  - 保留并更新智能体卡片跳转对应工作流的断言。

---

### Task 1: 安装 React Flow 依赖

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: 安装依赖**

Run:

```powershell
pnpm --filter @ai-agent-platform/web add @xyflow/react
```

Expected: `apps/web/package.json` 出现 `@xyflow/react`，`pnpm-lock.yaml` 更新。

- [ ] **Step 2: 运行类型检查确认依赖可解析**

Run:

```powershell
pnpm --filter @ai-agent-platform/web typecheck
```

Expected: 当前可能因为既有代码问题失败；如果失败，确认失败不是 `Cannot find module '@xyflow/react'`。

---

### Task 2: 扩展工作流配置状态

**Files:**
- Modify: `apps/web/src/features/workflows/useCanvasConfig.ts`
- Test: `apps/web/src/features/workflows/WorkflowPage.test.tsx`

- [ ] **Step 1: 写失败测试，验证默认选中第一个节点并可切换到模型节点**

在 `WorkflowPage.test.tsx` 新增测试：

```tsx
it("selects workflow nodes and switches the inspector by node type", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/api/workflows")) {
      return {
        ok: true,
        json: async () => [
          {
            id: "workflow-after-sale",
            agentId: "agent-after-sale",
            name: "售后工单 Agentflow",
            status: "blocked",
            toolHealthStatus: "degraded",
            nodes: [
              { id: "node-trigger", type: "trigger", name: "用户输入", status: "success" },
              { id: "node-retrieval", type: "retrieval", name: "知识库检索", status: "success" },
              { id: "node-llm", type: "llm", name: "模型决策", status: "success" }
            ]
          }
        ]
      };
    }

    if (url.endsWith("/api/model-providers")) {
      return {
        ok: true,
        json: async () => [
          {
            id: "model_provider_local",
            name: "本地模型",
            providerType: "openai-compatible",
            baseUrl: "mock://local",
            model: "local-smoke",
            apiKeyPreview: "sk-...ocal",
            status: "online",
            isDefault: true
          }
        ]
      };
    }

    if (url.endsWith("/api/knowledge-bases")) {
      return { ok: true, json: async () => [] };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<WorkflowPage />, { wrapper: createWrapper() });

  expect(await screen.findByRole("heading", { name: "配置：用户输入" })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /模型决策/ }));

  expect(await screen.findByRole("heading", { name: "配置：模型决策" })).toBeInTheDocument();
  expect(screen.getByLabelText("模型 API")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx
```

Expected: FAIL，原因是当前画布节点不是可点击按钮，且没有 `配置：用户输入` 标题。

- [ ] **Step 3: 扩展 Zustand 状态**

修改 `useCanvasConfig.ts`：

```ts
type CanvasConfigState = {
  selectedAgentId: string;
  selectedWorkflowId: string;
  selectedNodeId: string;
  modelProviderId: string;
  knowledgeBaseIds: string[];
  userInput: string;
  latestRun: RunTrace | null;
  configureAgentWorkflow: (agentId: string, workflowId: string) => void;
  setSelectedNodeId: (selectedNodeId: string) => void;
  setModelProviderId: (modelProviderId: string) => void;
  toggleKnowledgeBaseId: (knowledgeBaseId: string) => void;
  setUserInput: (userInput: string) => void;
  setLatestRun: (latestRun: RunTrace | null) => void;
};

export const useCanvasConfig = create<CanvasConfigState>((set) => ({
  selectedAgentId: "",
  selectedWorkflowId: "",
  selectedNodeId: "",
  modelProviderId: "",
  knowledgeBaseIds: ["kb-after-sale"],
  userInput: "Order ORD-2048 asks whether refund is allowed",
  latestRun: null,
  configureAgentWorkflow: (selectedAgentId, selectedWorkflowId) =>
    set({ selectedAgentId, selectedWorkflowId, selectedNodeId: "", latestRun: null }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setModelProviderId: (modelProviderId) => set({ modelProviderId }),
  toggleKnowledgeBaseId: (knowledgeBaseId) =>
    set((state) => {
      const selected = state.knowledgeBaseIds.includes(knowledgeBaseId);
      return {
        knowledgeBaseIds: selected
          ? state.knowledgeBaseIds.filter((item) => item !== knowledgeBaseId)
          : [...state.knowledgeBaseIds, knowledgeBaseId]
      };
    }),
  setUserInput: (userInput) => set({ userInput }),
  setLatestRun: (latestRun) => set({ latestRun })
}));
```

- [ ] **Step 4: 更新测试清理状态**

在 `afterEach` 的 `useCanvasConfig.setState` 中加入：

```ts
selectedAgentId: "",
selectedWorkflowId: "",
selectedNodeId: "",
```

- [ ] **Step 5: 暂不要求测试通过**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx
```

Expected: 仍 FAIL，失败点进入 `WorkflowPage` 尚未实现的 React Flow 和配置面板。

---

### Task 3: 实现 React Flow 画布和节点选择

**Files:**
- Modify: `apps/web/src/features/workflows/WorkflowPage.tsx`
- Modify: `apps/web/src/styles/globals.css`
- Test: `apps/web/src/features/workflows/WorkflowPage.test.tsx`

- [ ] **Step 1: 在 WorkflowPage 引入 React Flow**

在 `WorkflowPage.tsx` 顶部增加：

```tsx
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
```

- [ ] **Step 2: 添加节点状态和布局辅助函数**

在组件外新增：

```tsx
const nodePositions = [
  { x: 40, y: 170 },
  { x: 260, y: 210 },
  { x: 480, y: 170 },
  { x: 480, y: 340 },
  { x: 700, y: 250 }
];

function getNodeTone(status: WorkflowNode["status"]) {
  if (status === "failed" || status === "blocked") {
    return "bad";
  }
  if (status === "warning") {
    return "warn";
  }
  return "ok";
}

function createFlowNodes(nodes: WorkflowNode[], selectedNodeId: string, latestRun: RunTrace | null): Node[] {
  return nodes.map((node, index) => {
    const runStep = latestRun?.steps.find((step) => step.type === node.type || step.title === node.name);
    const status = runStep?.status ?? node.status;

    return {
      id: node.id,
      position: nodePositions[index] ?? { x: 80 + index * 210, y: 180 + (index % 2) * 130 },
      data: {
        label: (
          <button className="workflow-flow-node-button" type="button">
            <strong>{node.name}</strong>
            <span>{node.type}</span>
            <StatusPill tone={getNodeTone(status)}>{status}</StatusPill>
          </button>
        )
      },
      selected: selectedNodeId === node.id,
      className: `workflow-flow-node workflow-flow-node-${status}`
    };
  });
}

function createFlowEdges(nodes: WorkflowNode[]): Edge[] {
  return nodes.slice(1).map((node, index) => ({
    id: `${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
    animated: node.status === "warning" || node.status === "failed",
    className: "workflow-flow-edge"
  }));
}
```

确保从 `../../types/domain` 引入 `RunTrace` 和 `WorkflowNode`：

```tsx
import type { RunTrace, WorkflowNode } from "../../types/domain";
```

- [ ] **Step 3: 从 Zustand 读取和设置 selectedNodeId**

在解构 `useCanvasConfig()` 时加入：

```tsx
selectedNodeId,
setSelectedNodeId,
```

在组件内计算当前节点：

```tsx
const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
const flowNodes = createFlowNodes(nodes, selectedNode?.id ?? "", latestRun);
const flowEdges = createFlowEdges(nodes);
```

添加默认选中逻辑：

```tsx
useEffect(() => {
  if (!selectedNodeId && nodes[0]) {
    setSelectedNodeId(nodes[0].id);
  }
}, [nodes, selectedNodeId, setSelectedNodeId]);
```

- [ ] **Step 4: 替换中间画布 JSX**

把现有 `.workflow-canvas` 中 `nodes.map` 的绝对定位节点替换为：

```tsx
<section className="workflow-canvas" aria-label="工作流画布">
  <ReactFlow
    fitView
    nodes={flowNodes}
    edges={flowEdges}
    nodesDraggable={false}
    nodesConnectable={false}
    elementsSelectable
    onNodeClick={(_, node) => setSelectedNodeId(node.id)}
  >
    <Background gap={20} size={1.4} />
    <Controls showInteractive={false} />
  </ReactFlow>
</section>
```

- [ ] **Step 5: 添加 React Flow 样式**

在 `globals.css` 的工作流样式附近加入：

```css
.workflow-canvas .react-flow {
  min-height: 520px;
}

.workflow-flow-node {
  width: 176px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 28px rgba(72, 77, 103, 0.12);
}

.workflow-flow-node.selected {
  border-color: rgba(79, 70, 229, 0.62);
  box-shadow: 0 18px 34px rgba(79, 70, 229, 0.18);
}

.workflow-flow-node-button {
  width: 100%;
  min-height: 98px;
  display: grid;
  gap: 8px;
  justify-items: start;
  border-radius: 18px;
  background: transparent;
  color: var(--text);
  padding: 13px;
  text-align: left;
}

.workflow-flow-node-button strong,
.workflow-flow-node-button span {
  display: block;
}

.workflow-flow-node-button span {
  color: var(--muted);
  font-size: 12px;
}

.workflow-flow-edge {
  stroke: rgba(79, 70, 229, 0.38);
}
```

在移动端媒体查询中加入：

```css
.workflow-canvas .react-flow {
  min-height: 420px;
}
```

- [ ] **Step 6: 运行节点选择测试**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx
```

Expected: 仍可能 FAIL，下一步补配置面板后通过。

---

### Task 4: 实现按节点类型切换的配置面板

**Files:**
- Modify: `apps/web/src/features/workflows/WorkflowPage.tsx`
- Test: `apps/web/src/features/workflows/WorkflowPage.test.tsx`

- [ ] **Step 1: 写失败测试，验证知识库节点配置**

在 `WorkflowPage.test.tsx` 新增测试：

```tsx
it("shows knowledge base configuration when selecting a retrieval node", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/api/workflows")) {
      return {
        ok: true,
        json: async () => [
          {
            id: "workflow-after-sale",
            agentId: "agent-after-sale",
            name: "售后工单 Agentflow",
            status: "blocked",
            toolHealthStatus: "degraded",
            nodes: [
              { id: "node-trigger", type: "trigger", name: "用户输入", status: "success" },
              { id: "node-retrieval", type: "retrieval", name: "知识库检索", status: "success" }
            ]
          }
        ]
      };
    }

    if (url.endsWith("/api/model-providers")) {
      return { ok: true, json: async () => [] };
    }

    if (url.endsWith("/api/knowledge-bases")) {
      return {
        ok: true,
        json: async () => [
          {
            id: "kb-after-sale",
            name: "售后政策库",
            source: "上传文档",
            documentCount: 128,
            retrievalStrategy: "Hybrid + Rerank",
            qualityScore: 92,
            status: "ready"
          }
        ]
      };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<WorkflowPage />, { wrapper: createWrapper() });

  fireEvent.click(await screen.findByRole("button", { name: /知识库检索/ }));

  expect(await screen.findByRole("heading", { name: "配置：知识库检索" })).toBeInTheDocument();
  expect(screen.getByLabelText("售后政策库")).toBeChecked();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx
```

Expected: FAIL，原因是右侧配置面板尚未按节点类型切换。

- [ ] **Step 3: 新增配置面板渲染函数**

在 `WorkflowPage.tsx` 组件内、`handleRunDebug` 之后新增：

```tsx
function renderNodeInspector() {
  if (!selectedNode) {
    return <p className="empty-note">请选择一个节点进行配置。</p>;
  }

  if (selectedNode.type === "trigger") {
    return (
      <label className="field-stack">
        <span>调用需求</span>
        <textarea aria-label="调用需求" value={userInput} onChange={(event) => setUserInput(event.target.value)} rows={4} />
      </label>
    );
  }

  if (selectedNode.type === "retrieval") {
    return (
      <div className="field-stack">
        <span>知识库</span>
        {knowledgeBases.map((knowledgeBase) => (
          <label className="check-row" key={knowledgeBase.id}>
            <input
              aria-label={knowledgeBase.name}
              checked={knowledgeBaseIds.includes(knowledgeBase.id)}
              onChange={() => toggleKnowledgeBaseId(knowledgeBase.id)}
              type="checkbox"
            />
            {knowledgeBase.name}
          </label>
        ))}
        {knowledgeBases.length === 0 ? <p className="empty-note">暂无可选知识库。</p> : null}
      </div>
    );
  }

  if (selectedNode.type === "llm") {
    return (
      <label className="field-stack">
        <span>模型 API</span>
        <select aria-label="模型 API" value={modelProviderId} onChange={(event) => setModelProviderId(event.target.value)}>
          <option value="">请选择模型配置</option>
          {modelProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name} / {provider.model}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (selectedNode.type === "tool") {
    return (
      <div className="run-output">
        <strong>工具节点</strong>
        <p>本轮展示工具节点状态，真实工具绑定和保存将在后端持久化阶段补充。</p>
      </div>
    );
  }

  if (selectedNode.type === "human") {
    return (
      <div className="run-output">
        <strong>人工确认</strong>
        <p>本轮展示人工确认节点，审批人和阻断规则将在后续版本配置。</p>
      </div>
    );
  }

  return (
    <div className="run-output">
      <strong>最终输出</strong>
      <p>{latestRun?.finalOutput ?? "运行调试后展示 finalOutput。"}</p>
    </div>
  );
}
```

- [ ] **Step 4: 替换右侧配置面板 JSX**

把右侧面板中原先固定展示的模型、知识库、调用需求表单替换为：

```tsx
<div className="inspector-section">
  <h2>配置：{selectedNode?.name ?? "未选择节点"}</h2>
  <span>{selectedNode?.type ?? "node"}</span>
  {renderNodeInspector()}
</div>
```

保留 `KeyValueList` 和运行结果区，但更新 `KeyValueList` 的选中节点：

```tsx
["选中节点", selectedNode?.name ?? "未选择"],
```

- [ ] **Step 5: 运行配置面板测试**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx
```

Expected: Task 2 和 Task 4 的节点配置测试 PASS。

---

### Task 5: 更新运行测试用例和输出回显

**Files:**
- Modify: `apps/web/src/features/workflows/WorkflowPage.test.tsx`
- Modify: `apps/web/src/features/workflows/WorkflowPage.tsx`

- [ ] **Step 1: 更新现有运行测试为真实节点配置流程**

调整现有 `"runs the canvas debug flow with configured model and knowledge bases"`：

```tsx
render(<WorkflowPage />, { wrapper: createWrapper() });

fireEvent.click(await screen.findByRole("button", { name: /Configured model/ }));
await waitFor(() => expect(screen.getByLabelText("模型 API")).toHaveValue("model_provider_local"));

fireEvent.click(screen.getByRole("button", { name: "运行调试" }));

await waitFor(() => expect(screen.getByText("Configured model answer")).toBeInTheDocument());
expect(fetchMock).toHaveBeenCalledWith("/api/agents/agent-after-sale/runs", {
  body: JSON.stringify({
    userInput: "Order ORD-2048 asks whether refund is allowed",
    modelProviderId: "model_provider_local",
    knowledgeBaseIds: ["kb-after-sale"]
  }),
  headers: { "Content-Type": "application/json" },
  method: "POST"
});
```

如果当前文件仍使用乱码中文断言，优先使用英文 fixture 名称，避免编码问题扩大。

- [ ] **Step 2: 运行测试确认失败或定位剩余问题**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx
```

Expected: 如果 FAIL，应只剩按钮文案、节点名称或输出回显位置不匹配。

- [ ] **Step 3: 确保按钮和输出文案可测试**

在 `WorkflowPage.tsx` 中保证运行按钮中文文案稳定：

```tsx
{simulateAgentRun.isPending ? "运行中..." : "运行调试"}
```

在运行结果区保留：

```tsx
{latestRun?.finalOutput ? (
  <div className="run-output">
    <strong>智能体调用结果</strong>
    <p>{latestRun.finalOutput}</p>
    <span>{failedStep ? `失败步骤：${failedStep.title}` : "全部步骤通过"}</span>
  </div>
) : null}
```

- [ ] **Step 4: 运行 WorkflowPage 测试确认通过**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx
```

Expected: PASS。

---

### Task 6: 更新智能体卡片跳转回归测试

**Files:**
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/app/App.tsx` if required

- [ ] **Step 1: 写或更新失败测试，断言对应工作流和第一个节点配置出现**

在 `App.test.tsx` 的智能体卡片跳转测试末尾增加：

```tsx
expect(await screen.findByText("合同审阅 Agentflow · 1 个节点")).toBeInTheDocument();
expect(await screen.findByRole("heading", { name: "配置：合同风险识别" })).toBeInTheDocument();
```

如果测试文件保持当前乱码 fixture，使用英文 fixture：

```tsx
name: "Contract review assistant",
workflowName: "Contract review Agentflow",
nodeName: "Contract risk check"
```

并断言对应英文文本。

- [ ] **Step 2: 运行 App 测试确认失败**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- App.test.tsx
```

Expected: 如果 `WorkflowPage` 尚未完成，会 FAIL；完成后应 PASS。

- [ ] **Step 3: 如有必要，保持 App 跳转逻辑不变**

`App.tsx` 当前逻辑已经正确：

```tsx
function handleConfigureAgent(agent: Agent) {
  configureAgentWorkflow(agent.id, agent.workflowId);
  setActiveView("workflow");
}
```

除非测试暴露问题，否则不修改。

- [ ] **Step 4: 运行 App 测试确认通过**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test -- App.test.tsx
```

Expected: PASS。

---

### Task 7: 类型检查、完整测试和视觉验证

**Files:**
- Modify only if verification exposes issues.

- [ ] **Step 1: 运行前端类型检查**

Run:

```powershell
pnpm --filter @ai-agent-platform/web typecheck
```

Expected: PASS。若失败，修复本轮引入的 TypeScript 错误。

- [ ] **Step 2: 运行前端单元测试**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test
```

Expected: PASS。若存在与本轮无关的既有失败，记录失败并至少保证 `WorkflowPage.test.tsx`、`App.test.tsx` 通过。

- [ ] **Step 3: 启动本地前端**

Run:

```powershell
pnpm --filter @ai-agent-platform/web dev
```

Expected: Vite 输出本地地址，通常是 `http://127.0.0.1:5173/`。

- [ ] **Step 4: 用浏览器验证页面**

打开本地地址，操作：

1. 进入智能体页面。
2. 点击一个智能体卡片。
3. 确认进入对应工作流。
4. 点击不同节点，确认右侧配置切换。
5. 修改输入、模型或知识库。
6. 点击运行调试，确认结果展示。

Expected: 页面无明显错位，React Flow 画布非空，节点可选中，右侧配置和输出可读。

---

## Self-Review

- Spec coverage: 已覆盖智能体卡片跳转、React Flow 画布、节点选择、右侧配置、运行调试、输出回显、响应式和测试。
- Placeholder scan: 本计划没有未完成占位标记或未定义的占位任务。
- Type consistency: 使用的状态字段为 `selectedNodeId` / `setSelectedNodeId`，节点类型沿用 `WorkflowNode["type"]`，运行请求沿用现有 `SimulateAgentRunPayload`。
