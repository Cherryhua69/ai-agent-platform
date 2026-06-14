import { http, HttpResponse } from "msw";
import type { ModelProvider } from "../../types/domain";
import { agents, knowledgeBases, modelProviders, releaseGates, runTrace, tools, workflows } from "./fixtures";

export const handlers = [
  http.get("/api/agents", () => HttpResponse.json(agents)),
  http.get("/api/workflows", () => HttpResponse.json(workflows)),
  http.get("/api/knowledge-bases", () => HttpResponse.json(knowledgeBases)),
  http.get("/api/tools", () => HttpResponse.json(tools)),
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
      status: "online",
      isDefault: Boolean(payload.isDefault)
    };
    modelProviders.push(provider);
    return HttpResponse.json(provider, { status: 201 });
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
