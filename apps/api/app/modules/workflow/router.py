import json
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status

from app.core.database import SessionLocal
from app.modules.knowledge.router import repo as knowledge_repo
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.service import LangChainModelClient
from app.modules.workflow.graph_compiler import GraphCompiler
from app.modules.workflow.graph_executor import GraphExecutor
from app.modules.workflow.graph_types import WorkflowExecutionError, WorkflowGraphValidationError
from app.modules.workflow.node_registry import NodeRegistry
from app.modules.workflow.repository import WorkflowRepository
from app.modules.workflow.schemas import WorkflowRead, WorkflowTestRead, WorkflowTestRequest, WorkflowUpdate

router = APIRouter(prefix="/api/workflows", tags=["workflows"])
repo = WorkflowRepository(session_factory=SessionLocal)
model_provider_repo = ModelProviderRepository(session_factory=SessionLocal)
graph_executor = GraphExecutor(
    GraphCompiler(NodeRegistry(model_provider_repo, knowledge_repo, LangChainModelClient()))
)


def _stringify_output(value: Any) -> str:
    if isinstance(value, str):
        return value
    if value is None:
        return ""
    return json.dumps(value, ensure_ascii=False, default=str)


def _summarize_final_output(final_output: dict[str, Any]) -> str:
    if not final_output:
        return ""
    for value in final_output.values():
        if isinstance(value, str) and value.strip():
            return value
    return _stringify_output(final_output)


def _build_test_inputs(user_input: str) -> dict[str, object]:
    return {
        "question": user_input,
        "message": user_input,
        "text": user_input,
        "input": user_input,
    }


@router.get("", response_model=list[WorkflowRead], response_model_by_alias=True)
def list_workflows() -> list[WorkflowRead]:
    """查询全部工作流配置，供工作流画布列表和智能体绑定选择使用。"""
    return repo.list()


@router.get("/{workflow_id}", response_model=WorkflowRead, response_model_by_alias=True)
def get_workflow(workflow_id: str) -> WorkflowRead:
    """查询指定工作流详情；不存在时返回 404。"""
    workflow = repo.get(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


@router.put("/{workflow_id}", response_model=WorkflowRead, response_model_by_alias=True)
def update_workflow(workflow_id: str, payload: WorkflowUpdate) -> WorkflowRead:
    """更新指定工作流图配置，包含节点、连线和工具健康标记。"""
    workflow = repo.update(workflow_id, payload)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


@router.post(
    "/{workflow_id}/test",
    response_model=WorkflowTestRead,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def run_workflow_test(workflow_id: str, payload: WorkflowTestRequest) -> WorkflowTestRead:
    """使用测试输入运行指定工作流，返回节点级执行结果。"""
    workflow = repo.get(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

    run_id = f"workflow_test_{uuid4().hex[:8]}"
    try:
        result = graph_executor.execute(workflow, _build_test_inputs(payload.input))
    except (WorkflowExecutionError, WorkflowGraphValidationError, ValueError) as exc:
        trace_steps = getattr(exc, "trace_steps", [])
        return WorkflowTestRead(
            id=run_id,
            workflowId=workflow_id,
            status="failed",
            input=payload.input,
            output=str(exc),
            finalOutput={},
            traceSteps=trace_steps,
            nodeOutputs={},
            errorMessage=str(exc),
        )

    node_outputs = result.state.get("node_outputs", {})
    final_output = result.final_output
    return WorkflowTestRead(
        id=run_id,
        workflowId=workflow_id,
        status="success",
        input=payload.input,
        output=_summarize_final_output(final_output),
        finalOutput=final_output,
        traceSteps=result.trace_steps,
        nodeOutputs=node_outputs,
    )
