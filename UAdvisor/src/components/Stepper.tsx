import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  step: number;
  steps: string[];
}

export const Stepper = ({ step, steps }: StepperProps) => {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-4 py-6">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  done && "bg-primary border-primary text-primary-foreground",
                  active && "bg-brand-red border-brand-red text-brand-red-foreground shadow-brand",
                  !done && !active && "bg-card border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : idx}
              </div>
              <span
                className={cn(
                  "hidden md:inline text-sm font-medium",
                  active && "text-foreground",
                  !active && "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("mx-3 h-px w-8 md:w-16", done ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
};
