import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.orchestration.gpt_agent import GPTAgent


ComplianceStatus = Literal["Compliant", "Partially Compliant", "Non-Compliant"]


class PrincipleFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str
    text: str
    explanation: str


class PrincipleCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    passed: bool
    evidence: str


class PrincipleMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    value: str


class PrincipleWorkflowAnalysisOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    principle: Literal["B1", "B2", "C", "D", "E"]
    status: ComplianceStatus
    summary: str
    relevant_text_fragment: str
    issue_identified: str
    explanation: str
    findings: list[PrincipleFinding] = Field(default_factory=list)
    checks: list[PrincipleCheck] = Field(default_factory=list)
    metrics: list[PrincipleMetric] = Field(default_factory=list)
    correction_goal: str
    can_correct_without_new_information: bool
    guidance: str


class PrincipleWorkflowValidationOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    principle: Literal["B1", "B2", "C", "D", "E"]
    status: ComplianceStatus
    summary: str
    relevant_text_fragment: str
    issue_identified: str
    explanation: str
    meaning_preserved: bool


PRINCIPLE_CRITERIA = {
    "B1": {
        "name": "Break into Separate Attestations",
        "focus": (
            "Determine whether the text contains multiple independent assurances and should be divided into smaller, "
            "complete attestations. Consider excessive length, subordinate clauses, extensive coordination, and multiple assurances."
        ),
        "required_metrics": ["Separation needed", "Suggested number of attestations"],
    },
    "B2": {
        "name": "Transparency and Objectivity",
        "focus": (
            "Identify vague, subjective, open-to-interpretation, or insufficiently measurable terms. Determine whether "
            "the language is objective and verifiable. Never invent a missing criterion, threshold, or standard."
        ),
        "required_metrics": ["Vague terms count", "Objectivity level"],
    },
    "C": {
        "name": "Verifiability and Auditability",
        "focus": (
            "Determine whether each assurance can be independently verified, whether documentary evidence could reasonably "
            "exist, and whether an auditor could objectively confirm it. Do not invent evidence or records."
        ),
        "required_metrics": ["Verifiable elements", "Non-verifiable elements"],
    },
    "D": {
        "name": "Interoperability",
        "focus": (
            "Determine whether the attestation can be represented as structured data, ontology triples, and machine-readable "
            "regulatory models. Identify embedded relationships, ambiguous references, implicit entities, and nested structures."
        ),
        "required_metrics": ["Interoperability level", "Complexity score (0-100)"],
    },
    "E": {
        "name": "Preservation of Meaning",
        "focus": (
            "Identify the core meaning, regulatory intent, and essential information. Determine whether rewriting, decomposition, "
            "or formalization preserves modality, scope, qualifiers, and strength without adding or removing meaning."
        ),
        "required_metrics": ["Meaning preserved", "Essential information count"],
    },
}


class PrincipleWorkflowAnalysisTool:
    def __init__(self):
        self._agent = GPTAgent(
            agent_id="principle_workflow_analyser",
            output_type=PrincipleWorkflowAnalysisOutput,
        )
        self._validation_agent = GPTAgent(
            agent_id="principle_workflow_analyser",
            output_type=PrincipleWorkflowValidationOutput,
        )

    async def run_async(
        self,
        attestation: str,
        principle: str,
        *,
        original_attestation: str | None = None,
    ) -> dict[str, Any]:
        criteria = PRINCIPLE_CRITERIA.get(principle)
        if criteria is None:
            raise ValueError(f"Unsupported workflow principle: {principle}")

        prompt = json.dumps(
            {
                "principle": principle,
                "principle_name": criteria["name"],
                "evaluation_criteria": criteria["focus"],
                "required_metrics": criteria["required_metrics"],
                "attestation": attestation,
                "original_attestation_for_comparison": original_attestation,
                "instructions": (
                    "Evaluate only the requested principle. If an original is provided, evaluate whether the candidate solves "
                    "the requested issue while preserving the original meaning. Use only explicit text. Do not assess legal or "
                    "scientific validity and do not invent facts, thresholds, evidence, authorities, or standards."
                ),
            },
            ensure_ascii=False,
        )
        result = await self._agent.run(prompt)
        if hasattr(result, "model_dump"):
            result = result.model_dump()
        return {"input": {"attestation": attestation, "principle": principle}, "results": result}

    async def validate_async(
        self,
        attestation: str,
        principle: str,
        *,
        original_attestation: str | None = None,
    ) -> dict[str, Any]:
        criteria = PRINCIPLE_CRITERIA.get(principle)
        if criteria is None:
            raise ValueError(f"Unsupported workflow principle: {principle}")

        prompt = json.dumps(
            {
                "principle": principle,
                "principle_name": criteria["name"],
                "evaluation_criteria": criteria["focus"],
                "attestation": attestation,
                "original_attestation_for_comparison": original_attestation,
                "instructions": (
                    "Return a compact validation only. Evaluate the requested principle and whether the candidate preserves "
                    "the original meaning when an original is provided. Do not include findings, checks, metrics, suggestions, "
                    "or invented information. Set meaning_preserved only after comparing scope, modality, qualifiers, assurance "
                    "strength, and explicit relationships. Keep each text field to at most two concise sentences."
                ),
            },
            ensure_ascii=False,
        )
        result = await self._validation_agent.run(prompt)
        if hasattr(result, "model_dump"):
            result = result.model_dump()
        return {"input": {"attestation": attestation, "principle": principle}, "results": result}
