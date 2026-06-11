import { useMutation } from "@tanstack/react-query";
import { postJson } from "../../lib/api/client";
import type { RunTrace } from "../../types/domain";

export function useSimulateAgentRun() {
  return useMutation({
    mutationFn: (agentId: string) => postJson<RunTrace, Record<string, never>>(`/api/agents/${agentId}/runs`, {})
  });
}
