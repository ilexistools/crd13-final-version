"""Apply a supplied change plan to rewrite an attestation."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.orchestration.gpt_agent import GPTAgent


AttestationChangeApplicationDecision = Literal[
    "rewritten",
    "unchanged",
    "insufficient_basis",
]


class AppliedAttestationChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    change_type: str
    target_fragment: str
    applied_change: str


class AttestationChangeApplicationOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: AttestationChangeApplicationDecision
    rewritten_attestation: str
    applied_changes: list[AppliedAttestationChange] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class AttestationChangeApplierTool:
    def __init__(self):
        self.__create_gpts()

    def __create_gpts(self) -> None:
        self.__gpt_agent_applier = GPTAgent(
            agent_id="attestation_change_applier",
            output_type=AttestationChangeApplicationOutput,
        )

    @staticmethod
    def _validate_input(attestation: str, changes: list[Any]) -> None:
        if not isinstance(attestation, str) or not attestation.strip():
            raise ValueError("attestation must be a non-empty string")
        if not isinstance(changes, list):
            raise ValueError("changes must be a list")

    @staticmethod
    def _clean_changes(changes: list[Any]) -> list[dict[str, Any]]:
        cleaned: list[dict[str, Any]] = []
        for change in changes:
            if not isinstance(change, dict):
                continue
            cleaned.append(
                {
                    "change_type": change.get("change_type"),
                    "target_fragment": change.get("target_fragment"),
                    "suggested_change": change.get("suggested_change"),
                    "rationale": change.get("rationale"),
                    "supporting_sections": change.get("supporting_sections") or [],
                }
            )
        return cleaned

    async def run_async(self, attestation: str, changes: list[Any]) -> dict[str, Any]:
        self._validate_input(attestation, changes)
        cleaned_attestation = attestation.strip()
        cleaned_changes = self._clean_changes(changes)

        if not cleaned_changes:
            return {
                "input": {"attestation": cleaned_attestation, "changes": []},
                "results": {
                    "decision": "unchanged",
                    "rewritten_attestation": cleaned_attestation,
                    "applied_changes": [],
                    "notes": ["No changes were supplied."],
                },
            }

        prompt = json.dumps(
            {
                "attestation": cleaned_attestation,
                "changes": cleaned_changes,
            },
            ensure_ascii=False,
        )
        results = await self.__gpt_agent_applier.run(prompt)
        return {
            "input": {"attestation": cleaned_attestation, "changes": cleaned_changes},
            "results": results,
        }

    def run(self, attestation: str, changes: list[Any]) -> dict[str, Any]:
        self._validate_input(attestation, changes)
        cleaned_attestation = attestation.strip()
        cleaned_changes = self._clean_changes(changes)

        if not cleaned_changes:
            return {
                "input": {"attestation": cleaned_attestation, "changes": []},
                "results": {
                    "decision": "unchanged",
                    "rewritten_attestation": cleaned_attestation,
                    "applied_changes": [],
                    "notes": ["No changes were supplied."],
                },
            }

        prompt = json.dumps(
            {
                "attestation": cleaned_attestation,
                "changes": cleaned_changes,
            },
            ensure_ascii=False,
        )
        results = self.__gpt_agent_applier.run_sync(prompt)
        return {
            "input": {"attestation": cleaned_attestation, "changes": cleaned_changes},
            "results": results,
        }
