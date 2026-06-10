from uuid import uuid4

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
    def __init__(self) -> None:
        self._datasets: dict[str, EvaluationDatasetRead] = {}
        self._cases: dict[str, list[EvaluationCaseRead]] = {}
        self._latest_run: EvaluationRunRead | None = None

    def create_dataset(self, payload: EvaluationDatasetCreate) -> EvaluationDatasetRead:
        dataset = EvaluationDatasetRead(id=f"eval_ds_{uuid4().hex[:8]}", name=payload.name, caseCount=0)
        self._datasets[dataset.id] = dataset
        self._cases[dataset.id] = []
        return dataset

    def add_case(self, dataset_id: str, payload: EvaluationCaseCreate) -> EvaluationCaseRead:
        case = EvaluationCaseRead(id=f"eval_case_{uuid4().hex[:8]}", **payload.model_dump())
        self._cases.setdefault(dataset_id, []).append(case)
        dataset = self._datasets.get(dataset_id)
        if dataset:
            self._datasets[dataset_id] = dataset.model_copy(update={"case_count": len(self._cases[dataset_id])})
        return case

    def run(self, dataset_id: str, payload: EvaluationRunCreate) -> EvaluationRunRead:
        cases = self._cases.get(dataset_id, [])
        failed_cases = [cases[0].name] if cases else ["refund-ticket-create"]
        run = EvaluationRunRead(
            id=f"eval_run_{uuid4().hex[:8]}",
            datasetId=dataset_id,
            agentId=payload.agent_id,
            passRate=0.82,
            failedCases=failed_cases,
            summary=EvaluationSummary(costCny=0.42, latencyMs=1900),
        )
        self._latest_run = run
        return run

    def latest_run(self) -> EvaluationRunRead:
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
