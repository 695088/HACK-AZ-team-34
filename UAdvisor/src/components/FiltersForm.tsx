import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_FILTERS, DAYS_OF_WEEK, DayOfWeek, Filters, INTERESTS, NO_PREF } from "@/data/uaData";
import { Sliders, Target, Heart, RotateCcw } from "lucide-react";
import { useEffect } from "react";

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  onContinue: () => void;
  onBack: () => void;
}

const FilterSelect = <T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: T[];
  disabled?: boolean;
  hint?: string;
}) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export const FiltersForm = ({ filters, setFilters, onContinue, onBack }: Props) => {
  const update = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ ...filters, [k]: v });

  const onlineLocked = filters.format === "Online";

  // When user switches to Online, force timing/length to "No preference"
  useEffect(() => {
    if (onlineLocked && (filters.timing !== NO_PREF || filters.length !== NO_PREF)) {
      setFilters({ ...filters, timing: NO_PREF, length: NO_PREF });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineLocked]);

  const toggleInterest = (i: string) => {
    const has = filters.interests.includes(i);
    const next = has ? filters.interests.filter((x) => x !== i) : [...filters.interests, i];
    setFilters({ ...filters, interests: next });
  };

  const selectedDays = filters.days ?? [];

  const toggleDay = (d: DayOfWeek) => {
    if (onlineLocked) return;
    const has = selectedDays.includes(d);
    const next = has ? selectedDays.filter((x) => x !== d) : [...selectedDays, d];
    setFilters({ ...filters, days: next });
  };

  // Clear days if Online is locked
  useEffect(() => {
    if (onlineLocked && selectedDays.length > 0) {
      setFilters({ ...filters, days: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineLocked]);

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sliders className="h-5 w-5" />
              Course Preferences
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Choose "No preference" for any filter you don't care about.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <FilterSelect
            label="Format"
            value={filters.format}
            onChange={(v) => update("format", v)}
            options={[NO_PREF, "In-person", "Online"]}
          />
          <FilterSelect
            label="Class Timing"
            value={filters.timing}
            onChange={(v) => update("timing", v)}
            options={[NO_PREF, "Morning", "Afternoon"]}
            disabled={onlineLocked}
            hint={onlineLocked ? "Disabled for online courses" : undefined}
          />
          <FilterSelect
            label="Class Length"
            value={filters.length}
            onChange={(v) => update("length", v)}
            options={[NO_PREF, "45 min", "90 min"]}
            disabled={onlineLocked}
            hint={onlineLocked ? "Disabled for online courses" : undefined}
          />
          <FilterSelect
            label="Assignment Frequency"
            value={filters.assignmentFreq}
            onChange={(v) => update("assignmentFreq", v)}
            options={[NO_PREF, "Low", "Medium", "High"]}
          />
          <FilterSelect
            label="Difficulty"
            value={filters.difficulty}
            onChange={(v) => update("difficulty", v)}
            options={[NO_PREF, "Low", "Medium", "High"]}
          />
          <FilterSelect
            label="Professor Leniency"
            value={filters.leniency}
            onChange={(v) => update("leniency", v)}
            options={[NO_PREF, "Balanced", "Lenient"]}
          />
          <FilterSelect
            label="Final Exam Type"
            value={filters.examType}
            onChange={(v) => update("examType", v)}
            options={[NO_PREF, "Project-based", "Exam-based"]}
          />
          <FilterSelect
            label="Research Oriented"
            value={filters.research}
            onChange={(v) => update("research", v)}
            options={[NO_PREF, "Yes", "No"]}
          />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Sliders className="h-5 w-5" />
            Preferred Days
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick the weekdays you'd like classes on.
            {onlineLocked && " (disabled for online courses)"}
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((d) => {
            const active = selectedDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                disabled={onlineLocked}
                onClick={() => toggleDay(d)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-foreground border-border hover:bg-secondary"
                }`}
              >
                {d}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Heart className="h-5 w-5" />
            Interests <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Pick any that matter to you — none required.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const active = filters.interests.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggleInterest(i)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-foreground border-border hover:bg-secondary"
                }`}
              >
                {i}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          size="lg"
          className="bg-brand-red hover:bg-brand-red/90 text-brand-red-foreground"
          onClick={onContinue}
        >
          View Recommendations →
        </Button>
      </div>
    </div>
  );
};
