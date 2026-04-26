#!/usr/bin/env python3
"""
Batch runner for Coursicle course review scraper
Scrapes reviews for OSCM & MKTG courses at Eller College
"""
import subprocess
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime

# 📋 YOUR COURSE LIST
COURSES = [
    ("OSCM", "471", "oscm471_reviews.json"),
    ("OSCM", "474", "oscm474_reviews.json"),
    ("OSCM", "475", "oscm475_reviews.json"),
    ("OSCM", "477", "oscm477_reviews.json"),
    ("MKTG", "355", "mktg355_reviews.json"),
    ("MKTG", "361", "mktg361_reviews.json"),
    ("MKTG", "376", "mktg376_reviews.json"),
    ("MKTG", "423", "mktg423_reviews.json"),
    ("MKTG", "425", "mktg425_reviews.json"),
    ("MKTG", "426", "mktg426_reviews.json"),
    ("MKTG", "428", "mktg428_reviews.json"),
    ("MKTG", "430", "mktg430_reviews.json"),
    ("MKTG", "440", "mktg440_reviews.json"),
    ("MKTG", "450", "mktg450_reviews.json"),
    ("MKTG", "452", "mktg452_reviews.json"),
    ("MKTG", "454", "mktg454_reviews.json"),
    ("MKTG", "456", "mktg456_reviews.json"),
    ("MKTG", "458", "mktg458_reviews.json"),
    ("MKTG", "459", "mktg459_reviews.json"),
    ("MKTG", "460", "mktg460_reviews.json"),
    ("MKTG", "471", "mktg471_reviews.json"),
    ("MKTG", "480", "mktg480_reviews.json"),
    ("MKTG", "498", "mktg498_reviews.json"),
]

DEFAULT_DELAY = 15
DEFAULT_SCRAPER_DELAY = 10
LOG_FILE = "batch_run.log"


def log(msg: str, level: str = "INFO"):
    """Log to console and file with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] [{level}] {msg}"
    print(formatted)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(formatted + "\n")


def course_exists(output_file: str) -> bool:
    """Check if output file already exists and has content"""
    path = Path(output_file)
    return path.exists() and path.stat().st_size > 0


def run_scraper(subject: str, number: str, output: str, scraper_delay: float, output_dir: str) -> bool:
    """Run the scraper for one course. Returns True on success."""
    cmd = [
        sys.executable,
        "scraper.py",
        "--subject", subject,
        "--number", number,
        "--out", str(Path(output_dir) / output),
        "--delay", str(scraper_delay)
    ]
    
    log(f"🔍 Running: {' '.join(cmd)}")
    
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    if result.stdout:
        for line in result.stdout.strip().split("\n"):
            log(f"   └─ {line}", "SCRAPER")
            
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Batch scrape Coursicle reviews for Eller courses")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                       help=f"Seconds to wait between courses (default: {DEFAULT_DELAY})")
    parser.add_argument("--scraper-delay", type=float, default=DEFAULT_SCRAPER_DELAY,
                       help=f"Delay passed to scraper.py between requests (default: {DEFAULT_SCRAPER_DELAY})")
    parser.add_argument("--skip-existing", action="store_true",
                       help="Skip courses that already have output files")
    parser.add_argument("--resume-from", type=str,
                       help="Resume from a specific course (format: SUBJECT:NUMBER, e.g., MKTG:423)")
    parser.add_argument("--output-dir", type=str, default=".",
                       help="Directory to save JSON files (default: current directory)")
    args = parser.parse_args()

    # Use local variable instead of global
    output_dir = args.output_dir
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    log("🚀 Starting batch scrape session")
    log(f"📋 Total courses: {len(COURSES)}")
    log(f"⏱️  Delay between courses: {args.delay}s | Scraper internal delay: {args.scraper_delay}s")
    if args.skip_existing:
        log("⏭️  Will skip courses with existing output files")
    if args.resume_from:
        log(f"🔁 Resuming from course: {args.resume_from}")
    
    success_count = 0
    failed_courses = []
    skipped_courses = []
    start_time = time.time()
    
    # Find resume index if specified
    start_index = 0
    if args.resume_from:
        try:
            resume_subject, resume_number = args.resume_from.split(":")
            for i, (subj, num, _) in enumerate(COURSES):
                if subj.upper() == resume_subject.upper() and num == resume_number:
                    start_index = i
                    log(f"✅ Found resume point at index {i}: {resume_subject} {resume_number}")
                    break
            else:
                log(f"⚠️  Could not find course {args.resume_from}, starting from beginning", "WARN")
        except ValueError:
            log("⚠️  Invalid --resume-from format. Use SUBJECT:NUMBER", "WARN")
    
    # Process courses
    for i, (subject, number, output) in enumerate(COURSES[start_index:], start=start_index):
        progress = f"[{i+1}/{len(COURSES)}]"
        course_label = f"{subject} {number}"
        
        # Check if skipping
        if args.skip_existing and course_exists(Path(output_dir) / output):
            log(f"{progress} ⏭️  Skipping {course_label} (file exists): {output}")
            skipped_courses.append(course_label)
            continue
        
        log(f"{progress} 🎯 Processing {course_label} → {output}")
        
        # Run scraper
        success = run_scraper(subject, number, output, args.scraper_delay, output_dir)
        
        if success:
            success_count += 1
            log(f"{progress} ✅ Success: {output}")
        else:
            failed_courses.append(course_label)
            log(f"{progress} ❌ Failed: {course_label}", "ERROR")
        
        # Delay before next course (unless it's the last one)
        if i < len(COURSES) - 1:
            log(f"😴 Waiting {args.delay}s before next course...")
            time.sleep(args.delay)
    
    # Summary report
    elapsed = time.time() - start_time
    hours, remainder = divmod(int(elapsed), 3600)
    minutes, seconds = divmod(remainder, 60)
    
    log("\n" + "="*60)
    log("📊 BATCH RUN SUMMARY")
    log("="*60)
    log(f"⏱️  Total time: {hours}h {minutes}m {seconds}s")
    log(f"✅ Successful: {success_count}/{len(COURSES)}")
    log(f"⏭️  Skipped: {len(skipped_courses)}")
    log(f"❌ Failed: {len(failed_courses)}")
    
    if skipped_courses:
        log(f"\n⏭️  Skipped courses: {', '.join(skipped_courses)}")
    if failed_courses:
        log(f"\n❌ Failed courses: {', '.join(failed_courses)}")
        log("💡 Tip: Re-run with --resume-from SUBJECT:NUMBER to retry failed courses")
    
    log(f"\n📁 Output directory: {Path(output_dir).resolve()}")
    log(f"📝 Log file: {Path(LOG_FILE).resolve()}")
    
    return 0 if not failed_courses else 1


if __name__ == "__main__":
    raise SystemExit(main())