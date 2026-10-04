"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ShoppingCartItem = { productId: string; quantity: number; product: { id: string; name: string; price: string; imageUrl: string; storeId: string; store: { id: string; name: string; cityId: string; city: { name: string } } } };
type PendingAdd = { productId: string; quantity: number; onSuccess?: () => void };

export function useShoppingCart() {
  const [items, setItems] = useState<ShoppingCartItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/cart");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Could not load your cart.");
    setItems(data.cart.items);
  }, []);
  useEffect(() => {
    const reload = () => { refresh().catch((e) => setError(e.message)); };
    reload();
    window.addEventListener("giftly-cart-updated", reload);
    return () => window.removeEventListener("giftly-cart-updated", reload);
  }, [refresh]);

  async function add(productId: string, quantity = 1, onSuccess?: () => void, replaceExisting = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, quantity, replaceExisting }) });
      const data = await response.json();
      if (response.status === 409 && !replaceExisting) { setPending({ productId, quantity, onSuccess }); return; }
      if (!response.ok) throw new Error(data.message ?? "Could not add this gift.");
      setPending(null);
      await refresh();
      window.dispatchEvent(new Event("giftly-cart-updated"));
      onSuccess?.();
    } catch (e: any) { setError(e.message ?? "Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function updateQuantity(productId: string, quantity: number) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/cart/${productId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not update your cart.");
      await refresh();
      window.dispatchEvent(new Event("giftly-cart-updated"));
    } catch (e: any) { setError(e.message ?? "Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const cancel = () => { if (!busy) { setPending(null); setError(null); } };
  const confirmation = (
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open) cancel(); }}>
      {pending && <DialogContent className="z-[70] max-w-[320px] p-5" overlayClassName="z-[60]">
        <DialogTitle className="text-base font-semibold">Would you like to clear the cart?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">Your cart already has gifts from another store. Clear the cart and add this item instead?</DialogDescription>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={cancel}>Cancel</Button>
          <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => add(pending.productId, pending.quantity, pending.onSuccess, true)}>{busy ? "Adding…" : "Clear cart & add"}</Button>
        </div>
      </DialogContent>}
    </Dialog>
  );
  return { items, error, busy, add, updateQuantity, refresh, confirmation };
}
