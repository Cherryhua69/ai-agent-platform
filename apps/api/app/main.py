from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.modules.agent.router import router as agent_router
from app.modules.evaluation.router import router as evaluation_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.model_provider.router import router as model_provider_router
from app.modules.release.router import router as release_router
from app.modules.tool.router import router as tool_router
from app.modules.trace.router import router as trace_router
from app.modules.workflow.router import router as workflow_router
from app.core.database import init_database

init_database()

app = FastAPI(title="AI Agent Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)
app.include_router(evaluation_router)
app.include_router(knowledge_router)
app.include_router(model_provider_router)
app.include_router(release_router)
app.include_router(tool_router)
app.include_router(trace_router)
app.include_router(workflow_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
