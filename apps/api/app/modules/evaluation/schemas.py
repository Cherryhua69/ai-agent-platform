from pydantic import BaseModel, Field


class EvaluationDatasetCreate(BaseModel):
    name: str = Field(min_length=1)


class EvaluationDatasetRead(BaseModel):
    id: str
    name: str
    case_count: int = Field(alias="caseCount")


class EvaluationCaseCreate(BaseModel):
    name: str = Field(min_length=1)
    input: str = Field(min_length=1)
    expected: str = Field(min_length=1)


class EvaluationCaseRead(EvaluationCaseCreate):
    id: str


class EvaluationRunCreate(BaseModel):
    agent_id: str = Field(alias="agentId", min_length=1)


class EvaluationSummary(BaseModel):
    cost_cny: float = Field(alias="costCny")
    latency_ms: int = Field(alias="latencyMs")


class EvaluationRunRead(BaseModel):
    id: str
    dataset_id: str = Field(alias="datasetId")
    agent_id: str = Field(alias="agentId")
    pass_rate: float = Field(alias="passRate")
    failed_cases: list[str] = Field(alias="failedCases")
    summary: EvaluationSummary
