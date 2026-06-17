# 工作流 React Flow 编辑器设计

## 背景

当前工作流页面的画布是普通 DOM 和 CSS 绝对定位实现，只能静态展示节点。产品目标是让用户从智能体页面进入对应工作流，选择不同节点进行配置，并在配置完成后运行测试。本轮只实现前端真实交互闭环，后端保存工作流草稿、节点配置持久化接口放到下一步。

## 目标

- 智能体页面点击对应智能体卡片后，进入该智能体绑定的工作流配置页。
- 工作流页面使用 React Flow 展示真实可交互画布。
- 用户可以点击不同类型节点，并在右侧配置面板看到对应配置项。
- 用户可以配置测试输入、模型 API 和知识库选择。
- 用户可以运行调试测试，并看到请求配置被带入现有运行接口。
- 运行成功后展示最新输出和节点运行状态。

## 非目标

- 不实现后端工作流保存、节点配置持久化接口。
- 不实现拖拽新增节点、自由连线、删除节点等完整编排能力。
- 不实现工具节点的真实工具绑定保存，仅展示基础配置入口和状态。
- 不改造后端 workflow 数据模型。

## 用户流程

1. 用户进入智能体页面。
2. 用户点击某个智能体卡片。
3. 前端把 `agent.id` 和 `agent.workflowId` 写入 `useCanvasConfig`。
4. 应用切换到工作流页面。
5. 工作流页面根据 `selectedWorkflowId` 或 `selectedAgentId` 找到对应工作流。
6. React Flow 画布渲染该工作流节点和按顺序生成的边。
7. 用户点击画布节点。
8. 右侧配置面板根据节点类型展示对应配置。
9. 用户调整配置后点击运行调试。
10. 前端调用现有 `simulateAgentRun`，并把配置带入请求体。
11. 运行成功后写入 `latestRun`，页面展示输出和步骤状态。

## 前端架构

### 依赖

前端新增 `@xyflow/react` 作为 React Flow 实现包。

### 状态

继续使用 `apps/web/src/features/workflows/useCanvasConfig.ts` 作为本轮工作流配置状态中心。

需要保留和扩展的状态：

- `selectedAgentId`
- `selectedWorkflowId`
- `modelProviderId`
- `knowledgeBaseIds`
- `userInput`
- `latestRun`
- `selectedNodeId`

节点配置暂不持久化到后端。模型、知识库和输入作为运行测试配置存放在 Zustand 中。

### 工作流页面

`WorkflowPage` 保持三栏布局：

- 左侧：节点库和当前工作流摘要。
- 中间：React Flow 画布。
- 右侧：节点配置面板和运行结果。

当前 DOM 画布替换为 React Flow：

- 后端返回的 `workflow.nodes` 转为 React Flow `nodes`。
- 本轮默认按节点顺序生成 `edges`。
- 节点点击后调用 `setSelectedNodeId`。
- 选中节点在画布中有明显高亮。
- `latestRun.steps` 存在时，用步骤状态映射节点状态。

### 节点配置面板

配置面板按节点类型切换：

- `trigger`：编辑测试输入 `userInput`。
- `retrieval`：多选知识库 `knowledgeBaseIds`。
- `llm`：选择模型 API `modelProviderId`。
- `tool`：展示工具节点说明和健康状态，真实工具绑定后续实现。
- `human`：展示人工确认节点说明，真实审批配置后续实现。
- `expose`：展示最终输出设置和最近一次运行结果。

如果没有选中节点，默认选中第一个节点。

### 运行调试

运行调试继续使用现有 `useSimulateAgentRun`：

```ts
simulateAgentRun.mutate({
  agentId,
  userInput,
  modelProviderId,
  knowledgeBaseIds
});
```

成功后：

- 调用 `setLatestRun(run)`。
- 右侧结果区展示 `run.finalOutput`。
- 画布节点根据 `run.steps` 中的状态展示成功、警告或失败。

失败后：

- 保留当前配置。
- 展示内联错误提示。

## 测试策略

遵循 TDD，先写失败测试再实现。

重点测试：

- 点击智能体卡片后进入对应工作流页面，并展示该工作流名称。
- 工作流页面渲染 React Flow 节点。
- 点击 `trigger` 节点后，右侧显示测试输入配置。
- 点击 `retrieval` 节点后，右侧显示知识库选择。
- 点击 `llm` 节点后，右侧显示模型 API 选择。
- 修改配置后运行调试，请求体包含 `agentId`、`userInput`、`modelProviderId`、`knowledgeBaseIds`。
- 运行成功后展示最终输出。

## 视觉和响应式

延续当前控制台的面板、按钮、状态标签和色彩风格。React Flow 画布使用点阵背景、低对比边线和清晰选中态。桌面端保持三栏布局；窄屏下节点库、画布和配置面板改为纵向排列，画布高度固定为可操作区域，避免内容挤压。

## 后续工作

下一步补后端：

- 工作流草稿保存接口。
- 节点配置持久化模型。
- 工作流边持久化。
- 工具节点绑定和校验。
- 运行调试使用保存后的工作流版本。
