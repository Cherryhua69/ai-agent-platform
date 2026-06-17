import { useMutation, useQueryClient } from "@tanstack/react-query";
import { putJson } from "../../lib/api/client";
import type { Workflow } from "../../types/domain";

export type UpdateWorkflowPayload = Pick<Workflow, "id" | "name" | "status" | "toolHealthStatus" | "nodes" | "edges" | "viewport">;

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateWorkflowPayload) => putJson<Workflow, Omit<UpdateWorkflowPayload, "id">>(`/api/workflows/${id}`, payload),
    onSuccess: (updatedWorkflow) => {
      queryClient.setQueryData<Workflow[]>(["workflows"], (workflows = []) =>
        workflows.map((workflow) => (workflow.id === updatedWorkflow.id ? updatedWorkflow : workflow))
      );
    }
  });
}
