"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderTimeline } from "@/components/OrderTimeline";
import { RecipientSummary } from "@/components/RecipientSummary";
import { GiftMessagePreview } from "@/components/GiftMessagePreview";
import { PriceSummary } from "@/components/PriceSummary";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { buildTimeline, ORDER_STATUS_LABELS } from "@/lib/services/orderStateMachine";
import { formatKolkata } from "@/lib/services/scheduling";
import { ORDER_STATUS_VALUES } from "@/lib/validation";
import { ShieldAlert } from "lucide-react";

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/orders/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Order not found.");
        return r.json();
      })
      .then((d) => {
        setOrder(d.order);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [params.id]);

  function openOverride() {
    setTargetStatus("");
    setReason("");
    setFormError(null);
    setOverrideOpen(true);
  }

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!targetStatus) {
      setFormError("Choose a target status.");
      return;
    }
    if (reason.trim().length < 3) {
      setFormError("Please provide a reason (min 3 characters).");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus, reason, expectedVersion: order.version }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message ?? "Could not override status.");
        return;
      }
      setOrder(data.order);
      setOverrideOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <AdminShell>
        <ErrorState message={error} onRetry={load} />
      </AdminShell>
    );
  }
  if (!order) {
    return (
      <AdminShell>
        <LoadingSkeleton className="h-60 w-full" />
      </AdminShell>
    );
  }

  const timeline = buildTimeline(order.status, order.statusHistory);

  return (
    <AdminShell>
      <button onClick={() => router.push("/admin/orders")} className="mb-3 text-sm text-muted">
        ← Back to orders
      </button>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">{order.orderCode}</p>
          <StatusBadge status={order.status} />
        </div>
        <Button variant="destructive" onClick={openOverride}>
          <ShieldAlert className="h-4 w-4" /> Override status
        </Button>
      </div>

      {order.status !== "REJECTED" && (
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
          <OrderTimeline steps={timeline} />
        </div>
      )}

      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          {order.items.map((line: { id: string; productName: string; quantity: number }) => (
              <p key={line.id} className="font-medium text-ink">{line.productName} × {line.quantity}</p>
            ))}
          <p className="text-sm text-muted">
            {order.store.name} · {order.city.name}
          </p>
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
        <PriceSummary subtotal={order.subtotal} deliveryFee={order.deliveryFee} total={order.total} />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink">Immutable status history</h2>
      <div className="space-y-2">
        {order.statusHistory.map((h: any) => (
          <div key={h.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
            <p className="font-medium text-ink">
              {ORDER_STATUS_LABELS[h.status as keyof typeof ORDER_STATUS_LABELS] ?? h.status}
              {h.isAdminOverride && <span className="ml-2 text-xs text-amber-600">(admin override)</span>}
            </p>
            <p className="text-xs text-muted">
              {formatKolkata(new Date(h.changedAt))} · actor: {h.changedByRole}
              {h.previousStatus && <> · from {ORDER_STATUS_LABELS[h.previousStatus as keyof typeof ORDER_STATUS_LABELS]}</>}
            </p>
            {h.note && <p className="text-xs text-muted">Reason: {h.note}</p>}
          </div>
        ))}
      </div>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        {overrideOpen && (
          <DialogContent>
            <DialogTitle className="text-lg font-semibold text-ink">Override order status</DialogTitle>
            <form onSubmit={submitOverride} className="mt-4 space-y-3">
              <p className="text-sm text-muted">Current status: {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}</p>
              <div>
                <Label htmlFor="target">Target status</Label>
                <Select id="target" value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)}>
                  <option value="">Choose a status</option>
                  {ORDER_STATUS_VALUES.filter((s) => s !== order.status).map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS_LABELS[s as keyof typeof ORDER_STATUS_LABELS]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="reason">Reason (required)</Label>
                <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving..." : "Confirm override"}
              </Button>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </AdminShell>
  );
}
