import { Camera, CheckCircle2 } from "lucide-react";

export function DeliveryConfirmationBadge({ confirmed }: { confirmed: boolean }) {
  const Icon = confirmed ? CheckCircle2 : Camera;
  return (
    <span className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold ${confirmed ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {confirmed ? "Customer confirmed delivery" : "Awaiting customer photo"}
    </span>
  );
}
