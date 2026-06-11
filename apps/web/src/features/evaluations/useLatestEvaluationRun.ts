import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { EvaluationRun } from "../../types/domain";

export function useLatestEvaluationRun() {
  return useQuery({
    queryKey: ["evaluation-latest-run"],
    queryFn: () => getJson<EvaluationRun>("/api/evaluation-datasets/latest-run")
  });
}
