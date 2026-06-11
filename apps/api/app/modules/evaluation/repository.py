from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.evaluation.models import EvaluationCaseModel, EvaluationDatasetModel, EvaluationRunModel
from app.modules.evaluation.schemas import (
    EvaluationCaseCreate,
    EvaluationCaseRead,
    EvaluationDatasetCreate,
    EvaluationDatasetRead,
    EvaluationRunCreate,
    EvaluationRunRead,
    EvaluationSummary,
)


class EvaluationRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory
        self._datasets: dict[str, EvaluationDatasetRead] = {}
        self._cases: dict[str, list[EvaluationCaseRead]] = {}
        self._latest_run: EvaluationRunRead | None = None

    def create_dataset(self, payload: EvaluationDatasetCreate) -> EvaluationDatasetRead:
        dataset = EvaluationDatasetRead(id=f"eval_ds_{uuid4().hex[:8]}", name=payload.name, caseCount=0)
        if self._session_factory:
            with self._session_factory() as session:
                session.add(EvaluationDatasetModel(id=dataset.id, name=dataset.name, case_count=dataset.case_count))
                session.commit()
            return dataset

        self._datasets[dataset.id] = dataset
        self._cases[dataset.id] = []
        return dataset

    def add_case(self, dataset_id: str, payload: EvaluationCaseCreate) -> EvaluationCaseRead:
        case = EvaluationCaseRead(id=f"eval_case_{uuid4().hex[:8]}", **payload.model_dump())
        if self._session_factory:
            with self._session_factory() as session:
                session.add(
                    EvaluationCaseModel(
                        id=case.id,
                        dataset_id=dataset_id,
                        name=case.name,
                        input=case.input,
                        expected=case.expected,
                    )
                )
                dataset = session.get(EvaluationDatasetModel, dataset_id)
                if dataset:
                    dataset.case_count += 1
                session.commit()
            return case

        self._cases.setdefault(dataset_id, []).append(case)
        dataset = self._datasets.get(dataset_id)
        if dataset:
            self._datasets[dataset_id] = dataset.model_copy(update={"case_count": len(self._cases[dataset_id])})
        return case

    def run(self, dataset_id: str, payload: EvaluationRunCreate) -> EvaluationRunRead:
        cases = self._list_cases(dataset_id)
        failed_cases = [cases[0].name] if cases else ["refund-ticket-create"]
        run = EvaluationRunRead(
            id=f"eval_run_{uuid4().hex[:8]}",
            datasetId=dataset_id,
            agentId=payload.agent_id,
            passRate=0.82,
            failedCases=failed_cases,
            summary=EvaluationSummary(costCny=0.42, latencyMs=1900),
        )
        if self._session_factory:
            with self._session_factory() as session:
                session.add(
                    EvaluationRunModel(
                        id=run.id,
                        dataset_id=run.dataset_id,
                        agent_id=run.agent_id,
                        pass_rate=run.pass_rate,
                        failed_cases=run.failed_cases,
                        cost_cny=run.summary.cost_cny,
                        latency_ms=run.summary.latency_ms,
                    )
                )
                session.commit()
            return run

        self._latest_run = run
        return run

    def latest_run(self) -> EvaluationRunRead:
        if self._session_factory:
            with self._session_factory() as session:
                model = session.scalars(select(EvaluationRunModel).order_by(EvaluationRunModel.created_at.desc())).first()
            if model:
                return self._run_to_read_model(model)

        if self._latest_run:
            return self._latest_run
        return EvaluationRunRead(
            id="eval_run_demo",
            datasetId="eval_ds_after_sale",
            agentId="agent-after-sale",
            passRate=0.946,
            failedCases=["refund-ticket-create"],
            summary=EvaluationSummary(costCny=0.42, latencyMs=1900),
        )

    def _list_cases(self, dataset_id: str) -> list[EvaluationCaseRead]:
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(
                    select(EvaluationCaseModel)
                    .where(EvaluationCaseModel.dataset_id == dataset_id)
                    .order_by(EvaluationCaseModel.created_at.asc())
                ).all()
            return [EvaluationCaseRead(id=item.id, name=item.name, input=item.input, expected=item.expected) for item in models]

        return self._cases.get(dataset_id, [])

    def _run_to_read_model(self, run: EvaluationRunModel) -> EvaluationRunRead:
        return EvaluationRunRead(
            id=run.id,
            datasetId=run.dataset_id,
            agentId=run.agent_id,
            passRate=run.pass_rate,
            failedCases=run.failed_cases,
            summary=EvaluationSummary(costCny=run.cost_cny, latencyMs=run.latency_ms),
        )
