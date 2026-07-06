"""Shared helper for loading document display metadata from sections.sqlite3."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Iterable


DEFAULT_SECTIONS_DB_PATH = Path(__file__).resolve().parents[1] / "assets" / "indexes" / "sections.sqlite3"


def fetch_documents_by_id(db_path: str | Path, doc_ids: Iterable[str]) -> dict[str, dict[str, Any]]:
    """Return {doc_id: metadata} for the given doc_ids.

    Reads sections.sqlite3's `documents` table (built by
    app/prepare/build_sections_sqlite.py from datasets_final/documents.json).
    """
    doc_id_list = sorted({doc_id for doc_id in doc_ids if isinstance(doc_id, str) and doc_id})
    if not doc_id_list:
        return {}

    path = Path(db_path)
    if not path.exists():
        raise FileNotFoundError(
            f"Sections database not found: {path}. Build it with app/prepare/build_sections_sqlite.py."
        )

    placeholders = ", ".join("?" for _ in doc_id_list)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            f"""
            SELECT doc_id, type, document_type, reference, year, title, label,
                   committee, last_modified, url, commodities_json, processes_json
            FROM documents
            WHERE doc_id IN ({placeholders})
            """,
            doc_id_list,
        ).fetchall()
    finally:
        connection.close()

    return {
        row["doc_id"]: {
            "doc_id": row["doc_id"],
            "type": row["type"],
            "document_type": row["document_type"],
            "reference": row["reference"],
            "year": row["year"],
            "title": row["title"],
            "label": row["label"],
            "committee": row["committee"],
            "last_modified": row["last_modified"],
            "url": row["url"],
            "commodities": json.loads(row["commodities_json"] or "[]"),
            "processes": json.loads(row["processes_json"] or "[]"),
        }
        for row in rows
    }
