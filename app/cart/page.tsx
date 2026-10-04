"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CustomerShell } from "@/components/CustomerShell";
import { CartItems } from "@/components/CartItems";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useShoppingCart } from "@/lib/hooks/useShoppingCart";
import { formatINR } from "@/lib/utils";

export default function CartPage() {
  const router = useRouter();
  const cart = useShoppingCart();
  useEffect(() => { if (new URLSearchParams(window.location.search).get("checkout") === "1") router.replace("/checkout"); }, [router]);
  const store = cart.items?.[0]?.product.store;
  const subtotal = (cart.items ?? []).reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  return <CustomerShell><div className="p-4">
    <h1 className="font-serif text-xl font-semibold">Your cart</h1>
    {cart.error && <p role="alert" className="my-3 text-sm text-red-700">{cart.error}</p>}
    {!cart.items ? <LoadingSkeleton className="mt-4 h-40" /> : !store ? <EmptyState title="Your cart is empty" description="Add a gift from any store to get started." actionLabel="Browse gifts" onAction={() => router.push("/")} /> : <>
      <p className="mb-3 mt-1 text-[13px] text-muted">From {store.name}</p>
      <div className="mb-3 rounded-2xl border border-border bg-white p-3"><CartItems items={cart.items} busy={cart.busy} updateQuantity={cart.updateQuantity} /><div className="flex justify-between pt-3 font-bold"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div><p className="mt-1 text-[11px] text-muted">Delivery fee is calculated at checkout.</p></div>
      <Link className="mb-2 flex h-11 items-center justify-center rounded-full border border-border text-sm" href={`/stores/${store.id}`}>+ Add more from {store.name}</Link>
      <Button className="w-full" disabled={cart.busy} onClick={() => router.push("/checkout")}>Proceed to checkout →</Button>
    </>}
  </div></CustomerShell>;
}
