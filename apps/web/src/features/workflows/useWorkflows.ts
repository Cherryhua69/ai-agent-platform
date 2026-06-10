import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { Workflow } from "../../types/domain";

export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: () => getJson<Workflow[]>("/api/workflows")
  });
}
