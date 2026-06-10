import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api/client";
import type { Tool } from "../../types/domain";

export function useTools() {
  return useQuery({
    queryKey: ["tools"],
    queryFn: () => getJson<Tool[]>("/api/tools")
  });
}
