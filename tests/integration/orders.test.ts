import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  createOrder,
  listOrdersForCustomer,
  listOrdersForAdmin,
  createOrderFromCart,
  transitionOrderAsStoreOwner,
  transitionOrderAsAdmin,
  getOrderForStore,
  confirmDeliveryByCustomer,
} from "@/lib/services/orders";
import { listAllStores, getStoreDetail, getAdminDashboard } from "@/lib/services/admin";
import { updateProduct } from "@/lib/services/storeOwner";
import { ValidationError, ConflictError, NotFoundError } from "@/lib/api-errors";
import { ForbiddenError } from "@/lib/session";

// These tests require a real Postgres reachable via DATABASE_URL (see package.json "test" script / README).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set to run integration tests (see README).");
}
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

let cityId: string;
let otherCityId: string;
let categoryId: string;
let customerId: string;
let otherCustomerId: string;
let storeOwnerId: string;
let otherStoreOwnerId: string;
let adminId: string;
let storeId: string;
let otherStoreId: string;
let productId: string;

beforeAll(async () => {
  const city = await db.city.create({ data: { name: `TestCity-${Date.now()}`, isActive: true } });
  cityId = city.id;
  const otherCity = await db.city.create({ data: { name: `OtherCity-${Date.now()}`, isActive: true } });
  otherCityId = otherCity.id;

  const category = await db.category.create({ data: { name: `TestCat-${Date.now()}`, slug: `test-cat-${Date.now()}` } });
  categoryId = category.id;

  const customer = await db.user.create({ data: { name: "Test Customer", email: `cust-${Date.now()}@test.demo`, passwordHash: "x", role: "CUSTOMER" } });
  customerId = customer.id;
  const otherCustomer = await db.user.create({ data: { name: "Other Customer", email: `cust2-${Date.now()}@test.demo`, passwordHash: "x", role: "CUSTOMER" } });
  otherCustomerId = otherCustomer.id;

  const owner = await db.user.create({ data: { name: "Test Owner", email: `owner-${Date.now()}@test.demo`, passwordHash: "x", role: "STORE_OWNER" } });
  storeOwnerId = owner.id;
  const otherOwner = await db.user.create({ data: { name: "Other Owner", email: `owner2-${Date.now()}@test.demo`, passwordHash: "x", role: "STORE_OWNER" } });
  otherStoreOwnerId = otherOwner.id;

  const admin = await db.user.create({ data: { name: "Test Admin", email: `admin-${Date.now()}@test.demo`, passwordHash: "x", role: "ADMIN" } });
  adminId = admin.id;

  const store = await db.store.create({
    data: {
      ownerUserId: storeOwnerId,
      categoryId,
      cityId,
      name: "Test Store",
      description: "d",
      address: "a",
      coverImage: "img",
      isOpen: true,
      moderationStatus: "APPROVED",
    },
  });
  storeId = store.id;

  const otherStore = await db.store.create({
    data: {
      ownerUserId: otherStoreOwnerId,
      categoryId,
      cityId,
      name: "Other Store",
      description: "d",
      address: "a",
      coverImage: "img",
      isOpen: true,
      moderationStatus: "APPROVED",
    },
  });
  otherStoreId = otherStore.id;

  const product = await db.product.create({
    data: {
      storeId,
      categoryId,
      name: "Test Product",
      description: "d",
      price: 100,
      imageUrl: "img",
      isAvailable: true,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  // Clean up everything created by this test run.
  await db.orderStatusHistory.deleteMany({ where: { order: { storeId: { in: [storeId, otherStoreId] } } } });
  await db.orderItem.deleteMany({ where: { order: { storeId: { in: [storeId, otherStoreId] } } } });
  await db.order.deleteMany({ where: { storeId: { in: [storeId, otherStoreId] } } });
  await db.product.deleteMany({ where: { storeId: { in: [storeId, otherStoreId] } } });
  await db.store.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } });
  await db.user.deleteMany({ where: { id: { in: [customerId, otherCustomerId, storeOwnerId, otherStoreOwnerId, adminId] } } });
  await db.category.delete({ where: { id: categoryId } });
  await db.city.deleteMany({ where: { id: { in: [cityId, otherCityId] } } });
  await db.$disconnect();
});

function baseCheckoutInput(overrides: Partial<any> = {}) {
  return {
    recipientName: "Recipient Name",
    recipientPhone: "9876543210",
    deliveryAddress: "123 Some Long Enough Street",
    occasion: "Birthday" as const,
    senderName: "Sender",
    paymentMethod: "CARD_MOCK" as const,
    productId,
    quantity: 2,
    cityId,
    deliveryOption: "STANDARD" as const,
    idempotencyKey: `key-${Math.random()}`,
    ...overrides,
  };
}

describe("customer order photos", () => {
  it("includes the gift photo for the owning customer without exposing their order to another customer", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    const orders = await listOrdersForCustomer(customerId);
    const item = orders.find((entry) => entry.id === order.id)?.items[0];
    expect(item?.product.imageUrl).toBe("img");
    expect(item?.productName).toBe("Test Product");
    expect((await listOrdersForCustomer(otherCustomerId)).some((entry) => entry.id === order.id)).toBe(false);
  });
});

describe("HTML reference checkout and admin summaries", () => {
  it("persists mock card payment and exposes an admin order thumbnail", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput({ paymentMethod: "CARD_MOCK" }) });
    expect(order.paymentMethod).toBe("CARD_MOCK");
    const orders = await listOrdersForAdmin({ storeId });
    expect(orders.find((entry) => entry.id === order.id)?.items[0].product.imageUrl).toBe("img");
  });
  it("summarizes actual store orders and omits owner credentials", async () => {
    const stores = await listAllStores({ cityId, categoryId });
    const store = stores.find((entry) => entry.id === storeId)!;
    const orders = await db.order.findMany({ where: { storeId } });
    expect(store.stats.activeOrders).toBe(orders.filter((order) => !["DELIVERED", "REJECTED"].includes(order.status)).length);
    expect(store.stats.completedOrders).toBe(orders.filter((order) => order.status === "DELIVERED").length);
    const detail = await getStoreDetail(storeId);
    expect(detail.store.owner).not.toHaveProperty("passwordHash");
    expect(stores.every((entry) => entry.cityId === cityId)).toBe(true);
    expect((await getAdminDashboard(otherCityId)).recentOrders).toEqual([]);
    expect((await getAdminDashboard(cityId)).recentOrders.every((entry) => entry.cityId === cityId)).toBe(true);
  });
});

describe("createOrder", () => {
  it("calculates totals server-side from the product price, not the client", async () => {
    // 100 * 2 + 49 standard fee = 249. A correct displayedTotal passes; a wrong one
    // is covered by the "rejects when displayed total has drifted" test below.
    const order = await createOrder({ customerId, input: baseCheckoutInput({ displayedTotal: 249 }) });
    expect(order).toBeDefined();
    const items = await db.orderItem.findMany({ where: { orderId: order.id } });
    expect(items[0].unitPrice.toNumber()).toBe(100);
    expect(items[0].lineTotal.toNumber()).toBe(200);
    expect(order.total.toNumber()).toBe(249);
  });

  it("rejects when the displayed total has drifted from the server-calculated total", async () => {
    await expect(
      createOrder({ customerId, input: baseCheckoutInput({ displayedTotal: 1 }) })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("is idempotent: replaying the same idempotency key returns the same order, not a duplicate", async () => {
    const key = `idem-${Math.random()}`;
    const first = await createOrder({ customerId, input: baseCheckoutInput({ idempotencyKey: key }) });
    const second = await createOrder({ customerId, input: baseCheckoutInput({ idempotencyKey: key }) });
    expect(second.id).toBe(first.id);
    const count = await db.order.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it("rejects a city mismatch between the product's store and the requested city", async () => {
    await expect(
      createOrder({ customerId, input: baseCheckoutInput({ cityId: otherCityId }) })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects ordering from a closed store", async () => {
    await db.store.update({ where: { id: storeId }, data: { isOpen: false } });
    await expect(createOrder({ customerId, input: baseCheckoutInput() })).rejects.toBeInstanceOf(ValidationError);
    await db.store.update({ where: { id: storeId }, data: { isOpen: true } });
  });

  it("rejects ordering an unavailable product", async () => {
    await db.product.update({ where: { id: productId }, data: { isAvailable: false } });
    await expect(createOrder({ customerId, input: baseCheckoutInput() })).rejects.toBeInstanceOf(ValidationError);
    await db.product.update({ where: { id: productId }, data: { isAvailable: true } });
  });
});

describe("createOrderFromCart", () => {
  function cartCheckoutInput(overrides: Partial<any> = {}) {
    const { productId: _p, quantity: _q, ...rest } = baseCheckoutInput(overrides);
    return rest;
  }

  it("rejects when the displayed cart total has drifted, and keeps the cart", async () => {
    await db.cartItem.create({ data: { customerId: otherCustomerId, productId, quantity: 2 } });
    // 100 * 2 + 49 = 249, but the client last saw 199.
    await expect(
      createOrderFromCart({ customerId: otherCustomerId, input: cartCheckoutInput({ displayedTotal: 199 }) })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.cartItem.count({ where: { customerId: otherCustomerId } })).toBe(1);
  });

  it("places the order when the displayed cart total matches", async () => {
    const order = await createOrderFromCart({ customerId: otherCustomerId, input: cartCheckoutInput({ displayedTotal: 249 }) });
    expect(order.total.toNumber()).toBe(249);
  });
});

describe("store owner transitions", () => {
  it("allows the valid ORDER_PLACED -> STORE_ACCEPTED -> ... -> OUT_FOR_DELIVERY sequence via the store owner", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    let current = order;
    for (const next of ["STORE_ACCEPTED", "PREPARING_GIFT", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] as const) {
      current = await transitionOrderAsStoreOwner({
        orderId: order.id,
        ownerUserId: storeOwnerId,
        targetStatus: next,
        expectedVersion: current.version,
      });
      expect(current.status).toBe(next);
    }
    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { changedAt: "asc" } });
    expect(history.map((h) => h.status)).toEqual([
      "ORDER_PLACED",
      "STORE_ACCEPTED",
      "PREPARING_GIFT",
      "READY_FOR_PICKUP",
      "OUT_FOR_DELIVERY",
    ]);
  });

  it("forbids the store owner from marking an order Delivered directly - that's reserved for the delivery/admin level", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    let current = order;
    for (const next of ["STORE_ACCEPTED", "PREPARING_GIFT", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] as const) {
      current = await transitionOrderAsStoreOwner({ orderId: order.id, ownerUserId: storeOwnerId, targetStatus: next, expectedVersion: current.version });
    }
    await expect(
      transitionOrderAsStoreOwner({ orderId: order.id, ownerUserId: storeOwnerId, targetStatus: "DELIVERED", expectedVersion: current.version })
    ).rejects.toThrow();
  });

  it("forbids skipping a step", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await expect(
      transitionOrderAsStoreOwner({ orderId: order.id, ownerUserId: storeOwnerId, targetStatus: "PREPARING_GIFT", expectedVersion: order.version })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("requires a reason to reject an order", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await expect(
      transitionOrderAsStoreOwner({ orderId: order.id, ownerUserId: storeOwnerId, targetStatus: "REJECTED", expectedVersion: order.version })
    ).rejects.toBeInstanceOf(ValidationError);

    const rejected = await transitionOrderAsStoreOwner({
      orderId: order.id,
      ownerUserId: storeOwnerId,
      targetStatus: "REJECTED",
      expectedVersion: order.version,
      reason: "Out of stock",
    });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Out of stock");
  });

  it("forbids another store owner from touching this order (cross-store access)", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await expect(
      transitionOrderAsStoreOwner({ orderId: order.id, ownerUserId: otherStoreOwnerId, targetStatus: "STORE_ACCEPTED", expectedVersion: order.version })
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getOrderForStore(order.id, otherStoreOwnerId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("detects a stale/conflicting update via optimistic concurrency", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    // Simulate a concurrent session that already advanced the order to STORE_ACCEPTED.
    await transitionOrderAsStoreOwner({ orderId: order.id, ownerUserId: storeOwnerId, targetStatus: "STORE_ACCEPTED", expectedVersion: order.version });
    // This caller still has the stale (pre-update) version number, and attempts the
    // next-valid-from-STORE_ACCEPTED transition - it must fail on the version check,
    // not on transition validity.
    await expect(
      transitionOrderAsStoreOwner({ orderId: order.id, ownerUserId: storeOwnerId, targetStatus: "PREPARING_GIFT", expectedVersion: order.version })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("admin override", () => {
  it("can jump directly to a later status and records an override history entry with a reason", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    const updated = await transitionOrderAsAdmin({
      orderId: order.id,
      adminUserId: adminId,
      targetStatus: "OUT_FOR_DELIVERY",
      reason: "Manual correction for demo",
      expectedVersion: order.version,
    });
    expect(updated.status).toBe("OUT_FOR_DELIVERY");
    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { changedAt: "desc" } });
    expect(history[0].isAdminOverride).toBe(true);
    expect(history[0].note).toBe("Manual correction for demo");
    expect(history[0].changedByRole).toBe("ADMIN");
  });

  it("can correct a terminal state back to an earlier one", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await transitionOrderAsAdmin({ orderId: order.id, adminUserId: adminId, targetStatus: "DELIVERED", reason: "fast-forward for test", expectedVersion: order.version });
    const afterFirst = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    const corrected = await transitionOrderAsAdmin({
      orderId: order.id,
      adminUserId: adminId,
      targetStatus: "PREPARING_GIFT",
      reason: "Correcting a mistaken delivery mark",
      expectedVersion: afterFirst.version,
    });
    expect(corrected.status).toBe("PREPARING_GIFT");
    // All original history must be preserved, not overwritten.
    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history.some((h) => h.status === "DELIVERED")).toBe(true);
    expect(history.some((h) => h.status === "PREPARING_GIFT" && h.isAdminOverride)).toBe(true);
  });

  it("requires a non-empty reason", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await expect(
      transitionOrderAsAdmin({ orderId: order.id, adminUserId: adminId, targetStatus: "DELIVERED", reason: "", expectedVersion: order.version })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("customer delivery confirmation", () => {
  it("confirms delivery with a photo once the order is Delivered", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await transitionOrderAsAdmin({ orderId: order.id, adminUserId: adminId, targetStatus: "DELIVERED", reason: "fast-forward for test", expectedVersion: order.version });

    const confirmed = await confirmDeliveryByCustomer(order.id, customerId, "data:image/jpeg;base64,/9j/fakebytes");
    expect(confirmed.deliveryConfirmedByCustomer).toBe(true);
    expect(confirmed.proofImage).toBe("data:image/jpeg;base64,/9j/fakebytes");

    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { changedAt: "desc" } });
    expect(history[0].note).toBe("Confirmed by customer with photo");
    expect(history[0].changedByRole).toBe("CUSTOMER");
  });

  it("refuses to confirm an order that isn't Delivered yet", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await expect(confirmDeliveryByCustomer(order.id, customerId, "data:image/jpeg;base64,x")).rejects.toThrow();
  });

  it("refuses a second confirmation", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await transitionOrderAsAdmin({ orderId: order.id, adminUserId: adminId, targetStatus: "DELIVERED", reason: "fast-forward for test", expectedVersion: order.version });
    await confirmDeliveryByCustomer(order.id, customerId, "data:image/jpeg;base64,x");
    await expect(confirmDeliveryByCustomer(order.id, customerId, "data:image/jpeg;base64,y")).rejects.toThrow();
  });

  it("refuses to confirm another customer's order", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    await transitionOrderAsAdmin({ orderId: order.id, adminUserId: adminId, targetStatus: "DELIVERED", reason: "fast-forward for test", expectedVersion: order.version });
    await expect(confirmDeliveryByCustomer(order.id, otherCustomerId, "data:image/jpeg;base64,x")).rejects.toThrow();
  });
});

describe("historical price integrity", () => {
  it("does not change an existing order's item snapshot when the product price is edited later", async () => {
    const order = await createOrder({ customerId, input: baseCheckoutInput() });
    const itemBefore = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(itemBefore.unitPrice.toNumber()).toBe(100);

    await updateProduct(storeOwnerId, productId, { price: 999 });

    const itemAfter = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(itemAfter.unitPrice.toNumber()).toBe(100); // unchanged
    expect(itemAfter.productName).toBe("Test Product");

    // Restore price for other tests in this file.
    await db.product.update({ where: { id: productId }, data: { price: 100 } });
  });
});

describe("group gift funding and cart handoff", () => {
  it("funds an uneven equal split exactly and keeps every selected gift in checkout", async () => {
    const { createGroupGift, markContributorPaid, prepareGroupGiftCart, deleteGroupGift } = await import("@/lib/services/groupGifts");
    const second = await db.product.create({ data: { storeId, categoryId, name: "Second Gift", description: "d", price: 50, imageUrl: "img" } });
    const gift = await createGroupGift(customerId, {
      recipientName: "Group Recipient", occasionType: "BIRTHDAY", productIds: [productId, second.id], cityId,
      deliveryDate: "2027-12-15", goalAmount: 100, splitType: "EQUAL",
      contributors: [{ name: "Creator", amount: 33 }, { name: "Alex", amount: 33 }, { name: "Sam", amount: 33 }],
    });
    try {
      await expect(prepareGroupGiftCart(customerId, gift.id, false)).rejects.toBeInstanceOf(ValidationError);
      let funded: any = gift;
      for (const contributor of gift.contributors.filter((c) => !c.paid)) {
        funded = await markContributorPaid(customerId, gift.id, contributor.id);
      }
      expect(funded.collectedAmount).toBe(100);
      expect(funded.isFullyFunded).toBe(true);
      await expect(prepareGroupGiftCart(otherCustomerId, gift.id, false)).rejects.toBeInstanceOf(ForbiddenError);
      await prepareGroupGiftCart(customerId, gift.id, false);
      const cart = await db.cartItem.findMany({ where: { customerId } });
      expect(cart.map((item) => item.productId).sort()).toEqual([productId, second.id].sort());
    } finally {
      await db.cartItem.deleteMany({ where: { customerId } });
      await deleteGroupGift(customerId, gift.id);
      await db.product.delete({ where: { id: second.id } });
    }
  });

  it("requires confirmation for mixed stores and preserves the cart if a gift becomes unavailable", async () => {
    const { createGroupGift, prepareGroupGiftCart, deleteGroupGift, getGroupGift } = await import("@/lib/services/groupGifts");
    const otherProduct = await db.product.create({ data: { storeId: otherStoreId, categoryId, name: "Other Store Gift", description: "d", price: 50, imageUrl: "img" } });
    const gift = await createGroupGift(customerId, {
      recipientName: "Group Recipient", occasionType: "BIRTHDAY", productIds: [productId, otherProduct.id], cityId,
      deliveryDate: "2027-12-15", goalAmount: 100, splitType: "EQUAL", contributors: [{ name: "Creator", amount: 100 }],
    });
    try {
      const detail = await getGroupGift(customerId, gift.id);
      const primary = detail.items[0].productId;
      await expect(prepareGroupGiftCart(customerId, gift.id, false)).rejects.toBeInstanceOf(ValidationError);
      await prepareGroupGiftCart(customerId, gift.id, true);
      expect((await db.cartItem.findMany({ where: { customerId } })).map((item) => item.productId)).toEqual([primary]);
      await db.product.update({ where: { id: primary }, data: { isAvailable: false } });
      await expect(prepareGroupGiftCart(customerId, gift.id, true)).rejects.toBeInstanceOf(ValidationError);
      expect(await db.cartItem.count({ where: { customerId } })).toBe(1);
      await db.product.update({ where: { id: primary }, data: { isAvailable: true } });
    } finally {
      await db.cartItem.deleteMany({ where: { customerId } });
      await deleteGroupGift(customerId, gift.id);
      await db.product.delete({ where: { id: otherProduct.id } });
    }
  });

  it("rejects gifts from another delivery city", async () => {
    const { createGroupGift } = await import("@/lib/services/groupGifts");
    await expect(createGroupGift(customerId, {
      recipientName: "Group Recipient", occasionType: "BIRTHDAY", productIds: [productId], cityId: otherCityId,
      deliveryDate: "2027-12-15", goalAmount: 100, splitType: "EQUAL", contributors: [{ name: "Creator", amount: 100 }],
    })).rejects.toBeInstanceOf(ValidationError);
  });
});
