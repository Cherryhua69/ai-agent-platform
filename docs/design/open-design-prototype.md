# Open Design UI Prototype

## Prototype Reference

- Open Design project: `ai-agent-management-platform`
- Project name: `AI Agent Management Platform Prototype`
- Entry file: `index.html`
- Preview: <http://127.0.0.1:12260/api/projects/ai-agent-management-platform/raw/index.html>

## Generation Notes

The existing Open Design project was reused. A new Open Design run was attempted, but the internal agent failed with `AMR_AUTH_REQUIRED`: AMR sign-in is required before the Open Design agent can run again.

To avoid leaving the prototype blocked, the project entry file was manually updated through Open Design `write_file`. The result is a single static, browsable HTML prototype with in-page navigation between product areas.

## Covered Pages

- 工作台总览：global metrics, abnormal runs, pending release items, evaluation failures, MCP tool issues.
- 智能体列表与详情：table-first agent inventory plus right-side detail, model strategy, resource bindings, and release checks.
- 工作流编排器：node library, visual canvas, selected node inspector, and debug status bar.
- MCP / 工具管理：MCP server list, tool health table, permission hints, and schema diagnostics.
- 知识库管理：knowledge base list, document/import state, embedding configuration signals, retrieval test results.
- 运行 Trace 详情：step timeline covering input, retrieval, model call, tool call, final output, latency, cost, token, and error stack.
- 评测页面：test set runs, pass rate, accuracy, latency, cost, tool success rate, and release gate status.
- 发布配置页面：environment version cards, channel configuration table, access controls, release checks, and rollback readiness.

## Design Principles

- Use a mature enterprise SaaS console layout: dark left navigation, light main workspace, top toolbar, and dense work surfaces.
- Prefer tables, split panes, property panels, timelines, and workflow canvas structures over marketing sections or decorative card grids.
- Keep visual language restrained: `#F6F7F9` page background, white panels, blue primary actions, semantic status colors, 4px to 8px radius.
- Make observability and governance visible at the page level: trace IDs, gate status, schema errors, ownership, permissions, latency, cost, and release blockers.
- Keep the first screen immediately usable as a product interface, not a landing page.

## Validation

- Opened the Open Design preview in the in-app browser.
- Verified all 8 navigation views switch correctly.
- Verified the workflow view includes the canvas surface.
- Verified desktop width has no horizontal overflow.
- Verified a 390px mobile viewport collapses the sidebar and content grids without horizontal overflow.

## Iteration Points

- Add a second-level navigation pattern for agent detail subpages, such as configuration, versions, resources, and runs.
- Expand the workflow editor with explicit connector handles, node add/edit states, and debug result drawer variants.
- Add modal states for creating an agent, adding an MCP server, importing documents, and publishing a release.
- Define empty, loading, permission-denied, and destructive confirmation states before React implementation.
- Re-run the Open Design agent after AMR Cloud sign-in is restored to generate additional visual refinements and screenshots.

## React Implementation Handoff

- Keep the prototype as the first implementation reference for information architecture, density, tokens, and page composition.
- Map the app shell to React components: `AppShell`, `SidebarNav`, `Topbar`, `PageHeader`, `Panel`, `StatusPill`, `DataTable`, `MetricPanel`, `InspectorPanel`.
- Use React Flow or an equivalent workflow canvas library for the workflow editor rather than recreating graph behavior with static DOM.
- Use lucide-react for production icons, replacing the prototype's text glyph placeholders with consistent line icons and tooltips.
- Represent sample data as typed fixtures first, then connect TanStack Query once backend contracts are available.
- Preserve the release governance model across implementation: evaluation gates and MCP/tool health should directly explain why a release is blocked.
