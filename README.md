# UAdvisor

UAdvisor is an intelligent course recommendation platform built for University of Arizona students. It analyzes a student's academic profile, preferences, and course history to generate ranked, explainable course section recommendations that help students enroll with confidence.

---

## Overview

Choosing the right classes can be time-consuming and confusing. Students often need to compare schedules, professor quality, workload, prerequisites, and personal interests across multiple systems.

UAdvisor solves this by combining university course data with external review sources and a custom recommendation engine.

Students can:

* Input their academic profile
* Upload a transcript (optional)
* Set preferences such as difficulty, schedule, format, and interests
* Receive a ranked list of course sections with a **0–100 match score**
* View explainable reasoning for every recommendation
* Understand what to expect from the class and instructor
* Make faster, smarter enrollment decisions

---

## How It Works

Behind the interface, UAdvisor uses a custom match-scoring engine.

### Step 1: Basic Eligibility Filters

The system first removes courses that do not fit required constraints, such as:

* Already completed courses
* Missing prerequisites
* Credit conflicts
* Enrollment constraints

### Step 2: Multi-Factor Scoring

Remaining course sections are scored across multiple dimensions:

* Foundational / academic fit
  n- Personal interests
* Difficulty preference
* Workload preference
* Schedule compatibility
* Online / in-person format preference
* Professor quality and ratings
* Historical sentiment data

### Step 3: Explainable Ranking

Each recommendation receives a transparent score from **0 to 100** with reasoning such as:

* Why this course matches your goals
  n- Expected workload
* Instructor reputation
* Scheduling advantages
* Potential concerns to consider

### Edge Cases Handled

* New professors with limited ratings
* New courses with sparse data
* Missing data scenarios
* Students with partial transcripts
* Schedule conflicts
* Already completed requirements

---

## How We Built It

### Frontend

Built using the Lovable platform with:

* Vite
* React 18
* TypeScript
* Tailwind CSS
* shadcn/ui components

### Data Pipeline

We created a Python-based pipeline to scrape, clean, normalize, and merge data from:

* University course catalog
* RateMyProfessors
* Coursicle

This pipeline produces a unified dataset used directly by the application.

### Recommendation Engine

A custom rules + scoring system designed to rank sections intelligently based on student needs instead of showing raw listings.

---

## Prerequisites

* Node.js 18+ (20 LTS recommended)
* npm or bun
* Python 3.9+ (for dataset rebuilds)

---

## Run the App (Development)

```bash
cd UAdvisor
npm install
npm run dev
```

Open in browser:

```text
http://localhost:8080
```

---

## Production Build

```bash
npm run build
npm run preview
```

---

## Rebuild Dataset

```bash
python3 scripts/build_dataset.py
```

---

## Project Structure

```text
src/                    React application
public/dataset.json     Generated dataset used by UI
data-sources/           Raw source files
scripts/build_dataset.py Dataset builder
```

---

## Why UAdvisor Matters

Students often make course decisions using scattered sources and guesswork.

UAdvisor turns fragmented data into personalized guidance—saving time, reducing stress, and helping students build better academic schedules.

---

## Future Enhancements

* AI chatbot for course advising
* Degree audit integration
* Graduation path planning
* Peer recommendation graph
* Waitlist probability predictions
* Mobile app version
* Real-time seat availability alerts

---

## License

See top-level repository license if available.
