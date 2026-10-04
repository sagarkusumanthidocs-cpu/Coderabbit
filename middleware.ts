import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/jwt";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/me"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/images") || pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/cities") || pathname.startsWith("/api/categories")) return true;
  if (pathname.startsWith("/api/home") || pathname.startsWith("/api/products") || pathname.startsWith("/api/stores")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  const isApi = pathname.startsWith("/api");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "unauthorized", message: "Please sign in." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role-based area protection (defense in depth - route handlers also enforce this).
  if (pathname === "/store" || pathname.startsWith("/store/") || pathname === "/api/store" || pathname.startsWith("/api/store/")) {
    if (session.role !== "STORE_OWNER") {
      if (isApi) return NextResponse.json({ error: "forbidden", message: "Store owner access required." }, { status: 403 });
      return NextResponse.redirect(new URL("/login?session_expired=1", req.url));
    }
  }
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (session.role !== "ADMIN") {
      if (isApi) return NextResponse.json({ error: "forbidden", message: "Admin access required." }, { status: 403 });
      return NextResponse.redirect(new URL("/login?session_expired=1", req.url));
    }
  }
  if (pathname.startsWith("/orders") || pathname.startsWith("/checkout") || pathname.startsWith("/cart")) {
    if (session.role !== "CUSTOMER") {
      if (isApi) return NextResponse.json({ error: "forbidden", message: "Customer access required." }, { status: 403 });
      return NextResponse.redirect(new URL("/login?session_expired=1", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
