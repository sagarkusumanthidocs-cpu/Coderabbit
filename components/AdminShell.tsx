"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Store, Package, ClipboardList, Undo2 } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/stores", label: "Stores", icon: Store },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/returns", label: "Returns", icon: Undo2 },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-20">
      <div className="flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md">
          <Link href="/admin/dashboard" className="flex items-center gap-2 font-serif text-[19px] font-semibold text-ink"><span className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-rose text-white"><Gift className="h-5 w-5" /></span>Giftly</Link>
          <AccountMenu />
        </header>
        <main className="px-4 py-3.5">{children}</main>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex max-w-phone overflow-x-auto border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)]">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 whitespace-nowrap py-2.5 text-[10.5px]", active ? "text-rose" : "text-muted")}>
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
