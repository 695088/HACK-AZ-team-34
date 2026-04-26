import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UA_COLLEGES, YEARS, Year } from "@/data/uaData";
import { Upload, GraduationCap, Loader2, CheckCircle2 } from "lucide-react";

export interface ProfileData {
  name: string;
  studentId: string;
  college: string;
  major: string;
  year: Year;
  gpa?: string;
  transcriptName?: string;
  completedCourses?: string[];
}

interface Props {
  initial?: Partial<ProfileData>;
  onSubmit: (p: ProfileData) => void;
}

// Extract course codes from arbitrary text using a UA-style code regex
function extractCourseCodes(text: string): string[] {
  const re = /\b([A-Z]{2,4})\s*[- ]?\s*(\d{3}[A-Z]?\d?)\b/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    set.add(`${m[1]} ${m[2]}`);
  }
  return Array.from(set);
}

async function parseTranscriptPdf(file: File): Promise<string[]> {
  // Dynamic import keeps initial bundle small
  const pdfjs: any = await import("pdfjs-dist");
  // Use the bundled worker
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    fullText += " " + content.items.map((it: any) => it.str).join(" ");
  }
  return extractCourseCodes(fullText);
}

const FIXED_NAME = "Wilbur Wildcat";
const FIXED_STUDENT_ID = "123456";

export const ProfileForm = ({ initial, onSubmit }: Props) => {
  const [college, setCollege] = useState(initial?.college || "");
  const [major, setMajor] = useState(initial?.major || "");
  const [year, setYear] = useState<Year | "">(initial?.year || "");
  const [gpa, setGpa] = useState(initial?.gpa || "");
  const [transcriptName, setTranscriptName] = useState(initial?.transcriptName || "");
  const [completedCourses, setCompletedCourses] = useState<string[]>(initial?.completedCourses || []);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [error, setError] = useState("");

  const majorOptions = useMemo(() => (college ? UA_COLLEGES[college] || [] : []), [college]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setTranscriptName(file.name);
    setParseError("");
    setParsing(true);
    try {
      const codes = await parseTranscriptPdf(file);
      setCompletedCourses(codes);
    } catch (err) {
      console.error(err);
      setParseError("Could not read this PDF. You can still continue without it.");
      setCompletedCourses([]);
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = () => {
    if (!college || !major || !year) {
      setError("Please complete all required fields.");
      return;
    }
    setError("");
    onSubmit({
      name: FIXED_NAME,
      studentId: FIXED_STUDENT_ID,
      college,
      major,
      year: year as Year,
      gpa: gpa || undefined,
      transcriptName: transcriptName || undefined,
      completedCourses: completedCourses.length ? completedCourses : undefined,
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <GraduationCap className="h-5 w-5" />
            Academic Profile
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Required information about your enrollment.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="required-asterisk">College</Label>
            <Select
              value={college}
              onValueChange={(v) => {
                setCollege(v);
                setMajor("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your college" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(UA_COLLEGES).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="required-asterisk">Major</Label>
            <Select value={major} onValueChange={setMajor} disabled={!college}>
              <SelectTrigger>
                <SelectValue placeholder={college ? "Select your major" : "Select college first"} />
              </SelectTrigger>
              <SelectContent>
                {majorOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="required-asterisk">Year</Label>
            <Select value={year} onValueChange={(v) => setYear(v as Year)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Upload className="h-5 w-5" />
            Transcript (Optional)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload your unofficial transcript PDF. We'll detect completed courses to skip duplicates and verify prerequisites.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Upload transcript (PDF)</Label>
            <label
              htmlFor="transcript"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-secondary/40 px-4 py-6 text-sm text-muted-foreground hover:bg-secondary/70 transition-colors"
            >
              {parsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading transcript…
                </>
              ) : transcriptName ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-score-high" />
                  {transcriptName}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Click to upload (optional)
                </>
              )}
            </label>
            <input
              id="transcript"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {parseError && <p className="text-xs text-destructive">{parseError}</p>}
            {completedCourses.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Detected <span className="font-semibold text-foreground">{completedCourses.length}</span> completed course
                {completedCourses.length !== 1 ? "s" : ""}: {completedCourses.slice(0, 6).join(", ")}
                {completedCourses.length > 6 ? "…" : ""}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>GPA (optional)</Label>
            <Input
              type="text"
              placeholder="e.g., 3.4"
              value={gpa}
              onChange={(e) => setGpa(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="md:col-span-2 flex flex-col items-end gap-2">
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button size="lg" onClick={handleSubmit} className="bg-brand-red hover:bg-brand-red/90 text-brand-red-foreground">
          Next →
        </Button>
      </div>
    </div>
  );
};
