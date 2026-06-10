# Open Design 原型说明

## 原型引用

- Open Design 项目：`ai-agent-management-platform`
- 项目名称：`AI Agent Management Platform Prototype`
- 入口文件：`index.html`
- Open Design 预览：<http://127.0.0.1:7456/api/projects/ai-agent-management-platform/raw/index.html>
- 仓库归档路径：`docs/design/prototypes/ai-agent-management-platform/index.html`
- 确认时间：2026-06-10

## 当前结论

当前版本已作为产品结构与 UI 方向的确认版。它保留“企业级 AI Agent 管理平台”的核心信息架构，并在原有功能原型基础上升级为更接近生产控制台的高保真 UI：深色侧边导航、浅色主工作区、顶部环境与空间切换、密集但可扫描的数据表格、属性面板、工作流画布、Trace 调试区域和发布门禁状态。

本版本不使用 Open Design 内部 MiniMax/BYOK 生成能力。当前流程为：Codex 手写 HTML/CSS/JS 原型，通过 Open Design 承载预览，并由 Codex 进行可用性与响应式核验。

## 覆盖页面

- 工作台：展示 Agent、Flow、知识命中率、工具成功率、发布阻断、成本和最近异常运行。
- 竞品策略：对标 Dify、Coze、Flowise、Langflow、RAGFlow、AnythingLLM、n8n，并沉淀本项目策略。
- Agent Studio：覆盖 Agent 创建向导、模型与 Prompt、知识与变量、工具与 MCP、评测集、发布策略。
- 工作流：展示 Agentflow/Chatflow/RAG Pipeline 的编排思路、节点库、画布、属性面板和调试输出。
- 知识库：覆盖文档解析、清洗、语义切分、Embedding、Hybrid Search、Rerank 和引用预览。
- 工具与 MCP：覆盖 MCP Server、API Tool、Trigger、凭据、权限、工具健康和插件市场入口。
- 评测与观测：覆盖评测指标、发布结论、失败归因、Trace 步骤、成本和延迟。
- 发布渠道：覆盖 API、Web Chat、Embedded Chatbot、MCP Server、企业 IM 预留、发布门禁和回滚策略。
- 模板市场：覆盖 Agent 模板、Flow 模板、知识库流水线、MCP 工具包和发布门禁模板。
- 治理设置：覆盖 Workspace、Project、角色权限、私有化部署、高风险操作规则和审计日志。

## UI 设计原则

- 使用成熟企业 SaaS 控制台布局，避免营销页式表达。
- 信息层级优先服务运营与研发扫描：状态、阻断、归因、负责人、耗时、成本和质量指标要清晰可见。
- 卡片只用于可交互资产、指标摘要和模板对象；核心操作区域优先使用表格、分栏、属性面板和画布。
- 视觉保持克制：浅灰背景、白色面板、蓝色主操作、语义状态色、4px 到 8px 圆角。
- 工作流与 Trace 页面要体现真实产品感：节点状态、错误归因、调试抽屉、属性检查器和发布影响要连贯。
- 移动端优先保证查看与审批场景可用，复杂画布编辑建议保留桌面体验。

## 动效规范

- 原型使用 GSAP 3.12.5 CDN。
- 页面首次加载包含侧边栏、顶部栏和工作台内容的轻量进入动效。
- 导航切换时对当前视图和主要面板使用短时淡入与位移动效。
- 工作流调试按钮会触发节点运行状态动效，用于表达节点级执行过程。
- 遵守 `prefers-reduced-motion`，用户偏好减少动画时禁用主要动效。

## 验证结果

- 已打开 Open Design 预览并验证页面可加载。
- 已验证 10 个导航视图均可切换到对应页面。
- 已验证桌面视口无页面级横向溢出。
- 已验证 390px 移动视口无页面级横向溢出。
- 已确认原型文件同步到仓库归档路径。

## 前后端设计交接

前端实现建议以该原型作为第一视觉和信息架构参考，优先抽象以下组件：

- `AppShell`
- `SidebarNav`
- `Topbar`
- `PageHeader`
- `Panel`
- `MetricCard`
- `StatusPill`
- `DataTable`
- `InspectorPanel`
- `WorkflowCanvas`
- `TraceTimeline`
- `ReleaseGate`

工作流画布不建议在生产实现中复刻静态 DOM，应优先评估 React Flow 或同类图编辑库。图标建议使用 `lucide-react`，替换原型中的数字占位导航图标。

后端设计建议围绕以下领域对象展开：

- Workspace / Project / Member / Role
- Agent / AgentVersion / Prompt / ModelPolicy
- Workflow / WorkflowNode / WorkflowRun
- KnowledgeBase / Document / Chunk / RetrievalConfig
- Tool / MCPServer / Credential / ToolHealth
- EvaluationDataset / EvaluationRun / EvaluationCase
- Release / Channel / ReleaseGate / Rollback
- Trace / TraceStep / AuditLog

## 后续迭代点

- 为 Agent Studio 增加完整详情页二级导航：配置、版本、资源、运行、评测、发布。
- 为工作流编辑器增加节点创建、连线、属性编辑、错误状态和调试抽屉变体。
- 补充创建 Agent、添加 MCP Server、导入文档、发布版本等关键模态框。
- 定义空状态、加载状态、权限不足、危险操作确认和密钥过期状态。
- UI 确认后进入正式前端工程初始化与后端 API/数据模型设计。
