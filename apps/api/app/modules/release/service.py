from datetime import datetime, timezone
from uuid import uuid4

from app.modules.evaluation.repository import EvaluationRepository
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.release.schemas import ReleaseGateRead
from app.modules.tool.repository import ToolRepository


class ReleaseGateService:
    def __init__(
        self,
        tools: ToolRepository,
        knowledge: KnowledgeRepository,
        evaluations: EvaluationRepository,
    ) -> None:
        self._tools = tools
        self._knowledge = knowledge
        self._evaluations = evaluations

    def check(self, agent_id: str) -> ReleaseGateRead:
        reasons = self._dedupe_reasons([
            *self._tool_health_reasons(),
            *self._evaluation_reasons(),
            *self._knowledge_reasons(),
            "高风险权限：refund_request 需要人工确认",
        ])

        return ReleaseGateRead(
            id=f"gate_{agent_id}",
            agentId=agent_id,
            status="blocked" if reasons else "passed",
            reasons=reasons,
            checkedAt=self._utc_now_iso(),
            auditId=f"audit_{uuid4().hex[:8]}",
        )

    def _tool_health_reasons(self) -> list[str]:
        return [
            f"工具健康异常：{tool.name} {tool.health}"
            for tool in self._tools.list_tools()
            if tool.health != "online"
        ]

    def _evaluation_reasons(self) -> list[str]:
        run = self._evaluations.latest_run()
        return [f"关键评测用例失败：{case_name}" for case_name in run.failed_cases]

    def _knowledge_reasons(self) -> list[str]:
        return [
            f"知识库索引状态未全部 ready：{knowledge_base.id} {knowledge_base.status}"
            for knowledge_base in self._knowledge.list_knowledge_bases()
            if knowledge_base.status != "ready"
        ]

    def _dedupe_reasons(self, reasons: list[str]) -> list[str]:
        return list(dict.fromkeys(reasons))

    def _utc_now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
