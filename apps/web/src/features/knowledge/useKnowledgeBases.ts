import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJson, getJson, postJson, putJson } from "../../lib/api/client";
import type { KnowledgeBase, KnowledgeChunkStrategy, KnowledgeDocument, KnowledgeRetrievalMode } from "../../types/domain";

export type KnowledgeBasePayload = {
  name: string;
  description?: string | null;
  source: string;
  embeddingModelProviderId: string | null;
  chunkStrategy: KnowledgeChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  retrievalMode: KnowledgeRetrievalMode;
  topK: number;
  similarityThreshold: number;
  returnCitations: boolean;
};

export type UpdateKnowledgeBasePayload = KnowledgeBasePayload & {
  id: string;
};

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => getJson<KnowledgeBase[]>("/api/knowledge-bases")
  });
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: KnowledgeBasePayload) => postJson<KnowledgeBase, KnowledgeBasePayload>("/api/knowledge-bases", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });
}

export function useKnowledgeDocuments(knowledgeBaseId: string | null) {
  return useQuery({
    enabled: Boolean(knowledgeBaseId),
    queryKey: ["knowledge-bases", knowledgeBaseId, "documents"],
    queryFn: () => getJson<KnowledgeDocument[]>(`/api/knowledge-bases/${knowledgeBaseId}/documents`)
  });
}

export function useUpdateKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateKnowledgeBasePayload) =>
      putJson<KnowledgeBase, KnowledgeBasePayload>(`/api/knowledge-bases/${id}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });
}

export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (knowledgeBaseId: string) => deleteJson(`/api/knowledge-bases/${knowledgeBaseId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });
}
