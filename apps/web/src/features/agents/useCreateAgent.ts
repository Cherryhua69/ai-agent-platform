import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "../../lib/api/client";
import type { Agent } from "../../types/domain";

type CreateAgentPayload = {
  name: string;
  scenario: string;
};

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAgentPayload) => postJson<Agent, CreateAgentPayload>("/api/agents", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
    }
  });
}
