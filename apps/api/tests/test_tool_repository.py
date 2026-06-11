from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.tool.models import McpServerModel, ToolModel
from app.modules.tool.repository import ToolRepository
from app.modules.tool.schemas import McpServerCreate, ToolCreate


def test_tool_repository_persists_mcp_servers_and_tools_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[McpServerModel.__table__, ToolModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = ToolRepository(session_factory=session_factory)
    server = writer.create_mcp_server(
        McpServerCreate(name="工单 MCP", baseUrl="https://mcp.example.test", owner="platform")
    )
    created = writer.create_tool(
        ToolCreate(
            name="create_ticket",
            type="mcp",
            credential="ticket-prod",
            permission="Developer + Operator",
            schema={"input": {"type": "object"}},
        )
    )

    reader = ToolRepository(session_factory=session_factory)
    persisted = next(tool for tool in reader.list_tools() if tool.id == created.id)
    health = reader.get_health(created.id)

    assert server.id.startswith("mcp_")
    assert persisted.name == "create_ticket"
    assert persisted.health == "degraded"
    assert persisted.tool_schema == {"input": {"type": "object"}}
    assert health.status == "degraded"
    assert health.reason == "create_ticket degraded"
