from uuid import uuid4

from app.modules.tool.schemas import McpServerCreate, McpServerRead, ToolCreate, ToolHealthRead, ToolRead


class ToolRepository:
    def __init__(self) -> None:
        self._mcp_servers: dict[str, McpServerRead] = {}
        self._tools: dict[str, ToolRead] = {}

    def create_mcp_server(self, payload: McpServerCreate) -> McpServerRead:
        server = McpServerRead(
            id=f"mcp_{uuid4().hex[:8]}",
            name=payload.name,
            baseUrl=payload.base_url,
            owner=payload.owner,
            status="registered",
        )
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
        self._tools[tool.id] = tool
        return tool

    def list_tools(self) -> list[ToolRead]:
        if self._tools:
            return list(self._tools.values())
        return [
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

    def get_health(self, tool_id: str) -> ToolHealthRead:
        tool = self._tools.get(tool_id)
        status = tool.health if tool else "degraded"
        return ToolHealthRead(
            toolId=tool_id,
            status=status,
            reason="create_ticket degraded" if status == "degraded" else "healthy",
        )
