"""
RateMyProfessors scraper for Eller College of Management faculty.

Extracts for each professor (matching the screenshot fields):
  - quality rating
  - difficulty rating
  - course code
  - date
  - attendance (mandatory / not mandatory)
  - would take again (yes / no)
  - grade received
  - textbook required
  - review text / comment
  - tags
  - thumbs up / thumbs down counts

Usage:
    pip install ratemyprofessors-client
    python rmp_scraper.py
    python rmp_scraper.py --faculty eller_faculty_data.json --out rmp_eller_reviews.json
"""

import argparse
import json
import time
import random
from pathlib import Path
from typing import Any, Dict, List, Optional

from rmp_client import RMPClient
from rmp_client.models import Professor, Rating
from rmp_client import HttpError, ParsingError


# University of Arizona school ID on RateMyProfessors
U_OF_A_SCHOOL_ID = "1413"


def load_faculty_names(path: str) -> List[str]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [entry["name"] for entry in data if entry.get("name")]


def find_uofa_professor(client: RMPClient, name: str) -> Optional[Professor]:
    """
    Search for a professor by name and return the one affiliated with U of A.
    Falls back to the first result if no exact school match is found.
    """
    try:
        result = client.search_professors(name)
        professors = result.professors if hasattr(result, "professors") else []

        # Prefer exact U of A match
        for prof in professors:
            school_id = str(getattr(prof, "school_id", "") or "")
            if school_id == U_OF_A_SCHOOL_ID:
                return prof

        # Fallback: check school name string
        for prof in professors:
            school_name = str(getattr(prof, "school_name", "") or "").lower()
            if "arizona" in school_name and "state" not in school_name:
                return prof

        return None

    except (HttpError, ParsingError, Exception):
        return None


def serialize_rating(rating: Rating, professor_name: str, professor_id: str) -> Dict[str, Any]:
    """Map a Rating object to the fields visible in the screenshot."""
    return {
        "professor_name": professor_name,
        "professor_id": professor_id,
        # Screenshot top-level fields
        "quality": getattr(rating, "quality", None),
        "difficulty": getattr(rating, "difficulty", None),
        "course": getattr(rating, "course", None),
        "date": str(getattr(rating, "date", "") or ""),
        # Screenshot metadata row
        "attendance": getattr(rating, "attendance", None),
        "would_take_again": getattr(rating, "would_take_again", None),
        "grade": getattr(rating, "grade", None),
        "textbook": getattr(rating, "textbook", None),
        # Review body
        "comment": getattr(rating, "comment", None),
        # Tags (pill labels under the comment)
        "tags": getattr(rating, "tags", []) or [],
        # Helpfulness votes
        "thumbs_up": getattr(rating, "thumbs_up", None),
        "thumbs_down": getattr(rating, "thumbs_down", None),
    }


def scrape_professor(client: RMPClient, name: str) -> Dict[str, Any]:
    """Find a professor and collect all their RMP ratings."""
    prof = find_uofa_professor(client, name)

    if prof is None:
        return {
            "name": name,
            "found": False,
            "professor_id": None,
            "overall_rating": None,
            "difficulty": None,
            "would_take_again_pct": None,
            "num_ratings": 0,
            "department": None,
            "ratings": [],
        }

    prof_id = str(prof.id)
    ratings: List[Dict[str, Any]] = []

    try:
        for rating in client.iter_professor_ratings(prof_id):
            ratings.append(serialize_rating(rating, name, prof_id))
            # Small random delay to be polite
            time.sleep(random.uniform(0.1, 0.3))
    except Exception as e:
        print(f"    Warning: error fetching ratings for {name}: {e}")

    return {
        "name": name,
        "found": True,
        "professor_id": prof_id,
        "overall_rating": getattr(prof, "overall_rating", None),
        "difficulty": getattr(prof, "difficulty", None),
        "would_take_again_pct": getattr(prof, "would_take_again", None),
        "num_ratings": getattr(prof, "num_ratings", len(ratings)),
        "department": getattr(prof, "department", None),
        "ratings": ratings,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape RateMyProfessors for Eller faculty.")
    parser.add_argument("--faculty", default="eller_faculty_data.json",
                        help="Path to eller_faculty_data.json")
    parser.add_argument("--out", default="rmp_eller_reviews.json",
                        help="Output JSON file")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="Seconds to wait between professors (default: 1.5)")
    args = parser.parse_args()

    names = load_faculty_names(args.faculty)
    print(f"Loaded {len(names)} faculty members from {args.faculty}")

    results: List[Dict[str, Any]] = []

    with RMPClient() as client:
        for i, name in enumerate(names, 1):
            print(f"[{i}/{len(names)}] {name} ... ", end="", flush=True)
            data = scrape_professor(client, name)

            if data["found"]:
                print(f"found (id={data['professor_id']}, {data['num_ratings']} ratings)")
            else:
                print("not found on RMP")

            results.append(data)

            if i < len(names):
                time.sleep(args.delay + random.uniform(0, 0.5))

    out_path = Path(args.out)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    found = sum(1 for r in results if r["found"])
    total_ratings = sum(len(r["ratings"]) for r in results)
    print(f"\nDone. {found}/{len(names)} professors found, {total_ratings} total ratings.")
    print(f"Output written to: {out_path}")


if __name__ == "__main__":
    main()