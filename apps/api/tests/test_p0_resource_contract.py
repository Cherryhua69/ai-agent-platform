from fastapi.testclient import TestClient

from app.main import app


def test_knowledge_bases_do_not_return_legacy_seed_data():
    client = TestClient(app)

    response = client.get("/api/knowledge-bases")

    assert response.status_code == 200
    body = response.json()
    assert all(item["id"] not in {"kb-after-sale", "kb-warranty"} for item in body)


def test_tools_return_frontend_ready_seed_data():
    client = TestClient(app)

    response = client.get("/api/tools")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["name"] == "create_ticket"
    assert body[0]["credential"] == "ticket-prod"
    assert body[0]["permission"] == "Developer + Operator"
    assert body[0]["health"] == "degraded"
    assert body[0]["lastCalledAt"] == "10 分钟前"


def test_latest_evaluation_run_matches_observe_page_contract():
    client = TestClient(app)

    response = client.get("/api/evaluation-datasets/latest-run")

    assert response.status_code == 200
    body = response.json()
    assert body["agentId"] == "agent-after-sale"
    assert 0 <= body["passRate"] <= 1
    assert body["failedCases"] == ["refund-ticket-create"]
    assert body["summary"]["costCny"] == 0.42
    assert body["summary"]["latencyMs"] == 1900


def test_release_gates_return_readable_reasons():
    client = TestClient(app)

    response = client.get("/api/release-gates")

    assert response.status_code == 200
    body = response.json()
    reasons = body[0]["reasons"]
    assert "工具健康异常：create_ticket degraded" in reasons
    assert "关键评测用例失败：refund-ticket-create" in reasons
    assert "知识库索引状态未全部 ready：kb-warranty stale" not in reasons
    assert "高风险权限：refund_request 需要人工确认" in reasons
