from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.modules.agent.models import AgentModel
from app.modules.trace.models import RunModel, utc_now


def test_dashboard_summary_uses_real_runs_and_unpublished_agents():
    client = TestClient(app)
    now = utc_now()

    with SessionLocal() as session:
        session.query(RunModel).delete()
        session.query(AgentModel).delete()
        session.add_all(
            [
                AgentModel(id="agent-configuring", name="客服助手", scenario="处理售后咨询", status="draft"),
                AgentModel(id="agent-ready", name="合同助手", scenario="审阅合同条款", status="ready"),
                AgentModel(id="agent-published", name="已发布助手", scenario="不应进入待完成", status="published"),
            ]
        )
        session.add_all(
            [
                RunModel(
                    id="run_success_test",
                    agent_id="agent-configuring",
                    status="success",
                    run_category="test",
                    failure_reason=None,
                    cost_cny=0.01,
                    created_at=now - timedelta(hours=1),
                ),
                RunModel(
                    id="run_failed_prod",
                    agent_id="agent-ready",
                    status="failed",
                    run_category="production",
                    failure_reason="工具超时",
                    cost_cny=0.02,
                    created_at=now - timedelta(hours=2),
                ),
                RunModel(
                    id="run_old_success",
                    agent_id="agent-configuring",
                    status="success",
                    run_category="test",
                    failure_reason=None,
                    cost_cny=0.01,
                    created_at=now - timedelta(hours=25),
                ),
            ]
        )
        session.commit()

    response = client.get("/api/dashboard/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["runSuccessRate"] == {
        "value": 50,
        "windowHours": 24,
        "totalRuns": 2,
        "successfulRuns": 1,
    }
    assert body["publishedAgents"] == 0
    assert body["pendingAgents"] == [
        {
            "id": "agent-configuring",
            "name": "客服助手",
            "description": "处理售后咨询",
            "status": "configuring",
        },
        {
            "id": "agent-ready",
            "name": "合同助手",
            "description": "审阅合同条款",
            "status": "configuring",
        },
    ]
