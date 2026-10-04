"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Gift, Bell, Users, ShoppingCart } from "lucide-react";
import { useSession } from "@/lib/hooks/useSession";
import { AccountMenu } from "@/components/AccountMenu";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: Home, href: "/" },
  { key: "reminders", label: "Reminders", icon: Bell, href: "/reminders" },
  { key: "group", label: "Group", icon: Users, href: "/group-gifts" },
  { key: "orders", label: "Orders", icon: Package, href: "/orders" },
];

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (session?.role !== "CUSTOMER") return;
    const refreshCart = () => fetch("/api/cart")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCartCount(d?.cart?.items?.reduce((n: number, it: any) => n + it.quantity, 0) ?? 0))
      .catch(() => {});
    refreshCart();
    window.addEventListener("giftly-cart-updated", refreshCart);
    return () => window.removeEventListener("giftly-cart-updated", refreshCart);
  }, [session, pathname]);

  const [reminderCount, setReminderCount] = useState(0);
  useEffect(() => {
    if (session?.role !== "CUSTOMER") { setReminderCount(0); return; }
    let active = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const response = await fetch("/api/reminders");
        if (!response.ok) return;
        const data = await response.json();
        if (active && current === request) setReminderCount(data.reminders.length);
      } catch { /* Keep the last known count until the next refresh. */ }
    };
    refresh();
    window.addEventListener("giftly-reminders-updated", refresh);
    return () => { active = false; window.removeEventListener("giftly-reminders-updated", refresh); };
  }, [session, pathname]);

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-rose text-white shadow-sm">
              <Gift className="h-4.5 w-4.5" />
            </div>
            <span className="font-serif text-[19px] font-semibold tracking-tight text-ink">Giftly</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blush text-ink"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            <AccountMenu />
          </div>
        </div>
      </div>

      <main>{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-phone border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn("flex min-w-0 flex-col items-center gap-1 whitespace-nowrap py-2.5 text-[10.5px] font-medium", active ? "text-rose" : "text-muted")}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  {item.key === "reminders" && reminderCount > 0 && (
                    <span aria-label={`${reminderCount} saved reminders`} className="absolute -right-3 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold text-white">
                      {reminderCount}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}

        </div>
      </nav>

    </div>
  );
}
