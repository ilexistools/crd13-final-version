"""Plan controlled attestation rewrite changes from selected section references."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.orchestration.gpt_agent import GPTAgent
from app.tools.compliance_analysis import ComplianceAnalysisTool


DEFAULT_REWRITE_CRITERIA_PATH = (
    Path(__file__).resolve().parents[1] / "assets" / "resources" / "rewrite_criteria.json"
)


RewriteChangeDecision = Literal[
    "changes_recommended",
    "unchanged",
    "insufficient_basis",
]

RewriteChangeType = Literal[
    "clarify",
    "narrow_scope",
    "add_supported_condition",
    "remove_unsupported_claim",
    "align_terminology",
    "split_attestation",
    "minor_style",
]

RewriteAttention = Literal[
    "preserve",
    "address",
    "monitor",
]


class SupportingSectionReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doc_id: str
    section_id: int | str
    section: str


class AttestationRewriteChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    change_type: RewriteChangeType
    target_fragment: str = Field(
        ...,
        description="Smallest fragment of the source attestation affected by the change.",
    )
    suggested_change: str = Field(
        ...,
        description="Concrete operational change to apply when rewriting the attestation.",
    )
    rationale: str = Field(
        ...,
        description="Why this change is needed or appropriate based on the supplied sections.",
    )
    supporting_sections: list[SupportingSectionReference] = Field(
        default_factory=list,
        description="Sections supporting this proposed change.",
    )
    guideline_principles: list[str] = Field(
        default_factory=list,
        description="CRD13 guideline principles addressed or protected by this change: A1, A2, A3, B1, B2, C, D, E.",
    )


class PrincipleRewriteAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    principle: str
    principle_name: str
    current_compliance: str
    issue_identified: str
    rewrite_attention: RewriteAttention = Field(
        description="Use preserve for compliant principles, address for non-compliant/partially compliant principles that should drive changes, and monitor when the principle is not the direct target but must not be degraded.",
    )
    rationale: str


class AttestationRewriteChangePlanOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: RewriteChangeDecision
    principle_assessments: list[PrincipleRewriteAssessment] = Field(default_factory=list)
    changes: list[AttestationRewriteChange] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class AttestationRewriteChangePlannerTool:
    def __init__(self, rewrite_criteria_path: str | Path = DEFAULT_REWRITE_CRITERIA_PATH):
        self.rewrite_criteria_path = Path(rewrite_criteria_path)
        self._compliance_analyser: ComplianceAnalysisTool | None = None
        self._rewrite_criteria: list[dict[str, Any]] = self._load_rewrite_criteria()
        self.__create_gpts()

    def __create_gpts(self) -> None:
        self.__gpt_agent_planner = GPTAgent(
            agent_id="attestation_rewrite_change_planner",
            output_type=AttestationRewriteChangePlanOutput,
        )

    def _load_rewrite_criteria(self) -> list[dict[str, Any]]:
        if not self.rewrite_criteria_path.exists():
            return []
        with self.rewrite_criteria_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, list) else []

    def _get_compliance_analyser(self) -> ComplianceAnalysisTool:
        if self._compliance_analyser is None:
            self._compliance_analyser = ComplianceAnalysisTool()
        return self._compliance_analyser

    @staticmethod
    def _as_dict(value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return value
        if hasattr(value, "model_dump"):
            return value.model_dump()
        if hasattr(value, "dict"):
            return value.dict()
        return {}

    @classmethod
    def _extract_compliance_results(cls, compliance_analysis: Any) -> dict[str, Any]:
        payload = cls._as_dict(compliance_analysis)
        output = cls._as_dict(payload.get("output"))
        results = output.get("results")
        if results is not None:
            return cls._as_dict(results)
        if payload.get("results") is not None:
            return cls._as_dict(payload.get("results"))
        return payload

    async def _compliance_results_async(
        self,
        attestation: str,
        compliance_analysis: Any | None,
    ) -> dict[str, Any]:
        if compliance_analysis:
            return self._extract_compliance_results(compliance_analysis)
        analysis = await self._get_compliance_analyser().run_async(attestation)
        return self._extract_compliance_results(analysis)

    def _compliance_results(
        self,
        attestation: str,
        compliance_analysis: Any | None,
    ) -> dict[str, Any]:
        if compliance_analysis:
            return self._extract_compliance_results(compliance_analysis)
        analysis = self._get_compliance_analyser().run(attestation)
        return self._extract_compliance_results(analysis)

    @staticmethod
    def _clean_sections(sections: list[Any]) -> list[dict[str, Any]]:
        cleaned: list[dict[str, Any]] = []
        for section in sections:
            if not isinstance(section, dict):
                continue
            cleaned.append(
                {
                    "doc_id": section.get("doc_id"),
                    "document": section.get("document"),
                    "section_id": section.get("section_id"),
                    "section": section.get("section"),
                    "summary": section.get("summary"),
                    "categories": section.get("categories") or [],
                    "start_page": section.get("start_page"),
                    "end_page": section.get("end_page"),
                    "justification": section.get("justification"),
                }
            )
        return cleaned

    @staticmethod
    def _validate_input(attestation: str, sections: list[Any]) -> None:
        if not isinstance(attestation, str) or not attestation.strip():
            raise ValueError("attestation must be a non-empty string")
        if not isinstance(sections, list):
            raise ValueError("sections must be a list")

    async def run_async(
        self,
        attestation: str,
        sections: list[Any],
        compliance_analysis: Any | None = None,
    ) -> dict[str, Any]:
        self._validate_input(attestation, sections)
        cleaned_attestation = attestation.strip()
        cleaned_sections = self._clean_sections(sections)
        compliance_results = await self._compliance_results_async(cleaned_attestation, compliance_analysis)

        if not cleaned_sections:
            return {
                "input": {"attestation": cleaned_attestation, "sections": [], "compliance_analysis": compliance_results},
                "results": {
                    "decision": "insufficient_basis",
                    "principle_assessments": [],
                    "changes": [],
                    "notes": ["No significant sections were supplied as rewrite references."],
                },
            }

        prompt = json.dumps(
            {
                "attestation": cleaned_attestation,
                "sections": cleaned_sections,
                "compliance_analysis": compliance_results,
                "rewrite_criteria": self._rewrite_criteria,
            },
            ensure_ascii=False,
        )
        results = await self.__gpt_agent_planner.run(prompt)
        return {
            "input": {
                "attestation": cleaned_attestation,
                "sections": cleaned_sections,
                "compliance_analysis": compliance_results,
            },
            "results": results,
        }

    def run(
        self,
        attestation: str,
        sections: list[Any],
        compliance_analysis: Any | None = None,
    ) -> dict[str, Any]:
        self._validate_input(attestation, sections)
        cleaned_attestation = attestation.strip()
        cleaned_sections = self._clean_sections(sections)
        compliance_results = self._compliance_results(cleaned_attestation, compliance_analysis)

        if not cleaned_sections:
            return {
                "input": {"attestation": cleaned_attestation, "sections": [], "compliance_analysis": compliance_results},
                "results": {
                    "decision": "insufficient_basis",
                    "principle_assessments": [],
                    "changes": [],
                    "notes": ["No significant sections were supplied as rewrite references."],
                },
            }

        prompt = json.dumps(
            {
                "attestation": cleaned_attestation,
                "sections": cleaned_sections,
                "compliance_analysis": compliance_results,
                "rewrite_criteria": self._rewrite_criteria,
            },
            ensure_ascii=False,
        )
        results = self.__gpt_agent_planner.run_sync(prompt)
        return {
            "input": {
                "attestation": cleaned_attestation,
                "sections": cleaned_sections,
                "compliance_analysis": compliance_results,
            },
            "results": results,
        }
