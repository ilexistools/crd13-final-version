import json

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
