# 新电脑使用 Codex 继续开发指南

本文档用于在新的电脑上拉取本项目，并继续使用 Codex 推进需求、Open Design 原型、前端工程和后端实现。

## 1. 前置准备

建议安装：

- Git
- Node.js LTS
- pnpm
- GitHub CLI，可选但推荐
- Codex 桌面端或可连接本地仓库的 Codex 环境
- Open Design，本项目 UI 原型阶段会使用

验证命令：

```powershell
git --version
node --version
pnpm --version
gh --version
```

如果 `gh` 未登录：

```powershell
gh auth login
```

## 2. 拉取项目

```powershell
git clone https://github.com/Cherryhua69/ai-agent-platform.git
cd ai-agent-platform
git status
```

期望状态：

```txt
On branch main
nothing to commit, working tree clean
```

## 3. 首先阅读的文档

建议按顺序阅读：

1. `README.md`
2. `docs/prd/mvp-requirements.md`
3. `docs/prd/feature-breakdown.md`
4. `docs/prd/user-stories.md`
5. `docs/prd/release-plan.md`
6. `docs/architecture/information-architecture.md`
7. `docs/architecture/domain-model.md`
8. `docs/design/ui-style-guide.md`
9. `docs/design/frontend-ui-engineering-plan.md`
10. `docs/design/open-design-prototype.md`

## 4. 在 Codex 中打开项目

在 Codex 中选择本地项目目录：

```txt
<your-path>\ai-agent-platform
```

打开后建议先对 Codex 说：

```txt
请先阅读 README.md 和 docs/ 下的需求、架构、设计文档，理解当前项目状态。不要急着写代码，先总结你理解的产品范围、前端工程方案和下一步建议。
```

## 5. 推荐的 Codex 会话分工

为了避免不同任务互相干扰，建议继续使用多个会话或 worktree。

### 产品需求会话

用途：
- 细化功能需求
- 拆用户故事
- 维护 PRD、Release Plan、验收标准

建议提示词：

```txt
你是本项目的产品需求细化会话。请阅读 docs/prd 和 docs/architecture 下的文档，只修改需求和架构相关文档，不写工程代码。输出应包含变更文件、需求风险和建议下一步。
```

### Open Design 原型会话

用途：
- 使用 MCP 调用 Open Design
- 产出或迭代高保真 UI 原型
- 维护 `docs/design/open-design-prototype.md`

建议提示词：

```txt
你是本项目的 Open Design UI 原型会话。请优先使用 mcp__open_design 工具，基于 docs/prd、docs/architecture、docs/design/ui-style-guide.md 迭代企业级 SaaS 控制台原型。不要初始化 React/Vite，不写业务代码。若 Open Design 内部 agent 不可用，记录原因并用 Open Design artifact 产出可浏览 HTML 原型。
```

### 前端工程会话

用途：
- 初始化或维护 React/Vite 前端
- 设计组件结构、路由、状态、mock 数据
- 根据 Open Design 原型实现 UI

建议提示词：

```txt
你是本项目的前端工程会话。请先阅读 docs/design/frontend-ui-engineering-plan.md、docs/design/frontend-pages-inventory.md、docs/design/ui-style-guide.md 和 docs/design/open-design-prototype.md。实现前请给出文件级计划，保持企业 SaaS 控制台风格，优先实现真实可用的工作台界面。
```

### 后端架构会话

用途：
- 设计 API、数据库、工作流运行模型
- 设计 MCP 接入、知识库、评测和运行 trace

建议提示词：

```txt
你是本项目的后端架构会话。请阅读 docs/architecture/domain-model.md 和 docs/prd/feature-breakdown.md，先补充 API 与数据模型设计，不急于实现服务代码。
```

## 6. 分支与提交建议

从 `main` 创建任务分支：

```powershell
git switch main
git pull
git switch -c codex/<task-name>
```

提交前检查：

```powershell
git status
git diff --stat
```

提交：

```powershell
git add .
git commit -m "docs: describe change"
git push -u origin codex/<task-name>
```

若是小规模文档更新，也可以直接在 `main` 上提交，但正式工程代码建议走分支和 Pull Request。

## 7. 当前项目状态

截至本文档创建时：

- 已完成初始 PRD、信息架构、领域模型、UI 风格指南。
- 已完成需求细化文档、用户故事和三阶段发布计划。
- 已完成前端 UI 工程方案和页面清单。
- 已完成 Open Design 原型说明文档。
- 尚未初始化 React/Vite 前端工程。
- 尚未初始化后端服务。
- 尚未建立数据库 schema 或 API 实现。

## 8. 下一步建议

推荐下一轮工作：

1. 确认 Open Design 原型是否满足第一版 UI 方向。
2. 初始化 `apps/web` React + Vite + TypeScript 项目。
3. 建立共享设计 token 和基础 AppShell。
4. 实现工作台、智能体列表、编排器静态页面。
5. 使用 mock 数据打通前端交互。
6. 再开始后端 API 和数据模型实现。

