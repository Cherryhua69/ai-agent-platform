import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "../../lib/api/client";

export type TestModelProviderPayload = {
  id: string;
  prompt?: string;
};

export type TestModelProviderResult = {
  status: "success" | "failed";
  output: string;
};

export function useTestModelProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, prompt = "请用一句中文回复：连接测试成功" }: TestModelProviderPayload) =>
      postJson<TestModelProviderResult, { prompt: string }>(`/api/model-providers/${id}/test`, { prompt }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["model-providers"] });
    }
  });
}
