from fastapi import APIRouter, status

from app.core.database import SessionLocal
from app.modules.evaluation.repository import EvaluationRepository
from app.modules.evaluation.schemas import (
    EvaluationCaseCreate,
    EvaluationCaseRead,
    EvaluationDatasetCreate,
    EvaluationDatasetRead,
    EvaluationRunCreate,
    EvaluationRunRead,
)

router = APIRouter(prefix="/api/evaluation-datasets", tags=["evaluations"])
repo = EvaluationRepository(session_factory=SessionLocal)


@router.post("", response_model=EvaluationDatasetRead, status_code=status.HTTP_201_CREATED)
def create_dataset(payload: EvaluationDatasetCreate) -> EvaluationDatasetRead:
    return repo.create_dataset(payload)


@router.post("/{dataset_id}/cases", response_model=EvaluationCaseRead, status_code=status.HTTP_201_CREATED)
def add_case(dataset_id: str, payload: EvaluationCaseCreate) -> EvaluationCaseRead:
    return repo.add_case(dataset_id, payload)


@router.post("/{dataset_id}/runs", response_model=EvaluationRunRead, status_code=status.HTTP_201_CREATED)
def run_evaluation(dataset_id: str, payload: EvaluationRunCreate) -> EvaluationRunRead:
    return repo.run(dataset_id, payload)


@router.get("/latest-run", response_model=EvaluationRunRead)
def get_latest_run() -> EvaluationRunRead:
    return repo.latest_run()
