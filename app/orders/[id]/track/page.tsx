"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderTimeline } from "@/components/OrderTimeline";
import { RecipientSummary } from "@/components/RecipientSummary";
import { GiftMessagePreview } from "@/components/GiftMessagePreview";
import { PriceSummary } from "@/components/PriceSummary";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { buildTimeline, ORDER_SEQUENCE, ORDER_STATUS_EXPLANATIONS, ORDER_STATUS_LABELS } from "@/lib/services/orderStateMachine";
import { TrackingMap } from "@/components/TrackingMap";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { demoEtaMinutes, demoRider } from "@/lib/demoRatings";
import { Copy, Check, MessageCircle, Phone, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";

const POLL_MS = 15000;

function DemoNotice({ message, onClose }: { message: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      {message && (
        <DialogContent>
          <DialogTitle className="text-lg font-semibold text-ink">Demo only</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">{message}</DialogDescription>
          <div className="mt-5 flex justify-end">
            <Button onClick={onClose}>OK</Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

function DeliveryConfirmFlow({ orderId, onConfirmed }: { orderId: string; onConfirmed: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function confirm() {
    if (!photo) return;
    setSubmitting(true);
    setErr(null);
    const res = await fetch(`/api/orders/${orderId}/confirm-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proofImage: photo }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setErr(data.message ?? "Could not confirm delivery.");
      return;
    }
    onConfirmed();
  }

  if (!photo) {
    return (
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-1 text-center font-serif text-lg font-semibold">Your order has been delivered!</p>
        <p className="mb-4 text-center text-sm text-muted">Please take or upload a photo to confirm delivery.</p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-blush/40 p-6 text-center">
          <span className="text-2xl">📷</span>
          <span className="text-sm font-semibold">Take a photo or upload from your gallery</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        </label>
        <Button className="mt-4 w-full" disabled>Confirm Delivery</Button>
        <p className="mt-2 text-center text-xs text-muted">Add a photo above to continue.</p>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
      <p className="mb-3 font-serif text-lg font-semibold">Confirm Delivery</p>
      <div className="relative overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="Delivery photo" className="max-h-72 w-full object-cover" />
        <button onClick={() => setPhoto(null)} className="absolute right-2 top-2 h-7 w-7 rounded-full bg-black/60 text-white">✕</button>
      </div>
      <label className="mt-3 flex items-start gap-2 rounded-xl bg-blush/50 p-3 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
        I confirm that the order has been delivered successfully at the given address.
      </label>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <Button className="mt-3 w-full" disabled={!checked || submitting} onClick={confirm}>
        {submitting ? "Confirming…" : "Confirm Delivery"}
      </Button>
    </div>
  );
}

export default function TrackOrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setRefreshing(true);
    fetch(`/api/orders/${params.id}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Order not found.");
        return r.json();
      })
      .then((d) => {
        setOrder(d.order);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, [params.id]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), POLL_MS);
    function onFocus() {
      load(true);
    }
    window.addEventListener("focus", onFocus);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  if (error && !order) {
    return (
      <CustomerShell>
        <div className="p-4">
          <ErrorState message={error} onRetry={() => load()} />
        </div>
      </CustomerShell>
    );
  }

  if (!order) {
    return (
      <CustomerShell>
        <div className="space-y-3 p-4">
          <LoadingSkeleton className="h-40 w-full" />
        </div>
      </CustomerShell>
    );
  }

  const item = order.items[0];
  const timeline = buildTimeline(order.status, order.statusHistory);
  const stepIndex = ORDER_SEQUENCE.indexOf(order.status);
  const rider = demoRider(order.id);

  return (
    <CustomerShell>
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted">{order.orderCode}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(order.orderCode).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {order.status !== "REJECTED" ? (
          <>
            <div className="mb-3 overflow-hidden rounded-2xl bg-white shadow-sm">
              <TrackingMap status={order.status} />
              <p className="py-2 text-center text-[10px] text-muted">🗺️ Illustrative map view - not a live location</p>
            </div>
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-full border-2 border-rose bg-blush">
                {stepIndex >= 1 && stepIndex < ORDER_SEQUENCE.length - 1 ? (
                  <>
                    <span className="text-base font-extrabold leading-none text-rose">{demoEtaMinutes(order.id, stepIndex)}</span>
                    <span className="text-[8px] font-bold text-rose">MIN</span>
                  </>
                ) : (
                  <span className="text-lg">🎁</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}</p>
                <p className="text-xs text-muted">{ORDER_STATUS_EXPLANATIONS[order.status as keyof typeof ORDER_STATUS_EXPLANATIONS]}</p>
                {stepIndex >= 1 && stepIndex < ORDER_SEQUENCE.length - 1 && <p className="text-[11px] text-muted">Estimated time is a demo value</p>}
              </div>
            </div>
            {order.status === "OUT_FOR_DELIVERY" && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-rose font-serif text-sm font-bold text-white">
                  {rider.name.split(" ").map((w) => w[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{rider.name}</p>
                  <p className="text-[11px] text-muted">
                    {rider.vehicle} · {rider.plate} · demo delivery partner
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Chat with delivery partner"
                  onClick={() => setDemoMessage("This is a demo - no real chat is connected to your delivery partner here.")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-ink"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Call delivery partner"
                  onClick={() => setDemoMessage("This is a demo - no real call is placed to your delivery partner here.")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1D9E75] text-white"
                >
                  <Phone className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="mb-4 rounded-xl bg-blush/50 p-3 text-sm text-ink">{ORDER_STATUS_EXPLANATIONS[order.status as keyof typeof ORDER_STATUS_EXPLANATIONS]}</p>
        )}

        {order.status === "REJECTED" ? (
          <div className="mb-5 rounded-2xl bg-red-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              <p className="font-medium">Order rejected</p>
            </div>
            <p className="text-sm text-red-700">{order.rejectionReason}</p>
            <div className="mt-4 flex gap-3">
              <Link href="/products" className="flex-1">
                <Button variant="outline" className="w-full">
                  Browse alternatives
                </Button>
              </Link>
              <Link href={`/products/${item?.productId}`} className="flex-1">
                <Button className="w-full">Reorder</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
            <OrderTimeline steps={timeline} />
          </div>
        )}

        {order.status === "DELIVERED" && !order.deliveryConfirmedByCustomer && (
          <DeliveryConfirmFlow orderId={order.id} onConfirmed={() => load()} />
        )}
        {order.status === "DELIVERED" && order.deliveryConfirmedByCustomer && (
          <div className="mb-5 rounded-2xl bg-green-50 p-4 text-sm text-green-800">
            ✓ Delivery confirmed by you.
            {order.proofImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.proofImage} alt="Delivery proof" className="mt-3 w-full rounded-xl" />
            )}
          </div>
        )}

        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            {order.items.map((line: { id: string; productName: string; quantity: number }) => (
              <p key={line.id} className="text-sm font-medium text-ink">{line.productName} × {line.quantity}</p>
            ))}
            <p className="text-xs text-muted">
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
          <p className="text-sm text-muted">
            Delivery: {order.deliveryOption === "STANDARD" ? "Standard" : order.deliveryOption === "EXPRESS" ? "Same-day express" : "Scheduled"}
          </p>
          <PriceSummary subtotal={order.subtotal} deliveryFee={order.deliveryFee} total={order.total} />
        </div>
      </div>
      <DemoNotice message={demoMessage} onClose={() => setDemoMessage(null)} />
    </CustomerShell>
  );
}
