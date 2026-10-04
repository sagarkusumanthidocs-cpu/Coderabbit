"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { useCity } from "@/lib/hooks/useCity";
import { format12Hour } from "@/lib/utils";
import { MapPin } from "lucide-react";

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { cityId } = useCity([]);

  useEffect(() => {
    setError(null);
    setLoading(true);
    fetch(`/api/stores/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Store not found.");
        return r.json();
      })
      .then((d) => setStore(d.store))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id, reloadKey]);

  if (loading) {
    return (
      <CustomerShell>
        <div className="space-y-3 p-4">
          <LoadingSkeleton className="h-40 w-full" />
          <LoadingSkeleton className="h-6 w-1/2" />
        </div>
      </CustomerShell>
    );
  }

  if (error || !store) {
    return (
      <CustomerShell>
        <div className="p-4">
          <ErrorState message={error ?? "Store not found."} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      </CustomerShell>
    );
  }

  const cityMismatch = cityId && store.cityId !== cityId;

  return (
    <CustomerShell>
      <div className="relative h-40 w-full bg-blush">
        <ImageWithFallback src={store.coverImage} alt={store.name} className="h-full w-full object-cover" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-xl font-semibold text-ink">{store.name}</h1>
          <Badge className={store.isOpen ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}>
            {store.isOpen ? "Open" : "Closed"}
          </Badge>
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
          <MapPin className="h-3.5 w-3.5" /> {store.category.name} · {store.city.name}
        </p>
        <p className="mt-1 text-xs text-muted">🏪 Open {format12Hour(store.openTime)} - {format12Hour(store.closeTime)}</p>
        <p className="mt-2 text-sm text-muted">{store.description}</p>

        {cityMismatch && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            This store delivers in {store.city.name}, which is different from your selected city. You can still
            browse, but ordering will be disabled.
          </div>
        )}

        <h2 className="mb-2 mt-5 text-sm font-semibold text-ink">Products</h2>
        {store.products.length === 0 ? (
          <EmptyState title="No products yet" description="This store hasn't added any products." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {store.products.map((p: any) => (
              <ProductCard key={p.id} id={p.id} name={p.name} price={p.price} imageUrl={p.imageUrl} storeName={store.name} featured={p.isFeatured} />
            ))}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
