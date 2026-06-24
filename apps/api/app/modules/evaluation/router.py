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
    """创建评测数据集，用于沉淀智能体回归验证样本。"""
    return repo.create_dataset(payload)


@router.post("/{dataset_id}/cases", response_model=EvaluationCaseRead, status_code=status.HTTP_201_CREATED)
def add_case(dataset_id: str, payload: EvaluationCaseCreate) -> EvaluationCaseRead:
    """向指定评测数据集追加用例，记录输入、期望输出和标签信息。"""
    return repo.add_case(dataset_id, payload)


@router.post("/{dataset_id}/runs", response_model=EvaluationRunRead, status_code=status.HTTP_201_CREATED)
def run_evaluation(dataset_id: str, payload: EvaluationRunCreate) -> EvaluationRunRead:
    """基于指定数据集发起评测运行，返回本次运行的汇总结果。"""
    return repo.run(dataset_id, payload)


@router.get("/latest-run", response_model=EvaluationRunRead)
def get_latest_run() -> EvaluationRunRead:
    """查询最近一次评测运行结果，供仪表盘和发布门禁展示使用。"""
    return repo.latest_run()
