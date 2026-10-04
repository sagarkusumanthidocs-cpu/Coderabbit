import "server-only";
import { getDb } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { Prisma } from "@prisma/client";

const CART_INCLUDE = {
  product: { include: { store: { include: { city: true } } } },
} satisfies Prisma.CartItemInclude;

type CartItemWithProduct = Prisma.CartItemGetPayload<{ include: typeof CART_INCLUDE }>;

export async function getCart(customerId: string) {
  const db = getDb();
  const items = await db.cartItem.findMany({
    where: { customerId },
    include: CART_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  const storeId = items[0]?.product.storeId ?? null;
  const subtotal = items.reduce(
    (sum: Prisma.Decimal, it: CartItemWithProduct) => sum.add(it.product.price.mul(it.quantity)),
    new Prisma.Decimal(0)
  );
  return { items, storeId, subtotal };
}

/**
 * Adds a product to the customer's cart. Enforces the single-store-per-cart
 * rule: if the cart already has items from a different store, this throws a
 * ConflictError rather than silently mixing stores into one order - the
 * caller (UI) must obtain confirmation before retrying with replaceExisting.
 */
export async function addToCart(customerId: string, productId: string, quantity: number, replaceExisting = false) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    // Serialize additions for a customer, including simultaneous requests into an empty cart.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${customerId} FOR UPDATE`;
    const product = await tx.product.findUnique({ where: { id: productId }, include: { store: { include: { city: true } } } });
    if (!product) throw new NotFoundError("This product could not be found.");
    if (product.isArchived || !product.isAvailable) throw new ValidationError("This product is no longer available.");
    if (!product.store.isOpen || product.store.moderationStatus === "BLOCKED") throw new ValidationError("This store is not accepting orders right now.");

    const existingItems = await tx.cartItem.findMany({ where: { customerId }, include: { product: true } });
    const differentStore = existingItems.some((item) => item.product.storeId !== product.storeId);
    if (differentStore && !replaceExisting) {
      throw new ConflictError("Your cart already has gifts from another store. Would you like to clear the cart and add this item instead?");
    }
    // Validation and replacement share a transaction, so a failed addition keeps the old cart.
    if (differentStore) await tx.cartItem.deleteMany({ where: { customerId } });
    const existing = differentStore ? undefined : existingItems.find((item) => item.productId === productId);
    const newQuantity = Math.min(10, (existing?.quantity ?? 0) + quantity);
    return tx.cartItem.upsert({
      where: { customerId_productId: { customerId, productId } },
      update: { quantity: newQuantity },
      create: { customerId, productId, quantity: Math.min(10, quantity) },
      include: CART_INCLUDE,
    });
  });
}

export async function updateCartItemQuantity(customerId: string, productId: string, quantity: number) {
  const db = getDb();
  const item = await db.cartItem.findUnique({ where: { customerId_productId: { customerId, productId } } });
  if (!item) throw new NotFoundError("This item is not in your cart.");

  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    return null;
  }
  return db.cartItem.update({
    where: { id: item.id },
    data: { quantity: Math.min(10, quantity) },
    include: CART_INCLUDE,
  });
}

export async function removeCartItem(customerId: string, productId: string) {
  const db = getDb();
  await db.cartItem.deleteMany({ where: { customerId, productId } });
}

export async function clearCart(customerId: string) {
  const db = getDb();
  await db.cartItem.deleteMany({ where: { customerId } });
}
