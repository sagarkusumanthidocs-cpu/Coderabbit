"use client";
import { useEffect, useState } from "react";
import { FilterTabs } from "@/components/FilterTabs";
import { Input } from "@/components/ui/input";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { formatINR } from "@/lib/utils";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/products")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load products.");
        return r.json();
      })
      .then((d) => { setProducts(d.products); setError(null); })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);
  async function toggleAvailable(product: any) {
    setBusy(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isAvailable: !product.isAvailable }) });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not update product.");
      load();
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  const filtered = (products ?? []).filter((p) => (tab === "all" || p.isAvailable === (tab === "available")) && `${p.name} ${p.store.name} ${p.category.name}`.toLowerCase().includes(query.trim().toLowerCase()));

  if (error) {
    return (
      <AdminShell>
        <ErrorState message={error} onRetry={load} />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-serif text-xl font-semibold text-ink">Products</h1>
      </div>
      <Input aria-label="Search products" placeholder="Search products, category, or store…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <FilterTabs label="Product availability" value={tab} onChange={setTab} options={[{ value: "all", label: "All", count: products?.length ?? 0 }, { value: "available", label: "Available", count: products?.filter((p) => p.isAvailable).length ?? 0 }, { value: "unavailable", label: "Unavailable", count: products?.filter((p) => !p.isAvailable).length ?? 0 }]} />
      <p className="mb-3 text-[10px] text-muted">Tap a product to view its performance and edit details.</p>
      {!products && <LoadingSkeleton className="h-40 w-full" />}
      {products && (
        <div className="grid grid-cols-1 gap-3">
          {!filtered.length && <p className="text-sm text-muted">No products match.</p>}
          {filtered.map((p) => (
            <Card key={p.id} className="min-w-0 cursor-pointer" onClick={() => (window.location.href = `/admin/products/${p.id}`)}>
              <div className="flex gap-3 p-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-blush">
                  <ImageWithFallback src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-muted">{p.store.name} · {p.store.city?.name ?? ""}</p>
                  <p className="text-sm text-rose">{formatINR(p.price)}</p>
                </div>
                <button type="button" role="switch" aria-checked={p.isAvailable} aria-label={`${p.name} available`} disabled={busy === p.id || p.isArchived} onClick={(e) => { e.stopPropagation(); toggleAvailable(p); }} className={`relative h-[22px] w-10 shrink-0 rounded-full disabled:opacity-40 ${p.isAvailable ? "bg-[#1D9E75]" : "bg-gray-300"}`}><span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white ${p.isAvailable ? "left-[21px]" : "left-[3px]"}`} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
