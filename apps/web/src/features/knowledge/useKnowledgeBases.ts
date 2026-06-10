import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { KnowledgeBase } from "../../types/domain";

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => getJson<KnowledgeBase[]>("/api/knowledge-bases")
  });
}
