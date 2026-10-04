"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CustomerShell } from "@/components/CustomerShell";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { DELIVERY_FEES, OCCASIONS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { Minus, Plus, Trash2 } from "lucide-react";

type CartItem = {
  productId: string;
  quantity: number;
  product: { id: string; name: string; price: string; imageUrl: string; store: { id: string; name: string; cityId: string } };
};

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())));

  const [form, setForm] = useState({
    recipientName: "",
    recipientPhone: "",
    deliveryAddress: "",
    landmark: "",
    pincode: "",
    senderName: "",
    occasion: "Birthday",
    giftMessage: "",
    deliveryOption: "STANDARD" as "STANDARD" | "EXPRESS" | "SCHEDULED",
    deliveryDate: "",
    deliverySlot: "",
    paymentMethod: "COD" as "COD" | "UPI_MOCK",
  });

  function loadCart() {
    fetch("/api/cart")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Could not load your cart.");
        return r.json();
      })
      .then((d) => {
        setItems(d.cart.items);
        window.dispatchEvent(new Event("giftly-cart-updated"));
        setError(null);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadCart();
    setShowCheckout(new URLSearchParams(window.location.search).get("checkout") === "1");
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.name) setForm((f) => ({ ...f, senderName: d.user.name }));
      });
  }, []);

  const subtotal = useMemo(
    () => (items ?? []).reduce((sum, it) => sum + Number(it.product.price) * it.quantity, 0),
    [items]
  );
  const deliveryFee = DELIVERY_FEES[form.deliveryOption];
  const total = subtotal + deliveryFee;
  const cityId = items?.[0]?.product.store.cityId;

  async function updateQty(productId: string, quantity: number) {
    const res = await fetch(`/api/cart/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    if (res.ok) loadCart();
  }

  async function removeItem(productId: string) {
    await fetch(`/api/cart/${productId}`, { method: "DELETE" });
    loadCart();
  }

  async function placeOrder() {
    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deliveryDate: form.deliveryOption === "SCHEDULED" ? form.deliveryDate || undefined : undefined,
          deliverySlot: form.deliveryOption === "SCHEDULED" ? form.deliverySlot || undefined : undefined,
          cityId,
          idempotencyKey,
          displayedTotal: total,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSubmitError(result.message ?? "Could not place your order. Please review and try again.");
        if (result.details) setFieldErrors(result.details);
        if (result.details?.total) loadCart();
        return;
      }
      router.push(`/orders/${result.order.id}/confirmed`);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <CustomerShell>
        <div className="p-4">
          <ErrorState message={error} onRetry={loadCart} />
        </div>
      </CustomerShell>
    );
  }

  if (!items) {
    return (
      <CustomerShell>
        <div className="space-y-3 p-4">
          <LoadingSkeleton className="h-24 w-full" />
          <LoadingSkeleton className="h-24 w-full" />
        </div>
      </CustomerShell>
    );
  }

  if (items.length === 0) {
    return (
      <CustomerShell>
        <div className="p-4">
          <h1 className="mb-4 font-serif text-xl font-semibold text-ink">Your Cart</h1>
          <EmptyState
            title="Your cart is empty"
            description="Browse gifts and add something thoughtful."
            actionLabel="Browse gifts"
            href="/products"
          />
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <div className="space-y-3 p-4 pb-32">
        <h1 className="font-serif text-xl font-semibold text-ink">Your Cart</h1>
        <p className="text-sm text-muted">Fulfilled by {items[0].product.store.name}</p>

        {items.map((it) => (
          <div key={it.productId} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-blush">
              <ImageWithFallback src={it.product.imageUrl} alt={it.product.name} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{it.product.name}</p>
              <p className="text-xs text-muted">{formatINR(it.product.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Decrease quantity"
                onClick={() => updateQty(it.productId, it.quantity - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-blush text-rose"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-medium">{it.quantity}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => updateQty(it.productId, it.quantity + 1)}
                disabled={it.quantity >= 10}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-blush text-rose disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button aria-label="Remove item" onClick={() => removeItem(it.productId)} className="text-muted">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <div className="rounded-xl bg-blush/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatINR(subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted">Delivery fee</span>
            <span>{formatINR(deliveryFee)}</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold text-ink">
            <span>Total</span>
            <span>{formatINR(total)}</span>
          </div>
        </div>

        {!showCheckout ? (
          <Button className="w-full" size="lg" onClick={() => setShowCheckout(true)}>
            Proceed to Checkout
          </Button>
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-white p-4">
            <h2 className="font-serif text-lg font-semibold text-ink">Delivery &amp; Payment</h2>

            <Label>Recipient name</Label>
            <Input value={form.recipientName} onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))} />
            {fieldErrors.recipientName && <p className="text-xs text-red-600">{fieldErrors.recipientName[0]}</p>}

            <Label>Recipient phone</Label>
            <Input value={form.recipientPhone} onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))} />
            {fieldErrors.recipientPhone && <p className="text-xs text-red-600">{fieldErrors.recipientPhone[0]}</p>}

            <Label>Delivery address</Label>
            <Textarea value={form.deliveryAddress} onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))} />
            {fieldErrors.deliveryAddress && <p className="text-xs text-red-600">{fieldErrors.deliveryAddress[0]}</p>}

            <Label>Landmark (optional)</Label>
            <Input value={form.landmark} onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))} />

            <Label>Pincode (optional)</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
            />
            {fieldErrors.pincode && <p className="text-xs text-red-600">{fieldErrors.pincode[0]}</p>}

            <Label>Your name (sender)</Label>
            <Input value={form.senderName} onChange={(e) => setForm((f) => ({ ...f, senderName: e.target.value }))} />
            {fieldErrors.senderName && <p className="text-xs text-red-600">{fieldErrors.senderName[0]}</p>}

            <Label>Occasion</Label>
            <Select value={form.occasion} onChange={(e) => setForm((f) => ({ ...f, occasion: e.target.value }))}>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>

            <Label>Gift message (optional)</Label>
            <Textarea
              maxLength={250}
              value={form.giftMessage}
              onChange={(e) => setForm((f) => ({ ...f, giftMessage: e.target.value }))}
            />
            {fieldErrors.giftMessage && <p className="text-xs text-red-600">{fieldErrors.giftMessage[0]}</p>}

            <Label>Delivery option</Label>
            <Select
              value={form.deliveryOption}
              onChange={(e) => setForm((f) => ({ ...f, deliveryOption: e.target.value as typeof f.deliveryOption }))}
            >
              <option value="STANDARD">Standard - {formatINR(DELIVERY_FEES.STANDARD)}</option>
              <option value="EXPRESS">Express - {formatINR(DELIVERY_FEES.EXPRESS)}</option>
              <option value="SCHEDULED">Scheduled - {formatINR(DELIVERY_FEES.SCHEDULED)}</option>
            </Select>

            {form.deliveryOption === "SCHEDULED" && (
              <>
                <Label>Delivery date</Label>
                <Input
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                />
                {fieldErrors.deliveryDate && <p className="text-xs text-red-600">{fieldErrors.deliveryDate[0]}</p>}
                <Label>Delivery slot</Label>
                <Select value={form.deliverySlot} onChange={(e) => setForm((f) => ({ ...f, deliverySlot: e.target.value }))}>
                  <option value="">Choose a slot</option>
                  <option value="MORNING">Morning (9am - 12pm)</option>
                  <option value="AFTERNOON">Afternoon (12pm - 4pm)</option>
                  <option value="EVENING">Evening (4pm - 8pm)</option>
                </Select>
                {fieldErrors.deliverySlot && <p className="text-xs text-red-600">{fieldErrors.deliverySlot[0]}</p>}
              </>
            )}

            <Label>Payment method</Label>
            <Select
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as typeof f.paymentMethod }))}
            >
              <option value="COD">Cash on Delivery</option>
              <option value="UPI_MOCK">UPI (mock)</option>
            </Select>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <Button className="w-full" size="lg" disabled={submitting} onClick={placeOrder}>
              {submitting ? "Placing order..." : `Place Order · ${formatINR(total)}`}
            </Button>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
