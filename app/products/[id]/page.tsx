"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { useCity } from "@/lib/hooks/useCity";
import { formatINR } from "@/lib/utils";
import { Minus, Plus, MapPin, Store as StoreIcon, Info } from "lucide-react";
import Link from "next/link";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const { cityId } = useCity([]); // just read stored preference

  useEffect(() => {
    setError(null);
    setLoading(true);
    fetch(`/api/products/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message ?? "Product not found.");
        return r.json();
      })
      .then((d) => setProduct(d.product))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id, reloadKey]);

  if (loading) {
    return (
      <CustomerShell>
        <div className="space-y-3 p-4">
          <LoadingSkeleton className="h-72 w-full" />
          <LoadingSkeleton className="h-6 w-1/2" />
          <LoadingSkeleton className="h-24 w-full" />
        </div>
      </CustomerShell>
    );
  }

  if (error || !product) {
    return (
      <CustomerShell>
        <div className="p-4">
          <ErrorState message={error ?? "Product not found."} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      </CustomerShell>
    );
  }

  const storeClosed = !product.store.isOpen;
  const storeBlocked = product.store.moderationStatus === "BLOCKED";
  const cityMismatch = cityId && product.store.cityId !== cityId;
  const unavailable = !product.isAvailable || product.isArchived;

  let disabledReason: string | null = null;
  if (unavailable) disabledReason = "This product is currently unavailable.";
  else if (storeBlocked) disabledReason = "This store is currently unavailable.";
  else if (storeClosed) disabledReason = "This store is closed right now.";
  else if (cityMismatch) disabledReason = `This product delivers in ${product.store.city.name}, not your selected city.`;

  async function addToCart(clearFirst = false) {
    if (disabledReason) return;
    setAddingToCart(true);
    setCartError(null);
    try {
      if (clearFirst) await fetch("/api/cart", { method: "DELETE" });
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setCartError(body.message ?? "Your cart has items from another store.");
        } else {
          setCartError(body.message ?? "Could not add this to your cart.");
        }
        return;
      }
      window.dispatchEvent(new Event("giftly-cart-updated"));
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch {
      setCartError("Could not add this to your cart. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  }

  function goToCheckout() {
    if (disabledReason) return;
    const params = new URLSearchParams({
      productId: product.id,
      quantity: String(quantity),
      cityId: product.store.cityId,
    });
    router.push(`/checkout?${params.toString()}`);
  }

  return (
    <CustomerShell>
      <div className="pb-28">
        <div className="relative aspect-square w-full bg-blush">
          <ImageWithFallback src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge className="bg-blush text-ink">
              <MapPin className="h-3 w-3" /> {product.store.city.name}
            </Badge>
            {product.isFeatured && <Badge className="bg-rose text-white">Featured</Badge>}
          </div>
          <h1 className="font-serif text-xl font-semibold text-ink">{product.name}</h1>
          <Link href={`/stores/${product.store.id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-rose">
            <StoreIcon className="h-3.5 w-3.5" /> Fulfilled by {product.store.name}
          </Link>
          <p className="mt-3 text-lg font-semibold text-ink">{formatINR(product.price)}</p>
          <p className="mt-2 text-sm text-muted">{product.description}</p>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-blush/50 p-3 text-xs text-muted">
            <Info className="h-4 w-4 flex-shrink-0 text-rose" />
            Delivery estimates shown at checkout are mock estimates for this demo.
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-ink">Quantity</p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-blush text-rose disabled:opacity-40"
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-medium">{quantity}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-blush text-rose disabled:opacity-40"
                disabled={quantity >= 10}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {disabledReason && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {disabledReason}{" "}
              {cityMismatch ? (
                <Link href="/" className="underline">
                  Change city
                </Link>
              ) : (
                <Link href="/products" className="underline">
                  Browse alternatives
                </Link>
              )}
            </div>
          )}

          {cartError && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {cartError}{" "}
              <button className="font-medium underline" onClick={() => addToCart(true)}>
                Clear cart &amp; add this instead
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-20 mx-auto flex max-w-phone gap-2 border-t border-ink/5 bg-white p-4">
        <Button
          variant="outline"
          className="flex-1"
          size="lg"
          disabled={!!disabledReason || addingToCart}
          onClick={() => addToCart(false)}
        >
          {addedToCart ? "✓ Added" : "Add to Cart"}
        </Button>
        <Button className="flex-1" size="lg" disabled={!!disabledReason} onClick={goToCheckout}>
          Buy Now · {formatINR(Number(product.price) * quantity)}
        </Button>
      </div>
    </CustomerShell>
  );
}
