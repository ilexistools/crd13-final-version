import asyncio
import json
import re

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Any
from pydantic import BaseModel
from PyPDF2 import PdfReader
from app.tools.commodities_identification import CommoditiesIdentifierTool
from app.tools.unitization import UnitizationTool
from app.tools.provisions_search import ProvisionsSearchTool
from app.tools.attestation_section_search import AttestationSectionSearchTool
from app.tools.triple_generation import TripleGenerationTool
from app.tools.key_elements_extraction import KeyElementsExtractionTool
from app.tools.attestation_analyser import AttestationAnalyserTool
from app.tools.attestation_section_analyser import AttestationSectionAnalyserTool
from app.tools.attestation_rewriter import AttestationRewriteTool
from app.tools.attestation_rewrite_change_planner import AttestationRewriteChangePlannerTool
from app.tools.attestation_change_applier import AttestationChangeApplierTool
from app.tools.attestation_template_adaptation import AttestationTemplateAdapterTool
from app.tools.compliance_analysis import ComplianceAnalysisTool
from app.tools.compliance_correction import ComplianceCorrectionTool
from app.tools.principle_workflow_analysis import PrincipleWorkflowAnalysisTool
from app.tools.unit_edit_agent import UnitEditAgentTool


unitizer = UnitizationTool()
commodities_identifier = CommoditiesIdentifierTool()
provisions_search = ProvisionsSearchTool()
attestation_section_search = AttestationSectionSearchTool()
attestation_section_analyser = AttestationSectionAnalyserTool()
triple_generator = TripleGenerationTool()
key_elements_extractor = KeyElementsExtractionTool()
attestation_analyser = AttestationAnalyserTool()
attestation_rewriter = AttestationRewriteTool()
attestation_rewrite_change_planner = AttestationRewriteChangePlannerTool()
attestation_change_applier = AttestationChangeApplierTool()
attestation_template_adapter = AttestationTemplateAdapterTool()
compliance_analyser = ComplianceAnalysisTool()
compliance_corrector = ComplianceCorrectionTool()
principle_workflow_analyser = PrincipleWorkflowAnalysisTool()
unit_edit_agent = UnitEditAgentTool(
    compliance_analyser=compliance_analyser,
    unitizer=unitizer,
    triple_generator=triple_generator,
    attestation_section_analyser=attestation_section_analyser,
    attestation_rewrite_change_planner=attestation_rewrite_change_planner,
    attestation_change_applier=attestation_change_applier,
    compliance_corrector=compliance_corrector,
)


class InputRequest(BaseModel):
    input: dict

class OutputResponse(BaseModel):
    output: Any


app = FastAPI(title="GPT Agents + FastAPI Example")

app.mount(
    "/assets/files",
    StaticFiles(directory="app/assets/files"),
    name="asset_files",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:4200",
        "http://localhost:4200",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

@app.post("/extract_pdf_text")
async def extract_pdf_text(file: UploadFile = File(...)) -> dict[str, Any]:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Only PDF uploads are supported.")

    try:
        reader = PdfReader(file.file)
        pages = [
            {"page": index + 1, "text": page.extract_text() or ""}
            for index, page in enumerate(reader.pages)
        ]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not extract PDF text: {exc}") from exc

    full_text = "\n".join(page["text"] for page in pages if page["text"].strip())
    return {"full_text": full_text, "pages": pages}

@app.post("/identify_commodities", response_model=OutputResponse)
async def identify_commodities(payload: InputRequest) -> OutputResponse:
    result = await commodities_identifier.run_async(payload.input.get("text", ""))
    return OutputResponse(output=result)

@app.post("/unitize", response_model=OutputResponse)
async def unitize_text(payload: InputRequest) -> OutputResponse:
    result = await unitizer.run_async(payload.input.get("text", ""))
    return OutputResponse(output=result)


@app.post("/a1/unitize", response_model=OutputResponse)
async def unitize_attestation_for_a1(payload: InputRequest) -> OutputResponse:
    attestation = payload.input.get("attestation")
    if attestation is None:
        attestation = payload.input.get("text", "")
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(status_code=422, detail="input.attestation must be a non-empty string.")

    unitization, source_analysis = await asyncio.gather(
        unitizer.run_async(attestation),
        compliance_analyser.run_async(attestation),
    )
    raw_units = unitization.get("results", []) if isinstance(unitization, dict) else []
    suggested_units = [
        unit.strip()
        for unit in raw_units
        if isinstance(unit, str) and unit.strip()
    ]
    if not suggested_units:
        suggested_units = [attestation.strip()]

    requires_split = len(suggested_units) > 1
    source_results = _analysis_results_payload(source_analysis)
    source_assessment = next((
        item for item in source_results.get("principle_assessments", [])
        if isinstance(item, dict) and item.get("principle") == "A1"
    ), {})
    suggested_analyses = await asyncio.gather(*[
        compliance_analyser.run_async(unit)
        for unit in suggested_units
    ])
    suggested_unit_assessments = []
    for index, (unit, analysis) in enumerate(zip(suggested_units, suggested_analyses)):
        results = _analysis_results_payload(analysis)
        assessment = next((
            item for item in results.get("principle_assessments", [])
            if isinstance(item, dict) and item.get("principle") == "A1"
        ), {})
        suggested_unit_assessments.append({
            "index": index + 1,
            "text": unit,
            "status": assessment.get("compliance", "Compliant"),
            "assessment": assessment,
        })
    validation_passed = all(
        item["status"] == "Compliant"
        for item in suggested_unit_assessments
    )
    return OutputResponse(output={
        "principle": "A1",
        "status": source_assessment.get("compliance", "Non-Compliant" if requires_split else "Compliant"),
        "assessment": source_assessment,
        "original_attestation": attestation,
        "assurance_count": len(suggested_units),
        "requires_split": requires_split,
        "identified_assurances": [
            {"index": index + 1, "text": unit}
            for index, unit in enumerate(suggested_units)
        ],
        "suggested_units": suggested_units,
        "suggested_unit_assessments": suggested_unit_assessments,
        "context_preservation": {
            "passed": validation_passed,
            "warnings": [] if validation_passed else ["At least one suggested unit still requires A1 review."],
        },
        "explanation": (
            "Multiple semantic assurances were identified and separated into suggested units."
            if requires_split
            else "The attestation represents one semantic assurance and does not require splitting."
        ),
    })

@app.post("/search_provisions", response_model=OutputResponse)
async def search_provisions(payload: InputRequest) -> OutputResponse:
    result = await provisions_search.run_async(payload.input.get("commodities", []), payload.input.get("text", ""))
    return OutputResponse(output=result)    

@app.post("/search_attestation_sections", response_model=OutputResponse)
async def search_attestation_sections(payload: InputRequest) -> OutputResponse:
    provision = payload.input.get("attestation")
    if provision is None:
        provision = payload.input.get("provision", "")
    commodities = payload.input.get("commodities", [])
    if not isinstance(provision, str) or not provision.strip():
        raise HTTPException(
            status_code=422,
            detail="input.attestation must be a non-empty string.",
        )
    if not isinstance(commodities, list):
        raise HTTPException(
            status_code=422,
            detail="input.commodities must be a list of strings.",
        )
    try:
        result = await attestation_section_search.run_async(provision, commodities)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return OutputResponse(output=result)

@app.post("/reference_documents", response_model=OutputResponse)
async def reference_documents(payload: InputRequest) -> OutputResponse:
    commodities = payload.input.get("commodities", [])
    if not isinstance(commodities, list):
        raise HTTPException(
            status_code=422,
            detail="input.commodities must be a list of strings.",
        )
    try:
        doc_ids = attestation_section_search._candidate_doc_ids(commodities)
        documents = attestation_section_search._document_metadata(doc_ids)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return OutputResponse(output={"results": documents})

@app.post("/analyze_attestation_sections", response_model=OutputResponse)
async def analyze_attestation_sections(payload: Any = Body(...)) -> OutputResponse:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=422,
                detail="Request body must be a JSON object or a JSON string containing an object.",
            ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=422,
            detail="Request body must be a JSON object.",
        )

    input_data = payload.get("input", payload)
    if not isinstance(input_data, dict):
        raise HTTPException(
            status_code=422,
            detail="Request body must contain an input object.",
        )

    attestation = input_data.get("attestation", "")
    commodities = input_data.get("commodities", [])
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(
            status_code=422,
            detail="input.attestation must be a non-empty string.",
        )
    if not isinstance(commodities, list):
        raise HTTPException(
            status_code=422,
            detail="input.commodities must be a list of strings.",
        )
    try:
        result = await attestation_section_analyser.run_async(attestation, commodities)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return OutputResponse(output=result)

@app.post("/generate_triples", response_model=OutputResponse)
async def generate_triples(payload: InputRequest) -> OutputResponse:
    result = await triple_generator.run_async(payload.input.get("text", ""))
    return OutputResponse(output=result)

@app.post("/extract_key_elements", response_model=OutputResponse)
async def extract_key_elements(payload: InputRequest) -> OutputResponse:
    attestation = payload.input.get("attestation")
    if attestation is None:
        attestation = payload.input.get("text", "")
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(status_code=422, detail="input.attestation must be a non-empty string.")

    result = await key_elements_extractor.run_async(attestation)
    return OutputResponse(output=result)

@app.post("/analyze_attestation", response_model=OutputResponse)
async def analyze_attestation(payload: InputRequest) -> OutputResponse:
    result = await attestation_analyser.run_async(payload.input.get("attestation", ""), payload.input.get("provisions", []))
    return OutputResponse(output=result)

@app.post("/rewrite_attestation", response_model=OutputResponse)
async def rewrite_attestation_endpoint(payload: InputRequest) -> OutputResponse:
    analysis_result = payload.input.get("analysis_result")
    if analysis_result is None:
        analysis_result = payload.input.get("output")
    if analysis_result is None:
        raise HTTPException(
            status_code=422,
            detail="rewrite_attestation requires input.analysis_result",
        )
    result = await attestation_rewriter.run_async(analysis_result)
    return OutputResponse(output=result)

@app.post("/plan_attestation_rewrite_changes", response_model=OutputResponse)
async def plan_attestation_rewrite_changes(payload: Any = Body(...)) -> OutputResponse:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=422,
                detail="Request body must be a JSON object or a JSON string containing an object.",
            ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=422,
            detail="Request body must be a JSON object.",
        )

    input_data = payload.get("input", payload)
    if not isinstance(input_data, dict):
        raise HTTPException(
            status_code=422,
            detail="Request body must contain an input object.",
        )

    attestation = input_data.get("attestation", "")
    compliance_analysis = input_data.get("compliance_analysis")
    sections = input_data.get("sections")
    if sections is None:
        sections = input_data.get("significant_sections", [])

    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(
            status_code=422,
            detail="input.attestation must be a non-empty string.",
        )
    if not isinstance(sections, list):
        raise HTTPException(
            status_code=422,
            detail="input.sections must be a list.",
        )

    try:
        result = await attestation_rewrite_change_planner.run_async(
            attestation,
            sections,
            compliance_analysis=compliance_analysis,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return OutputResponse(output=result)

@app.post("/apply_attestation_changes", response_model=OutputResponse)
async def apply_attestation_changes(payload: Any = Body(...)) -> OutputResponse:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=422,
                detail="Request body must be a JSON object or a JSON string containing an object.",
            ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=422,
            detail="Request body must be a JSON object.",
        )

    input_data = payload.get("input", payload)
    if not isinstance(input_data, dict):
        raise HTTPException(
            status_code=422,
            detail="Request body must contain an input object.",
        )

    attestation = input_data.get("attestation", "")
    changes = input_data.get("changes", [])
    compliance_analysis = input_data.get("compliance_analysis")
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(
            status_code=422,
            detail="input.attestation must be a non-empty string.",
        )
    if not isinstance(changes, list):
        raise HTTPException(
            status_code=422,
            detail="input.changes must be a list.",
        )

    try:
        result = await attestation_change_applier.run_async(
            attestation,
            changes,
            compliance_analysis=compliance_analysis,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return OutputResponse(output=result)

@app.post("/adapt_attestation_template", response_model=OutputResponse)
async def adapt_attestation_template(payload: InputRequest) -> OutputResponse:
    attestation = payload.input.get("attestation")
    if attestation is None:
        raise HTTPException(
            status_code=422,
            detail="adapt_attestation_template requires input.attestation",
        )
    result = await attestation_template_adapter.run_async(attestation)
    return OutputResponse(output=result)


    result = await compliance_analyser.run_async(attestation)
    return OutputResponse(output=result)

@app.post("/analyze_compliance", response_model=OutputResponse)
async def analyze_compliance(payload: InputRequest) -> OutputResponse:
    result = await compliance_analyser.run_async(payload.input.get("attestation", ""))
    return OutputResponse(output=result)


async def _analyze_specific_principle(payload: InputRequest, principle: str) -> OutputResponse:
    attestation = payload.input.get("attestation", "")
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(status_code=422, detail="input.attestation must be a non-empty string.")

    full_analysis = await compliance_analyser.run_async(attestation)
    results = _analysis_results_payload(full_analysis)
    assessment = next(
        (
            item for item in results.get("principle_assessments", [])
            if isinstance(item, dict) and item.get("principle") == principle
        ),
        None,
    )
    return OutputResponse(output={
        "principle": principle,
        "attestation": attestation,
        "assessment": assessment or {},
        "modality": results.get("modality", "uncertain"),
        "communicative_function": results.get("communicative_function", "uncertain"),
    })


@app.post("/analyze_a1", response_model=OutputResponse)
async def analyze_a1(payload: InputRequest) -> OutputResponse:
    return await _analyze_specific_principle(payload, "A1")


@app.post("/analyze_a2", response_model=OutputResponse)
async def analyze_a2(payload: InputRequest) -> OutputResponse:
    return await _analyze_specific_principle(payload, "A2")


@app.post("/analyze_a3", response_model=OutputResponse)
async def analyze_a3(payload: InputRequest) -> OutputResponse:
    return await _analyze_specific_principle(payload, "A3")


@app.post("/analyze_b1", response_model=OutputResponse)
async def analyze_b1(payload: InputRequest) -> OutputResponse:
    return await _analyze_specific_principle(payload, "B1")


@app.post("/analyze_b2", response_model=OutputResponse)
async def analyze_b2(payload: InputRequest) -> OutputResponse:
    return await _analyze_specific_principle(payload, "B2")


@app.post("/analyze_c", response_model=OutputResponse)
async def analyze_c(payload: InputRequest) -> OutputResponse:
    return await _analyze_specific_principle(payload, "C")


@app.post("/analyze_d", response_model=OutputResponse)
async def analyze_d(payload: InputRequest) -> OutputResponse:
    return await _analyze_specific_principle(payload, "D")


@app.post("/analyze_e", response_model=OutputResponse)
async def analyze_e(payload: InputRequest) -> OutputResponse:
    return await _analyze_specific_principle(payload, "E")

COMPLIANCE_RANK = {
    "Compliant": 0,
    "Partially Compliant": 1,
    "Non-Compliant": 2,
}

PRINCIPLE_ORDER = {
    "A1": 0,
    "A2": 1,
    "A3": 2,
    "B1": 3,
    "B2": 4,
    "C": 5,
    "D": 6,
    "E": 7,
}


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return {}


def _analysis_results_payload(analysis: Any) -> dict[str, Any]:
    payload = _as_dict(analysis)
    output = _as_dict(payload.get("output"))
    results = output.get("results")
    return _as_dict(results if results is not None else payload.get("results"))


def _status_rank(status: str) -> int:
    return COMPLIANCE_RANK.get(status, 0)


def _principle_assessment_map(results: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(item.get("principle")): item
        for item in results.get("principle_assessments", [])
        if isinstance(item, dict) and item.get("principle")
    }


@app.post("/a2/analyze", response_model=OutputResponse)
async def analyze_a2_key_elements(payload: InputRequest) -> OutputResponse:
    attestation = payload.input.get("attestation", "")
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(status_code=422, detail="input.attestation must be a non-empty string.")

    full_analysis = await compliance_analyser.run_async(attestation)
    results = _analysis_results_payload(full_analysis)
    assessments = _principle_assessment_map(results)
    a2_assessment = assessments.get("A2", {})
    correction = await compliance_corrector.run_async(attestation, results, ["A2"])
    correction_results = _as_dict(_as_dict(correction).get("results"))
    corrected_text = str(correction_results.get("corrected_attestation") or "").strip()
    suggestions = []
    if (
        correction_results.get("decision") == "corrected"
        and corrected_text
        and corrected_text != attestation.strip()
    ):
        suggestions.append({
            "id": "a2-minimal-correction",
            "text": corrected_text,
            "rationale": "Minimal correction focused on the A2 key-element findings.",
            "notes": correction_results.get("correction_notes", []),
        })

    return OutputResponse(output={
        "principle": "A2",
        "attestation": attestation,
        "status": a2_assessment.get("compliance", "Compliant"),
        "assessment": a2_assessment,
        "identified_elements": results.get("identified_elements", {}),
        "missing_information": results.get("missing_information", []),
        "suggestions": suggestions,
        "can_suggest_correction": bool(suggestions),
        "guidance": (
            "Review the identified elements and choose a suggested correction or provide your own wording."
            if suggestions
            else "No safe textual correction could be generated without adding unsupported information."
        ),
    })


@app.post("/a2/validate-correction", response_model=OutputResponse)
async def validate_a2_correction(payload: InputRequest) -> OutputResponse:
    original = payload.input.get("original_attestation", "")
    candidate = payload.input.get("candidate_attestation", "")
    if not isinstance(original, str) or not original.strip():
        raise HTTPException(status_code=422, detail="input.original_attestation must be a non-empty string.")
    if not isinstance(candidate, str) or not candidate.strip():
        raise HTTPException(status_code=422, detail="input.candidate_attestation must be a non-empty string.")

    original_analysis, candidate_analysis = await asyncio.gather(
        compliance_analyser.run_async(original),
        compliance_analyser.run_async(candidate),
    )
    original_results = _analysis_results_payload(original_analysis)
    candidate_results = _analysis_results_payload(candidate_analysis)
    original_assessments = _principle_assessment_map(original_results)
    candidate_assessments = _principle_assessment_map(candidate_results)

    regressions = []
    preserved_principles = []
    for principle in PRINCIPLE_ORDER:
        before = str(original_assessments.get(principle, {}).get("compliance") or "Compliant")
        after = str(candidate_assessments.get(principle, {}).get("compliance") or "Compliant")
        if _status_rank(after) > _status_rank(before):
            regressions.append({"principle": principle, "before": before, "after": after})
        elif before == "Compliant" and after == "Compliant":
            preserved_principles.append(principle)

    original_a2 = str(original_assessments.get("A2", {}).get("compliance") or "Compliant")
    candidate_a2 = str(candidate_assessments.get("A2", {}).get("compliance") or "Compliant")
    a2_improved_or_preserved = _status_rank(candidate_a2) <= _status_rank(original_a2)
    can_apply = not regressions and a2_improved_or_preserved

    return OutputResponse(output={
        "principle": "A2",
        "original_attestation": original,
        "candidate_attestation": candidate,
        "can_apply": can_apply,
        "a2_improved_or_preserved": a2_improved_or_preserved,
        "original_a2_status": original_a2,
        "candidate_a2_status": candidate_a2,
        "regressions": regressions,
        "preserved_principles": preserved_principles,
        "candidate_assessments": candidate_assessments,
        "candidate_identified_elements": candidate_results.get("identified_elements", {}),
        "candidate_missing_information": candidate_results.get("missing_information", []),
        "warnings": [] if can_apply else [
            "The candidate was not approved because it worsens an existing principle or does not preserve A2."
        ],
    })


@app.post("/a3/analyze", response_model=OutputResponse)
async def analyze_a3_modality_and_function(payload: InputRequest) -> OutputResponse:
    attestation = payload.input.get("attestation", "")
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(status_code=422, detail="input.attestation must be a non-empty string.")

    full_analysis, template_adaptation = await asyncio.gather(
        compliance_analyser.run_async(attestation),
        attestation_template_adapter.run_async(attestation),
    )
    results = _analysis_results_payload(full_analysis)
    assessments = _principle_assessment_map(results)
    a3_assessment = assessments.get("A3", {})
    adaptation_results = _as_dict(_as_dict(template_adaptation).get("results"))
    selected_template = _as_dict(adaptation_results.get("selected_template"))
    corrected_text = str(adaptation_results.get("adapted_attestation") or "").strip()
    suggestions = []
    if corrected_text:
        suggestions.append({
            "id": "a3-template-adaptation",
            "text": corrected_text,
            "rationale": str(adaptation_results.get("template_selection_rationale") or "Wording adapted to the recommended template."),
            "notes": adaptation_results.get("unresolved_risks", []),
        })

    return OutputResponse(output={
        "principle": "A3",
        "attestation": attestation,
        "status": a3_assessment.get("compliance", "Compliant"),
        "assessment": a3_assessment,
        "modality": selected_template.get("modality") or results.get("modality", "uncertain"),
        "communicative_function": selected_template.get("communicative_function") or results.get("communicative_function", "uncertain"),
        "recommended_template": selected_template,
        "template_confidence": adaptation_results.get("confidence", 0),
        "template_selection_rationale": adaptation_results.get("template_selection_rationale", ""),
        "supporting_text": a3_assessment.get("relevant_text_fragment", "Not explicitly expressed."),
        "suggestions": suggestions,
        "can_suggest_correction": bool(suggestions),
        "guidance": (
            "Confirm the modality and communicative function, then review the factual wording."
            if suggestions
            else "No safe wording change was generated; confirm the classification or keep the current attestation."
        ),
    })


@app.post("/a3/adapt-template", response_model=OutputResponse)
async def adapt_a3_to_selected_template(payload: InputRequest) -> OutputResponse:
    attestation = payload.input.get("attestation", "")
    template_id = str(payload.input.get("template_id") or "").strip()
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(status_code=422, detail="input.attestation must be a non-empty string.")
    if not template_id:
        raise HTTPException(status_code=422, detail="input.template_id must be provided.")

    try:
        adaptation = await attestation_template_adapter.run_with_template_async(attestation, template_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return OutputResponse(output=_as_dict(adaptation).get("results", {}))


@app.post("/a3/validate-correction", response_model=OutputResponse)
async def validate_a3_correction(payload: InputRequest) -> OutputResponse:
    original = payload.input.get("original_attestation", "")
    candidate = payload.input.get("candidate_attestation", "")
    confirmed_modality = str(payload.input.get("confirmed_modality") or "").strip()
    confirmed_function = str(payload.input.get("confirmed_communicative_function") or "").strip()
    confirmed_template_id = str(payload.input.get("confirmed_template_id") or "").strip()
    if not isinstance(original, str) or not original.strip():
        raise HTTPException(status_code=422, detail="input.original_attestation must be a non-empty string.")
    if not isinstance(candidate, str) or not candidate.strip():
        raise HTTPException(status_code=422, detail="input.candidate_attestation must be a non-empty string.")

    original_analysis, candidate_analysis = await asyncio.gather(
        compliance_analyser.run_async(original),
        compliance_analyser.run_async(candidate),
    )
    original_results = _analysis_results_payload(original_analysis)
    candidate_results = _analysis_results_payload(candidate_analysis)
    original_assessments = _principle_assessment_map(original_results)
    candidate_assessments = _principle_assessment_map(candidate_results)

    regressions = []
    preserved_principles = []
    for principle in PRINCIPLE_ORDER:
        before = str(original_assessments.get(principle, {}).get("compliance") or "Compliant")
        after = str(candidate_assessments.get(principle, {}).get("compliance") or "Compliant")
        if _status_rank(after) > _status_rank(before):
            regressions.append({"principle": principle, "before": before, "after": after})
        elif before == "Compliant" and after == "Compliant":
            preserved_principles.append(principle)

    original_a3 = str(original_assessments.get("A3", {}).get("compliance") or "Compliant")
    candidate_a3 = str(candidate_assessments.get("A3", {}).get("compliance") or "Compliant")
    a3_improved_or_preserved = _status_rank(candidate_a3) <= _status_rank(original_a3)
    confirmed_template = attestation_template_adapter.get_template(confirmed_template_id) if confirmed_template_id else None
    candidate_modality = str((confirmed_template or {}).get("modality") or candidate_results.get("modality") or "uncertain")
    candidate_function = str((confirmed_template or {}).get("communicative_function") or candidate_results.get("communicative_function") or "uncertain")
    modality_consistent = not confirmed_modality or candidate_modality.casefold() == confirmed_modality.casefold()
    function_consistent = not confirmed_function or candidate_function.casefold() == confirmed_function.casefold()
    classification_consistent = modality_consistent and function_consistent
    can_apply = not regressions and a3_improved_or_preserved and classification_consistent

    warnings = []
    if regressions:
        warnings.append("The candidate worsens one or more existing principles.")
    if not a3_improved_or_preserved:
        warnings.append("The candidate does not preserve or improve A3.")
    if not classification_consistent:
        warnings.append("The candidate wording does not match the confirmed modality or communicative function.")

    return OutputResponse(output={
        "principle": "A3",
        "original_attestation": original,
        "candidate_attestation": candidate,
        "can_apply": can_apply,
        "a3_improved_or_preserved": a3_improved_or_preserved,
        "original_a3_status": original_a3,
        "candidate_a3_status": candidate_a3,
        "confirmed_modality": confirmed_modality,
        "confirmed_communicative_function": confirmed_function,
        "candidate_modality": candidate_modality,
        "candidate_communicative_function": candidate_function,
        "classification_consistent": classification_consistent,
        "regressions": regressions,
        "preserved_principles": preserved_principles,
        "candidate_assessments": candidate_assessments,
        "warnings": warnings,
    })


WORKFLOW_ACTIONS = {
    "B1": "Separate Independent Attestations",
    "B2": "Clarify Vague or Subjective Language",
    "C": "Strengthen Verifiability and Auditability",
    "D": "Improve Machine Readability",
    "E": "Confirm Preservation of Meaning",
}


def _workflow_assessment(principle: str, analysis: dict[str, Any]) -> dict[str, Any]:
    return {
        "principle": principle,
        "principle_name": WORKFLOW_ACTIONS[principle],
        "compliance": analysis.get("status", "Compliant"),
        "relevant_text_fragment": analysis.get("relevant_text_fragment", "Not explicitly expressed."),
        "issue_identified": analysis.get("issue_identified", "No issue identified."),
        "explanation": analysis.get("explanation", ""),
    }


async def _analyze_workflow_principle(payload: InputRequest, principle: str) -> OutputResponse:
    attestation = payload.input.get("attestation", "")
    original_attestation = payload.input.get("original_attestation")
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(status_code=422, detail="input.attestation must be a non-empty string.")

    comparison_original = (
        original_attestation
        if principle == "E" and isinstance(original_attestation, str) and original_attestation.strip() != attestation.strip()
        else None
    )
    specialized = await principle_workflow_analyser.run_async(
        attestation,
        principle,
        original_attestation=comparison_original,
    )
    analysis = _as_dict(specialized.get("results"))
    assessment = _workflow_assessment(principle, analysis)
    suggestions = []

    if analysis.get("status") != "Compliant" and analysis.get("can_correct_without_new_information"):
        correction = await compliance_corrector.run_async(
            attestation,
            {"principle_assessments": [assessment]},
            [principle],
        )
        correction_results = _as_dict(correction.get("results"))
        corrected_text = str(correction_results.get("corrected_attestation") or "").strip()
        replacement_units = [
            str(unit).strip()
            for unit in correction_results.get("corrected_units", [])
            if str(unit).strip()
        ]
        is_valid_b1_split = principle != "B1" or len(replacement_units) > 1
        if (
            correction_results.get("decision") == "corrected"
            and corrected_text
            and corrected_text != attestation.strip()
            and is_valid_b1_split
        ):
            suggestions.append({
                "id": f"{principle.lower()}-minimal-correction",
                "text": corrected_text,
                "replacement_units": replacement_units,
                "rationale": analysis.get("correction_goal") or f"Minimal correction focused on {principle}.",
                "notes": correction_results.get("correction_notes", []),
            })

    return OutputResponse(output={
        "principle": principle,
        "action_title": WORKFLOW_ACTIONS[principle],
        "attestation": attestation,
        "status": analysis.get("status", "Compliant"),
        "assessment": assessment,
        "summary": analysis.get("summary", ""),
        "findings": analysis.get("findings", []),
        "checks": analysis.get("checks", []),
        "metrics": analysis.get("metrics", []),
        "correction_goal": analysis.get("correction_goal", ""),
        "suggestions": suggestions,
        "can_suggest_correction": bool(suggestions),
        "guidance": analysis.get("guidance", "Review the analysis and confirm the current wording."),
    })


def _worst_assessment(
    assessment_maps: list[dict[str, dict[str, Any]]],
    principle: str,
) -> dict[str, Any]:
    candidates = [mapping.get(principle, {}) for mapping in assessment_maps]
    return max(
        candidates or [{}],
        key=lambda assessment: _status_rank(str(assessment.get("compliance") or "Compliant")),
    )


def _b1_meaning_preserved(original: str, candidates: list[str]) -> bool:
    ignored = {"a", "an", "and", "but", "or", "that", "the", "then"}
    source_tokens = {
        token for token in re.findall(r"[a-z0-9]+(?:[-'][a-z0-9]+)?", original.casefold())
        if token not in ignored
    }
    candidate_tokens = {
        token for token in re.findall(r"[a-z0-9]+(?:[-'][a-z0-9]+)?", " ".join(candidates).casefold())
        if token not in ignored
    }
    return bool(source_tokens) and source_tokens == candidate_tokens


async def _validate_workflow_correction(payload: InputRequest, principle: str) -> OutputResponse:
    original = payload.input.get("original_attestation", "")
    raw_candidates = payload.input.get("candidate_attestations")
    if raw_candidates is None:
        raw_candidates = [payload.input.get("candidate_attestation", "")]
    if not isinstance(original, str) or not original.strip():
        raise HTTPException(status_code=422, detail="input.original_attestation must be a non-empty string.")
    if not isinstance(raw_candidates, list):
        raise HTTPException(status_code=422, detail="input.candidate_attestations must be a list.")
    candidates = [str(item).strip() for item in raw_candidates if str(item).strip()]
    requested_protected = payload.input.get("protected_principles", [])
    confirmed_original_status = str(payload.input.get("original_status") or "").strip()
    if not candidates:
        raise HTTPException(status_code=422, detail="At least one non-empty candidate attestation is required.")
    if principle != "B1" and len(candidates) != 1:
        raise HTTPException(status_code=422, detail=f"{principle} accepts exactly one candidate attestation.")
    if not isinstance(requested_protected, list):
        raise HTTPException(status_code=422, detail="input.protected_principles must be a list.")

    candidate_set = "\n".join(f"{index}. {text}" for index, text in enumerate(candidates, start=1))
    analyses = await asyncio.gather(
        compliance_analyser.run_async(original),
        *[compliance_analyser.run_async(candidate) for candidate in candidates],
        principle_workflow_analyser.validate_async(original, principle),
        principle_workflow_analyser.validate_async(candidate_set, principle, original_attestation=original),
    )
    original_results = _analysis_results_payload(analyses[0])
    candidate_results = [_analysis_results_payload(item) for item in analyses[1:1 + len(candidates)]]
    original_assessments = _principle_assessment_map(original_results)
    candidate_assessment_maps = [_principle_assessment_map(item) for item in candidate_results]
    original_target = _as_dict(_as_dict(analyses[-2]).get("results"))
    candidate_target = _as_dict(_as_dict(analyses[-1]).get("results"))

    aggregate_assessments = {
        item: _worst_assessment(candidate_assessment_maps, item)
        for item in PRINCIPLE_ORDER
    }
    protected_principles = [
        item for item in requested_protected
        if item in PRINCIPLE_ORDER and PRINCIPLE_ORDER[item] < PRINCIPLE_ORDER[principle]
    ]
    regressions = []
    preserved_principles = []
    for protected in protected_principles:
        before = str(original_assessments.get(protected, {}).get("compliance") or "Compliant")
        after = str(aggregate_assessments.get(protected, {}).get("compliance") or "Compliant")
        if _status_rank(after) > _status_rank(before):
            regressions.append({"principle": protected, "before": before, "after": after})
        elif _status_rank(after) <= _status_rank(before):
            preserved_principles.append(protected)

    original_status = confirmed_original_status or str(original_target.get("status") or "Compliant")
    candidate_status = str(candidate_target.get("status") or "Compliant")
    if principle == "B1":
        b1_unit_statuses = [
            str(mapping.get("B1", {}).get("compliance") or "Compliant")
            for mapping in candidate_assessment_maps
        ]
        candidate_status = max(b1_unit_statuses, key=_status_rank)
    target_improved_or_preserved = _status_rank(candidate_status) <= _status_rank(original_status)
    meaning_preserved = (
        _b1_meaning_preserved(original, candidates)
        if principle == "B1"
        else bool(candidate_target.get("meaning_preserved", False))
    )
    split_valid = principle != "B1" or len(candidates) > 1
    can_apply = not regressions and target_improved_or_preserved and meaning_preserved and split_valid
    warnings = []
    if regressions:
        warnings.append("The proposal worsens one or more previously protected principles.")
    if not target_improved_or_preserved:
        warnings.append(f"The proposal does not preserve or improve {principle}.")
    if not meaning_preserved:
        warnings.append("The proposal does not safely preserve the original meaning, scope, or assurance strength.")
    if not split_valid:
        warnings.append("B1 requires at least two independent replacement attestations.")

    candidate_target_assessment = _workflow_assessment(principle, candidate_target)
    if len(candidates) == 1:
        aggregate_assessments[principle] = candidate_target_assessment

    return OutputResponse(output={
        "principle": principle,
        "original_attestation": original,
        "candidate_attestations": candidates,
        "can_apply": can_apply,
        "target_improved_or_preserved": target_improved_or_preserved,
        "meaning_preserved": meaning_preserved,
        "original_status": original_status,
        "candidate_status": candidate_status,
        "regressions": regressions,
        "preserved_principles": preserved_principles,
        "candidate_assessments": aggregate_assessments,
        "candidate_unit_assessments": candidate_assessment_maps,
        "candidate_unit_metadata": [
            {
                "modality": results.get("modality", "uncertain"),
                "communicative_function": results.get("communicative_function", "uncertain"),
            }
            for results in candidate_results
        ],
        "candidate_target_assessment": candidate_target_assessment,
        "warnings": warnings,
    })


@app.post("/b1/analyze", response_model=OutputResponse)
async def analyze_b1_workflow(payload: InputRequest) -> OutputResponse:
    return await _analyze_workflow_principle(payload, "B1")


@app.post("/b1/validate-correction", response_model=OutputResponse)
async def validate_b1_workflow(payload: InputRequest) -> OutputResponse:
    return await _validate_workflow_correction(payload, "B1")


@app.post("/b2/analyze", response_model=OutputResponse)
async def analyze_b2_workflow(payload: InputRequest) -> OutputResponse:
    return await _analyze_workflow_principle(payload, "B2")


@app.post("/b2/validate-correction", response_model=OutputResponse)
async def validate_b2_workflow(payload: InputRequest) -> OutputResponse:
    return await _validate_workflow_correction(payload, "B2")


@app.post("/c/analyze", response_model=OutputResponse)
async def analyze_c_workflow(payload: InputRequest) -> OutputResponse:
    return await _analyze_workflow_principle(payload, "C")


@app.post("/c/validate-correction", response_model=OutputResponse)
async def validate_c_workflow(payload: InputRequest) -> OutputResponse:
    return await _validate_workflow_correction(payload, "C")


@app.post("/d/analyze", response_model=OutputResponse)
async def analyze_d_workflow(payload: InputRequest) -> OutputResponse:
    return await _analyze_workflow_principle(payload, "D")


@app.post("/d/validate-correction", response_model=OutputResponse)
async def validate_d_workflow(payload: InputRequest) -> OutputResponse:
    return await _validate_workflow_correction(payload, "D")


@app.post("/e/analyze", response_model=OutputResponse)
async def analyze_e_workflow(payload: InputRequest) -> OutputResponse:
    return await _analyze_workflow_principle(payload, "E")


@app.post("/e/validate-correction", response_model=OutputResponse)
async def validate_e_workflow(payload: InputRequest) -> OutputResponse:
    return await _validate_workflow_correction(payload, "E")


@app.post("/consolidate_compliance_report", response_model=OutputResponse)
async def consolidate_compliance_report(payload: InputRequest) -> OutputResponse:
    analyses = payload.input.get("unit_analyses", [])
    if not isinstance(analyses, list):
        raise HTTPException(status_code=422, detail="input.unit_analyses must be a list.")

    by_principle: dict[str, dict[str, Any]] = {}
    unit_summaries: list[dict[str, Any]] = []
    status_counts = {"Compliant": 0, "Partially Compliant": 0, "Non-Compliant": 0}

    for position, analysis in enumerate(analyses, start=1):
        unit_index = position
        if isinstance(analysis, dict) and "analysis" in analysis:
            unit_value = analysis.get("unit", position)
            try:
                unit_index = int(unit_value)
            except (TypeError, ValueError):
                unit_index = position
            analysis = analysis.get("analysis")

        results = _analysis_results_payload(analysis)
        overall = _as_dict(results.get("overall_assessment"))
        unit_status = str(overall.get("compliance") or "Compliant")
        status_counts[unit_status] = status_counts.get(unit_status, 0) + 1
        unit_summaries.append(
            {
                "unit": unit_index,
                "status": unit_status,
                "summary": str(overall.get("summary") or ""),
            }
        )

        assessments = results.get("principle_assessments", [])
        if not isinstance(assessments, list):
            continue

        for assessment in assessments:
            item = _as_dict(assessment)
            code = str(item.get("principle") or "").strip()
            if not code:
                continue

            status = str(item.get("compliance") or "Compliant")
            summary = str(item.get("issue_identified") or item.get("explanation") or "").strip()
            principle = by_principle.setdefault(
                code,
                {
                    "code": code,
                    "principle": str(item.get("principle_name") or code),
                    "status": status,
                    "problem_summary": "",
                    "affected_units": [],
                    "unit_findings": [],
                },
            )

            if _status_rank(status) > _status_rank(principle["status"]):
                principle["status"] = status

            if status != "Compliant":
                if unit_index not in principle["affected_units"]:
                    principle["affected_units"].append(unit_index)
                principle["unit_findings"].append(
                    {
                        "unit": unit_index,
                        "status": status,
                        "summary": summary,
                    }
                )

    rows = sorted(
        by_principle.values(),
        key=lambda item: PRINCIPLE_ORDER.get(item["code"], 999),
    )
    for row in rows:
      findings = row["unit_findings"]
      if findings:
          first = findings[0]
          unit_label = f"Unit {first['unit']}"
          more = len(findings) - 1
          suffix = f" (+{more} more)" if more > 0 else ""
          row["problem_summary"] = f"{unit_label}{suffix}: {first['summary']}"
      else:
          row["problem_summary"] = "No material issue detected across the analyzed units."

    non_compliant = status_counts.get("Non-Compliant", 0)
    partially_compliant = status_counts.get("Partially Compliant", 0)
    total_units = len(analyses)
    overall_status = (
        "Non-Compliant"
        if non_compliant
        else "Partially Compliant"
        if partially_compliant
        else "Compliant"
    )

    return OutputResponse(
        output={
            "overall_status": overall_status,
            "summary": {
                "total_units": total_units,
                "compliant_units": status_counts.get("Compliant", 0),
                "partially_compliant_units": partially_compliant,
                "non_compliant_units": non_compliant,
            },
            "rows": rows,
            "unit_summaries": unit_summaries,
        }
    )

@app.post("/correct_compliance", response_model=OutputResponse)
async def correct_compliance(payload: InputRequest) -> OutputResponse:
    result = await compliance_corrector.run_async(
        payload.input.get("attestation", ""),
        payload.input.get("compliance_analysis", {}),
        payload.input.get("allowed_principles", []),
    )
    return OutputResponse(output=result)


@app.post("/suggest_attestation_correction", response_model=OutputResponse)
async def suggest_attestation_correction(payload: InputRequest) -> OutputResponse:
    attestation = payload.input.get("attestation", "")
    if not isinstance(attestation, str) or not attestation.strip():
        raise HTTPException(status_code=422, detail="input.attestation must be a non-empty string.")

    compliance_analysis = payload.input.get("compliance_analysis")
    if not compliance_analysis:
        compliance_analysis = await compliance_analyser.run_async(attestation)

    analysis_results = _analysis_results_payload(compliance_analysis)
    allowed_principles = payload.input.get("allowed_principles")
    if allowed_principles is None:
        allowed_principles = [
            str(item.get("principle"))
            for item in analysis_results.get("principle_assessments", [])
            if isinstance(item, dict)
            and str(item.get("compliance") or "") in {"Partially Compliant", "Non-Compliant"}
            and item.get("principle")
        ]

    if not isinstance(allowed_principles, list):
        raise HTTPException(status_code=422, detail="input.allowed_principles must be a list when supplied.")

    result = await compliance_corrector.run_async(
        attestation,
        analysis_results,
        allowed_principles,
    )
    if isinstance(result, dict):
        result.setdefault("input", {})
        if isinstance(result["input"], dict):
            result["input"]["compliance_analysis"] = analysis_results
    return OutputResponse(output=result)


@app.post("/agent/plan_unit_edits", response_model=OutputResponse)
async def plan_agent_unit_edits(payload: InputRequest) -> OutputResponse:
    request = payload.input.get("request", "")
    units = payload.input.get("units", [])
    commodities = payload.input.get("commodities", [])
    context = payload.input.get("context", {})

    if not isinstance(request, str) or not request.strip():
        raise HTTPException(status_code=422, detail="input.request must be a non-empty string.")
    if not isinstance(units, list) or not units:
        raise HTTPException(status_code=422, detail="input.units must be a non-empty list.")
    if not isinstance(commodities, list):
        raise HTTPException(status_code=422, detail="input.commodities must be a list.")
    if not isinstance(context, dict):
        raise HTTPException(status_code=422, detail="input.context must be an object when supplied.")

    result = await unit_edit_agent.plan_async(
        request=request,
        units=units,
        commodities=commodities,
        context=context,
    )
    return OutputResponse(output=result)


@app.post("/agent/execute_unit_edits", response_model=OutputResponse)
async def execute_agent_unit_edits(payload: InputRequest) -> OutputResponse:
    request = payload.input.get("request", "")
    plan = payload.input.get("plan", {})
    units = payload.input.get("units", [])
    commodities = payload.input.get("commodities", [])
    context = payload.input.get("context", {})

    if not isinstance(request, str) or not request.strip():
        raise HTTPException(status_code=422, detail="input.request must be a non-empty string.")
    if not isinstance(plan, dict):
        raise HTTPException(status_code=422, detail="input.plan must be an object.")
    if plan.get("requires_clarification"):
        raise HTTPException(status_code=409, detail="The approved plan requires clarification before execution.")
    if not isinstance(units, list) or not units:
        raise HTTPException(status_code=422, detail="input.units must be a non-empty list.")
    if not isinstance(commodities, list):
        raise HTTPException(status_code=422, detail="input.commodities must be a list.")
    if not isinstance(context, dict):
        raise HTTPException(status_code=422, detail="input.context must be an object when supplied.")

    result = await unit_edit_agent.execute_async(
        request=request,
        plan=plan,
        units=units,
        commodities=commodities,
        context=context,
    )
    return OutputResponse(output=result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
