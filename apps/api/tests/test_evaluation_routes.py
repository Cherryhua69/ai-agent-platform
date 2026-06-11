from fastapi.testclient import TestClient

from app.main import app


def test_evaluation_p0_flow():
    client = TestClient(app)

    dataset = client.post("/api/evaluation-datasets", json={"name": "售后门禁集"})
    assert dataset.status_code == 201
    dataset_id = dataset.json()["id"]

    case = client.post(
        f"/api/evaluation-datasets/{dataset_id}/cases",
        json={"name": "refund-ticket-create", "input": "用户要求退款并创建工单", "expected": "触发人工确认"},
    )
    assert case.status_code == 201

    run = client.post(f"/api/evaluation-datasets/{dataset_id}/runs", json={"agentId": "agent-after-sale"})
    assert run.status_code == 201
    body = run.json()
    assert body["passRate"] < 1
    assert body["failedCases"][0] == "refund-ticket-create"
    assert body["summary"]["costCny"] >= 0
    assert body["summary"]["latencyMs"] > 0
