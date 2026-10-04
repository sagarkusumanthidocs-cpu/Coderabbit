"use client";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { CitySelector } from "@/components/CitySelector";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingGrid } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCity } from "@/lib/hooks/useCity";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { Search } from "lucide-react";

function ProductsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const { cityId, setCityId } = useCity(cities);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [searchQuery, setSearchQuery] = useState(sp.get("q") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [sort, setSort] = useState(sp.get("sort") ?? "newest");
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cities").then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).message ?? "Could not load cities.");
      return r.json();
    }).then((d) => {
      setCities(d.cities ?? []);
      if (!d.cities?.length) { setError("No delivery cities are available yet."); setLoading(false); }
    }).catch((e) => { setError(e.message); setLoading(false); });
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
  }, [reloadKey]);

  useEffect(() => {
    const urlCityId = sp.get("cityId");
    if (urlCityId) setCityId(urlCityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(() => {
    if (!cityId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ cityId });
    if (category) params.set("category", category);
    if (searchQuery) params.set("q", searchQuery);
    if (sort) params.set("sort", sort);
    fetch(`/api/products?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load products.");
        return r.json();
      })
      .then((d) => setProducts(d.products))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cityId, category, sort, searchQuery]);

  useEffect(load, [load]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(query);
    if (query === searchQuery) load();
  }

  function clearFilters() {
    setQuery("");
    setSearchQuery("");
    setCategory("");
    setSort("newest");
  }

  return (
    <CustomerShell>
      <div className="px-4 pt-4">
        <CitySelector cities={cities} selectedCityId={cityId} onChange={setCityId} />
        <form onSubmit={submitSearch} className="relative mt-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." className="pl-11" />
        </form>

        <div className="mt-3 flex gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="flex-1">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </Select>
        </div>

        <div className="mt-5">
          {loading && <LoadingGrid count={6} />}
          {!loading && error && <ErrorState message={error} onRetry={() => { setReloadKey((key) => key + 1); load(); }} />}
          {!loading && !error && products && products.length === 0 && (
            <EmptyState
              title="No gifts found"
              description="Try a different search or clear your filters."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          )}
          {!loading && !error && products && products.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  imageUrl={p.imageUrl}
                  storeName={p.store.name}
                  featured={p.isFeatured}
                  isFavorite={isFavorite(p.id)}
                  onToggleFavorite={() => toggleFavorite(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </CustomerShell>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsInner />
    </Suspense>
  );
}
