from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.evaluation.models import EvaluationCaseModel, EvaluationDatasetModel, EvaluationRunModel
from app.modules.evaluation.repository import EvaluationRepository
from app.modules.evaluation.schemas import EvaluationCaseCreate, EvaluationDatasetCreate, EvaluationRunCreate


def test_evaluation_repository_persists_cases_and_latest_run_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(
        engine,
        tables=[EvaluationDatasetModel.__table__, EvaluationCaseModel.__table__, EvaluationRunModel.__table__],
    )
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = EvaluationRepository(session_factory=session_factory)
    dataset = writer.create_dataset(EvaluationDatasetCreate(name="售后门禁集"))
    writer.add_case(
        dataset.id,
        EvaluationCaseCreate(name="refund-ticket-create", input="用户要求退款并创建工单", expected="触发人工确认"),
    )
    run = writer.run(dataset.id, EvaluationRunCreate(agentId="agent-after-sale"))

    reader = EvaluationRepository(session_factory=session_factory)
    latest = reader.latest_run()

    assert run.id == latest.id
    assert latest.dataset_id == dataset.id
    assert latest.failed_cases == ["refund-ticket-create"]
    assert latest.pass_rate == 0.82
    assert latest.summary.cost_cny == 0.42
