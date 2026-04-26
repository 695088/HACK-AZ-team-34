import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CourseSection } from "@/data/uaData";
import { MatchResult, scoreColor } from "@/lib/matchEngine";
import {
  ChevronDown,
  Sparkles,
  GraduationCap,
  TrendingUp,
  Star,
  AlertTriangle,
} from "lucide-react";
import { useState, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  section: CourseSection;
  match: MatchResult;
}

const ScoreBar = ({ score }: { score: number }) => {
  const color = scoreColor(score);
  const colorClass =
    color === "high" ? "bg-score-high" : color === "mid" ? "bg-score-mid" : "bg-score-low";
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Match Score
        </span>
        <span
          className={cn(
            "text-2xl font-bold tabular-nums",
            color === "high" && "text-score-high",
            color === "mid" && "text-score-mid",
            color === "low" && "text-score-low"
          )}
        >
          {score}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full transition-all", colorClass)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
};

// 5-star rating from a 0..1 ratio, rendered to nearest half-star
const StarRating = ({ ratio }: { ratio: number }) => {
  const stars = Math.max(0, Math.min(5, Math.round(ratio * 10) / 2));
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, stars - (i - 1)));
        return (
          <div key={i} className="relative h-4 w-4">
            <Star className="absolute inset-0 h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="h-4 w-4 fill-brand-red text-brand-red" strokeWidth={1.5} />
            </div>
          </div>
        );
      })}
      <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{stars.toFixed(1)}/5</span>
    </div>
  );
};

export const CourseCard = ({ section, match }: Props) => {
  const [open, setOpen] = useState(false);
  const prof = section.professor;

  return (
    <Card className="shadow-card hover:shadow-elevated transition-shadow border-l-4 border-l-primary overflow-hidden">
      <CardContent className="p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold tracking-wider text-brand-red uppercase">
                  {section.courseCode} · Section {section.section}
                </div>
                <h3 className="text-lg font-bold text-primary leading-snug">{section.courseTitle}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <GraduationCap className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  {prof.name}
                  <span className="mx-1.5">·</span>
                  <span>{section.college}</span>
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {prof.isNew && (
                <Badge className="bg-score-mid/15 text-score-mid border-score-mid/30 font-medium">
                  <Sparkles className="h-3 w-3 mr-1" />
                  New professor — no reviews yet
                </Badge>
              )}
              {section.tags.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="font-normal">
                  {t}
                </Badge>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat
                icon={<TrendingUp className="h-3.5 w-3.5 text-score-high" />}
                label="Success"
                value={`${section.successRate}%`}
              />
              <Stat label="Difficulty" value={section.difficulty} />
              <Stat label="Workload" value={section.workload} />
              <Stat
                label="Prof rating"
                value={prof.overallRating != null ? `${prof.overallRating.toFixed(1)}/5` : "—"}
              />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 md:border-l md:pl-4">
            <ScoreBar score={match.score} />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>{section.timing} · {section.length}</div>
              <div>{section.format}</div>
              {section.days && section.days.length > 0 && section.format !== "Online" && (
                <div>{section.days.map((d) => d.slice(0, 3)).join(" / ")}</div>
              )}
            </div>
          </div>
        </div>

        {match.warnings && match.warnings.length > 0 && (
          <div className="mt-4 rounded-md border border-score-mid/40 bg-score-mid/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-score-mid mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-score-mid">
                  Heads up before you enroll
                </div>
                <ul className="space-y-1 text-sm text-foreground">
                  {match.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-between text-primary hover:bg-secondary"
            >
              <span className="font-semibold">
                {open ? "Hide details" : "Why this was recommended & full details"}
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4 border-t mt-2">
            <Section title="💡 Why this was recommended">
              <ul className="space-y-1.5 text-sm">
                {match.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-score-high font-bold">✓</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              {match.bonuses && match.bonuses.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {match.bonuses.map((b, i) => (
                    <li key={i} className="flex gap-2 text-muted-foreground">
                      <span className="font-bold text-brand-red">★</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {match.layers && (
              <Section title="⭐ How this course matches you">
                <div className="space-y-2.5">
                  {match.layers.map((l) => {
                    const ratio = l.max > 0 ? l.earned / l.max : 0;
                    return (
                      <div key={l.layer} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{l.layer}</span>
                        {l.max > 0 ? (
                          <StarRating ratio={ratio} />
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {l.notes[0] || "No preference set"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            <Section title="📘 Course description">
              <p className="text-sm text-muted-foreground">{section.description}</p>
              {section.prerequisites.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium text-foreground">Prerequisites:</span>{" "}
                  {section.prerequisites.join(", ")}
                </p>
              )}
            </Section>

            <Section title="👨‍🏫 Professor summary">
              <p className="text-sm">
                <span className="font-semibold">{prof.name}</span>
                {!prof.isNew && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {section.leniency}
                  </span>
                )}
                {prof.overallRating != null && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    ★ {prof.overallRating.toFixed(1)}/5
                    {prof.numRatings ? ` · ${prof.numRatings} ratings` : ""}
                  </span>
                )}
              </p>
              {prof.aiSummary ? (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-red mr-1.5">
                    AI profile
                  </span>
                  {prof.aiSummary}
                </p>
              ) : prof.isNew ? (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  No RateMyProf or student reviews available yet — scored with a neutral baseline so this professor isn't penalized.
                </p>
              ) : null}
            </Section>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailMetric label="Difficulty" value={section.difficulty} />
              <DetailMetric label="Workload" value={section.workload} />
              <DetailMetric label="Exam style" value={section.examType} />
              <DetailMetric label="Easy A signal" value={`${section.easyAScore}/100`} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

const Stat = forwardRef<
  HTMLDivElement,
  { icon?: React.ReactNode; label: string; value: string }
>(({ icon, label, value }, ref) => (
  <div ref={ref} className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-1.5">
    {icon}
    <div className="leading-tight">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="text-xs font-semibold">{value}</div>
    </div>
  </div>
));
Stat.displayName = "Stat";

const Section = forwardRef<
  HTMLDivElement,
  { title: string; children: React.ReactNode }
>(({ title, children }, ref) => (
  <div ref={ref}>
    <h4 className="font-semibold text-sm text-primary mb-2">{title}</h4>
    {children}
  </div>
));
Section.displayName = "Section";

const DetailMetric = forwardRef<
  HTMLDivElement,
  { label: string; value: string }
>(({ label, value }, ref) => (
  <div ref={ref} className="rounded-md border bg-card p-2.5">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold mt-0.5">{value}</div>
  </div>
));
DetailMetric.displayName = "DetailMetric";
