import { PrismaClient, Role, DeliveryOption, PaymentMethod } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "crypto";
import { promisify } from "util";
import { existsSync } from "fs";
import { seedDemoActivity } from "./seed-demo";
import { DELIVERY_FEES } from "../lib/constants";

// Load .env for local CLI runs (Next.js does this for the app, but tsx does not).
if (!process.env.DATABASE_URL && existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const scrypt = promisify(scryptCb);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Configure it before seeding (see .env.example)."
  );
  process.exit(1);
}

const db = new PrismaClient();

const DEMO_PASSWORD = "Demo@1234";
const LEGACY_PHOTO_IDS = [
  "1562690868-60bbe7293e94", "1578985545062-69928b1d9587", "1549465220-1a8b9238cd48",
  "1545165311-45a4959db418", "1520763185298-1b434c919102", "1562777717-dc6984f65a63",
  "1514228742587-6b1558fcca3d", "1459411621453-7b03977f4bfc", "1586788680434-30d324b2d46f",
];
const isLegacyPhoto = (url: string) => LEGACY_PHOTO_IDS.some((id) => url.startsWith(`https://images.unsplash.com/photo-${id}?`));

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

async function upsertUser(
  email: string,
  name: string,
  role: Role,
  phone?: string
) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, phone, passwordHash },
  });
}

async function main() {
  console.log("Seeding Giftly demo data...");

  // --- Users ---
  const customer = await upsertUser(
    "customer@giftapp.demo",
    "Ananya Rao",
    "CUSTOMER",
    "9876543210"
  );

  const customer2 = await upsertUser(
    "customer2@giftapp.demo",
    "Rohan Mehta",
    "CUSTOMER"
  );

  const admin = await upsertUser(
    "admin@giftapp.demo",
    "Giftly Admin",
    "ADMIN",
    "9988776655"
  );

  const petalsOwner = await upsertUser(
    "store@giftapp.demo",
    "Priya Nair",
    "STORE_OWNER",
    "9123456780"
  );

  const cakeCraftOwner = await upsertUser(
    "cakecraft@giftapp.demo",
    "Arjun Kumar",
    "STORE_OWNER"
  );

  const giftStudioOwner = await upsertUser(
    "giftstudio@giftapp.demo",
    "Sana Sheikh",
    "STORE_OWNER"
  );

  const bloomOwner = await upsertUser(
    "bloom@giftapp.demo",
    "Vikram Shetty",
    "STORE_OWNER"
  );

  const cakeCraftBlrOwner = await upsertUser(
    "cakecraft.blr@giftapp.demo",
    "Divya Iyer",
    "STORE_OWNER"
  );

  // Extra test account for cross-store access isolation testing.
  await upsertUser(
    "teststore2@giftapp.demo",
    "Shreya Hegde",
    "STORE_OWNER"
  );

  // --- Cities ---
  const hyderabad = await db.city.upsert({
    where: { name: "Hyderabad" },
    update: { isActive: true },
    create: { name: "Hyderabad", isActive: true },
  });

  const bengaluru = await db.city.upsert({
    where: { name: "Bengaluru" },
    update: { isActive: true },
    create: { name: "Bengaluru", isActive: true },
  });

  // --- Categories ---
  const categoryDefs = [
    { name: "Flowers", slug: "flowers", icon: "Flower2", sortOrder: 1 },
    { name: "Cakes", slug: "cakes", icon: "Cake", sortOrder: 2 },
    { name: "Hampers", slug: "hampers", icon: "Gift", sortOrder: 3 },
    { name: "Plants", slug: "plants", icon: "Leaf", sortOrder: 4 },
    {
      name: "Personalized",
      slug: "personalized",
      icon: "Sparkles",
      sortOrder: 5,
    },
  ];

  const categories: Record<
    string,
    Awaited<ReturnType<typeof db.category.upsert>>
  > = {};

  for (const c of categoryDefs) {
    categories[c.slug] = await db.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        icon: c.icon,
        sortOrder: c.sortOrder,
      },
      create: c,
    });
  }

  // --- Stores ---
  async function upsertStore(opts: {
    name: string;
    ownerUserId: string;
    categoryId: string;
    cityId: string;
    description: string;
    address: string;
    coverImage: string;
  }) {
    const existing = await db.store.findFirst({
      where: {
        ownerUserId: opts.ownerUserId,
        cityId: opts.cityId,
      },
    });

    if (existing) {
      return db.store.update({
        where: { id: existing.id },
        data: isLegacyPhoto(existing.coverImage) ? { coverImage: opts.coverImage } : {},
      });
    }

    return db.store.create({
      data: opts,
    });
  }

  const petals = await upsertStore({
    name: "Petals & Co.",
    ownerUserId: petalsOwner.id,
    categoryId: categories.flowers.id,
    cityId: hyderabad.id,
    description:
      "Fresh, handcrafted floral bouquets for every occasion.",
    address: "12 Jubilee Hills Road, Hyderabad",
    coverImage:
      "/images/demo/pink-roses.webp",
  });

  const cakeCraft = await upsertStore({
    name: "CakeCraft",
    ownerUserId: cakeCraftOwner.id,
    categoryId: categories.cakes.id,
    cityId: hyderabad.id,
    description:
      "Freshly baked cakes made with love, delivered same day.",
    address: "45 Banjara Hills, Hyderabad",
    coverImage:
      "/images/demo/chocolate-cake.webp",
  });

  const giftStudio = await upsertStore({
    name: "The Gift Studio",
    ownerUserId: giftStudioOwner.id,
    categoryId: categories.hampers.id,
    cityId: hyderabad.id,
    description:
      "Curated gift hampers and personalized keepsakes.",
    address: "9 Madhapur Main Road, Hyderabad",
    coverImage:
      "/images/demo/gift-box.webp",
  });

  const bloom = await upsertStore({
    name: "Bloom & Co.",
    ownerUserId: bloomOwner.id,
    categoryId: categories.plants.id,
    cityId: hyderabad.id,
    description:
      "Indoor plants and succulents to brighten any space.",
    address: "3 Gachibowli Circle, Hyderabad",
    coverImage:
      "/images/demo/houseplants.webp",
  });

  const cakeCraftBlr = await upsertStore({
    name: "CakeCraft",
    ownerUserId: cakeCraftBlrOwner.id,
    categoryId: categories.cakes.id,
    cityId: bengaluru.id,
    description:
      "Bengaluru's favourite same-day cake delivery.",
    address: "22 Indiranagar 100ft Road, Bengaluru",
    coverImage:
      "/images/demo/chocolate-cake.webp",
  });

  // --- Products ---
  async function upsertProduct(opts: {
    storeId: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    isFeatured?: boolean;
  }) {
    const existing = await db.product.findFirst({
      where: {
        storeId: opts.storeId,
        name: opts.name === "Bengaluru Red Velvet Cake" ? { in: [opts.name, "Bengaluru Butterscotch Cake"] } : opts.name,
      },
    });

    const data = {
      storeId: opts.storeId,
      categoryId: opts.categoryId,
      name: opts.name,
      description: opts.description,
      price: opts.price,
      imageUrl: opts.imageUrl,
      isFeatured: opts.isFeatured ?? false,
      isAvailable: true,
      isArchived: false,
    };

    if (existing) {
      return db.product.update({
        where: { id: existing.id },
        data: {
          ...(isLegacyPhoto(existing.imageUrl) ? { imageUrl: opts.imageUrl } : {}),
          ...(existing.name === "Bengaluru Butterscotch Cake" ? { name: opts.name, description: opts.description } : {}),
        },
      });
    }

    return db.product.create({
      data,
    });
  }

  const blushBouquet = await upsertProduct({
    storeId: petals.id,
    categoryId: categories.flowers.id,
    name: "Blush Love Bouquet",
    description:
      "A romantic blend of pink roses and blush carnations, hand-tied with love.",
    price: 1499,
    imageUrl:
      "/images/demo/pink-roses.webp",
    isFeatured: true,
  });

  await upsertProduct({
    storeId: petals.id,
    categoryId: categories.flowers.id,
    name: "Sunshine Tulip Bunch",
    description:
      "Bright, cheerful tulips to brighten anyone's day.",
    price: 1199,
    imageUrl:
      "/images/demo/yellow-tulips.webp",
  });

  const chocolateCake = await upsertProduct({
    storeId: cakeCraft.id,
    categoryId: categories.cakes.id,
    name: "Chocolate Cake",
    description:
      "Rich, moist chocolate sponge layered with Belgian ganache.",
    price: 899,
    imageUrl:
      "/images/demo/chocolate-cake.webp",
    isFeatured: true,
  });

  await upsertProduct({
    storeId: cakeCraft.id,
    categoryId: categories.cakes.id,
    name: "Red Velvet Cake",
    description:
      "Classic red velvet with cream cheese frosting.",
    price: 1099,
    imageUrl:
      "/images/demo/red-velvet-cake.webp",
  });

  const giftHamper = await upsertProduct({
    storeId: giftStudio.id,
    categoryId: categories.hampers.id,
    name: "Gift Hamper",
    description:
      "A curated hamper of chocolates, candles, and treats.",
    price: 2499,
    imageUrl:
      "/images/demo/gift-box.webp",
    isFeatured: true,
  });

  await upsertProduct({
    storeId: giftStudio.id,
    categoryId: categories.personalized.id,
    name: "Personalized Mug",
    description:
      "A custom-printed mug with a name or message of your choice.",
    price: 599,
    imageUrl:
      "/images/demo/white-mug.webp",
    isFeatured: true,
  });

  await upsertProduct({
    storeId: bloom.id,
    categoryId: categories.plants.id,
    name: "Indoor Plant",
    description:
      "A low-maintenance indoor plant in a decorative pot.",
    price: 699,
    imageUrl:
      "/images/demo/houseplants.webp",
    isFeatured: true,
  });

  await upsertProduct({
    storeId: bloom.id,
    categoryId: categories.plants.id,
    name: "Succulent Trio",
    description:
      "Three charming succulents, perfect for any desk or windowsill.",
    price: 549,
    imageUrl:
      "/images/demo/succulents.webp",
  });

  const blrCake = await upsertProduct({
    storeId: cakeCraftBlr.id,
    categoryId: categories.cakes.id,
    name: "Bengaluru Red Velvet Cake",
    description:
      "A celebration-ready red velvet cake layered with cream cheese frosting.",
    price: 949,
    imageUrl:
      "/images/demo/red-velvet-cake.webp",
    isFeatured: true,
  });

  // --- Orders (idempotent via unique orderCode) ---
  async function upsertOrder(opts: {
    orderCode: string;
    customerId: string;
    product: {
      id: string;
      name: string;
      price: number;
      storeId: string;
    };
    storeId: string;
    cityId: string;
    status:
      | "ORDER_PLACED"
      | "STORE_ACCEPTED"
      | "PREPARING_GIFT"
      | "READY_FOR_PICKUP"
      | "OUT_FOR_DELIVERY"
      | "DELIVERED"
      | "REJECTED";
    placedAt: Date;
    history: {
      status: string;
      changedAt: Date;
      changedByRole: Role;
      note?: string;
    }[];
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    senderName: string;
    occasion: string;
    giftMessage?: string;
    deliveryOption: DeliveryOption;
    paymentMethod: PaymentMethod;
    rejectionReason?: string;
  }) {
    const existing = await db.order.findUnique({
      where: { orderCode: opts.orderCode },
    });

    if (existing) {
      console.log(
        `  order ${opts.orderCode} already exists, skipping`
      );
      return existing;
    }

    const subtotal = opts.product.price * 1;
    const deliveryFee = DELIVERY_FEES[opts.deliveryOption];
    const total = subtotal + deliveryFee;

    const order = await db.order.create({
      data: {
        orderCode: opts.orderCode,
        customerId: opts.customerId,
        storeId: opts.storeId,
        cityId: opts.cityId,
        status: opts.status as any,
        recipientName: opts.recipientName,
        recipientPhone: opts.recipientPhone,
        deliveryAddress: opts.deliveryAddress,
        senderName: opts.senderName,
        occasion: opts.occasion,
        giftMessage: opts.giftMessage,
        deliveryOption: opts.deliveryOption,
        ...(opts.deliveryOption === "SCHEDULED" ? { deliveryDate: new Date(opts.placedAt.getTime() + 86400000), deliverySlot: "EVENING" as const } : {}),
        paymentMethod: opts.paymentMethod,
        subtotal,
        deliveryFee,
        total,
        rejectionReason: opts.rejectionReason,
        idempotencyKey: `seed-${opts.orderCode}`,
        placedAt: opts.placedAt,
        items: {
          create: [
            {
              productId: opts.product.id,
              productName: opts.product.name,
              unitPrice: opts.product.price,
              quantity: 1,
              lineTotal: opts.product.price,
            },
          ],
        },
        statusHistory: {
          create: opts.history.map((h, i) => ({
            previousStatus:
              i === 0
                ? null
                : (opts.history[i - 1].status as any),
            status: h.status as any,
            changedByRole: h.changedByRole,
            note: h.note,
            changedAt: h.changedAt,
            isAdminOverride: false,
          })),
        },
      },
    });

    console.log(`  created order ${opts.orderCode}`);
    return order;
  }

  await upsertOrder({
    orderCode: "GF-1001",
    customerId: customer.id,
    product: {
      id: chocolateCake.id,
      name: chocolateCake.name,
      price: Number(chocolateCake.price),
      storeId: cakeCraft.id,
    },
    storeId: cakeCraft.id,
    cityId: hyderabad.id,
    status: "DELIVERED",
    placedAt: daysAgo(3),
    history: [
      {
        status: "ORDER_PLACED",
        changedAt: daysAgo(3),
        changedByRole: "CUSTOMER",
      },
      {
        status: "STORE_ACCEPTED",
        changedAt: hoursAgo(70),
        changedByRole: "STORE_OWNER",
      },
      {
        status: "PREPARING_GIFT",
        changedAt: hoursAgo(60),
        changedByRole: "STORE_OWNER",
      },
      {
        status: "READY_FOR_PICKUP",
        changedAt: hoursAgo(50),
        changedByRole: "STORE_OWNER",
      },
      {
        status: "OUT_FOR_DELIVERY",
        changedAt: hoursAgo(40),
        changedByRole: "STORE_OWNER",
      },
      {
        status: "DELIVERED",
        changedAt: hoursAgo(36),
        changedByRole: "STORE_OWNER",
      },
    ],
    recipientName: "Kavya Reddy",
    recipientPhone: "9876543210",
    deliveryAddress:
      "Flat 302, Lotus Residency, Kondapur",
    senderName: customer.name,
    occasion: "Birthday",
    giftMessage:
      "Happy birthday! Hope your day is as sweet as this cake.",
    deliveryOption: "STANDARD",
    paymentMethod: "CARD_MOCK",
  });

  await upsertOrder({
    orderCode: "GF-1002",
    customerId: customer.id,
    product: {
      id: blushBouquet.id,
      name: blushBouquet.name,
      price: Number(blushBouquet.price),
      storeId: petals.id,
    },
    storeId: petals.id,
    cityId: hyderabad.id,
    status: "PREPARING_GIFT",
    placedAt: hoursAgo(20),
    history: [
      {
        status: "ORDER_PLACED",
        changedAt: hoursAgo(20),
        changedByRole: "CUSTOMER",
      },
      {
        status: "STORE_ACCEPTED",
        changedAt: hoursAgo(18),
        changedByRole: "STORE_OWNER",
      },
      {
        status: "PREPARING_GIFT",
        changedAt: hoursAgo(10),
        changedByRole: "STORE_OWNER",
      },
    ],
    recipientName: "Meera Iyer",
    recipientPhone: "9123456780",
    deliveryAddress:
      "12 Park View Apartments, Banjara Hills",
    senderName: customer.name,
    occasion: "Anniversary",
    giftMessage: "Happy anniversary, my love!",
    deliveryOption: "EXPRESS",
    paymentMethod: "UPI_MOCK",
  });

  await upsertOrder({
    orderCode: "GF-1003",
    customerId: customer.id,
    product: {
      id: giftHamper.id,
      name: giftHamper.name,
      price: Number(giftHamper.price),
      storeId: giftStudio.id,
    },
    storeId: giftStudio.id,
    cityId: hyderabad.id,
    status: "ORDER_PLACED",
    placedAt: hoursAgo(2),
    history: [
      {
        status: "ORDER_PLACED",
        changedAt: hoursAgo(2),
        changedByRole: "CUSTOMER",
      },
    ],
    recipientName: "Rahul Varma",
    recipientPhone: "9988776655",
    deliveryAddress:
      "7 Lake View Colony, Madhapur",
    senderName: customer.name,
    occasion: "Thank you",
    deliveryOption: "STANDARD",
    paymentMethod: "CARD_MOCK",
  });

  // A pending Petals & Co. order actionable by store@giftapp.demo.
  await upsertOrder({
    orderCode: "GF-1004",
    customerId: customer2.id,
    product: {
      id: blushBouquet.id,
      name: blushBouquet.name,
      price: Number(blushBouquet.price),
      storeId: petals.id,
    },
    storeId: petals.id,
    cityId: hyderabad.id,
    status: "ORDER_PLACED",
    placedAt: hoursAgo(1),
    history: [
      {
        status: "ORDER_PLACED",
        changedAt: hoursAgo(1),
        changedByRole: "CUSTOMER",
      },
    ],
    recipientName: "Neha Agarwal",
    recipientPhone: "9000011122",
    deliveryAddress:
      "15 Rose Garden Lane, Jubilee Hills",
    senderName: customer2.name,
    occasion: "Congratulations",
    deliveryOption: "SCHEDULED",
    paymentMethod: "CARD_MOCK",
  });

  // A Rejected order with reason.
  await upsertOrder({
    orderCode: "GF-1005",
    customerId: customer.id,
    product: {
      id: blrCake.id,
      name: blrCake.name,
      price: Number(blrCake.price),
      storeId: cakeCraftBlr.id,
    },
    storeId: cakeCraftBlr.id,
    cityId: bengaluru.id,
    status: "REJECTED",
    placedAt: daysAgo(1),
    history: [
      {
        status: "ORDER_PLACED",
        changedAt: daysAgo(1),
        changedByRole: "CUSTOMER",
      },
      {
        status: "REJECTED",
        changedAt: hoursAgo(22),
        changedByRole: "STORE_OWNER",
        note: "Out of stock for same-day delivery.",
      },
    ],
    recipientName: "Karthik Rao",
    recipientPhone: "9345678901",
    deliveryAddress:
      "88 MG Road, Bengaluru",
    senderName: customer.name,
    occasion: "Just because",
    deliveryOption: "STANDARD",
    paymentMethod: "CARD_MOCK",
    rejectionReason:
      "Out of stock for same-day delivery.",
  });

  // An Out for Delivery order.
  await upsertOrder({
    orderCode: "GF-1006",
    customerId: customer2.id,
    product: {
      id: chocolateCake.id,
      name: chocolateCake.name,
      price: Number(chocolateCake.price),
      storeId: cakeCraft.id,
    },
    storeId: cakeCraft.id,
    cityId: hyderabad.id,
    status: "OUT_FOR_DELIVERY",
    placedAt: hoursAgo(6),
    history: [
      {
        status: "ORDER_PLACED",
        changedAt: hoursAgo(6),
        changedByRole: "CUSTOMER",
      },
      {
        status: "STORE_ACCEPTED",
        changedAt: hoursAgo(5),
        changedByRole: "STORE_OWNER",
      },
      {
        status: "PREPARING_GIFT",
        changedAt: hoursAgo(4),
        changedByRole: "STORE_OWNER",
      },
      {
        status: "READY_FOR_PICKUP",
        changedAt: hoursAgo(2),
        changedByRole: "STORE_OWNER",
      },
      {
        status: "OUT_FOR_DELIVERY",
        changedAt: hoursAgo(1),
        changedByRole: "STORE_OWNER",
      },
    ],
    recipientName: "Sneha Pillai",
    recipientPhone: "9765432109",
    deliveryAddress:
      "21 Film Nagar, Hyderabad",
    senderName: customer2.name,
    occasion: "Birthday",
    deliveryOption: "EXPRESS",
    paymentMethod: "UPI_MOCK",
  });

  await seedDemoActivity(db, await hashPassword(DEMO_PASSWORD));

  console.log("Seeding complete.");
  console.log("");
  console.log(
    "Demo accounts (password for all: Demo@1234):"
  );
  console.log(
    "  Customer:     customer@giftapp.demo"
  );
  console.log(
    "  Customer 2:   customer2@giftapp.demo"
  );
  console.log(
    "  Store Owner:  store@giftapp.demo (Petals & Co.)"
  );
  console.log(
    "  Store Owner:  cakecraft@giftapp.demo (CakeCraft, Hyderabad)"
  );
  console.log(
    "  Store Owner:  giftstudio@giftapp.demo (The Gift Studio)"
  );
  console.log(
    "  Store Owner:  bloom@giftapp.demo (Bloom & Co.)"
  );
  console.log(
    "  Store Owner:  cakecraft.blr@giftapp.demo (CakeCraft, Bengaluru)"
  );
  console.log("  Store Owner:  teststore2@giftapp.demo (Petals Bengaluru)");
  console.log("  Store Owner:  customcreations@giftapp.demo (Custom Creations)");
  console.log("  Store Owner:  greenthumb@giftapp.demo (Green Thumb Nursery)");
  console.log(
    "  Admin:        admin@giftapp.demo"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
