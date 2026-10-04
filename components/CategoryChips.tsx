"use client";
import { Flower2, Cake, Gift, Sprout, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  flowers: Flower2, cakes: Cake, hampers: Gift, plants: Sprout, personalized: Sparkles,
};

export function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: { id: string; name: string; slug: string }[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
}) {
  return (
    <div role="group" aria-label="Categories" className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-full bg-blush p-1">
      <button
        type="button"
        aria-pressed={!selected}
        onClick={() => onSelect(null)}
        className={`flex h-8 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors ${
          !selected ? "border-ink bg-ink text-white" : "border-border bg-white text-ink hover:border-ink/30"
        }`}
      >
        <Sparkles className="h-4 w-4" /> All
      </button>
      {categories.map((c) => {
        const Icon = ICONS[c.slug] ?? Gift;
        const isSelected = selected === c.slug;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(c.slug)}
            className={`flex h-8 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors ${
              isSelected ? "border-ink bg-ink text-white" : "border-border bg-white text-ink hover:border-ink/30"
            }`}
          >
            <Icon className="h-4 w-4" /> {c.name}
          </button>
        );
      })}
    </div>
  );
}
