"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { FilterTabs } from "@/components/FilterTabs";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { ORDER_STATUS_LABELS } from "@/lib/services/orderStateMachine";
import { formatINR } from "@/lib/utils";

function AdminOrdersInner() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [cityId, setCityId] = useState("");
  const [orderCode, setOrderCode] = useState("");

  function load() {
    fetch("/api/admin/orders")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load orders.");
        return r.json();
      })
      .then((d) => { setOrders(d.orders); setError(null); })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  const tabs = [{ value: "", label: "All", statuses: [] }, { value: "placed", label: "Placed", statuses: ["ORDER_PLACED"] }, { value: "preparing", label: "Preparing", statuses: ["STORE_ACCEPTED", "PREPARING_GIFT"] }, { value: "ready", label: "Ready/Out", statuses: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] }, { value: "done", label: "Delivered", statuses: ["DELIVERED"] }, { value: "rejected", label: "Rejected", statuses: ["REJECTED"] }];
  const scoped = (orders ?? []).filter((o) => (!cityId || o.cityId === cityId) && `${o.orderCode} ${o.store.name} ${o.recipientName}`.toLowerCase().includes(orderCode.trim().toLowerCase()));
  const filtered = scoped.filter((o) => !status || tabs.find((t) => t.value === status)?.statuses.includes(o.status));
  const cities = Array.from(new Map((orders ?? []).map((o) => [o.city.id, o.city])).values());
  return (
    <AdminShell>
      <h1 className="mb-4 font-serif text-xl font-semibold text-ink">Orders monitor</h1>
      <div className="mb-4 flex flex-col gap-2">
        <form onSubmit={submitSearch} className="flex-1">
          <Input placeholder="Search by order code, store, or recipient…" aria-label="Search orders" value={orderCode} onChange={(e) => setOrderCode(e.target.value)} />
        </form>
        <Select aria-label="Order city" value={cityId} onChange={(e) => setCityId(e.target.value)}><option value="">All cities</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</Select>
      </div>
      <FilterTabs label="Order status" value={status} onChange={setStatus} options={tabs.map((tab) => ({ ...tab, count: scoped.filter((o) => !tab.value || tab.statuses.includes(o.status)).length }))} />
      {error && <ErrorState message={error} onRetry={load} />}
      {!orders && !error && <LoadingSkeleton className="h-40 w-full" />}
      {orders && (
        <div className="space-y-2">
          {!filtered.length && <p className="text-sm text-muted">No orders match.</p>}
          {filtered.map((o) => (
            <Card key={o.id} className="cursor-pointer transition hover:shadow-md" onClick={() => router.push(`/admin/orders/${o.id}`)}>
              <CardContent className="flex items-center justify-between gap-2">
                {o.items[0]?.product?.imageUrl && <ImageWithFallback src={o.items[0].product.imageUrl} alt={o.items[0].productName} className="h-11 w-11 shrink-0 rounded-xl object-cover" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{o.orderCode}</p>
                  <p className="text-xs text-muted">
                    {o.recipientName} · {o.store.name} · {o.city.name} · {new Date(o.placedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-ink">{formatINR(o.total)}</p>
                  <StatusBadge status={o.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense>
      <AdminOrdersInner />
    </Suspense>
  );
}
