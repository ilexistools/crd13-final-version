"""Shared commodity normalization helpers used by commodity-filtered search tools."""

from __future__ import annotations

import re

_SPACE = re.compile(r"\s+")
_COMPOUND_SEPARATOR = re.compile(r"\s+(?:and|or)\s+", re.IGNORECASE)


def normalize_commodity(value: str) -> str:
    return _SPACE.sub(" ", value.strip()).casefold()


def commodity_query_terms(value: str) -> set[str]:
    normalized = normalize_commodity(value)
    if not normalized:
        return set()

    terms = {normalized}
    terms.update(
        part
        for part in _COMPOUND_SEPARATOR.split(normalized)
        if part
    )

    for suffix in (" products", " product"):
        for term in tuple(terms):
            if term.endswith(suffix) and not _COMPOUND_SEPARATOR.search(term):
                terms.add(term[: -len(suffix)].strip())
    return {term for term in terms if term}
