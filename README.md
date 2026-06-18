# AI Agent Platform

AI Agent Platform 是一个企业级智能体管理平台原型工程，面向智能体创建、工作流编排、知识库/RAG、MCP/API 工具、运行 Trace、发布门禁和治理闭环。

项目产品方向参考 Dify、Coze、Flowise、Langflow、RAGFlow、AnythingLLM、n8n 等智能体平台，但当前不是基于这些平台二次开发，而是在本仓库内自研平台骨架与运行闭环。后端已引入 `langchain-openai`，主要用于模型供应商连通性测试；智能体运行内核仍处于平台自研与模拟执行阶段。

## 当前状态

当前工程已从需求/原型阶段进入 MVP 工程实现阶段，主线包含：

- Open Design 原型方向已确认。
- React + Vite + TypeScript 前端骨架。
- FastAPI 后端服务。
- MySQL + SQLAlchemy + Alembic 持久化基础。
- Mock API 与真实 API 双模式。
- 智能体创建、更新、删除、试运行入口。
- 创建智能体时自动生成默认工作流。
- 基于 React Flow 的工作流画布编辑能力。
- 知识库、工具、运行记录、发布门禁、模板等 MVP 页面。
- Agent Run 与 TraceStep 持久化。
- Workflow 持久化、更新和测试接口。
- 模型供应商管理与连通性测试接口。
- Windows 批处理启动、停止和重启脚本。

仍在推进的内容：

- 真实 Agent Runtime 执行链路。
- RAG 解析、检索、重排和引用链路。
- MCP Transport 与真实企业工具调用。
- 权限/策略仓库接入 Release Gate。
- 更完整的 Trace 详情诊断与审计回放。

## 技术栈

前端：

- React 19
- Vite
- TypeScript
- TanStack Query
- React Flow (`@xyflow/react`)
- GSAP / `@gsap/react`
- lucide-react
- Vitest
- React Testing Library
- Playwright

后端：

- FastAPI
- Pydantic / pydantic-settings
- SQLAlchemy
- Alembic
- PyMySQL
- langchain-openai
- pytest

数据库：

- 本地真实运行：MySQL
- 测试环境：SQLite 内存库

## 目录结构

```txt
apps/
  api/          FastAPI 后端服务
  web/          React/Vite 前端应用
docs/
  architecture/ 架构、运行手册和设计文档
  design/       UI 原型、设计规范和前端工程方案
  prd/          MVP 需求、用户故事和发布计划
  superpowers/  设计规格和实施计划
infra/          基础设施预留目录
packages/       共享包预留目录
scripts/        Windows 本地启动、停止和重启脚本
```

## 环境准备

### 前端依赖

```powershell
cd H:\AI\ai-agent-platform
corepack pnpm install
```

### 后端依赖

后端使用 `apps/api/.venv` 作为本地虚拟环境。示例：

```powershell
cd H:\AI\ai-agent-platform\apps\api
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
```

### MySQL 配置

在 `apps/api/.env` 写入数据库连接。该文件已被 `.gitignore` 忽略，不应提交。

```env
AI_AGENT_PLATFORM_DATABASE_URL=mysql+pymysql://<user>:<url-encoded-password>@<host>:3306/ai_agent_platform?charset=utf8mb4
```

如果密码包含 `@`，需要 URL encode 为 `%40`。

示例：

```env
AI_AGENT_PLATFORM_DATABASE_URL=mysql+pymysql://root:<password>@192.168.1.171:3306/ai_agent_platform?charset=utf8mb4
```

首次运行前请确认数据库存在：

```powershell
cd H:\AI\ai-agent-platform\apps\api

@'
from sqlalchemy import create_engine, text

engine = create_engine("mysql+pymysql://root:<password>@192.168.1.171:3306/?charset=utf8mb4")
with engine.connect() as connection:
    connection.execute(text("CREATE DATABASE IF NOT EXISTS ai_agent_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
    connection.commit()
print("database ready")
'@ | .\.venv\Scripts\python -
```

本地开发时后端启动会执行 `Base.metadata.create_all()` 补齐表结构；正式迁移脚本保存在 `apps/api/alembic/versions/`。

## 快速启动

推荐使用 Windows 批处理脚本启动真实 API 模式：

```bat
cd H:\AI\ai-agent-platform
scripts\start-dev.bat
```

默认启动：

- 后端 API：`http://127.0.0.1:8001`
- 前端 Web：`http://127.0.0.1:5176`
- 日志目录：`logs/`

默认端口分别写入 `logs/api.log` 和 `logs/web.log`；使用自定义端口时，日志文件名会自动包含端口号，例如 `logs/api-9001.log`。

暂停项目服务：

```bat
scripts\stop-dev.bat
```

如果需要顺带停止旧的 Vite 默认端口 `5173`：

```bat
scripts\stop-dev.bat 8001 5176 5173
```

重启前后端服务：

```bat
scripts\restart-dev.bat
```

三个入口脚本均支持通过位置参数覆盖端口。前两个参数依次为 API 端口和 Web 端口；停止、重启脚本还可传入第三个待清理端口：

```bat
scripts\start-dev.bat 9001 6176
scripts\stop-dev.bat 9001 6176 5173
scripts\restart-dev.bat 9001 6176 5173
```

这些脚本默认隐藏运行，不会额外弹出 API 或 Web 控制台窗口。需要在当前控制台调试输出时，可临时开启可见模式：

```bat
set AI_AGENT_VISIBLE_CONSOLE=1
scripts\start-dev.bat
```

## 手动启动

后端：

```powershell
cd H:\AI\ai-agent-platform\apps\api
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

健康检查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health
```

前端真实 API 模式：

```powershell
cd H:\AI\ai-agent-platform
$env:VITE_USE_MOCK_API='false'
$env:VITE_API_BASE_URL='http://127.0.0.1:8001'
corepack pnpm --filter @ai-agent-platform/web dev --port 5176 --strictPort
```

前端访问地址：

```txt
http://127.0.0.1:5176
```

## 常用验证命令

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

真实 API smoke，需要后端 `8001` 和真实 API 前端 `5176` 已启动：

```powershell
cd H:\AI\ai-agent-platform
corepack pnpm --filter @ai-agent-platform/web e2e:real-api
```

注意：`lint:web` 目前依赖 ESLint v9，但仓库尚未补齐 `eslint.config.*`，因此 lint 配置仍待完善。

## 当前主要页面

前端主导航保持轻量化：

- 总览：查看运行健康、阻断原因和关键资产状态。
- 智能体：创建、编辑、删除、试运行智能体，并进入工作流配置。
- 工作流：从智能体进入 React Flow 画布，编辑节点、边、模型、知识库和测试输入。
- 知识库：查看知识资产、索引和处理状态。
- 工具：管理 MCP Server、API Tool、凭据、权限和健康状态。
- 运行记录：查看最近运行、Trace 摘要、耗时和成本。
- 发布：查看发布渠道、发布门禁和阻断原因。
- 模板：保留少量复用入口，避免旧原型内容堆叠。

## 主要 API 能力

已实现或正在完善的接口包括：

- `GET /api/agents`
- `POST /api/agents`
- `PATCH /api/agents/{agent_id}`
- `DELETE /api/agents/{agent_id}`
- `POST /api/agents/{agent_id}/runs`
- `GET /api/workflows`
- `GET /api/workflows/{workflow_id}`
- `PUT /api/workflows/{workflow_id}`
- `POST /api/workflows/{workflow_id}/test`
- `GET /api/runs/{run_id}/trace`
- `GET /api/model-providers`
- `POST /api/model-providers`
- `PUT /api/model-providers/{provider_id}`
- `POST /api/model-providers/{provider_id}/test`
- `GET /api/knowledge-bases`
- `GET /api/tools`
- `GET /api/release-gates`

## 开发注意事项

- 默认中文回答、中文文档和中文注释。
- 前端动效使用 GSAP 规范实现。
- 不提交 `.env`、`logs/`、`.codegraph/`、构建产物和本地缓存。
- 工作区可能存在他人或其它会话的未提交改动，提交前务必先看 `git status` 和 `git diff --stat`。
- 当前项目仍是 MVP 工程实现阶段，真实 Agent Runtime、真实 MCP 调用和完整 RAG 执行链路尚未完成。

## 关键文档

- [MVP Runtime Runbook](docs/architecture/mvp-runtime-runbook.md)
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
