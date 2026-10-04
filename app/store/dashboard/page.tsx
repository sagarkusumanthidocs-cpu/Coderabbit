"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { Card, CardContent } from "@/components/ui/card";
import { OrderCard } from "@/components/OrderCard";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { formatINR, cn } from "@/lib/utils";
import { BarChart, HOUR_LABELS, hourlyBuckets } from "@/components/Charts";

const POLL_MS = 15000;

export default function StoreDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  function load() {
    fetch("/api/store/dashboard")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load dashboard.");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }

  async function toggleOpen() {
    if (!data || toggling) return;
    setToggling(true);
    const res = await fetch("/api/store/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: !data.store.isOpen }),
    });
    setToggling(false);
    if (res.ok) load();
  }

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  if (error && !data) {
    return (
      <StoreShell>
        <ErrorState message={error} onRetry={load} />
      </StoreShell>
    );
  }

  if (!data) {
    return (
      <StoreShell>
        <div className="space-y-3">
          <LoadingSkeleton className="h-24 w-full" />
        </div>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 font-serif text-xl font-semibold text-ink">{data.store.name}</h1>
          <p className="text-sm text-muted">{data.store.city.name} · {data.store.category.name}</p>
        </div>
        <button
          type="button"
          onClick={toggleOpen}
          disabled={toggling}
          className={cn(
            "flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
            data.store.isOpen ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", data.store.isOpen ? "bg-green-600" : "bg-red-600")} />
          {data.store.isOpen ? "Open · Accepting orders" : "Closed"}
        </button>
      </div>

      <div className="mb-4 flex gap-2 text-xs">{[["/store/dashboard", "My feed"], ["/store/orders", "Orders"], ["/store/products", "Products"], ["/store/reports", "Reports"]].map(([href, label], i) => <Link key={href} href={href} className={`rounded-full border px-3 py-2 ${i === 0 ? "bg-rose text-white" : "border-border bg-white"}`}>{label}</Link>)}</div>
      <h2 className="mb-2 font-serif text-[15px] font-semibold">Quick links</h2>
      <div className="mb-5 grid grid-cols-4 gap-2">
        <Link href="/store/products" className="relative rounded-2xl border border-border bg-white p-3 text-center">
          <span className="text-xl">🛍️</span>
          <p className="mt-1 text-xs font-semibold">Products</p>
        </Link>
        <Link href="/store/orders" className="relative rounded-2xl border border-border bg-white p-3 text-center">
          {data.newOrders > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold text-white">{data.newOrders}</span>
          )}
          <span className="text-xl">📦</span>
          <p className="mt-1 text-xs font-semibold">Orders</p>
        </Link>
        <Link href="/store/profile" className="relative rounded-2xl border border-border bg-white p-3 text-center">
          <span className="text-xl">🏪</span>
          <p className="mt-1 text-xs font-semibold">Store profile</p>
        </Link>
        <Link href="/store/reports" className="relative rounded-2xl border border-border bg-white p-3 text-center">
          <span className="text-xl">📊</span>
          <p className="mt-1 text-xs font-semibold">Reports</p>
        </Link>
      </div>

      <Card className="mb-3">
        <CardContent>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">Total sales (delivered)</p>
              <p className="text-xl font-semibold text-ink">{formatINR(data.mockDeliveredValue)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Total orders</p>
              <p className="text-xl font-semibold text-ink">{data.totalOrders}</p>
            </div>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-800">● Live</span>
          </div>
          <BarChart values={hourlyBuckets(data.orderTimes)} labels={HOUR_LABELS} highlight={Math.floor(new Date().getHours() / 3)} />
          <p className="mt-1 text-[10px] text-muted">Orders placed by hour of day, from your real order history (current hour highlighted)</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent>
            <p className="text-xs text-muted">New orders</p>
            <p className="mt-1 text-2xl font-semibold text-rose">{data.newOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Active orders</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{data.activeOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Delivered</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{data.deliveredOrders}</p>
          </CardContent>
        </Card>
      </div>


      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink">Recent orders</h2>
      <div className="space-y-3">
        {data.recentOrders.length === 0 && <p className="text-sm text-muted">No orders yet.</p>}
        {data.recentOrders.map((o: any) => (
          <OrderCard
            key={o.id}
            id={o.id}
            orderCode={o.orderCode}
            productName={o.items[0]?.productName ?? "Gift"}
            storeName={data.store.name}
            placedAt={o.placedAt}
            status={o.status}
            deliveryConfirmedByCustomer={o.deliveryConfirmedByCustomer}
            total={o.total}
            trackHref={`/store/orders/${o.id}`}
          />
        ))}
      </div>
    </StoreShell>
  );
}
