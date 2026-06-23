export type StreamAgentRunPayload = {
  agentId: string;
  userInput: string;
  modelProviderId?: string;
  knowledgeBaseIds: string[];
  runCategory?: "test" | "production";
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
};

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; runId: string }
  | { type: "error"; message: string };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function streamAgentRun(
  { agentId, ...payload }: StreamAgentRunPayload,
  onDelta: (text: string) => void
): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/api/agents/${agentId}/runs/stream`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  if (!response.ok || !response.body) {
    throw new Error(`流式运行失败：${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let runId = "";
  let hasDelta = false;

  function consumeLine(line: string) {
    if (!line.trim()) {
      return;
    }
    const event = JSON.parse(line) as StreamEvent;
    if (event.type === "delta") {
      hasDelta = true;
      onDelta(event.text);
    } else if (event.type === "done") {
      runId = event.runId;
    } else if (hasDelta) {
      runId = "";
    } else {
      throw new Error(event.message);
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
    if (done) {
      break;
    }
  }
  consumeLine(buffer);
  return runId;
}
