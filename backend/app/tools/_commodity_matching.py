"""Shared commodity normalization helpers used by commodity-filtered search tools."""

from __future__ import annotations

import re

_SPACE = re.compile(r"\s+")


def normalize_commodity(value: str) -> str:
    return _SPACE.sub(" ", value.strip()).casefold()


def commodity_query_terms(value: str) -> set[str]:
    normalized = normalize_commodity(value)
    if not normalized:
        return set()

    terms = {normalized}
    for suffix in (" products", " product"):
        if normalized.endswith(suffix):
            terms.add(normalized[: -len(suffix)].strip())
    return {term for term in terms if term}
