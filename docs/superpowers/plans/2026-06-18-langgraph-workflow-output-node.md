# LangGraph 工作流编排与输出节点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可配置的输出节点，并让已保存的用户输入、知识检索、LLM、条件、并行汇合、循环和输出节点通过 LangGraph 真实执行。

**Architecture:** 前端从 React Flow 的节点和边实时派生递归上游变量；后端通过节点注册表、图校验器和动态编译器把数据库快照转换为 LangGraph `StateGraph`。现有智能体运行接口保持不变，但改为加载对应工作流、执行编译图并写入节点级追踪。

**Tech Stack:** React 19、TypeScript、React Flow、Vitest、FastAPI、Pydantic、SQLAlchemy、LangChain、LangGraph、Pytest

---

## 文件结构

- 创建 `apps/web/src/features/workflows/workflowVariables.ts`：节点输出声明、递归上游遍历和输出配置解析。
- 修改 `apps/web/src/features/workflows/WorkflowPage.tsx`：新增输出、条件、循环节点的放置和配置交互。
- 修改 `apps/web/src/features/workflows/WorkflowPage.test.tsx`：覆盖节点交互、递归变量和保存契约。
- 修改 `apps/web/src/styles/globals.css`：输出变量行、控制节点和终点节点样式。
- 修改 `apps/api/pyproject.toml`：引入 LangGraph。
- 创建 `apps/api/app/modules/workflow/graph_types.py`：运行状态、配置模型和 reducer。
- 创建 `apps/api/app/modules/workflow/node_registry.py`：节点输出声明和执行处理器。
- 创建 `apps/api/app/modules/workflow/graph_validator.py`：图结构、分支、循环和变量引用校验。
- 创建 `apps/api/app/modules/workflow/graph_compiler.py`：将持久化图转换为 LangGraph。
- 创建 `apps/api/app/modules/workflow/graph_executor.py`：执行编译图并生成运行结果。
- 修改 `apps/api/app/modules/workflow/repository.py`：按智能体查询工作流。
- 修改 `apps/api/app/modules/agent/run_service.py`、`apps/api/app/modules/agent/router.py`：切换到工作流执行器。
- 创建 `apps/api/tests/test_workflow_graph_validator.py`、`apps/api/tests/test_workflow_graph_executor.py`：后端编排测试。
- 修改 `apps/api/tests/test_agent_run_routes.py`：验证真实画布运行链路。

### Task 1: 前端递归上游变量模型

**Files:**
- Create: `apps/web/src/features/workflows/workflowVariables.ts`
- Test: `apps/web/src/features/workflows/workflowVariables.test.ts`

- [ ] **Step 1: 编写失败测试**

测试线性链、并行汇合、断边和循环图，断言输出节点能拿到所有递归可达变量且不会重复：

```ts
expect(getReachableUpstreamVariables("output", nodes, edges).map((item) => item.value)).toEqual([
  "input.question",
  "llm.text",
  "llm.reasoning_content",
  "llm.usage",
  "retrieval.result"
]);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @ai-agent-platform/web test -- workflowVariables.test.ts`
Expected: FAIL，提示 `getReachableUpstreamVariables` 尚不存在。

- [ ] **Step 3: 实现纯函数**

```ts
export type WorkflowVariableOption = {
  nodeId: string;
  nodeName: string;
  name: string;
  value: string;
  valueType: "String" | "Object" | "Array[Object]" | "File" | "Array[File]";
};

export function getReachableUpstreamVariables(
  targetId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowVariableOption[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>([targetId]);
  const queue = edges.filter((edge) => edge.target === targetId).map((edge) => edge.source);
  const upstream: WorkflowNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node) upstream.push(node);
    edges.filter((edge) => edge.target === id).forEach((edge) => queue.push(edge.source));
  }
  return upstream.flatMap(getDeclaredNodeOutputs);
}
```

`getDeclaredNodeOutputs` 明确声明 trigger、llm、retrieval 的变量类型；comment、condition、loop 返回空数组。

- [ ] **Step 4: 运行测试并确认通过**

Run: `pnpm --filter @ai-agent-platform/web test -- workflowVariables.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/workflows/workflowVariables.ts apps/web/src/features/workflows/workflowVariables.test.ts
git commit -m "feat: 添加工作流递归变量解析"
```

### Task 2: 输出节点交互与保存

**Files:**
- Modify: `apps/web/src/features/workflows/WorkflowPage.tsx:64,459-620,744-1000,1046-1100`
- Modify: `apps/web/src/features/workflows/WorkflowPage.test.tsx:742`
- Modify: `apps/web/src/styles/globals.css:1158,1698-1990`

- [ ] **Step 1: 扩充现有输出节点失败测试**

在现有 `configures output node variables...` 用例中增加：工具栏能添加“输出”、放置后只有左侧 handle、递归候选包含间接上游、删除连线后候选消失、空名称或空值时保存按钮不可提交。

```ts
expect(outputNode.querySelector(".workflow-handle-left")).toBeInTheDocument();
expect(outputNode.querySelector(".workflow-handle-right")).not.toBeInTheDocument();
expect(screen.getByRole("option", { name: "LLM / text String" })).toBeInTheDocument();
```

- [ ] **Step 2: 运行单测并确认失败**

Run: `pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx`
Expected: FAIL 于“添加输出节点”或输出配置控件断言。

- [ ] **Step 3: 实现输出节点**

将 `PendingPlacement` 扩展为 `"llm" | "output" | "condition" | "loop" | "comment" | null`。输出节点创建结构固定为：

```ts
{
  id,
  type: "expose",
  name: "输出",
  status: "success",
  config: { outputVariables: [] }
}
```

输出变量更新使用不可变数组：

```ts
function updateOutputVariable(id: string, patch: Partial<OutputVariable>) {
  const current = getOutputVariables(selectedNode);
  updateSelectedNodeConfig({
    outputVariables: current.map((item) => item.id === id ? { ...item, ...patch } : item)
  });
}
```

节点渲染时 `expose` 不创建右侧 source handle。检查所有 `outputVariables` 的 `name`、`value` 和名称唯一性，存在错误时显示中文行内提示并阻止保存。

- [ ] **Step 4: 添加样式并运行测试**

输出变量行使用两列输入区加删除按钮，窄屏改为纵向排列；复用现有色彩、边框、圆角和间距 token。

Run: `pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx && pnpm --filter @ai-agent-platform/web typecheck`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/workflows/WorkflowPage.tsx apps/web/src/features/workflows/WorkflowPage.test.tsx apps/web/src/styles/globals.css
git commit -m "feat: 实现工作流输出节点配置"
```

### Task 3: 条件与循环节点画布配置

**Files:**
- Modify: `apps/web/src/features/workflows/WorkflowPage.tsx`
- Modify: `apps/web/src/features/workflows/WorkflowPage.test.tsx`
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: 编写失败测试**

测试添加条件节点和循环节点，保存后的配置分别满足：

```ts
expect(condition.config).toMatchObject({
  variable: "node-llm.text",
  operator: "contains",
  compareValue: "通过",
  defaultBranch: "default"
});
expect(loop.config).toMatchObject({
  variable: "node-llm.text",
  operator: "not_empty",
  maxIterations: 10
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx`
Expected: FAIL，找不到添加条件或循环节点按钮。

- [ ] **Step 3: 实现配置表单**

条件节点配置变量、运算符、比较值和默认分支；循环节点配置变量、运算符、比较值、最大次数。变量候选同样使用递归上游纯函数，比较运算符固定为 `eq | neq | contains | gt | lt | empty | not_empty`，最大次数限制为 1 至 100。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @ai-agent-platform/web test -- WorkflowPage.test.tsx && pnpm --filter @ai-agent-platform/web typecheck`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/workflows/WorkflowPage.tsx apps/web/src/features/workflows/WorkflowPage.test.tsx apps/web/src/styles/globals.css
git commit -m "feat: 添加条件与循环节点配置"
```

### Task 4: LangGraph 状态与图校验

**Files:**
- Modify: `apps/api/pyproject.toml`
- Create: `apps/api/app/modules/workflow/graph_types.py`
- Create: `apps/api/app/modules/workflow/graph_validator.py`
- Create: `apps/api/tests/test_workflow_graph_validator.py`

- [ ] **Step 1: 安装依赖并写失败测试**

在 `pyproject.toml` 增加 `langgraph>=1.0,<2.0`。测试有效线性图，以及无输出、悬空边、输出有出边、非法递归变量、条件无默认分支、循环次数超过 100。

```python
with pytest.raises(WorkflowGraphValidationError, match="输出节点不能存在出边"):
    validator.validate(workflow)
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd apps/api; pytest tests/test_workflow_graph_validator.py -q`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现状态和校验器**

```python
class WorkflowState(TypedDict):
    inputs: dict[str, object]
    node_outputs: Annotated[dict[str, dict[str, object]], merge_nested_dicts]
    final_output: object | None
    trace_steps: Annotated[list[dict[str, object]], operator.add]
    route_decisions: Annotated[dict[str, str], operator.or_]
    iteration_counts: Annotated[dict[str, int], operator.or_]

class WorkflowGraphValidationError(ValueError):
    def __init__(self, messages: list[str]) -> None:
        self.messages = messages
        super().__init__("；".join(messages))
```

校验器复用与前端相同的反向遍历语义，验证输出变量引用属于递归可达变量集合。

- [ ] **Step 4: 运行测试并确认通过**

Run: `cd apps/api; pytest tests/test_workflow_graph_validator.py -q`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/api/pyproject.toml apps/api/app/modules/workflow/graph_types.py apps/api/app/modules/workflow/graph_validator.py apps/api/tests/test_workflow_graph_validator.py
git commit -m "feat: 添加工作流图状态与校验"
```

### Task 5: 节点注册表与当前业务节点执行

**Files:**
- Create: `apps/api/app/modules/workflow/node_registry.py`
- Create: `apps/api/tests/test_workflow_node_registry.py`

- [ ] **Step 1: 编写失败测试**

分别测试 trigger、retrieval、llm、expose：输出键名正确，变量引用能从 `inputs` 和 `node_outputs` 解析，单变量输出为字符串，多变量输出保留字典。

```python
result = registry.execute("expose", output_node, state)
assert result["final_output"] == {"answer": "已通过", "usage": {"tokens": 12}}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd apps/api; pytest tests/test_workflow_node_registry.py -q`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现注册表**

```python
class WorkflowNodeRegistry:
    OUTPUTS = {
        "trigger": None,
        "retrieval": {"result": "Array[Object]"},
        "llm": {"text": "String", "reasoning_content": "String", "usage": "Object"},
        "expose": None,
        "condition": {},
        "loop": {},
    }

    def build_handler(self, node: WorkflowNodeRead) -> Callable[[WorkflowState], dict[str, object]]:
        handler = getattr(self, f"_run_{node.type}", None)
        if handler is None:
            raise WorkflowGraphValidationError([f"不支持的节点类型：{node.type}"])
        return lambda state: handler(node, state)
```

LLM 处理器调用现有 `LangChainModelClient`；检索处理器调用 `KnowledgeRepository`；每个处理器返回本节点命名空间输出和一条追踪记录。

- [ ] **Step 4: 运行测试并确认通过**

Run: `cd apps/api; pytest tests/test_workflow_node_registry.py -q`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/api/app/modules/workflow/node_registry.py apps/api/tests/test_workflow_node_registry.py
git commit -m "feat: 实现工作流节点执行注册表"
```

### Task 6: 动态编译、条件、并行与循环

**Files:**
- Create: `apps/api/app/modules/workflow/graph_compiler.py`
- Create: `apps/api/app/modules/workflow/graph_executor.py`
- Create: `apps/api/tests/test_workflow_graph_executor.py`

- [ ] **Step 1: 编写失败测试**

创建四组内存工作流：线性、条件命中指定分支、两个分支并行后汇合、循环执行三次后退出。使用假的节点注册表记录执行次数和顺序。

```python
result = executor.execute(parallel_workflow, {"question": "开始"})
assert result.final_output == {"left": "L", "right": "R"}
assert {step["nodeId"] for step in result.trace_steps} >= {"left", "right", "join"}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd apps/api; pytest tests/test_workflow_graph_executor.py -q`
Expected: FAIL，编译器不存在。

- [ ] **Step 3: 实现编译器**

```python
builder = StateGraph(WorkflowState)
for node in executable_nodes:
    builder.add_node(node.id, registry.build_handler(node))
builder.add_edge(START, trigger.id)
```

普通多出口逐一 `add_edge` 形成并行；多前驱静态汇合使用 `add_edge([source_a, source_b], target)`；条件和循环节点使用 `add_conditional_edges`。循环路由达到 `maxIterations` 后返回退出节点，并在 `invoke` 配置中设置 `recursion_limit`。

- [ ] **Step 4: 实现执行器并运行测试**

执行器先调用 validator，再编译和 invoke；将最终状态转换为 `WorkflowExecutionResult(final_output, trace_steps, cost_cny)`。

Run: `cd apps/api; pytest tests/test_workflow_graph_executor.py -q`
Expected: PASS，四类图均通过。

- [ ] **Step 5: 提交**

```bash
git add apps/api/app/modules/workflow/graph_compiler.py apps/api/app/modules/workflow/graph_executor.py apps/api/tests/test_workflow_graph_executor.py
git commit -m "feat: 动态编译并执行 LangGraph 工作流"
```

### Task 7: 接入智能体运行与追踪

**Files:**
- Modify: `apps/api/app/modules/workflow/repository.py:78`
- Modify: `apps/api/app/modules/agent/run_service.py:11`
- Modify: `apps/api/app/modules/agent/router.py:14`
- Modify: `apps/api/tests/test_agent_run_routes.py`

- [ ] **Step 1: 编写失败的路由测试**

先保存包含 trigger、llm、expose 的画布，再调用 `/api/agents/{agent_id}/runs`，断言最终输出来自 expose 映射且步骤标题使用画布节点名。再增加非法图返回 422 的测试。

```python
assert body["finalOutput"]
assert [step["title"] for step in body["steps"]] == ["用户输入", "LLM", "输出"]
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd apps/api; pytest tests/test_agent_run_routes.py -q`
Expected: FAIL，当前仍执行固定单模型流程。

- [ ] **Step 3: 接入执行器**

为仓储增加 `get_by_agent_id(agent_id)`；`AgentRunService` 注入工作流仓储和执行器，运行时加载工作流。将 `WorkflowGraphValidationError` 在路由层转换为 HTTP 422，响应 `detail` 包含中文校验信息。

```python
workflow = self._workflows.get_by_agent_id(agent_id)
if workflow is None:
    raise WorkflowGraphValidationError(["智能体尚未配置工作流"])
execution = self._executor.execute(workflow, request.user_input)
```

- [ ] **Step 4: 运行后端测试**

Run: `cd apps/api; pytest tests/test_agent_run_routes.py tests/test_agent_run_model_flow.py tests/test_workflow_routes.py -q`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/api/app/modules/workflow/repository.py apps/api/app/modules/agent/run_service.py apps/api/app/modules/agent/router.py apps/api/tests/test_agent_run_routes.py
git commit -m "feat: 使用 LangGraph 执行智能体工作流"
```

### Task 8: 前后端联调与完整验证

**Files:**
- Modify: `apps/web/src/features/workflows/WorkflowPage.tsx`
- Modify: `apps/web/src/features/workflows/WorkflowPage.test.tsx`
- Modify: `apps/api/tests/test_agent_run_routes.py`

- [ ] **Step 1: 将前端运行调试绑定已保存图**

运行前先校验输出配置；保存成功后再调用现有智能体运行接口，错误响应展示后端节点级校验信息。不得继续展示固定 `finalOutput` 占位逻辑。

- [ ] **Step 2: 运行全量自动测试**

Run: `pnpm --filter @ai-agent-platform/web test`
Expected: PASS。

Run: `pnpm --filter @ai-agent-platform/web typecheck`
Expected: PASS。

Run: `cd apps/api; pytest -q`
Expected: PASS。

- [ ] **Step 3: 构建前端**

Run: `pnpm --filter @ai-agent-platform/web build`
Expected: 成功生成 Vite 构建产物，无 TypeScript 错误。

- [ ] **Step 4: 浏览器验证**

启动 API 和 Web，手动验证：添加输出节点、配置递归上游变量、线性运行、条件分支、并行汇合、三次循环退出、断边后候选消失、非法图错误提示。截图检查节点连接点、配置面板溢出和窄屏布局。

- [ ] **Step 5: 最终提交**

```bash
git add apps/web/src/features/workflows/WorkflowPage.tsx apps/web/src/features/workflows/WorkflowPage.test.tsx apps/api/tests/test_agent_run_routes.py
git commit -m "test: 完成 LangGraph 工作流端到端验证"
```
