# AI Agent Platform MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 AI Agent Platform MVP 的可运行工程闭环，从确认版原型推进到前端骨架、mock 主流程、后端基础 API，再逐步接入知识库、工具、评测、发布和 Trace。

**Architecture:** 先建立 React/Vite 前端控制台和 mock API，使产品主闭环可演示；再建立 FastAPI 模块化后端和 MySQL schema，使前端从 mock 平滑切换到真实 API。所有高风险能力先做权限、门禁、审计和 Trace 口径，不在 P0 追求完整生产级执行器。

**Tech Stack:** React、TypeScript、Vite、Tailwind CSS、GSAP、React Router、TanStack Query、Zustand、React Flow、MSW、Vitest、Playwright、FastAPI、Pydantic、SQLAlchemy、Alembic、MySQL、Redis。

---

## 0. 执行原则

- 每个任务完成后都要运行对应验证命令。
- 每个任务都要独立提交，避免把前端、后端、文档和配置混在一个提交里。
- 前端 UI 必须遵守 `docs/design/open-design-prototype.md` 与确认版原型。
- 前端动效必须使用 GSAP，并支持 `prefers-reduced-motion`。
- 后端先用模块化单体，不拆微服务。
- P0 不实现完整模型调用、真实复杂 RAG、真实多 Agent 协作和完整插件市场。
- 所有高风险操作必须在设计和接口层体现权限、确认和审计。

## 1. 文件结构总览

本计划完成后，仓库应逐步形成以下结构：

```txt
apps/
  web/
    src/
      app/
      components/
      features/
      lib/
      stores/
      styles/
      test/
      types/
    e2e/
    package.json
    vite.config.ts
    tailwind.config.ts
    tsconfig.json
  api/
    app/
      main.py
      core/
      modules/
      workers/
    tests/
    alembic/
    pyproject.toml
    alembic.ini
docs/
  api/
  architecture/
  design/
  superpowers/
    plans/
```

## 2. 里程碑

- P0-1：前端可运行骨架，10 个一级视图可访问。
- P0-2：前端 mock API 主闭环，能演示创建 Agent 到发布门禁阻断。
- P0-3：后端基础骨架，Workspace、Project、Agent、Workflow、Run、Trace 基础 API 可用。
- P0-4：知识库、工具、评测、发布逐步真实化，发布阻断来自真实资源状态。

## Task 1: 建立仓库级工程约定

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `docs/architecture/development-conventions.md`

- [ ] **Step 1: 创建根 `package.json`**

写入：

```json
{
  "name": "ai-agent-platform",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev:web": "pnpm --filter @ai-agent-platform/web dev",
    "build:web": "pnpm --filter @ai-agent-platform/web build",
    "test:web": "pnpm --filter @ai-agent-platform/web test",
    "lint:web": "pnpm --filter @ai-agent-platform/web lint",
    "typecheck:web": "pnpm --filter @ai-agent-platform/web typecheck",
    "e2e:web": "pnpm --filter @ai-agent-platform/web e2e"
  }
}
```

- [ ] **Step 2: 创建 `pnpm-workspace.yaml`**

写入：

```yaml
packages:
  - "apps/*"
```

- [ ] **Step 3: 创建 `.editorconfig`**

写入：

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.py]
indent_size = 4
```

- [ ] **Step 4: 更新 `.gitignore`**

确保包含：

```gitignore
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
__pycache__/
.pytest_cache/
.ruff_cache/
.mypy_cache/
.venv/
playwright-report/
test-results/
```

- [ ] **Step 5: 创建开发约定文档**

`docs/architecture/development-conventions.md` 写入：

```md
# 开发约定

## 语言

默认使用中文编写产品文档、代码注释和提交说明中的业务描述。

## 前端

- 使用 React、TypeScript、Vite、Tailwind CSS。
- UI 以确认版 Open Design 原型为准。
- 动效使用 GSAP，必须支持 `prefers-reduced-motion`。
- 服务端状态使用 TanStack Query，客户端交互状态使用 Zustand。
- 工作流画布使用 React Flow。

## 后端

- MVP 使用 FastAPI 模块化单体。
- 数据库使用 MySQL，迁移使用 Alembic。
- 所有写操作必须预留审计记录。
- 高风险操作必须预留确认和阻断机制。
```

- [ ] **Step 6: 验证**

Run:

```powershell
git diff --check
```

Expected: 无输出，退出码为 0。

- [ ] **Step 7: 提交**

```powershell
git add package.json pnpm-workspace.yaml .editorconfig .gitignore docs/architecture/development-conventions.md
git commit -m "chore: add workspace development conventions"
```

## Task 2: 初始化前端 Vite 应用

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/test/setup.ts`

- [ ] **Step 1: 创建前端目录**

Run:

```powershell
New-Item -ItemType Directory -Force -Path apps\web\src\app,apps\web\src\styles,apps\web\src\test | Out-Null
```

- [ ] **Step 2: 创建 `apps/web/package.json`**

写入：

```json
{
  "name": "@ai-agent-platform/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "test": "vitest run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.1",
    "@tanstack/react-query": "^5.62.8",
    "zustand": "^5.0.2",
    "gsap": "^3.12.5",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8",
    "@playwright/test": "^1.49.1"
  }
}
```

- [ ] **Step 3: 创建 `apps/web/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Agent Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建 Vite 与 TypeScript 配置**

`apps/web/vite.config.ts`：

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
```

`apps/web/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`apps/web/tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: 创建最小 React 入口**

`apps/web/src/main.tsx`：

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`apps/web/src/app/App.tsx`：

```tsx
export function App() {
  return (
    <main className="app-placeholder">
      <h1>AI Agent Platform</h1>
      <p>前端工程骨架已启动。</p>
    </main>
  );
}
```

`apps/web/src/styles/globals.css`：

```css
:root {
  font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
  color: #172033;
  background: #f6f7f9;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

.app-placeholder {
  min-height: 100vh;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
}
```

`apps/web/src/test/setup.ts`：

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: 安装依赖**

Run:

```powershell
pnpm install
```

Expected: 生成 `pnpm-lock.yaml`，安装成功。

- [ ] **Step 7: 验证**

Run:

```powershell
pnpm typecheck:web
pnpm build:web
pnpm test:web
```

Expected: 三个命令均退出码 0。

- [ ] **Step 8: 提交**

```powershell
git add apps/web package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: initialize web app"
```

## Task 3: 建立前端设计 token 与 AppShell

**Files:**
- Create: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/components/layout/AppShell.tsx`
- Create: `apps/web/src/components/layout/SidebarNav.tsx`
- Create: `apps/web/src/components/layout/Topbar.tsx`
- Create: `apps/web/src/components/layout/PageHeader.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Test: `apps/web/src/components/layout/AppShell.test.tsx`

- [ ] **Step 1: 写 AppShell 测试**

`apps/web/src/components/layout/AppShell.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("渲染控制台壳层和导航", () => {
    render(<AppShell activeView="dashboard" onNavigate={() => {}} />);

    expect(screen.getByText("AI Agent Platform")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByText("测试环境")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test AppShell
```

Expected: FAIL，提示找不到 `./AppShell`。

- [ ] **Step 3: 创建 token**

`apps/web/src/styles/tokens.css`：

```css
:root {
  --page: #f6f7f9;
  --panel: #ffffff;
  --panel-subtle: #fbfcfe;
  --text: #172033;
  --muted: #687386;
  --line: #d9dee7;
  --soft: #e8ebf0;
  --brand: #1668dc;
  --brand-dark: #0f56bd;
  --brand-soft: #e8f1ff;
  --ok: #16845b;
  --ok-soft: #e8f7ef;
  --warn: #a15c07;
  --warn-soft: #fff4dd;
  --bad: #c9372c;
  --bad-soft: #fff0ee;
  --side: #111827;
  --side-active: #182234;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --shadow-panel: 0 10px 26px rgba(23, 32, 51, 0.08);
}
```

- [ ] **Step 4: 创建壳层组件**

`apps/web/src/components/layout/SidebarNav.tsx`：

```tsx
export type ViewId =
  | "dashboard"
  | "strategy"
  | "agents"
  | "workflow"
  | "knowledge"
  | "tools"
  | "observe"
  | "release"
  | "market"
  | "governance";

const navItems: Array<{ id: ViewId; label: string }> = [
  { id: "dashboard", label: "工作台" },
  { id: "strategy", label: "竞品策略" },
  { id: "agents", label: "Agent Studio" },
  { id: "workflow", label: "工作流" },
  { id: "knowledge", label: "知识库" },
  { id: "tools", label: "工具与 MCP" },
  { id: "observe", label: "评测与观测" },
  { id: "release", label: "发布渠道" },
  { id: "market", label: "模板市场" },
  { id: "governance", label: "治理设置" }
];

type SidebarNavProps = {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
};

export function SidebarNav({ activeView, onNavigate }: SidebarNavProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">A</span>
        <div>
          <strong>AI Agent Platform</strong>
          <span>企业 Agent 控制台</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="主导航">
        {navItems.map((item, index) => (
          <button
            key={item.id}
            className={item.id === activeView ? "active" : ""}
            onClick={() => onNavigate(item.id)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
```

`apps/web/src/components/layout/Topbar.tsx`：

```tsx
export function Topbar() {
  return (
    <header className="topbar">
      <span className="env-chip">测试环境</span>
      <span className="env-chip">空间：数字化运营部</span>
      <span className="env-chip">项目：客服自动化</span>
      <input aria-label="全局搜索" value="搜索 Agent、Flow、Tool、Dataset、Run ID" readOnly />
      <span className="avatar">陈</span>
    </header>
  );
}
```

`apps/web/src/components/layout/PageHeader.tsx`：

```tsx
type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <p>AI Agent Platform</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      <button>创建 Agent</button>
    </div>
  );
}
```

`apps/web/src/components/layout/AppShell.tsx`：

```tsx
import { SidebarNav, type ViewId } from "./SidebarNav";
import { Topbar } from "./Topbar";

type AppShellProps = {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  children?: React.ReactNode;
};

export function AppShell({ activeView, onNavigate, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <SidebarNav activeView={activeView} onNavigate={onNavigate} />
      <main className="main-shell">
        <Topbar />
        <section className="content-shell">{children}</section>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: 更新样式与 App**

`apps/web/src/styles/globals.css` 头部引入：

```css
@import "./tokens.css";
```

追加：

```css
.app-shell {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  background: var(--side);
  color: #c8d2e3;
}

.sidebar-brand {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-brand strong,
.sidebar-brand span {
  display: block;
}

.brand-mark {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #fff;
  background: var(--brand);
  font-weight: 800;
}

.sidebar-nav {
  display: grid;
  gap: 2px;
  padding: 12px 10px;
}

.sidebar-nav button {
  height: 38px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #c1cada;
  text-align: left;
}

.sidebar-nav button.active {
  color: #fff;
  background: var(--side-active);
}

.main-shell {
  min-width: 0;
}

.topbar {
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 22px;
  background: #fff;
  border-bottom: 1px solid var(--soft);
}

.topbar input {
  margin-left: auto;
  width: min(360px, 30vw);
}

.env-chip,
.topbar input {
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  padding: 0 10px;
  color: var(--muted);
}

.avatar {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--brand);
  background: var(--brand-soft);
  font-weight: 700;
}

.content-shell {
  padding: 22px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-header p {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 12px;
}

.page-header h1 {
  margin: 0 0 6px;
  font-size: 24px;
}

@media (max-width: 760px) {
  .app-shell {
    display: block;
  }

  .topbar {
    flex-wrap: wrap;
    padding: 10px;
  }

  .topbar input {
    width: 100%;
    margin-left: 0;
  }
}
```

`apps/web/src/app/App.tsx`：

```tsx
import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import type { ViewId } from "../components/layout/SidebarNav";

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");

  return (
    <AppShell activeView={activeView} onNavigate={setActiveView}>
      <PageHeader
        title="企业 Agent 工作台"
        description="从 Agent 设计、工作流、知识、工具、评测、发布到审计的一体化入口。"
      />
    </AppShell>
  );
}
```

- [ ] **Step 6: 验证测试通过**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test AppShell
pnpm typecheck:web
pnpm build:web
```

Expected: 三个命令均退出码 0。

- [ ] **Step 7: 提交**

```powershell
git add apps/web/src
git commit -m "feat: add web app shell"
```

## Task 4: 实现 10 个一级视图与 GSAP 页面动效

**Files:**
- Create: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Create: `apps/web/src/features/strategy/StrategyPage.tsx`
- Create: `apps/web/src/features/agents/AgentStudioPage.tsx`
- Create: `apps/web/src/features/workflows/WorkflowPage.tsx`
- Create: `apps/web/src/features/knowledge/KnowledgePage.tsx`
- Create: `apps/web/src/features/tools/ToolsPage.tsx`
- Create: `apps/web/src/features/evaluations/ObservePage.tsx`
- Create: `apps/web/src/features/releases/ReleasePage.tsx`
- Create: `apps/web/src/features/marketplace/MarketplacePage.tsx`
- Create: `apps/web/src/features/governance/GovernancePage.tsx`
- Create: `apps/web/src/lib/motion/useViewTransition.ts`
- Modify: `apps/web/src/app/App.tsx`
- Test: `apps/web/src/app/App.test.tsx`

- [ ] **Step 1: 写导航行为测试**

`apps/web/src/app/App.test.tsx`：

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("可以在 10 个一级视图之间切换", () => {
    render(<App />);

    const cases = [
      ["工作台", "企业 Agent 工作台"],
      ["竞品策略", "竞品能力对标"],
      ["Agent Studio", "Agent Studio"],
      ["工作流", "工作流编排"],
      ["知识库", "知识库与 RAG Pipeline"],
      ["工具与 MCP", "工具与 MCP 生态"],
      ["评测与观测", "评测与观测"],
      ["发布渠道", "发布渠道"],
      ["模板市场", "模板市场"],
      ["治理设置", "治理设置"]
    ];

    for (const [button, title] of cases) {
      fireEvent.click(screen.getByRole("button", { name: button }));
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test App
```

Expected: FAIL，提示多个页面标题不存在。

- [ ] **Step 3: 创建 GSAP hook**

`apps/web/src/lib/motion/useViewTransition.ts`：

```ts
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

export function useViewTransition(dependency: unknown) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const target = ref.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!target || reduceMotion) {
      return;
    }

    gsap.fromTo(
      target,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.26, ease: "power2.out", overwrite: "auto" }
    );
  }, [dependency]);

  return ref;
}
```

- [ ] **Step 4: 创建页面组件**

每个页面先使用确认版原型中的核心文案和结构，避免扩展范围。示例：

`apps/web/src/features/dashboard/DashboardPage.tsx`：

```tsx
import { PageHeader } from "../../components/layout/PageHeader";

export function DashboardPage() {
  return (
    <>
      <PageHeader
        title="企业 Agent 工作台"
        description="从 Agent 设计、工作流、知识、工具、评测、发布到审计的一体化入口。"
      />
      <section className="panel-grid">
        <article className="metric-panel">
          <span>Agent</span>
          <strong>42</strong>
          <p>14 个生产可用</p>
        </article>
        <article className="metric-panel">
          <span>发布阻断</span>
          <strong>5</strong>
          <p>评测 / 权限 / 工具</p>
        </article>
      </section>
    </>
  );
}
```

其余页面标题必须分别为：

```txt
竞品能力对标
Agent Studio
工作流编排
知识库与 RAG Pipeline
工具与 MCP 生态
评测与观测
发布渠道
模板市场
治理设置
```

- [ ] **Step 5: 更新 App 视图映射**

`apps/web/src/app/App.tsx` 使用 `activeView` 映射页面组件，并将 `useViewTransition(activeView)` 绑定到内容容器。

- [ ] **Step 6: 补充页面样式**

在 `globals.css` 追加：

```css
.panel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-panel {
  min-height: 104px;
  padding: 14px;
  background: var(--panel);
  border: 1px solid var(--soft);
  border-radius: var(--radius-lg);
}

.metric-panel span {
  color: var(--muted);
  font-size: 12px;
}

.metric-panel strong {
  display: block;
  margin-top: 8px;
  font-size: 25px;
}

.metric-panel p {
  margin: 8px 0 0;
  color: var(--ok);
  font-size: 12px;
}

@media (max-width: 900px) {
  .panel-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: 验证**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test App
pnpm typecheck:web
pnpm build:web
```

Expected: 全部通过。

- [ ] **Step 8: 提交**

```powershell
git add apps/web/src
git commit -m "feat: add primary console views"
```

## Task 5: 建立领域类型、fixtures 与 MSW mock API

**Files:**
- Create: `apps/web/src/types/domain.ts`
- Create: `apps/web/src/lib/mock/fixtures.ts`
- Create: `apps/web/src/lib/mock/handlers.ts`
- Create: `apps/web/src/lib/mock/browser.ts`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/lib/mock/fixtures.test.ts`

- [ ] **Step 1: 写 fixture 测试**

`apps/web/src/lib/mock/fixtures.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { fixtures } from "./fixtures";

describe("fixtures", () => {
  it("包含 MVP 主闭环所需的核心资源", () => {
    expect(fixtures.agents).toHaveLength(2);
    expect(fixtures.workflows).toHaveLength(1);
    expect(fixtures.knowledgeBases).toHaveLength(2);
    expect(fixtures.tools).toHaveLength(3);
    expect(fixtures.releaseGates[0].status).toBe("blocked");
    expect(fixtures.traces[0].steps.length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test fixtures
```

Expected: FAIL，提示找不到 fixture。

- [ ] **Step 3: 创建领域类型**

`apps/web/src/types/domain.ts`：

```ts
export type ResourceStatus = "draft" | "ready" | "published" | "blocked" | "degraded" | "archived";

export type Agent = {
  id: string;
  name: string;
  scenario: string;
  owner: string;
  status: ResourceStatus;
  currentVersion: string;
};

export type Workflow = {
  id: string;
  agentId: string;
  name: string;
  nodeCount: number;
  status: ResourceStatus;
};

export type KnowledgeBase = {
  id: string;
  name: string;
  documentCount: number;
  retrievalMode: "semantic" | "hybrid";
  status: ResourceStatus;
};

export type Tool = {
  id: string;
  name: string;
  type: "mcp" | "api" | "trigger";
  status: ResourceStatus;
};

export type ReleaseGate = {
  id: string;
  agentId: string;
  status: "passed" | "blocked";
  reasons: string[];
};

export type TraceStep = {
  id: string;
  type: "input" | "retrieval" | "llm" | "tool" | "human";
  title: string;
  status: "success" | "warning" | "error";
  latencyMs: number;
};

export type RunTrace = {
  id: string;
  agentId: string;
  status: "success" | "failed" | "waiting";
  steps: TraceStep[];
};
```

- [ ] **Step 4: 创建 fixtures**

`apps/web/src/lib/mock/fixtures.ts`：

```ts
import type { Agent, KnowledgeBase, ReleaseGate, RunTrace, Tool, Workflow } from "../../types/domain";

export const fixtures: {
  agents: Agent[];
  workflows: Workflow[];
  knowledgeBases: KnowledgeBase[];
  tools: Tool[];
  releaseGates: ReleaseGate[];
  traces: RunTrace[];
} = {
  agents: [
    { id: "agent-after-sale", name: "售后政策助手", scenario: "售后问答与工单分流", owner: "陈晓", status: "blocked", currentVersion: "v1.8-draft" },
    { id: "agent-order", name: "订单查询助手", scenario: "订单状态查询", owner: "王宁", status: "ready", currentVersion: "v1.2" }
  ],
  workflows: [
    { id: "flow-after-sale", agentId: "agent-after-sale", name: "售后工单 Agentflow", nodeCount: 5, status: "degraded" }
  ],
  knowledgeBases: [
    { id: "kb-after-sale", name: "售后政策库", documentCount: 128, retrievalMode: "hybrid", status: "ready" },
    { id: "kb-warranty", name: "质保条款库", documentCount: 42, retrievalMode: "semantic", status: "degraded" }
  ],
  tools: [
    { id: "tool-ticket", name: "create_ticket", type: "mcp", status: "degraded" },
    { id: "tool-order", name: "query_order", type: "api", status: "ready" },
    { id: "tool-sync", name: "scheduled_sync", type: "trigger", status: "ready" }
  ],
  releaseGates: [
    { id: "gate-after-sale", agentId: "agent-after-sale", status: "blocked", reasons: ["create_ticket 工具健康异常", "关键评测用例失败"] }
  ],
  traces: [
    {
      id: "run_8f23",
      agentId: "agent-after-sale",
      status: "failed",
      steps: [
        { id: "s1", type: "input", title: "用户输入", status: "success", latencyMs: 12 },
        { id: "s2", type: "retrieval", title: "Hybrid Retrieval", status: "success", latencyMs: 320 },
        { id: "s3", type: "llm", title: "LLM Decision", status: "success", latencyMs: 1100 },
        { id: "s4", type: "tool", title: "MCP create_ticket", status: "error", latencyMs: 8400 },
        { id: "s5", type: "human", title: "Human Review", status: "warning", latencyMs: 0 }
      ]
    }
  ]
};
```

- [ ] **Step 5: 添加 MSW**

安装依赖：

```powershell
pnpm --filter @ai-agent-platform/web add -D msw
```

`apps/web/src/lib/mock/handlers.ts`：

```ts
import { http, HttpResponse } from "msw";
import { fixtures } from "./fixtures";

export const handlers = [
  http.get("/api/agents", () => HttpResponse.json(fixtures.agents)),
  http.get("/api/workflows", () => HttpResponse.json(fixtures.workflows)),
  http.get("/api/knowledge-bases", () => HttpResponse.json(fixtures.knowledgeBases)),
  http.get("/api/tools", () => HttpResponse.json(fixtures.tools)),
  http.get("/api/release-gates", () => HttpResponse.json(fixtures.releaseGates)),
  http.get("/api/runs/:runId/trace", () => HttpResponse.json(fixtures.traces[0]))
];
```

`apps/web/src/lib/mock/browser.ts`：

```ts
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
```

- [ ] **Step 6: 在开发环境启用 mock**

`apps/web/src/main.tsx` 在 render 前添加：

```ts
if (import.meta.env.DEV) {
  const { worker } = await import("./lib/mock/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}
```

- [ ] **Step 7: 验证**

Run:

```powershell
pnpm --filter @ai-agent-platform/web test fixtures
pnpm typecheck:web
pnpm build:web
```

Expected: 全部通过。

- [ ] **Step 8: 提交**

```powershell
git add apps/web pnpm-lock.yaml
git commit -m "feat: add web mock domain data"
```

## Task 6: 实现 mock 主闭环页面数据接入

**Files:**
- Create: `apps/web/src/lib/api/client.ts`
- Create: `apps/web/src/features/agents/useAgents.ts`
- Create: `apps/web/src/features/workflows/useWorkflows.ts`
- Create: `apps/web/src/features/releases/useReleaseGates.ts`
- Create: `apps/web/src/features/runs/useRunTrace.ts`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: dashboard/workflow/observe/release pages
- Test: `apps/web/src/features/releases/useReleaseGates.test.tsx`

- [ ] **Step 1: 写 ReleaseGate hook 测试**

使用 React Query wrapper 渲染 hook，断言 `/api/release-gates` 返回 blocked。

- [ ] **Step 2: 创建 API client**

`apps/web/src/lib/api/client.ts`：

```ts
export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 3: 创建 Query hooks**

示例 `apps/web/src/features/releases/useReleaseGates.ts`：

```ts
import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { ReleaseGate } from "../../types/domain";

export function useReleaseGates() {
  return useQuery({
    queryKey: ["release-gates"],
    queryFn: () => getJson<ReleaseGate[]>("/api/release-gates")
  });
}
```

其他 hook 使用相同模式：

- `useAgents` -> `/api/agents`
- `useWorkflows` -> `/api/workflows`
- `useRunTrace(runId)` -> `/api/runs/${runId}/trace`

- [ ] **Step 4: 创建 Query Provider**

`apps/web/src/app/providers.tsx`：

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000
    }
  }
});

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

`main.tsx` 使用 `AppProviders` 包裹 `App`。

- [ ] **Step 5: 页面接入数据**

页面必须展示：

- Dashboard：Agent 数量、异常工具、发布阻断。
- Workflow：工作流名称、节点数量、工具异常。
- Observe：Trace steps。
- Release：ReleaseGate reasons。

- [ ] **Step 6: 验证**

Run:

```powershell
pnpm test:web
pnpm typecheck:web
pnpm build:web
```

Expected: 全部通过。

- [ ] **Step 7: 提交**

```powershell
git add apps/web/src
git commit -m "feat: connect web views to mock api"
```

## Task 7: 加入 Playwright 导航与响应式验收

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/navigation.spec.ts`
- Create: `apps/web/e2e/responsive.spec.ts`

- [ ] **Step 1: 创建 Playwright 配置**

`apps/web/playwright.config.ts`：

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI
  },
  use: {
    baseURL: "http://127.0.0.1:5173"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } }
  ]
});
```

- [ ] **Step 2: 写导航 E2E**

`apps/web/e2e/navigation.spec.ts`：

```ts
import { expect, test } from "@playwright/test";

test("10 个一级视图可切换", async ({ page }) => {
  await page.goto("/");

  const cases = [
    ["工作台", "企业 Agent 工作台"],
    ["竞品策略", "竞品能力对标"],
    ["Agent Studio", "Agent Studio"],
    ["工作流", "工作流编排"],
    ["知识库", "知识库与 RAG Pipeline"],
    ["工具与 MCP", "工具与 MCP 生态"],
    ["评测与观测", "评测与观测"],
    ["发布渠道", "发布渠道"],
    ["模板市场", "模板市场"],
    ["治理设置", "治理设置"]
  ];

  for (const [button, title] of cases) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});
```

- [ ] **Step 3: 写响应式 E2E**

`apps/web/e2e/responsive.spec.ts`：

```ts
import { expect, test } from "@playwright/test";

test("移动端没有页面级横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  expect(hasOverflow).toBe(false);
});
```

- [ ] **Step 4: 验证**

Run:

```powershell
pnpm --filter @ai-agent-platform/web e2e
```

Expected: 所有 Playwright 测试通过。

- [ ] **Step 5: 提交**

```powershell
git add apps/web/e2e apps/web/playwright.config.ts
git commit -m "test: add web navigation e2e coverage"
```

## Task 8: 初始化 FastAPI 后端骨架

**Files:**
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/app/main.py`
- Create: `apps/api/app/core/config.py`
- Create: `apps/api/app/core/errors.py`
- Create: `apps/api/tests/test_health.py`

- [ ] **Step 1: 创建目录**

```powershell
New-Item -ItemType Directory -Force -Path apps\api\app\core,apps\api\tests | Out-Null
```

- [ ] **Step 2: 创建 `pyproject.toml`**

```toml
[project]
name = "ai-agent-platform-api"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "pydantic-settings>=2.6.0"
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3.0",
  "httpx>=0.27.0",
  "ruff>=0.8.0"
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 3: 写健康检查测试**

`apps/api/tests/test_health.py`：

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_check():
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: 创建 FastAPI app**

`apps/api/app/main.py`：

```python
from fastapi import FastAPI

app = FastAPI(title="AI Agent Platform API")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 5: 安装与验证**

```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m pytest
cd ..\..
```

Expected: `1 passed`。

- [ ] **Step 6: 提交**

```powershell
git add apps/api
git commit -m "feat: initialize api service"
```

## Task 9: 建立后端领域 DTO 与内存 Repository

**Files:**
- Create: `apps/api/app/modules/agent/schemas.py`
- Create: `apps/api/app/modules/agent/repository.py`
- Create: `apps/api/app/modules/workflow/schemas.py`
- Create: `apps/api/app/modules/trace/schemas.py`
- Test: `apps/api/tests/test_agent_repository.py`

- [ ] **Step 1: 写 Repository 测试**

`apps/api/tests/test_agent_repository.py`：

```python
from app.modules.agent.repository import AgentRepository
from app.modules.agent.schemas import AgentCreate


def test_create_agent_draft():
    repo = AgentRepository()
    agent = repo.create(AgentCreate(name="售后政策助手", scenario="售后问答"))

    assert agent.id.startswith("agent_")
    assert agent.name == "售后政策助手"
    assert agent.status == "draft"
```

- [ ] **Step 2: 实现 Agent schemas**

`apps/api/app/modules/agent/schemas.py`：

```python
from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=1)
    scenario: str = Field(min_length=1)


class AgentRead(BaseModel):
    id: str
    name: str
    scenario: str
    status: str
```

- [ ] **Step 3: 实现内存 Repository**

`apps/api/app/modules/agent/repository.py`：

```python
from uuid import uuid4

from app.modules.agent.schemas import AgentCreate, AgentRead


class AgentRepository:
    def __init__(self) -> None:
        self._agents: dict[str, AgentRead] = {}

    def create(self, payload: AgentCreate) -> AgentRead:
        agent_id = f"agent_{uuid4().hex[:8]}"
        agent = AgentRead(
            id=agent_id,
            name=payload.name,
            scenario=payload.scenario,
            status="draft",
        )
        self._agents[agent_id] = agent
        return agent

    def list(self) -> list[AgentRead]:
        return list(self._agents.values())
```

- [ ] **Step 4: 创建 Workflow/Trace schemas**

`apps/api/app/modules/workflow/schemas.py`：

```python
from pydantic import BaseModel, Field


class WorkflowNodeRead(BaseModel):
    id: str
    type: str
    name: str
    position: dict[str, float] = Field(default_factory=dict)
    config: dict[str, object] = Field(default_factory=dict)


class WorkflowRead(BaseModel):
    id: str
    agent_id: str
    name: str
    status: str
    nodes: list[WorkflowNodeRead] = Field(default_factory=list)
```

`apps/api/app/modules/trace/schemas.py`：

```python
from pydantic import BaseModel, Field


class TraceStepRead(BaseModel):
    id: str
    type: str
    title: str
    status: str
    latency_ms: int
    input_summary: str | None = None
    output_summary: str | None = None
    error_message: str | None = None


class RunTraceRead(BaseModel):
    id: str
    agent_id: str
    status: str
    steps: list[TraceStepRead] = Field(default_factory=list)
```

此任务只定义 DTO，不实现工作流执行器。

- [ ] **Step 5: 验证**

```powershell
cd apps\api
.\.venv\Scripts\python -m pytest
cd ..\..
```

Expected: 全部通过。

- [ ] **Step 6: 提交**

```powershell
git add apps/api/app/modules apps/api/tests
git commit -m "feat: add api domain schemas"
```

## Task 10: 实现后端 P0 API 路由

**Files:**
- Create: `apps/api/app/modules/agent/router.py`
- Create: `apps/api/app/modules/release/router.py`
- Create: `apps/api/app/modules/trace/router.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/test_p0_routes.py`

- [ ] **Step 1: 写 API 测试**

`apps/api/tests/test_p0_routes.py`：

```python
from fastapi.testclient import TestClient

from app.main import app


def test_create_and_list_agents():
    client = TestClient(app)

    created = client.post("/api/agents", json={"name": "售后政策助手", "scenario": "售后问答"})
    assert created.status_code == 201

    listed = client.get("/api/agents")
    assert listed.status_code == 200
    assert listed.json()[0]["name"] == "售后政策助手"


def test_release_gate_returns_blocked_reason():
    client = TestClient(app)
    response = client.post("/api/agents/agent-after-sale/release-gates/check")

    assert response.status_code == 200
    assert response.json()["status"] == "blocked"
    assert "工具健康异常" in response.json()["reasons"][0]
```

- [ ] **Step 2: 实现 Agent router**

`apps/api/app/modules/agent/router.py`：

```python
from fastapi import APIRouter, status

from app.modules.agent.repository import AgentRepository
from app.modules.agent.schemas import AgentCreate, AgentRead

router = APIRouter(prefix="/api/agents", tags=["agents"])
repo = AgentRepository()


@router.get("", response_model=list[AgentRead])
def list_agents() -> list[AgentRead]:
    return repo.list()


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate) -> AgentRead:
    return repo.create(payload)
```

- [ ] **Step 3: 实现 release gate 与 trace router**

Release gate 先返回可解释阻断：

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/agents", tags=["release-gates"])


@router.post("/{agent_id}/release-gates/check")
def check_release_gate(agent_id: str) -> dict[str, object]:
    return {
        "agentId": agent_id,
        "status": "blocked",
        "reasons": ["工具健康异常：create_ticket degraded", "关键评测用例失败"]
    }
```

- [ ] **Step 4: 注册 router**

`main.py`：

```python
from app.modules.agent.router import router as agent_router
from app.modules.release.router import router as release_router

app.include_router(agent_router)
app.include_router(release_router)
```

- [ ] **Step 5: 验证**

```powershell
cd apps\api
.\.venv\Scripts\python -m pytest
cd ..\..
```

Expected: 全部通过。

- [ ] **Step 6: 提交**

```powershell
git add apps/api
git commit -m "feat: add p0 api routes"
```

## Task 11: 增加数据库迁移与 MySQL schema

**Files:**
- Modify: `apps/api/pyproject.toml`
- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/app/core/database.py`
- Create: `apps/api/app/modules/agent/models.py`
- Create: `apps/api/app/modules/audit/models.py`
- Create: first migration under `apps/api/alembic/versions/`

- [ ] **Step 1: 增加依赖**

`apps/api/pyproject.toml` dependencies 增加：

```toml
"sqlalchemy>=2.0.36",
"alembic>=1.14.0",
"pymysql>=1.1.1"
```

- [ ] **Step 2: 创建数据库配置**

`apps/api/app/core/database.py`：

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = "mysql+pymysql://root:root@localhost:3306/ai_agent_platform?charset=utf8mb4"


class Base(DeclarativeBase):
    pass


engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
```

- [ ] **Step 3: 创建 Agent 与 Audit models**

`apps/api/app/modules/agent/models.py`：

```python
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AgentModel(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    scenario: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

`apps/api/app/modules/audit/models.py`：

```python
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    actor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(64), nullable=False)
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

- [ ] **Step 4: 配置 Alembic 并生成迁移**

Run:

```powershell
cd apps\api
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\alembic revision --autogenerate -m "create agent and audit tables"
cd ..\..
```

Expected: `alembic/versions/*create_agent_and_audit_tables.py` 被创建。

- [ ] **Step 5: 验证迁移脚本存在且测试通过**

Run:

```powershell
cd apps\api
.\.venv\Scripts\python -m pytest
cd ..\..
```

Expected: 测试通过。

- [ ] **Step 6: 提交**

```powershell
git add apps/api
git commit -m "feat: add api database schema"
```

## Task 12: 连接前端到真实 API 开关

**Files:**
- Create: `apps/web/.env.example`
- Modify: `apps/web/src/lib/api/client.ts`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/lib/api/client.test.ts`

- [ ] **Step 1: 创建环境变量示例**

`apps/web/.env.example`：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCK_API=true
```

- [ ] **Step 2: 更新 API client**

`client.ts`：

```ts
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${url}`);

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 3: mock 只在开关开启时启动**

`main.tsx`：

```ts
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API !== "false") {
  const { worker } = await import("./lib/mock/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}
```

- [ ] **Step 4: 验证**

Run:

```powershell
pnpm test:web
pnpm typecheck:web
pnpm build:web
```

Expected: 全部通过。

- [ ] **Step 5: 提交**

```powershell
git add apps/web
git commit -m "feat: add api environment switch"
```

## Task 13: P0-4 知识库、工具、评测、发布任务拆分

**Files:**
- Modify: `apps/api/app/modules/knowledge/*`
- Modify: `apps/api/app/modules/tool/*`
- Modify: `apps/api/app/modules/evaluation/*`
- Modify: `apps/api/app/modules/release/*`
- Modify: `apps/web/src/features/knowledge/*`
- Modify: `apps/web/src/features/tools/*`
- Modify: `apps/web/src/features/evaluations/*`
- Modify: `apps/web/src/features/releases/*`

- [ ] **Step 1: 知识库最小闭环**

实现：

- 创建知识库。
- 上传文档元数据。
- 创建处理任务。
- 返回处理状态。
- 支持检索测试 mock/真实接口。

验收命令：

```powershell
pnpm test:web
cd apps\api
.\.venv\Scripts\python -m pytest
cd ..\..
```

- [ ] **Step 2: 工具/MCP 最小闭环**

实现：

- 注册 MCP Server 元数据。
- 注册 API Tool。
- 保存工具 schema。
- 返回工具健康状态。
- 发布检查读取工具健康状态。

- [ ] **Step 3: 评测最小闭环**

实现：

- 创建 EvaluationDataset。
- 创建 EvaluationCase。
- 运行 EvaluationRun。
- 返回通过率、失败用例和成本延迟摘要。

- [ ] **Step 4: 发布门禁真实化**

实现：

- ReleaseGate 聚合评测结果、工具健康、知识库索引状态和权限状态。
- blocked 状态必须返回可读 reasons。
- 生产发布和回滚写入审计日志。

- [ ] **Step 5: 提交**

每个子步骤单独提交：

```powershell
git commit -m "feat: add knowledge base p0 flow"
git commit -m "feat: add tool health p0 flow"
git commit -m "feat: add evaluation p0 flow"
git commit -m "feat: add release gate aggregation"
```

## 3. 验收清单

MVP 工程完成前必须满足：

- [ ] `pnpm build:web` 通过。
- [ ] `pnpm test:web` 通过。
- [ ] `pnpm --filter @ai-agent-platform/web e2e` 通过。
- [ ] `apps/api` pytest 全部通过。
- [ ] 前端 10 个一级视图可访问。
- [ ] 390px 移动端无页面级横向溢出。
- [ ] 创建 Agent 草稿可用。
- [ ] 工作流调试能生成 Run 和 Trace。
- [ ] 发布门禁能展示 blocked reasons。
- [ ] 高风险操作写入审计日志或至少返回阻断原因。
- [ ] 前端可以在 mock API 和真实 API 之间切换。

## 4. 风险与回滚

- 前端依赖安装失败：回滚当前任务提交，保留文档和原型。
- React 19 生态兼容问题：降级 React 18，并在同一任务提交中调整依赖。
- Playwright 在 Windows 本地不稳定：保留 E2E 规范，先以单元测试和手动截图验收，CI 再补跑。
- MySQL 本地不可用：后端 Repository 继续保留内存实现，数据库任务延后，不阻断前端主闭环。
- MCP 真实接入复杂：P0 使用 schema 和健康状态模拟，真实 transport 放到 P1。

## 5. 执行建议

优先执行 Task 1 到 Task 7，先获得可运行、可演示、可测试的前端主闭环。后端 Task 8 到 Task 12 在前端 mock 闭环稳定后启动。Task 13 拆成多个后续计划执行，避免一次实施过大。
