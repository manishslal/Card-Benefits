#!/usr/bin/env python3
"""General-purpose lounge deduplication utility.

Finds and merges duplicate lounges at the same airport+terminal using
fuzzy name matching.  Operates in two modes:

  --dry-run   Print candidate pairs with similarity scores (no DB writes)
  (live)      Merge duplicate pairs: keep the more-complete record, move
              access rules, delete the less-complete record, and log to
              lounge_dedup_log.

Usage:
    python3 scrapers/dedup_lounges.py --dry-run --airports JFK
    python3 scrapers/dedup_lounges.py --airports JFK
    python3 scrapers/dedup_lounges.py --airports JFK LAX --threshold 0.75
"""

import argparse
import logging
import sys
import uuid
from difflib import SequenceMatcher
from itertools import combinations

# Allow execution both as ``python3 scrapers/dedup_lounges.py`` (package
# import) and ``python3 -m scrapers.dedup_lounges`` (module import).
try:
    from scrapers.database import get_cursor
except ImportError:
    from database import get_cursor

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ID generator (matches repository.py convention)
# ---------------------------------------------------------------------------

def _generate_id() -> str:
    return "cl" + uuid.uuid4().hex[:23]


# ---------------------------------------------------------------------------
# Similarity helpers
# ---------------------------------------------------------------------------

def _similarity(name_a: str, name_b: str) -> tuple[float, float, float]:
    """Return (effective_similarity, seq_ratio, word_containment).

    effective_similarity  – the score used for threshold comparison.
    seq_ratio             – raw SequenceMatcher ratio (0–1).
    word_containment      – fraction of the shorter name's words found in
                            the longer name's words (0–1).

    Matching strategy:
      - If ALL words from the shorter name appear in the longer name
        (word_containment == 1.0), the effective similarity is 1.0.
        This catches pairs like "HelloSky" / "HelloSky Lounge" that
        SequenceMatcher under-scores due to length difference.
      - Otherwise, effective similarity is the raw SequenceMatcher ratio.
        This correctly separates "Lufthansa Business Lounge" from
        "Lufthansa Senator Lounge" (different lounges sharing a prefix).
    """
    seq_ratio = SequenceMatcher(None, name_a.lower(), name_b.lower()).ratio()

    words_a = set(name_a.lower().split())
    words_b = set(name_b.lower().split())
    shorter, longer = (words_a, words_b) if len(words_a) <= len(words_b) else (words_b, words_a)
    word_containment = len(shorter & longer) / len(shorter) if shorter else 0.0

    if word_containment >= 1.0 and seq_ratio >= 0.5:
        effective = 1.0
    else:
        effective = seq_ratio

    return effective, seq_ratio, word_containment


# ---------------------------------------------------------------------------
# Completeness scoring
# ---------------------------------------------------------------------------

def _completeness_score(lounge_row: dict) -> int:
    """Score how complete a lounge record is.  Higher = more complete."""
    score = 0
    if lounge_row.get("operating_hours"):
        score += 3
    if lounge_row.get("image_url"):
        score += 2
    if lounge_row.get("source_url"):
        score += 2
    if lounge_row.get("amenities"):
        score += 1
    return score


def _access_rule_count(cur, lounge_id: str) -> int:
    """Return number of access rules for a lounge."""
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM lounge_access_rules WHERE lounge_id = %s",
        (lounge_id,),
    )
    return cur.fetchone()["cnt"]


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _ensure_dedup_log_table(cur) -> None:
    """Create the lounge_dedup_log table if it does not exist."""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lounge_dedup_log (
            id          TEXT PRIMARY KEY,
            kept_id     TEXT NOT NULL,
            deleted_id  TEXT NOT NULL,
            kept_name   TEXT NOT NULL,
            deleted_name TEXT NOT NULL,
            terminal    TEXT,
            airport     TEXT,
            similarity  DOUBLE PRECISION,
            merged_at   TIMESTAMP DEFAULT NOW()
        )
    """)


def _get_lounges_at_airport(cur, iata_code: str) -> list[dict]:
    """Fetch all lounges at an airport with terminal info."""
    cur.execute("""
        SELECT l.*, lt.name AS terminal_name, la.iata_code AS airport_iata
        FROM lounges l
        JOIN lounge_terminals lt ON lt.id = l.terminal_id
        JOIN lounge_airports la ON la.id = lt.airport_id
        WHERE la.iata_code = %s
        ORDER BY lt.name, l.name
    """, (iata_code,))
    return [dict(row) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Core dedup logic
# ---------------------------------------------------------------------------

def find_duplicate_pairs(
    lounges: list[dict],
    threshold: float = 0.7,
) -> list[dict]:
    """Find candidate duplicate pairs among *lounges*.

    Only compares lounges sharing the same terminal_id.
    Returns a list of dicts with keys:
        lounge_a, lounge_b, similarity, seq_ratio, word_containment,
        keep (the more-complete record), drop (the less-complete record).
    """
    # Group by terminal_id
    by_terminal: dict[str, list[dict]] = {}
    for lg in lounges:
        by_terminal.setdefault(lg["terminal_id"], []).append(lg)

    pairs: list[dict] = []
    for _tid, group in by_terminal.items():
        if len(group) < 2:
            continue
        for a, b in combinations(group, 2):
            eff, seq_ratio, wc = _similarity(a["name"], b["name"])
            if eff < threshold:
                continue

            # Decide which to keep (higher score wins)
            score_a = _completeness_score(a)
            score_b = _completeness_score(b)

            if score_a > score_b:
                keep, drop = a, b
            elif score_b > score_a:
                keep, drop = b, a
            else:
                # Tie-break: prefer longer name (more descriptive)
                if len(a["name"]) >= len(b["name"]):
                    keep, drop = a, b
                else:
                    keep, drop = b, a

            pairs.append({
                "lounge_a": a,
                "lounge_b": b,
                "similarity": eff,
                "seq_ratio": seq_ratio,
                "word_containment": wc,
                "keep": keep,
                "drop": drop,
                "score_keep": _completeness_score(keep),
                "score_drop": _completeness_score(drop),
            })

    # Sort by similarity descending for readability
    pairs.sort(key=lambda p: p["similarity"], reverse=True)
    return pairs


def merge_pair(cur, pair: dict) -> None:
    """Merge a duplicate pair: move access rules, delete the drop record, log."""
    keep = pair["keep"]
    drop = pair["drop"]

    # 1. Move access rules from drop → keep (ON CONFLICT DO NOTHING)
    cur.execute("""
        INSERT INTO lounge_access_rules (id, lounge_id, access_method_id,
            guest_limit, guest_fee, guest_conditions, entry_cost,
            time_limit_hours, conditions, notes, last_verified_at, created_at)
        SELECT %s || substr(id, 3), %s, access_method_id,
            guest_limit, guest_fee, guest_conditions, entry_cost,
            time_limit_hours, conditions, notes, last_verified_at, created_at
        FROM lounge_access_rules
        WHERE lounge_id = %s
        ON CONFLICT (lounge_id, access_method_id) DO NOTHING
    """, (_generate_id()[:5], keep["id"], drop["id"]))

    # 2. Delete access rules on the drop record (they've been copied or were dupes)
    cur.execute(
        "DELETE FROM lounge_access_rules WHERE lounge_id = %s",
        (drop["id"],),
    )

    # 3. Delete the drop lounge record
    cur.execute("DELETE FROM lounges WHERE id = %s", (drop["id"],))

    # 4. Log the merge
    _ensure_dedup_log_table(cur)
    cur.execute("""
        INSERT INTO lounge_dedup_log (id, kept_id, deleted_id, kept_name,
            deleted_name, terminal, airport, similarity, merged_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
    """, (
        _generate_id(),
        keep["id"],
        drop["id"],
        keep["name"],
        drop["name"],
        keep.get("terminal_name", ""),
        keep.get("airport_iata", ""),
        pair["similarity"],
    ))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _print_dry_run(pairs: list[dict], airport: str) -> None:
    """Pretty-print candidate pairs for human review."""
    if not pairs:
        print(f"\n  [{airport}] No duplicate candidates found.\n")
        return

    print(f"\n  [{airport}] Found {len(pairs)} candidate pair(s):\n")
    print(f"  {'#':>3}  {'Similarity':>10}  {'SeqMatch':>8}  {'WordCont':>8}  "
          f"{'Keep (score)':40s}  {'Drop (score)':40s}  Terminal")
    print(f"  {'─' * 3}  {'─' * 10}  {'─' * 8}  {'─' * 8}  {'─' * 40}  {'─' * 40}  {'─' * 20}")

    for i, p in enumerate(pairs, 1):
        keep_label = f"{p['keep']['name']} ({p['score_keep']})"
        drop_label = f"{p['drop']['name']} ({p['score_drop']})"
        terminal = p["keep"].get("terminal_name", "?")
        print(
            f"  {i:3d}  {p['similarity']:10.3f}  {p['seq_ratio']:8.3f}  "
            f"{p['word_containment']:8.3f}  {keep_label:40s}  {drop_label:40s}  {terminal}"
        )
    print()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Find and merge duplicate lounges using fuzzy name matching.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print candidate pairs without making any changes.",
    )
    parser.add_argument(
        "--airports",
        nargs="+",
        metavar="IATA",
        required=True,
        help="Space-separated IATA airport codes to process (e.g. JFK LAX).",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.7,
        help="Minimum similarity score to consider a pair as duplicate (default: 0.7).",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    for iata in args.airports:
        iata = iata.upper()
        print(f"\n{'=' * 70}")
        print(f"  Processing airport: {iata}")
        print(f"{'=' * 70}")

        with get_cursor() as cur:
            lounges = _get_lounges_at_airport(cur, iata)
            print(f"  Found {len(lounges)} lounges at {iata}")

            pairs = find_duplicate_pairs(lounges, threshold=args.threshold)

            if args.dry_run:
                _print_dry_run(pairs, iata)
            else:
                if not pairs:
                    print(f"  [{iata}] No duplicates to merge.\n")
                    continue

                print(f"  [{iata}] Merging {len(pairs)} pair(s)...\n")
                _ensure_dedup_log_table(cur)

                for i, p in enumerate(pairs, 1):
                    keep = p["keep"]
                    drop = p["drop"]

                    # Count rules before merge
                    rules_before = _access_rule_count(cur, keep["id"])
                    rules_moving = _access_rule_count(cur, drop["id"])

                    merge_pair(cur, p)

                    rules_after = _access_rule_count(cur, keep["id"])

                    print(
                        f"  [{i}] MERGED: \"{drop['name']}\" → \"{keep['name']}\"\n"
                        f"       Terminal: {keep.get('terminal_name', '?')}\n"
                        f"       Similarity: {p['similarity']:.3f}\n"
                        f"       Rules: kept had {rules_before}, "
                        f"moved {rules_moving} from drop, "
                        f"now has {rules_after}\n"
                    )

                print(f"  [{iata}] Done — {len(pairs)} merge(s) completed.\n")


if __name__ == "__main__":
    main()
