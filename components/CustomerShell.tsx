"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Package, UserRound, Gift, X, HelpCircle, LogOut, Info, Bell, Users, ShoppingCart } from "lucide-react";
import { useSession } from "@/lib/hooks/useSession";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: Home, href: "/" },
  { key: "reminders", label: "Reminders", icon: Bell, href: "/reminders" },
  { key: "group", label: "Group", icon: Users, href: "/group-gifts" },
  { key: "orders", label: "Orders", icon: Package, href: "/orders" },
];

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose text-white shadow-sm">
              <Gift className="h-4.5 w-4.5" />
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight text-ink">Giftly</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink shadow-sm"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              aria-label="Open account"
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink shadow-sm"
            >
              <UserRound className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <main>{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-phone border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
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
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted">
            <UserRound className="h-5 w-5" />
            Account
          </button>
        </div>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 mx-auto flex max-w-phone justify-end bg-black/40" onClick={() => setDrawerOpen(false)}>
          <div className="flex h-full w-80 max-w-[85%] flex-col bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-ink">Account</h2>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close">
                <X className="h-5 w-5 text-muted" />
              </button>
            </div>
            {session && (
              <div className="mb-4 rounded-2xl bg-blush/60 p-3">
                <p className="font-semibold text-ink">{session.name}</p>
                <p className="text-sm text-muted">{session.email}</p>
              </div>
            )}
            <div className="space-y-1 text-sm text-ink">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-muted">
                <Info className="h-4 w-4" /> Demo application - no real payments or deliveries.
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-muted">
                <HelpCircle className="h-4 w-4" /> Need help? This is a demo - no live support.
              </div>
            </div>
            <Button variant="outline" className="mt-auto w-full" onClick={logout}>
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
