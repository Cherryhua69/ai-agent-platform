import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchJson } from "../../lib/api/client";
import type { Agent } from "../../types/domain";

export type UpdateAgentPayload = {
  id: string;
  name: string;
  scenario: string;
};

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateAgentPayload) => patchJson<Agent, Omit<UpdateAgentPayload, "id">>(`/api/agents/${id}`, payload),
    onSuccess: (updatedAgent) => {
      queryClient.setQueryData<Agent[]>(["agents"], (agents = []) =>
        agents.map((agent) => (agent.id === updatedAgent.id ? updatedAgent : agent))
      );
    }
  });
}
