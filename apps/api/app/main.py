from fastapi import FastAPI

app = FastAPI(title="AI Agent Platform API")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
