import { useMutation } from "@tanstack/react-query";
import { postJson } from "../../lib/api/client";
import type { RunTrace } from "../../types/domain";

export type SimulateAgentRunPayload = {
  agentId: string;
  userInput: string;
  modelProviderId?: string;
  knowledgeBaseIds: string[];
};

export function useSimulateAgentRun() {
  return useMutation({
    mutationFn: ({ agentId, ...payload }: SimulateAgentRunPayload) =>
      postJson<RunTrace, Omit<SimulateAgentRunPayload, "agentId">>(`/api/agents/${agentId}/runs`, payload)
  });
}
