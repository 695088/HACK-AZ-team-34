#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import re
import time
import random
import sys
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


COURSICLE_BASE_URL = "https://www.coursicle.com"

# ⚙️ CONFIGURATION - Adjust these to avoid rate limits
CONFIG = {
    "min_delay": 3.0,          # Minimum seconds between requests
    "max_delay": 7.0,          # Maximum seconds for random jitter
    "retry_total": 3,          # Max retry attempts for failed requests
    "retry_backoff": 2.0,      # Exponential backoff multiplier
    "timeout": 45,             # Request timeout in seconds
    "user_agents": [           # Rotate user agents to appear more human
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    ]
}


@dataclass(frozen=True)
class CourseKey:
    school: str
    subject: str
    number: str

    @property
    def code(self) -> str:
        return f"{self.subject} {self.number}"

    @property
    def course_url(self) -> str:
        return f"{COURSICLE_BASE_URL}/{self.school}/courses/{self.subject}/{self.number}/"


def _log(msg: str, level: str = "INFO"):
    """Simple logging helper with timestamp"""
    timestamp = dt.datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}", file=sys.stderr)


def _normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _create_session() -> requests.Session:
    """Create a resilient requests session with retry logic and headers"""
    session = requests.Session()
    
    # Retry strategy for 429, 5xx errors with exponential backoff
    retries = Retry(
        total=CONFIG["retry_total"],
        backoff_factor=CONFIG["retry_backoff"],
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"],
        raise_on_status=False,  # Return response instead of raising, so we can handle 429 manually
    )
    
    adapter = HTTPAdapter(max_retries=retries)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    
    # Set headers
    session.headers.update({
        "User-Agent": random.choice(CONFIG["user_agents"]),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
    })
    
    return session


def _safe_request(session: requests.Session, method: str, url: str, **kwargs) -> Optional[requests.Response]:
    """
    Make a request with explicit 429 handling and manual retry with longer backoff.
    Returns None if all retries exhausted.
    """
    kwargs.setdefault("timeout", CONFIG["timeout"])
    
    for attempt in range(CONFIG["retry_total"] + 1):
        try:
            resp = session.request(method, url, **kwargs)
            
            # Handle 429 explicitly with longer wait
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                if retry_after:
                    wait = int(retry_after)
                else:
                    # Exponential backoff: 15s, 30s, 60s
                    wait = 15 * (2 ** attempt)
                
                _log(f"Rate limited (429) on {url}. Waiting {wait}s before retry {attempt+1}/{CONFIG['retry_total']}", "WARN")
                time.sleep(wait)
                continue
            
            # Raise for other HTTP errors (4xx, 5xx)
            resp.raise_for_status()
            return resp
            
        except requests.exceptions.RequestException as e:
            _log(f"Request error on {url} (attempt {attempt+1}): {e}", "WARN")
            if attempt < CONFIG["retry_total"]:
                wait = CONFIG["retry_backoff"] ** attempt
                _log(f"Retrying in {wait:.1f}s...", "WARN")
                time.sleep(wait)
            else:
                _log(f"All retries exhausted for {url}", "ERROR")
                return None
    
    return None


def _parse_professors_from_course_page(html: str) -> List[str]:
    names = re.findall(r'class="professorLink"[^>]*>([^<]+)</a>', html)
    seen = set()
    out: List[str] = []
    for n in names:
        n = _normalize_space(n)
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def _get_or_create_uuid(session: requests.Session, school: str) -> Optional[str]:
    url = f"{COURSICLE_BASE_URL}/shared/loginless/backend/getSetUserData.php"
    resp = _safe_request(session, "POST", url, data={
        "clientType": "web", 
        "isRootRequest": "true", 
        "school": school
    })
    
    if not resp:
        return None
    
    try:
        data = resp.json()
        uuid = data.get("uuid")
        if not uuid:
            _log(f"Could not obtain uuid from response keys: {list(data.keys())}", "ERROR")
            return None
        return uuid
    except json.JSONDecodeError as e:
        _log(f"Failed to parse UUID response: {e}", "ERROR")
        return None


def _fetch_professor_reviews(
    session: requests.Session, school: str, professor: str, uuid: str
) -> Optional[List[Dict[str, Any]]]:
    url = f"{COURSICLE_BASE_URL}/shared/reviews/getReviews.php"
    resp = _safe_request(session, "GET", url, params={
        "school": school, 
        "professor": professor, 
        "uuid": uuid
    })
    
    if not resp:
        return None
    
    try:
        data = resp.json()
        if not isinstance(data, list):
            _log(f"Unexpected reviews payload for {professor}: {type(data)}", "ERROR")
            return None
        return data
    except json.JSONDecodeError as e:
        _log(f"Failed to parse reviews for {professor}: {e}", "ERROR")
        return None


def _parse_submitted(submitted: Optional[str]) -> Tuple[Optional[str], Optional[int]]:
    if not submitted:
        return None, None
    try:
        d = dt.datetime.strptime(submitted, "%Y-%m-%d %H:%M:%S")
        return d.replace(microsecond=0).isoformat(), d.year
    except ValueError:
        return submitted, None


def _age_label(submitted_iso: Optional[str], now: Optional[dt.datetime] = None) -> Optional[str]:
    if not submitted_iso:
        return None
    try:
        d = dt.datetime.fromisoformat(submitted_iso)
    except ValueError:
        return None
    now = now or dt.datetime.now()
    delta = now - d
    days = max(delta.days, 0)
    if days >= 365:
        return f"{days // 365}y"
    if days >= 30:
        return f"{days // 30}mo"
    if days >= 7:
        return f"{days // 7}w"
    return f"{days}d"


def scrape_course_reviews(course: CourseKey) -> Optional[Dict[str, Any]]:
    session = _create_session()
    
    try:
        # 🎯 Step 1: Fetch course page
        _log(f"Fetching course page: {course.course_url}")
        course_resp = _safe_request(session, "GET", course.course_url)
        if not course_resp:
            _log(f"Failed to fetch course page for {course.code}", "ERROR")
            return None
        
        professors = _parse_professors_from_course_page(course_resp.text)
        if not professors:
            _log("Could not find professors on course page", "ERROR")
            return None
        
        _log(f"Found {len(professors)} professor(s): {', '.join(professors)}")
        
        # 🎯 Step 2: Get UUID for review API
        _log("Obtaining session UUID...")
        uuid = _get_or_create_uuid(session, course.school)
        if not uuid:
            _log("Failed to obtain UUID", "ERROR")
            return None
        
        # 🎯 Step 3: Fetch reviews for each professor
        reviews_by_prof: Dict[str, List[Dict[str, Any]]] = {}
        all_reviews: List[Dict[str, Any]] = []
        
        for i, prof in enumerate(professors, 1):
            _log(f"[{i}/{len(professors)}] Fetching reviews for {prof}...")
            
            # Add delay between professor requests
            if i > 1:
                delay = random.uniform(CONFIG["min_delay"], CONFIG["max_delay"])
                _log(f"Waiting {delay:.1f}s before next professor...")
                time.sleep(delay)
            
            raw = _fetch_professor_reviews(session, course.school, prof, uuid)
            if raw is None:
                _log(f"Failed to fetch reviews for {prof}, skipping", "WARN")
                continue
            
            filtered: List[Dict[str, Any]] = []
            for r in raw:
                if _normalize_space(str(r.get("course", ""))).upper() != course.code.upper():
                    continue
                
                submitted_iso, submitted_year = _parse_submitted(r.get("submitted"))
                review = {
                    "id": r.get("id"),
                    "professor": prof,
                    "course": r.get("course"),
                    "submitted_at": submitted_iso,
                    "submitted_year": submitted_year,
                    "review_age": _age_label(submitted_iso),
                    "student_year": r.get("userYear"),
                    "student_major": r.get("userMajor"),
                    "review_text": r.get("body"),
                    "votes": r.get("votes"),
                    "replying_to_id": r.get("replyingToID") or None,
                }
                filtered.append(review)
                all_reviews.append(review)
            
            reviews_by_prof[prof] = filtered
            _log(f"✓ Collected {len(filtered)} reviews for {prof}")
        
        # 🎯 Step 4: Build categorization indexes
        by_submitted_year: Dict[str, List[str]] = defaultdict(list)
        by_student_year: Dict[str, List[str]] = defaultdict(list)
        by_major: Dict[str, List[str]] = defaultdict(list)
        
        for r in all_reviews:
            rid = str(r.get("id"))
            if r.get("submitted_year"):
                by_submitted_year[str(r["submitted_year"])].append(rid)
            if r.get("student_year"):
                by_student_year[str(r["student_year"])].append(rid)
            if r.get("student_major"):
                by_major[str(r["student_major"])].append(rid)
        
        output = {
            "meta": {
                "school": course.school,
                "course_code": course.code,
                "course_url": course.course_url,
                "scraped_at": dt.datetime.now().replace(microsecond=0).isoformat(),
                "professors_found": professors,
                "review_count": len(all_reviews),
            },
            "by_professor": reviews_by_prof,
            "categorized": {
                "by_submitted_year": dict(by_submitted_year),
                "by_student_year": dict(by_student_year),
                "by_major": dict(by_major),
            },
            "all_reviews": all_reviews,
        }
        
        return output
        
    finally:
        session.close()


def main() -> int:
    p = argparse.ArgumentParser(description="Scrape Coursicle course reviews into JSON (with rate limiting).")
    p.add_argument("--school", default="arizona")
    p.add_argument("--subject", required=True)
    p.add_argument("--number", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--delay", type=float, help="Override min delay between requests")
    args = p.parse_args()
    
    # Allow CLI override of delay
    if args.delay:
        CONFIG["min_delay"] = args.delay
        CONFIG["max_delay"] = args.delay + 2
    
    course = CourseKey(school=args.school, subject=args.subject, number=args.number)
    _log(f"🎯 Starting scrape for {course.code}")
    
    data = scrape_course_reviews(course)
    
    if data is None:
        _log(f"❌ Failed to scrape {course.code}", "ERROR")
        return 1
    
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    _log(f"✅ Wrote {data['meta']['review_count']} reviews to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())