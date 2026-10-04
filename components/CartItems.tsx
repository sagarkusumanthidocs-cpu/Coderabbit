"use client";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { formatINR } from "@/lib/utils";
import type { ShoppingCartItem } from "@/lib/hooks/useShoppingCart";

export function CartItems({ items, busy, updateQuantity }: { items: ShoppingCartItem[]; busy: boolean; updateQuantity: (id: string, quantity: number) => void }) {
  return <div>{items.map(({ product, productId, quantity }) => <div key={productId} className="flex items-center gap-2 border-b border-border py-2">
    <ImageWithFallback src={product.imageUrl} alt={product.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
    <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold">{product.name}</p><p className="text-[11px] text-muted">{formatINR(product.price)} each</p></div>
    <div className="flex items-center gap-1.5 text-[13px]"><button type="button" aria-label={`Remove one ${product.name}`} disabled={busy} onClick={() => updateQuantity(productId, quantity - 1)} className="h-6 w-6 rounded-full border">−</button><span>{quantity}</span><button type="button" aria-label={`Add one ${product.name}`} disabled={busy || quantity >= 10} onClick={() => updateQuantity(productId, quantity + 1)} className="h-6 w-6 rounded-full border disabled:opacity-40">+</button></div>
    <p className="min-w-[52px] text-right text-xs font-bold text-rose">{formatINR(Number(product.price) * quantity)}</p>
  </div>)}</div>;
}
