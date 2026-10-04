"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { ProductPreviewSheet } from "@/components/ProductPreviewSheet";
import { useShoppingCart } from "@/lib/hooks/useShoppingCart";
import { Button } from "@/components/ui/button";
import { demoRating, demoDeliveryWindow } from "@/lib/demoRatings";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { useCity } from "@/lib/hooks/useCity";
import { formatINR, format12Hour } from "@/lib/utils";
import { MapPin } from "lucide-react";

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cart = useShoppingCart();
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState<any>(null);
  const { cityId } = useCity([]);

  useEffect(() => {
    setError(null);
    setLoading(true);
    fetch(`/api/stores/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Store not found.");
        return r.json();
      })
      .then((d) => setStore(d.store))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id, reloadKey]);

  if (loading) {
    return (
      <CustomerShell>
        <div className="space-y-3 p-4">
          <LoadingSkeleton className="h-40 w-full" />
          <LoadingSkeleton className="h-6 w-1/2" />
        </div>
      </CustomerShell>
    );
  }

  if (error || !store) {
    return (
      <CustomerShell>
        <div className="p-4">
          <ErrorState message={error ?? "Store not found."} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      </CustomerShell>
    );
  }

  const cityMismatch = !!cityId && store.cityId !== cityId;
  const disabled = cityMismatch || !store.isOpen || store.moderationStatus === "BLOCKED";
  const products = store.products.filter((p: any) => p.isAvailable && !p.isArchived && (filter !== "bestseller" || p.isFeatured));
  const storeItems = (cart.items ?? []).filter((item) => item.product.storeId === store.id);
  const count = storeItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = storeItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const quantityFor = (id: string) => storeItems.find((item) => item.productId === id)?.quantity ?? 0;
  return <CustomerShell>
    <div className="relative h-[170px] bg-blush">
      <ImageWithFallback src={store.coverImage} alt={store.name} className="h-full w-full object-cover" />
      <button aria-label="Back" onClick={() => router.push("/")} className="absolute left-3.5 top-3.5 h-9 w-9 rounded-full bg-white/90">←</button>
      <div className="absolute -bottom-[22px] left-4 h-14 w-14 overflow-hidden rounded-2xl border-[3px] border-white shadow-md"><ImageWithFallback src={store.coverImage} alt="" className="h-full w-full object-cover" /></div>
    </div>
    <div className={`px-4 pt-[30px] ${count ? "pb-24" : "pb-4"}`}>
      <div className="flex gap-2"><Badge className="bg-blush text-ink">{store.category.name}</Badge><Badge className={store.isOpen ? "bg-green-100 text-green-800" : "bg-gray-100 text-muted"}>{store.isOpen ? "Open now" : "Closed"}</Badge></div>
      <h1 className="mb-0.5 mt-2 font-serif text-[19px] font-semibold">{store.name}</h1>
      <p className="text-[13px] text-muted">🕐 {demoDeliveryWindow(store.id)} · 📍 {store.city.name}</p>
      <p className="mt-1 text-xs text-muted">🏪 Open {format12Hour(store.openTime)} – {format12Hour(store.closeTime)}</p>
      <Badge className="mt-1 bg-amber-100 text-amber-800">⭐ {demoRating(store.id).toFixed(1)}</Badge>
      <div className="mt-3 rounded-2xl bg-gradient-to-r from-ink to-rose px-3.5 py-3 text-white"><p className="text-[13px] font-bold">🎁 Gifting made simple</p><p className="mt-0.5 text-[11px] opacity-90">Delivery estimate shown above is illustrative.</p></div>
      {disabled && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{cityMismatch ? `This store delivers in ${store.city.name}. Change your selected city to order.` : "This store is currently unavailable for ordering."}</p>}
      <div className="mt-3.5 flex gap-1.5 rounded-full bg-blush p-1" role="group" aria-label="Filter products">{[["all", "All"], ["bestseller", "★ Bestseller"], ["available", "Available"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs ${filter === value ? "border-ink bg-ink text-white" : "border-transparent bg-transparent text-muted"}`}>{label}</button>)}</div>
      <h2 className="mb-2 mt-3.5 font-serif text-[15px] font-semibold">Recommended</h2>
      {cart.error && <p role="alert" className="mb-3 text-sm text-red-700">{cart.error}</p>}
      <div className="grid grid-cols-2 gap-2.5">{products.map((p: any) => <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-white">
        <button onClick={() => setPreview(p)} className="w-full text-left" aria-label={`Preview ${p.name}`}><div className="relative h-[110px] bg-blush"><ImageWithFallback src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />{p.isFeatured && <span className="absolute left-1.5 top-1.5 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-rose">★ Bestseller</span>}</div><div className="p-2.5"><p className="text-xs font-semibold">{p.name}</p><p className="mt-0.5 text-[10px] text-muted">⭐ {demoRating(p.id).toFixed(1)}</p></div></button>
        <div className="flex items-center justify-between gap-1 px-2.5 pb-2.5"><span className="text-[13px] font-bold text-rose">{formatINR(p.price)}</span>{quantityFor(p.id) > 0 ? <div className="flex items-center gap-1.5 rounded-full bg-rose p-[3px] text-xs text-white"><button aria-label={`Remove one ${p.name}`} disabled={cart.busy} onClick={() => cart.updateQuantity(p.id, quantityFor(p.id) - 1)} className="h-[22px] w-[22px] rounded-full bg-white text-rose">−</button><span>{quantityFor(p.id)}</span><button aria-label={`Add one ${p.name}`} disabled={disabled || cart.busy || quantityFor(p.id) >= 10} onClick={() => cart.add(p.id)} className="h-[22px] w-[22px] rounded-full bg-white text-rose disabled:opacity-40">+</button></div> : <Button className="h-7 px-3.5 text-[11px]" disabled={disabled || cart.busy} onClick={() => cart.add(p.id)}>ADD</Button>}</div>
      </article>)}</div>
      {!products.length && <EmptyState title="No products match this filter" description="Try another filter." />}
    </div>
    {count > 0 && <div className="fixed bottom-16 left-0 right-0 z-20 mx-auto flex max-w-phone items-center justify-between gap-2 bg-ink px-4 py-2.5 text-white"><div><p className="text-xs opacity-80">{count} {count === 1 ? "item" : "items"} · {formatINR(subtotal)}</p><p className="text-[13px] font-semibold">from {store.name}</p></div><Button disabled={disabled || cart.busy} onClick={() => router.push("/checkout")} className="px-3 text-xs">Proceed to checkout →</Button></div>}
    {preview && <ProductPreviewSheet key={preview.id} product={preview} storeName={store.name} disabled={disabled} busy={cart.busy} inCart={quantityFor(preview.id)} onClose={() => setPreview(null)} onAdd={(quantity) => cart.add(preview.id, quantity, () => setPreview(null))} />}
    {cart.confirmation}
  </CustomerShell>;
}
