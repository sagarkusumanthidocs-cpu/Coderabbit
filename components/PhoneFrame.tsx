"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const APP_SCREEN_ID = "app-screen";

/** Shared portal host for dialogs and sheets. */
export function getAppScreen() {
  return typeof document === "undefined" ? undefined : document.getElementById(APP_SCREEN_ID) ?? undefined;
}

/** The reference uses a centered, full-height app with a maximum width of 480px. */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div id={APP_SCREEN_ID} className="relative mx-auto min-h-screen max-w-phone">
      <div id="app-scroll">{children}</div>
    </div>
  );
}
