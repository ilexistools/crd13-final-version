"""Plan controlled attestation rewrite changes from selected section references."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.orchestration.gpt_agent import GPTAgent


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


class AttestationRewriteChangePlanOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: RewriteChangeDecision
    changes: list[AttestationRewriteChange] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class AttestationRewriteChangePlannerTool:
    def __init__(self):
        self.__create_gpts()

    def __create_gpts(self) -> None:
        self.__gpt_agent_planner = GPTAgent(
            agent_id="attestation_rewrite_change_planner",
            output_type=AttestationRewriteChangePlanOutput,
        )

    @staticmethod
    def _clean_sections(sections: list[Any]) -> list[dict[str, Any]]:
        cleaned: list[dict[str, Any]] = []
        for section in sections:
            if not isinstance(section, dict):
                continue
            cleaned.append(
                {
                    "doc_id": section.get("doc_id"),
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

    async def run_async(self, attestation: str, sections: list[Any]) -> dict[str, Any]:
        self._validate_input(attestation, sections)
        cleaned_attestation = attestation.strip()
        cleaned_sections = self._clean_sections(sections)

        if not cleaned_sections:
            return {
                "input": {"attestation": cleaned_attestation, "sections": []},
                "results": {
                    "decision": "insufficient_basis",
                    "changes": [],
                    "notes": ["No significant sections were supplied as rewrite references."],
                },
            }

        prompt = json.dumps(
            {
                "attestation": cleaned_attestation,
                "sections": cleaned_sections,
            },
            ensure_ascii=False,
        )
        results = await self.__gpt_agent_planner.run(prompt)
        return {
            "input": {"attestation": cleaned_attestation, "sections": cleaned_sections},
            "results": results,
        }

    def run(self, attestation: str, sections: list[Any]) -> dict[str, Any]:
        self._validate_input(attestation, sections)
        cleaned_attestation = attestation.strip()
        cleaned_sections = self._clean_sections(sections)

        if not cleaned_sections:
            return {
                "input": {"attestation": cleaned_attestation, "sections": []},
                "results": {
                    "decision": "insufficient_basis",
                    "changes": [],
                    "notes": ["No significant sections were supplied as rewrite references."],
                },
            }

        prompt = json.dumps(
            {
                "attestation": cleaned_attestation,
                "sections": cleaned_sections,
            },
            ensure_ascii=False,
        )
        results = self.__gpt_agent_planner.run_sync(prompt)
        return {
            "input": {"attestation": cleaned_attestation, "sections": cleaned_sections},
            "results": results,
        }
