from fastapi import FastAPI

from app.modules.agent.router import router as agent_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.release.router import router as release_router
from app.modules.tool.router import router as tool_router
from app.modules.trace.router import router as trace_router

app = FastAPI(title="AI Agent Platform API")

app.include_router(agent_router)
app.include_router(knowledge_router)
app.include_router(release_router)
app.include_router(tool_router)
app.include_router(trace_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
