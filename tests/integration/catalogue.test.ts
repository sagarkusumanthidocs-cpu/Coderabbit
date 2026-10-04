import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/products/route";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const suffix = `${Date.now()}-search`;
let cityId: string;
let otherCityId: string;
let categoryId: string;
let ownerId: string;
let storeId: string;

beforeAll(async () => {
  cityId = (await db.city.create({ data: { name: `Search City ${suffix}` } })).id;
  otherCityId = (await db.city.create({ data: { name: `Other Search City ${suffix}` } })).id;
  categoryId = (await db.category.create({ data: { name: suffix, slug: suffix } })).id;
  ownerId = (await db.user.create({ data: { name: "Search Owner", email: `${suffix}@test.demo`, passwordHash: "x", role: "STORE_OWNER" } })).id;
  const base = { ownerUserId: ownerId, categoryId, cityId, description: "Search fixture", address: "Local", coverImage: "img" };
  storeId = (await db.store.create({ data: { ...base, name: "Orchid Boutique", moderationStatus: "APPROVED" } })).id;
  await db.store.create({ data: { ...base, name: "Orchid Blocked", moderationStatus: "BLOCKED" } });
  await db.store.create({ data: { ...base, cityId: otherCityId, name: "Orchid Elsewhere" } });
  await db.product.create({ data: { storeId, categoryId, name: "Rose Bouquet", description: "Gift", price: 100, imageUrl: "img" } });
});

afterAll(async () => {
  await db.product.deleteMany({ where: { store: { ownerUserId: ownerId } } });
  await db.store.deleteMany({ where: { ownerUserId: ownerId } });
  await db.user.delete({ where: { id: ownerId } });
  await db.category.delete({ where: { id: categoryId } });
  await db.city.deleteMany({ where: { id: { in: [cityId, otherCityId] } } });
  await db.$disconnect();
});

async function search(q: string, category?: string) {
  const params = new URLSearchParams({ cityId, q });
  if (category) params.set("category", category);
  const response = await GET(new NextRequest(`http://localhost/api/products?${params}`));
  expect(response.status).toBe(200);
  return response.json();
}

describe("customer catalogue search", () => {
  it("finds stores case-insensitively with surrounding whitespace, excluding blocked stores and other cities", async () => {
    const result = await search("  oRcHiD  ");
    expect(result.stores.map((s: { id: string }) => s.id)).toEqual([storeId]);
    expect(result.stores[0].city.id).toBe(cityId);
    expect(result.products).toEqual([]);
  });
  it("continues finding gifts by product name", async () => {
    const result = await search("  ROSE  ");
    expect(result.products.map((p: { name: string }) => p.name)).toEqual(["Rose Bouquet"]);
    expect(result.stores).toEqual([]);
  });
  it("honors category filters for stores", async () => {
    expect((await search("orchid", suffix)).stores).toHaveLength(1);
    expect((await search("orchid", "missing-category")).stores).toEqual([]);
  });
  it("returns the gift catalogue for an empty query and empty results for an unknown name", async () => {
    expect((await search(" ")).products).toHaveLength(1);
    expect((await search(" ")).stores).toEqual([]);
    expect(await search("no-such-gift-or-store")).toEqual({ products: [], stores: [] });
  });
});
