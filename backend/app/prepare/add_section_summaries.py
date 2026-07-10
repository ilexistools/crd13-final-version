from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Iterable

from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.orchestration import gpt  # noqa: E402
from app.orchestration.config import default_model  # noqa: E402


DEFAULT_SECTIONS_PATH = (
    ROOT_DIR / "app" / "assets" / "datasets_final" / "documents_and_sections.json"
)
DEFAULT_FIELD_NAME = "section_summary"
DEFAULT_BATCH_SIZE = 8
DEFAULT_MAX_CONCURRENT_BATCHES = 2
DEFAULT_CHECKPOINT_EVERY_BATCHES = 1
DEFAULT_MAX_SECTION_CHARS = 12000


class SectionSummary(BaseModel):
    doc_id: str
    section_id: int | str
    summary: str = Field(
        description=(
            "Concise English summary of the section text for deciding whether "
            "the section is useful as a reference for rewriting an attestation."
        )
    )


class SectionSummaryBatch(BaseModel):
    results: list[SectionSummary]


INSTRUCTIONS = """
You summarize Codex Alimentarius and sanitary/regulatory document sections.

Goal
Create concise section summaries that help another agent decide whether a
section is meaningful as a reference for rewriting an attestation.

Summary rules
- Write in English.
- Preserve regulatory meaning; do not add facts that are not in the section.
- Prefer one sentence. Use two only when needed for conditions, thresholds, or
  exceptions.
- Mention the specific regulatory subject, commodity/product/process when clear.
- Mention obligations, prohibitions, definitions, limits, tests, certificates,
  inspection criteria, competent authorities, conditions, or exceptions when
  present.
- If the section is only a heading, table of contents item, bibliography,
  foreword, editorial note, or otherwise not a substantive reference, say that
  plainly and briefly.
- Do not quote long passages.
- Return JSON matching the requested schema.
"""


def load_json_list(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON list in {path}")
    return [item for item in data if isinstance(item, dict)]


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def chunks(items: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def section_key(doc_id: str, section_id: int | str) -> str:
    return f"{doc_id}::{section_id}"


def normalize_summary(value: str) -> str:
    return " ".join(value.split())


def iter_sections(
    documents: list[dict[str, Any]],
) -> Iterable[tuple[dict[str, Any], dict[str, Any]]]:
    for document in documents:
        doc_id = document.get("doc_id")
        if not isinstance(doc_id, str) or not doc_id:
            continue
        for section in document.get("sections") or []:
            if isinstance(section, dict):
                yield document, section


def eligible_sections(
    documents: list[dict[str, Any]],
    *,
    field_name: str,
    overwrite: bool,
    leaf_only: bool,
    limit: int | None,
) -> list[dict[str, Any]]:
    pending: list[dict[str, Any]] = []
    for document, section in iter_sections(documents):
        if leaf_only and not section.get("is_leaf"):
            continue
        if not overwrite and isinstance(section.get(field_name), str) and section[field_name].strip():
            continue

        section_id = section.get("section_id")
        text = section.get("text")
        if section_id is None or not isinstance(text, str) or not text.strip():
            if overwrite or field_name not in section:
                section[field_name] = ""
            continue

        pending.append(
            {
                "doc_id": document["doc_id"],
                "section_id": section_id,
                "section": section,
            }
        )
        if limit is not None and len(pending) >= limit:
            break

    return pending


def apply_summaries(
    documents: list[dict[str, Any]],
    summaries: dict[str, str],
    *,
    field_name: str,
) -> int:
    updated = 0
    for document, section in iter_sections(documents):
        doc_id = document.get("doc_id")
        section_id = section.get("section_id")
        if not isinstance(doc_id, str) or section_id is None:
            continue
        summary = summaries.get(section_key(doc_id, section_id))
        if summary is None:
            continue
        section[field_name] = summary
        updated += 1
    return updated


def load_existing_summaries(
    documents: list[dict[str, Any]],
    *,
    field_name: str,
) -> dict[str, str]:
    summaries: dict[str, str] = {}
    for document, section in iter_sections(documents):
        doc_id = document.get("doc_id")
        section_id = section.get("section_id")
        summary = section.get(field_name)
        if (
            isinstance(doc_id, str)
            and section_id is not None
            and isinstance(summary, str)
            and summary.strip()
        ):
            summaries[section_key(doc_id, section_id)] = normalize_summary(summary)
    return summaries


def build_summarizer(model: str, max_output_tokens: int) -> gpt.GPT:
    return gpt.GPT(
        name="Section summarizer",
        role="You create concise regulatory section summaries.",
        instructions=INSTRUCTIONS,
        model=model,
        output_type=SectionSummaryBatch,
        max_tokens=max_output_tokens,
    )


def build_payload(batch: list[dict[str, Any]], max_section_chars: int) -> list[dict[str, Any]]:
    payload = []
    for item in batch:
        section = item["section"]
        text = section.get("text") or ""
        if len(text) > max_section_chars:
            text = text[:max_section_chars] + "\n\n[TRUNCATED]"

        payload.append(
            {
                "doc_id": item["doc_id"],
                "section_id": section.get("section_id"),
                "section_title": section.get("section"),
                "is_leaf": section.get("is_leaf"),
                "categories": section.get("categories") or [],
                "text": text,
            }
        )
    return payload


async def summarize_batch(
    summarizer: gpt.GPT,
    batch: list[dict[str, Any]],
    *,
    max_section_chars: int,
    retries: int = 3,
) -> list[SectionSummary]:
    payload = build_payload(batch, max_section_chars)
    prompt = (
        "Summarize each section in this JSON array. "
        "Return exactly one result per input doc_id and section_id.\n\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )

    expected_keys = {
        section_key(str(item["doc_id"]), item["section"]["section_id"]) for item in batch
    }

    for attempt in range(1, retries + 1):
        try:
            result = await summarizer.run(prompt)
            by_key = {
                section_key(str(item.doc_id), item.section_id): item for item in result.results
            }
            missing = sorted(expected_keys - set(by_key))
            if missing:
                raise ValueError(
                    f"Model response missing section keys: {', '.join(missing[:5])}"
                )
            return [by_key[section_key(str(item["doc_id"]), item["section"]["section_id"])] for item in batch]
        except Exception:
            if attempt == retries:
                raise
            await asyncio.sleep(2**attempt)

    raise RuntimeError("unreachable")


async def process_batch_with_fallback(
    summarizer: gpt.GPT,
    batch: list[dict[str, Any]],
    semaphore: asyncio.Semaphore,
    *,
    max_section_chars: int,
) -> list[SectionSummary]:
    async with semaphore:
        try:
            return await summarize_batch(
                summarizer,
                batch,
                max_section_chars=max_section_chars,
            )
        except Exception as batch_error:
            if len(batch) == 1:
                raise batch_error
            print(
                f"Batch failed with {len(batch)} sections; retrying one section at a time. "
                f"Error: {batch_error}"
            )

    results: list[SectionSummary] = []
    for section in batch:
        async with semaphore:
            single_result = await summarize_batch(
                summarizer,
                [section],
                max_section_chars=max_section_chars,
            )
            results.extend(single_result)
    return results


async def process_numbered_batch(
    summarizer: gpt.GPT,
    batch_index: int,
    batch: list[dict[str, Any]],
    semaphore: asyncio.Semaphore,
    *,
    batch_count: int,
    max_section_chars: int,
) -> tuple[int, list[SectionSummary]]:
    print(f"Processing batch {batch_index}/{batch_count} ({len(batch)} sections)")
    results = await process_batch_with_fallback(
        summarizer,
        batch,
        semaphore,
        max_section_chars=max_section_chars,
    )
    return batch_index, results


async def run_async(args: argparse.Namespace) -> None:
    documents = load_json_list(args.input)
    existing_summaries = load_existing_summaries(documents, field_name=args.field)
    initial_existing_count = 0 if args.overwrite else len(existing_summaries)
    pending_sections = eligible_sections(
        documents,
        field_name=args.field,
        overwrite=args.overwrite,
        leaf_only=args.leaf_only,
        limit=args.limit,
    )
    output_path = args.output or args.input

    print(f"Read document entries: {len(documents)}")
    print(f"Existing summaries: {len(existing_summaries)}")
    print(f"Pending sections selected: {len(pending_sections)}")
    print(f"Output: {output_path}")

    if args.dry_run:
        return

    if not pending_sections:
        write_json(output_path, documents)
        print("No pending summaries. Output refreshed.")
        return

    summarizer = build_summarizer(args.model, args.max_output_tokens)
    semaphore = asyncio.Semaphore(args.max_concurrent_batches)
    batches = list(chunks(pending_sections, args.batch_size))
    tasks = [
        asyncio.create_task(
            process_numbered_batch(
                summarizer,
                batch_index,
                batch,
                semaphore,
                batch_count=len(batches),
                max_section_chars=args.max_section_chars,
            )
        )
        for batch_index, batch in enumerate(batches, start=1)
    ]

    summaries = existing_summaries if not args.overwrite else {}
    completed_batches_since_checkpoint = 0
    for completed_task in asyncio.as_completed(tasks):
        batch_index, batch_results = await completed_task
        for result in batch_results:
            summaries[section_key(str(result.doc_id), result.section_id)] = normalize_summary(
                result.summary
            )

        completed_batches_since_checkpoint += 1
        if completed_batches_since_checkpoint >= args.checkpoint_every_batches:
            apply_summaries(documents, summaries, field_name=args.field)
            write_json(output_path, documents)
            completed_batches_since_checkpoint = 0
            processed_selected = max(len(summaries) - initial_existing_count, 0)
            remaining_selected = max(len(pending_sections) - processed_selected, 0)
            print(
                f"Checkpoint saved after batch {batch_index}: "
                f"{len(summaries)} summaries; {remaining_selected} pending"
            )

    updated = apply_summaries(documents, summaries, field_name=args.field)
    write_json(output_path, documents)
    print(f"Done. Sections with {args.field}: {updated}; 0 pending")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Add concise LLM-generated summaries to each section in "
            "documents_and_sections.json."
        )
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_SECTIONS_PATH)
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output path. Defaults to updating --input in place.",
    )
    parser.add_argument("--field", default=DEFAULT_FIELD_NAME)
    parser.add_argument("--model", default=default_model())
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument(
        "--max-concurrent-batches",
        type=int,
        default=DEFAULT_MAX_CONCURRENT_BATCHES,
    )
    parser.add_argument(
        "--checkpoint-every-batches",
        type=int,
        default=DEFAULT_CHECKPOINT_EVERY_BATCHES,
    )
    parser.add_argument("--max-section-chars", type=int, default=DEFAULT_MAX_SECTION_CHARS)
    parser.add_argument("--max-output-tokens", type=int, default=6000)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Regenerate summaries even when the field already exists and is non-empty.",
    )
    parser.add_argument(
        "--leaf-only",
        action="store_true",
        help="Only summarize leaf sections.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Read inputs and report how many sections would be summarized.",
    )
    return parser.parse_args()


def main() -> None:
    asyncio.run(run_async(parse_args()))


if __name__ == "__main__":
    main()
