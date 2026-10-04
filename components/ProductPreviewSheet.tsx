"use client";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { demoRating, demoDeliveryWindow } from "@/lib/demoRatings";

export function ProductPreviewSheet({ product, storeName, disabled, busy, inCart, onClose, onAdd }: {
  product: { id: string; name: string; imageUrl: string; price: string; description: string; isFeatured: boolean };
  storeName: string; disabled: boolean; busy: boolean; inCart: number; onClose: () => void; onAdd: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent hideHandle className="p-0" aria-describedby={undefined}>
    <div className="relative h-[200px] bg-blush">
      <ImageWithFallback src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
      <button aria-label="Close product preview" onClick={onClose} className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white">✕</button>
      {product.isFeatured && <span className="absolute top-3 left-3 rounded-full bg-white px-2 py-1 text-xs font-semibold text-rose">★ Bestseller</span>}
    </div>
    <div className="p-4">
      <SheetTitle className="font-serif text-lg font-semibold">{product.name}</SheetTitle>
      <p className="mt-1 text-xs text-muted">🏪 {storeName}</p><p className="mt-1.5 text-xs text-muted">⭐ {demoRating(product.id).toFixed(1)} · 🕐 {demoDeliveryWindow(product.id)}</p>
      <p className="mt-3 text-xl font-bold text-rose">{formatINR(product.price)}</p>
      <p className="mt-2 text-sm text-muted">{product.description}</p>
      <div className="mt-4 flex items-center gap-3"><div role="group" aria-label="Quantity" className="flex items-center gap-2.5 rounded-full border border-border px-2.5 py-1.5">
        <button aria-label="Decrease preview quantity" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} className="h-6 w-6 rounded-full bg-blush disabled:opacity-40">−</button><span className="min-w-4 text-center text-sm font-bold">{quantity}</span>
        <button aria-label="Increase preview quantity" disabled={quantity >= 10} onClick={() => setQuantity(quantity + 1)} className="h-6 w-6 rounded-full bg-blush disabled:opacity-40">+</button>
      </div><Button className="flex-1 text-sm" disabled={disabled || busy} onClick={() => onAdd(quantity)}>{inCart ? `In cart: ${inCart} · Add more` : "Add to cart"}</Button></div>
      {disabled && <p className="mt-2 text-xs text-amber-800">Ordering is unavailable for this store or selected city.</p>}
    </div>
  </SheetContent></Sheet>;
}
