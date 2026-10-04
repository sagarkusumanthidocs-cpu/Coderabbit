"use client";
import { useEffect, useState } from "react";
import { FilterTabs } from "@/components/FilterTabs";
import { Input } from "@/components/ui/input";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { demoRating } from "@/lib/demoRatings";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";

const MODERATION_COLORS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  BLOCKED: "bg-red-100 text-red-800",
};

export default function AdminStoresPage() {
  const [stores, setStores] = useState<any[] | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/stores")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load stores.");
        return r.json();
      })
      .then((d) => { setStores(d.stores); setError(null); })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function setModeration(id: string, status: string) {
    try {
      const res = await fetch(`/api/admin/stores/${id}/moderation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not update store.");
      load();
    } catch (e: any) { setError(e.message); throw e; }
  }
  async function toggleOpen(store: any) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/stores/${store.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isOpen: !store.isOpen }) });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not update store.");
      load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  if (error) {
    return (
      <AdminShell>
        <ErrorState message={error} onRetry={load} />
      </AdminShell>
    );
  }

  if (!stores) {
    return (
      <AdminShell>
        <LoadingSkeleton className="h-40 w-full" />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="mb-4 font-serif text-xl font-semibold text-ink">Stores ({stores.length})</h1>
      <Input aria-label="Search stores" placeholder="Search stores by name or city…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <FilterTabs label="Store status" value={tab} onChange={setTab} options={[{ value: "all", label: "All", count: stores.length }, { value: "open", label: "Open", count: stores.filter((s) => s.isOpen).length }, { value: "closed", label: "Closed", count: stores.filter((s) => !s.isOpen).length }]} />
      <div className="grid gap-3">
        {stores.filter((s) => (tab === "all" || s.isOpen === (tab === "open")) && `${s.name} ${s.city.name}`.toLowerCase().includes(query.trim().toLowerCase())).map((s) => (
          <Card key={s.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-2">
                <ImageWithFallback src={s.coverImage} alt={s.name} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                <div className="flex-1">
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.city.name} · {s.category.name}
                  </p>
                  <p className="text-xs text-muted">⭐ {demoRating(s.id).toFixed(1)} · {s.isOpen ? "Open" : "Closed"}</p>
                </div>
                <Badge className={MODERATION_COLORS[s.moderationStatus]}>{s.moderationStatus}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 border-t border-border pt-2 text-center">{[[s.stats.activeOrders, "Active orders"], [s.stats.completedOrders, "Completed"], [`${s.stats.returnPercent}%`, "Returns"]].map(([count, label]) => <div key={label}><p className="font-bold">{count}</p><p className="text-[10px] text-muted">{label}</p></div>)}</div>
              <Button className="mt-3 w-full" size="sm" variant={s.isOpen ? "destructive" : "primary"} disabled={busy} onClick={() => toggleOpen(s)}>{s.isOpen ? "Close store" : "Reopen store"}</Button>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => (window.location.href = `/admin/stores/${s.id}`)}>
                  View store profile →
                </Button>
                {s.moderationStatus !== "APPROVED" && (
                  <Button size="sm" onClick={() => { setModeration(s.id, "APPROVED").catch(() => {}); }}>
                    Approve
                  </Button>
                )}
                {s.moderationStatus !== "BLOCKED" && (
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="destructive">
                        Block
                      </Button>
                    }
                    title={`Block ${s.name}?`}
                    description="Blocking prevents new orders and hides this store from customers. Existing orders remain fulfillable."
                    confirmLabel="Block"
                    destructive
                    onConfirm={() => setModeration(s.id, "BLOCKED")}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!stores.some((s) => (tab === "all" || s.isOpen === (tab === "open")) && `${s.name} ${s.city.name}`.toLowerCase().includes(query.trim().toLowerCase())) && <p className="text-sm text-muted">No stores match.</p>}
      </div>
    </AdminShell>
  );
}
