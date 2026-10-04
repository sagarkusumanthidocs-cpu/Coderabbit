"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import { PriceSummary } from "@/components/PriceSummary";
import { RecipientSummary } from "@/components/RecipientSummary";
import { GiftMessagePreview } from "@/components/GiftMessagePreview";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { PartyPopper, MessageCircle } from "lucide-react";
import Link from "next/link";
import { SLOT_WINDOWS } from "@/lib/services/scheduling";

export default function OrderConfirmedPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    fetch(`/api/orders/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Order not found.");
        return r.json();
      })
      .then((d) => setOrder(d.order))
      .catch((e) => setError(e.message));
  }, [params.id, reloadKey]);

  if (error) {
    return (
      <CustomerShell>
        <div className="p-4">
          <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
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
  const deliveryLabel =
    order.deliveryOption === "STANDARD" ? "Standard" : order.deliveryOption === "EXPRESS" ? "Same-day express" : "Scheduled";

  return (
    <CustomerShell>
      <div className="p-4">
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-rose/10 text-rose">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h1 className="font-serif text-xl font-semibold text-ink">Your gift order is placed</h1>
          <p className="mt-1 text-muted">Waiting for {order.store.name} to accept</p>
          <p className="mt-2 text-sm font-medium text-rose">{order.orderCode}</p>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-blush/50 p-3 text-xs text-muted">
          <MessageCircle className="h-4 w-4 text-rose" />
          Mock notification - not sent
        </div>

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

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted">Delivery</p>
            <p className="text-sm text-ink">
              {deliveryLabel}
              {order.deliverySlot && order.deliveryDate && (
                <span className="text-muted">
                  {" "}
                  · {new Date(order.deliveryDate).toLocaleDateString("en-IN")} ·{" "}
                  {SLOT_WINDOWS[order.deliverySlot as keyof typeof SLOT_WINDOWS]?.label}
                </span>
              )}
            </p>
            <p className="text-sm text-muted">
              Payment: {order.paymentMethod === "COD" ? "Pay on delivery" : "UPI (mock)"} · No real payment
            </p>
          </div>

          <PriceSummary subtotal={order.subtotal} deliveryFee={order.deliveryFee} total={order.total} />
        </div>

        <div className="mt-5 flex gap-3">
          <Link href={`/orders/${order.id}/track`} className="flex-1">
            <Button className="w-full">Track order</Button>
          </Link>
          <Link href="/" className="flex-1">
            <Button variant="outline" className="w-full">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </CustomerShell>
  );
}
