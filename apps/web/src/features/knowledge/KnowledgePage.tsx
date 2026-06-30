import { ChangeEvent, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useQueryClient } from "@tanstack/react-query";
import type { KnowledgeBase, KnowledgeCitation, KnowledgeDocument } from "../../types/domain";
import { PageScaffold } from "../shared/ViewBlocks";
import {
  useAnswerKnowledgeBase,
  useCreateKnowledgeBase,
  useCreateKnowledgeProcessingJob,
  useDeleteKnowledgeBase,
  useDeleteKnowledgeDocument,
  useKnowledgeBases,
  useKnowledgeDocumentSegments,
  useKnowledgeDocuments,
  useKnowledgeProcessingJobs,
  useSearchKnowledgeBase,
  streamKnowledgeBaseAnswer,
  useUploadKnowledgeDocument,
  useUpdateKnowledgeBase,
  type KnowledgeBasePayload
} from "./useKnowledgeBases";

gsap.registerPlugin(useGSAP);

type DialogMode = "create" | "edit";

type KnowledgeForm = {
  name: string;
  description: string;
};

type StreamedAnswer = {
  answer: string;
  citations: KnowledgeCitation[];
  runId: string;
};

const emptyForm: KnowledgeForm = {
  name: "",
  description: ""
};

function normalizeKnowledgeBase(item: Partial<KnowledgeBase> & Pick<KnowledgeBase, "id" | "name" | "source" | "documentCount" | "status">): KnowledgeBase {
  return {
    description: item.description ?? null,
    embeddingModelProviderId: item.embeddingModelProviderId ?? null,
    embeddingModelProviderName: item.embeddingModelProviderName ?? null,
    chunkStrategy: item.chunkStrategy ?? "fixed",
    chunkSize: item.chunkSize ?? 500,
    chunkOverlap: item.chunkOverlap ?? 50,
    retrievalMode: item.retrievalMode ?? "vector",
    topK: item.topK ?? 5,
    similarityThreshold: item.similarityThreshold ?? 0.7,
    returnCitations: item.returnCitations ?? true,
    retrievalStrategy: item.retrievalStrategy ?? (item.retrievalMode === "hybrid" ? "Hybrid" : "Vector"),
    qualityScore: item.qualityScore ?? 0,
    ...item
  };
}

function formFromKnowledgeBase(item: KnowledgeBase): KnowledgeForm {
  return {
    name: item.name,
    description: item.description ?? ""
  };
}

function statusTone(status: KnowledgeBase["status"]) {
  if (status === "ready") {
    return "ok";
  }
  if (status === "draft") {
    return "gray";
  }
  return "warn";
}

function documentStatusLabel(status: string) {
  if (status === "uploaded") {
    return "待处理";
  }
  if (status === "empty") {
    return "无可用文本";
  }
  if (status === "ready" || status === "available") {
    return "可用";
  }
  if (status === "processing" || status === "running" || status === "queued") {
    return "处理中";
  }
  if (status === "failed") {
    return "处理失败";
  }
  return "异常";
}

function processingJobStatusLabel(status: string) {
  if (status === "succeeded" || status === "completed") {
    return "处理完成";
  }
  if (status === "queued") {
    return "等待处理";
  }
  if (status === "running" || status === "processing") {
    return "处理中";
  }
  if (status === "failed") {
    return "处理失败";
  }
  return "未知状态";
}

function formatCharacterCount(value?: number) {
  if (!value) {
    return "0";
  }
  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(1))}k`;
  }
  return String(value);
}

function formatScore(value: number) {
  return Number(value.toFixed(2)).toString();
}

function documentNeedsProcessing(status: string) {
  return status === "uploaded";
}

function emptySegmentMessage(document: KnowledgeDocument) {
  if (document.status === "empty") {
    return "该文档没有可切分文本。若这是 PDF，请确认文件包含可复制文本后重新上传。";
  }
  return "暂无分段，请先处理文档。";
}

function buildPayload(form: KnowledgeForm, base?: KnowledgeBase): KnowledgeBasePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    source: base?.source ?? "upload",
    embeddingModelProviderId: base?.embeddingModelProviderId ?? null,
    chunkStrategy: base?.chunkStrategy ?? "fixed",
    chunkSize: base?.chunkSize ?? 500,
    chunkOverlap: base?.chunkOverlap ?? 50,
    retrievalMode: base?.retrievalMode ?? "vector",
    topK: base?.topK ?? 5,
    similarityThreshold: base?.similarityThreshold ?? 0.7,
    returnCitations: base?.returnCitations ?? true
  };
}

export function KnowledgePage() {
  const scope = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [editingKnowledgeBaseId, setEditingKnowledgeBaseId] = useState<string | null>(null);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingKnowledgeBase, setDeletingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [form, setForm] = useState<KnowledgeForm>(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [streamedAnswer, setStreamedAnswer] = useState<StreamedAnswer | null>(null);
  const [isStreamingAnswer, setIsStreamingAnswer] = useState(false);
  const [streamAnswerError, setStreamAnswerError] = useState<string | null>(null);
  const knowledgeQuery = useKnowledgeBases();
  const createKnowledgeBase = useCreateKnowledgeBase();
  const updateKnowledgeBase = useUpdateKnowledgeBase();
  const deleteKnowledgeBase = useDeleteKnowledgeBase();
  const deleteKnowledgeDocument = useDeleteKnowledgeDocument();
  const createProcessingJob = useCreateKnowledgeProcessingJob();
  const uploadDocument = useUploadKnowledgeDocument();
  const searchKnowledgeBase = useSearchKnowledgeBase();
  const answerKnowledgeBase = useAnswerKnowledgeBase();
  const knowledgeBases = useMemo(
    () => (knowledgeQuery.data ?? []).map((item) => normalizeKnowledgeBase(item)),
    [knowledgeQuery.data]
  );
  const displayKnowledgeBases = knowledgeBases;
  const selectedKnowledgeBase = displayKnowledgeBases.find((item) => item.id === selectedKnowledgeBaseId) ?? null;
  const documentsQuery = useKnowledgeDocuments(selectedKnowledgeBase?.id ?? null);
  const processingJobsQuery = useKnowledgeProcessingJobs(selectedKnowledgeBase?.id ?? null);
  const documents = documentsQuery.data ?? [];
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  const segmentsQuery = useKnowledgeDocumentSegments(selectedKnowledgeBase?.id ?? null, selectedDocument?.id ?? null);
  const segments = segmentsQuery.data ?? [];
  const latestProcessingJob = processingJobsQuery.data?.[0] ?? null;
  const isSaving = createKnowledgeBase.isPending || updateKnowledgeBase.isPending;
  const saveError = createKnowledgeBase.isError || updateKnowledgeBase.isError;
  const deleteError = deleteKnowledgeBase.isError;
  const uploadError = uploadDocument.isError;

  useEffect(() => {
    setSearchQuery("");
    searchKnowledgeBase.reset();
    answerKnowledgeBase.reset();
    setStreamedAnswer(null);
    setStreamAnswerError(null);
  }, [selectedKnowledgeBaseId]);

  useEffect(() => {
    if (!selectedKnowledgeBase?.id || !latestProcessingJob) {
      return;
    }
    if (latestProcessingJob.status !== "succeeded" && latestProcessingJob.status !== "completed") {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    void queryClient.invalidateQueries({ queryKey: ["knowledge-bases", selectedKnowledgeBase.id, "documents"] });
    if (selectedDocument?.id) {
      void queryClient.invalidateQueries({
        queryKey: ["knowledge-bases", selectedKnowledgeBase.id, "documents", selectedDocument.id, "segments"]
      });
    }
  }, [latestProcessingJob?.id, latestProcessingJob?.status, queryClient, selectedDocument?.id, selectedKnowledgeBase?.id]);

  useGSAP(
    () => {
      const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const cardNodes = scope.current ? Array.from(scope.current.querySelectorAll<HTMLElement>(".knowledge-card")) : [];
      if (cardNodes.length === 0) {
        return;
      }
      gsap.fromTo(
        cardNodes,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: reduceMotion ? 0 : 0.28,
          ease: "power2.out",
          stagger: reduceMotion ? 0 : 0.025,
          overwrite: "auto"
        }
      );
    },
    { dependencies: [displayKnowledgeBases.length], scope }
  );

  useGSAP(
    () => {
      if (!selectedKnowledgeBase || !detailRef.current) {
        return;
      }
      const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      gsap.fromTo(
        detailRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: reduceMotion ? 0 : 0.24, ease: "power2.out", overwrite: "auto" }
      );
    },
    { dependencies: [selectedKnowledgeBase?.id] }
  );

  useGSAP(
    () => {
      if ((!isDialogOpen && !deletingKnowledgeBase) || !dialogRef.current) {
        return;
      }
      const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      gsap.fromTo(
        dialogRef.current,
        { opacity: 0, y: 18, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: reduceMotion ? 0 : 0.24, ease: "power2.out", overwrite: "auto" }
      );
    },
    { dependencies: [isDialogOpen, deletingKnowledgeBase?.id] }
  );

  function openCreateDialog() {
    createKnowledgeBase.reset();
    updateKnowledgeBase.reset();
    setDialogMode("create");
    setEditingKnowledgeBaseId(null);
    setForm(emptyForm);
    setOpenMenuId(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(item: KnowledgeBase) {
    createKnowledgeBase.reset();
    updateKnowledgeBase.reset();
    setDialogMode("edit");
    setEditingKnowledgeBaseId(item.id);
    setForm(formFromKnowledgeBase(item));
    setOpenMenuId(null);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setDialogMode("create");
    setEditingKnowledgeBaseId(null);
    setForm(emptyForm);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editingBase = displayKnowledgeBases.find((item) => item.id === editingKnowledgeBaseId);
    const payload = buildPayload(form, editingBase);
    const options = { onSuccess: closeDialog };

    if (dialogMode === "edit" && editingKnowledgeBaseId) {
      updateKnowledgeBase.mutate({ id: editingKnowledgeBaseId, ...payload }, options);
      return;
    }

    createKnowledgeBase.mutate(payload, options);
  }

  function handleOpenMenu(event: MouseEvent<HTMLButtonElement>, item: KnowledgeBase) {
    event.stopPropagation();
    setOpenMenuId((current) => (current === item.id ? null : item.id));
  }

  function handleDelete(event: MouseEvent<HTMLButtonElement>, item: KnowledgeBase) {
    event.stopPropagation();
    setOpenMenuId(null);
    deleteKnowledgeBase.reset();
    setDeletingKnowledgeBase(item);
  }

  function closeDeleteDialog() {
    setDeletingKnowledgeBase(null);
    deleteKnowledgeBase.reset();
  }

  function confirmDelete() {
    if (!deletingKnowledgeBase) {
      return;
    }
    const item = deletingKnowledgeBase;
    deleteKnowledgeBase.mutate(item.id, {
      onSuccess: () => {
        if (selectedKnowledgeBaseId === item.id) {
          setSelectedKnowledgeBaseId(null);
          setSelectedDocumentId(null);
        }
        setDeletingKnowledgeBase(null);
      }
    });
  }

  function openKnowledgeBase(item: KnowledgeBase) {
    setSelectedKnowledgeBaseId(item.id);
    setSelectedDocumentId(null);
  }

  function handleReprocess() {
    if (!selectedKnowledgeBase?.id) {
      return;
    }
    createProcessingJob.mutate(selectedKnowledgeBase.id);
  }

  function handleDeleteDocument(document: KnowledgeDocument) {
    if (!selectedKnowledgeBase?.id) {
      return;
    }
    const knowledgeBaseId = selectedKnowledgeBase.id;
    deleteKnowledgeDocument.mutate(
      { knowledgeBaseId, documentId: document.id },
      {
        onSuccess: () => {
          if (selectedDocumentId === document.id) {
            setSelectedDocumentId(null);
          }
        }
      }
    );
  }

  function handleUploadFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!selectedKnowledgeBase?.id || !file) {
      return;
    }
    const knowledgeBaseId = selectedKnowledgeBase.id;
    uploadDocument.mutate(
      { file, knowledgeBaseId },
      {
        onSuccess: () => {
          createProcessingJob.mutate(knowledgeBaseId);
        }
      }
    );
    event.target.value = "";
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!selectedKnowledgeBase?.id || !query) {
      return;
    }
    searchKnowledgeBase.mutate({ knowledgeBaseId: selectedKnowledgeBase.id, query });
  }

  function handleAnswerClick() {
    const query = searchQuery.trim();
    if (!selectedKnowledgeBase?.id || !query) {
      return;
    }
    answerKnowledgeBase.mutate({ knowledgeBaseId: selectedKnowledgeBase.id, query });
  }

  function handleStreamAnswerClick() {
    const query = searchQuery.trim();
    if (!selectedKnowledgeBase?.id || !query || isStreamingAnswer) {
      return;
    }
    const knowledgeBaseId = selectedKnowledgeBase.id;
    setIsStreamingAnswer(true);
    setStreamAnswerError(null);
    setStreamedAnswer({ answer: "", citations: [], runId: "" });
    void streamKnowledgeBaseAnswer(
      { knowledgeBaseId, query },
      (text) => {
        setStreamedAnswer((current) => ({
          answer: `${current?.answer ?? ""}${text}`,
          citations: current?.citations ?? [],
          runId: current?.runId ?? ""
        }));
      }
    )
      .then((result) => {
        setStreamedAnswer(result);
      })
      .catch((error: Error) => {
        setStreamAnswerError(error.message);
      })
      .finally(() => {
        setIsStreamingAnswer(false);
      });
  }

  function renderKnowledgeCards() {
    if (knowledgeQuery.isFetched && displayKnowledgeBases.length === 0) {
      return (
        <section className="knowledge-list-empty" ref={scope}>
          <div>
            <strong>暂无知识库</strong>
            <p>创建一个知识库后，可以在这里管理资料集合和已上传文件。</p>
          </div>
          <button className="btn primary" onClick={openCreateDialog} type="button">
            创建知识库
          </button>
        </section>
      );
    }

    return (
      <section className="knowledge-card-section" ref={scope}>
        <div className="knowledge-card-grid compact">
          {displayKnowledgeBases.map((item) => (
            <article
              aria-label={item.name}
              className="knowledge-card knowledge-asset-card"
              key={item.id}
              onClick={() => openKnowledgeBase(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openKnowledgeBase(item);
                }
              }}
              tabIndex={0}
            >
              <div>
                <strong>{item.name}</strong>
                <p>{item.description || "暂无描述"}</p>
              </div>
              <div className="knowledge-card-footer">
                <div className="knowledge-card-menu-wrap">
                  <button
                    aria-expanded={openMenuId === item.id}
                    aria-haspopup="menu"
                    aria-label={`打开${item.name}操作菜单`}
                    className="agent-card-menu-trigger knowledge-card-menu-trigger"
                    onClick={(event) => handleOpenMenu(event, item)}
                    type="button"
                  >
                    ···
                  </button>
                  {openMenuId === item.id ? (
                    <div className="agent-card-menu knowledge-card-menu" role="menu">
                      <button onClick={(event) => { event.stopPropagation(); openEditDialog(item); }} role="menuitem" type="button">
                        编辑
                      </button>
                      <button disabled={deleteKnowledgeBase.isPending} onClick={(event) => handleDelete(event, item)} role="menuitem" type="button">
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderDocumentsView(item: KnowledgeBase) {
    const displayedAnswer = streamedAnswer
      ? {
          answer: streamedAnswer.answer,
          citations: streamedAnswer.citations,
          meta: streamedAnswer.runId ? `Trace ${streamedAnswer.runId}` : "流式生成中"
        }
      : answerKnowledgeBase.data
        ? {
            answer: answerKnowledgeBase.data.answer,
            citations: answerKnowledgeBase.data.citations,
            meta: answerKnowledgeBase.data.modelProviderName
          }
        : null;

    return (
      <section className="knowledge-documents-view" ref={detailRef}>
        <div className="knowledge-documents-head">
          <div>
            <h2 className="knowledge-documents-title">{item.name}</h2>
          </div>
          <div aria-label="知识库详情操作" className="knowledge-documents-actions">
            <button
              className="table-action"
              onClick={() => {
                setSelectedKnowledgeBaseId(null);
                setSelectedDocumentId(null);
              }}
              type="button"
            >
              返回知识库
            </button>
            <button className="btn" disabled type="button">
              元数据
            </button>
            <button
              className="btn primary"
              disabled={uploadDocument.isPending || createProcessingJob.isPending}
              onClick={() => uploadInputRef.current?.click()}
              type="button"
            >
              {uploadDocument.isPending ? "上传中..." : "添加文件"}
            </button>
            <input
              accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
              aria-label="上传知识库文件"
              className="sr-only"
              onChange={handleUploadFileChange}
              ref={uploadInputRef}
              type="file"
            />
          </div>
        </div>
        <div className="knowledge-document-toolbar">
          {uploadError ? <p className="inline-error">文件上传失败，请确认文件类型后重试。</p> : null}
          {latestProcessingJob ? (
            <div className={`knowledge-processing-summary ${latestProcessingJob.status}`}>
              <strong>最近处理：{processingJobStatusLabel(latestProcessingJob.status)}</strong>
              <span>
                {latestProcessingJob.finishedAt
                  ? `完成时间 ${latestProcessingJob.finishedAt}`
                  : latestProcessingJob.startedAt
                    ? `开始时间 ${latestProcessingJob.startedAt}`
                    : "等待开始"}
              </span>
              {latestProcessingJob.errorMessage ? <span>{latestProcessingJob.errorMessage}</span> : null}
            </div>
          ) : null}
          <select aria-label="文件状态筛选" defaultValue="all">
            <option value="all">全部</option>
          </select>
          <input aria-label="搜索文件" placeholder="搜索" />
          <button className="btn" type="button">
            排序：上传时间
          </button>
        </div>
        <div className="knowledge-document-table-wrap">
          <table className="knowledge-document-table">
            <thead>
              <tr>
                <th>
                  <input aria-label="选择全部文件" type="checkbox" />
                </th>
                <th>#</th>
                <th>名称</th>
                <th>分段模式</th>
                <th>字符数</th>
                <th>召回次数</th>
                <th>上传时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document, index) => (
                <DocumentRow
                  document={document}
                  index={index}
                  isReprocessing={createProcessingJob.isPending}
                  isSelected={document.id === selectedDocumentId}
                  isDeleting={deleteKnowledgeDocument.isPending}
                  key={document.id}
                  onDelete={() => handleDeleteDocument(document)}
                  onPreviewSegments={() => setSelectedDocumentId(document.id)}
                  onReprocess={handleReprocess}
                />
              ))}
            </tbody>
          </table>
          {documentsQuery.isFetched && documents.length === 0 ? <p className="knowledge-empty-state">暂无上传文件。</p> : null}
        </div>
        <section className="knowledge-search-panel">
          <div className="knowledge-search-head">
            <div>
              <strong>检索测试</strong>
              <span>
                当前策略 {item.retrievalMode === "hybrid" ? "Hybrid" : "Vector"} · TopK {item.topK} · 阈值 {item.similarityThreshold}
              </span>
            </div>
          </div>
          <form className="knowledge-search-form" onSubmit={handleSearchSubmit}>
            <label className="field-stack">
              检索问题
              <input
                aria-label="检索问题"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="输入问题或关键词，验证当前知识库召回效果"
                value={searchQuery}
              />
            </label>
            <button className="btn primary" disabled={searchKnowledgeBase.isPending || !searchQuery.trim()} type="submit">
              {searchKnowledgeBase.isPending ? "检索中..." : "检索测试"}
            </button>
            <button className="btn" disabled={answerKnowledgeBase.isPending || !searchQuery.trim()} onClick={handleAnswerClick} type="button">
              {answerKnowledgeBase.isPending ? "生成中..." : "生成回答"}
            </button>
            <button className="btn" disabled={isStreamingAnswer || !searchQuery.trim()} onClick={handleStreamAnswerClick} type="button">
              {isStreamingAnswer ? "流式生成中..." : "流式回答"}
            </button>
          </form>
          {searchKnowledgeBase.isError ? <p className="inline-error">检索失败，请稍后重试。</p> : null}
          {answerKnowledgeBase.isError ? <p className="inline-error">回答生成失败，请确认已配置默认 LLM 模型。</p> : null}
          {streamAnswerError ? <p className="inline-error">流式回答失败：{streamAnswerError}</p> : null}
          {displayedAnswer ? (
            <article className="knowledge-answer-result" aria-label="RAG 回答结果">
              <div className="knowledge-answer-meta">
                <strong>RAG 回答</strong>
                <span>{displayedAnswer.meta}</span>
              </div>
              <p>{displayedAnswer.answer}</p>
              {displayedAnswer.citations.length > 0 ? (
                <div className="knowledge-search-citations">
                  <strong>引用来源</strong>
                  <div>
                    {displayedAnswer.citations.map((citation) => (
                      <span key={citation.segmentId}>
                        {citation.documentName} #{citation.position}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ) : null}
          {searchKnowledgeBase.data ? (
            <div className="knowledge-search-results" aria-label="检索测试结果">
              {searchKnowledgeBase.data.matches.length === 0 ? (
                <p className="knowledge-empty-state">未命中相关分段，请检查文档是否已处理，或调整 TopK / 相似度阈值。</p>
              ) : (
                <>
                  <div className="knowledge-search-result-list">
                    {searchKnowledgeBase.data.matches.map((match, index) => (
                      <article className="knowledge-search-result-item" key={match.segmentId ?? `${match.documentId}-${index}`}>
                        <div className="knowledge-search-result-meta">
                          <strong>{match.documentName ?? match.documentId}</strong>
                          {match.position ? <span>#{match.position}</span> : null}
                          <span>相似度 {formatScore(match.score)}</span>
                          {match.metadata?.retriever ? <span>{String(match.metadata.retriever)}</span> : null}
                        </div>
                        <p>{match.content ?? match.text ?? ""}</p>
                      </article>
                    ))}
                  </div>
                  {searchKnowledgeBase.data.citations.length > 0 ? (
                    <div className="knowledge-search-citations">
                      <strong>引用来源</strong>
                      <div>
                        {searchKnowledgeBase.data.citations.map((citation) => (
                          <span key={citation.segmentId}>
                            {citation.documentName} #{citation.position}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>
        {selectedDocument ? (
          <section className="knowledge-segment-preview" aria-label="分段预览">
            <div className="knowledge-segment-preview-head">
              <div>
                <strong>分段预览</strong>
                <span>{selectedDocument.name}</span>
              </div>
              <button className="table-action" onClick={() => setSelectedDocumentId(null)} type="button">
                收起
              </button>
            </div>
            {segmentsQuery.isFetching ? <p className="knowledge-empty-state">正在加载分段...</p> : null}
            {segmentsQuery.isFetched && segments.length === 0 ? (
              <div className="knowledge-empty-state knowledge-segment-empty">
                <p>{emptySegmentMessage(selectedDocument)}</p>
                {documentNeedsProcessing(selectedDocument.status) ? (
                  <button className="table-action" disabled={createProcessingJob.isPending} onClick={handleReprocess} type="button">
                    {createProcessingJob.isPending ? "处理中..." : "处理文档"}
                  </button>
                ) : null}
              </div>
            ) : null}
            {segments.length > 0 ? (
              <div className="knowledge-segment-list">
                {segments.map((segment) => (
                  <article className="knowledge-segment-item" key={segment.id}>
                    <div className="knowledge-segment-meta">
                      <strong>#{segment.position}</strong>
                      <span>{segment.tokenCount} tokens</span>
                      <span>{segment.characterCount} 字符</span>
                    </div>
                    <p>{segment.content}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    );
  }

  const dialog = isDialogOpen ? (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel knowledge-config-panel" role="dialog" aria-modal="true" aria-labelledby="knowledge-dialog-title" ref={dialogRef}>
        <div className="modal-head">
          <div>
            <strong id="knowledge-dialog-title">{dialogMode === "edit" ? "编辑知识库" : "创建知识库"}</strong>
          </div>
          <button aria-label="关闭弹窗" className="modal-close" onClick={closeDialog} type="button">
            ×
          </button>
        </div>

        <form className="tool-form knowledge-form" onSubmit={handleSubmit}>
          <label className="field-stack">
            名称
            <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如：施工方案审核库" />
          </label>
          <label className="field-stack">
            描述
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="说明知识库覆盖的业务范围"
            />
          </label>
          {saveError ? <p className="inline-error">知识库保存失败，请稍后重试。</p> : null}
          <div className="form-actions">
            <button className="btn" onClick={closeDialog} type="button">
              取消
            </button>
            <button className="btn primary" disabled={isSaving} type="submit">
              {isSaving ? "保存中..." : dialogMode === "edit" ? "保存修改" : "保存知识库"}
            </button>
          </div>
        </form>
      </section>
    </div>
  ) : null;

  const deleteDialog = deletingKnowledgeBase ? (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel knowledge-delete-panel" role="dialog" aria-modal="true" aria-labelledby="knowledge-delete-title" ref={dialogRef}>
        <div className="modal-head">
          <div>
            <strong id="knowledge-delete-title">删除知识库</strong>
          </div>
          <button aria-label="关闭弹窗" className="modal-close" onClick={closeDeleteDialog} type="button">
            ×
          </button>
        </div>
        <div className="knowledge-delete-copy">
          <p>
            确定删除「{deletingKnowledgeBase.name}」吗？删除后该知识库会从列表中移除，当前已记录的文档也会一并清理。
          </p>
          {deleteError ? <p className="inline-error">知识库删除失败，请稍后重试。</p> : null}
        </div>
        <div className="form-actions">
          <button className="btn" onClick={closeDeleteDialog} type="button">
            取消
          </button>
          <button className="btn danger" disabled={deleteKnowledgeBase.isPending} onClick={confirmDelete} type="button">
            {deleteKnowledgeBase.isPending ? "删除中..." : "确认删除"}
          </button>
        </div>
      </section>
    </div>
  ) : null;

  const portalTarget = typeof document === "undefined" ? null : document.querySelector(".main-shell");

  return (
    <PageScaffold
      className="knowledge-page"
      title="知识库"
      description="管理知识库资源和已上传文件。"
      actions={
        !selectedKnowledgeBase ? (
          <button className="btn primary" onClick={openCreateDialog} type="button">
            创建知识库
          </button>
        ) : null
      }
    >
      {selectedKnowledgeBase ? renderDocumentsView(selectedKnowledgeBase) : renderKnowledgeCards()}
      {dialog ? (portalTarget ? createPortal(dialog, portalTarget) : dialog) : null}
      {deleteDialog ? (portalTarget ? createPortal(deleteDialog, portalTarget) : deleteDialog) : null}
    </PageScaffold>
  );
}

function DocumentRow({
  document,
  index,
  isDeleting,
  isReprocessing,
  isSelected,
  onDelete,
  onPreviewSegments,
  onReprocess
}: {
  document: KnowledgeDocument;
  index: number;
  isDeleting: boolean;
  isReprocessing: boolean;
  isSelected: boolean;
  onDelete: () => void;
  onPreviewSegments: () => void;
  onReprocess: () => void;
}) {
  const isFailed = document.status === "failed";
  const needsProcessing = documentNeedsProcessing(document.status);

  return (
    <tr>
      <td>
        <input aria-label={`选择${document.name}`} type="checkbox" />
      </td>
      <td>{index + 1}</td>
      <td>
        <span className="knowledge-document-name">
          <span className={document.mimeType.includes("pdf") ? "file-icon pdf" : "file-icon doc"}>{document.mimeType.includes("pdf") ? "PDF" : "DOC"}</span>
          {document.name}
        </span>
      </td>
      <td>
        <span className="document-mode-pill">{document.segmentMode ?? "通用"}</span>
      </td>
      <td>{formatCharacterCount(document.characterCount)}</td>
      <td>{document.hitCount ?? 0}</td>
      <td>{document.createdAt ?? "-"}</td>
      <td>
        <span className={`document-status-dot${isFailed ? " failed" : needsProcessing ? " pending" : ""}`} />
        <span className="document-status-label">{documentStatusLabel(document.status)}</span>
        {document.errorMessage ? <span className="document-error-message">{document.errorMessage}</span> : null}
      </td>
      <td>
        <div className="knowledge-document-actions">
          <button
            aria-label={`查看分段 ${document.name}`}
            aria-pressed={isSelected}
            className="table-action"
            onClick={onPreviewSegments}
            type="button"
          >
            查看分段
          </button>
        {needsProcessing ? (
          <button className="table-action" disabled={isReprocessing} onClick={onReprocess} type="button">
            {isReprocessing ? "处理中..." : "处理文档"}
          </button>
        ) : null}
        {isFailed ? (
          <button className="table-action" disabled={isReprocessing} onClick={onReprocess} type="button">
            {isReprocessing ? "处理中..." : "重新处理"}
          </button>
        ) : null}
          <button
            aria-label={`删除文档 ${document.name}`}
            className="table-action danger"
            disabled={isDeleting}
            onClick={onDelete}
            type="button"
          >
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}
