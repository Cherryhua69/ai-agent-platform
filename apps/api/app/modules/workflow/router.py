from fastapi import APIRouter

from app.modules.workflow.schemas import WorkflowRead

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowRead], response_model_by_alias=True)
def list_workflows() -> list[WorkflowRead]:
    return [
        WorkflowRead(
            id="workflow-after-sale",
            agentId="agent-after-sale",
            name="售后工单 Agentflow",
            status="blocked",
            toolHealthStatus="degraded",
            nodes=[
                {"id": "node-trigger", "type": "trigger", "name": "User request", "status": "success"},
                {"id": "node-retrieval", "type": "retrieval", "name": "Knowledge retrieval", "status": "success"},
                {"id": "node-llm", "type": "llm", "name": "Configured model", "status": "success"},
                {"id": "node-output", "type": "expose", "name": "Final answer", "status": "success"},
            ],
        )
    ]
