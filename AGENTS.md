# Project Guidance

## Graphify Code Map

Use graphify as the project code map when work may affect architecture, workflows, repositories, services, data models, API boundaries, or multiple modules.

Before making cross-module or architecture-level changes, inspect the graph first with one of:

```text
/graphify query "<question>"
/graphify explain "<node>"
/graphify path "<from>" "<to>"
```

Good times to use graphify:

- Changing workflow execution, workflow nodes, graph compilation, or graph validation.
- Changing repository/service boundaries such as `WorkflowRepository`, `AgentRepository`, or `AgentRunService`.
- Modifying model/provider integration such as `LangChainModelClient`.
- Refactoring shared database models, schemas, or `Base`.
- Investigating impact radius before deleting, renaming, or moving code.
- Reviewing surprising dependencies or inferred relationships before trusting them.

After structural changes, update the graph:

```text
/graphify . --update
```

Current graph outputs live in `graphify-out/`:

- `graphify-out/graph.json`
- `graphify-out/graph.html`
- `graphify-out/GRAPH_REPORT.md`

If the graph is stale or missing, rebuild it before relying on graph answers.
