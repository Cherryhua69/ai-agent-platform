# AI Agent Platform

AI Agent Platform is a planned enterprise-grade intelligent agent management platform inspired by products such as Dify and Coze, but designed around controllability, observability, MCP/tool integration, workflow orchestration, evaluation, and release governance.

The repository is currently in the product-definition phase. No application code has been scaffolded yet.

## Product Direction

- Manage agents across teams, projects, environments, and release channels.
- Build agents with visual workflow orchestration, model configuration, knowledge retrieval, MCP tools, and permission controls.
- Debug each run through trace-level logs covering prompts, retrieval, model calls, tool calls, cost, latency, and errors.
- Evaluate agents before release with datasets, metrics, and release gates.
- Publish agents to Web Chat, API, and enterprise messaging channels.

## Planned Tech Stack

- Frontend: React, Vite, TypeScript
- UI: Tailwind CSS, shadcn/ui or a custom component system
- Icons: lucide-react
- Workflow canvas: React Flow
- State: Zustand
- Data fetching: TanStack Query
- Backend: NestJS or FastAPI, to be finalized
- Database: MySQL
- Vector storage: Qdrant or Milvus through an adapter interface
- Deployment baseline: Docker Compose

## Proposed Repository Structure

```txt
apps/
  web/
  api/
packages/
  ui/
  shared/
  workflow-core/
  mcp-core/
docs/
  prd/
  architecture/
  design/
  api/
infra/
  docker/
  scripts/
.github/
  workflows/
  ISSUE_TEMPLATE/
```

## Current Documents

- [MVP Requirements](docs/prd/mvp-requirements.md)
- [Feature Breakdown](docs/prd/feature-breakdown.md)
- [User Stories](docs/prd/user-stories.md)
- [Release Plan](docs/prd/release-plan.md)
- [Information Architecture](docs/architecture/information-architecture.md)
- [Domain Model](docs/architecture/domain-model.md)
- [UI Style Guide](docs/design/ui-style-guide.md)
- [GitHub Setup](docs/architecture/github-setup.md)
- [Frontend UI Engineering Plan](docs/design/frontend-ui-engineering-plan.md)
- [Open Design Prototype](docs/design/open-design-prototype.md)
- [Codex Continuation Guide](docs/architecture/codex-continuation-guide.md)

## GitHub Remote

Create a GitHub repository, then connect it locally:

```powershell
git remote add origin https://github.com/<owner>/ai-agent-platform.git
git branch -M main
git push -u origin main
```
