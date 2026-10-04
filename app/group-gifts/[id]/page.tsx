"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerShell } from "@/components/CustomerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";

export default function GroupGiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [gg, setGg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    fetch(`/api/group-gifts/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load this group gift.");
        return r.json();
      })
      .then((d) => setGg(d.groupGift))
      .catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function markPaid(contributorId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/group-gifts/${id}/contributors/${contributorId}`, { method: "PATCH" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? "Could not update the contribution.");
      setGg(result.groupGift);
    } catch (e: any) {
      setActionError(e.message ?? "Please try again.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Delete the group gift "${gg.title}"? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/group-gifts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not delete this group gift.");
      router.push("/group-gifts");
    } catch (e: any) { setActionError(e.message ?? "Please try again."); }
  }

  async function proceedToOrder() {
    const res = await fetch(`/api/group-gifts/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowPartial: true }),
    });
    if (!res.ok) throw new Error((await res.json()).message ?? "Could not prepare your cart.");
    router.push("/cart?checkout=1");
  }

  if (error) return <CustomerShell><div className="p-4"><ErrorState message={error} onRetry={load} /></div></CustomerShell>;
  if (!gg) return <CustomerShell><div className="space-y-3 p-4"><LoadingSkeleton className="h-24 w-full" /><LoadingSkeleton className="h-24 w-full" /></div></CustomerShell>;

  const primaryStoreItems = gg.items.filter((item: any) => item.product.storeId === gg.items[0]?.product.storeId);
  const otherStoreCount = gg.items.length - primaryStoreItems.length;
  const paidCount = gg.contributors.filter((c: any) => c.paid).length;

  return (
    <CustomerShell>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-lg font-semibold text-ink">Group Gift Details</h1>
          <button onClick={remove} className="text-xl">🗑️</button>
        </div>

        {gg.items.map((it: any) => (
          <Card key={it.id}>
            <CardContent className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{it.product.name}</p>
                <p className="text-sm text-muted">{it.product.store.name}</p>
              </div>
              <p className="font-semibold text-rose">₹{Number(it.product.price).toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent>
            <p className="text-sm"><span className="text-muted">Recipient</span> &middot; {gg.recipientName}</p>
            <p className="mt-1 text-sm"><span className="text-muted">Occasion</span> &middot; {gg.occasionType}</p>
            <p className="mt-1 text-sm"><span className="text-muted">Delivery Date</span> &middot; {new Date(gg.deliveryDate).toLocaleDateString("en-IN")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-sm font-semibold">
              ₹{gg.collectedAmount.toLocaleString("en-IN")} of ₹{Number(gg.goalAmount).toLocaleString("en-IN")} collected{" "}
              <span className="text-rose">{gg.percentFunded}%</span>
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full bg-rose" style={{ width: `${gg.percentFunded}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">{gg.contributors.length} people &middot; {paidCount} contributed &middot; {gg.contributors.length - paidCount} pending</p>
          </CardContent>
        </Card>

        <div>
          <p className="mb-2 font-serif font-semibold">Contributors ({gg.contributors.length})</p>
          <div className="space-y-2">
            {gg.contributors.map((c: any) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-sm">₹{Number(c.amount).toLocaleString("en-IN")}</span>
                  {c.paid ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">✓ Paid</span>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => markPaid(c.id)}>Mark Paid</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
        {gg.isFullyFunded ? (
          <ConfirmDialog
            trigger={<Button className="w-full">Proceed to Order →</Button>}
            title="Prepare your gift order"
            description={`${otherStoreCount ? `${otherStoreCount} gifts are from another store and must be ordered separately. ` : ""}Continue with ${primaryStoreItems.length} gift(s) from ${gg.items[0]?.product.store.name}? This replaces your current cart.`}
            confirmLabel="Continue"
            onConfirm={proceedToOrder}
          />
        ) : (
          <Button className="w-full" variant="outline" disabled>
            Waiting for full contribution (₹{(Number(gg.goalAmount) - gg.collectedAmount).toLocaleString("en-IN")} more needed)
          </Button>
        )}
      </div>
    </CustomerShell>
  );
}
