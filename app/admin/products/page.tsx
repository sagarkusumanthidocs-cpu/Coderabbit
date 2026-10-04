"use client";
import { useEffect, useState } from "react";
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
  const [availableOnly, setAvailableOnly] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (availableOnly) params.set("availableOnly", "true");
    fetch(`/api/admin/products?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load products.");
        return r.json();
      })
      .then((d) => { setProducts(d.products); setError(null); })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [availableOnly]);

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
        <Select value={availableOnly} onChange={(e) => setAvailableOnly(e.target.value)} className="w-auto">
          <option value="">All</option>
          <option value="true">Available only</option>
        </Select>
      </div>
      {!products && <LoadingSkeleton className="h-40 w-full" />}
      {products && (
        <div className="grid gap-3">
          {products.map((p) => (
            <Card key={p.id} className="cursor-pointer" onClick={() => (window.location.href = `/admin/products/${p.id}`)}>
              <div className="flex gap-3 p-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-blush">
                  <ImageWithFallback src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-muted">{p.store.name} · {p.store.city?.name ?? ""}</p>
                  <p className="text-sm text-rose">{formatINR(p.price)}</p>
                </div>
                <Badge className={p.isAvailable ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}>
                  {p.isAvailable ? "Available" : "Unavailable"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
