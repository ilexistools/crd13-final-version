"""Build a SQLite database of document metadata + commodity associations for section search.

Intentionally contains no embeddings. It only supports fast "which doc_ids match
these commodities" lookups plus document display metadata; the semantic index
lives in a separate SQLite file built by build_sections_vector_index.py.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.tools._commodity_matching import normalize_commodity  # noqa: E402


DEFAULT_INPUT_PATH = ROOT_DIR / "app" / "assets" / "datasets_final" / "documents.json"
DEFAULT_DB_PATH = ROOT_DIR / "app" / "assets" / "indexes" / "sections.sqlite3"


def load_documents(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON list in {path}")
    return [item for item in data if isinstance(item, dict)]


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        DROP TABLE IF EXISTS document_commodities;
        DROP TABLE IF EXISTS documents;

        CREATE TABLE documents (
            doc_id TEXT PRIMARY KEY,
            type TEXT,
            document_type TEXT,
            reference TEXT,
            year TEXT,
            title TEXT,
            label TEXT,
            committee TEXT,
            last_modified TEXT,
            url TEXT,
            commodities_json TEXT NOT NULL,
            processes_json TEXT NOT NULL
        );

        CREATE TABLE document_commodities (
            doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
            commodity TEXT NOT NULL,
            normalized_commodity TEXT NOT NULL,
            PRIMARY KEY (doc_id, normalized_commodity)
        );

        CREATE INDEX idx_document_commodities_normalized
            ON document_commodities(normalized_commodity);
        """
    )


def build_database(documents: list[dict[str, Any]], db_path: Path) -> tuple[int, int]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = DELETE")
        create_schema(connection)

        commodity_rows: list[tuple[str, str, str]] = []
        for document in documents:
            doc_id = document.get("doc_id")
            if not isinstance(doc_id, str) or not doc_id:
                continue

            commodities = [
                commodity
                for commodity in document.get("commodities") or []
                if isinstance(commodity, str) and commodity.strip()
            ]
            processes = [
                process
                for process in document.get("processes") or []
                if isinstance(process, str) and process.strip()
            ]

            connection.execute(
                """
                INSERT OR REPLACE INTO documents (
                    doc_id, type, document_type, reference, year, title, label,
                    committee, last_modified, url, commodities_json, processes_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    doc_id,
                    document.get("type"),
                    document.get("document_type"),
                    document.get("reference"),
                    document.get("year"),
                    document.get("title"),
                    document.get("label"),
                    document.get("committee"),
                    document.get("last_modified"),
                    document.get("url"),
                    json.dumps(commodities, ensure_ascii=False),
                    json.dumps(processes, ensure_ascii=False),
                ),
            )

            for commodity in commodities:
                commodity_rows.append((doc_id, commodity, normalize_commodity(commodity)))

        connection.executemany(
            """
            INSERT OR IGNORE INTO document_commodities (doc_id, commodity, normalized_commodity)
            VALUES (?, ?, ?)
            """,
            commodity_rows,
        )
        connection.execute("ANALYZE")
        commodity_count = connection.execute(
            "SELECT COUNT(*) FROM document_commodities"
        ).fetchone()[0]

    return len(documents), commodity_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a SQLite database of document metadata indexed by commodity."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT_PATH)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    documents = load_documents(args.input)
    document_count, commodity_count = build_database(documents, args.db)
    print(f"Read documents: {document_count}")
    print(f"Wrote commodity associations: {commodity_count}")
    print(f"SQLite database: {args.db}")


if __name__ == "__main__":
    main()
