import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { ModelProvider } from "../../types/domain";

export function useModelProviders() {
  return useQuery({
    queryKey: ["model-providers"],
    queryFn: () => getJson<ModelProvider[]>("/api/model-providers")
  });
}
