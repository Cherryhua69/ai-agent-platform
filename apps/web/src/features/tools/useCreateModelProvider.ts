import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "../../lib/api/client";
import type { ModelProvider } from "../../types/domain";

export type CreateModelProviderPayload = {
  name: string;
  providerType: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  isDefault?: boolean;
};

export function useCreateModelProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateModelProviderPayload) =>
      postJson<ModelProvider, CreateModelProviderPayload>("/api/model-providers", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["model-providers"] });
    }
  });
}
