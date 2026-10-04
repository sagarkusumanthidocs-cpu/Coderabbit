import "server-only";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/api-errors";
import { Prisma } from "@prisma/client";

export async function listCities() {
  const db = getDb();
  return db.city.findMany({ orderBy: { name: "asc" } });
}

export async function listCategories() {
  const db = getDb();
  return db.category.findMany({ orderBy: { sortOrder: "asc" } });
}

const VISIBLE_STORE_FILTER = { moderationStatus: { not: "BLOCKED" as const } };
const VISIBLE_PRODUCT_FILTER = { isArchived: false, isAvailable: true };

export async function getHomeCatalogue(cityId: string) {
  const db = getDb();
  const [featured, stores, categories] = await Promise.all([
    db.product.findMany({
      where: { isFeatured: true, ...VISIBLE_PRODUCT_FILTER, store: { cityId, ...VISIBLE_STORE_FILTER } },
      include: { store: true, category: true },
      take: 8,
    }),
    db.store.findMany({
      where: { cityId, ...VISIBLE_STORE_FILTER },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    listCategories(),
  ]);
  return { featured, stores, categories };
}

export interface ProductListFilters {
  cityId: string;
  categorySlug?: string;
  query?: string;
  sort?: "newest" | "price_asc" | "price_desc";
}

export async function listProducts(filters: ProductListFilters) {
  const db = getDb();
  const where: Prisma.ProductWhereInput = {
    ...VISIBLE_PRODUCT_FILTER,
    store: { cityId: filters.cityId, ...VISIBLE_STORE_FILTER },
  };
  if (filters.categorySlug) {
    where.category = { slug: filters.categorySlug };
  }
  if (filters.query) {
    where.name = { contains: filters.query, mode: "insensitive" };
  }
  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
  if (filters.sort === "price_asc") orderBy = { price: "asc" };
  if (filters.sort === "price_desc") orderBy = { price: "desc" };

  return db.product.findMany({
    where,
    include: { store: true, category: true },
    orderBy,
  });
}

export async function getProductDetail(productId: string) {
  const db = getDb();
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { store: { include: { city: true } }, category: true },
  });
  if (!product || product.isArchived) throw new NotFoundError("Product not found.");
  return product;
}

export async function getStoreDetail(storeId: string) {
  const db = getDb();
  const store = await db.store.findUnique({
    where: { id: storeId },
    include: {
      category: true,
      city: true,
      products: { where: { isArchived: false }, include: { category: true } },
    },
  });
  if (!store || store.moderationStatus === "BLOCKED") throw new NotFoundError("Store not found.");
  return store;
}

export async function searchStores(filters: Pick<ProductListFilters, "cityId" | "query" | "categorySlug">) {
  const query = filters.query?.trim();
  if (!query) return [];
  return getDb().store.findMany({
    where: {
      cityId: filters.cityId,
      ...VISIBLE_STORE_FILTER,
      name: { contains: query, mode: "insensitive" },
      ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
    },
    include: { category: true, city: true },
    orderBy: { name: "asc" },
  });
}
