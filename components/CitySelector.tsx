"use client";
import { MapPin } from "lucide-react";
import { Select } from "@/components/ui/select";

export function CitySelector({
  cities,
  selectedCityId,
  onChange,
}: {
  cities: { id: string; name: string }[];
  selectedCityId: string;
  onChange?: (cityId: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-blush px-2.5 py-[5px]">
      <MapPin className="h-4 w-4 text-rose" />
      <span className="text-[10px] uppercase tracking-wide text-muted">Delivering to</span>
      <Select
        value={selectedCityId}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-auto w-auto border-none bg-transparent px-1 py-0 text-[13px] font-semibold text-ink"
      >
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
