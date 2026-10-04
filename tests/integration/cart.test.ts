import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { addToCart, getCart } from "@/lib/services/cart";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { addToCartSchema } from "@/lib/validation";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const suffix = `cart-${Date.now()}`;
let cityId: string, categoryId: string, customerId: string, otherCustomerId: string, ownerId: string;
let storeA: string, storeB: string, productA: string, productB: string, secondProductA: string;
beforeAll(async () => {
  cityId = (await db.city.create({ data: { name: suffix } })).id;
  categoryId = (await db.category.create({ data: { name: suffix, slug: suffix } })).id;
  customerId = (await db.user.create({ data: { name: "Cart customer", email: `${suffix}@test.demo`, passwordHash: "x", role: "CUSTOMER" } })).id;
  otherCustomerId = (await db.user.create({ data: { name: "Other customer", email: `other-${suffix}@test.demo`, passwordHash: "x", role: "CUSTOMER" } })).id;
  ownerId = (await db.user.create({ data: { name: "Cart owner", email: `owner-${suffix}@test.demo`, passwordHash: "x", role: "STORE_OWNER" } })).id;
  const storeData = { ownerUserId: ownerId, cityId, categoryId, description: "Fixture", address: "Fixture", coverImage: "img", isOpen: true, moderationStatus: "APPROVED" as const };
  storeA = (await db.store.create({ data: { ...storeData, name: "Store A" } })).id;
  storeB = (await db.store.create({ data: { ...storeData, name: "Store B" } })).id;
  const productData = { categoryId, name: "Gift", description: "Fixture", price: 100, imageUrl: "img", isAvailable: true };
  productA = (await db.product.create({ data: { ...productData, storeId: storeA } })).id;
  secondProductA = (await db.product.create({ data: { ...productData, storeId: storeA } })).id;
  productB = (await db.product.create({ data: { ...productData, storeId: storeB } })).id;
});
beforeEach(async () => {
  await db.cartItem.deleteMany({ where: { customerId: { in: [customerId, otherCustomerId] } } });
  await db.product.update({ where: { id: productB }, data: { isAvailable: true, isArchived: false } });
  await db.store.update({ where: { id: storeB }, data: { isOpen: true, moderationStatus: "APPROVED" } });
});
afterAll(async () => {
  await db.cartItem.deleteMany({ where: { customerId: { in: [customerId, otherCustomerId] } } });
  await db.product.deleteMany({ where: { storeId: { in: [storeA, storeB] } } });
  await db.store.deleteMany({ where: { id: { in: [storeA, storeB] } } });
  await db.user.deleteMany({ where: { id: { in: [customerId, otherCustomerId, ownerId] } } });
  await db.category.delete({ where: { id: categoryId } });
  await db.city.delete({ where: { id: cityId } });
  await db.$disconnect();
});
async function snapshot() { return (await getCart(customerId)).items.map((item) => ({ productId: item.productId, quantity: item.quantity })); }

describe("single-store cart confirmation", () => {
  it("requires explicit boolean consent; existing clients default to no replacement", () => {
    expect(addToCartSchema.parse({ productId: productA, quantity: 1 }).replaceExisting).toBe(false);
    expect(addToCartSchema.safeParse({ productId: productA, quantity: 1, replaceExisting: "true" }).success).toBe(false);
  });
  it("accumulates same-store gifts, caps quantity and exposes delivery city", async () => {
    await addToCart(customerId, productA, 8);
    await addToCart(customerId, productA, 5);
    await addToCart(customerId, secondProductA, 2);
    const cart = await getCart(customerId);
    expect(cart.items).toHaveLength(2);
    expect(cart.items.find((item) => item.productId === productA)?.quantity).toBe(10);
    expect(cart.items[0].product.store.city.name).toBe(suffix);
    expect(Number(cart.subtotal)).toBe(1200);
  });
  it("rejects a different store without modifying the old cart", async () => {
    await addToCart(customerId, productA, 2);
    await expect(addToCart(customerId, productB, 1)).rejects.toBeInstanceOf(ConflictError);
    expect(await snapshot()).toEqual([{ productId: productA, quantity: 2 }]);
  });
  it("replaces only the consenting customer's cart", async () => {
    await addToCart(customerId, productA, 2);
    await addToCart(otherCustomerId, productA, 3);
    await addToCart(customerId, productB, 1, true);
    expect(await snapshot()).toEqual([{ productId: productB, quantity: 1 }]);
    expect((await getCart(otherCustomerId)).items[0].quantity).toBe(3);
  });
  it.each(["unavailable", "archived", "closed", "blocked"])("keeps the cart if the replacement becomes %s", async (state) => {
    await addToCart(customerId, productA, 2);
    if (state === "unavailable") await db.product.update({ where: { id: productB }, data: { isAvailable: false } });
    if (state === "archived") await db.product.update({ where: { id: productB }, data: { isArchived: true } });
    if (state === "closed") await db.store.update({ where: { id: storeB }, data: { isOpen: false } });
    if (state === "blocked") await db.store.update({ where: { id: storeB }, data: { moderationStatus: "BLOCKED" } });
    await expect(addToCart(customerId, productB, 1, true)).rejects.toBeInstanceOf(ValidationError);
    expect(await snapshot()).toEqual([{ productId: productA, quantity: 2 }]);
  });
  it("keeps the old cart when the replacement no longer exists", async () => {
    await addToCart(customerId, productA, 2);
    await expect(addToCart(customerId, "missing", 1, true)).rejects.toBeInstanceOf(NotFoundError);
    expect(await snapshot()).toEqual([{ productId: productA, quantity: 2 }]);
  });
  it("serializes simultaneous additions to an empty cart without mixing stores", async () => {
    const results = await Promise.allSettled([addToCart(customerId, productA, 1), addToCart(customerId, productB, 1)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: expect.any(ConflictError) });
    expect((await getCart(customerId)).items).toHaveLength(1);
  });
});
