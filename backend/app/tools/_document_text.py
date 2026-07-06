"""Shared helper for loading a document's page-mapped text from assets/texts.

Each pickle file is a list of {"page": int, "text": str} entries, one per
page (1-indexed, contiguous), as produced for `datasets_final/documents.json`.
"""

from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any


DEFAULT_TEXTS_DIR = Path(__file__).resolve().parents[1] / "assets" / "texts"

DEFAULT_FULL_TEXT_MAX_PAGES = 20
DEFAULT_CONTEXT_PAGES = 10


def load_document_pages(
    doc_id: str, texts_dir: str | Path = DEFAULT_TEXTS_DIR
) -> list[dict[str, Any]] | None:
    """Return the document's pages sorted ascending, or None if not found."""
    path = Path(texts_dir) / f"{doc_id}.pickle"
    if not path.exists():
        return None

    with path.open("rb") as handle:
        pages = pickle.load(handle)

    return sorted(pages, key=lambda page: page.get("page", 0))


def document_context_text(
    doc_id: str,
    *,
    page_start: int | None = None,
    page_end: int | None = None,
    full_text_max_pages: int = DEFAULT_FULL_TEXT_MAX_PAGES,
    context_pages: int = DEFAULT_CONTEXT_PAGES,
    texts_dir: str | Path = DEFAULT_TEXTS_DIR,
) -> str | None:
    """Return the document's full text (<= full_text_max_pages) or, for
    longer documents, a window of `context_pages` before and after the
    provision's page range. Returns None when the document has no pickled text.
    """
    pages = load_document_pages(doc_id, texts_dir)
    if not pages:
        return None

    if len(pages) <= full_text_max_pages:
        selected = pages
    else:
        anchor_start = page_start if isinstance(page_start, int) else pages[0]["page"]
        anchor_end = page_end if isinstance(page_end, int) else anchor_start
        window_start = anchor_start - context_pages
        window_end = anchor_end + context_pages
        selected = [page for page in pages if window_start <= page.get("page", 0) <= window_end]
        if not selected:
            selected = pages

    return "\n\n".join(page.get("text", "") for page in selected if page.get("text"))
