import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "../../lib/api/client";
import type { Tool } from "../../types/domain";

export type CreateToolPayload = {
  name: string;
  type: Tool["type"];
  credential: string;
  permission: string;
  schema?: Record<string, object>;
};

export function useCreateTool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateToolPayload) => postJson<Tool, CreateToolPayload>("/api/tools", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tools"] });
    }
  });
}
