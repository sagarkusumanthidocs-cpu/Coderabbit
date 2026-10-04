"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CustomerShell } from "@/components/CustomerShell";
import { FilterTabs } from "@/components/FilterTabs";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [confirmation, setConfirmation] = useState("all");
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setOrders(null);
    fetch("/api/orders")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load your orders.");
        return r.json();
      })
      .then((d) => setOrders(d.orders))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const pending = (orders ?? []).filter((order) => order.status === "DELIVERED" && !order.deliveryConfirmedByCustomer);
  const confirmed = (orders ?? []).filter((order) => order.status === "DELIVERED" && order.deliveryConfirmedByCustomer);
  const visible = confirmation === "pending" ? pending : confirmation === "confirmed" ? confirmed : orders ?? [];

  return (
    <CustomerShell>
      <div className="p-4">
        <Link href="/" className="mb-3 block text-sm text-rose">← Back to home</Link>
        <h1 className="mb-4 font-serif text-xl font-semibold text-ink">My Orders</h1>
        {orders && <FilterTabs label="Customer delivery confirmation" value={confirmation} onChange={setConfirmation} options={[{ value: "all", label: "All orders", count: orders.length }, { value: "pending", label: "Awaiting photo", count: pending.length }, { value: "confirmed", label: "Confirmed", count: confirmed.length }]} />}
        {!orders && !error && (
          <div className="space-y-3">
            <LoadingSkeleton className="h-20 w-full" />
            <LoadingSkeleton className="h-20 w-full" />
          </div>
        )}
        {error && <ErrorState message={error} onRetry={load} />}
        {orders && orders.length === 0 && (
          <EmptyState title="No orders yet" description="Start by sending a gift to someone special." actionLabel="Browse gifts" href="/products" />
        )}
        {orders && orders.length > 0 && (
          <div className="space-y-3">
            {!visible.length && <p className="text-sm text-muted">No orders in this view.</p>}
            {visible.map((o) => (
              <OrderCard
                key={o.id}
                id={o.id}
                orderCode={o.orderCode}
                productName={o.items[0]?.productName ?? "Gift"}
                storeName={o.store.name}
                placedAt={o.placedAt}
                status={o.status}
                deliveryConfirmedByCustomer={o.deliveryConfirmedByCustomer}
                total={o.total}
                trackHref={`/orders/${o.id}/track`}
              />
            ))}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
