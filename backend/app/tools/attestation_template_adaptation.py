import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.orchestration.gpt_agent import GPTAgent

UNDEFINED_TEMPLATE_IDS = {"ATT-UND-000", "UND-8f2c3a1b-5d7e-4d2b-9f6a-0b7f3d2b1a9c"}
TOKEN_RE = re.compile(r"[a-z0-9]+(?:[-'][a-z0-9]+)?")
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
    "has", "have", "in", "is", "it", "of", "or", "that", "the", "this", "to",
    "was", "were", "with",
}


TemplateAdaptationDecision = Literal[
    "adapted",
    "not_adapted_review_required",
]

ComponentStatus = Literal[
    "filled",
    "omitted_optional",
    "missing_required",
    "not_applicable",
]


class SelectedTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    modality: Optional[str] = None
    communicative_function: Optional[str] = None
    representative_example: Optional[str] = None
    structural_template: Optional[str] = None


class ComponentMappingItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    component_name: str
    value: str = ""
    source_text: str = ""
    status: ComponentStatus
    preservation_note: str


class InformationPreservationCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preserves_subject_or_commodity: bool
    preserves_assurance: bool
    preserves_process_or_activity: bool
    preserves_conditions_or_qualifiers: bool
    preserves_limits_or_parameters: bool
    preserves_agent_or_authority: bool
    preserves_reference_standard: bool
    preserves_modality: bool
    preserves_communicative_function: bool
    does_not_add_unsupported_information: bool
    does_not_remove_essential_information: bool
    does_not_strengthen_claim: bool
    does_not_weaken_claim: bool


class UnmappedInformation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    reason: str
    essential: bool


class AlternativeTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    fit_score: float = Field(ge=0.0, le=1.0)
    reason: str


class AttestationTemplateAdapterOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input_attestation: str

    template_adaptation_decision: TemplateAdaptationDecision

    selected_template: SelectedTemplate

    adapted_attestation: Optional[str] = None

    component_mapping: List[ComponentMappingItem] = Field(default_factory=list)

    template_selection_rationale: str

    information_preservation_check: InformationPreservationCheck

    unmapped_information: List[UnmappedInformation] = Field(
        default_factory=list
    )

    alternative_templates: List[AlternativeTemplate] = Field(
        default_factory=list
    )

    confidence: float = Field(ge=0.0, le=1.0)

    unresolved_risks: List[str] = Field(default_factory=list)

    final_assessment: str


class AttestationTemplateAdapterTool:
     
    def __init__(self):
        self.__create_gpts()

    def __create_gpts(self):
        self.__gpt_agent_adapter = GPTAgent(
            agent_id="attestation_template_adapter",
            output_type=AttestationTemplateAdapterOutput,
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_templates() -> list[dict[str, Any]]:
        current = Path(__file__).resolve()
        candidate_paths = [
            current.parents[3] / "new-frontend" / "src" / "assets" / "templates" / "templates.json",
            current.parents[1] / "assets" / "resources" / "attestation_templates.json",
        ]

        for path in candidate_paths:
            if not path.exists():
                continue
            root = json.loads(path.read_text(encoding="utf-8"))
            items = root.get("items", [])
            if items:
                return [item for item in items if not AttestationTemplateAdapterTool._is_undefined_template(item)]

        raise FileNotFoundError("No attestation template catalog was found.")

    @staticmethod
    def _is_undefined_template(template: dict[str, Any]) -> bool:
        template_id = str(template.get("id") or "")
        category = str(template.get("category") or "").lower()
        modality = str(template.get("modality") or "").lower()
        function = str(template.get("communicative_function") or "").lower()
        return (
            template_id in UNDEFINED_TEMPLATE_IDS
            or (category == "undefined" and modality == "undefined" and function == "undefined")
        )

    @staticmethod
    def _tokens(text: str) -> set[str]:
        return {token for token in TOKEN_RE.findall(text.lower()) if token not in STOPWORDS and len(token) > 1}

    @staticmethod
    def _template_text(template: dict[str, Any]) -> str:
        component_text = []
        components = template.get("components") or {}
        if isinstance(components, dict):
            for key, component in components.items():
                if not isinstance(component, dict):
                    continue
                component_text.extend(
                    [
                        str(key),
                        str(component.get("label") or ""),
                        str(component.get("description") or ""),
                        " ".join(str(example) for example in component.get("examples") or []),
                    ]
                )
        return " ".join(
            [
                str(template.get("category") or ""),
                str(template.get("modality") or ""),
                str(template.get("regulatory_modality") or ""),
                str(template.get("attestation_function") or ""),
                str(template.get("communicative_function") or ""),
                str(template.get("representative_example") or ""),
                str(template.get("structural_template") or ""),
                *component_text,
            ]
        )

    @staticmethod
    def _heuristic_scores(attestation: str) -> dict[str, float]:
        text = attestation.lower()
        scores: dict[str, float] = {}

        if re.search(r"\b(comply|complies|compliant|conform|conforms|conformity)\b", text):
            scores["compliance"] = scores.get("compliance", 0) + 0.85
        if re.search(r"\b(standard|requirement|criteria|criterion|specification|regulation|codex|maximum residue limit|mrl)\b", text):
            scores["compliance"] = scores.get("compliance", 0) + 0.25
            scores["state"] = scores.get("state", 0) + 0.08
        if re.search(r"\b(free from|absence|absent|no harmful|does not contain|do not contain|contains no|not contain)\b", text):
            scores["absence"] = scores.get("absence", 0) + 0.75
            scores["prohibited"] = scores.get("prohibited", 0) + 0.25
        if re.search(r"\b(not exceed|does not exceed|do not exceed|maximum|minimum|limit|threshold|mg/kg|ppm|%|percent|not more than|not less than|below|above)\b", text):
            scores["limit"] = scores.get("limit", 0) + 0.5
        if re.search(r"\b(inspected|tested|treated|processed|manufactured|implemented|approved|audited|pasteuri[sz]ed|subjected|handled|stored|packaged)\b", text):
            scores["action"] = scores.get("action", 0) + 0.35
        if re.search(r"\b(is|are|was|were)\b.+\b(packaged|stored|labelled|labeled|fit|safe|acceptable|within|approved)\b", text):
            scores["state"] = scores.get("state", 0) + 0.25
        if re.search(r"\b(authori[sz]ed|permitted|approved for use|allowed for use)\b", text):
            scores["authorized"] = scores.get("authorized", 0) + 0.5
        if re.search(r"\b(only when|only if|provided that|under the condition|conditions are met)\b", text):
            scores["conditional"] = scores.get("conditional", 0) + 0.45
        if re.search(r"^\s*(if|when|where)\b|\b(if|when|where) required\b", text):
            scores["context"] = scores.get("context", 0) + 0.35

        return scores

    @staticmethod
    def _function_boost(template: dict[str, Any], heuristics: dict[str, float]) -> float:
        searchable = " ".join(
            [
                str(template.get("id") or ""),
                str(template.get("category") or ""),
                str(template.get("communicative_function") or ""),
                str(template.get("attestation_function") or ""),
                str(template.get("structural_template") or ""),
            ]
        ).lower()
        boost = 0.0
        mapping = {
            "compliance": ("compliance confirmed", "comply/complies"),
            "state": ("state or action achieved", "state achieved", "within"),
            "action": ("state or action achieved", "action performed", "responsible action", "inspected/monitored/tested"),
            "absence": ("undesirable condition absent", "free from"),
            "prohibited": ("prohibited", "does/do not contain", "not been"),
            "limit": ("limit", "quantitative", "threshold", "tolerance", "does not exceed"),
            "authorized": ("authorized use", "authorized for use"),
            "conditional": ("conditional", "used only when"),
            "context": ("contextual", "when/where/if"),
        }
        for key, needles in mapping.items():
            if key not in heuristics:
                continue
            if any(needle in searchable for needle in needles):
                boost += heuristics[key]
        return boost

    def _rank_templates(self, attestation: str, limit: int = 8) -> list[dict[str, Any]]:
        attestation_tokens = self._tokens(attestation)
        heuristics = self._heuristic_scores(attestation)
        ranked = []

        for template in self._load_templates():
            template_tokens = self._tokens(self._template_text(template))
            lexical_score = 0.0
            if attestation_tokens and template_tokens:
                lexical_score = len(attestation_tokens & template_tokens) / len(attestation_tokens | template_tokens)

            score = lexical_score + self._function_boost(template, heuristics)
            score += self._selection_adjustment(attestation, template)
            ranked.append((score, template))

        ranked.sort(key=lambda item: item[0], reverse=True)
        return [
            {
                **template,
                "_fit_score": round(min(max(score, 0.0), 1.0), 4),
            }
            for score, template in ranked[:limit]
        ]

    def get_template(self, template_id: str) -> dict[str, Any] | None:
        return next(
            (template for template in self._load_templates() if str(template.get("id")) == template_id),
            None,
        )

    @staticmethod
    def _selection_adjustment(attestation: str, template: dict[str, Any]) -> float:
        text = attestation.lower()
        template_id = str(template.get("id") or "")
        function = str(template.get("communicative_function") or template.get("attestation_function") or "").lower()
        adjustment = 0.0

        if re.search(r"\b(comply|complies|compliant|conform|conforms|conformity)\b", text):
            adjustment += 0.45 if function == "compliance confirmed" else -0.25

        if "free from" in text:
            adjustment += 0.5 if function == "undesirable condition absent" else -0.25

        if re.search(r"\b(does not contain|do not contain|contains no|not contain)\b", text):
            adjustment += 0.35 if "substance" in function or "excess" in function else -0.15

        if re.search(r"\b(implemented|inspected|tested|treated|processed|manufactured|pasteuri[sz]ed|subjected)\b", text):
            if function in {"state or action achieved", "inspection, testing, or monitoring confirmed", "responsible action performed"}:
                adjustment += 0.35
            if template_id.startswith("ATT-CND-") and not re.search(r"\b(if|when|where|only when|unless|provided that)\b", text):
                adjustment -= 0.25

        return adjustment

    @staticmethod
    def _to_dict(value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return value
        if hasattr(value, "model_dump"):
            return value.model_dump()
        if hasattr(value, "dict"):
            return value.dict()
        return {}

    @staticmethod
    def _component_list(template: dict[str, Any]) -> list[dict[str, Any]]:
        components = template.get("components") or {}
        if not isinstance(components, dict):
            return []
        output = []
        for key, component in components.items():
            if not isinstance(component, dict):
                continue
            output.append(
                {
                    "name": str(component.get("label") or key),
                    "required": bool(component.get("required")),
                    "description": str(component.get("description") or ""),
                    "examples": component.get("examples") or [],
                }
            )
        return output

    @staticmethod
    def _selected_template_payload(template: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": template.get("id"),
            "type": template.get("type", "default"),
            "category": template.get("category"),
            "modality": template.get("modality"),
            "communicative_function": template.get("communicative_function") or template.get("attestation_function"),
            "representative_example": template.get("representative_example"),
            "structural_template": template.get("structural_template"),
            "components": template.get("components") or {},
        }

    def _fallback_output(self, attestation: str, candidates: list[dict[str, Any]], reason: str) -> dict[str, Any]:
        template = candidates[0]
        components = self._component_list(template)
        mapping = [
            {
                "component_name": component["name"],
                "value": attestation if component["required"] and index == 0 else "",
                "source_text": attestation if component["required"] and index == 0 else "",
                "status": "filled" if component["required"] and index == 0 else ("missing_required" if component["required"] else "omitted_optional"),
                "preservation_note": (
                    "Best-effort fallback mapping from the full attestation text."
                    if component["required"] and index == 0
                    else "No reliable automatic value was identified."
                ),
            }
            for index, component in enumerate(components)
        ]
        return {
            "input_attestation": attestation,
            "template_adaptation_decision": "adapted",
            "selected_template": self._selected_template_payload(template),
            "adapted_attestation": attestation,
            "component_mapping": mapping,
            "template_selection_rationale": reason,
            "information_preservation_check": {
                "preserves_subject_or_commodity": True,
                "preserves_assurance": True,
                "preserves_process_or_activity": True,
                "preserves_conditions_or_qualifiers": True,
                "preserves_limits_or_parameters": True,
                "preserves_agent_or_authority": True,
                "preserves_reference_standard": True,
                "preserves_modality": True,
                "preserves_communicative_function": True,
                "does_not_add_unsupported_information": True,
                "does_not_remove_essential_information": True,
                "does_not_strengthen_claim": True,
                "does_not_weaken_claim": True,
            },
            "unmapped_information": [],
            "alternative_templates": [
                {
                    "id": candidate.get("id"),
                    "fit_score": float(candidate.get("_fit_score", 0.0)),
                    "reason": "Deterministic catalog ranking candidate.",
                }
                for candidate in candidates[1:4]
            ],
            "confidence": float(template.get("_fit_score", 0.0)),
            "unresolved_risks": ["Template selected by deterministic fallback; user review is recommended."],
            "final_assessment": "Closest available template was selected as a suggestion for user review.",
        }

    def _postprocess_result(self, attestation: str, raw_result: Any, candidates: list[dict[str, Any]]) -> dict[str, Any]:
        result = self._to_dict(raw_result)
        selected = self._to_dict(result.get("selected_template"))
        selected_id = str(selected.get("id") or "")
        valid_ids = {str(candidate.get("id")) for candidate in candidates}

        if selected_id in UNDEFINED_TEMPLATE_IDS or selected_id not in valid_ids:
            return self._fallback_output(
                attestation,
                candidates,
                "The model did not return a valid known template, so the closest catalog template was selected by deterministic ranking.",
            )

        selected_template = next(candidate for candidate in candidates if str(candidate.get("id")) == selected_id)
        result["selected_template"] = self._selected_template_payload(selected_template)
        result["input_attestation"] = result.get("input_attestation") or attestation
        result["adapted_attestation"] = result.get("adapted_attestation") or attestation
        result["template_adaptation_decision"] = "adapted"
        result["alternative_templates"] = [
            {
                "id": candidate.get("id"),
                "fit_score": float(candidate.get("_fit_score", 0.0)),
                "reason": "Deterministic catalog ranking candidate.",
            }
            for candidate in candidates
            if str(candidate.get("id")) != selected_id
        ][:3]
        return result
    
    async def run_async(self, attestation: str) -> dict:
        candidates = self._rank_templates(attestation)
        prompt = json.dumps(
            {
                "attestation_sentence": attestation,
                "candidate_templates": candidates,
                "selection_instruction": (
                    "Choose the closest candidate template. Do not choose an undefined template. "
                    "If none is perfect, still return the closest candidate as a suggestion and identify review risks."
                ),
            },
            ensure_ascii=False,
        )
        raw_results = await self.__gpt_agent_adapter.run(prompt)
        results = self._postprocess_result(attestation, raw_results, candidates)
        return {"input": {"attestation": attestation}, "results": results}

    async def run_with_template_async(self, attestation: str, template_id: str) -> dict:
        template = self.get_template(template_id)
        if template is None:
            raise ValueError(f"Unknown attestation template: {template_id}")

        candidate = {**template, "_fit_score": 1.0}
        prompt = json.dumps(
            {
                "attestation_sentence": attestation,
                "candidate_templates": [candidate],
                "selection_instruction": (
                    "Use the requested template and adapt the attestation to its structural pattern. "
                    "Preserve every supported fact, qualifier, limit, modality, and communicative function. "
                    "Do not invent missing information. Return a review-required result if safe adaptation is impossible."
                ),
                "requested_template_id": template_id,
            },
            ensure_ascii=False,
        )
        raw_results = await self.__gpt_agent_adapter.run(prompt)
        results = self._postprocess_result(attestation, raw_results, [candidate])
        return {"input": {"attestation": attestation, "template_id": template_id}, "results": results}

    def run(self, attestation: str) -> dict:
        candidates = self._rank_templates(attestation)
        prompt = json.dumps(
            {
                "attestation_sentence": attestation,
                "candidate_templates": candidates,
                "selection_instruction": (
                    "Choose the closest candidate template. Do not choose an undefined template. "
                    "If none is perfect, still return the closest candidate as a suggestion and identify review risks."
                ),
            },
            ensure_ascii=False,
        )
        raw_results = self.__gpt_agent_adapter.run_sync(prompt)
        results = self._postprocess_result(attestation, raw_results, candidates)
        return {"input": {"attestation": attestation}, "results": results}
