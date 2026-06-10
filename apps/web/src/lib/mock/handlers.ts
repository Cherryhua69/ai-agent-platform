import { http, HttpResponse } from "msw";
import { agents, knowledgeBases, releaseGates, runTrace, tools, workflows } from "./fixtures";

export const handlers = [
  http.get("/api/agents", () => HttpResponse.json(agents)),
  http.get("/api/workflows", () => HttpResponse.json(workflows)),
  http.get("/api/knowledge-bases", () => HttpResponse.json(knowledgeBases)),
  http.get("/api/tools", () => HttpResponse.json(tools)),
  http.get("/api/release-gates", () => HttpResponse.json(releaseGates)),
  http.get("/api/runs/:runId/trace", ({ params }) =>
    HttpResponse.json({
      ...runTrace,
      id: String(params.runId)
    })
  )
];
