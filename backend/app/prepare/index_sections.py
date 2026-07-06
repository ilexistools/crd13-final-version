from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.embeddings.chunker import chunk_text  # noqa: E402
from app.tools._commodity_matching import normalize_commodity  # noqa: E402


DEFAULT_DOCUMENTS_PATH = ROOT_DIR / "app" / "assets" / "datasets_final" / "documents.json"
DEFAULT_SECTIONS_PATH = (
    ROOT_DIR / "app" / "assets" / "datasets_final" / "documents_and_sections.json"
)
DEFAULT_OUTPUT_PATH = ROOT_DIR / "app" / "assets" / "resources" / "sections_index_documents.json"

DEFAULT_CHUNK_SIZE = 300
DEFAULT_CHUNK_OVERLAP = 50

_SPACE = re.compile(r"\s+")


def _normalize_text(value: str) -> str:
    return _SPACE.sub(" ", value.strip())


def load_json_list(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON list in {path}")
    return [item for item in data if isinstance(item, dict)]


def build_documents_map(documents: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    doc_map: dict[str, dict[str, Any]] = {}
    for document in documents:
        doc_id = document.get("doc_id")
        if not isinstance(doc_id, str) or not doc_id:
            continue
        commodities = [
            commodity
            for commodity in document.get("commodities") or []
            if isinstance(commodity, str) and commodity.strip()
        ]
        doc_map[doc_id] = {
            "doc_id": doc_id,
            "commodities": commodities,
            "normalized_commodities": [normalize_commodity(c) for c in commodities],
        }
    return doc_map


def build_index_documents(
    documents: list[dict[str, Any]],
    document_sections: list[dict[str, Any]],
    *,
    chunk_size: int,
    chunk_overlap: int,
) -> list[dict[str, Any]]:
    doc_map = build_documents_map(documents)

    index_documents: list[dict[str, Any]] = []
    skipped_docs = 0

    for doc_entry in document_sections:
        doc_id = doc_entry.get("doc_id")
        doc_meta = doc_map.get(doc_id) if isinstance(doc_id, str) else None
        if doc_meta is None:
            skipped_docs += 1
            print(f"WARNING: doc_id {doc_id!r} not found in documents.json, skipping.")
            continue

        for section in doc_entry.get("sections") or []:
            if not isinstance(section, dict) or not section.get("is_leaf"):
                continue

            section_id = section.get("section_id")
            section_title = section.get("section")
            text = section.get("text")
            if not isinstance(text, str):
                continue

            normalized_section_text = _normalize_text(text)
            if not normalized_section_text:
                continue

            blocks = chunk_text(
                normalized_section_text,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
            if not blocks:
                continue

            total_blocks = len(blocks)
            for block_index, block in enumerate(blocks):
                index_documents.append(
                    {
                        "id": f"{doc_id}#section-{section_id}#block-{block_index}",
                        "text": block,
                        "metadata": {
                            "doc_id": doc_id,
                            "section_id": section_id,
                            "section": section_title,
                            "order": section.get("order"),
                            "start_page": section.get("start_page"),
                            "end_page": section.get("end_page"),
                            "tokens": section.get("tokens"),
                            "categories": section.get("categories") or [],
                            "block_index": block_index,
                            "total_blocks": total_blocks,
                            "commodities": doc_meta["commodities"],
                            "normalized_commodities": doc_meta["normalized_commodities"],
                        },
                    }
                )

    if skipped_docs:
        print(f"Skipped {skipped_docs} document(s) with no matching entry in documents.json")

    return index_documents


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create block-level JSON index documents from datasets_final leaf sections, "
            "ready for semantic (embedding) indexing."
        )
    )
    parser.add_argument("--documents", type=Path, default=DEFAULT_DOCUMENTS_PATH)
    parser.add_argument("--sections", type=Path, default=DEFAULT_SECTIONS_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE)
    parser.add_argument("--chunk-overlap", type=int, default=DEFAULT_CHUNK_OVERLAP)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    documents = load_json_list(args.documents)
    document_sections = load_json_list(args.sections)

    index_documents = build_index_documents(
        documents,
        document_sections,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
    )
    write_json(args.output, index_documents)

    print(f"Read documents: {len(documents)}")
    print(f"Read document-section entries: {len(document_sections)}")
    print(f"Wrote index documents (blocks): {len(index_documents)}")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
