"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CustomerShell } from "@/components/CustomerShell";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<any[] | null>(null);
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

  return (
    <CustomerShell>
      <div className="p-4">
        <Link href="/" className="mb-3 block text-sm text-rose">← Back to home</Link>
        <h1 className="mb-4 font-serif text-xl font-semibold text-ink">My Orders</h1>
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
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                id={o.id}
                orderCode={o.orderCode}
                productName={o.items[0]?.productName ?? "Gift"}
                storeName={o.store.name}
                placedAt={o.placedAt}
                status={o.status}
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
