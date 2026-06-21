import { afterEach, describe, expect, it, vi } from "vitest";
import { streamAgentRun } from "./streamAgentRun";

describe("streamAgentRun", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws the server error message from a streaming error event", async () => {
    const chunks = [`${JSON.stringify({ type: "error", message: "模型上下文过长，请缩短历史后重试" })}\n`];
    let chunkIndex = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => chunkIndex < chunks.length
            ? { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) }
            : { done: true, value: undefined }
        })
      }
    })));

    await expect(streamAgentRun(
      {
        agentId: "agent",
        userInput: "写一个 c++ 代码给我",
        knowledgeBaseIds: [],
        conversationHistory: []
      },
      vi.fn()
    )).rejects.toThrow("模型上下文过长，请缩短历史后重试");
  });

  it("keeps a partial streamed answer when an error event arrives after deltas", async () => {
    const chunks = [
      `${JSON.stringify({ type: "delta", text: "已经生成的回答" })}\n`,
      `${JSON.stringify({ type: "error", message: "模型连接中断" })}\n`
    ];
    let chunkIndex = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => chunkIndex < chunks.length
            ? { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) }
            : { done: true, value: undefined }
        })
      }
    })));
    const onDelta = vi.fn();

    await expect(streamAgentRun(
      {
        agentId: "agent",
        userInput: "写一个 c++ 代码给我",
        knowledgeBaseIds: [],
        conversationHistory: []
      },
      onDelta
    )).resolves.toBe("");
    expect(onDelta).toHaveBeenCalledWith("已经生成的回答");
  });
});
