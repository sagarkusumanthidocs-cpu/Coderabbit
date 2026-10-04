"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CustomerShell } from "@/components/CustomerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

type GroupGift = {
  id: string;
  title: string;
  goalAmount: string;
  collectedAmount: number;
  percentFunded: number;
  isFullyFunded: boolean;
  contributors: { paid: boolean; name: string }[];
  deliveryDate: string;
  occasionType: string;
};

export default function GroupGiftsPage() {
  const [groupGifts, setGroupGifts] = useState<GroupGift[] | null>(null);
  const [tab, setTab] = useState("active");
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    fetch("/api/group-gifts")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load group gifts.");
        return r.json();
      })
      .then((d) => setGroupGifts(d.groupGifts))
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  return (
    <CustomerShell>
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-serif text-xl font-semibold text-ink">Group Gifting</h1>
          <Link href="/group-gifts/new"><Button size="sm">+ Create</Button></Link>
        </div>

        <p className="mb-4 text-[13px] text-muted">Make moments special, together. Split a gift with friends and family.</p>
        <div className="mb-4 flex gap-2" role="group" aria-label="Group gift status">{[["active", "Active Groups"], ["upcoming", "Upcoming"]].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-full border px-4 py-2 text-xs font-semibold ${tab === value ? "border-rose bg-blush text-rose" : "border-border"}`}>{label}</button>)}</div>
        {!groupGifts && !error && (
          <div className="space-y-3">
            <LoadingSkeleton className="h-24 w-full" />
            <LoadingSkeleton className="h-24 w-full" />
          </div>
        )}
        {error && <ErrorState message={error} onRetry={load} />}
        {groupGifts && groupGifts.length === 0 && (
          <EmptyState title="No group gifts yet" description="Invite friends to split a gift together." actionLabel="Create group gift" href="/group-gifts/new" />
        )}
        {groupGifts && groupGifts.length > 0 && (
          <div className="space-y-3">
            {groupGifts.filter((g) => (g.collectedAmount > 0) === (tab === "active")).map((g) => (
              <Link className="block" key={g.id} href={`/group-gifts/${g.id}`}>
                <Card>
                  <CardContent>
                    <p className="font-semibold text-ink">🎁 {g.title}</p>
                    <p className="mt-1 text-sm">
                      ₹{g.collectedAmount.toLocaleString("en-IN")} of ₹{Number(g.goalAmount).toLocaleString("en-IN")} collected{" "}
                      <span className="font-semibold text-rose">{g.percentFunded}%</span>
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div className="h-full bg-rose" style={{ width: `${g.percentFunded}%` }} />
                    </div>
                    <div className="mt-3 flex items-center gap-1">{g.contributors.slice(0, 5).map((c, i) => <span key={i} title={c.name} className="flex h-7 w-7 items-center justify-center rounded-full bg-blush text-[10px] font-bold">{c.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>)}<span className="ml-2 text-[11px] text-muted">{g.contributors.filter((c) => c.paid).length}/{g.contributors.length} paid</span></div>
                    {g.deliveryDate && <p className="mt-2 text-[11px] text-muted">Delivery: {new Date(g.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>}
                    {!g.isFullyFunded && <p className="mt-2 text-xs text-muted">₹{Math.max(0, Number(g.goalAmount) - g.collectedAmount).toLocaleString("en-IN")} pending</p>}
                    {g.isFullyFunded && <p className="mt-2 text-xs font-semibold text-green-700">✓ Ready to order</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
            {!groupGifts.some((g) => (g.collectedAmount > 0) === (tab === "active")) && <EmptyState title={tab === "active" ? "No active groups" : "No upcoming groups"} description="Create a group gift to plan your next celebration." />}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
