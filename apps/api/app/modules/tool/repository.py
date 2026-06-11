from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.tool.models import McpServerModel, ToolModel
from app.modules.tool.schemas import McpServerCreate, McpServerRead, ToolCreate, ToolHealthRead, ToolRead


class ToolRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory
        self._mcp_servers: dict[str, McpServerRead] = {}
        self._tools: dict[str, ToolRead] = {}
        self._seed_tools = [
            ToolRead(
                id="tool-create-ticket",
                name="create_ticket",
                type="mcp",
                credential="ticket-prod",
                permission="Developer + Operator",
                health="degraded",
                lastCalledAt="10 分钟前",
                schema={"input": {"type": "object"}},
            ),
            ToolRead(
                id="tool-query-order",
                name="query_order",
                type="api",
                credential="order-readonly",
                permission="Agent scoped",
                health="online",
                lastCalledAt="2 分钟前",
                schema={"input": {"type": "object"}},
            ),
        ]

    def create_mcp_server(self, payload: McpServerCreate) -> McpServerRead:
        server = McpServerRead(
            id=f"mcp_{uuid4().hex[:8]}",
            name=payload.name,
            baseUrl=payload.base_url,
            owner=payload.owner,
            status="registered",
        )

        if self._session_factory:
            with self._session_factory() as session:
                session.add(
                    McpServerModel(
                        id=server.id,
                        name=server.name,
                        base_url=server.base_url,
                        owner=server.owner,
                        status=server.status,
                    )
                )
                session.commit()
            return server

        self._mcp_servers[server.id] = server
        return server

    def create_tool(self, payload: ToolCreate) -> ToolRead:
        tool = ToolRead(
            id=f"tool_{uuid4().hex[:8]}",
            name=payload.name,
            type=payload.type,
            credential=payload.credential,
            permission=payload.permission,
            health="degraded" if payload.name == "create_ticket" else "online",
            lastCalledAt="刚刚",
            schema=payload.tool_schema,
        )

        if self._session_factory:
            with self._session_factory() as session:
                session.add(
                    ToolModel(
                        id=tool.id,
                        name=tool.name,
                        type=tool.type,
                        credential=tool.credential,
                        permission=tool.permission,
                        health=tool.health,
                        last_called_at=tool.last_called_at,
                        tool_schema=tool.tool_schema,
                    )
                )
                session.commit()
            return tool

        self._tools[tool.id] = tool
        return tool

    def list_tools(self) -> list[ToolRead]:
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(select(ToolModel).order_by(ToolModel.created_at.asc())).all()
            return [*self._seed_tools, *[self._to_read_model(tool) for tool in models]]

        return [*self._seed_tools, *self._tools.values()]

    def get_health(self, tool_id: str) -> ToolHealthRead:
        tool = self._tools.get(tool_id)
        if self._session_factory:
            with self._session_factory() as session:
                tool = session.get(ToolModel, tool_id)
            status = tool.health if tool else "degraded"
            return ToolHealthRead(
                toolId=tool_id,
                status=status,
                reason="create_ticket degraded" if status == "degraded" else "healthy",
            )

        status = tool.health if tool else "degraded"
        return ToolHealthRead(
            toolId=tool_id,
            status=status,
            reason="create_ticket degraded" if status == "degraded" else "healthy",
        )

    def _to_read_model(self, tool: ToolModel) -> ToolRead:
        return ToolRead(
            id=tool.id,
            name=tool.name,
            type=tool.type,
            credential=tool.credential,
            permission=tool.permission,
            health=tool.health,
            lastCalledAt=tool.last_called_at,
            schema=tool.tool_schema,
        )
