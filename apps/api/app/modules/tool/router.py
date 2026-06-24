from fastapi import APIRouter, status

from app.core.database import SessionLocal
from app.modules.tool.repository import ToolRepository
from app.modules.tool.schemas import McpServerCreate, McpServerRead, ToolCreate, ToolHealthRead, ToolRead

router = APIRouter(tags=["tools"])
repo = ToolRepository(session_factory=SessionLocal)


@router.post("/api/mcp-servers", response_model=McpServerRead, status_code=status.HTTP_201_CREATED)
def create_mcp_server(payload: McpServerCreate) -> McpServerRead:
    """创建 MCP 服务配置，供工具接入和后续工具发现流程使用。"""
    return repo.create_mcp_server(payload)


@router.get("/api/tools", response_model=list[ToolRead])
def list_tools() -> list[ToolRead]:
    """查询全部工具配置，供工具页面列表和发布门禁健康检查使用。"""
    return repo.list_tools()


@router.post("/api/tools", response_model=ToolRead, status_code=status.HTTP_201_CREATED)
def create_tool(payload: ToolCreate) -> ToolRead:
    """创建工具配置，记录鉴权、权限、Schema 和初始健康状态。"""
    return repo.create_tool(payload)


@router.get("/api/tools/{tool_id}/health", response_model=ToolHealthRead)
def get_tool_health(tool_id: str) -> ToolHealthRead:
    """查询指定工具健康状态，供工具页面探活展示和发布检查复用。"""
    return repo.get_health(tool_id)
