import "server-only";
import { getDb } from "@/lib/db";
import { generateOrderCode } from "./orderCode";
import { calculateTotals, calculateCartTotals } from "./pricing";
import { isScheduleValid } from "./scheduling";
import { isValidStoreTransition, isValidAdminOverride } from "./orderStateMachine";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { ForbiddenError } from "@/lib/session";
import type { CheckoutInput, CartCheckoutInput } from "@/lib/validation";
import { Prisma, OrderStatus, Role } from "@prisma/client";

export interface CreateOrderParams {
  customerId: string;
  input: CheckoutInput;
}

/**
 * Creates a mock order. Re-validates everything server-side: product
 * availability, store state, active city, city match, and price - the
 * client's displayed total is never trusted. Idempotency is enforced via a
 * unique DB constraint so retried submissions return the original order.
 */
export async function createOrder({ customerId, input }: CreateOrderParams) {
  const db = getDb();

  // Idempotent replay: if this key was already used, return the existing order.
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.customerId !== customerId) {
      throw new ConflictError("This request has already been processed.");
    }
    return existing;
  }

  const product = await db.product.findUnique({
    where: { id: input.productId },
    include: { store: true },
  });
  if (!product) throw new NotFoundError("This product could not be found.");
  if (product.isArchived || !product.isAvailable) {
    throw new ValidationError("This product is no longer available.");
  }
  if (product.store.moderationStatus === "BLOCKED") {
    throw new ValidationError("This store is currently unavailable.");
  }
  if (!product.store.isOpen) {
    throw new ValidationError("This store is currently closed.");
  }
  if (product.store.cityId !== input.cityId) {
    throw new ValidationError("This product is not available in your selected city.");
  }
  const city = await db.city.findUnique({ where: { id: input.cityId } });
  if (!city || !city.isActive) {
    throw new ValidationError("Please choose an active delivery city.");
  }

  if (input.deliveryOption === "SCHEDULED") {
    if (!input.deliveryDate || !input.deliverySlot || !isScheduleValid(input.deliveryDate, input.deliverySlot)) {
      throw new ValidationError("Please choose a valid (non-elapsed) delivery date and slot.");
    }
  }

  const { subtotal, deliveryFee, total } = calculateTotals(product.price, input.quantity, input.deliveryOption);

  // Require-review-again if the price the client last saw has drifted meaningfully.
  if (
    typeof input.displayedTotal === "number" &&
    Math.abs(input.displayedTotal - total.toNumber()) > 0.01
  ) {
    throw new ValidationError(
      "The price has changed since you last viewed this order. Please review and confirm again.",
      { total: ["Price changed"] }
    );
  }

  const deliveryDate = input.deliveryOption === "SCHEDULED" && input.deliveryDate ? new Date(`${input.deliveryDate}T00:00:00+05:30`) : null;

  // Retry a handful of times on the (astronomically unlikely) order-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderCode = generateOrderCode();
    try {
      const order = await db.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            orderCode,
            customerId,
            storeId: product.storeId,
            cityId: input.cityId,
            status: "ORDER_PLACED",
            recipientName: input.recipientName,
            recipientPhone: input.recipientPhone,
            deliveryAddress: input.deliveryAddress,
            landmark: input.landmark || null,
            pincode: input.pincode || null,
            senderName: input.senderName,
            occasion: input.occasion,
            giftMessage: input.giftMessage || null,
            deliveryOption: input.deliveryOption,
            deliveryDate,
            deliverySlot: input.deliveryOption === "SCHEDULED" ? input.deliverySlot ?? null : null,
            paymentMethod: input.paymentMethod,
            subtotal,
            deliveryFee,
            total,
            idempotencyKey: input.idempotencyKey,
            items: {
              create: [
                {
                  productId: product.id,
                  productName: product.name,
                  unitPrice: product.price,
                  quantity: input.quantity,
                  lineTotal: product.price.mul(input.quantity),
                },
              ],
            },
            statusHistory: {
              create: [
                {
                  previousStatus: null,
                  status: "ORDER_PLACED",
                  changedById: customerId,
                  changedByRole: "CUSTOMER" as Role,
                  note: null,
                  isAdminOverride: false,
                },
              ],
            },
          },
        });
        return created;
      });
      return order;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        if (target.includes("idempotencyKey")) {
          const replay = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
          if (replay) return replay;
        }
        // orderCode collision: loop and retry with a fresh code
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique order code. Please try again.");
}

/**
 * Creates an order from everything currently in the customer's cart (one
 * store's worth of items, enforced when items were added to the cart).
 * Re-validates every item server-side exactly like the single-item path,
 * then clears the cart on success. Idempotent via the same unique-key rule.
 */
export async function createOrderFromCart({ customerId, input }: { customerId: string; input: CartCheckoutInput }) {
  const db = getDb();

  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.customerId !== customerId) {
      throw new ConflictError("This request has already been processed.");
    }
    return existing;
  }

  const cartItems = await db.cartItem.findMany({ where: { customerId }, include: { product: { include: { store: true } } } });
  if (cartItems.length === 0) throw new ValidationError("Your cart is empty.");

  const storeId = cartItems[0].product.storeId;
  for (const item of cartItems) {
    if (item.product.storeId !== storeId) {
      throw new ValidationError("Your cart has items from more than one store - only one store can be ordered from at a time.");
    }
    if (item.product.isArchived || !item.product.isAvailable) {
      throw new ValidationError(`"${item.product.name}" is no longer available.`);
    }
    if (item.product.store.moderationStatus === "BLOCKED") {
      throw new ValidationError("This store is currently unavailable.");
    }
    if (!item.product.store.isOpen) {
      throw new ValidationError("This store is currently closed.");
    }
    if (item.product.store.cityId !== input.cityId) {
      throw new ValidationError("These products are not available in your selected city.");
    }
  }
  const city = await db.city.findUnique({ where: { id: input.cityId } });
  if (!city || !city.isActive) {
    throw new ValidationError("Please choose an active delivery city.");
  }

  if (input.deliveryOption === "SCHEDULED") {
    if (!input.deliveryDate || !input.deliverySlot || !isScheduleValid(input.deliveryDate, input.deliverySlot)) {
      throw new ValidationError("Please choose a valid (non-elapsed) delivery date and slot.");
    }
  }

  const { subtotal, deliveryFee, total } = calculateCartTotals(
    cartItems.map((i) => ({ unitPrice: i.product.price, quantity: i.quantity })),
    input.deliveryOption
  );

  if (
    typeof input.displayedTotal === "number" &&
    Math.abs(input.displayedTotal - total.toNumber()) > 0.01
  ) {
    throw new ValidationError(
      "The price has changed since you last viewed your cart. Please review and confirm again.",
      { total: ["Price changed"] }
    );
  }

  const deliveryDate = input.deliveryOption === "SCHEDULED" && input.deliveryDate ? new Date(`${input.deliveryDate}T00:00:00+05:30`) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderCode = generateOrderCode();
    try {
      const order = await db.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            orderCode,
            customerId,
            storeId,
            cityId: input.cityId,
            status: "ORDER_PLACED",
            recipientName: input.recipientName,
            recipientPhone: input.recipientPhone,
            deliveryAddress: input.deliveryAddress,
            landmark: input.landmark || null,
            pincode: input.pincode || null,
            senderName: input.senderName,
            occasion: input.occasion,
            giftMessage: input.giftMessage || null,
            deliveryOption: input.deliveryOption,
            deliveryDate,
            deliverySlot: input.deliveryOption === "SCHEDULED" ? input.deliverySlot ?? null : null,
            paymentMethod: input.paymentMethod,
            subtotal,
            deliveryFee,
            total,
            idempotencyKey: input.idempotencyKey,
            items: {
              create: cartItems.map((i) => ({
                productId: i.productId,
                productName: i.product.name,
                unitPrice: i.product.price,
                quantity: i.quantity,
                lineTotal: i.product.price.mul(i.quantity),
              })),
            },
            statusHistory: {
              create: [
                {
                  previousStatus: null,
                  status: "ORDER_PLACED",
                  changedById: customerId,
                  changedByRole: "CUSTOMER" as Role,
                  note: null,
                  isAdminOverride: false,
                },
              ],
            },
          },
        });
        await tx.cartItem.deleteMany({ where: { customerId } });
        return created;
      });
      return order;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        if (target.includes("idempotencyKey")) {
          const replay = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
          if (replay) return replay;
        }
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique order code. Please try again.");
}

const ORDER_INCLUDE = {
  items: true,
  statusHistory: { orderBy: { changedAt: "asc" as const } },
  store: true,
  city: true,
} satisfies Prisma.OrderInclude;

export async function getOrderForCustomer(orderId: string, customerId: string) {
  const db = getDb();
  const order = await db.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!order || order.customerId !== customerId) throw new NotFoundError("Order not found.");
  return order;
}

export async function listOrdersForCustomer(customerId: string) {
  const db = getDb();
  return db.order.findMany({
    where: { customerId },
    include: { ...ORDER_INCLUDE, items: { include: { product: { select: { imageUrl: true } } } } },
    orderBy: { placedAt: "desc" },
  });
}

/**
 * Customer confirms their own order was delivered by attaching a proof photo.
 * Only valid while status is DELIVERED and only for the order's own customer -
 * this intentionally stays out of the store owner's and the delivery/rider
 * level's hands, matching the real-world responsibility split.
 */
export async function confirmDeliveryByCustomer(orderId: string, customerId: string, proofImage: string) {
  const db = getDb();
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.customerId !== customerId) throw new NotFoundError("Order not found.");
  if (order.status !== "DELIVERED") {
    throw new ConflictError("This order isn't marked as delivered yet, so it can't be confirmed.");
  }
  if (order.deliveryConfirmedByCustomer) {
    throw new ConflictError("This order has already been confirmed.");
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { proofImage, deliveryConfirmedByCustomer: true },
      include: ORDER_INCLUDE,
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: "DELIVERED",
        status: "DELIVERED",
        changedById: customerId,
        changedByRole: "CUSTOMER",
        note: "Confirmed by customer with photo",
      },
    });
    return updated;
  });
}

export async function getOrderForStore(orderId: string, ownerUserId: string) {
  const db = getDb();
  const order = await db.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!order) throw new NotFoundError("Order not found.");
  if (order.store.ownerUserId !== ownerUserId) throw new ForbiddenError("You do not have access to this order.");
  return order;
}

export async function listOrdersForStoreOwner(ownerUserId: string) {
  const db = getDb();
  const stores = await db.store.findMany({ where: { ownerUserId }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);
  return db.order.findMany({
    where: { storeId: { in: storeIds } },
    include: ORDER_INCLUDE,
    orderBy: { placedAt: "desc" },
  });
}

export async function getOrderForAdmin(orderId: string) {
  const db = getDb();
  const order = await db.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!order) throw new NotFoundError("Order not found.");
  return order;
}

export async function listOrdersForAdmin(filters: { status?: OrderStatus; cityId?: string; storeId?: string; orderCode?: string }) {
  const db = getDb();
  return db.order.findMany({
    where: {
      status: filters.status,
      cityId: filters.cityId,
      storeId: filters.storeId,
      orderCode: filters.orderCode ? { contains: filters.orderCode, mode: "insensitive" } : undefined,
    },
    include: { ...ORDER_INCLUDE, items: { include: { product: { select: { imageUrl: true } } } } },
    orderBy: { placedAt: "desc" },
  });
}

/** Store-owner-initiated status transition with optimistic concurrency control. */
export async function transitionOrderAsStoreOwner(params: {
  orderId: string;
  ownerUserId: string;
  targetStatus: OrderStatus;
  expectedVersion: number;
  reason?: string; // required for REJECTED
}) {
  const db = getDb();
  const order = await db.order.findUnique({ where: { id: params.orderId }, include: { store: true } });
  if (!order) throw new NotFoundError("Order not found.");
  if (order.store.ownerUserId !== params.ownerUserId) {
    throw new ForbiddenError("You do not have access to this order.");
  }
  if (!isValidStoreTransition(order.status, params.targetStatus)) {
    throw new ValidationError(`Cannot move an order from ${order.status} to ${params.targetStatus}.`);
  }
  if (params.targetStatus === "REJECTED" && (!params.reason || params.reason.trim().length < 3)) {
    throw new ValidationError("A reason is required to reject an order.");
  }
  if (order.version !== params.expectedVersion) {
    throw new ConflictError(
      "This order was already updated by another session. Please refresh to see the latest status."
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: order.id, version: params.expectedVersion },
      data: {
        status: params.targetStatus,
        version: { increment: 1 },
        rejectionReason: params.targetStatus === "REJECTED" ? params.reason : order.rejectionReason,
      },
    });
    if (result.count === 0) {
      throw new ConflictError(
        "This order was already updated by another session. Please refresh to see the latest status."
      );
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        status: params.targetStatus,
        changedById: params.ownerUserId,
        changedByRole: "STORE_OWNER",
        note: params.targetStatus === "REJECTED" ? params.reason : null,
        isAdminOverride: false,
      },
    });
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
  });
  return updated;
}

/** Admin override - may jump to any status, including correcting a terminal one. */
export async function transitionOrderAsAdmin(params: {
  orderId: string;
  adminUserId: string;
  targetStatus: OrderStatus;
  reason: string;
  expectedVersion: number;
}) {
  const db = getDb();
  const order = await db.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw new NotFoundError("Order not found.");
  if (!params.reason || params.reason.trim().length < 3) {
    throw new ValidationError("A reason is required for an admin override.");
  }
  if (!isValidAdminOverride(order.status, params.targetStatus)) {
    throw new ValidationError("Target status must be different from the current status.");
  }
  if (order.version !== params.expectedVersion) {
    throw new ConflictError(
      "This order was already updated by another session. Please refresh to see the latest status."
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: order.id, version: params.expectedVersion },
      data: {
        status: params.targetStatus,
        version: { increment: 1 },
        rejectionReason: params.targetStatus === "REJECTED" ? params.reason : order.rejectionReason,
      },
    });
    if (result.count === 0) {
      throw new ConflictError(
        "This order was already updated by another session. Please refresh to see the latest status."
      );
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        status: params.targetStatus,
        changedById: params.adminUserId,
        changedByRole: "ADMIN",
        note: params.reason,
        isAdminOverride: true,
      },
    });
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
  });
  return updated;
}

export type OrderWithDetails = Awaited<ReturnType<typeof getOrderForCustomer>>;
