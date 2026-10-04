import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { formatINR } from "@/lib/utils";
import { demoRating, demoDeliveryWindow } from "@/lib/demoRatings";
import { Heart, Star, Clock } from "lucide-react";

export function FavoriteButton({
  isFavorite,
  onToggle,
  productName,
  className = "",
}: {
  isFavorite: boolean;
  onToggle: () => void;
  productName: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${productName} from favorites` : `Save ${productName} to favorites`}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform active:scale-90 ${className}`}
    >
      <Heart className={`h-4 w-4 ${isFavorite ? "fill-rose text-rose" : "text-ink"}`} />
    </button>
  );
}

export function ProductCard({
  id,
  name,
  price,
  imageUrl,
  storeName,
  featured,
  isFavorite,
  onToggleFavorite,
}: {
  id: string;
  name: string;
  price: number | string;
  imageUrl: string;
  storeName: string;
  featured?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const rating = demoRating(id);
  const delivery = demoDeliveryWindow(id);
  return (
    <Link href={`/products/${id}`} className="group relative block">
      <article className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="relative h-[110px] w-full overflow-hidden bg-blush">
          <ImageWithFallback
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          {featured && (
            <span className="absolute left-2 top-2 rounded-full bg-rose px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              Featured
            </span>
          )}
          {onToggleFavorite && (
            <FavoriteButton
              isFavorite={!!isFavorite}
              onToggle={onToggleFavorite}
              productName={name}
              className="absolute right-2 top-2"
            />
          )}
        </div>
        <div className="p-3">
          <p className="truncate text-xs font-semibold text-ink">{name}</p>
          <p className="truncate text-[11px] text-muted">{storeName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted">
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
          </div>
          <p className="mt-1 text-[13px] font-semibold text-rose">{formatINR(price)}</p>
        </div>
      </article>
    </Link>
  );
}
