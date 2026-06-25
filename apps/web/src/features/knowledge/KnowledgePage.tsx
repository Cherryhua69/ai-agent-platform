import { FormEvent, MouseEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { KnowledgeBase, KnowledgeDocument } from "../../types/domain";
import { PageScaffold } from "../shared/ViewBlocks";
import {
  useCreateKnowledgeBase,
  useDeleteKnowledgeBase,
  useKnowledgeBases,
  useKnowledgeDocuments,
  useUpdateKnowledgeBase,
  type KnowledgeBasePayload
} from "./useKnowledgeBases";

gsap.registerPlugin(useGSAP);

type DialogMode = "create" | "edit";

type KnowledgeForm = {
  name: string;
  description: string;
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
  if (status === "uploaded" || status === "ready") {
    return "可用";
  }
  if (status === "processing") {
    return "处理中";
  }
  return "异常";
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
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [editingKnowledgeBaseId, setEditingKnowledgeBaseId] = useState<string | null>(null);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingKnowledgeBase, setDeletingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [form, setForm] = useState<KnowledgeForm>(emptyForm);
  const knowledgeQuery = useKnowledgeBases();
  const createKnowledgeBase = useCreateKnowledgeBase();
  const updateKnowledgeBase = useUpdateKnowledgeBase();
  const deleteKnowledgeBase = useDeleteKnowledgeBase();
  const knowledgeBases = useMemo(
    () => (knowledgeQuery.data ?? []).map((item) => normalizeKnowledgeBase(item)),
    [knowledgeQuery.data]
  );
  const displayKnowledgeBases = knowledgeBases;
  const selectedKnowledgeBase = displayKnowledgeBases.find((item) => item.id === selectedKnowledgeBaseId) ?? null;
  const documentsQuery = useKnowledgeDocuments(selectedKnowledgeBase?.id ?? null);
  const documents = documentsQuery.data ?? [];
  const isSaving = createKnowledgeBase.isPending || updateKnowledgeBase.isPending;
  const saveError = createKnowledgeBase.isError || updateKnowledgeBase.isError;
  const deleteError = deleteKnowledgeBase.isError;

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
        }
        setDeletingKnowledgeBase(null);
      }
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
              onClick={() => setSelectedKnowledgeBaseId(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedKnowledgeBaseId(item.id);
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
    return (
      <section className="knowledge-documents-view" ref={detailRef}>
        <div className="knowledge-documents-head">
          <div>
            <h2 className="knowledge-documents-title">{item.name}</h2>
          </div>
          <div aria-label="知识库详情操作" className="knowledge-documents-actions">
            <button className="table-action" onClick={() => setSelectedKnowledgeBaseId(null)} type="button">
              返回知识库
            </button>
            <button className="btn" disabled type="button">
              元数据
            </button>
            <button className="btn primary" disabled type="button">
              添加文件
            </button>
          </div>
        </div>
        <div className="knowledge-document-toolbar">
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
                <DocumentRow document={document} index={index} key={document.id} />
              ))}
            </tbody>
          </table>
          {documentsQuery.isFetched && documents.length === 0 ? <p className="knowledge-empty-state">暂无上传文件。</p> : null}
        </div>
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
            <strong id="knowledge-delete-title">删除</strong>
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

function DocumentRow({ document, index }: { document: KnowledgeDocument; index: number }) {
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
        <span className="document-status-dot" />
        {documentStatusLabel(document.status)}
      </td>
      <td>
        <button className="table-action" type="button">
          ···
        </button>
      </td>
    </tr>
  );
}
