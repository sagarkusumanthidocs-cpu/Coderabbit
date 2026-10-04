"use client";
export function FilterTabs({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string; count?: number }[]; onChange: (value: string) => void }) {
  return <div role="group" aria-label={label} className="no-scrollbar my-3 flex gap-1.5 overflow-x-auto rounded-full bg-blush p-1">{options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${value === option.value ? "border-ink bg-ink text-white" : "border-transparent bg-transparent text-muted"}`}>{option.label}{option.count !== undefined && ` (${option.count})`}</button>)}</div>;
}
