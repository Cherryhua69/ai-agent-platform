import { http, HttpResponse } from "msw";
import type { Agent, DashboardSummary, ModelProvider, Tool } from "../../types/domain";
import { agents, knowledgeBases, modelProviders, recentRuns, releaseGates, runTrace, tools, workflows } from "./fixtures";

export const handlers = [
  http.get("/api/agents", () => HttpResponse.json(agents)),
  http.get("/api/dashboard/summary", () => {
    const relevantRuns = recentRuns.filter((run) => run.runCategory === "test" || run.runCategory === "production");
    const successfulRuns = relevantRuns.filter((run) => run.status === "success").length;
    const summary: DashboardSummary = {
      runSuccessRate: {
        value: relevantRuns.length ? Math.round((successfulRuns / relevantRuns.length) * 100) : 0,
        windowHours: 24,
        totalRuns: relevantRuns.length,
        successfulRuns
      },
      publishedAgents: 0,
      pendingAgents: agents
        .filter((agent) => agent.status !== "published")
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
          description: agent.scenario,
          status: "configuring"
        }))
    };
    return HttpResponse.json(summary);
  }),
  http.post("/api/agents", async ({ request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const agentId = `agent_created_${agents.length + 1}`;
    const agent: Agent = {
      id: agentId,
      name: String(payload.name),
      scenario: String(payload.scenario ?? ""),
      owner: "陈晓",
      status: "draft",
      modelPolicy: "gpt-4.1 + fallback",
      workflowId: `flow_${agentId}`,
      knowledgeBaseIds: ["kb-after-sale"],
      toolIds: ["tool-create-ticket"]
    };
    agents.unshift(agent);
    return HttpResponse.json(agent, { status: 201 });
  }),
  http.patch("/api/agents/:agentId", async ({ params, request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const index = agents.findIndex((agent) => agent.id === params.agentId);
    if (index === -1) {
      return HttpResponse.json({ detail: "Agent not found" }, { status: 404 });
    }

    agents[index] = {
      ...agents[index],
      name: String(payload.name),
      scenario: String(payload.scenario ?? "")
    };
    return HttpResponse.json(agents[index]);
  }),
  http.delete("/api/agents/:agentId", ({ params }) => {
    const index = agents.findIndex((agent) => agent.id === params.agentId);
    if (index === -1) {
      return HttpResponse.json({ detail: "Agent not found" }, { status: 404 });
    }

    agents.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/workflows", () => HttpResponse.json(workflows)),
  http.put("/api/workflows/:workflowId", async ({ params, request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const index = workflows.findIndex((workflow) => workflow.id === params.workflowId);
    if (index === -1) {
      return HttpResponse.json({ detail: "Workflow not found" }, { status: 404 });
    }

    workflows[index] = {
      ...workflows[index],
      name: String(payload.name),
      status: String(payload.status) as (typeof workflows)[number]["status"],
      toolHealthStatus: String(payload.toolHealthStatus) as (typeof workflows)[number]["toolHealthStatus"],
      nodes: Array.isArray(payload.nodes) ? (payload.nodes as (typeof workflows)[number]["nodes"]) : workflows[index].nodes,
      edges: Array.isArray(payload.edges) ? (payload.edges as (typeof workflows)[number]["edges"]) : workflows[index].edges,
      viewport: typeof payload.viewport === "object" && payload.viewport !== null ? ((payload.viewport as (typeof workflows)[number]["viewport"])) : workflows[index].viewport
    };

    return HttpResponse.json(workflows[index]);
  }),
  http.get("/api/knowledge-bases", () => HttpResponse.json(knowledgeBases)),
  http.get("/api/tools", () => HttpResponse.json(tools)),
  http.post("/api/tools", async ({ request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const tool: Tool = {
      id: `tool_created_${tools.length + 1}`,
      name: String(payload.name),
      type: String(payload.type) as Tool["type"],
      credential: String(payload.credential),
      permission: String(payload.permission),
      health: "online",
      lastCalledAt: "刚刚"
    };
    tools.push(tool);
    return HttpResponse.json(tool, { status: 201 });
  }),
  http.get("/api/model-providers", () => HttpResponse.json(modelProviders)),
  http.post("/api/model-providers", async ({ request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const provider: ModelProvider = {
      id: "model_provider_created",
      name: String(payload.name),
      providerType: String(payload.providerType),
      baseUrl: String(payload.baseUrl),
      model: String(payload.model),
      apiKeyPreview: "sk-...ocal",
      status: "guarded",
      isDefault: Boolean(payload.isDefault)
    };
    modelProviders.push(provider);
    return HttpResponse.json(provider, { status: 201 });
  }),
  http.put("/api/model-providers/:providerId", async ({ params, request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const index = modelProviders.findIndex((provider) => provider.id === params.providerId);
    if (index === -1) {
      return HttpResponse.json({ detail: "Model provider not found" }, { status: 404 });
    }
    if (Boolean(payload.isDefault)) {
      modelProviders.forEach((provider) => {
        provider.isDefault = false;
      });
    }
    modelProviders[index] = {
      ...modelProviders[index],
      name: String(payload.name),
      providerType: String(payload.providerType),
      baseUrl: String(payload.baseUrl),
      model: String(payload.model),
      apiKeyPreview: payload.apiKey ? "sk-...ocal" : modelProviders[index].apiKeyPreview,
      isDefault: Boolean(payload.isDefault)
    };
    return HttpResponse.json(modelProviders[index]);
  }),
  http.post("/api/model-providers/:providerId/test", ({ params }) => {
    const provider = modelProviders.find((item) => item.id === params.providerId);
    if (!provider) {
      return HttpResponse.json({ detail: "Model provider not found" }, { status: 404 });
    }
    provider.status = "online";
    return HttpResponse.json({ status: "success", output: `[${provider.model}] connection ok` });
  }),
  http.get("/api/release-gates", () => HttpResponse.json(releaseGates)),
  http.get("/api/runs/recent", () => HttpResponse.json(recentRuns)),
  http.post("/api/agents/:agentId/runs", async ({ params, request }) => {
    const payload = (await request.json()) as { userInput?: string; runCategory?: "test" | "production" };
    const runId = `run_${Date.now().toString(16)}`;
    const agentId = String(params.agentId);
    const agentName = agents.find((agent) => agent.id === agentId)?.name ?? agentId;
    recentRuns.unshift({
      id: runId,
      agentId,
      agentName,
      runTime: new Date().toISOString(),
      failureReason: "无",
      runCategory: payload.runCategory ?? "test",
      status: "success"
    });
    return HttpResponse.json(
      {
        ...runTrace,
        id: runId,
        agentId,
        runCategory: payload.runCategory ?? "test",
        failureReason: undefined,
        finalOutput: `[local-smoke] ${payload.userInput ?? "Agent request"}`
      },
      { status: 201 }
    );
  }),
  http.get("/api/runs/:runId/trace", ({ params }) =>
    HttpResponse.json({
      ...runTrace,
      id: String(params.runId)
    })
  )
];
