import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { verifySession } from "@/lib/jwt";

vi.mock("@/lib/jwt", () => ({
  SESSION_COOKIE_NAME: "giftly_session",
  verifySession: vi.fn(),
}));

function request(path: string) {
  return new NextRequest(`http://localhost:3000${path}`, { headers: { cookie: "giftly_session=test" } });
}

function customer() {
  vi.mocked(verifySession).mockResolvedValue({ userId: "customer", role: "CUSTOMER", name: "Customer", email: "customer@test.demo" });
}

describe("store page access", () => {
  it("lets customers open a store from a product page", async () => {
    customer();
    const response = await middleware(request("/stores/petals"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("still protects the store owner pages and APIs", async () => {
    customer();
    expect((await middleware(request("/store/dashboard"))).status).toBe(307);
    expect((await middleware(request("/api/store/orders"))).status).toBe(403);
  });

  it("requires login before opening a customer store page", async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const response = await middleware(request("/stores/petals"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fstores%2Fpetals");
  });
});
