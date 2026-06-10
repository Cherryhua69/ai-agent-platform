import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { Agent } from "../../types/domain";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => getJson<Agent[]>("/api/agents")
  });
}
