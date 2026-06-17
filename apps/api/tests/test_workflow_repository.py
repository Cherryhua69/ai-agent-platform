from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.workflow.models import WorkflowModel
from app.modules.workflow.repository import WorkflowRepository
from app.modules.workflow.schemas import WorkflowUpdate


def test_workflow_repository_persists_default_workflow_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[WorkflowModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = WorkflowRepository(session_factory=session_factory)
    created = writer.create_default_for_agent("agent_test", "测试助手")

    reader = WorkflowRepository(session_factory=session_factory)
    loaded = reader.get(created.id)

    assert loaded is not None
    assert loaded.agent_id == "agent_test"
    assert [node.type for node in loaded.nodes] == ["trigger"]
    assert loaded.edges == []


def test_workflow_repository_updates_canvas_json_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[WorkflowModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    repo = WorkflowRepository(session_factory=session_factory)
    created = repo.create_default_for_agent("agent_test", "测试助手")

    updated = repo.update(
        created.id,
        WorkflowUpdate(
            name="测试工作流",
            status="draft",
            toolHealthStatus="online",
            viewport={"x": 10, "y": 20, "zoom": 0.8},
            nodes=[
                {
                    "id": "node-a",
                    "type": "trigger",
                    "name": "用户输入",
                    "status": "success",
                    "position": {"x": 1, "y": 2},
                    "config": {"required": True},
                }
            ],
            edges=[
                {
                    "id": "edge-a-b",
                    "source": "node-a",
                    "target": "node-b",
                    "sourceHandle": "right",
                    "targetHandle": "left",
                }
            ],
        ),
    )

    assert updated is not None
    reloaded = WorkflowRepository(session_factory=session_factory).get(created.id)
    assert reloaded is not None
    assert reloaded.name == "测试工作流"
    assert reloaded.viewport.x == 10
    assert reloaded.nodes[0].config == {"required": True}
    assert reloaded.edges[0].source_handle == "right"
