"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { Sparkline, dailyBuckets } from "@/components/Charts";
import { formatINR } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/services/orderStateMachine";

type ReportOrder = { placedAt: string; status: string; total: string | number };

export default function StoreReportsPage() {
  const [data, setData] = useState<{ store: any; orders: ReportOrder[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/store/reports")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load reports.");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

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
        <LoadingSkeleton className="h-40 w-full" />
      </StoreShell>
    );
  }

  const delivered = data.orders.filter((o) => o.status === "DELIVERED");
  const totalSales = delivered.reduce((s, o) => s + Number(o.total), 0);
  const avgOrderValue = delivered.length ? Math.round(totalSales / delivered.length) : 0;
  const salesBuckets = dailyBuckets(delivered, (o) => o.placedAt, 7, (o) => Number(o.total));
  const orderBuckets = dailyBuckets(data.orders, (o) => o.placedAt, 7);
  const statusRows = Object.entries(ORDER_STATUS_LABELS)
    .map(([key, label]) => ({ label, count: data.orders.filter((o) => o.status === key).length }))
    .filter((r) => r.count > 0);

  return (
    <StoreShell>
      <Link href="/store/dashboard" className="mb-3 block text-sm text-rose">← Back</Link>
      <p className="text-[10px] uppercase tracking-wide text-muted">Showing data for</p>
      <h1 className="mb-4 font-serif text-xl font-semibold text-ink">{data.store.name}</h1>

      <Card>
        <CardContent>
          <p className="mb-2 text-sm font-semibold text-ink">Sales</p>
          <div className="flex items-center justify-between border-t border-border py-2">
            <div>
              <p className="text-xs text-muted">Total sales (delivered)</p>
              <p className="text-lg font-semibold text-ink">{formatINR(totalSales)}</p>
            </div>
            <div className="w-24">
              <Sparkline values={salesBuckets} color="#1D9E75" />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border py-2">
            <div>
              <p className="text-xs text-muted">Orders delivered</p>
              <p className="text-lg font-semibold text-ink">{delivered.length}</p>
            </div>
            <div className="w-24">
              <Sparkline values={orderBuckets} />
            </div>
          </div>
          <div className="border-t border-border py-2">
            <p className="text-xs text-muted">Avg order value</p>
            <p className="text-lg font-semibold text-ink">{formatINR(avgOrderValue)}</p>
          </div>
          <p className="mt-1 text-[10px] text-muted">Last 7 days trend, based on your actual order history. No projected or estimated figures.</p>
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardContent>
          <p className="mb-2 text-sm font-semibold text-ink">Orders by status</p>
          {statusRows.length === 0 && <p className="text-sm text-muted">No orders yet.</p>}
          {statusRows.map((r) => (
            <div key={r.label} className="flex justify-between py-1 text-sm">
              <span className="text-muted">{r.label}</span>
              <span className="font-semibold text-ink">{r.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </StoreShell>
  );
}
