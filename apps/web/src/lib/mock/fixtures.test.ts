import { describe, expect, it } from "vitest";
import { agents, knowledgeBases, releaseGates, runTrace, tools, workflows } from "./fixtures";

describe("mock fixtures", () => {
  it("覆盖 MVP 主闭环资源", () => {
    expect(agents).toHaveLength(2);
    expect(workflows).toHaveLength(1);
    expect(knowledgeBases).toHaveLength(2);
    expect(tools).toHaveLength(3);
    expect(releaseGates[0].status).toBe("blocked");
    expect(releaseGates[0].reasons.length).toBeGreaterThanOrEqual(2);
    expect(runTrace.steps).toHaveLength(5);
  });
});
