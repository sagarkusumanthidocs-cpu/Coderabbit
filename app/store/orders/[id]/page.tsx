"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StoreShell } from "@/components/StoreShell";
import { Button } from "@/components/ui/button";
import { DeliveryConfirmationBadge } from "@/components/DeliveryConfirmationBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { RecipientSummary } from "@/components/RecipientSummary";
import { GiftMessagePreview } from "@/components/GiftMessagePreview";
import { PriceSummary } from "@/components/PriceSummary";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { getValidStoreTransitions, ORDER_STATUS_LABELS } from "@/lib/services/orderStateMachine";
import { formatKolkata } from "@/lib/services/scheduling";
import { CheckCircle2, XCircle } from "lucide-react";

export default function StoreOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/store/orders/${params.id}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Order not found.");
        return r.json();
      })
      .then((d) => {
        setOrder(d.order);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [params.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => { clearInterval(interval); window.removeEventListener("focus", load); };
  }, [load]);

  async function transition(targetStatus: string, reason?: string) {
    setActionError(null);
    const res = await fetch(`/api/store/orders/${order.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus, expectedVersion: order.version, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.message ?? "Could not update the order.");
      load();
      throw new Error(data.message);
    }
    setOrder(data.order);
  }

  if (error && !order) {
    return (
      <StoreShell>
        <ErrorState message={error} onRetry={load} />
      </StoreShell>
    );
  }

  if (!order) {
    return (
      <StoreShell>
        <LoadingSkeleton className="h-60 w-full" />
      </StoreShell>
    );
  }

  const nextSteps = getValidStoreTransitions(order.status).filter((s) => s !== "REJECTED");
  const canAccept = order.status === "ORDER_PLACED";

  return (
    <StoreShell>
      <button onClick={() => router.push("/store/orders")} className="mb-3 text-sm text-muted">
        ← Back to orders
      </button>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">{order.orderCode}</p>
          <StatusBadge status={order.status} />
        </div>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {actionError && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          {order.items.map((line: { id: string; productName: string; quantity: number }) => (
              <p key={line.id} className="font-medium text-ink">{line.productName} × {line.quantity}</p>
            ))}
          <p className="text-sm text-muted">{order.city.name}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-muted">Recipient</p>
          <RecipientSummary
            name={order.recipientName}
            phone={order.recipientPhone}
            address={order.deliveryAddress}
            landmark={order.landmark}
            pincode={order.pincode}
            city={order.city.name}
          />
        </div>
        <GiftMessagePreview message={order.giftMessage} occasion={order.occasion} senderName={order.senderName} />
        <div>
          <p className="text-sm text-ink">
            Delivery: {order.deliveryOption}
            {order.deliverySlot && ` · ${new Date(order.deliveryDate).toLocaleDateString("en-IN")} · ${order.deliverySlot}`}
          </p>
        </div>
        <PriceSummary subtotal={order.subtotal} deliveryFee={order.deliveryFee} total={order.total} />
      </div>

      {order.status === "DELIVERED" && (
        <section className="mt-4 rounded-2xl border border-border bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Customer delivery confirmation</h2>
          <DeliveryConfirmationBadge confirmed={order.deliveryConfirmedByCustomer} />
          {order.deliveryConfirmedByCustomer ? <>
            <p className="mt-2 text-sm text-muted">The customer confirmed receipt of this order with a photo.</p>
            {order.statusHistory.filter((entry: any) => entry.status === "DELIVERED" && entry.changedByRole === "CUSTOMER").slice(-1).map((entry: any) => <p key={entry.id} className="mt-1 text-xs text-muted">Confirmed on {formatKolkata(new Date(entry.changedAt))}</p>)}
            {order.proofImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.proofImage} alt="Customer delivery confirmation photo" className="mt-3 max-h-80 w-full rounded-xl object-contain" />
            )}
          </> : <p className="mt-2 text-sm text-muted">Delivery is recorded. The customer still needs to upload a photo and confirm receipt.</p>}
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canAccept && (
          <>
            <ConfirmDialog
              trigger={
                <Button>
                  <CheckCircle2 className="h-4 w-4" /> Accept order
                </Button>
              }
              title="Accept this order?"
              confirmLabel="Accept"
              onConfirm={() => transition("STORE_ACCEPTED")}
            />
            <ConfirmDialog
              trigger={
                <Button variant="destructive">
                  <XCircle className="h-4 w-4" /> Reject order
                </Button>
              }
              title="Reject this order"
              description="Please explain why this order is being rejected."
              requireReason
              confirmLabel="Reject"
              destructive
              onConfirm={(reason) => transition("REJECTED", reason)}
            />
          </>
        )}
        {!canAccept &&
          nextSteps.map((s) => (
            <ConfirmDialog
              key={s}
              trigger={<Button>Mark as {ORDER_STATUS_LABELS[s]}</Button>}
              title={`Mark order as ${ORDER_STATUS_LABELS[s]}?`}
              description={s === "DELIVERED" ? "The customer can then upload a photo and confirm receipt. Their confirmation will appear on this order." : undefined}
              confirmLabel="Confirm"
              onConfirm={() => transition(s)}
            />
          ))}
        {order.status === "OUT_FOR_DELIVERY" && (
          <p className="text-sm text-muted">🚚 Once the order arrives, mark it as Delivered so the customer can upload a photo and confirm receipt.</p>
        )}
        {order.status === "DELIVERED" && <p className="text-sm text-green-700">This order has been delivered.</p>}
        {order.status === "REJECTED" && <p className="text-sm text-red-700">Reason: {order.rejectionReason}</p>}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink">Status history</h2>
      <div className="space-y-2">
        {order.statusHistory.map((h: any) => (
          <div key={h.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
            <p className="font-medium text-ink">
              {ORDER_STATUS_LABELS[h.status as keyof typeof ORDER_STATUS_LABELS] ?? h.status}
              {h.isAdminOverride && <span className="ml-2 text-xs text-amber-600">(admin override)</span>}
            </p>
            <p className="text-xs text-muted">{formatKolkata(new Date(h.changedAt))} · {h.changedByRole}</p>
            {h.note && <p className="text-xs text-muted">Note: {h.note}</p>}
          </div>
        ))}
      </div>
    </StoreShell>
  );
}
