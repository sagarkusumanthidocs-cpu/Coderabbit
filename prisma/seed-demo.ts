import { Prisma, PrismaClient, OrderStatus, OccasionType } from "@prisma/client";
import { DELIVERY_FEES } from "../lib/constants";
import { splitGroupGiftAmount } from "../lib/groupGiftSplit";

const image = (name: string) => `/images/demo/${name}.webp`;
const daysFrom = (now: Date, days: number) => new Date(now.getTime() + days * 86400000);

// Names and local photo choices follow public/prototype.html. Stable IDs make reruns additive.
const extraStores = [
  { key: "petals-blr", name: "Petals Bengaluru", email: "teststore2@giftapp.demo", owner: "Shreya Hegde", city: "Bengaluru", category: "flowers", photo: "pink-roses", address: "18 Blossom Lane, Indiranagar", description: "Hand-tied roses and seasonal tulips, wrapped fresh for every celebration." },
  { key: "custom-creations", name: "Custom Creations", email: "customcreations@giftapp.demo", owner: "Farhan Ali", city: "Hyderabad", category: "personalized", photo: "white-mug", address: "28 Studio Lane, Madhapur", description: "Thoughtful mugs and keepsakes personalized with your favourite names and messages." },
  { key: "green-thumb", name: "Green Thumb Nursery", email: "greenthumb@giftapp.demo", owner: "Deepika Reddy", city: "Bengaluru", category: "plants", photo: "houseplants", address: "14 Garden Avenue, Koramangala", description: "Easy-care houseplants and desk-sized succulents, with a care card in every gift." },
];

const catalogue: Record<string, { name: string; price: number; photo: string; description: string }[]> = {
  flowers: [
    { name: "Classic Red Roses", price: 1299, photo: "red-roses", description: "A dozen fresh red roses with seasonal foliage and a handwritten greeting card." },
    { name: "Blush Rose Posy", price: 899, photo: "pink-roses", description: "Six soft pink roses in a compact hand-tied posy, finished with satin ribbon." },
    { name: "Sunshine Tulip Wrap", price: 1199, photo: "yellow-tulips", description: "A cheerful bunch of yellow tulips, wrapped in kraft paper for a bright surprise." },
    { name: "Pink Rose Celebration Bouquet", price: 1799, photo: "pink-roses", description: "Two dozen blush roses, gift-wrapped with a matching occasion card." },
  ],
  cakes: [
    { name: "Chocolate Truffle Cake", price: 1199, photo: "chocolate-cake", description: "A 1 kg chocolate celebration cake with silky ganache, chocolate curls and piped rosettes." },
    { name: "Red Velvet Celebration Cake", price: 1299, photo: "red-velvet-cake", description: "A 1 kg red velvet cake with smooth cream cheese frosting. Serves 8–10." },
    { name: "Red Velvet Cupcakes — Box of 6", price: 649, photo: "red-velvet-cupcakes", description: "Six red velvet cupcakes topped with cream cheese swirls, packed in a gift box." },
    { name: "Mini Chocolate Celebration Cake", price: 799, photo: "chocolate-cake", description: "A 500 g chocolate cake for small celebrations, finished with ganache and chocolate shavings." },
  ],
  hampers: [
    { name: "Breakfast Gift Basket", price: 1899, photo: "breakfast-hamper", description: "A wicker basket of breakfast treats, fruit juice and preserves for a relaxed morning." },
    { name: "Weekend Brunch Hamper", price: 2499, photo: "breakfast-hamper", description: "Shareable breakfast favourites and pantry treats arranged in a reusable wicker basket." },
    { name: "Celebration Gift Box", price: 1599, photo: "gift-box", description: "A ribbon-wrapped surprise box of sweet treats with your personal greeting tucked inside." },
    { name: "Thank You Treat Box", price: 999, photo: "gift-box", description: "A thoughtful assortment of treats, wrapped and ready to say a heartfelt thank you." },
  ],
  personalized: [
    { name: "Name Mug", price: 599, photo: "white-mug", description: "A white ceramic mug customized with a name. Add your wording in the gift message." },
    { name: "Message Mug", price: 649, photo: "white-mug", description: "A 350 ml ceramic mug with your favourite quote or greeting. Hand-wash recommended." },
    { name: "Birthday Keepsake Box", price: 1299, photo: "gift-box", description: "A keepsake gift box finished with a personalized birthday card and ribbon." },
    { name: "Anniversary Memory Box", price: 1799, photo: "gift-box", description: "A beautiful gift box for treasured mementos, with a personalized anniversary greeting." },
  ],
  plants: [
    { name: "Calathea in a Woven Planter", price: 999, photo: "houseplants", description: "A leafy calathea in a woven cover pot. Enjoys indirect light; includes a care guide." },
    { name: "Succulent Desk Garden", price: 749, photo: "succulents", description: "A compact arrangement of easy-care succulents for a sunny desk or windowsill." },
    { name: "New Home Plant Collection", price: 1999, photo: "houseplants", description: "A coordinated collection of leafy houseplants to welcome someone into a new home." },
    { name: "Little Succulent Gift", price: 399, photo: "succulents", description: "A small succulent with a care card, ready to brighten a work desk." },
  ],
};

export async function seedDemoActivity(db: PrismaClient, passwordHash: string) {
  const now = new Date();
  const cities = await db.city.findMany();
  const categories = await db.category.findMany();
  for (const def of extraStores) {
    const owner = await db.user.upsert({ where: { email: def.email }, update: {}, create: { email: def.email, name: def.owner, role: "STORE_OWNER", passwordHash } });
    const city = cities.find((c) => c.name === def.city)!;
    const category = categories.find((c) => c.slug === def.category)!;
    await db.store.upsert({
      where: { id: `demo-store-${def.key}` }, update: {},
      create: { id: `demo-store-${def.key}`, ownerUserId: owner.id, name: def.name, categoryId: category.id, cityId: city.id, description: def.description, address: def.address, coverImage: image(def.photo), openTime: "09:00", closeTime: "21:00" },
    });
  }
  const emails = ["store", "cakecraft", "giftstudio", "bloom", "cakecraft.blr", "teststore2", "customcreations", "greenthumb"].map((s) => `${s}@giftapp.demo`);
  const stores = await db.store.findMany({ where: { owner: { email: { in: emails } } }, include: { category: true, city: true, owner: true }, orderBy: { owner: { email: "asc" } } });
  const customers = await db.user.findMany({ where: { email: { in: ["customer@giftapp.demo", "customer2@giftapp.demo"] } }, orderBy: { email: "asc" } });
  const recipients = ["Kavya Reddy", "Meera Iyer", "Rahul Varma", "Neha Agarwal", "Sneha Pillai", "Karthik Rao", "Aditi Shah", "Riya Kapoor"];
  const statuses: OrderStatus[] = ["ORDER_PLACED", "STORE_ACCEPTED", "PREPARING_GIFT", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "REJECTED", "DELIVERED"];
  const progression: OrderStatus[] = ["ORDER_PLACED", "STORE_ACCEPTED", "PREPARING_GIFT", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];

  for (const [storeIndex, store] of stores.entries()) {
    const productDefs = catalogue[store.category.slug];
    const products = [];
    // IDs derive from the owner's account, so changing a display name doesn't duplicate records.
    const storeKey = store.owner.email.split("@")[0];
    for (const [i, def] of productDefs.entries()) {
      const { photo, ...details } = def;
      products.push(await db.product.upsert({
        where: { id: `demo-product-${storeKey}-${i}` }, update: {},
        create: { id: `demo-product-${storeKey}-${i}`, storeId: store.id, categoryId: store.categoryId, ...details, imageUrl: image(photo), isFeatured: i === 0 },
      }));
    }
    for (const [i, status] of statuses.entries()) {
      const customer = customers[(storeIndex + i) % customers.length];
      const product = products[i % products.length];
      const quantity = i === 7 ? 2 : 1;
      const deliveryOption = i === 0 ? "SCHEDULED" : i % 2 ? "EXPRESS" : "STANDARD";
      const placedAt = i >= 5 ? daysFrom(now, -[1, 3, 12][i - 5]) : new Date(now.getTime() - (35 + i * 40 + storeIndex * 8) * 60000);
      const timeline = status === "REJECTED" ? ["ORDER_PLACED", "REJECTED"] as OrderStatus[] : progression.slice(0, progression.indexOf(status) + 1);
      const rejectionReason = status === "REJECTED" ? "Recipient requested a different delivery date." : null;
      const subtotal = new Prisma.Decimal(product.price).mul(quantity);
      const deliveryFee = DELIVERY_FEES[deliveryOption];
      const orderCode = `GF-DEMO-${storeKey.toUpperCase().replace(/\./g, "-")}-${i + 1}`;
      const recipientName = recipients[(storeIndex + i) % recipients.length];
      await db.order.upsert({
        where: { orderCode }, update: {},
        create: {
          orderCode, idempotencyKey: `seed-${orderCode}`, customerId: customer.id, storeId: store.id, cityId: store.cityId, status,
          recipientName, recipientPhone: "9000000000", deliveryAddress: `Flat ${201 + i}, Maple Residency, ${store.city.name}`, pincode: store.city.name === "Hyderabad" ? "500081" : "560038",
          senderName: customer.name, occasion: i % 2 ? "Birthday" : "Thank you", giftMessage: `A little surprise for you, ${recipientName.split(" ")[0]}. Hope this makes your day!`,
          deliveryOption, ...(deliveryOption === "SCHEDULED" ? { deliveryDate: daysFrom(now, 2), deliverySlot: "EVENING" } : {}),
          paymentMethod: i % 2 ? "UPI_MOCK" : "CARD_MOCK", subtotal, deliveryFee, total: subtotal.add(deliveryFee), rejectionReason, placedAt,
          items: { create: { productId: product.id, productName: product.name, unitPrice: product.price, quantity, lineTotal: subtotal } },
          statusHistory: { create: timeline.map((step, j) => ({ previousStatus: j ? timeline[j - 1] : null, status: step, changedByRole: j ? "STORE_OWNER" : "CUSTOMER", changedById: j ? store.ownerUserId : customer.id, changedAt: new Date(placedAt.getTime() + j * 5 * 60000), note: step === "REJECTED" ? rejectionReason : null })) },
        },
      });
    }
  }

  for (const [index, customer] of customers.entries()) {
    const reminders: { recipient: string; title: string; type: OccasionType; days: number; category: string; note: string }[] = [
      { recipient: "Kavya", title: "Kavya's Birthday", type: "BIRTHDAY", days: 2, category: "Cakes", note: "She loves chocolate cake. Add a handwritten card." },
      { recipient: "Mom & Dad", title: "Mom & Dad's Anniversary", type: "ANNIVERSARY", days: 8, category: "Flowers", note: "A pink rose bouquet for their anniversary dinner." },
      { recipient: "Riya", title: "Riya's Housewarming", type: "OTHER", days: 18, category: "Plants", note: "Choose something easy to care for in her new home." },
    ];
    for (const [i, reminder] of reminders.entries()) {
      const id = `demo-reminder-${customer.email.split("@")[0]}-${i}`;
      await db.reminder.upsert({ where: { id }, update: {}, create: { id, customerId: customer.id, occasionName: reminder.title, recipientName: reminder.recipient, occasionType: reminder.type, date: daysFrom(now, reminder.days + index), repeatYearly: reminder.type !== "OTHER", remindMe: "3 days before", giftCategory: reminder.category, note: reminder.note } });
    }
    const store = stores.find((s) => s.owner.email === (index ? "bloom@giftapp.demo" : "giftstudio@giftapp.demo"))!;
    const products = await db.product.findMany({ where: { storeId: store.id, id: { startsWith: "demo-product-" } }, orderBy: { id: "asc" }, take: 2 });
    for (let i = 0; i < 2; i++) {
      const goalAmount = products.reduce<number>((sum, p) => sum + Number(p.price), DELIVERY_FEES.STANDARD);
      const shares = splitGroupGiftAmount(goalAmount, 4);
      const id = `demo-group-${customer.email.split("@")[0]}-${i}`;
      await db.groupGift.upsert({
        where: { id }, update: {},
        create: {
          id, createdById: customer.id, title: i ? "Riya's Housewarming" : "Rahul's Birthday", occasionType: i ? "OTHER" : "BIRTHDAY", recipientName: i ? "Riya Kapoor" : "Rahul Varma", cityId: store.cityId,
          deliveryDate: daysFrom(now, i ? 14 : 5), goalAmount, splitType: "EQUAL", message: i ? "Wishing you a home full of happy memories!" : "A birthday surprise from all of us!",
          items: { create: products.map((p) => ({ productId: p.id })) },
          contributors: { create: [customer.name, "Meera Iyer", "Arjun Kumar", "Neha Agarwal"].map((name, j) => ({ name, amount: shares[j], paid: i === 1 || j < 2 })) },
        },
      });
    }
  }
  console.log(`Added demo activity for ${stores.length} stores and ${customers.length} customer logins (existing records preserved).`);
}
