"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { StoreShell } from "@/components/StoreShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { formatINR } from "@/lib/utils";

const TABS = [
  { key: "new", label: "New", statuses: ["ORDER_PLACED"] },
  { key: "in_progress", label: "Preparing", statuses: ["STORE_ACCEPTED", "PREPARING_GIFT"] },
  { key: "ready", label: "Ready", statuses: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] },
  { key: "completed", label: "Completed", statuses: ["DELIVERED"] },
  { key: "rejected", label: "Rejected", statuses: ["REJECTED"] },
];

const IN_PROGRESS = ["STORE_ACCEPTED", "PREPARING_GIFT", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];

function elapsedLabel(since: string, now: number) {
  const sec = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export default function StoreOrdersPage() {
  const [store, setStore] = useState<any>(null);
  const [toggling, setToggling] = useState(false);
  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("new");
  const [now, setNow] = useState(() => Date.now());

  function load() {
    fetch("/api/store/orders")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load orders.");
        return r.json();
      })
      .then((d) => { setOrders(d.orders); setError(null); })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    fetch("/api/store/profile").then((r) => r.json()).then((d) => setStore(d.store)).catch(() => {});
    const id = setInterval(load, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);

  async function toggleOpen() {
    if (!store || toggling) return;
    setToggling(true);
    try {
      const res = await fetch("/api/store/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isOpen: !store.isOpen }) });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not update store.");
      setStore({ ...store, isOpen: !store.isOpen });
    } catch (e: any) { setError(e.message); } finally { setToggling(false); }
  }
  async function transition(order: any, targetStatus: string, reason?: string) {
    const res = await fetch(`/api/store/orders/${order.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetStatus, expectedVersion: order.version, reason }) });
    if (!res.ok) throw new Error((await res.json()).message ?? "Could not update order.");
    load();
  }

  const filtered = useMemo(() => {
    if (!orders) return [];
    const statuses = TABS.find((t) => t.key === tab)?.statuses ?? [];
    return orders.filter((o) => statuses.includes(o.status));
  }, [orders, tab]);

  return (
    <StoreShell>
      <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><Link href="/store/dashboard" aria-label="Back to dashboard">←</Link><h1 className="font-serif text-xl font-semibold text-ink">Orders</h1></div>{store && <Button size="sm" variant="secondary" disabled={toggling} onClick={toggleOpen}>{store.isOpen ? "● Online" : "● Offline"}</Button>}</div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full overflow-x-auto rounded-full">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="shrink-0 whitespace-nowrap rounded-full px-3 text-xs">
              {t.label} ({orders?.filter((order) => t.statuses.includes(order.status)).length ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {error && <ErrorState message={error} onRetry={load} />}
        {!orders && !error && <LoadingSkeleton className="h-20 w-full" />}
        {orders && filtered.length === 0 && <EmptyState title="No orders here" description="Nothing in this tab right now." />}
        {orders && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((o) => {
              const totalQty = o.items.reduce((s: number, it: any) => s + it.quantity, 0);
              const acceptedAt = IN_PROGRESS.includes(o.status)
                ? o.statusHistory?.find((h: any) => h.status === "STORE_ACCEPTED")?.changedAt
                : null;
              return (
              <Card key={o.id} className="overflow-hidden"><Link className="block" href={`/store/orders/${o.id}`}>
                <div className="transition hover:shadow-md">
                  <CardContent className="flex items-center justify-between">
                    <div>
                      {totalQty >= 3 && (
                        <span className="mb-1 inline-block rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">🛍️ Large order · {totalQty} items</span>
                      )}
                      <p className="text-xs text-muted">{o.orderCode}</p>
                      <p className="font-medium text-ink">{o.items[0]?.productName}</p>
                      <p className="text-sm text-muted">
                        {o.recipientName} · {new Date(o.placedAt).toLocaleString("en-IN")}
                      </p>
                      {o.deliverySlot && (
                        <p className="text-xs text-muted">
                          Scheduled: {new Date(o.deliveryDate).toLocaleDateString("en-IN")} · {o.deliverySlot}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {acceptedAt && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800" title="Time since accepted">
                          ⏱ {elapsedLabel(acceptedAt, now)}
                        </span>
                      )}
                      <StatusBadge status={o.status} />
                      <p className="font-semibold text-ink">{formatINR(o.total)}</p>
                    </div>
                  </CardContent>
                </div>
              </Link>
              <div className="mx-4 border-t border-border py-2"><p className="text-[11px] font-semibold uppercase text-muted">🧺 Order details · {totalQty} items</p>{o.items.map((item: any) => <p key={item.id} className="mt-1 text-xs">{item.quantity} × {item.productName}</p>)}<p className="mt-2 rounded-xl bg-blush p-2 text-[11px]">🚚 {o.deliveryOption === "EXPRESS" ? "Same-day express" : o.deliveryOption === "SCHEDULED" ? "Scheduled delivery" : "Standard delivery"}{o.giftMessage && " · 💌 Gift message included"}</p></div>
              {o.status === "ORDER_PLACED" && <div className="flex justify-end gap-2 px-4 pb-3"><ConfirmDialog trigger={<Button size="sm" variant="destructive">✕ Reject</Button>} title="Reject this order" requireReason destructive onConfirm={(reason) => transition(o, "REJECTED", reason)} /><ConfirmDialog trigger={<Button size="sm">✓ Accept</Button>} title="Accept this order?" onConfirm={() => transition(o, "STORE_ACCEPTED")} /></div>}
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </StoreShell>
  );
}
