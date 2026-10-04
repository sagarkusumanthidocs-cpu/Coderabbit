import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/admin/products/[id]/route";
import { updateProductDetails, setProductFeatured, setProductAvailability } from "@/lib/services/admin";

vi.mock("@/lib/session", async (original) => ({
  ...await original<typeof import("@/lib/session")>(),
  requireRole: vi.fn().mockResolvedValue({ role: "ADMIN" }),
}));
vi.mock("@/lib/services/admin", () => ({
  getProductDetail: vi.fn(),
  updateProductDetails: vi.fn().mockResolvedValue({ id: "product" }),
  setProductFeatured: vi.fn().mockResolvedValue({ id: "product" }),
  setProductAvailability: vi.fn().mockResolvedValue({ id: "product" }),
}));

function update(body: unknown) {
  return PATCH(new NextRequest("http://localhost:3000/api/admin/products/product", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: "product" }) });
}

beforeEach(() => vi.clearAllMocks());

describe("admin product edits", () => {
  it("rejects an invalid edit without falling through to a featured-only update", async () => {
    const response = await update({ name: "", description: "Gift", price: -1, isFeatured: true });
    expect(response.status).toBe(422);
    expect(updateProductDetails).not.toHaveBeenCalled();
    expect(setProductFeatured).not.toHaveBeenCalled();
  });
  it("saves complete edits and accepts standalone availability toggles", async () => {
    expect((await update({ name: "Gift", description: "A gift", price: 19.99, isFeatured: true })).status).toBe(200);
    expect(updateProductDetails).toHaveBeenCalledOnce();
    expect((await update({ isAvailable: false })).status).toBe(200);
    expect(setProductAvailability).toHaveBeenCalledWith("product", false);
  });
});
