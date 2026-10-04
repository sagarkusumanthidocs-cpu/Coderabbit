"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { demoRating } from "@/lib/demoRatings";
import { format12Hour } from "@/lib/utils";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";

export default function AdminStoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    fetch(`/api/admin/stores/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load this store.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function toggleOpen() {
    await fetch(`/api/admin/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: !data.store.isOpen }),
    });
    load();
  }

  if (error) return <AdminShell><ErrorState message={error} onRetry={load} /></AdminShell>;
  if (!data) return <AdminShell><LoadingSkeleton className="h-40 w-full" /></AdminShell>;

  const { store, stats } = data;

  return (
    <AdminShell>
      <button onClick={() => router.push("/admin/stores")} className="mb-3 text-sm font-semibold text-ink">← Back to stores</button>
      <h1 className="mb-4 font-serif text-xl font-semibold text-ink">{store.name}</h1>

      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-white p-3"><ImageWithFallback src={store.coverImage} alt={store.name} className="h-14 w-14 rounded-xl object-cover" /><div><p className="text-sm font-bold">{store.name}</p><p className="text-xs text-muted">{store.category.name} · {store.city.name}</p></div><span className="ml-auto rounded-full bg-blush px-2 py-1 text-xs">{store.isOpen ? "Open" : "Closed"}</span></div>
      <div className="grid gap-3">
        <Card>
          <CardContent>
            <p className="text-xs uppercase text-muted">Store info</p>
            <p className="mt-2 text-sm"><span className="text-muted">Category</span> &middot; {store.category.name}</p>
            <p className="text-sm"><span className="text-muted">City</span> &middot; {store.city.name}</p>
            <p className="text-sm"><span className="text-muted">Owner</span> &middot; {store.owner.name}</p>
            <p className="text-sm"><span className="text-muted">Hours</span> &middot; {format12Hour(store.openTime)} – {format12Hour(store.closeTime)}</p>
            <p className="text-sm"><span className="text-muted">Rating (demo)</span> · ⭐ {demoRating(store.id).toFixed(1)}</p>
            <p className="text-sm"><span className="text-muted">Products listed</span> &middot; {stats.productCount}</p>
            <Button size="sm" variant={store.isOpen ? "destructive" : "primary"} className="mt-3" onClick={toggleOpen}>
              {store.isOpen ? "Close store" : "Reopen store"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs uppercase text-muted">Performance (real data)</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-semibold">{stats.activeOrders}</p><p className="text-[10px] text-muted">Active orders</p></div>
              <div><p className="text-lg font-semibold">{stats.completedOrders}</p><p className="text-[10px] text-muted">Completed</p></div>
              <div><p className="text-lg font-semibold">{stats.returnPercent}%</p><p className="text-[10px] text-muted">Returns</p></div>
            </div>
            <p className="mt-3 text-sm"><span className="text-muted">Revenue (delivered orders)</span> &middot; ₹{stats.revenue.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
