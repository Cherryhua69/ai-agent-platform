from fastapi import APIRouter, HTTPException, status

from app.core.database import SessionLocal
from app.modules.workflow.repository import WorkflowRepository
from app.modules.workflow.schemas import WorkflowRead, WorkflowTestRead, WorkflowTestRequest, WorkflowUpdate

router = APIRouter(prefix="/api/workflows", tags=["workflows"])
repo = WorkflowRepository(session_factory=SessionLocal)


@router.get("", response_model=list[WorkflowRead], response_model_by_alias=True)
def list_workflows() -> list[WorkflowRead]:
    return repo.list()


@router.get("/{workflow_id}", response_model=WorkflowRead, response_model_by_alias=True)
def get_workflow(workflow_id: str) -> WorkflowRead:
    workflow = repo.get(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


@router.put("/{workflow_id}", response_model=WorkflowRead, response_model_by_alias=True)
def update_workflow(workflow_id: str, payload: WorkflowUpdate) -> WorkflowRead:
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
    result = repo.run_test(workflow_id, payload.input)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return result
