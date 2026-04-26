import { CourseSection, Filters, Level, NO_PREF } from "@/data/uaData";
import type { ProfileData } from "@/components/ProfileForm";

const levelMap: Record<Level, number> = { Low: 1, Medium: 2, High: 3 };
const successBucketMap = { Low: 1, Medium: 2, High: 3 } as const;

function levelCloseness(a: Level, b: Level) {
  const diff = Math.abs(levelMap[a] - levelMap[b]);
  return diff === 0 ? 1 : diff === 1 ? 0.5 : 0;
}

const YEAR_TO_LEVEL: Record<string, number> = {
  Freshman: 100,
  Sophomore: 200,
  Junior: 300,
  Senior: 400,
};

export interface LayerBreakdown {
  layer: string;
  earned: number;
  max: number;
  notes: string[];
}

export interface MatchResult {
  score: number;
  reasons: string[];
  eliminated?: boolean;
  eliminationReasons?: string[];
  bonuses?: string[];
  layers?: LayerBreakdown[];
  warnings?: string[];
}

const norm = (c: string) => c.replace(/\s+/g, " ").trim().toUpperCase();

// Extract the leading subject + 3-digit number to bucket the course level
function inferCourseLevel(code: string): number {
  const m = code.match(/(\d{3})/);
  return m ? Math.floor(Number(m[1]) / 100) * 100 : 100;
}

// =============================================================
// STAGE 1 — HARD FILTERS
// =============================================================
export function applyHardFilters(
  s: CourseSection,
  profile: ProfileData | null,
  filters: Filters,
  completedCourses: string[] = []
): string[] {
  const fails: string[] = [];
  const completedNorm = completedCourses.map(norm);

  if (completedNorm.includes(norm(s.courseCode))) {
    fails.push("Already completed (found in transcript)");
  }

  if (s.prerequisites?.length && completedNorm.length > 0) {
    const missing = s.prerequisites.filter((p) => !completedNorm.includes(norm(p)));
    if (missing.length > 0) fails.push(`Missing prerequisite(s): ${missing.join(", ")}`);
  }

  // Format mismatch is always a hard filter (backend logic)
  if (filters.format !== NO_PREF && s.format !== filters.format) {
    fails.push(`Section is ${s.format}; you selected ${filters.format}`);
  }

  // Year/level: warn if a Freshman tries a 400-level course
  if (profile) {
    const studentLevel = YEAR_TO_LEVEL[profile.year] ?? 100;
    const courseLvl = inferCourseLevel(s.courseCode);
    if (courseLvl >= 400 && studentLevel <= 100) {
      fails.push("400-level course not appropriate for Freshmen");
    }
  }

  return fails;
}

// =============================================================
// STAGE 2 — WEIGHTED SCORING (per section)
// =============================================================
const W = {
  // Layer 1 — Foundational (40)
  collegeMatch: 25,
  yearLevel: 15,
  // Layer 2 — Outcome (23)
  successRate: 8,
  workload: 8,
  difficulty: 7,
  // Layer 3 — Schedule (15)
  timing: 6,
  format: 5,
  length: 4,
  days: 5,
  // Layer 4 — Professor (22)
  leniency: 6,
  examType: 5,
  professorRating: 11,
};

export function scoreSection(
  s: CourseSection,
  filters: Filters,
  profile: ProfileData | null = null,
  completedCourses: string[] = []
): MatchResult {
  const eliminationReasons = applyHardFilters(s, profile, filters, completedCourses);
  if (eliminationReasons.length > 0) {
    return { score: 0, reasons: [], eliminated: true, eliminationReasons };
  }

  const reasons: string[] = [];
  const bonuses: string[] = [];

  // ---------- Layer 1: Foundational ----------
  const l1Notes: string[] = [];
  let l1Earned = 0;
  let l1Max = 0;

  if (profile) {
    l1Max += W.collegeMatch + W.yearLevel;

    if (s.college === profile.college) {
      l1Earned += W.collegeMatch;
      reasons.push(`Same college as your major (${profile.college})`);
    } else {
      l1Earned += W.collegeMatch * 0.2;
      l1Notes.push("Outside your home college");
    }

    const studentLevel = YEAR_TO_LEVEL[profile.year] ?? 100;
    const courseLvl = inferCourseLevel(s.courseCode);
    const diff = Math.abs(courseLvl - studentLevel);
    if (diff === 0) {
      l1Earned += W.yearLevel;
      reasons.push(`${courseLvl}-level course matches ${profile.year} year`);
    } else if (diff <= 100) {
      l1Earned += W.yearLevel * 0.6;
    } else if (diff <= 200) {
      l1Earned += W.yearLevel * 0.3;
    }
  }

  // ---------- Layer 2: Outcome ----------
  let l2Earned = 0;
  let l2Max = 0;

  if (filters.successRate !== NO_PREF) {
    l2Max += W.successRate;
    const target = successBucketMap[filters.successRate];
    const bucket = s.successRate >= 85 ? 3 : s.successRate >= 75 ? 2 : 1;
    const m = bucket === target ? 1 : Math.abs(bucket - target) === 1 ? 0.5 : 0;
    l2Earned += W.successRate * m;
    if (m === 1) reasons.push(`Success rate (${s.successRate}%) matches your preference`);
  }

  if (filters.assignmentFreq !== NO_PREF) {
    l2Max += W.workload;
    const m = levelCloseness(s.workload, filters.assignmentFreq);
    l2Earned += W.workload * m;
    if (m === 1) reasons.push(`Workload (${s.workload}) matches your preference`);
  }

  if (filters.difficulty !== NO_PREF) {
    l2Max += W.difficulty;
    const m = levelCloseness(s.difficulty, filters.difficulty);
    l2Earned += W.difficulty * m;
    if (m === 1) reasons.push(`Difficulty (${s.difficulty}) matches your preference`);
  }

  // ---------- Layer 3: Schedule ----------
  let l3Earned = 0;
  let l3Max = 0;

  if (filters.timing !== NO_PREF) {
    l3Max += W.timing;
    if (s.timing === filters.timing) {
      l3Earned += W.timing;
      reasons.push(`Timing (${s.timing}) matches your preference`);
    }
  }
  // format match counted here only when not eliminated
  if (filters.format !== NO_PREF) {
    l3Max += W.format;
    if (s.format === filters.format) {
      l3Earned += W.format;
    }
  }
  if (filters.length !== NO_PREF) {
    l3Max += W.length;
    if (s.length === filters.length) {
      l3Earned += W.length;
      reasons.push(`Class length (${s.length}) matches your preference`);
    }
  }
  if (filters.days && filters.days.length > 0 && s.format !== "Online") {
    l3Max += W.days;
    const sectionDays = s.days || [];
    if (sectionDays.length > 0) {
      const allMatch = sectionDays.every((d) => filters.days.includes(d));
      const anyMatch = sectionDays.some((d) => filters.days.includes(d));
      if (allMatch) {
        l3Earned += W.days;
        reasons.push(`Meets on ${sectionDays.join("/")} — matches your preferred days`);
      } else if (anyMatch) {
        l3Earned += W.days * 0.5;
      }
    }
  }

  // ---------- Layer 4: Professor ----------
  // Skip entirely for new professors — neutral baseline (no penalty).
  let l4Earned = 0;
  let l4Max = 0;
  const profNotes: string[] = [];

  if (s.professor.isNew) {
    profNotes.push("New professor — no reviews yet, scored neutrally");
  } else {
    if (filters.leniency !== NO_PREF) {
      l4Max += W.leniency;
      if (s.leniency === filters.leniency) {
        l4Earned += W.leniency;
        reasons.push(`Professor leniency (${s.leniency}) matches your preference`);
      } else if (s.leniency === "Balanced") {
        l4Earned += W.leniency * 0.5;
      }
    }

    if (filters.examType !== NO_PREF) {
      l4Max += W.examType;
      if (s.examType === filters.examType) {
        l4Earned += W.examType;
        reasons.push(`${s.examType} assessment matches your preference`);
      } else if (s.examType === "Mixed") {
        l4Earned += W.examType * 0.5;
      }
    }

    // Overall RMP rating — always counts when available
    if (s.professor.overallRating != null) {
      l4Max += W.professorRating;
      const r = s.professor.overallRating;
      l4Earned += W.professorRating * Math.max(0, Math.min(1, (r - 2.5) / 2.5));
      if (r >= 4.3) reasons.push(`Highly-rated professor (${r.toFixed(1)}/5 on RateMyProf)`);
    }
  }

  // ---------- Interests (optional bonuses) ----------
  if (filters.interests.includes("Easy A Grade") && s.easyAScore >= 20) {
    bonuses.push("Easy A interest: students frequently mention this is an easy A");
  }
  if (filters.interests.includes("Low Workload") && s.workload === "Low") {
    bonuses.push("Low Workload interest: light workload reported");
  }
  if (
    filters.interests.includes("Degree Alignment") &&
    profile &&
    s.college === profile.college
  ) {
    bonuses.push(`Degree Alignment interest: in ${profile.college}`);
  }

  // ---------- Score normalization ----------
  const totalEarned = l1Earned + l2Earned + l3Earned + l4Earned;
  const totalMax = l1Max + l2Max + l3Max + l4Max;
  let baseScore = totalMax > 0 ? (totalEarned / totalMax) * 100 : 65;

  // GPA protection
  if (profile?.gpa) {
    const gpa = parseFloat(profile.gpa);
    if (!isNaN(gpa) && gpa < 3.0 && s.successRate < 65) {
      baseScore -= 4;
      bonuses.push("−4 — GPA protection: low success rate flagged for GPA below 3.0");
    }
  }

  const finalScore = Math.round(Math.max(0, Math.min(100, baseScore)));

  const layers: LayerBreakdown[] = [
    { layer: "College & year fit", earned: +l1Earned.toFixed(1), max: +l1Max.toFixed(1), notes: l1Notes },
    { layer: "Outcome & difficulty fit", earned: +l2Earned.toFixed(1), max: +l2Max.toFixed(1), notes: [] },
    { layer: "Schedule & format fit", earned: +l3Earned.toFixed(1), max: +l3Max.toFixed(1), notes: [] },
    { layer: "Professor fit", earned: +l4Earned.toFixed(1), max: +l4Max.toFixed(1), notes: profNotes },
  ];

  // Warnings for new course / new professor / both
  const warnings: string[] = [];
  if (s.estimatedFromDeptAvg) {
    warnings.push(
      "New course AND new professor — all values shown (difficulty, workload, success rate, leniency, exam type) are estimated from department averages. Professor rating is unavailable."
    );
    warnings.push("Consult an academic advisor before enrolling in this section.");
  } else if (s.isNewProfessor) {
    warnings.push(
      "New professor — no RateMyProf or student reviews available yet. Match score is computed without professor signals; remaining attribute weights have been rebalanced."
    );
  } else if (s.isNewCourse) {
    warnings.push(
      "New course — no prior student review history for this course. Score relies on the professor's track record and your stated preferences."
    );
  }

  return { score: finalScore, reasons, bonuses, layers, warnings };
}

export function scoreColor(score: number): "high" | "mid" | "low" {
  if (score >= 75) return "high";
  if (score >= 55) return "mid";
  return "low";
}
