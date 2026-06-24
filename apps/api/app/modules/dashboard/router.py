from fastapi import APIRouter

from app.core.database import SessionLocal
from app.modules.dashboard.repository import DashboardRepository
from app.modules.dashboard.schemas import DashboardSummaryRead

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
repo = DashboardRepository(session_factory=SessionLocal)


@router.get("/summary", response_model=DashboardSummaryRead)
def get_dashboard_summary() -> DashboardSummaryRead:
    """查询首页仪表盘汇总数据，包含运行、质量和资源概览指标。"""
    return repo.get_summary()
