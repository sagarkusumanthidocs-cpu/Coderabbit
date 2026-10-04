"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { CustomerShell } from "@/components/CustomerShell";
import { CitySelector } from "@/components/CitySelector";
import { ProductCard } from "@/components/ProductCard";
import { StoreCard } from "@/components/StoreCard";
import { HeroBanner } from "@/components/HeroBanner";
import { ActiveOrderCard } from "@/components/ActiveOrderCard";
import { CategoryChips } from "@/components/CategoryChips";
import { ComingSoon } from "@/components/ComingSoon";
import { EmptyState } from "@/components/EmptyState";
import { LoadingGrid, LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { Input } from "@/components/ui/input";
import { useCity } from "@/lib/hooks/useCity";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { Search } from "lucide-react";

export default function HomePage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const { cityId, setCityId } = useCity(cities);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
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

  useEffect(() => {
    setSearchResults(null); setSearchError(null);
    if (!query.trim() || !cityId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/products?cityId=${encodeURIComponent(cityId)}&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Search failed."); return d; })
        .then(setSearchResults).catch((e) => { if (e.name !== "AbortError") setSearchError(e.message); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, cityId, reloadKey]);

  const cityName = cities.find((c) => c.id === cityId)?.name ?? "";
  const featured = (data?.featured ?? []).filter((p: any) => !category || p.category?.slug === category);

  const stores = (data?.stores ?? []).filter((s: any) => !category || s.category?.slug === category);

  return (
    <CustomerShell>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="flex items-center justify-between">
          <CitySelector cities={cities} selectedCityId={cityId} onChange={setCityId} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setReloadKey((key) => key + 1); }} className="mt-3 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search gifts or stores..."
            aria-label="Search gifts or stores"
          />
          <button type="submit" aria-label="Search" className="flex h-11 w-12 shrink-0 items-center justify-center rounded-full bg-rose text-white"><Search className="h-4 w-4" /></button>
        </form>

        {query.trim() ? <section className="mt-4 space-y-3" aria-live="polite">
          {searchError ? <ErrorState message={searchError} onRetry={() => setReloadKey((key) => key + 1)} /> : !searchResults ? <LoadingGrid count={2} /> : <>
            <h2 className="font-serif font-semibold">Stores ({searchResults.stores.length})</h2>
            {searchResults.stores.map((s: any) => <StoreCard key={s.id} id={s.id} name={s.name} categoryName={s.category.name} cityName={cityName} isOpen={s.isOpen} coverImage={s.coverImage} />)}
            <h2 className="font-serif font-semibold">Gifts ({searchResults.products.length})</h2>
            <div className="grid grid-cols-2 gap-3">{searchResults.products.map((p: any) => <ProductCard key={p.id} id={p.id} name={p.name} price={p.price} imageUrl={p.imageUrl} storeName={p.store.name} isFavorite={isFavorite(p.id)} onToggleFavorite={() => toggleFavorite(p.id)} />)}</div>
            {!searchResults.stores.length && !searchResults.products.length && <EmptyState title="No gifts or stores found" description="Try a different search." />}
          </>}
        </section> : <>
        <div className="mt-4 grid gap-4">
          <HeroBanner cityName={cityName || "your city"} onExplore={() => document.getElementById("featured")?.scrollIntoView({ behavior: "smooth" })} />
          <ActiveOrderCard order={activeOrder} />
        </div>

        <div className="mt-4">
          <CategoryChips categories={data?.categories ?? []} selected={category} onSelect={setCategory} />
        </div>

        {loading && (
          <div className="mt-6 space-y-3">
            <LoadingSkeleton className="h-6 w-32" />
            <LoadingGrid count={4} />
          </div>
        )}

        {!loading && error && <div className="mt-4"><ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} /></div>}

        {!loading && !error && data && (
          <>
            {featured.length === 0 && data.stores.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="We are not in this city yet" description="Try another city to see gifts and stores." />
              </div>
            ) : (
              <>
                <section id="featured" className="mt-3 scroll-mt-20">
                  <h2 id="featured-heading" className="font-serif text-[15px] font-semibold text-ink">Featured gifts in {cityName}</h2>
                  <p className="mb-2 text-xs text-muted">{featured.length} {featured.length === 1 ? "gift" : "gifts"} available today</p>
                  {featured.length > 0 ? (
                    <div role="region" aria-labelledby="featured-heading" tabIndex={0} className="no-scrollbar flex min-w-0 flex-nowrap gap-3.5 overflow-x-auto pb-1">
                      {featured.map((p: any) => <Link key={p.id} href={`/products/${p.id}`} className="w-[76px] shrink-0 text-center"><div className="mx-auto h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-border bg-blush"><ImageWithFallback src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" /></div><p className="mt-1 truncate text-[11px] font-semibold">{p.name}</p></Link>)}
                    </div>
                  ) : (
                    <EmptyState title="No gifts found" description="Try a different category." />
                  )}
                </section>

                <section className="mt-4">
                  <h2 id="stores-heading" className="mb-3 font-serif text-[15px] font-semibold text-ink">Popular local stores ({stores.length})</h2>
                  <div role="region" aria-labelledby="stores-heading" tabIndex={0} className="max-h-[460px] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2.5">
                    {stores.map((s: any) => (
                      <StoreCard
                        key={s.id}
                        id={s.id}
                        name={s.name}
                        categoryName={s.category.name}
                        cityName={cityName}
                        isOpen={s.isOpen}
                        coverImage={s.coverImage}
                        square
                      />
                    ))}
                    </div>
                  </div>
                  {!stores.length && <EmptyState title="No stores match this category" description="Try a different category or city." />}
                </section>

                <div className="mt-6 pb-4">
                  <ComingSoon />
                </div>
              </>
            )}
          </>
        )}
        </>}
      </div>
    </CustomerShell>
  );
}
