import { ChevronDown, Home } from "lucide-react";
import uaLogo from "@/assets/ua-logo.png";

const NAV = ["Personal", "Enrollment", "Advising", "Academic Record", "Financial Aid", "Bursar Account"];

interface Props {
  breadcrumb?: string;
  studentName?: string;
  studentId?: string;
}

export const UAHeader = ({
  breadcrumb,
  studentName = "Wildcat Student",
  studentId = "123456",
}: Props) => {
  return (
    <header>
      {/* Thin red top bar */}
      <div className="ua-top-bar">
        <div className="container py-2">
          <span
            className="text-brand-red-foreground text-sm font-semibold tracking-[0.18em]"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            THE UNIVERSITY OF ARIZONA
          </span>
        </div>
      </div>

      {/* Logo lockup row */}
      <div className="bg-card">
        <div className="container flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            {/* UA "A" logo */}
            <img
              src={uaLogo}
              alt="University of Arizona"
              className="h-14 w-auto object-contain"
            />
            <div className="h-12 w-px bg-border" />
            <div className="leading-tight">
              <div className="text-3xl font-bold text-primary" style={{ fontFamily: "'Source Serif 4', serif" }}>
                UAdvisor
              </div>
              <div className="text-[11px] font-bold tracking-[0.18em] text-primary/80 uppercase">
                Course Recommender
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end text-right">
            <div className="text-sm font-bold tracking-wider text-primary">{studentName.toUpperCase()}</div>
            <div className="text-xs text-muted-foreground">
              STUDENT ID: <span className="font-semibold text-foreground">{studentId}</span>
            </div>
          </div>
        </div>

        {/* Bottom divider */}
        <div className="border-t border-border" />
        {/* Breadcrumb */}
        <div className="container py-3 text-sm flex items-center gap-2">
          <Home className="h-4 w-4 text-brand-red" />
          <a href="#" className="font-bold text-brand-red hover:underline">
            Home
          </a>
          {breadcrumb && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground">{breadcrumb}</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
