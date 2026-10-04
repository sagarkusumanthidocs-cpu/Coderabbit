"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
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
  const [orderCode, setOrderCode] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (orderCode) params.set("orderCode", orderCode);
    fetch(`/api/admin/orders?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load orders.");
        return r.json();
      })
      .then((d) => { setOrders(d.orders); setError(null); })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [status]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  return (
    <AdminShell>
      <h1 className="mb-4 font-serif text-xl font-semibold text-ink">Orders</h1>
      <div className="mb-4 flex flex-col gap-2">
        <form onSubmit={submitSearch} className="flex-1">
          <Input placeholder="Search by order code" value={orderCode} onChange={(e) => setOrderCode(e.target.value)} />
        </form>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!orders && !error && <LoadingSkeleton className="h-40 w-full" />}
      {orders && (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} className="cursor-pointer transition hover:shadow-md" onClick={() => router.push(`/admin/orders/${o.id}`)}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{o.orderCode}</p>
                  <p className="text-xs text-muted">
                    {o.store.name} · {o.city.name} · {new Date(o.placedAt).toLocaleDateString("en-IN")}
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
