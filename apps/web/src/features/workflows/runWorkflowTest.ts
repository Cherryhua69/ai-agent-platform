import { postJson } from "../../lib/api/client";
import type { WorkflowTestResult } from "../../types/domain";

export function runWorkflowTest(workflowId: string, input: string) {
  return postJson<WorkflowTestResult, { input: string }>(`/api/workflows/${workflowId}/test`, { input });
}
