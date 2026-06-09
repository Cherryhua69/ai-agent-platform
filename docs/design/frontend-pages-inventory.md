# Frontend Pages Inventory

本文列出 MVP 前端页面、核心组件、交互状态和验收标准。优先级来自 `docs/architecture/information-architecture.md`，验收标准来自 `docs/prd/mvp-requirements.md` 并补充 UI 工程视角。

## 1. P0 页面

### 1.1 工作台总览

- 路由：`/dashboard`
- 目标：让用户快速判断平台健康状态，并跳转到异常、发布、评测和运行详情。
- 核心组件：`MetricTile`、`EnvironmentSwitcher`、`AlertList`、`PendingReleaseTable`、`FailedEvaluationTable`、`McpIssueTable`、`RecentRunsTable`。
- 交互状态：空间/项目/环境筛选、指标加载、异常为空、异常聚合、跳转到对应资源。
- 验收标准：展示智能体数量、运行次数、成功率、平均延迟、Token 成本和失败率；用户可从异常项跳转到智能体、运行日志、工具或评测页面。

### 1.2 智能体列表

- 路由：`/agents`
- 目标：管理所有智能体资产。
- 核心组件：`AgentTable`、`AgentStatusBadge`、`FilterBar`、`CreateAgentDialog`、`BulkActionBar`。
- 交互状态：搜索、状态筛选、负责人筛选、标签筛选、排序、分页、空状态、批量归档。
- 验收标准：用户可以创建智能体草稿；列表展示状态、模型、调用量、成功率、版本、负责人和最近更新时间。

### 1.3 智能体详情

- 路由：`/agents/:agentId`
- 目标：查看智能体配置、版本、绑定资源、运行概况和发布检查。
- 核心组件：`AgentDetailHeader`、`AgentOverviewMetrics`、`ResourceBindingList`、`VersionSummaryTable`、`ReleaseGateChecklist`、`RecentRunsTable`。
- 交互状态：编辑入口、复制智能体、归档确认、状态异常、发布阻断、资源跳转。
- 验收标准：用户可以查看基础配置、版本、绑定工具/知识库、运行指标和发布门禁状态。

### 1.4 智能体配置

- 路由：`/agents/:agentId/config`
- 目标：配置名称、描述、头像、标签、负责人、模型、系统提示词、变量和上下文策略。
- 核心组件：`AgentBasicForm`、`ModelConfigForm`、`PromptEditor`、`VariableTable`、`ContextStrategyForm`。
- 交互状态：只读态、编辑态、字段错误、保存中、保存失败、未保存离开确认。
- 验收标准：用户可以修改配置并保存为草稿版本，错误字段有明确提示。

### 1.5 工作流编排器

- 路由：`/agents/:agentId/workflow`、`/workflows/:workflowId`
- 目标：通过可视化节点画布定义智能体执行流程。
- 核心组件：`WorkflowToolbar`、`NodePalette`、`WorkflowCanvas`、`WorkflowNode`、`WorkflowEdge`、`NodeInspector`、`DebugConsole`、`RunResultPanel`。
- 交互状态：拖拽节点、连接节点、节点选择、属性编辑、连接校验、保存草稿、运行调试、节点错误定位、画布缩放。
- 验收标准：用户可以搭建包含 LLM、知识库检索、MCP 工具调用和条件分支的基础工作流；调试后能查看每个节点输入、输出、耗时和错误。

### 1.6 MCP Server 列表

- 路由：`/mcp/servers`
- 目标：管理 MCP Server 连接。
- 核心组件：`McpServerTable`、`ConnectionStatusBadge`、`AddServerDialog`、`SyncToolsButton`。
- 交互状态：添加 Server、连接测试、同步工具、状态筛选、异常状态、权限不足。
- 验收标准：用户可以注册 MCP Server 并查看连接状态、工具数量、最近同步时间和异常原因。

### 1.7 工具详情

- 路由：`/mcp/tools/:toolId`
- 目标：查看工具 schema、权限、调用监控和错误诊断。
- 核心组件：`ToolDetailHeader`、`SchemaViewer`、`PermissionMatrix`、`ToolCallMetrics`、`ToolCallLogTable`。
- 交互状态：schema 只读、权限编辑、密钥缺失、工具异常标记、调用日志筛选。
- 验收标准：用户可以查看输入输出 schema、权限策略、调用日志、失败原因、延迟和调用量。

### 1.8 运行列表

- 路由：`/runs`
- 目标：检索和筛选智能体运行记录。
- 核心组件：`RunTable`、`RunStatusBadge`、`RunFilterBar`、`CostLatencySummary`。
- 交互状态：按智能体、状态、时间、渠道筛选；失败运行突出；分页；导出入口预留。
- 验收标准：用户可以按条件定位一次运行，并进入 Trace 详情。

### 1.9 Trace 详情

- 路由：`/runs/:runId`
- 目标：诊断一次运行的完整链路。
- 核心组件：`TraceHeader`、`TraceTimeline`、`TraceStepDetail`、`PromptPreview`、`ModelCallPanel`、`ToolCallPanel`、`RetrievalHitPanel`、`ErrorStackPanel`。
- 交互状态：步骤切换、失败步骤定位、输入输出折叠、长文本复制、敏感字段遮罩。
- 验收标准：用户可以判断失败来自模型、知识检索、工具调用还是权限问题，并看到 token、耗时、成本和错误栈。

## 2. P1 页面

### 2.1 知识库列表

- 路由：`/knowledge`
- 目标：管理可检索知识资源。
- 核心组件：`KnowledgeBaseTable`、`CreateKnowledgeBaseDialog`、`KnowledgeStatusBadge`。
- 交互状态：创建、搜索、状态筛选、文档数量、索引状态、绑定智能体入口。
- 验收标准：用户可以创建知识库并进入文档管理。

### 2.2 文档管理

- 路由：`/knowledge/:knowledgeBaseId/documents`
- 目标：上传文档、导入网页或通过 API 导入数据。
- 核心组件：`DocumentTable`、`UploadDocumentDialog`、`ImportUrlDialog`、`IndexingProgress`。
- 交互状态：上传中、解析失败、索引中、重新索引、删除确认。
- 验收标准：用户可以导入文档，并查看文档状态和 chunk 数。

### 2.3 分段配置

- 路由：`/knowledge/:knowledgeBaseId/chunking`
- 目标：配置分段策略、Embedding 模型和检索参数。
- 核心组件：`ChunkStrategyForm`、`EmbeddingModelSelect`、`RetrievalConfigForm`。
- 交互状态：参数校验、保存草稿、保存失败、需要重新索引提示。
- 验收标准：用户可以配置 TopK、相似度阈值、Embedding 模型和分段策略。

### 2.4 检索测试

- 路由：`/knowledge/:knowledgeBaseId/retrieval-test`
- 目标：用测试问题查看检索结果和引用来源。
- 核心组件：`RetrievalTestInput`、`RetrievalResultList`、`CitationPreview`。
- 交互状态：运行中、无命中、低相似度、引用展开、复制片段。
- 验收标准：用户可以输入问题并查看命中片段、分数和来源。

### 2.5 评测列表

- 路由：`/evaluations`
- 目标：管理测试集和批量评测运行。
- 核心组件：`DatasetTable`、`EvaluationRunTable`、`CreateDatasetDialog`、`RunEvaluationDialog`。
- 交互状态：创建测试集、批量运行、运行中、失败、通过率排序。
- 验收标准：用户可以在发布前选择测试集并运行评测。

### 2.6 评测报告

- 路由：`/evaluations/reports/:evaluationRunId`
- 目标：查看通过率、准确率、平均延迟、平均成本和工具调用成功率。
- 核心组件：`EvaluationSummary`、`MetricComparison`、`CaseResultTable`、`ManualScoringPanel`。
- 交互状态：人工评分、失败用例筛选、指标阈值标记、发布门禁阻断原因。
- 验收标准：关键测试未通过时，页面给出明确阻断原因。

### 2.7 发布配置

- 路由：`/releases`、`/channels/web-chat`、`/channels/api`
- 目标：将智能体发布到 Web Chat 和 API。
- 核心组件：`ReleaseTable`、`ChannelConfigForm`、`AccessKeyTable`、`DomainAllowlistEditor`、`RollbackDialog`。
- 交互状态：发布检查、发布中、已发布、已阻断、回滚确认、密钥显示/隐藏。
- 验收标准：用户可以将通过评测的智能体发布到测试环境或生产环境，并查看版本、渠道和运行状态。

### 2.8 权限设置

- 路由：`/settings/workspaces`、`/settings/members`
- 目标：管理空间、项目、成员和角色。
- 核心组件：`WorkspaceTable`、`MemberTable`、`RoleSelect`、`PermissionMatrix`。
- 交互状态：邀请成员、变更角色、移除成员、权限不足、审计提示。
- 验收标准：用户只能访问授权空间和资源，高风险权限变更可追溯。

## 3. P2 页面

### 3.1 审计日志

- 路由：`/settings/audit-logs`
- 目标：查看关键操作记录。
- 核心组件：`AuditLogTable`、`AuditFilterBar`、`AuditDetailDrawer`。
- 验收标准：管理员可以按 actor、action、resource、时间筛选审计记录。

### 3.2 模型供应商

- 路由：`/settings/model-providers`
- 目标：配置模型供应商、模型列表和密钥引用。
- 核心组件：`ProviderTable`、`ProviderConfigForm`、`ModelCapabilityTable`。
- 验收标准：管理员可以查看模型可用状态并配置供应商。

### 3.3 企业 IM 渠道

- 路由：`/channels/enterprise-im`
- 目标：预留企业微信、飞书、钉钉发布入口。
- 核心组件：`ChannelPlaceholderPanel`、`IntegrationRequirementList`。
- 验收标准：MVP 显示预留状态，不阻塞 Web Chat 和 API 发布。

### 3.4 模板市场

- 路由：`/templates`
- 目标：预留智能体和工作流模板入口。
- 核心组件：`TemplatePlaceholderPanel`。
- 验收标准：P2 不实现完整市场，仅保留导航和空状态。

## 4. 跨页面状态清单

每个页面实现时至少考虑以下 UI 状态：

- Loading：骨架屏或局部 spinner。
- Empty：说明为空的原因，并提供主要创建动作。
- Error：显示可恢复动作，如重试或返回列表。
- Permission denied：解释当前角色缺少的权限。
- Dirty form：离开前确认。
- Long content：长 prompt、schema、trace output 支持折叠、复制和滚动。
- Sensitive content：密钥、环境变量、token 默认遮罩。
- Realtime running：运行中、同步中、索引中、评测中使用轮询和明确状态。

## 5. MVP 导航顺序

建议左侧导航顺序：

1. 工作台
2. 智能体
3. 工作流编排
4. MCP / 工具
5. 知识库
6. 评测
7. 运行日志
8. 发布渠道
9. 设置

该顺序对应产品闭环，也方便用户从创建、编排、调试、评测、发布到观测逐步推进。

