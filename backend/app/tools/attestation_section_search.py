"""Commodity-filtered semantic search over document sections.

Given a provision text and a list of commodities, this tool:
  1) restricts candidate documents to those tagged with a matching commodity
     (via sections.sqlite3, built by app/prepare/build_sections_sqlite.py);
  2) ranks that document's section blocks by embedding similarity to the
     provision text (via sections_units.sqlite3, built by
     app/prepare/build_sections_vector_index.py);
  3) reduces the matched blocks to the single most significant section of
     each matching document.
"""

from __future__ import annotations

import asyncio
import json
import sqlite3
from pathlib import Path
from typing import Any

import numpy as np
from pydantic import BaseModel, Field

from app.embeddings.sqlite_vec_search import SQLiteVecSearch
from app.orchestration import gpt
from app.tools._commodity_matching import commodity_query_terms
from app.tools._document_metadata import fetch_documents_by_id


class SectionFilterResponse(BaseModel):
    """Structured output used to discard inadequate/unproductive section candidates."""

    selected_ids: list[int] = Field(
        description="IDs of the candidate sections worth keeping as evidence, ordered by relevance."
    )


_EXCLUDED_LABELS = {
    "contents",
    "document title",
    "author heading",
    "scope heading",
    "introduction",
    "definitions",
    "page number",
    "section label",
    "certificate format",
    "certificate date",
    "signature line",
    "contact details",
    "reference documents",
    "annex list",
}


def _is_excluded_block(metadata: dict[str, Any]) -> bool:
    """True when the section's title or any category/subcategory names
    boilerplate content that shouldn't be surfaced as a match (e.g. a table
    of contents, a title page, or a signature line)."""
    title = (metadata.get("section") or "").strip().casefold()
    if title in _EXCLUDED_LABELS:
        return True
    for entry in metadata.get("categories") or []:
        if not isinstance(entry, dict):
            continue
        category = (entry.get("category") or "").strip().casefold()
        subcategory = (entry.get("subcategory") or "").strip().casefold()
        if category in _EXCLUDED_LABELS or subcategory in _EXCLUDED_LABELS:
            return True
    return False


def _dedupe_categories(categories: list[Any]) -> list[dict[str, Any]]:
    """Deduplicate a section's categories.

    Entries are deduped by category name, since the subcategory is normally
    just fine-grained evidence for the same category. "other" is the
    exception: it's not informative on its own, so different "other" entries
    are kept distinct by subcategory instead of collapsing into one.
    """
    seen: set[tuple[Any, ...]] = set()
    result: list[dict[str, Any]] = []
    for entry in categories or []:
        if not isinstance(entry, dict):
            continue
        category = entry.get("category")
        if category == "other":
            key = (category, entry.get("subcategory"))
            value = {"category": category, "subcategory": entry.get("subcategory")}
        else:
            key = (category,)
            value = {"category": category}
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


DEFAULT_SECTIONS_DB_PATH = (
    Path(__file__).resolve().parents[1] / "assets" / "indexes" / "sections.sqlite3"
)
DEFAULT_VECTOR_DB_PATH = (
    Path(__file__).resolve().parents[1] / "assets" / "indexes" / "sections_units.sqlite3"
)


class AttestationSectionSearchTool:
    def __init__(
        self,
        sections_db_path: str | Path = DEFAULT_SECTIONS_DB_PATH,
        vector_db_path: str | Path = DEFAULT_VECTOR_DB_PATH,
        *,
        model_name: str | None = None,
        models_dir: str | None = None,
        device: str | None = None,
    ):
        self.sections_db_path = Path(sections_db_path)
        self.vector_db_path = Path(vector_db_path)
        self._model_name = model_name
        self._models_dir = models_dir
        self._device = device
        self._index: SQLiteVecSearch | None = None
        self._section_filter: gpt.GPT | None = None

    commodity_query_terms = staticmethod(commodity_query_terms)

    def _get_section_filter(self) -> gpt.GPT:
        if self._section_filter is None:
            self._section_filter = gpt.GPT(agent_id="attestation_section_filter")
            self._section_filter.output_type = SectionFilterResponse
        return self._section_filter

    def _get_index(self) -> SQLiteVecSearch:
        if self._index is None:
            if not self.vector_db_path.exists():
                raise FileNotFoundError(
                    f"Vector index not found: {self.vector_db_path}. "
                    "Build it with app/prepare/build_sections_vector_index.py."
                )
            kwargs: dict[str, Any] = {"db_path": self.vector_db_path, "models_dir": self._models_dir, "device": self._device}
            if self._model_name:
                kwargs["model_name"] = self._model_name
            self._index = SQLiteVecSearch(**kwargs)
        return self._index

    def _open_sections_db(self) -> sqlite3.Connection:
        if not self.sections_db_path.exists():
            raise FileNotFoundError(
                f"Sections database not found: {self.sections_db_path}. "
                "Build it with app/prepare/build_sections_sqlite.py."
            )
        connection = sqlite3.connect(self.sections_db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _candidate_doc_ids(self, commodities: list[str]) -> list[str]:
        normalized_terms = sorted(
            {
                term
                for commodity in commodities
                if isinstance(commodity, str) and commodity.strip()
                for term in self.commodity_query_terms(commodity)
            }
        )
        if not normalized_terms:
            return []

        placeholders = ", ".join("?" for _ in normalized_terms)
        with self._open_sections_db() as connection:
            rows = connection.execute(
                f"""
                SELECT DISTINCT doc_id FROM document_commodities
                WHERE normalized_commodity IN ({placeholders})
                """,
                normalized_terms,
            ).fetchall()
        return [row["doc_id"] for row in rows]

    def _document_metadata(self, doc_ids: list[str]) -> list[dict[str, Any]]:
        """Display metadata for each commodity-matched document, regardless
        of whether any of its sections were kept in `results`."""
        return list(fetch_documents_by_id(self.sections_db_path, doc_ids).values())

    def _candidate_blocks(self, doc_ids: list[str]) -> list[dict[str, Any]]:
        if not doc_ids:
            return []

        placeholders = ", ".join("?" for _ in doc_ids)
        connection = self._get_index()._conn
        rows = connection.execute(
            f"""
            SELECT id, text, metadata_json FROM documents
            WHERE json_extract(metadata_json, '$.doc_id') IN ({placeholders})
            """,
            doc_ids,
        ).fetchall()

        blocks = []
        for block_id, text, metadata_json in rows:
            metadata = json.loads(metadata_json)
            if _is_excluded_block(metadata):
                continue
            blocks.append({"block_id": int(block_id), "text": text, "metadata": metadata})
        return blocks

    def _block_embeddings(self, block_ids: list[int]) -> dict[int, np.ndarray]:
        if not block_ids:
            return {}

        placeholders = ", ".join("?" for _ in block_ids)
        connection = self._get_index()._conn
        rows = connection.execute(
            f"SELECT doc_id, embedding FROM vec_documents WHERE doc_id IN ({placeholders})",
            block_ids,
        ).fetchall()
        return {int(block_id): np.frombuffer(embedding, dtype=np.float32) for block_id, embedding in rows}

    def search_blocks(
        self,
        provision: str,
        commodities: list[str],
        *,
        top_k: int = 100,
    ) -> list[dict[str, Any]]:
        """Return the provision's most similar section blocks, restricted to
        documents tagged with a matching commodity. Ordered by similarity desc."""
        if not isinstance(provision, str) or not provision.strip():
            raise ValueError("provision must be a non-empty string")
        if top_k < 1:
            raise ValueError("top_k must be at least 1")

        doc_ids = self._candidate_doc_ids(commodities)
        if not doc_ids:
            return []

        blocks = self._candidate_blocks(doc_ids)
        if not blocks:
            return []

        embeddings = self._block_embeddings([block["block_id"] for block in blocks])
        query_embedding = self._get_index().embed([provision])[0]

        scored: list[dict[str, Any]] = []
        for block in blocks:
            embedding = embeddings.get(block["block_id"])
            if embedding is None:
                continue
            similarity = float(np.dot(query_embedding, embedding))
            scored.append({**block, "similarity": similarity})

        scored.sort(key=lambda item: item["similarity"], reverse=True)
        return scored[:top_k]

    def top_sections(
        self,
        provision: str,
        commodities: list[str],
        *,
        block_top_k: int = 100,
        sections_per_doc: int = 25,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """From the most similar blocks, keep the most significant sections
        of each matching document (up to `sections_per_doc`), for the top
        `limit` documents, ordered by similarity desc."""
        blocks = self.search_blocks(provision, commodities, top_k=block_top_k)
        if not blocks:
            return []

        best_block_by_section: dict[tuple[Any, Any], dict[str, Any]] = {}
        for block in blocks:
            metadata = block["metadata"]
            key = (metadata.get("doc_id"), metadata.get("section_id"))
            existing = best_block_by_section.get(key)
            if existing is None or block["similarity"] > existing["similarity"]:
                best_block_by_section[key] = block

        sections_by_doc: dict[Any, list[dict[str, Any]]] = {}
        for block in best_block_by_section.values():
            doc_id = block["metadata"].get("doc_id")
            sections_by_doc.setdefault(doc_id, []).append(block)

        ranked_doc_ids = sorted(
            sections_by_doc,
            key=lambda doc_id: max(block["similarity"] for block in sections_by_doc[doc_id]),
            reverse=True,
        )[: max(1, limit)]

        ranked: list[dict[str, Any]] = []
        for doc_id in ranked_doc_ids:
            doc_sections = sorted(sections_by_doc[doc_id], key=lambda block: block["similarity"], reverse=True)
            ranked.extend(doc_sections[: max(1, sections_per_doc)])

        results = []
        for rank, block in enumerate(ranked, start=1):
            metadata = block["metadata"]
            results.append(
                {
                    "rank": rank,
                    "similarity": block["similarity"],
                    "doc_id": metadata.get("doc_id"),
                    "section_id": metadata.get("section_id"),
                    "section": metadata.get("section"),
                    "start_page": metadata.get("start_page"),
                    "end_page": metadata.get("end_page"),
                    "categories": _dedupe_categories(metadata.get("categories")),
                }
            )
        return results

    @staticmethod
    def _section_candidates(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "id": index,
                "doc_id": section.get("doc_id"),
                "section": section.get("section"),
                "categories": section.get("categories"),
                "similarity": section.get("similarity"),
            }
            for index, section in enumerate(sections)
        ]

    def filter_sections(self, provision: str, sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Use the LLM to drop sections that are clearly inadequate or
        unproductive as evidence for the provision, without changing the
        schema of the sections that are kept."""
        if not sections:
            return []

        response = self._get_section_filter().run_sync(
            json.dumps(
                {"provision": provision, "candidates": self._section_candidates(sections)},
                ensure_ascii=False,
            )
        )
        selected_ids = set(response.selected_ids)
        return [section for index, section in enumerate(sections) if index in selected_ids]

    async def filter_sections_async(self, provision: str, sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Async counterpart of `filter_sections`."""
        if not sections:
            return []

        response = await self._get_section_filter().run(
            json.dumps(
                {"provision": provision, "candidates": self._section_candidates(sections)},
                ensure_ascii=False,
            )
        )
        selected_ids = set(response.selected_ids)
        return [section for index, section in enumerate(sections) if index in selected_ids]

    @staticmethod
    def _renumber(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for rank, section in enumerate(sections, start=1):
            section["rank"] = rank
        return sections

    def run(
        self,
        provision: str,
        commodities: list[str],
        *,
        block_top_k: int = 100,
        sections_per_doc: int = 25,
        limit: int = 10,
    ) -> dict[str, Any]:
        candidates = self.top_sections(
            provision, commodities, block_top_k=block_top_k, sections_per_doc=sections_per_doc, limit=limit
        )
        results = self._renumber(self.filter_sections(provision, candidates))
        documents = self._document_metadata(self._candidate_doc_ids(commodities))
        return {
            "output": {
                "input": {"provision": provision, "commodities": commodities},
                "results": results,
                "documents": documents,
            }
        }

    async def run_async(
        self,
        provision: str,
        commodities: list[str],
        *,
        block_top_k: int = 100,
        sections_per_doc: int = 25,
        limit: int = 10,
    ) -> dict[str, Any]:
        candidates = await asyncio.to_thread(
            self.top_sections,
            provision,
            commodities,
            block_top_k=block_top_k,
            sections_per_doc=sections_per_doc,
            limit=limit,
        )
        results = self._renumber(await self.filter_sections_async(provision, candidates))
        documents = self._document_metadata(self._candidate_doc_ids(commodities))
        return {
            "output": {
                "input": {"provision": provision, "commodities": commodities},
                "results": results,
                "documents": documents,
            }
        }
