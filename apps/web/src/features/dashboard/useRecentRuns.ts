import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { RecentRun } from "../../types/domain";

export function useRecentRuns() {
  return useQuery({
    queryKey: ["recent-runs"],
    queryFn: () => getJson<RecentRun[]>("/api/runs/recent"),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0
  });
}
