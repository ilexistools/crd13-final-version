import json

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import Any
from pydantic import BaseModel
from PyPDF2 import PdfReader
from app.tools.commodities_identification import CommoditiesIdentifierTool
from app.tools.unitization import UnitizationTool
from app.tools.provisions_search import ProvisionsSearchTool
from app.tools.attestation_section_search import AttestationSectionSearchTool
from app.tools.triple_generation import TripleGenerationTool
from app.tools.attestation_analyser import AttestationAnalyserTool
from app.tools.attestation_section_analyser import AttestationSectionAnalyserTool
from app.tools.attestation_rewriter import AttestationRewriteTool
from app.tools.attestation_rewrite_change_planner import AttestationRewriteChangePlannerTool
from app.tools.attestation_change_applier import AttestationChangeApplierTool
from app.tools.attestation_template_adaptation import AttestationTemplateAdapterTool
from app.tools.compliance_analysis import ComplianceAnalysisTool
from app.tools.compliance_correction import ComplianceCorrectionTool


unitizer = UnitizationTool()
commodities_identifier = CommoditiesIdentifierTool()
provisions_search = ProvisionsSearchTool()
attestation_section_search = AttestationSectionSearchTool()
attestation_section_analyser = AttestationSectionAnalyserTool()
triple_generator = TripleGenerationTool()
attestation_analyser = AttestationAnalyserTool()
attestation_rewriter = AttestationRewriteTool()
attestation_rewrite_change_planner = AttestationRewriteChangePlannerTool()
attestation_change_applier = AttestationChangeApplierTool()
attestation_template_adapter = AttestationTemplateAdapterTool()
compliance_analyser = ComplianceAnalysisTool()
compliance_corrector = ComplianceCorrectionTool()


class InputRequest(BaseModel):
    input: dict

class OutputResponse(BaseModel):
    output: Any


app = FastAPI(title="GPT Agents + FastAPI Example")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:4200",
        "http://localhost:4200",
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
        result = await attestation_rewrite_change_planner.run_async(attestation, sections)
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
        result = await attestation_change_applier.run_async(attestation, changes)
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

@app.post("/correct_compliance", response_model=OutputResponse)
async def correct_compliance(payload: InputRequest) -> OutputResponse:
    result = await compliance_corrector.run_async(
        payload.input.get("attestation", ""),
        payload.input.get("compliance_analysis", {}),
        payload.input.get("allowed_principles", []),
    )
    return OutputResponse(output=result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
