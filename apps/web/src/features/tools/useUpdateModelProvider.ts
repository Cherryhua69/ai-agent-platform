import { useMutation, useQueryClient } from "@tanstack/react-query";
import { putJson } from "../../lib/api/client";
import type { ModelProvider } from "../../types/domain";
import type { CreateModelProviderPayload } from "./useCreateModelProvider";

export type UpdateModelProviderPayload = CreateModelProviderPayload & {
  id: string;
};

export function useUpdateModelProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateModelProviderPayload) =>
      putJson<ModelProvider, Omit<UpdateModelProviderPayload, "id">>(`/api/model-providers/${id}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["model-providers"] });
    }
  });
}
