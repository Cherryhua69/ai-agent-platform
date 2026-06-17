import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, workflows } from "./fixtures";
import { handlers } from "./handlers";

const initialAgents = agents.map((agent) => ({ ...agent }));
const initialWorkflows = workflows.map((workflow) => ({
  ...workflow,
  nodes: workflow.nodes.map((node) => ({ ...node })),
  edges: workflow.edges?.map((edge) => ({ ...edge }))
}));
const server = setupServer(...handlers);

describe("mock agent handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

  afterEach(() => {
    server.resetHandlers();
    agents.splice(0, agents.length, ...initialAgents.map((agent) => ({ ...agent })));
    workflows.splice(
      0,
      workflows.length,
      ...initialWorkflows.map((workflow) => ({
        ...workflow,
        nodes: workflow.nodes.map((node) => ({ ...node })),
        edges: workflow.edges?.map((edge) => ({ ...edge }))
      }))
    );
  });

  afterAll(() => server.close());

  it("真实更新 mock 智能体列表里的编辑和删除结果", async () => {
    const created = await fetch("/api/agents", {
      body: JSON.stringify({ name: "线索分配助手", scenario: "" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const createdAgent = await created.json();

    const updated = await fetch(`/api/agents/${createdAgent.id}`, {
      body: JSON.stringify({ name: "升级后的线索助手", scenario: "线索分配和跟进提醒" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });

    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      id: createdAgent.id,
      name: "升级后的线索助手",
      scenario: "线索分配和跟进提醒"
    });

    const deleted = await fetch(`/api/agents/${createdAgent.id}`, { method: "DELETE" });
    expect(deleted.status).toBe(204);

    const list = await fetch("/api/agents");
    const body = await list.json();
    expect(body.map((agent: { id: string }) => agent.id)).not.toContain(createdAgent.id);
  });

  it("真实保存 mock 工作流里的画布节点", async () => {
    const updated = await fetch("/api/workflows/workflow-after-sale", {
      body: JSON.stringify({
        name: "售后工单 Agentflow",
        status: "draft",
        toolHealthStatus: "online",
        nodes: [
          {
            id: "node-trigger",
            type: "trigger",
            name: "用户输入",
            status: "success",
            config: { inputFields: [] }
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT"
    });

    expect(updated.status).toBe(200);
    const body = await updated.json();
    expect(body.nodes.map((node: { id: string }) => node.id)).toEqual(["node-trigger"]);
    expect(workflows[0].nodes.map((node) => node.id)).toEqual(["node-trigger"]);
  });
});
