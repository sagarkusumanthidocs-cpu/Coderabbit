import { Sparkles } from "lucide-react";

export function ComingSoon() {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-[15px] font-semibold text-ink">Coming soon</h2>
      <div className="flex items-center justify-between rounded-xl border border-dashed border-rose/30 bg-blush/40 p-3 text-[11px]">
        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-rose" />AI Gift Assistant</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-rose">Soon</span>
      </div>
    </section>
  );
}
