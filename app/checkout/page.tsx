"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { CartItems } from "@/components/CartItems";
import { useShoppingCart } from "@/lib/hooks/useShoppingCart";
import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PriceSummary } from "@/components/PriceSummary";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation";
import { DELIVERY_FEES, OCCASIONS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { SLOT_WINDOWS } from "@/lib/services/scheduling";

function CheckoutInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const productId = sp.get("productId") ?? "";
  const cart = useShoppingCart();
  const cartMode = !productId;
  const quantity = Number(sp.get("quantity") ?? 1);
  const cityId = sp.get("cityId") ?? "";

  const [reloadKey, setReloadKey] = useState(0);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      productId,
      quantity,
      cityId,
      idempotencyKey,
      occasion: "Birthday",
      deliveryOption: "STANDARD",
      paymentMethod: "UPI_MOCK",
      senderName: "",
    },
    mode: "onBlur",
  });

  const giftMessage = watch("giftMessage") ?? "";
  const deliveryOption = watch("deliveryOption");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.name) setValue("senderName", d.user.name);
      });
  }, [setValue]);

  useEffect(() => {
    setLoadError(null);
    if (cartMode) {
      setLoading(!cart.items && !cart.error);
      setLoadError(cart.error);
      const first = cart.items?.[0];
      setProduct(first?.product ?? null);
      if (first) { setValue("productId", first.productId); setValue("quantity", first.quantity); setValue("cityId", first.product.store.cityId); }
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      setLoadError("Choose a gift and a quantity between 1 and 10 before checking out.");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/products/${productId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Product not found.");
        return r.json();
      })
      .then((d) => {
        setProduct(d.product);
        setValue("cityId", cityId || d.product.store.cityId);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [productId, quantity, cityId, reloadKey, setValue, cartMode, cart.items, cart.error]);

  const totals = useMemo(() => {
    if (!product) return { subtotal: 0, deliveryFee: 0, total: 0 };
    const subtotal = cartMode ? (cart.items ?? []).reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0) : Number(product.price) * quantity;
    const deliveryFee = DELIVERY_FEES[deliveryOption as keyof typeof DELIVERY_FEES] ?? 49;
    return { subtotal, deliveryFee, total: subtotal + deliveryFee };
  }, [product, quantity, deliveryOption, cartMode, cart.items]);

  async function onSubmit(data: CheckoutInput) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(cartMode ? "/api/cart/checkout" : "/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          deliveryDate: data.deliveryOption === "SCHEDULED" ? data.deliveryDate : undefined,
          deliverySlot: data.deliveryOption === "SCHEDULED" ? data.deliverySlot : undefined,
          displayedTotal: totals.total,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSubmitError(result.message ?? "Could not place your order. Please review and try again.");
        if (result.details?.total) { if (cartMode) await cart.refresh(); else setReloadKey((key) => key + 1); }
        setSubmitting(false);
        return;
      }
      window.dispatchEvent(new Event("giftly-cart-updated"));
      router.push(`/orders/${result.order.id}/confirmed`);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  function onInvalid(formErrors: any) {
    const firstField = Object.keys(formErrors)[0];
    if (firstField === "recipientName") { document.getElementById("firstName")?.focus(); return; }
    if (firstField) {
      try {
        setFocus(firstField as any);
      } catch {}
    }
  }

  if (loading) {
    return (
      <CustomerShell>
        <div className="space-y-3 p-4">
          <LoadingSkeleton className="h-16 w-full" />
          <LoadingSkeleton className="h-72 w-full" />
        </div>
      </CustomerShell>
    );
  }

  if (loadError || !product) {
    return (
      <CustomerShell>
        <div className="p-4">
          <ErrorState message={loadError ?? "Your cart is empty. Add a gift to get started."} onRetry={() => { setReloadKey((key) => key + 1); if (cartMode) cart.refresh().catch(() => {}); }} />
          <Button className="mt-4 w-full" onClick={() => router.push("/")}>Browse gifts</Button>
        </div>
      </CustomerShell>
    );
  }

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <CustomerShell>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4 p-4 pb-8">
        <Link href="/cart" className="text-sm text-rose">← Back</Link>
        <div><h1 className="font-serif text-xl font-semibold">Checkout</h1><p className="mt-1 text-xs text-muted">Send a little love, delivered with care.</p></div>
        <section className="rounded-2xl border border-border bg-white p-3.5">
          <h2 className="mb-2 text-sm font-bold">🎁 Your gift</h2>
          <p className="text-xs text-muted">From {product.store.name} · {product.store.city.name}</p>
          {cartMode ? <CartItems items={cart.items ?? []} busy={cart.busy || submitting} updateQuantity={cart.updateQuantity} /> : <p className="mt-2 text-sm">{product.name} × {quantity}</p>}
          <Link href={`/stores/${product.store.id}`} className="mt-3 block text-xs font-semibold text-rose">+ Add more gifts</Link>
        </section>

        <input type="hidden" {...register("productId")} />
        <input type="hidden" {...register("quantity", { valueAsNumber: true })} />
        <input type="hidden" {...register("cityId")} />
        <input type="hidden" {...register("idempotencyKey")} />

        <section className="rounded-2xl border border-border bg-white p-3.5">
          <h2 className="mb-3 text-sm font-bold text-ink">📍 Recipient Details</h2>
          <div className="space-y-3">
            <div>
              <input type="hidden" {...register("recipientName")} />
              <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="firstName">First name</Label><Input id="firstName" value={firstName} onChange={(e) => { setFirstName(e.target.value); setValue("recipientName", `${e.target.value} ${lastName}`.trim(), { shouldValidate: true }); }} /></div><div><Label htmlFor="lastName">Last name</Label><Input id="lastName" value={lastName} onChange={(e) => { setLastName(e.target.value); setValue("recipientName", `${firstName} ${e.target.value}`.trim(), { shouldValidate: true }); }} /></div></div>
              {errors.recipientName && <p className="mt-1 text-xs text-red-600">{errors.recipientName.message}</p>}
            </div>
            <div>
              <Label htmlFor="recipientPhone">Phone</Label>
              <Input id="recipientPhone" {...register("recipientPhone")} inputMode="numeric" placeholder="98XXXXXXXX" />
              {errors.recipientPhone && <p className="mt-1 text-xs text-red-600">{errors.recipientPhone.message}</p>}
            </div>
            <div>
              <Label htmlFor="deliveryAddress">Full delivery address</Label>
              <Textarea id="deliveryAddress" {...register("deliveryAddress")} />
              {errors.deliveryAddress && <p className="mt-1 text-xs text-red-600">{errors.deliveryAddress.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="landmark">Landmark (optional)</Label>
                <Input id="landmark" {...register("landmark")} />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode (optional)</Label>
                <Input id="pincode" {...register("pincode")} inputMode="numeric" />
                {errors.pincode && <p className="mt-1 text-xs text-red-600">{errors.pincode.message}</p>}
              </div>
            </div>
            <div>
              <Label>Delivery city</Label>
              <Input value={product.store.city.name} readOnly disabled />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-3.5">
          <h2 className="mb-3 text-sm font-bold text-ink">💌 Gift Message</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="giftMessage">Gift message (optional)</Label>
              <Textarea id="giftMessage" maxLength={250} {...register("giftMessage")} />
              <p className="mt-1 text-right text-xs text-muted">{giftMessage.length}/250</p>
              {errors.giftMessage && <p className="text-xs text-red-600">{errors.giftMessage.message}</p>}
            </div>
            <div>
              <Label htmlFor="occasion">Occasion</Label>
              <Select id="occasion" {...register("occasion")}>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="senderName">Sender name</Label>
              <Input id="senderName" {...register("senderName")} />
              {errors.senderName && <p className="mt-1 text-xs text-red-600">{errors.senderName.message}</p>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-3.5">
          <h2 className="mb-3 text-sm font-bold text-ink">🚚 Delivery Options</h2>
          <div className="space-y-2">
            {(
              [
                { value: "STANDARD", label: "Standard Delivery", detail: "Delivers in 2–3 days", fee: 49 },
                { value: "EXPRESS", label: "Same-day Express", detail: "Delivers today, within 4–6 hours", fee: 99 },
                { value: "SCHEDULED", label: "Scheduled Delivery", detail: "Choose a date and time", fee: 79 },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-ink/10 p-3 has-[:checked]:border-rose has-[:checked]:bg-blush/30"
              >
                <span className="flex items-center gap-2">
                  <input type="radio" value={opt.value} {...register("deliveryOption")} />
                  <span className="text-sm">{opt.label}<span className="block text-[11px] text-muted">{opt.detail}</span></span>
                </span>
                <span className="text-sm text-muted">{formatINR(opt.fee)}</span>
              </label>
            ))}
            {deliveryOption === "SCHEDULED" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label htmlFor="deliveryDate">Date</Label>
                  <Input id="deliveryDate" type="date" min={minDate} {...register("deliveryDate")} />
                  {errors.deliveryDate && <p className="mt-1 text-xs text-red-600">{errors.deliveryDate.message}</p>}
                </div>
                <div>
                  <Label htmlFor="deliverySlot">Slot</Label>
                  <Select id="deliverySlot" {...register("deliverySlot", { setValueAs: (value) => value || undefined })}>
                    <option value="">Choose a slot</option>
                    {Object.entries(SLOT_WINDOWS).map(([key, w]) => (
                      <option key={key} value={key}>
                        {w.label}
                      </option>
                    ))}
                  </Select>
                  {errors.deliverySlot && <p className="mt-1 text-xs text-red-600">{errors.deliverySlot.message}</p>}
                </div>
              </div>
            )}
            <p className="text-xs italic text-muted">All delivery estimates are mock estimates for this demo.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-3.5">
          <h2 className="mb-3 text-sm font-bold text-ink">💳 Payment Method</h2>
          <div className="grid grid-cols-2 gap-2.5">{[{ value: "UPI_MOCK", label: "UPI", icon: "📱", detail: "Pay via any UPI app" }, { value: "CARD_MOCK", label: "Credit Card", icon: "💳", detail: "Visa, Mastercard, Amex" }].map((option) => <label key={option.value} className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-border px-2 py-3.5 text-center has-[:checked]:border-rose has-[:checked]:bg-blush/30`}><input type="radio" value={option.value} {...register("paymentMethod")} /><span className="text-xl">{option.icon}</span><span className="text-xs font-bold">{option.label}</span><span className="text-[10px] text-muted">{option.detail}</span></label>)}</div>
          <p className="mt-2 text-xs font-medium text-amber-700">No real payment will be collected or processed.</p>
        </section>

        <section className="rounded-2xl border border-border bg-white p-3.5"><h2 className="mb-3 text-sm font-bold">Order Summary</h2><PriceSummary subtotal={totals.subtotal} deliveryFee={totals.deliveryFee} total={totals.total} /></section>
        {submitError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
      <div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting || cart.busy}>
          {submitting ? "Placing order..." : `Place mock order · ${formatINR(totals.total)}`}
        </Button>
      </div>
      </form>
    </CustomerShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}
