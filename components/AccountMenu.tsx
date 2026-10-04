"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { UserRound, LogOut } from "lucide-react";
import { useSession } from "@/lib/hooks/useSession";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AccountMenu() {
  const session = useSession();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.push("/login");
      router.refresh();
    } catch { setError("Could not log out. Please try again."); }
  }
  const itemClass = "flex cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-semibold outline-none focus:bg-blush";
  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger aria-label="Open account" className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-ink">
          <UserRound className="h-5 w-5" />
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={4} className="z-50 min-w-[170px] overflow-hidden rounded-[14px] border border-border bg-white shadow-lg">
            <Dropdown.Item className={itemClass} onSelect={() => setProfileOpen(true)}><UserRound className="h-4 w-4" />Profile</Dropdown.Item>
            {session?.role === "STORE_OWNER" && <>
              <Dropdown.Item asChild className={itemClass}><Link href="/store/profile">Store profile</Link></Dropdown.Item>
              <Dropdown.Item asChild className={itemClass}><Link href="/store/reports">Reports</Link></Dropdown.Item>
            </>}
            {session?.role === "ADMIN" && <Dropdown.Item asChild className={itemClass}><Link href="/admin/users">Users</Link></Dropdown.Item>}
            <Dropdown.Separator className="h-px bg-border" />
            <Dropdown.Item className={`${itemClass} text-red-600`} onSelect={logout}><LogOut className="h-4 w-4" />Log out</Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      {error && <p role="alert" className="absolute right-4 top-16 rounded-xl bg-white p-3 text-xs text-red-600 shadow-lg">{error}</p>}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-[300px] rounded-[18px] p-5">
          <DialogTitle className="mb-2.5 font-serif text-base font-bold">Profile</DialogTitle>
          <DialogDescription asChild><div className="space-y-0.5 break-words text-[13px] text-ink">
            <p><b>Name:</b> {session?.name}</p><p><b>Email:</b> {session?.email}</p><p><b>Role:</b> {session?.role}</p>
          </div></DialogDescription>
          <DialogClose asChild><Button className="mt-3.5 w-full">Close</Button></DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
