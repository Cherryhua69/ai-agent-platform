# Graph Report - .  (2026-06-21)

## Corpus Check
- 182 files · ~139,414 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 904 nodes · 1738 edges · 79 communities (70 shown, 9 thin omitted)
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 327 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 70|Community 70]]

## God Nodes (most connected - your core abstractions)
1. `WorkflowRepository` - 36 edges
2. `LangChainModelClient` - 35 edges
3. `NodeRegistry` - 35 edges
4. `GraphExecutor` - 28 edges
5. `AgentRepository` - 24 edges
6. `Base` - 23 edges
7. `AgentRunService` - 23 edges
8. `WorkflowNodeExecutionError` - 22 edges
9. `WorkflowExecutionError` - 22 edges
10. `GraphCompiler` - 21 edges

## Surprising Connections (you probably didn't know these)
- `AuditLogModel` --uses--> `Base`  [INFERRED]
  apps/api/app/modules/audit/models.py → apps/api/app/core/database.py
- `EvaluationRunModel` --uses--> `Base`  [INFERRED]
  apps/api/app/modules/evaluation/models.py → apps/api/app/core/database.py
- `KnowledgeBaseModel` --uses--> `Base`  [INFERRED]
  apps/api/app/modules/knowledge/models.py → apps/api/app/core/database.py
- `ModelProviderModel` --uses--> `Base`  [INFERRED]
  apps/api/app/modules/model_provider/models.py → apps/api/app/core/database.py
- `ToolModel` --uses--> `Base`  [INFERRED]
  apps/api/app/modules/tool/models.py → apps/api/app/core/database.py

## Import Cycles
- 1-file cycle: `apps/api/app/modules/agent/models.py -> apps/api/app/modules/agent/models.py`
- 1-file cycle: `apps/api/app/modules/audit/models.py -> apps/api/app/modules/audit/models.py`
- 1-file cycle: `apps/api/app/modules/evaluation/models.py -> apps/api/app/modules/evaluation/models.py`
- 1-file cycle: `apps/api/app/modules/knowledge/models.py -> apps/api/app/modules/knowledge/models.py`
- 1-file cycle: `apps/api/app/modules/model_provider/models.py -> apps/api/app/modules/model_provider/models.py`
- 1-file cycle: `apps/api/app/modules/tool/models.py -> apps/api/app/modules/tool/models.py`
- 1-file cycle: `apps/api/app/modules/trace/models.py -> apps/api/app/modules/trace/models.py`
- 1-file cycle: `apps/api/app/modules/workflow/models.py -> apps/api/app/modules/workflow/models.py`

## Communities (79 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (51): AgentModel, AgentRepository, create_agent(), list_agents(), simulate_agent_run(), stream_agent_run(), update_agent(), AgentRunService (+43 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (47): streamAgentRun(), StreamAgentRunPayload, StreamEvent, WorkflowEdge, WorkflowInputField, WorkflowNode, CanvasConfigState, useCanvasConfig (+39 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (35): ConversationMessage, KnowledgeSearchResponse, BaseModel, EvaluationCaseCreate, EvaluationCaseRead, EvaluationDatasetCreate, EvaluationDatasetRead, EvaluationRunCreate (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (39): dependencies, gsap, @gsap/react, lucide-react, react, react-dom, react-router-dom, @tanstack/react-query (+31 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (25): getJson(), DashboardPage(), KnowledgePage(), useKnowledgeBases(), PageHeader(), PageHeaderProps, MarketplacePage(), templates (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.20
Nodes (31): WorkflowEdgeRead, WorkflowNodeRead, WorkflowRead, WorkflowEdgeRead, WorkflowNodeRead, WorkflowRead, edge(), node() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): SimulateAgentRunPayload, useSimulateAgentRun(), deleteJson(), patchJson(), postJson(), putJson(), CreateToolPayload, AgentStatus (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (15): DialogMode, emptyModelApiForm, ModelApiForm, ToolCategory, ToolsPage(), CreateModelProviderPayload, useCreateModelProvider(), useModelProviders() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (12): AgentDialogMode, AgentStudioPage(), AgentStudioPageProps, listedAgent, publishedAgent, useAgents(), CreateAgentPayload, useCreateAgent() (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (12): App(), viewCases, AppProviders(), queryClient, AppShell(), AppShellProps, NavItem, navItems (+4 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (14): worker, agents, fixtures, knowledgeBases, modelProviders, releaseGates, runTrace, tools (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (12): RunTraceRead, Session, sessionmaker, RunModel, RunTraceCreate, TraceRepository, RunTraceCreate, RunTraceRead (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (7): Session, sessionmaker, WorkflowRead, WorkflowTestRead, WorkflowUpdate, WorkflowRepository, WorkflowModel

### Community 15 - "Community 15"
Cohesion: 0.31
Nodes (17): node(), registry(), test_condition_handler_records_selected_route(), test_condition_handler_supports_all_frontend_operators(), test_expose_handler_maps_declared_outputs(), test_expose_handler_maps_structured_selectors_and_nested_values(), test_handler_wraps_node_failure_with_failed_trace(), test_llm_handler_builds_prompt_and_normalizes_result() (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.24
Nodes (7): ModelProviderCreate, ModelProviderModel, ModelProviderRead, ModelProviderUpdate, Session, sessionmaker, ModelProviderRepository

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (7): KnowledgeRepository, ReleaseGateRead, EvaluationRepository, ReleaseGateService, test_release_gate_checked_at_uses_current_utc_time(), test_release_gate_service_aggregates_real_resource_statuses(), ToolRepository

### Community 18 - "Community 18"
Cohesion: 0.23
Nodes (12): WorkflowRead, KnowledgeRepository, LangChainModelClient, ModelProviderRepository, NodeRegistry, WorkflowNodeRead, GraphCompiler, TypedDict (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.36
Nodes (13): WorkflowEdgeRead, WorkflowNodeRead, edge(), FakeRegistry, node(), test_condition_executes_only_selected_branch_without_deadlock(), test_executor_exposes_failed_node_trace(), test_executor_runs_linear_graph_and_returns_result() (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (14): compilerOptions, allowSyntheticDefaultImports, composite, declaration, emitDeclarationOnly, lib, module, moduleResolution (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.23
Nodes (8): EvaluationCaseCreate, EvaluationCaseRead, EvaluationRunCreate, EvaluationRunRead, EvaluationCaseModel, EvaluationRepository, EvaluationSummary, EvaluationRunModel

### Community 22 - "Community 22"
Cohesion: 0.22
Nodes (7): KnowledgeBaseCreate, KnowledgeBaseRead, KnowledgeProcessingJobRead, Session, sessionmaker, KnowledgeRepository, KnowledgeBaseModel

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (12): KnowledgeBaseCreate, KnowledgeBaseRead, KnowledgeDocumentCreate, KnowledgeDocumentRead, KnowledgeProcessingJobRead, KnowledgeSearchResponse, add_document(), create_knowledge_base() (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (7): Session, sessionmaker, ToolCreate, ToolHealthRead, ToolRead, ToolRepository, ToolModel

### Community 25 - "Community 25"
Cohesion: 0.32
Nodes (4): NodeRegistry, WorkflowNodeRead, NodeHandler, NodeRegistry

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (10): EvaluationCaseCreate, EvaluationCaseRead, EvaluationDatasetCreate, EvaluationDatasetRead, EvaluationRunCreate, EvaluationRunRead, add_case(), create_dataset() (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (6): WorkflowEdgeRead, WorkflowRead, WorkflowState, Protocol, CompiledWorkflowGraph, 把已校验的持久化图编译为 LangGraph。

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): name, packageManager, private, scripts, build:web, dev:web, e2e:web, lint:web (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.24
Nodes (9): ModelProviderCreate, ModelProviderRead, ModelProviderUpdate, create_model_provider(), list_model_providers(), test_model_provider(), update_model_provider(), ModelProviderTestRequest (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.22
Nodes (9): McpServerCreate, McpServerRead, ToolCreate, ToolHealthRead, ToolRead, create_mcp_server(), create_tool(), get_tool_health() (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (6): Any, Exception, AppError, test_state_reducers_merge_parallel_updates(), merge_dicts(), merge_lists()

### Community 32 - "Community 32"
Cohesion: 0.31
Nodes (6): datetime, Base, DeclarativeBase, RunModel, TraceStepModel, utc_now()

### Community 33 - "Community 33"
Cohesion: 0.36
Nodes (8): Any, WorkflowState, test_resolve_variable_supports_inputs_and_node_output(), _compare(), _read_path(), _render_prompt(), resolve_variable(), _serializable()

### Community 34 - "Community 34"
Cohesion: 0.28
Nodes (8): WorkflowRead, WorkflowTestRead, WorkflowUpdate, get_workflow(), list_workflows(), run_workflow_test(), update_workflow(), WorkflowTestRequest

### Community 35 - "Community 35"
Cohesion: 0.42
Nodes (8): activeClientIds, getResponse(), handleRequest(), IS_MOCKED_RESPONSE, resolveMainClient(), respondWithMock(), sendToClient(), serializeRequest()

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (6): datetime, EvaluationDatasetCreate, EvaluationDatasetRead, EvaluationDatasetModel, EvaluationRunModel, utc_now()

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (6): datetime, KnowledgeDocumentCreate, KnowledgeDocumentRead, KnowledgeBaseModel, KnowledgeDocumentModel, utc_now()

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (6): datetime, McpServerCreate, McpServerRead, McpServerModel, ToolModel, utc_now()

### Community 40 - "Community 40"
Cohesion: 0.60
Nodes (4): Assertion, AsymmetricMatchersContaining, JestDomAssertions, JestDomValue

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (3): datetime, AuditLogModel, utc_now()

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (3): datetime, ModelProviderModel, utc_now()

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): ReleaseGateRead, check_release_gate(), list_release_gates()

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): datetime, utc_now(), WorkflowModel

## Knowledge Gaps
- **192 isolated node(s):** `sessionmaker`, `Session`, `EvaluationDatasetCreate`, `EvaluationDatasetRead`, `EvaluationCaseCreate` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Base` connect `Community 32` to `Community 0`, `Community 36`, `Community 37`, `Community 38`, `Community 42`, `Community 43`, `Community 45`, `Community 46`, `Community 21`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `AgentModel` connect `Community 0` to `Community 32`, `Community 46`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `NodeRegistry` connect `Community 25` to `Community 0`, `Community 33`, `Community 41`, `Community 18`, `Community 19`, `Community 51`, `Community 52`, `Community 27`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Are the 32 inferred relationships involving `WorkflowRepository` (e.g. with `AgentRepository` and `AgentRunService`) actually correct?**
  _`WorkflowRepository` has 32 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `LangChainModelClient` (e.g. with `AgentRunService` and `AgentCreate`) actually correct?**
  _`LangChainModelClient` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `NodeRegistry` (e.g. with `AgentCreate` and `AgentRead`) actually correct?**
  _`NodeRegistry` has 25 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `GraphExecutor` (e.g. with `AgentRunService` and `AgentCreate`) actually correct?**
  _`GraphExecutor` has 25 INFERRED edges - model-reasoned connections that need verification._