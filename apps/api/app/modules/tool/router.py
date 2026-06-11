from fastapi import APIRouter, status

from app.core.database import SessionLocal
from app.modules.tool.repository import ToolRepository
from app.modules.tool.schemas import McpServerCreate, McpServerRead, ToolCreate, ToolHealthRead, ToolRead

router = APIRouter(tags=["tools"])
repo = ToolRepository(session_factory=SessionLocal)


@router.post("/api/mcp-servers", response_model=McpServerRead, status_code=status.HTTP_201_CREATED)
def create_mcp_server(payload: McpServerCreate) -> McpServerRead:
    return repo.create_mcp_server(payload)


@router.get("/api/tools", response_model=list[ToolRead])
def list_tools() -> list[ToolRead]:
    return repo.list_tools()


@router.post("/api/tools", response_model=ToolRead, status_code=status.HTTP_201_CREATED)
def create_tool(payload: ToolCreate) -> ToolRead:
    return repo.create_tool(payload)


@router.get("/api/tools/{tool_id}/health", response_model=ToolHealthRead)
def get_tool_health(tool_id: str) -> ToolHealthRead:
    return repo.get_health(tool_id)
