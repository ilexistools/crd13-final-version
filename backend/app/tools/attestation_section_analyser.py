"""Select section-summary references for attestation analysis.

This tool receives commodities plus an attestation, uses the existing
commodity-filtered section search to identify related documents/sections, then
loads the lightweight section summaries and asks an LLM to keep the sections
that are meaningful references for analysis and rewrite suggestions.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.orchestration.gpt_agent import GPTAgent
from app.tools.attestation_section_search import AttestationSectionSearchTool
from app.tools._document_metadata import fetch_documents_by_id


DEFAULT_SECTION_SUMMARIES_PATH = (
    Path(__file__).resolve().parents[1] / "assets" / "section_summaries"
)


class SelectedSectionJustification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int = Field(
        ...,
        description="Candidate section id selected from the supplied candidate_sections list.",
    )
    justification: str = Field(
        ...,
        description="Concise reason this section is useful for analysing or rewriting the attestation.",
    )


class AttestationSectionAnalysisSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selected_sections: list[SelectedSectionJustification] = Field(
        default_factory=list,
        description="Selected candidate section ids and justifications, ordered from most to least useful.",
    )


class AttestationSectionAnalyserTool:
    def __init__(
        self,
        *,
        section_search: AttestationSectionSearchTool | None = None,
        section_summaries_path: str | Path = DEFAULT_SECTION_SUMMARIES_PATH,
    ):
        self.section_search = section_search or AttestationSectionSearchTool()
        self.section_summaries_path = Path(section_summaries_path)
        self.__create_gpts()

    def __create_gpts(self) -> None:
        self.__gpt_agent_analyser = GPTAgent(
            agent_id="attestation_section_analyser",
            output_type=AttestationSectionAnalysisSelection,
        )

    @staticmethod
    def _validate_input(attestation: str, commodities: list[str]) -> None:
        if not isinstance(attestation, str) or not attestation.strip():
            raise ValueError("attestation must be a non-empty string")
        if not isinstance(commodities, list) or any(
            not isinstance(commodity, str) for commodity in commodities
        ):
            raise ValueError("commodities must be a list of strings")

    def _load_summary_document(self, doc_id: str) -> dict[str, Any] | None:
        path = self.section_summaries_path / f"{doc_id}.json"
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else None

    def _summary_by_section_id(self, doc_id: str) -> dict[str, dict[str, Any]]:
        document = self._load_summary_document(doc_id)
        if not document:
            return {}
        sections = document.get("sections") or []
        return {
            str(section.get("section_id")): section
            for section in sections
            if isinstance(section, dict) and section.get("section_id") is not None
        }

    def _candidate_sections(
        self,
        attestation: str,
        commodities: list[str],
        *,
        block_top_k: int,
        sections_per_doc: int,
        document_limit: int,
    ) -> list[dict[str, Any]]:
        search_results = self.section_search.top_sections(
            attestation,
            commodities,
            block_top_k=block_top_k,
            sections_per_doc=sections_per_doc,
            limit=document_limit,
        )

        summary_cache: dict[str, dict[str, dict[str, Any]]] = {}
        candidates: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        for result in search_results:
            doc_id = result.get("doc_id")
            section_id = result.get("section_id")
            if not isinstance(doc_id, str) or section_id is None:
                continue

            section_key = str(section_id)
            unique_key = (doc_id, section_key)
            if unique_key in seen:
                continue
            seen.add(unique_key)

            if doc_id not in summary_cache:
                summary_cache[doc_id] = self._summary_by_section_id(doc_id)
            summary = summary_cache[doc_id].get(section_key)
            if not summary:
                continue

            candidates.append(
                {
                    "id": len(candidates),
                    "doc_id": doc_id,
                    "section_id": section_id,
                    "section": summary.get("section") or result.get("section"),
                    "summary": summary.get("summary") or "",
                    "categories": summary.get("categories") or [],
                    "subcategories": summary.get("subcategories") or [],
                    "start_page": (summary.get("page_range") or {}).get("start_page"),
                    "end_page": (summary.get("page_range") or {}).get("end_page"),
                    "similarity": result.get("similarity"),
                }
            )

        return candidates

    @staticmethod
    def _build_results(
        candidates: list[dict[str, Any]],
        selection: AttestationSectionAnalysisSelection,
        *,
        max_sections: int,
        documents_by_id: dict[str, dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        by_id = {candidate["id"]: candidate for candidate in candidates}
        documents_by_id = documents_by_id or {}
        results: list[dict[str, Any]] = []
        seen: set[int] = set()

        for selected in selection.selected_sections:
            candidate = by_id.get(selected.id)
            if candidate is None or selected.id in seen:
                continue
            seen.add(selected.id)
            results.append(
                {
                    "doc_id": candidate["doc_id"],
                    "document": documents_by_id.get(candidate["doc_id"]),
                    "section_id": candidate["section_id"],
                    "section": candidate["section"],
                    "summary": candidate["summary"],
                    "categories": candidate["categories"],
                    "start_page": candidate["start_page"],
                    "end_page": candidate["end_page"],
                    "justification": selected.justification,
                }
            )
            if len(results) >= max_sections:
                break

        return results

    async def run_async(
        self,
        attestation: str,
        commodities: list[str],
        *,
        block_top_k: int = 120,
        sections_per_doc: int = 25,
        document_limit: int = 10,
        max_sections: int = 20,
    ) -> dict[str, Any]:
        self._validate_input(attestation, commodities)
        if not self.section_summaries_path.exists():
            raise FileNotFoundError(f"Section summaries not found: {self.section_summaries_path}")

        candidates = await asyncio.to_thread(
            self._candidate_sections,
            attestation,
            commodities,
            block_top_k=block_top_k,
            sections_per_doc=sections_per_doc,
            document_limit=document_limit,
        )
        if not candidates:
            return {
                "output": {
                    "input": {"attestation": attestation, "commodities": commodities},
                    "results": [],
                }
            }

        prompt = json.dumps(
            {
                "attestation": attestation,
                "commodities": commodities,
                "candidate_sections": candidates,
            },
            ensure_ascii=False,
        )
        selection = await self.__gpt_agent_analyser.run(prompt)
        documents_by_id = fetch_documents_by_id(
            self.section_search.sections_db_path,
            [candidate["doc_id"] for candidate in candidates],
        )
        results = self._build_results(
            candidates,
            selection,
            max_sections=max_sections,
            documents_by_id=documents_by_id,
        )
        return {
            "output": {
                "input": {"attestation": attestation, "commodities": commodities},
                "results": results,
            }
        }

    def run(
        self,
        attestation: str,
        commodities: list[str],
        *,
        block_top_k: int = 120,
        sections_per_doc: int = 25,
        document_limit: int = 10,
        max_sections: int = 20,
    ) -> dict[str, Any]:
        self._validate_input(attestation, commodities)
        if not self.section_summaries_path.exists():
            raise FileNotFoundError(f"Section summaries not found: {self.section_summaries_path}")

        candidates = self._candidate_sections(
            attestation,
            commodities,
            block_top_k=block_top_k,
            sections_per_doc=sections_per_doc,
            document_limit=document_limit,
        )
        if not candidates:
            return {
                "output": {
                    "input": {"attestation": attestation, "commodities": commodities},
                    "results": [],
                }
            }

        prompt = json.dumps(
            {
                "attestation": attestation,
                "commodities": commodities,
                "candidate_sections": candidates,
            },
            ensure_ascii=False,
        )
        selection = self.__gpt_agent_analyser.run_sync(prompt)
        documents_by_id = fetch_documents_by_id(
            self.section_search.sections_db_path,
            [candidate["doc_id"] for candidate in candidates],
        )
        results = self._build_results(
            candidates,
            selection,
            max_sections=max_sections,
            documents_by_id=documents_by_id,
        )
        return {
            "output": {
                "input": {"attestation": attestation, "commodities": commodities},
                "results": results,
            }
        }
