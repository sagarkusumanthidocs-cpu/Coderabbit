import "server-only";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/api-errors";
import { ModerationStatus, Prisma } from "@prisma/client";

export async function getAdminDashboard(cityId?: string) {
  const db = getDb();
  const [totalStores, totalProducts, totalOrders, byStatus, deliveredAgg, recentOrders] = await Promise.all([
    db.store.count(),
    db.product.count({ where: { isArchived: false } }),
    db.order.count(),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.aggregate({ where: { status: "DELIVERED" }, _sum: { total: true } }),
    db.order.findMany({ orderBy: { placedAt: "desc" }, take: 8, include: { store: true, city: true } }),
  ]);
  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row.status] = row._count._all;
  return {
    totalStores,
    totalProducts,
    totalOrders,
    statusCounts,
    mockDeliveredValue: deliveredAgg._sum.total ?? 0,
    recentOrders,
    ...(await getAdminOverview(cityId)),
  };
}

async function getAdminOverview(cityId?: string) {
  const db = getDb();
  const storeWhere = cityId ? { cityId } : {};
  const [cities, stores, orders] = await Promise.all([
    db.city.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { stores: true } } } }),
    db.store.findMany({ where: storeWhere, select: { id: true, isOpen: true } }),
    db.order.findMany({ where: cityId ? { store: { cityId } } : {}, select: { placedAt: true, status: true, total: true } }),
  ]);
  return {
    cities: cities.map((c) => ({ id: c.id, name: c.name, storeCount: c._count.stores })),
    scope: { storeCount: stores.length, openStores: stores.filter((s) => s.isOpen).length },
    orders,
  };
}

export async function getReturnsAnalytics() {
  const db = getDb();
  const [totalOrders, rejected, byStore, stores] = await Promise.all([
    db.order.count(),
    db.order.findMany({ where: { status: "REJECTED" }, select: { placedAt: true, rejectionReason: true, storeId: true } }),
    db.order.groupBy({ by: ["storeId"], _count: { _all: true } }),
    db.store.findMany({ select: { id: true, name: true, city: { select: { name: true } } } }),
  ]);
  const reasonCounts = new Map<string, number>();
  const rejectedByStore = new Map<string, number>();
  for (const o of rejected) {
    const reason = o.rejectionReason?.trim() || "Unspecified";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    rejectedByStore.set(o.storeId, (rejectedByStore.get(o.storeId) ?? 0) + 1);
  }
  const totalByStore = new Map(byStore.map((s) => [s.storeId, s._count._all]));
  const storeRows = stores
    .map((s) => {
      const total = totalByStore.get(s.id) ?? 0;
      const count = rejectedByStore.get(s.id) ?? 0;
      return { id: s.id, name: s.name, city: s.city.name, total, count, pct: total ? (count / total) * 100 : 0 };
    })
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
  return {
    totalOrders,
    rejectedCount: rejected.length,
    rejectedDates: rejected.map((o) => o.placedAt),
    reasons: [...reasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    stores: storeRows,
  };
}

export async function listAllStores(filters: { cityId?: string; categoryId?: string } = {}) {
  const db = getDb();
  return db.store.findMany({
    where: { cityId: filters.cityId, categoryId: filters.categoryId },
    include: { city: true, category: true, owner: { select: { name: true, email: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getStoreDetail(storeId: string) {
  const db = getDb();
  const store = await db.store.findUnique({ where: { id: storeId }, include: { city: true, category: true, owner: true } });
  if (!store) throw new NotFoundError("This store could not be found.");

  const orders = await db.order.findMany({ where: { storeId } });
  const active = orders.filter((o) => !["DELIVERED", "REJECTED"].includes(o.status)).length;
  const completed = orders.filter((o) => o.status === "DELIVERED").length;
  const rejected = orders.filter((o) => o.status === "REJECTED").length;
  const revenue = orders.filter((o) => o.status === "DELIVERED").reduce((s, o) => s + Number(o.total), 0);
  const productCount = await db.product.count({ where: { storeId, isArchived: false } });

  return {
    store,
    stats: {
      activeOrders: active,
      completedOrders: completed,
      returnPercent: orders.length ? Math.round((rejected / orders.length) * 1000) / 10 : 0,
      revenue,
      productCount,
    },
  };
}

export async function setStoreOpen(storeId: string, isOpen: boolean) {
  const db = getDb();
  return db.store.update({ where: { id: storeId }, data: { isOpen } });
}

export async function getProductDetail(productId: string) {
  const db = getDb();
  const product = await db.product.findUnique({ where: { id: productId }, include: { store: true, category: true } });
  if (!product) throw new NotFoundError("This product could not be found.");

  const orderItems = await db.orderItem.findMany({ where: { productId }, include: { order: true } });
  const deliveredItems = orderItems.filter((it) => it.order.status === "DELIVERED");
  const distinctOrders = new Set(orderItems.map((it) => it.orderId));
  const unitsDelivered = deliveredItems.reduce((s, it) => s + it.quantity, 0);
  const revenue = deliveredItems.reduce((s, it) => s + Number(it.lineTotal), 0);

  return {
    product,
    stats: {
      timesOrdered: distinctOrders.size,
      unitsDelivered,
      revenue,
    },
  };
}

export async function updateProductDetails(productId: string, data: { name: string; description: string; price: number; isFeatured: boolean }) {
  const db = getDb();
  return db.product.update({ where: { id: productId }, data: { ...data, price: new Prisma.Decimal(data.price) } });
}

export async function setProductAvailability(productId: string, isAvailable: boolean) {
  const db = getDb();
  return db.product.update({ where: { id: productId }, data: { isAvailable } });
}

export async function setProductFeatured(productId: string, isFeatured: boolean) {
  const db = getDb();
  return db.product.update({ where: { id: productId }, data: { isFeatured } });
}

export async function setStoreModeration(storeId: string, status: ModerationStatus) {
  const db = getDb();
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) throw new NotFoundError("Store not found.");
  // Blocking prevents new orders/catalogue visibility (enforced in catalogue + order
  // creation services) but never cancels existing orders.
  return db.store.update({ where: { id: storeId }, data: { moderationStatus: status } });
}

export async function listAllProducts(filters: { storeId?: string; cityId?: string; categoryId?: string; availableOnly?: boolean } = {}) {
  const db = getDb();
  return db.product.findMany({
    where: {
      storeId: filters.storeId,
      categoryId: filters.categoryId,
      isAvailable: filters.availableOnly ? true : undefined,
      store: filters.cityId ? { cityId: filters.cityId } : undefined,
    },
    include: { store: { include: { city: true } }, category: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllUsers() {
  const db = getDb();
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      stores: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return users;
}

export async function getBasicReports() {
  const db = getDb();
  const [byCity, byStore, byStatus, popularProducts] = await Promise.all([
    db.order.groupBy({ by: ["cityId"], _count: { _all: true } }),
    db.order.groupBy({ by: ["storeId"], _count: { _all: true } }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.orderItem.groupBy({ by: ["productId", "productName"], _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
  ]);
  const [cities, stores] = await Promise.all([
    db.city.findMany({ where: { id: { in: byCity.map((c) => c.cityId) } } }),
    db.store.findMany({ where: { id: { in: byStore.map((s) => s.storeId) } } }),
  ]);
  const cityNameById = new Map(cities.map((c) => [c.id, c.name]));
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  return {
    byCity: byCity.map((c) => ({ city: cityNameById.get(c.cityId) ?? "Unknown", count: c._count._all })),
    byStore: byStore.map((s) => ({ store: storeNameById.get(s.storeId) ?? "Unknown", count: s._count._all })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    popularProducts: popularProducts.map((p) => ({ name: p.productName, quantity: p._sum.quantity ?? 0 })),
  };
}
