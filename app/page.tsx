"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { CitySelector } from "@/components/CitySelector";
import { ProductCard } from "@/components/ProductCard";
import { StoreCard } from "@/components/StoreCard";
import { HeroBanner } from "@/components/HeroBanner";
import { ActiveOrderCard } from "@/components/ActiveOrderCard";
import { CategoryChips } from "@/components/CategoryChips";
import { ComingSoon } from "@/components/ComingSoon";
import { StorePreviewSheet } from "@/components/StorePreviewSheet";
import { EmptyState } from "@/components/EmptyState";
import { LoadingGrid, LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { Input } from "@/components/ui/input";
import { useCity } from "@/lib/hooks/useCity";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { Search } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const { cityId, setCityId } = useCity(cities);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [previewStoreId, setPreviewStoreId] = useState<string | null>(null);
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    fetch("/api/cities").then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).message ?? "Could not load cities.");
      return r.json();
    }).then((d) => {
      setCities(d.cities ?? []);
      if (!d.cities?.length) { setError("No delivery cities are available yet."); setLoading(false); }
    }).catch((e) => { setError(e.message); setLoading(false); });
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => {
        const active = (d.orders ?? []).find((o: any) => o.status !== "DELIVERED" && o.status !== "REJECTED");
        setActiveOrder(active ?? null);
      })
      .catch(() => {});
  }, [reloadKey]);

  useEffect(() => {
    if (!cityId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/home?cityId=${cityId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load the page.");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cityId, reloadKey]);

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/products?cityId=${cityId}&q=${encodeURIComponent(query)}`);
  }

  const cityName = cities.find((c) => c.id === cityId)?.name ?? "";
  const featured = (data?.featured ?? []).filter((p: any) => !category || p.category?.slug === category);

  return (
    <CustomerShell>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="flex items-center justify-between">
          <CitySelector cities={cities} selectedCityId={cityId} onChange={setCityId} />
        </div>
        <form onSubmit={goSearch} className="relative mt-3">
          <button type="submit" aria-label="Search" className="absolute left-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted"><Search className="h-4 w-4" /></button>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search gifts or stores..."
            className="pl-11"
          />
        </form>

        <div className="mt-4 grid gap-4">
          <HeroBanner cityName={cityName || "your city"} onExplore={() => document.getElementById("featured")?.scrollIntoView({ behavior: "smooth" })} />
          <ActiveOrderCard order={activeOrder} />
        </div>

        <div className="mt-6">
          <CategoryChips categories={data?.categories ?? []} selected={category} onSelect={setCategory} />
        </div>

        {loading && (
          <div className="mt-6 space-y-3">
            <LoadingSkeleton className="h-6 w-32" />
            <LoadingGrid count={4} />
          </div>
        )}

        {!loading && error && <div className="mt-6"><ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} /></div>}

        {!loading && !error && data && (
          <>
            {featured.length === 0 && data.stores.length === 0 ? (
              <div className="mt-6">
                <EmptyState title="We are not in this city yet" description="Try another city to see gifts and stores." />
              </div>
            ) : (
              <>
                <section id="featured" className="mt-6 scroll-mt-20">
                  <h2 className="font-serif text-lg font-semibold text-ink">Featured gifts in {cityName}</h2>
                  <p className="mb-3 text-sm text-muted">{featured.length} {featured.length === 1 ? "gift" : "gifts"} available today</p>
                  {featured.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {featured.map((p: any) => (
                        <ProductCard
                          key={p.id}
                          id={p.id}
                          name={p.name}
                          price={p.price}
                          imageUrl={p.imageUrl}
                          storeName={p.store.name}
                          featured
                          isFavorite={isFavorite(p.id)}
                          onToggleFavorite={() => toggleFavorite(p.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No gifts found" description="Try a different category." />
                  )}
                </section>

                <section className="mt-6">
                  <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Popular local stores in {cityName}</h2>
                  <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                    {data.stores.map((s: any) => (
                      <StoreCard
                        key={s.id}
                        id={s.id}
                        name={s.name}
                        categoryName={s.category.name}
                        cityName={cityName}
                        isOpen={s.isOpen}
                        coverImage={s.coverImage}
                        horizontal
                        onOpen={setPreviewStoreId}
                      />
                    ))}
                  </div>
                </section>

                <div className="mt-6 pb-4">
                  <ComingSoon />
                </div>
              </>
            )}
          </>
        )}
      </div>
      <StorePreviewSheet storeId={previewStoreId} onOpenChange={(open) => !open && setPreviewStoreId(null)} />
    </CustomerShell>
  );
}
