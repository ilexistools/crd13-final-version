import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.orchestration.gpt_agent import GPTAgent


AVAILABLE_AGENT_TOOLS = [
    "analyze_compliance",
    "unitize",
    "generate_triples",
    "analyze_attestation_sections",
    "plan_attestation_rewrite_changes",
    "apply_attestation_changes",
    "suggest_attestation_correction",
]


class UnitEditPlanOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(..., description="One short sentence describing exactly what will be done.")
    steps: list[str] = Field(default_factory=list, description="At most three short user-facing action phrases.")
    tools: list[str] = Field(default_factory=list, description="Available CRD13 tools/APIs the agent should use during execution.")
    expected_result: str = Field(..., description="One short sentence describing the expected result after approval.")
    risks: list[str] = Field(default_factory=list, description="Only material risks or blockers; empty when none.")
    requires_clarification: bool = Field(default=False, description="Whether execution should wait for a clearer user request.")


class UnitEditReplacement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    unit: int = Field(..., description="Original 1-based unit number.")
    changed: bool = Field(..., description="Whether this unit should change.")
    replacement_units: list[str] = Field(default_factory=list, description="Replacement units for the original selected unit.")
    notes: list[str] = Field(default_factory=list, description="Brief execution notes for this unit.")


class UnitEditExecutionOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(..., description="Short summary of execution.")
    updates: list[UnitEditReplacement] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class UnitEditAgentTool:
    def __init__(
        self,
        *,
        compliance_analyser: Any,
        unitizer: Any,
        triple_generator: Any,
        attestation_section_analyser: Any,
        attestation_rewrite_change_planner: Any,
        attestation_change_applier: Any,
        compliance_corrector: Any,
    ):
        self.compliance_analyser = compliance_analyser
        self.unitizer = unitizer
        self.triple_generator = triple_generator
        self.attestation_section_analyser = attestation_section_analyser
        self.attestation_rewrite_change_planner = attestation_rewrite_change_planner
        self.attestation_change_applier = attestation_change_applier
        self.compliance_corrector = compliance_corrector
        self.planner = GPTAgent(agent_id="unit_edit_agent_planner", output_type=UnitEditPlanOutput)
        self.executor = GPTAgent(agent_id="unit_edit_agent_executor", output_type=UnitEditExecutionOutput)

    async def plan_async(
        self,
        *,
        request: str,
        units: list[dict[str, Any]],
        commodities: list[str] | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        prompt = {
            "task": "Plan selected-unit edits. Do not execute.",
            "user_request": request,
            "selected_units": units,
            "commodities": commodities or [],
            "available_tools": AVAILABLE_AGENT_TOOLS,
            "editor_context": context or {},
        }
        result = await self.planner.run(json.dumps(prompt, ensure_ascii=False))
        return self._dump(result)

    async def execute_async(
        self,
        *,
        request: str,
        plan: dict[str, Any],
        units: list[dict[str, Any]],
        commodities: list[str] | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        tool_names = self._clean_tool_names(plan.get("tools", []))
        tool_outputs = await self._collect_tool_outputs(tool_names, units, commodities or [], context or {})
        prompt = {
            "task": "Execute the approved selected-unit edit plan.",
            "user_request": request,
            "approved_plan": plan,
            "selected_units": units,
            "commodities": commodities or [],
            "available_tools_used": tool_names,
            "tool_outputs": tool_outputs,
            "editor_context": context or {},
        }
        result = await self.executor.run(json.dumps(prompt, ensure_ascii=False))
        return self._normalize_execution(self._dump(result), units)

    async def _collect_tool_outputs(
        self,
        tool_names: list[str],
        units: list[dict[str, Any]],
        commodities: list[str],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        outputs: dict[str, Any] = {}
        unit_entries = [
            {
                "unit": self._unit_number(unit, index),
                "text": str(unit.get("text") or ""),
            }
            for index, unit in enumerate(units)
        ]

        if "analyze_compliance" in tool_names or "suggest_attestation_correction" in tool_names:
            outputs["analyze_compliance"] = []
            for item in unit_entries:
                analysis = self._find_context_item(context.get("unit_analyses"), item["unit"])
                if analysis is None:
                    analysis = await self.compliance_analyser.run_async(item["text"])
                outputs["analyze_compliance"].append({"unit": item["unit"], "output": self._dump(analysis)})

        if "unitize" in tool_names:
            outputs["unitize"] = []
            for item in unit_entries:
                outputs["unitize"].append({
                    "unit": item["unit"],
                    "output": self._dump(await self.unitizer.run_async(item["text"])),
                })

        if "generate_triples" in tool_names:
            outputs["generate_triples"] = []
            for item in unit_entries:
                triples = self._find_context_item(context.get("unit_triples"), item["unit"])
                if triples is None:
                    triples = await self.triple_generator.run_async(item["text"])
                outputs["generate_triples"].append({"unit": item["unit"], "output": self._dump(triples)})

        if "analyze_attestation_sections" in tool_names and commodities:
            outputs["analyze_attestation_sections"] = []
            for item in unit_entries:
                sections = await self.attestation_section_analyser.run_async(item["text"], commodities)
                outputs["analyze_attestation_sections"].append({"unit": item["unit"], "output": self._dump(sections)})

        if "plan_attestation_rewrite_changes" in tool_names and outputs.get("analyze_attestation_sections"):
            outputs["plan_attestation_rewrite_changes"] = []
            for section_payload in outputs["analyze_attestation_sections"]:
                unit = int(section_payload["unit"])
                text = next((item["text"] for item in unit_entries if item["unit"] == unit), "")
                sections = self._unwrap_results(section_payload["output"])
                if not isinstance(sections, list):
                    sections = []
                rewrite_plan = await self.attestation_rewrite_change_planner.run_async(text, sections)
                outputs["plan_attestation_rewrite_changes"].append({"unit": unit, "output": self._dump(rewrite_plan)})

        if "suggest_attestation_correction" in tool_names:
            outputs["suggest_attestation_correction"] = []
            analyses = outputs.get("analyze_compliance", [])
            for item in unit_entries:
                analysis = next((payload.get("output") for payload in analyses if payload.get("unit") == item["unit"]), {})
                analysis_results = self._analysis_results_payload(analysis)
                allowed_principles = [
                    str(assessment.get("principle"))
                    for assessment in analysis_results.get("principle_assessments", [])
                    if isinstance(assessment, dict)
                    and str(assessment.get("compliance") or "") in {"Partially Compliant", "Non-Compliant"}
                    and assessment.get("principle")
                ]
                correction = await self.compliance_corrector.run_async(item["text"], analysis_results, allowed_principles)
                outputs["suggest_attestation_correction"].append({"unit": item["unit"], "output": self._dump(correction)})

        return outputs

    def _normalize_execution(self, result: dict[str, Any], units: list[dict[str, Any]]) -> dict[str, Any]:
        updates = result.get("updates")
        if not isinstance(updates, list):
            updates = []

        valid_units = {self._unit_number(unit, index): str(unit.get("text") or "") for index, unit in enumerate(units)}
        normalized_updates: list[dict[str, Any]] = []
        for update in updates:
            if not isinstance(update, dict):
                continue
            unit_number = int(update.get("unit") or 0)
            if unit_number not in valid_units:
                continue
            replacement_units = [
                str(item).strip()
                for item in update.get("replacement_units", [])
                if str(item).strip()
            ]
            if not replacement_units:
                replacement_units = [valid_units[unit_number]]
            changed = bool(update.get("changed")) and replacement_units != [valid_units[unit_number]]
            normalized_updates.append({
                "unit": unit_number,
                "changed": changed,
                "replacement_units": replacement_units,
                "notes": [str(note) for note in update.get("notes", []) if str(note).strip()],
            })

        result["updates"] = normalized_updates
        result.setdefault("summary", "Agent execution finished.")
        result.setdefault("notes", [])
        return result

    @staticmethod
    def _clean_tool_names(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item) for item in value if str(item) in AVAILABLE_AGENT_TOOLS]

    @staticmethod
    def _dump(value: Any) -> Any:
        if hasattr(value, "model_dump"):
            return value.model_dump()
        if hasattr(value, "dict"):
            return value.dict()
        return value

    @staticmethod
    def _unit_number(unit: dict[str, Any], fallback_index: int) -> int:
        try:
            return int(unit.get("unit", fallback_index + 1))
        except (TypeError, ValueError):
            return fallback_index + 1

    @staticmethod
    def _find_context_item(items: Any, unit_number: int) -> Any:
        if not isinstance(items, list):
            return None
        for item in items:
            if isinstance(item, dict) and item.get("unit") == unit_number:
                return item.get("analysis") or item.get("triples") or item
        return None

    @staticmethod
    def _unwrap_results(value: Any) -> Any:
        if isinstance(value, dict):
            if "results" in value:
                return value["results"]
            output = value.get("output")
            if isinstance(output, dict) and "results" in output:
                return output["results"]
        return value

    @classmethod
    def _analysis_results_payload(cls, analysis: Any) -> dict[str, Any]:
        payload = cls._dump(analysis)
        if not isinstance(payload, dict):
            return {}
        output = payload.get("output")
        if isinstance(output, dict) and isinstance(output.get("results"), dict):
            return output["results"]
        results = payload.get("results")
        if isinstance(results, dict):
            return results
        return payload
