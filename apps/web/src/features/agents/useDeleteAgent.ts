import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteJson } from "../../lib/api/client";
import type { Agent } from "../../types/domain";

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) => deleteJson(`/api/agents/${agentId}`),
    onSuccess: (_result, agentId) => {
      queryClient.setQueryData<Agent[]>(["agents"], (agents = []) => agents.filter((agent) => agent.id !== agentId));
    }
  });
}
