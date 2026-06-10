import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { RunTrace } from "../../types/domain";

export function useRunTrace(runId = "run_8f23") {
  return useQuery({
    queryKey: ["run-trace", runId],
    queryFn: () => getJson<RunTrace>(`/api/runs/${runId}/trace`)
  });
}
