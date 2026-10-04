"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { formatINR } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/services/orderStateMachine";
import { Select } from "@/components/ui/select";
import { DonutChart, STATUS_COLORS, Sparkline, dailyBuckets } from "@/components/Charts";

const DELAY_MS = 3 * 3600 * 1000;

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cityId, setCityId] = useState("");

  function load() {
    fetch(`/api/admin/dashboard${cityId ? `?cityId=${cityId}` : ""}`)
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [cityId]);

  if (error && !data) {
    return (
      <AdminShell>
        <ErrorState message={error} onRetry={load} />
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell>
        <LoadingSkeleton className="h-40 w-full" />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="mb-3 font-serif text-xl font-semibold text-ink">Platform overview</h1>
      <Select aria-label="Filter by city" value={cityId} onChange={(e) => setCityId(e.target.value)} className="mb-4 w-auto">
        <option value="">All cities ({data.cities.reduce((s: number, c: any) => s + c.storeCount, 0)} stores)</option>
        {data.cities.map((c: any) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.storeCount} stores)
          </option>
        ))}
      </Select>

      <Overview data={data} />

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink">Platform totals</h2>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Total stores</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{data.totalStores}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Total products</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{data.totalProducts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Total orders</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{data.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Mock delivered value</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{formatINR(data.mockDeliveredValue)}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink">Orders by status</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
            {label}: <span className="font-semibold">{data.statusCounts[key] ?? 0}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink">Recent order activity</h2>
      <div className="space-y-2">
        {data.recentOrders.map((o: any) => (
          <Link href={`/admin/orders/${o.id}`} key={o.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
            <div>
              <p className="text-sm font-medium text-ink">{o.orderCode}</p>
              <p className="text-xs text-muted">
                {o.store.name} · {o.city.name}
              </p>
            </div>
            <StatusBadge status={o.status} />
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}

function Overview({ data }: { data: any }) {
  const orders: { placedAt: string; status: string; total: string | number }[] = data.orders;
  const today = new Date().toDateString();
  const todays = orders.filter((o) => new Date(o.placedAt).toDateString() === today);
  const valueToday = todays.reduce((s, o) => s + Number(o.total), 0);
  const rejected = orders.filter((o) => o.status === "REJECTED").length;
  const returnRate = orders.length ? ((rejected / orders.length) * 100).toFixed(1) : "0.0";
  const delayed = orders.filter((o) => o.status === "ORDER_PLACED" && Date.now() - new Date(o.placedAt).getTime() > DELAY_MS).length;
  const avgOrderValue = orders.length ? Math.round(orders.reduce((s, o) => s + Number(o.total), 0) / orders.length) : 0;
  const segments = Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => ({
    key,
    label,
    value: orders.filter((o) => o.status === key).length,
    color: STATUS_COLORS[key],
  }));

  return (
    <>
      <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">Today&apos;s overview</p>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Orders today</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{todays.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Active stores</p>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {data.scope.openStores}/{data.scope.storeCount} <span className="text-xs font-normal text-muted">open</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Order value today</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatINR(valueToday)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Return rate</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{returnRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3">
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">
              Delayed orders <span className="text-[10px]">(waiting &gt;3h)</span>
            </p>
            <p className={delayed > 0 ? "mt-1 text-xl font-semibold text-red-600" : "mt-1 text-xl font-semibold text-ink"}>{delayed}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Avg order value</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatINR(avgOrderValue)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-3 grid gap-3">
        <Card>
          <CardContent>
            <p className="mb-1 text-sm font-semibold text-ink">Orders trend (last 7 days)</p>
            <Sparkline values={dailyBuckets(orders, (o) => o.placedAt, 7)} />
            <p className="mt-1 text-[10px] text-muted">Real order volume from your platform data</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-semibold text-ink">Order status (all time)</p>
            <div className="flex items-center gap-4">
              <DonutChart segments={segments}>
                <span className="text-lg font-bold text-ink">{orders.length}</span>
                <span className="text-[9px] text-muted">orders</span>
              </DonutChart>
              <div className="flex flex-1 flex-col gap-1">
                {segments
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <div key={s.key} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1">{s.label}</span>
                      <span className="font-semibold">{((s.value / orders.length) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
