"""
Build script: merges semester offerings + courses CSV + RateMyProf + Coursicle
into a single section-level dataset for the UAdvisor app.

Run with:  python scripts/build_dataset.py
Output:    public/dataset.json
"""
from __future__ import annotations

import csv
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

# ---------- paths ----------
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data-sources"
OUT = ROOT / "public" / "dataset.json"


# ---------- helpers ----------
def read_json(p: Path) -> Any:
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def dept_to_college(subject: str) -> str:
    s = subject.upper()
    if s in {"ACCT", "BNAD", "FIN", "MGMT", "MIS", "MKTG", "OSCM", "ECON"}:
        return "Eller College of Management"
    if s in {"CSC", "MATH", "PHYS", "CHEM", "BIOL", "NSCS", "ASTR"}:
        return "College of Science"
    if s in {"ECE", "MECH", "AME", "CHEE", "BME"}:
        return "College of Engineering"
    if s in {"ENGL", "PHIL", "HIST", "LING"}:
        return "College of Humanities"
    if s in {"PSYC", "SOC", "POL", "COMM"}:
        return "College of Social & Behavioral Sciences"
    return "University of Arizona"


PREREQ_RE = re.compile(r"\b([A-Z]{2,5})\s?(\d{3}[A-Z]?)\b")


def parse_prereqs(req: str | None) -> list[str]:
    if not req or req == "-":
        return []
    return [f"{m.group(1)} {m.group(2)}" for m in PREREQ_RE.finditer(req)]


# ---------- heuristic extractors ----------
def count_matches(text: str, pattern: str) -> int:
    return len(re.findall(pattern, text))


def extract_signals(reviews: list[dict], rmp: dict | None) -> dict:
    text = " ".join((r.get("review_text") or "").lower() for r in reviews)
    n = max(len(reviews), 1)

    lenient = count_matches(text, r"\b(easy|lenient|generous|fair grader|nice|chill|relaxed|curve|partial credit)\b")
    strict = count_matches(text, r"\b(harsh|strict|tough grader|brutal|unfair|nitpick)\b")
    heavy = count_matches(text, r"\b(lots of (?:homework|assignments|work)|heavy workload|busy work|weekly assignments|time consuming)\b")
    light = count_matches(text, r"\b(no homework|light workload|easy class|barely any work)\b")
    projectish = count_matches(text, r"\b(project|presentation|paper|group work|essay)\b")
    examish = count_matches(text, r"\b(midterm|final exam|test|exams are|exam heavy|quizzes)\b")
    easy_a = count_matches(text, r"\b(easy a|easy class|show up and pass|free a|guaranteed a)\b")

    leniency = "Balanced"
    if lenient > strict + 1:
        leniency = "Lenient"
    elif strict > lenient + 1:
        leniency = "Strict"

    workload = "Medium"
    if heavy > light + 1:
        workload = "High"
    elif light > heavy:
        workload = "Low"

    exam_type = "Mixed"
    if projectish > examish + 1:
        exam_type = "Project-based"
    elif examish > projectish + 1:
        exam_type = "Exam-based"

    difficulty = "Medium"
    if rmp and rmp.get("difficulty") is not None:
        d = float(rmp["difficulty"])
        difficulty = "High" if d >= 4 else "Low" if d <= 2.5 else "Medium"
    else:
        hard = count_matches(text, r"\b(hard|difficult|challenging|tough)\b")
        easy = count_matches(text, r"\b(easy|simple|straightforward)\b")
        if hard > easy + 2:
            difficulty = "High"
        elif easy > hard + 2:
            difficulty = "Low"

    rmp_q = rmp.get("overall_rating") if rmp else None
    wta = rmp.get("would_take_again_pct") if rmp else None
    easy_a_signal = min(100.0, (easy_a / n) * 200)

    if rmp_q is not None:
        base = (float(rmp_q) / 5) * 100
        wta_boost = (float(wta) - 50) * 0.2 if wta is not None else 0
        success_rate = round(max(50, min(95, base * 0.7 + easy_a_signal * 0.2 + 50 * 0.1 + wta_boost)))
    else:
        success_rate = round(max(60, min(90, 75 + easy_a_signal * 0.15)))

    tags: list[str] = []
    if easy_a > 0:
        tags.append("Easy A")
    if workload == "Low":
        tags.append("Light workload")
    if workload == "High":
        tags.append("Heavy workload")
    if exam_type == "Project-based":
        tags.append("Project-based")
    if exam_type == "Exam-based":
        tags.append("Exam-heavy")
    if leniency == "Lenient":
        tags.append("Lenient grader")

    texts = [r.get("review_text") or "" for r in reviews if r.get("review_text")]
    top = max(texts, key=len) if texts else ""

    return {
        "leniency": leniency,
        "workload": workload,
        "difficulty": difficulty,
        "examType": exam_type,
        "successRate": success_rate,
        "easyAScore": round(easy_a_signal),
        "tags": tags,
        "topReview": top,
    }


# ---------- name matching ----------
class RmpIndex:
    def __init__(self, rmp: list[dict]):
        self.by_name = {norm(p["name"]): p for p in rmp}

    def lookup(self, name: str) -> dict | None:
        k = norm(name)
        if k in self.by_name:
            return self.by_name[k]
        parts = name.split()
        if len(parts) >= 2:
            target = norm(parts[0][0] + parts[-1])
            for val in self.by_name.values():
                vp = val["name"].split()
                if len(vp) >= 2 and norm(vp[0][0] + vp[-1]) == target:
                    return val
        return None


def build_coursicle_index(dirpath: Path) -> dict[str, dict[str, list[dict]]]:
    out: dict[str, dict[str, list[dict]]] = {}
    if not dirpath.exists():
        return out
    for f in sorted(dirpath.glob("*.json")):
        data = read_json(f)
        code = (data.get("meta") or {}).get("course_code")
        if not code:
            continue
        prof_map: dict[str, list[dict]] = {}
        for prof_name, reviews in (data.get("by_professor") or {}).items():
            prof_map[norm(prof_name)] = reviews or []
        out[code.upper()] = prof_map
    return out


# ---------- main ----------
def main() -> None:
    print("Reading sources...")
    semester = read_json(SRC / "semester.json")

    with open(SRC / "courses.csv", "r", encoding="utf-8", newline="") as f:
        courses = list(csv.DictReader(f))

    rmp = read_json(SRC / "ratemyprof.json")

    ua_desc_path = SRC / "ua_descriptions.json"
    ua_descriptions_raw = read_json(ua_desc_path) if ua_desc_path.exists() else {}
    ua_descriptions = {k.upper(): v for k, v in ua_descriptions_raw.items()}

    course_index: dict[str, dict] = {}
    for row in courses:
        code = f"{row['Subject code']} {row['Catalog Number']}".upper()
        course_index[code] = row

    rmp_idx = RmpIndex(rmp)
    coursicle_idx = build_coursicle_index(SRC / "coursicle")

    sections: list[dict] = []
    new_prof_count = 0

    for code, offerings in semester.items():
        course_row = course_index.get(code.upper())
        subject = code.split(" ")[0]
        title = (course_row or {}).get("Course Title") or (offerings[0].get("courseName") if offerings else None) or code
        desc = (
            ua_descriptions.get(code.upper())
            or ua_descriptions.get(code)
            or (course_row or {}).get("Course Description")
            or "Course description not available."
        )
        college = dept_to_college(subject)
        prereqs = parse_prereqs((course_row or {}).get("Course Requisites") or "")
        catalog_url = f"https://catalog.arizona.edu/search/?search={quote(code)}"

        course_coursicle = coursicle_idx.get(code.upper())
        is_course_new = not course_coursicle or len(course_coursicle) == 0

        for off in offerings:
            prof_name = off["professor"]
            rmp_rec = rmp_idx.lookup(prof_name)
            reviews = (course_coursicle or {}).get(norm(prof_name), [])
            format_norm = "In-person" if off.get("format") == "Hybrid" else off.get("format")

            is_prof_new = rmp_rec is None and len(reviews) == 0
            if is_prof_new:
                new_prof_count += 1

            if is_prof_new:
                derived = {
                    "leniency": "Balanced",
                    "workload": "Medium",
                    "difficulty": "Medium",
                    "examType": "Mixed",
                    "successRate": 78,
                    "easyAScore": 0,
                    "tags": [],
                    "topReview": "",
                }
            else:
                derived = extract_signals(reviews, rmp_rec)

            def map_exam(e: str | None) -> str | None:
                return e if e in {"Project-based", "Exam-based", "Mixed"} else None

            def map_level(l: str | None) -> str | None:
                return l if l in {"Low", "Medium", "High"} else None

            def map_len(l: str | None) -> str | None:
                return l if l in {"Strict", "Balanced", "Lenient"} else None

            signals = {
                **derived,
                "workload": map_level(off.get("assignmentFrequency")) or derived["workload"],
                "difficulty": map_level(off.get("difficulty")) or derived["difficulty"],
                "leniency": map_len(off.get("professorLeniency")) or derived["leniency"],
                "examType": map_exam(off.get("finalExam")) or derived["examType"],
                "tags": [
                    *derived["tags"],
                    *(["Research-oriented"] if off.get("researchOriented") == "Yes" else []),
                ],
            }

            estimated_from_dept_avg = is_course_new and is_prof_new

            if estimated_from_dept_avg:
                ai_summary = (
                    f"{prof_name} has not taught at UA before, and this course has no prior student data. "
                    "Values shown are estimated from department averages — please consult your academic advisor before enrolling."
                )
            elif is_prof_new:
                ai_summary = (
                    f"{prof_name} is new to teaching this course at UA — no student reviews are available yet, "
                    "so the professor profile is shown with a neutral baseline."
                )
            else:
                bits: list[str] = []
                if rmp_rec and rmp_rec.get("overall_rating") is not None:
                    r = float(rmp_rec["overall_rating"])
                    tone = "highly rated" if r >= 4.2 else "positively rated" if r >= 3.5 else "receives mixed reviews"
                    bits.append(f"{prof_name} is {tone} ({r:.1f}/5 on RateMyProf, {rmp_rec.get('num_ratings') or 0} ratings)")
                else:
                    bits.append(f"{prof_name} teaches this section")
                bits.append(
                    f"students describe the course as {signals['difficulty'].lower()} difficulty with a {signals['workload'].lower()} workload"
                )
                bits.append(f"grading is generally {signals['leniency'].lower()}")
                bits.append(f"assessments lean {signals['examType'].lower()}")
                ai_summary = ". ".join(bits) + "."

            professor = {
                "name": prof_name,
                "rmpId": (rmp_rec or {}).get("professor_id"),
                "overallRating": None if estimated_from_dept_avg else (rmp_rec or {}).get("overall_rating"),
                "difficulty": None if estimated_from_dept_avg else (rmp_rec or {}).get("difficulty"),
                "wouldTakeAgainPct": None if estimated_from_dept_avg else (rmp_rec or {}).get("would_take_again_pct"),
                "numRatings": (rmp_rec or {}).get("num_ratings", 0),
                "department": (rmp_rec or {}).get("department"),
                "topReview": signals["topReview"],
                "aiSummary": ai_summary,
                "isNew": is_prof_new,
            }
            # Drop keys whose value is None to mirror TS optional behavior
            professor = {k: v for k, v in professor.items() if v is not None or k == "wouldTakeAgainPct"}

            sections.append({
                "id": f"{code.replace(' ', '-')}-{off['section']}",
                "courseCode": code,
                "courseTitle": title,
                "description": desc,
                "college": college,
                "catalogUrl": catalog_url,
                "prerequisites": prereqs,
                "professor": professor,
                "section": off["section"],
                "timing": off.get("timing"),
                "format": format_norm,
                "length": off.get("length"),
                "days": off.get("days") or [],
                "leniency": signals["leniency"],
                "workload": signals["workload"],
                "difficulty": signals["difficulty"],
                "examType": signals["examType"],
                "successRate": signals["successRate"],
                "easyAScore": signals["easyAScore"],
                "tags": signals["tags"],
                "relevantMajors": [],
                "isNewCourse": is_course_new,
                "isNewProfessor": is_prof_new,
                "estimatedFromDeptAvg": estimated_from_dept_avg,
            })

    # -------- second pass: department averages for "both new" sections --------
    level_to_num = {"Low": 1, "Medium": 2, "High": 3}
    len_to_num = {"Strict": 1, "Balanced": 2, "Lenient": 3}

    def num_to_level(n: float) -> str:
        return "Low" if n < 1.67 else "Medium" if n < 2.34 else "High"

    def num_to_len(n: float) -> str:
        return "Strict" if n < 1.67 else "Balanced" if n < 2.34 else "Lenient"

    dept: dict[str, dict] = {}
    for s in sections:
        if s["estimatedFromDeptAvg"]:
            continue
        subj = s["courseCode"].split(" ")[0].upper()
        a = dept.setdefault(subj, {
            "workload": [], "difficulty": [], "leniency": [], "successRate": [], "rmp": [],
            "exams": {"Project-based": 0, "Exam-based": 0, "Mixed": 0},
        })
        a["workload"].append(level_to_num[s["workload"]])
        a["difficulty"].append(level_to_num[s["difficulty"]])
        a["leniency"].append(len_to_num[s["leniency"]])
        a["successRate"].append(s["successRate"])
        if s["professor"].get("overallRating") is not None:
            a["rmp"].append(s["professor"]["overallRating"])
        a["exams"][s["examType"]] += 1

    def avg(xs: list[float], fallback: float) -> float:
        return sum(xs) / len(xs) if xs else fallback

    estimated_count = 0
    for s in sections:
        if not s["estimatedFromDeptAvg"]:
            continue
        estimated_count += 1
        subj = s["courseCode"].split(" ")[0].upper()
        a = dept.get(subj)
        if not a:
            continue
        s["workload"] = num_to_level(avg(a["workload"], 2))
        s["difficulty"] = num_to_level(avg(a["difficulty"], 2))
        s["leniency"] = num_to_len(avg(a["leniency"], 2))
        s["successRate"] = round(avg(a["successRate"], 75))
        top_exam = max(a["exams"].items(), key=lambda kv: kv[1])[0] if a["exams"] else "Mixed"
        s["examType"] = top_exam
        if "Estimated" not in s["tags"]:
            s["tags"].append("Estimated")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(sections, f, indent=2, ensure_ascii=False)

    print(f"Built {len(sections)} sections from {len(semester)} courses.")
    print(f"New professors (no reviews): {new_prof_count}")
    print(f"Sections estimated from dept averages (new course + new prof): {estimated_count}")
    print(f"Output: {OUT}")


if __name__ == "__main__":
    main()
