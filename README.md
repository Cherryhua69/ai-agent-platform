# AI Agent Platform

AI Agent Platform 是一个企业级智能体管理平台原型工程，面向 Agent 创建、知识库/RAG、MCP 工具、评测观测、发布门禁和治理闭环。产品方向参考 Dify、Coze 等智能体平台，但重点放在企业可控性、可观测性、工具权限、评测准入和发布治理。

当前仓库已从需求与原型阶段进入 MVP 工程实现阶段，包含可运行的 React 前端、FastAPI 后端、MySQL 持久化和真实 API 冒烟验证。

## 当前状态

已完成：

- Open Design 原型方向确认。
- React + Vite + TypeScript 前端骨架。
- 10 个一级视图导航与 P0 页面闭环。
- Mock API 与真实 API 双模式。
- FastAPI 后端服务。
- MySQL / SQLAlchemy 持久化基础。
- Agent、Knowledge、Tools、Evaluation 模块持久化。
- Release Gate 基于工具、知识库和评测仓储聚合阻断原因。
- 真实 API Playwright smoke，覆盖前端创建 Agent 草稿。

仍在推进：

- Trace 模块持久化。
- 权限/策略仓储接入 Release Gate。
- 工作流编排、RAG 处理、MCP 调用和运行记录的真实执行链路。

## 技术栈

- 前端：React、Vite、TypeScript、TanStack Query、GSAP、lucide-react。
- 后端：FastAPI、Pydantic、SQLAlchemy、Alembic。
- 数据库：MySQL，测试环境使用 SQLite 内存库。
- 测试：Vitest、React Testing Library、Playwright、pytest。

## 目录结构

```txt
apps/
  api/          FastAPI 后端
  web/          React/Vite 前端
docs/
  architecture/ 架构、运行手册和续接指南
  design/       UI 原型、设计规范和前端工程方案
  prd/          MVP 需求、用户故事和发布计划
infra/
packages/
```

## 快速启动

详细运行方式见 [MVP Runtime Runbook](docs/architecture/mvp-runtime-runbook.md)。

后端：

```powershell
cd H:\AI\ai-agent-platform\apps\api
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

真实 API 前端：

```powershell
cd H:\AI\ai-agent-platform
$env:VITE_USE_MOCK_API='false'
$env:VITE_API_BASE_URL='http://127.0.0.1:8001'
corepack pnpm --filter @ai-agent-platform/web dev -- --port 5176 --strictPort
```

访问：

```txt
http://127.0.0.1:5176
```

## 验证命令

后端：

```powershell
cd H:\AI\ai-agent-platform\apps\api
.\.venv\Scripts\python -m pytest
```

前端：

```powershell
cd H:\AI\ai-agent-platform
corepack pnpm --filter @ai-agent-platform/web test
corepack pnpm --filter @ai-agent-platform/web typecheck
corepack pnpm --filter @ai-agent-platform/web build
corepack pnpm --filter @ai-agent-platform/web e2e
```

真实 API smoke，要求后端 `8001` 和真实 API 前端 `5176` 已启动：

```powershell
corepack pnpm --filter @ai-agent-platform/web e2e:real-api
```

## 关键文档

- [MVP Runtime Runbook](docs/architecture/mvp-runtime-runbook.md)
- [Codex Continuation Guide](docs/architecture/codex-continuation-guide.md)
- [MVP Requirements](docs/prd/mvp-requirements.md)
- [Feature Breakdown](docs/prd/feature-breakdown.md)
- [User Stories](docs/prd/user-stories.md)
- [Release Plan](docs/prd/release-plan.md)
- [Information Architecture](docs/architecture/information-architecture.md)
- [Domain Model](docs/architecture/domain-model.md)
- [Frontend / Backend Overall Design](docs/architecture/frontend-backend-overall-design.md)
- [UI Style Guide](docs/design/ui-style-guide.md)
- [Frontend UI Engineering Plan](docs/design/frontend-ui-engineering-plan.md)
- [Open Design Prototype](docs/design/open-design-prototype.md)

## 分支说明

当前主要工程实现分支：

```txt
codex/api-mvp-continuation
```

提交前建议执行：

```powershell
git status
git diff --stat
```
