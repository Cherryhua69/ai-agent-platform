# Frontend UI Engineering Plan

## 1. 目标与边界

本文定义 AI Agent Platform MVP 前端 UI 工程方案，服务从“创建智能体 -> 编排能力 -> 绑定工具和知识库 -> 调试运行 -> 评测 -> 发布 -> 观测”的闭环。

当前阶段只做前端工程设计，不初始化 React/Vite 项目，不实现业务代码。后续实现应优先复用 `README.md` 中规划的 React、Vite、TypeScript、Tailwind CSS、React Flow、Zustand、TanStack Query 技术方向，并以 `docs/design/ui-style-guide.md` 的企业 SaaS 控制台风格为视觉基线。

## 2. 推荐技术栈

### 2.1 基础框架

- React 19 + TypeScript：组件化 UI 与严格类型边界。
- Vite：本地开发、构建和环境变量管理。
- React Router：管理控制台路由、详情页、嵌套路由和深链接。
- Tailwind CSS：承载设计 token、布局、间距、状态色和响应式规则。
- shadcn/ui 或自建 headless component wrapper：沉淀表格、表单、弹窗、抽屉、Tabs、Tooltip、Popover 等控制台组件。
- lucide-react：统一线性图标。

### 2.2 数据与状态

- TanStack Query：服务端数据获取、缓存、失效、分页、筛选、轮询和乐观更新。
- Zustand：工作流画布、全局 UI 状态、筛选器暂存、命令面板和面板展开状态。
- Zod：表单、mock 数据和 API 响应的运行时校验。
- React Hook Form：智能体配置、MCP Server、知识库、发布配置等表单。

### 2.3 工作流画布

- React Flow：节点画布、边连接、MiniMap、Controls、节点拖拽、选择态和运行态覆盖。
- Dagre 或 ELK.js：用于后续自动布局，不作为 MVP 强依赖。
- Monaco Editor 或 CodeMirror：用于代码/函数节点、JSON schema、prompt 变量预览等富文本/代码编辑场景，可在 P1 引入。

### 2.4 图表与表格

- TanStack Table：智能体、工具、运行日志、评测结果等高密度表格。
- Recharts 或 ECharts：工作台指标、运行趋势、成本趋势、评测指标。MVP 推荐 Recharts，复杂诊断图再升级 ECharts。

### 2.5 工程质量

- ESLint + Prettier：代码规范。
- Vitest + React Testing Library：组件、store、工具函数测试。
- Playwright：关键工作流 E2E 和视觉回归冒烟。
- MSW：浏览器侧 mock API，支撑无后端阶段联调。
- Storybook 或 Ladle：沉淀设计系统组件状态。若工期紧，可 P1 引入。

## 3. 目录结构规划

后续初始化前端项目时，建议放在 `apps/web`：

```txt
apps/web/
  src/
    app/
      App.tsx
      router.tsx
      providers.tsx
      query-client.ts
    assets/
    components/
      ui/
      layout/
      data-display/
      forms/
      feedback/
      workflow/
    features/
      dashboard/
      agents/
      workflow/
      mcp-tools/
      knowledge/
      evaluations/
      runs/
      releases/
      settings/
    hooks/
    lib/
      api/
      mock/
      permissions/
      formatting/
      validation/
    stores/
      workspace-store.ts
      ui-store.ts
      workflow-store.ts
    styles/
      globals.css
      tokens.css
    types/
      domain.ts
      api.ts
    test/
      setup.ts
      factories/
```

目录职责：

- `app`：应用入口、路由、全局 provider、QueryClient。
- `components/ui`：低层通用组件，如 Button、Input、Select、Dialog、Tooltip、Badge、Table primitive。
- `components/layout`：侧边栏、顶部工具栏、页面框架、详情页框架、三栏画布框架。
- `components/data-display`：Metric、StatusBadge、DataTable、TraceTimeline、EmptyState、ErrorState。
- `components/forms`：字段组、权限选择器、变量编辑器、SchemaViewer、EnvironmentVariablesEditor。
- `components/workflow`：React Flow 节点、边、节点库、属性面板、调试面板。
- `features/*`：按业务域组织页面、领域组件、hooks、queries、schemas 和 mock adapter。
- `lib/api`：API client、请求类型、错误处理、query key。
- `lib/mock`：MSW handlers、mock seed、fixtures。
- `stores`：只存 UI 和客户端交互状态，不替代服务端缓存。

## 4. 路由规划

建议所有业务路由挂在控制台壳层下，保留 `workspaceId` 和 `projectId` 上下文。MVP 可先使用顶部筛选切换空间/项目，路由中预留参数能力。

```txt
/
/dashboard
/agents
/agents/new
/agents/:agentId
/agents/:agentId/config
/agents/:agentId/versions
/agents/:agentId/resources
/agents/:agentId/workflow

/workflows/:workflowId

/mcp
/mcp/servers
/mcp/servers/new
/mcp/servers/:serverId
/mcp/tools/:toolId
/mcp/tools/:toolId/schema
/mcp/tools/:toolId/permissions
/mcp/tools/:toolId/logs

/knowledge
/knowledge/:knowledgeBaseId
/knowledge/:knowledgeBaseId/documents
/knowledge/:knowledgeBaseId/chunking
/knowledge/:knowledgeBaseId/retrieval-test

/evaluations
/evaluations/datasets/:datasetId
/evaluations/runs/:evaluationRunId
/evaluations/reports/:evaluationRunId

/runs
/runs/:runId

/releases
/releases/:releaseId
/channels/web-chat
/channels/api

/settings/workspaces
/settings/members
/settings/model-providers
/settings/secrets
/settings/audit-logs
/settings/environments
```

P0 默认入口为 `/dashboard`。`/agents/:agentId/workflow` 与 `/workflows/:workflowId` 可复用同一个编排器页面，前者强调从智能体详情进入，后者强调独立深链接。

## 5. 组件分层

### 5.1 App Shell

控制台固定结构：

- 左侧主导航：工作台、智能体、工作流编排、MCP/工具、知识库、评测、运行日志、发布渠道、设置。
- 顶部工具栏：空间、项目、环境筛选；全局搜索；通知；用户菜单。
- 主工作区：页面标题、操作区、筛选区、数据区。

工作流编排器使用全屏工作区变体：

- 左侧节点库。
- 中间 React Flow 画布。
- 右侧节点属性面板。
- 底部调试输出面板。
- 顶部保留保存、运行、发布检查、版本状态等操作。

### 5.2 UI Primitive

低层组件只表达交互和样式，不耦合业务：

- Button、IconButton、Input、Textarea、Select、Checkbox、Switch、Slider。
- Badge、StatusPill、Tooltip、Popover、DropdownMenu、Dialog、Drawer。
- Tabs、SegmentedControl、Breadcrumb、Pagination。
- Skeleton、Spinner、InlineAlert、Toast。

### 5.3 业务基础组件

跨业务域复用：

- `WorkspaceProjectSelector`
- `EnvironmentSwitcher`
- `StatusBadge`
- `MetricTile`
- `DataTable`
- `FilterBar`
- `PermissionMatrix`
- `SecretField`
- `SchemaViewer`
- `TraceTimeline`
- `ReleaseGateChecklist`
- `ResourceBindingList`

### 5.4 领域页面组件

页面组件按 `features` 收敛：

- Dashboard：指标总览、异常列表、待办入口。
- Agents：智能体表格、详情头部、配置表单、资源绑定、版本列表。
- Workflow：节点库、画布节点、属性表单、运行结果、错误定位。
- MCP Tools：Server 列表、工具详情、Schema、权限、调用日志。
- Knowledge：知识库列表、文档管理、分段配置、检索测试。
- Evaluations：测试集、运行记录、报告、发布门禁。
- Runs：运行列表、Trace 详情、模型/工具/检索明细。
- Releases：渠道配置、版本发布、回滚记录。
- Settings：空间、成员、模型供应商、密钥、审计和环境。

## 6. 设计 Token

### 6.1 CSS 变量

设计 token 以 CSS variables 暴露，Tailwind 读取变量，保证主题和运行时状态一致。

```css
:root {
  --color-bg-page: #f6f7f9;
  --color-bg-panel: #ffffff;
  --color-text-primary: #172033;
  --color-text-secondary: #687386;
  --color-border-default: #d9dee7;
  --color-border-subtle: #e8ebf0;

  --color-brand: #1668dc;
  --color-brand-soft: #e8f1ff;
  --color-success: #16845b;
  --color-success-soft: #e8f7ef;
  --color-warning: #a15c07;
  --color-warning-soft: #fff4dd;
  --color-danger: #c9372c;
  --color-danger-soft: #fff0ee;
  --color-sidebar: #131a26;
  --color-sidebar-active: #1b2535;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  --font-sans: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
}
```

### 6.2 尺寸与排版

- 页面标题：22px 到 26px，字重 600。
- 区块标题：14px 到 16px，字重 600。
- 表格正文：13px，行高 44px 到 52px。
- 控件文字：13px。
- 辅助说明：12px 到 13px。
- 主工作区内不使用大字号营销式标题。
- `letter-spacing` 固定为 `0`。

### 6.3 布局 Token

- 侧边栏宽度：240px，收起态 64px。
- 顶部工具栏高度：56px。
- 页面内边距：24px，窄屏降为 16px。
- 面板间距：16px。
- 表格筛选区与数据区间距：12px。
- 右侧属性面板宽度：360px 到 420px。
- 底部调试面板高度：240px 到 360px，可拖拽调整。

## 7. 状态管理策略

### 7.1 服务端状态

TanStack Query 管理所有来自 API 或 mock API 的数据：

- 列表查询：分页、排序、筛选进入 query key。
- 详情查询：按实体 id 缓存。
- 运行中状态：Dashboard、Run、EvaluationRun、MCP Server 支持短轮询。
- 变更后按实体粒度失效 query，避免全局刷新。

推荐 query key：

```ts
["agents", workspaceId, projectId, filters]
["agent", agentId]
["workflow", workflowId]
["mcpServers", workspaceId, filters]
["tool", toolId]
["runs", workspaceId, projectId, filters]
["runTrace", runId]
```

### 7.2 客户端 UI 状态

Zustand 管理短生命周期 UI 状态：

- 当前 workspace、project、environment 选择。
- 侧边栏收起状态。
- 表格列显隐和本地排序偏好。
- 工作流选中节点、悬浮节点、面板尺寸、节点库搜索。
- 调试面板展开、当前 trace step、运行结果对比。

### 7.3 表单状态

React Hook Form 管理编辑态表单，Zod schema 做校验。复杂配置表单拆成字段组，不把整个详情页变成一个大表单。

表单建议提供三种状态：

- 只读态：详情页默认状态，减少误操作。
- 编辑态：显式点击编辑后进入。
- 错误态：字段级错误、表单级阻断原因、保存失败 toast。

## 8. React Flow 画布方案

### 8.1 节点类型

MVP 节点类型与领域模型保持一致：

- `start`：流程入口，只允许出边。
- `llm`：模型、提示词、变量、上下文策略。
- `condition`：条件分支，支持多出边和分支标签。
- `tool`：MCP 工具调用，绑定 `toolId` 和输入映射。
- `knowledge`：知识库检索，绑定 `knowledgeBaseId`、TopK、阈值。
- `code`：代码/函数节点，MVP 可先以配置占位。
- `human_handoff`：人工转接节点，MVP 可先以只读配置占位。
- `end`：流程终点，只允许入边。

### 8.2 节点 UI

节点视觉遵循 `ui-style-guide.md`：

- 圆角 8px。
- 默认白底、弱边框。
- 选中态蓝色描边。
- 异常态红色描边并显示错误图标。
- 运行中态显示轻量进度指示。
- 节点内容只展示名称、类型、关键配置摘要和运行状态。

### 8.3 画布布局

桌面布局：

```txt
顶部工作流工具栏
├── 左侧节点库 240px
├── 中央画布 flex
├── 右侧属性面板 380px
└── 底部调试面板 280px
```

响应式降级：

- 1024px 以下：属性面板改为右侧 Drawer。
- 768px 以下：工作流编排器进入只读或有限编辑模式，提示建议桌面端编辑。

### 8.4 数据结构

前端保存 React Flow 展示数据，同时保留领域模型可序列化结构：

```ts
type WorkflowDraft = {
  id: string;
  agentId: string;
  versionId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

type WorkflowNode = {
  id: string;
  type: "start" | "llm" | "condition" | "tool" | "knowledge" | "code" | "human_handoff" | "end";
  name: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};
```

### 8.5 交互规则

- 从节点库拖拽到画布创建节点。
- 点击节点打开属性面板。
- 连接线创建后进行类型校验，如 `end` 不能有出边。
- 保存草稿只保存工作流定义，不触发发布。
- 运行当前流程后，节点显示运行状态、耗时、输入输出摘要和错误入口。
- 点击失败节点可在底部调试面板定位到对应 trace step。

## 9. Mock 数据策略

### 9.1 阶段目标

无后端阶段使用 MSW + typed fixtures 模拟真实 API，保证页面、表格、筛选、状态、错误和空状态都能被验证。mock 不应散落在组件中。

### 9.2 数据来源

mock 模型对齐 `docs/architecture/domain-model.md`：

- Workspace、Project。
- Agent、AgentVersion。
- Workflow、WorkflowNode。
- McpServer、Tool。
- KnowledgeBase、Document。
- Run、RunTrace。
- EvaluationDataset、EvaluationRun。
- Release、AuditLog。

### 9.3 场景覆盖

每个核心页面至少覆盖：

- 正常数据。
- 空状态。
- 加载状态。
- 错误状态。
- 权限不足状态。
- 长文本和大量数据。
- 异常状态，如工具离线、发布阻断、评测失败、trace 报错。

### 9.4 API 形态

前端 API client 使用接口隔离 mock 与真实服务：

```ts
interface AgentApi {
  listAgents(params: AgentListParams): Promise<PaginatedResult<Agent>>;
  getAgent(agentId: string): Promise<AgentDetail>;
  createAgent(input: CreateAgentInput): Promise<Agent>;
  updateAgent(agentId: string, input: UpdateAgentInput): Promise<Agent>;
}
```

后续接入真实后端时，仅替换 `lib/api` 实现和 MSW 开关。

## 10. 可访问性策略

- 所有图标按钮必须有 `aria-label` 和 Tooltip。
- 表格支持键盘聚焦、排序状态声明和可见焦点。
- Dialog、Drawer、Popover 遵守焦点陷阱和 Esc 关闭。
- 表单字段必须绑定 label、描述和错误文本。
- 状态不只依赖颜色，同时使用文本或图标表达。
- 工作流画布提供节点列表侧栏或大纲视图，辅助键盘定位节点。
- 关键操作如归档、删除、回滚、发布必须二次确认。
- 对比度满足 WCAG AA，尤其是次级文本、状态标签和表格边框。

## 11. 响应式策略

MVP 的主工作场景以桌面端为主，但列表、详情和观测页面应可在平板与窄屏阅读。

- `>= 1280px`：完整控制台布局，三栏画布。
- `1024px - 1279px`：保留侧边栏，详情页次级面板可折叠。
- `768px - 1023px`：侧边栏默认收起，筛选区换行，右侧属性面板改 Drawer。
- `< 768px`：导航进入抽屉，表格转为紧凑列表或横向滚动；工作流编排器提示桌面端编辑，保留查看和调试结果阅读能力。

表格页面优先保持列配置能力：

- P0 列默认展示。
- 次要列可隐藏到详情抽屉。
- 批量操作在窄屏下进入更多菜单。

## 12. 权限与治理 UI

前端需要从一开始预留权限控制点：

- 导航项按权限显示或禁用。
- 高风险操作按钮在无权限时禁用并显示原因。
- 发布、回滚、密钥、权限变更必须显示审计提示。
- 工具异常、评测未通过、权限缺失应进入发布门禁检查。

权限逻辑建议集中在 `lib/permissions`：

```ts
can(user, "release.publish", { workspaceId, projectId, agentId });
can(user, "tool.updateSecret", { workspaceId, toolId });
```

## 13. 测试与验收建议

### 13.1 单元与组件测试

- 状态标签、权限判断、格式化工具。
- DataTable 的排序、筛选、空状态。
- 工作流节点渲染与连接校验。
- 发布门禁 checklist。

### 13.2 E2E 测试

P0 流程：

1. 进入工作台，查看异常并跳转到智能体。
2. 创建智能体草稿。
3. 进入工作流编排器，添加 LLM、知识库、工具和条件节点。
4. 运行调试，查看节点级结果。
5. 进入运行 Trace，定位失败工具调用。
6. 运行评测并查看发布阻断原因。
7. 通过检查后进入发布配置。

### 13.3 视觉验收

- 第一屏直接是控制台界面，不出现营销 hero。
- 页面结构稳定，避免卡片套卡片。
- 表格密度、字号、边框、状态色与 `ui-style-guide.md` 一致。
- 工作流画布在桌面端不遮挡节点库、属性面板和调试面板。

## 14. 实施顺序建议

1. 初始化 `apps/web` 基础工程、lint、format、test、Tailwind token。
2. 搭建 App Shell、路由、workspace/project/environment 筛选。
3. 实现 mock API、domain types、fixtures、MSW。
4. 实现 P0 通用组件：DataTable、StatusBadge、MetricTile、FilterBar、PageHeader。
5. 实现 P0 页面：Dashboard、Agents、Agent Detail、Workflow Builder、MCP Tools、Run Trace。
6. 补齐 P1 页面：Knowledge、Evaluations、Releases、Settings。
7. 增加 E2E、视觉回归和 Storybook/Ladle。

