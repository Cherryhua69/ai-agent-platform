# MVP 运行与真实 API 验收清单

本文档用于在当前工程实现阶段启动前后端、连接 MySQL，并验证 Agent 创建、知识库、工具、评测与发布门禁的真实 API 主闭环。

## 1. 当前状态

当前分支已完成前端可运行骨架、真实 API 接管以及后端 MySQL 持久化基础。

已接入 SQLAlchemy / MySQL 的模块：

- Agent：创建与列表。
- Knowledge：知识库、文档、处理任务。
- Tools：MCP Server、工具、工具健康状态。
- Evaluation：评测数据集、用例、运行记录、latest run。
- Release Gate：从 Tools、Knowledge、Evaluation 仓储聚合发布门禁原因。

测试环境默认使用 SQLite 内存库，真实运行环境通过 `.env` 配置 MySQL。

## 2. 本地环境变量

在 `apps/api/.env` 写入数据库连接。该文件已被 `.gitignore` 忽略，不应提交。

```env
AI_AGENT_PLATFORM_DATABASE_URL=mysql+pymysql://<user>:<url-encoded-password>@<host>:3306/ai_agent_platform?charset=utf8mb4
```

密码里如果包含 `@`，需要 URL encode 为 `%40`。

示例：

```env
AI_AGENT_PLATFORM_DATABASE_URL=mysql+pymysql://root:<password>@192.168.1.171:3306/ai_agent_platform?charset=utf8mb4
```

## 3. MySQL 初始化

首次连接前确认数据库存在：

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

后端启动时会执行 `Base.metadata.create_all()`，用于本地开发自动补齐表结构。正式迁移脚本保存在 `apps/api/alembic/versions/`。

## 4. 启动后端

```powershell
cd H:\AI\ai-agent-platform\apps\api
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

健康检查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health
```

期望返回：

```json
{"status":"ok"}
```

## 5. 启动真实 API 前端

```powershell
cd H:\AI\ai-agent-platform
$env:VITE_USE_MOCK_API='false'
$env:VITE_API_BASE_URL='http://127.0.0.1:8001'
corepack pnpm --filter @ai-agent-platform/web dev -- --port 5176 --strictPort
```

访问地址：

```txt
http://127.0.0.1:5176
```

## 6. 常规验证命令

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
cd H:\AI\ai-agent-platform
corepack pnpm --filter @ai-agent-platform/web e2e:real-api
```

## 7. 真实 API 验收清单

启动后端和真实 API 前端后，建议按顺序检查：

- 打开 `http://127.0.0.1:5176`，页面能正常加载。
- 进入 `Agent Studio`，点击 `创建草稿 Agent`。
- 页面展示 `已创建草稿：售后政策助手` 和 `flow_agent_...`。
- 进入 `知识库`，能看到 `售后政策库` 与 `Hybrid + Rerank`。
- 进入 `工具与 MCP`，能看到 `create_ticket`，健康状态为 `degraded`。
- 进入 `评测与观测`，能看到 latest run 通过率与 `refund-ticket-create` 失败用例。
- 进入 `发布渠道`，能看到发布门禁 `blocked`，原因包含工具健康、关键评测、知识库索引和高风险权限。

## 8. 当前遗留事项

- `README.md` 仍保留早期项目规划描述，后续可单独更新为当前工程状态。
- Release Gate 的高风险权限原因目前仍是规则常量，后续应接入权限/策略仓储。
- Trace 模块仍是演示数据，后续可迁移到数据库并关联真实运行记录。
- `.codegraph/` 是本地工具生成的索引目录，不应纳入业务提交。
