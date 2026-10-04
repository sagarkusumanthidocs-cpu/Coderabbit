import "server-only";
import { splitGroupGiftAmount } from "@/lib/groupGiftSplit";
import { getDb } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/api-errors";
import { ForbiddenError } from "@/lib/session";
import type { groupGiftSchema } from "@/lib/validation";
import type { z } from "zod";
import { Prisma } from "@prisma/client";

type GroupGiftInput = z.infer<typeof groupGiftSchema>;

export async function listGroupGiftsForUser(userId: string) {
  const db = getDb();
  const groupGifts = await db.groupGift.findMany({
    where: { createdById: userId },
    include: { contributors: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
  return groupGifts.map(decorate);
}

export async function getGroupGift(userId: string, groupGiftId: string) {
  const db = getDb();
  const gg = await db.groupGift.findUnique({
    where: { id: groupGiftId },
    include: { contributors: true, items: { include: { product: { include: { store: true } } } }, city: true },
  });
  if (!gg) throw new NotFoundError("This group gift could not be found.");
  if (gg.createdById !== userId) throw new ForbiddenError("You cannot view another user's group gift.");
  return decorate(gg);
}

/** Every product referenced must exist; validates server-side rather than trusting the client's price list. */
export async function createGroupGift(userId: string, input: GroupGiftInput) {
  const db = getDb();

  const products = await db.product.findMany({ where: { id: { in: input.productIds } } });
  if (products.length !== input.productIds.length) {
    throw new ValidationError("One or more selected gifts could not be found.");
  }

  if (products.some((product) => product.isArchived || !product.isAvailable)) {
    throw new ValidationError("One or more selected gifts are no longer available.");
  }
  const stores = await db.store.findMany({ where: { id: { in: products.map((p) => p.storeId) } } });
  if (stores.some((store) => store.cityId !== input.cityId || store.moderationStatus === "BLOCKED")) {
    throw new ValidationError("Choose gifts available in the selected delivery city.");
  }
  const equalShares = splitGroupGiftAmount(input.goalAmount, input.contributors.length);
  if (input.splitType === "EQUAL" && equalShares.some((share) => share <= 0)) {
    throw new ValidationError("The goal must allow at least one paise per contributor.");
  }

  const gg = await db.groupGift.create({
    data: {
      createdById: userId,
      title: `${input.recipientName}'s ${titleCase(input.occasionType)}`,
      occasionType: input.occasionType,
      recipientName: input.recipientName,
      cityId: input.cityId,
      deliveryDate: new Date(input.deliveryDate),
      goalAmount: new Prisma.Decimal(input.goalAmount),
      splitType: input.splitType,
      message: input.message || null,
      items: { create: input.productIds.map((productId) => ({ productId })) },
      contributors: {
        create: input.contributors.map((c, i) => ({
          name: c.name,
          amount: new Prisma.Decimal(input.splitType === "EQUAL" ? equalShares[i] : c.amount),
          paid: i === 0, // the creator is recorded as having already contributed their share
        })),
      },
    },
    include: { contributors: true, items: { include: { product: true } } },
  });
  return decorate(gg);
}

export async function markContributorPaid(userId: string, groupGiftId: string, contributorId: string) {
  const db = getDb();
  const gg = await db.groupGift.findUnique({ where: { id: groupGiftId } });
  if (!gg) throw new NotFoundError("This group gift could not be found.");
  if (gg.createdById !== userId) throw new ForbiddenError("You cannot edit another user's group gift.");

  const contributor = await db.groupGiftContributor.findUnique({ where: { id: contributorId } });
  if (!contributor || contributor.groupGiftId !== groupGiftId) {
    throw new NotFoundError("This contributor could not be found.");
  }
  await db.groupGiftContributor.update({ where: { id: contributorId }, data: { paid: true } });
  return getGroupGift(userId, groupGiftId);
}

export async function deleteGroupGift(userId: string, groupGiftId: string) {
  const db = getDb();
  const gg = await db.groupGift.findUnique({ where: { id: groupGiftId } });
  if (!gg) throw new NotFoundError("This group gift could not be found.");
  if (gg.createdById !== userId) throw new ForbiddenError("You cannot delete another user's group gift.");

  await db.$transaction([
    db.groupGiftContributor.deleteMany({ where: { groupGiftId } }),
    db.groupGiftItem.deleteMany({ where: { groupGiftId } }),
    db.groupGift.delete({ where: { id: groupGiftId } }),
  ]);
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Adds the derived, always-computed-server-side fields the UI needs: never trust a stored "collected" total. */
function decorate<T extends { contributors: { amount: Prisma.Decimal; paid: boolean }[]; goalAmount: Prisma.Decimal }>(gg: T) {
  const collected = gg.contributors.filter((c) => c.paid).reduce((s, c) => s.add(c.amount), new Prisma.Decimal(0)).toNumber();
  const goal = Number(gg.goalAmount);
  return {
    ...gg,
    collectedAmount: collected,
    percentFunded: goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0,
    isFullyFunded: collected >= goal,
  };
}

/** Prepare the primary store's gifts together, as in the prototype's one-store checkout. */
export async function prepareGroupGiftCart(userId: string, groupGiftId: string, allowPartial: boolean) {
  const db = getDb();
  const gift = await getGroupGift(userId, groupGiftId);
  if (!gift.isFullyFunded) throw new ValidationError("Collect all contributions before placing the order.");
  const storeId = gift.items[0]?.product.storeId;
  const items = gift.items.filter((item) => item.product.storeId === storeId);
  if (!items.length) throw new ValidationError("Choose a gift before placing the order.");
  if (items.length !== gift.items.length && !allowPartial) {
    throw new ValidationError("Confirm that you want to order gifts from one store at a time.");
  }
  if (items.some(({ product }) => product.isArchived || !product.isAvailable || !product.store.isOpen || product.store.moderationStatus === "BLOCKED")) {
    throw new ValidationError("Some gifts or their store are no longer available. Your cart has not been changed.");
  }
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    await tx.cartItem.deleteMany({ where: { customerId: userId } });
    await tx.cartItem.createMany({ data: items.map(({ productId }) => ({ customerId: userId, productId, quantity: 1 })) });
  });
}
