"""Apply a supplied change plan to rewrite an attestation."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.orchestration.gpt_agent import GPTAgent
from app.tools.compliance_analysis import ComplianceAnalysisTool


AttestationChangeApplicationDecision = Literal[
    "rewritten",
    "unchanged",
    "insufficient_basis",
    "rejected_due_to_regression",
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
    candidate_attestation: str | None = None
    applied_changes: list[AppliedAttestationChange] = Field(default_factory=list)
    post_rewrite_compliance: dict[str, Any] | None = None
    regression_check: dict[str, Any] | None = None
    notes: list[str] = Field(default_factory=list)


class AttestationChangeApplierTool:
    def __init__(self):
        self._compliance_analyser: ComplianceAnalysisTool | None = None
        self.__create_gpts()

    def __create_gpts(self) -> None:
        self.__gpt_agent_applier = GPTAgent(
            agent_id="attestation_change_applier",
            output_type=AttestationChangeApplicationOutput,
        )

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
    def _principle_statuses(compliance_results: dict[str, Any]) -> dict[str, str]:
        statuses: dict[str, str] = {}
        assessments = compliance_results.get("principle_assessments") or []
        if not isinstance(assessments, list):
            return statuses

        for assessment in assessments:
            if not isinstance(assessment, dict):
                continue
            principle = str(assessment.get("principle") or "").strip()
            status = str(assessment.get("compliance") or "").strip()
            if principle and status:
                statuses[principle] = status
        return statuses

    @classmethod
    def _regression_check(
        cls,
        original_compliance: dict[str, Any],
        candidate_compliance: dict[str, Any],
    ) -> dict[str, Any]:
        original_statuses = cls._principle_statuses(original_compliance)
        candidate_statuses = cls._principle_statuses(candidate_compliance)
        regressed = [
            principle
            for principle, original_status in original_statuses.items()
            if original_status == "Compliant"
            and candidate_statuses.get(principle)
            and candidate_statuses[principle] != "Compliant"
        ]

        return {
            "passed": not regressed,
            "regressed_principles": regressed,
            "notes": [
                f"{principle} changed from Compliant to {candidate_statuses[principle]}."
                for principle in regressed
            ],
        }

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
                    "guideline_principles": change.get("guideline_principles") or [],
                }
            )
        return cleaned

    async def run_async(
        self,
        attestation: str,
        changes: list[Any],
        compliance_analysis: Any | None = None,
    ) -> dict[str, Any]:
        self._validate_input(attestation, changes)
        cleaned_attestation = attestation.strip()
        cleaned_changes = self._clean_changes(changes)

        if not cleaned_changes:
            return {
                "input": {"attestation": cleaned_attestation, "changes": [], "compliance_analysis": compliance_analysis},
                "results": {
                    "decision": "unchanged",
                    "rewritten_attestation": cleaned_attestation,
                    "candidate_attestation": None,
                    "applied_changes": [],
                    "post_rewrite_compliance": None,
                    "regression_check": None,
                    "notes": ["No changes were supplied."],
                },
            }

        prompt = json.dumps(
            {
                "attestation": cleaned_attestation,
                "changes": cleaned_changes,
                "compliance_analysis": compliance_analysis,
            },
            ensure_ascii=False,
        )
        results = await self.__gpt_agent_applier.run(prompt)
        result_payload = self._as_dict(results)
        if result_payload.get("decision") == "rewritten":
            original_compliance = await self._compliance_results_async(cleaned_attestation, compliance_analysis)
            candidate_attestation = str(result_payload.get("rewritten_attestation") or cleaned_attestation).strip()
            candidate_compliance = await self._compliance_results_async(candidate_attestation, None)
            regression_check = self._regression_check(original_compliance, candidate_compliance)

            result_payload["post_rewrite_compliance"] = candidate_compliance
            result_payload["regression_check"] = regression_check

            if not regression_check["passed"]:
                notes = list(result_payload.get("notes") or [])
                notes.append("Rewrite rejected because it would make one or more previously compliant CRD13 principles non-compliant or partially compliant.")
                result_payload = {
                    **result_payload,
                    "decision": "rejected_due_to_regression",
                    "candidate_attestation": candidate_attestation,
                    "rewritten_attestation": cleaned_attestation,
                    "applied_changes": [],
                    "notes": notes,
                }

        return {
            "input": {
                "attestation": cleaned_attestation,
                "changes": cleaned_changes,
                "compliance_analysis": compliance_analysis,
            },
            "results": result_payload,
        }

    def run(
        self,
        attestation: str,
        changes: list[Any],
        compliance_analysis: Any | None = None,
    ) -> dict[str, Any]:
        self._validate_input(attestation, changes)
        cleaned_attestation = attestation.strip()
        cleaned_changes = self._clean_changes(changes)

        if not cleaned_changes:
            return {
                "input": {"attestation": cleaned_attestation, "changes": [], "compliance_analysis": compliance_analysis},
                "results": {
                    "decision": "unchanged",
                    "rewritten_attestation": cleaned_attestation,
                    "candidate_attestation": None,
                    "applied_changes": [],
                    "post_rewrite_compliance": None,
                    "regression_check": None,
                    "notes": ["No changes were supplied."],
                },
            }

        prompt = json.dumps(
            {
                "attestation": cleaned_attestation,
                "changes": cleaned_changes,
                "compliance_analysis": compliance_analysis,
            },
            ensure_ascii=False,
        )
        results = self.__gpt_agent_applier.run_sync(prompt)
        result_payload = self._as_dict(results)
        if result_payload.get("decision") == "rewritten":
            original_compliance = self._compliance_results(cleaned_attestation, compliance_analysis)
            candidate_attestation = str(result_payload.get("rewritten_attestation") or cleaned_attestation).strip()
            candidate_compliance = self._compliance_results(candidate_attestation, None)
            regression_check = self._regression_check(original_compliance, candidate_compliance)

            result_payload["post_rewrite_compliance"] = candidate_compliance
            result_payload["regression_check"] = regression_check

            if not regression_check["passed"]:
                notes = list(result_payload.get("notes") or [])
                notes.append("Rewrite rejected because it would make one or more previously compliant CRD13 principles non-compliant or partially compliant.")
                result_payload = {
                    **result_payload,
                    "decision": "rejected_due_to_regression",
                    "candidate_attestation": candidate_attestation,
                    "rewritten_attestation": cleaned_attestation,
                    "applied_changes": [],
                    "notes": notes,
                }

        return {
            "input": {
                "attestation": cleaned_attestation,
                "changes": cleaned_changes,
                "compliance_analysis": compliance_analysis,
            },
            "results": result_payload,
        }
