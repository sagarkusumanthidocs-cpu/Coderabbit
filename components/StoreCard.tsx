import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Badge } from "@/components/ui/badge";
import { demoRating, demoDeliveryWindow } from "@/lib/demoRatings";
import { Star, Clock, MapPin } from "lucide-react";

function initialsFor(name: string) {
  return name
    .replace(/^The\s+/i, "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

export function StoreLogo({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white bg-blush font-serif text-sm font-semibold text-rose shadow-sm ${className}`}
    >
      {initialsFor(name)}
    </span>
  );
}

export function StoreCard({
  id,
  name,
  categoryName,
  cityName,
  isOpen,
  coverImage,
  horizontal,
  square,
  onOpen,
}: {
  id: string;
  name: string;
  categoryName: string;
  cityName: string;
  isOpen: boolean;
  coverImage: string;
  horizontal?: boolean;
  square?: boolean;
  onOpen?: (id: string) => void;
}) {
  if (square) return <Link href={`/stores/${id}`} className="overflow-hidden rounded-2xl border border-border bg-white">
    <div className="aspect-square bg-blush"><ImageWithFallback src={coverImage} alt={name} className="h-full w-full object-cover" /></div>
    <div className="p-2.5"><p className="truncate text-xs font-semibold">{name}</p><p className="my-0.5 text-[10px] text-muted">{categoryName} · {cityName}</p><div className="flex items-center justify-between text-[10px]"><span>⭐ {demoRating(id).toFixed(1)}</span><span className={`rounded-full px-2 py-0.5 ${isOpen ? "bg-green-100 text-green-800" : "bg-gray-100 text-muted"}`}>{isOpen ? "Open" : "Closed"}</span></div></div>
  </Link>;
  if (horizontal) {
    const rating = demoRating(id);
    const delivery = demoDeliveryWindow(id);
    return (
      <Link
        href={`/stores/${id}`}
        onClick={onOpen ? (e) => { e.preventDefault(); onOpen(id); } : undefined}
        className="block w-64 flex-shrink-0 snap-start"
      >
        <article className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-blush">
            <ImageWithFallback src={coverImage} alt={name} className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col gap-1 p-3 pt-0">
            <StoreLogo name={name} className="relative -mt-6" />
            <p className="font-semibold text-ink">{name}</p>
            <p className="text-xs text-muted">{categoryName}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              <span className="flex items-center gap-0.5 font-medium text-ink">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)}
                <span className="ml-0.5 text-[10px] font-normal text-muted">(demo)</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-3.5 w-3.5" />
                {delivery}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3.5 w-3.5" />
                {cityName}
              </span>
            </div>
            <Badge className={isOpen ? "w-fit bg-green-100 text-green-800" : "w-fit bg-gray-200 text-gray-600"}>
              {isOpen ? "Open" : "Closed"}
            </Badge>
          </div>
        </article>
      </Link>
    );
  }
  return (
    <Link href={`/stores/${id}`}>
      <article className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
        <StoreLogo name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{name}</p>
          <p className="truncate text-xs text-muted">{categoryName} · {cityName}</p>
        </div>
        <Badge className={isOpen ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}>
          {isOpen ? "Open" : "Closed"}
        </Badge>
      </article>
    </Link>
  );
}
