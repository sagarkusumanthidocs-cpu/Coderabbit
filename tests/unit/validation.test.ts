import { describe, it, expect } from "vitest";
import { recipientSchema, giftSchema, checkoutSchema, cartCheckoutSchema } from "@/lib/validation";

describe("recipient validation", () => {
  it("rejects a phone number not starting with 6-9", () => {
    const result = recipientSchema.safeParse({
      recipientName: "Test User",
      recipientPhone: "5123456789",
      deliveryAddress: "123 Some Long Enough Street",
    });
    expect(result.success).toBe(false);
  });
  it("accepts a valid 10-digit phone starting with 6-9", () => {
    const result = recipientSchema.safeParse({
      recipientName: "Test User",
      recipientPhone: "9876543210",
      deliveryAddress: "123 Some Long Enough Street",
    });
    expect(result.success).toBe(true);
  });
  it("rejects an address under 10 characters", () => {
    const result = recipientSchema.safeParse({
      recipientName: "Test User",
      recipientPhone: "9876543210",
      deliveryAddress: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("gift message validation", () => {
  it("rejects a message over 250 characters", () => {
    const result = giftSchema.safeParse({
      giftMessage: "a".repeat(251),
      occasion: "Birthday",
      senderName: "Test",
    });
    expect(result.success).toBe(false);
  });
  it("accepts an empty message", () => {
    const result = giftSchema.safeParse({ giftMessage: "", occasion: "Birthday", senderName: "Test" });
    expect(result.success).toBe(true);
  });
});

describe("checkout schema", () => {
  const base = {
    recipientName: "Test User",
    recipientPhone: "9876543210",
    deliveryAddress: "123 Some Long Enough Street",
    occasion: "Birthday" as const,
    senderName: "Sender",
    paymentMethod: "CARD_MOCK" as const,
    productId: "prod_1",
    quantity: 2,
    cityId: "city_1",
    idempotencyKey: "0123456789abcdef",
  };

  it.each(["UPI_MOCK", "CARD_MOCK", "COD", "UNKNOWN"])("validates %s for both checkout paths", (paymentMethod) => {
    const input = { ...base, deliveryOption: "STANDARD", paymentMethod };
    const allowed = paymentMethod === "UPI_MOCK" || paymentMethod === "CARD_MOCK";
    expect(checkoutSchema.safeParse(input).success).toBe(allowed);
    expect(cartCheckoutSchema.safeParse(input).success).toBe(allowed);
  });

  it("requires date and slot when SCHEDULED", () => {
    const result = checkoutSchema.safeParse({ ...base, deliveryOption: "SCHEDULED" });
    expect(result.success).toBe(false);
  });

  it("passes when SCHEDULED with date and slot provided", () => {
    const result = checkoutSchema.safeParse({
      ...base,
      deliveryOption: "SCHEDULED",
      deliveryDate: "2099-01-01",
      deliverySlot: "MORNING",
    });
    expect(result.success).toBe(true);
  });

  it("does not require date/slot for STANDARD", () => {
    const result = checkoutSchema.safeParse({ ...base, deliveryOption: "STANDARD" });
    expect(result.success).toBe(true);
  });

  it("rejects quantity above 10", () => {
    const result = checkoutSchema.safeParse({ ...base, deliveryOption: "STANDARD", quantity: 11 });
    expect(result.success).toBe(false);
  });
});

describe("date-only form fields", () => {
  it("rejects invalid reminder and group gift dates before database writes", async () => {
    const { reminderSchema, groupGiftSchema } = await import("@/lib/validation");
    const reminder = { occasionName: "Birthday", recipientName: "Alex", occasionType: "BIRTHDAY", remindMe: "3 days before" };
    const group = { recipientName: "Alex", occasionType: "BIRTHDAY", productIds: ["gift"], cityId: "city", goalAmount: 100, contributors: [{ name: "You", amount: 100 }] };
    for (const invalid of ["not-a-date", "2026-02-30", ""]) {
      expect(reminderSchema.safeParse({ ...reminder, date: invalid }).success).toBe(false);
      expect(groupGiftSchema.safeParse({ ...group, deliveryDate: invalid }).success).toBe(false);
    }
    expect(reminderSchema.safeParse({ ...reminder, date: "2028-02-29" }).success).toBe(true);
    expect(groupGiftSchema.safeParse({ ...group, deliveryDate: "2028-02-29" }).success).toBe(true);
  });
});


describe("product prices", () => {
  it("accepts two decimal prices despite floating point multiplication artifacts", async () => {
    const { productFormSchema } = await import("@/lib/validation");
    const product = { name: "Gift", description: "A gift", categoryId: "flowers", imageUrl: "/images/placeholder.svg" };
    expect(productFormSchema.safeParse({ ...product, price: 19.99 }).success).toBe(true);
    expect(productFormSchema.safeParse({ ...product, price: 29.99 }).success).toBe(true);
    expect(productFormSchema.safeParse({ ...product, price: 19.999 }).success).toBe(false);
  });
});
