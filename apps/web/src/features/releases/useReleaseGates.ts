import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { ReleaseGate } from "../../types/domain";

export function useReleaseGates() {
  return useQuery({
    queryKey: ["release-gates"],
    queryFn: () => getJson<ReleaseGate[]>("/api/release-gates")
  });
}
