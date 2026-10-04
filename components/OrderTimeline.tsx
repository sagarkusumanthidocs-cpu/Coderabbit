import { CheckCircle2, Circle, MinusCircle } from "lucide-react";
import { formatKolkata } from "@/lib/services/scheduling";
import type { TimelineStep } from "@/lib/services/orderStateMachine";
import { cn } from "@/lib/utils";

export function OrderTimeline({ steps, horizontal = false }: { steps: TimelineStep[]; horizontal?: boolean }) {
  if (horizontal) return <ol className="no-scrollbar flex overflow-x-auto pb-1">{steps.map((step, index) => <li key={step.status} className="relative w-[84px] shrink-0 text-center">
    {index > 0 && <span className={cn("absolute -left-[42px] top-3.5 h-0.5 w-[84px]", step.state === "upcoming" ? "bg-border" : "bg-rose")} />}
    <span className={cn("relative z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", step.state === "completed" || step.state === "current" ? "bg-rose text-white" : "bg-blush text-muted")}>{step.state === "completed" ? "✓" : step.state === "admin-skipped" ? "–" : index + 1}</span>
    <p className={cn("mt-1 text-[10px] font-semibold", step.state === "upcoming" ? "text-muted" : "text-ink")}>{step.label}</p>
    {step.timestamp && <p className="mt-1 text-[9px] text-muted">{formatKolkata(new Date(step.timestamp))}</p>}
    {step.state === "admin-skipped" && <p className="mt-1 text-[9px] text-amber-700">Skipped by admin correction · no event recorded</p>}
  </li>)}</ol>;
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={step.status} className="relative flex gap-3 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span
              className={cn(
                "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5",
                step.state === "completed" || step.state === "current" ? "bg-rose" : "bg-ink/10"
              )}
            />
          )}
          <span className="z-10 mt-0.5">
            {step.state === "completed" || step.state === "current" ? (
              <CheckCircle2 className={cn("h-6 w-6", step.state === "current" ? "text-rose" : "text-green-600")} />
            ) : step.state === "admin-skipped" ? (
              <MinusCircle className="h-6 w-6 text-amber-500" />
            ) : (
              <Circle className="h-6 w-6 text-ink/20" />
            )}
          </span>
          <div>
            <p
              className={cn(
                "font-medium",
                step.state === "upcoming" ? "text-muted" : "text-ink",
                step.state === "current" && "text-rose"
              )}
            >
              {step.label}
            </p>
            {step.timestamp && <p className="text-xs text-muted">{formatKolkata(new Date(step.timestamp))}</p>}
            {step.state === "admin-skipped" && (
              <p className="text-xs italic text-amber-600">Skipped by admin correction - no event recorded</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
