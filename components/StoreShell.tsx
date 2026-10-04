"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ClipboardList } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/store/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/store/products", label: "Products", icon: Package },
  { href: "/store/orders", label: "Orders", icon: ClipboardList },
];

export function StoreShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [newOrders, setNewOrders] = useState(0);

  useEffect(() => {
    fetch("/api/store/dashboard").then((r) => r.ok && r.json()).then((d) => d && setNewOrders(d.newOrders ?? 0)).catch(() => {});
  }, [pathname]);

  return (
    <div className="min-h-screen pb-20">

      <div className="flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md">
          <Link href="/store/dashboard" className="flex items-center gap-2 font-serif text-[19px] font-semibold text-ink"><span className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-rose text-white"><Gift className="h-5 w-5" /></span>Giftly</Link>
          <AccountMenu />
        </header>
        <main className="px-4 py-3.5">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex max-w-phone border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)]">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 whitespace-nowrap py-2.5 text-[11px]", active ? "text-rose" : "text-muted")}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {item.href === "/store/orders" && newOrders > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose text-[8px] font-bold text-white">{newOrders}</span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
