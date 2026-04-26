// University of Arizona — types + dataset loader.
// The actual catalog now lives in /public/dataset.json (built by scripts/buildDataset.ts).
// This file declares the runtime types and exposes a loader the UI consumes.

export const UA_COLLEGES: Record<string, string[]> = {
  "Eller College of Management": [
    "Business Management",
    "Finance",
    "Marketing",
    "Management Information Systems",
    "Accounting",
    "Economics",
  ],
  "College of Science": [
    "Computer Science",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Neuroscience",
  ],
  "College of Engineering": [
    "Electrical & Computer Engineering",
    "Mechanical Engineering",
    "Aerospace Engineering",
    "Biomedical Engineering",
    "Chemical Engineering",
  ],
  "College of Humanities": [
    "English",
    "Philosophy",
    "History",
    "Linguistics",
  ],
  "College of Social & Behavioral Sciences": [
    "Psychology",
    "Sociology",
    "Political Science",
    "Communication",
  ],
  "College of Fine Arts": [
    "Studio Art",
    "Music",
    "Theatre Arts",
    "Film & Television",
  ],
};

export const YEARS = ["Freshman", "Sophomore", "Junior", "Senior"] as const;
export type Year = typeof YEARS[number];

export const NO_PREF = "No preference" as const;
export type NoPref = typeof NO_PREF;

export type Timing = "Morning" | "Afternoon" | NoPref;
export type Format = "In-person" | "Online" | "Hybrid" | NoPref;
export type Length = "45 min" | "90 min" | NoPref;
export type Level = "Low" | "Medium" | "High";
export type LevelPref = Level | NoPref;
export type Leniency = "Strict" | "Balanced" | "Lenient";
export type LeniencyPref = "Balanced" | "Lenient" | NoPref;
export type ExamType = "Project-based" | "Exam-based" | "Mixed";
export type ExamPref = "Project-based" | "Exam-based" | NoPref;
export type SuccessPref = "High" | "Medium" | "Low" | NoPref;
export type ResearchPref = "Yes" | "No" | NoPref;
export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
export const DAYS_OF_WEEK: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export interface Filters {
  timing: Timing;
  format: Format;
  length: Length;
  days: DayOfWeek[];
  assignmentFreq: LevelPref;
  difficulty: LevelPref;
  leniency: LeniencyPref;
  examType: ExamPref;
  research: ResearchPref;
  successRate: SuccessPref;
  interests: string[];
}

export const DEFAULT_FILTERS: Filters = {
  timing: NO_PREF,
  format: NO_PREF,
  length: NO_PREF,
  days: [],
  assignmentFreq: NO_PREF,
  difficulty: NO_PREF,
  leniency: NO_PREF,
  examType: NO_PREF,
  research: NO_PREF,
  successRate: NO_PREF,
  interests: [],
};

export const INTERESTS = [
  "Easy A Grade",
  "Low Workload",
  "Degree Alignment",
];

// =============================================================
// New section-level data shapes (one card per section)
// =============================================================
export interface ProfessorInfo {
  name: string;
  rmpId?: string;
  overallRating?: number;       // RMP 0-5
  difficulty?: number;          // RMP 0-5
  wouldTakeAgainPct?: number | null;
  numRatings?: number;
  department?: string;
  topReview?: string;
  aiSummary?: string;           // AI-style profile summary
  isNew: boolean;               // true when no RMP and no Coursicle reviews
}

export interface CourseSection {
  id: string;                   // e.g. "ACCT-200-001"
  courseCode: string;           // "ACCT 200"
  courseTitle: string;
  description: string;
  college: string;
  catalogUrl: string;
  prerequisites: string[];
  professor: ProfessorInfo;
  section: string;              // "001"
  timing: string;               // "Morning" | "Afternoon" | "Evening"
  format: string;               // "In-person" | "Online" | "Hybrid"
  length: string;               // "45 min" | "90 min"
  days: DayOfWeek[];            // e.g. ["Monday","Wednesday"] or ["Tuesday"]
  // Derived signals from review heuristics
  leniency: Leniency;
  workload: Level;
  difficulty: Level;
  examType: ExamType;
  successRate: number;          // 0-100 proxy
  easyAScore: number;           // 0-100
  tags: string[];
  relevantMajors: string[];
  // Newness flags
  isNewCourse?: boolean;        // no Coursicle reviews exist for this course at all
  isNewProfessor?: boolean;     // no RMP and no Coursicle reviews for this professor
  estimatedFromDeptAvg?: boolean; // both new — values are department averages
}

// =============================================================
// Dataset loader (cached singleton)
// =============================================================
let _cache: CourseSection[] | null = null;

export async function loadSections(): Promise<CourseSection[]> {
  if (_cache) return _cache;
  const res = await fetch("/dataset.json");
  if (!res.ok) throw new Error("Failed to load dataset.json");
  const data = (await res.json()) as CourseSection[];
  _cache = data;
  return data;
}
