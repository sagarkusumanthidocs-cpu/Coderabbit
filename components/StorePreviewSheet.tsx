"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Star, Clock, MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { StoreLogo } from "@/components/StoreCard";
import { ErrorState } from "@/components/ErrorState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { formatINR } from "@/lib/utils";
import { demoRating, demoDeliveryWindow } from "@/lib/demoRatings";

export function StorePreviewSheet({
  storeId,
  onOpenChange,
}: {
  storeId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    if (!storeId) {
      setStore(null);
      return;
    }
    let cancelled = false;
    setStore(null);
    setError(null);
    fetch(`/api/stores/${storeId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load this store.");
        return r.json();
      })
      .then((d) => { if (!cancelled) setStore(d.store); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [storeId, reloadKey]);

  const open = !!storeId;
  const rating = storeId ? demoRating(storeId) : 0;
  const delivery = storeId ? demoDeliveryWindow(storeId) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <SheetContent>
          {!store && <SheetTitle className="mb-3 font-serif text-lg">Store preview</SheetTitle>}
          {error ? (
            <div>
              <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
              <button className="mt-3 text-sm text-rose" onClick={() => onOpenChange(false)}>Close</button>
            </div>
          ) : !store ? (
            <div className="space-y-3">
              <LoadingSkeleton className="h-6 w-1/2" />
              <LoadingSkeleton className="h-56 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="font-serif text-[17px] font-semibold text-ink">{store.name}</SheetTitle>
                  <p className="text-xs text-muted">{store.category.name}</p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted hover:bg-blush"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative mt-3 h-[140px] w-full overflow-hidden rounded-2xl bg-blush">
                <ImageWithFallback src={store.coverImage} alt={store.name} className="h-full w-full object-cover" />
                <ImageWithFallback src={store.coverImage} alt="" className="absolute bottom-3 left-3 h-11 w-11 rounded-xl border-2 border-white object-cover shadow-md" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1 font-medium text-ink">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                  <span className="text-xs font-normal text-muted">(demo)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Delivers in {delivery}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <MapPin className="h-4 w-4" />
                Delivers in {store.city.name}
              </p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                Available in {store.city.name}
              </p>
              <div className="mt-2 space-y-2">
                {store.products.length === 0 && <p className="text-xs text-muted">No products yet.</p>}
                {store.products.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-white p-2 hover:shadow-sm"
                  >
                    <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl bg-blush">
                      <ImageWithFallback src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    </div>
                    <p className="flex-1 text-[13px] font-medium text-ink">{p.name}</p>
                    <p className="text-[13px] font-semibold text-ink">{formatINR(p.price)}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}
