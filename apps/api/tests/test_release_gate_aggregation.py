from fastapi.testclient import TestClient

from app.main import app


def test_release_gate_aggregates_p0_resource_statuses():
    client = TestClient(app)

    response = client.post("/api/agents/agent-after-sale/release-gates/check")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "blocked"
    assert body["auditId"].startswith("audit_")
    assert any("工具健康异常" in reason for reason in body["reasons"])
    assert any("关键评测用例失败" in reason for reason in body["reasons"])
    assert any("知识库索引状态" in reason for reason in body["reasons"])
    assert any("高风险权限" in reason for reason in body["reasons"])
