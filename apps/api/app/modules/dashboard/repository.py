from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.agent.models import AgentModel
from app.modules.dashboard.schemas import DashboardSummaryRead, PendingAgentRead, RunSuccessRateRead
from app.modules.trace.models import RunModel, utc_now


class DashboardRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory

    def get_summary(self) -> DashboardSummaryRead:
        if not self._session_factory:
            return self._empty_summary()

        with self._session_factory() as session:
            return DashboardSummaryRead(
                runSuccessRate=self._get_run_success_rate(session),
                publishedAgents=0,
                pendingAgents=self._list_pending_agents(session),
            )

    def _get_run_success_rate(self, session: Session) -> RunSuccessRateRead:
        window_hours = 24
        started_at = utc_now() - timedelta(hours=window_hours)
        rows = session.execute(
            select(RunModel.status, func.count(RunModel.id))
            .where(RunModel.created_at >= started_at)
            .where(RunModel.run_category.in_(("test", "production")))
            .group_by(RunModel.status)
        ).all()
        counts = {status: count for status, count in rows}
        total_runs = sum(counts.values())
        successful_runs = counts.get("success", 0)
        value = round(successful_runs / total_runs * 100) if total_runs else 0
        return RunSuccessRateRead(
            value=value,
            windowHours=window_hours,
            totalRuns=total_runs,
            successfulRuns=successful_runs,
        )

    def _list_pending_agents(self, session: Session) -> list[PendingAgentRead]:
        agents = session.scalars(
            select(AgentModel)
            .where(AgentModel.status != "published")
            .order_by(AgentModel.created_at.asc(), AgentModel.id.asc())
        ).all()
        return [
            PendingAgentRead(
                id=agent.id,
                name=agent.name,
                description=agent.scenario,
                status="configuring",
            )
            for agent in agents
        ]

    @staticmethod
    def _empty_summary() -> DashboardSummaryRead:
        return DashboardSummaryRead(
            runSuccessRate=RunSuccessRateRead(value=0, windowHours=24, totalRuns=0, successfulRuns=0),
            publishedAgents=0,
            pendingAgents=[],
        )
