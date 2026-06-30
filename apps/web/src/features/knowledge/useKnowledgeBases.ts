import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJson, getJson, postFormData, postJson, putJson } from "../../lib/api/client";
import type {
  KnowledgeBase,
  KnowledgeChunkStrategy,
  KnowledgeDocument,
  KnowledgeAnswerResponse,
  KnowledgeAnswerStreamEvent,
  KnowledgeCitation,
  KnowledgeProcessingJob,
  KnowledgeRetrievalMode,
  KnowledgeSearchResponse,
  KnowledgeSegment
} from "../../types/domain";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

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

export function useCreateKnowledgeProcessingJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (knowledgeBaseId: string) =>
      postJson<{ id: string; knowledgeBaseId: string; status: string; chunksCreated: number; errorMessage?: string | null }, Record<string, never>>(
        `/api/knowledge-bases/${knowledgeBaseId}/processing-jobs`,
        {}
      ),
    onSuccess: (_job, knowledgeBaseId) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases", knowledgeBaseId, "documents"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases", knowledgeBaseId, "processing-jobs"] });
    }
  });
}

export function useUploadKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, knowledgeBaseId }: { file: File; knowledgeBaseId: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      return postFormData<KnowledgeDocument>(`/api/knowledge-bases/${knowledgeBaseId}/documents/upload`, formData);
    },
    onSuccess: (_document, { knowledgeBaseId }) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases", knowledgeBaseId, "documents"] });
    }
  });
}

export function useKnowledgeProcessingJobs(knowledgeBaseId: string | null) {
  return useQuery({
    enabled: Boolean(knowledgeBaseId),
    queryKey: ["knowledge-bases", knowledgeBaseId, "processing-jobs"],
    queryFn: () => getJson<KnowledgeProcessingJob[]>(`/api/knowledge-bases/${knowledgeBaseId}/processing-jobs`),
    refetchInterval: (query) => {
      const latestJob = query.state.data?.[0];
      return latestJob?.status === "queued" || latestJob?.status === "running" ? 3000 : false;
    }
  });
}

export function useKnowledgeDocumentSegments(knowledgeBaseId: string | null, documentId: string | null) {
  return useQuery({
    enabled: Boolean(knowledgeBaseId && documentId),
    queryKey: ["knowledge-bases", knowledgeBaseId, "documents", documentId, "segments"],
    queryFn: () => getJson<KnowledgeSegment[]>(`/api/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/segments`)
  });
}

export function useSearchKnowledgeBase() {
  return useMutation({
    mutationFn: ({ knowledgeBaseId, query }: { knowledgeBaseId: string; query: string }) =>
      postJson<KnowledgeSearchResponse, { query: string }>(`/api/knowledge-bases/${knowledgeBaseId}/search`, { query })
  });
}

export function useAnswerKnowledgeBase() {
  return useMutation({
    mutationFn: ({ knowledgeBaseId, query }: { knowledgeBaseId: string; query: string }) =>
      postJson<KnowledgeAnswerResponse, { query: string }>(`/api/knowledge-bases/${knowledgeBaseId}/answer`, { query })
  });
}

export async function streamKnowledgeBaseAnswer(
  { knowledgeBaseId, query }: { knowledgeBaseId: string; query: string },
  onDelta: (text: string) => void
): Promise<{ runId: string; answer: string; citations: KnowledgeCitation[] }> {
  const response = await fetch(`${apiBaseUrl}/api/knowledge-bases/${knowledgeBaseId}/answer/stream`, {
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  if (!response.ok || !response.body) {
    throw new Error(`流式回答失败：${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let runId = "";
  let answer = "";
  let citations: KnowledgeCitation[] = [];

  function consumeLine(line: string) {
    if (!line.trim()) {
      return;
    }
    const event = JSON.parse(line) as KnowledgeAnswerStreamEvent;
    if ("runId" in event && event.runId) {
      runId = event.runId;
    }
    if (event.type === "answer_delta") {
      answer += event.text;
      onDelta(event.text);
      return;
    }
    if (event.type === "completed") {
      answer = event.answer || answer;
      citations = event.citations;
      return;
    }
    if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
    if (done) {
      break;
    }
  }
  consumeLine(buffer);
  return { runId, answer, citations };
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ knowledgeBaseId, documentId }: { knowledgeBaseId: string; documentId: string }) =>
      deleteJson(`/api/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`),
    onSuccess: (_result, { knowledgeBaseId, documentId }) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases", knowledgeBaseId, "documents"] });
      void queryClient.removeQueries({ queryKey: ["knowledge-bases", knowledgeBaseId, "documents", documentId, "segments"] });
    }
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
