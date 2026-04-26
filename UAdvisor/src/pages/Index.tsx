import { useEffect, useMemo, useState } from "react";
import { UAHeader } from "@/components/UAHeader";
import { UAHeroBanner } from "@/components/UAHeroBanner";
import { Stepper } from "@/components/Stepper";
import { ProfileForm, ProfileData } from "@/components/ProfileForm";
import { FiltersForm } from "@/components/FiltersForm";
import { CourseCard } from "@/components/CourseCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseSection, DEFAULT_FILTERS, Filters, loadSections } from "@/data/uaData";
import { scoreSection } from "@/lib/matchEngine";
import { ArrowLeft, Loader2 } from "lucide-react";

const STEPS = ["Profile", "Preferences", "Recommendations"];

const STEP_TITLES = [
  {
    title: "Course Recommendation Advisor",
    desc: "Tell us about yourself, set your preferences, and get explainable course recommendations from the official UA catalog.",
  },
  {
    title: "Course Preferences & Filters",
    desc: "Adjust filters to refine your matches. All filters have a smart default — you can always reset.",
  },
  {
    title: "Your Recommended Courses",
    desc: "Courses ranked by Match Score using your profile, preferences, and outcome data.",
  },
];

const Index = () => {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sections, setSections] = useState<CourseSection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadSections()
      .then(setSections)
      .catch((e) => setLoadError(e?.message ?? "Failed to load course data"));
  }, []);

  const completedCourses = useMemo(() => profile?.completedCourses ?? [], [profile]);

  const { ranked, eliminated } = useMemo(() => {
    if (!sections) return { ranked: [], eliminated: [] };
    const scored = sections.map((s) => ({
      section: s,
      match: scoreSection(s, filters, profile, completedCourses),
    }));
    const elim = scored.filter((s) => s.match.eliminated);
    const live = scored
      .filter((s) => !s.match.eliminated)
      .sort((a, b) => b.match.score - a.match.score);
    return { ranked: live, eliminated: elim };
  }, [sections, filters, profile, completedCourses]);

  const breadcrumbs = ["Student Profile", "Course Preferences", "Recommendations"];
  const current = STEP_TITLES[step - 1];

  return (
    <div className="min-h-screen bg-background">
      <UAHeader
        breadcrumb={breadcrumbs[step - 1]}
        studentName="Wilbur Wildcat"
        studentId="123456"
      />
      <UAHeroBanner title={current.title} description={current.desc} />

      <main className="container py-8 md:py-10">
        {/* UAccess-style green alert */}

        <Stepper step={step} steps={STEPS} />

        {step === 1 && (
          <ProfileForm
            initial={profile || undefined}
            onSubmit={(p) => {
              setProfile(p);
              setStep(2);
            }}
          />
        )}

        {step === 2 && profile && (
          <>
            <ProfileSummary profile={profile} onEdit={() => setStep(1)} />
            <FiltersForm
              filters={filters}
              setFilters={setFilters}
              onContinue={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          </>
        )}

        {step === 3 && profile && (
          <>
            <ProfileSummary profile={profile} onEdit={() => setStep(1)} />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-primary" style={{ fontFamily: "'Source Serif 4', serif" }}>
                  Your top recommendations
                </h3>
                <p className="text-sm text-muted-foreground">
                  {ranked.length} eligible sections ranked by Match Score
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Edit filters
              </Button>
            </div>

            {!sections && !loadError && (
              <div className="flex items-center gap-2 text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading semester catalog…
              </div>
            )}
            {loadError && (
              <div className="text-sm text-destructive py-4">Could not load course data: {loadError}</div>
            )}

            <div className="grid gap-4">
              {ranked.map(({ section, match }) => (
                <CourseCard key={section.id} section={section} match={match} />
              ))}
            </div>

          </>
        )}
      </main>

      <footer className="mt-12">
        <div className="bg-primary text-primary-foreground">
          <div className="container py-6 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="font-semibold" style={{ fontFamily: "'Source Serif 4', serif" }}>
              The University of Arizona · UAdvisor
            </div>
            <div className="opacity-80 text-xs">
              Course data shown is illustrative. Always verify with the official UA catalog.
            </div>
          </div>
        </div>
        <div className="h-1.5 bg-brand-red" />
      </footer>
    </div>
  );
};

const ProfileSummary = ({ profile, onEdit }: { profile: ProfileData; onEdit: () => void }) => (
  <Card className="mb-6 border-l-4 border-l-brand-red shadow-card">
    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <div>
          <span className="text-muted-foreground">College:</span>{" "}
          <span className="font-semibold text-foreground">{profile.college}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Major:</span>{" "}
          <span className="font-semibold text-foreground">{profile.major}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Year:</span>{" "}
          <span className="font-semibold text-foreground">{profile.year}</span>
        </div>
        {profile.gpa && (
          <div>
            <span className="text-muted-foreground">GPA:</span>{" "}
            <span className="font-semibold text-foreground">{profile.gpa}</span>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit profile
      </Button>
    </CardContent>
  </Card>
);

export default Index;
