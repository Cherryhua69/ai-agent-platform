import { http, HttpResponse } from "msw";
import type { ModelProvider, Tool } from "../../types/domain";
import { agents, knowledgeBases, modelProviders, releaseGates, runTrace, tools, workflows } from "./fixtures";

export const handlers = [
  http.get("/api/agents", () => HttpResponse.json(agents)),
  http.get("/api/workflows", () => HttpResponse.json(workflows)),
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
  http.post("/api/agents/:agentId/runs", async ({ params, request }) => {
    const payload = (await request.json()) as { userInput?: string };
    return HttpResponse.json(
      {
        ...runTrace,
        id: "run_created",
        agentId: String(params.agentId),
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
