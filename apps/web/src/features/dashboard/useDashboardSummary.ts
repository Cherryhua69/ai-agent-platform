import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { DashboardSummary } from "../../types/domain";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => getJson<DashboardSummary>("/api/dashboard/summary"),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0
  });
}
