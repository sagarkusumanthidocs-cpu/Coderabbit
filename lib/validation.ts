import { z } from "zod";

export const phoneRegex = /^[6-9]\d{9}$/;

export const recipientSchema = z.object({
  recipientName: z.string().trim().min(2, "Enter at least 2 characters").max(60),
  recipientPhone: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid 10-digit phone number starting with 6-9"),
  deliveryAddress: z.string().trim().min(10, "Enter a complete address (min 10 characters)"),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit pincode")
    .optional()
    .or(z.literal("")),
});

export const occasionTypeEnum = z.enum(["BIRTHDAY", "ANNIVERSARY", "WEDDING", "FESTIVAL", "OTHER"]);

export const reminderSchema = z.object({
  occasionName: z.string().trim().min(2, "Enter an occasion name (e.g. \"Priyanka's Birthday\")").max(80),
  recipientName: z.string().trim().min(2, "Enter a recipient name").max(60),
  occasionType: occasionTypeEnum,
  date: z.string().date("Pick a valid date"),
  repeatYearly: z.boolean().optional().default(false),
  remindMe: z.string().trim().min(1, "Choose a reminder lead time"),
  giftCategory: z.string().trim().max(60).optional().or(z.literal("")),
  note: z.string().trim().max(250).optional().or(z.literal("")),
});

export const splitTypeEnum = z.enum(["EQUAL", "CUSTOM"]);

export const groupGiftContributorInput = z.object({
  name: z.string().trim().min(1).max(60),
  amount: z.number().positive(),
});

export const groupGiftSchema = z.object({
  recipientName: z.string().trim().min(2, "Enter a recipient name").max(60),
  occasionType: occasionTypeEnum,
  productIds: z.array(z.string()).min(1, "Select at least one gift"),
  cityId: z.string().min(1, "Select a delivery city"),
  deliveryDate: z.string().date("Pick a valid delivery date"),
  goalAmount: z.number().positive("Goal amount must be greater than 0"),
  splitType: splitTypeEnum.default("EQUAL"),
  message: z.string().trim().max(250).optional().or(z.literal("")),
  contributors: z.array(groupGiftContributorInput).min(1, "Add at least the creator as a contributor"),
}).superRefine((val, ctx) => {
  if (val.splitType === "CUSTOM") {
    const total = val.contributors.reduce((s, c) => s + c.amount, 0);
    // allow a tiny rounding tolerance (paise-level) since amounts are entered as rupees
    if (Math.abs(total - val.goalAmount) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contributors"],
        message: `Custom amounts total ${total.toFixed(2)}, which does not match the goal amount of ${val.goalAmount.toFixed(2)}.`,
      });
    }
  }
});

export const confirmDeliverySchema = z.object({
  proofImage: z.string().trim().min(1, "A delivery photo is required"),
});

export const occasionEnum = z.enum([
  "Birthday",
  "Anniversary",
  "Thank you",
  "Congratulations",
  "Just because",
]);

export const giftSchema = z.object({
  giftMessage: z.string().trim().max(250, "Message can be at most 250 characters").optional().or(z.literal("")),
  occasion: occasionEnum,
  senderName: z.string().trim().min(2, "Enter your name").max(60),
});

export const deliveryOptionEnum = z.enum(["STANDARD", "EXPRESS", "SCHEDULED"]);
export const deliverySlotEnum = z.enum(["MORNING", "AFTERNOON", "EVENING"]);
export const paymentMethodEnum = z.enum(["COD", "UPI_MOCK"]);

export const deliverySchema = z
  .object({
    deliveryOption: deliveryOptionEnum,
    deliveryDate: z.string().optional(), // ISO date (yyyy-mm-dd) when SCHEDULED
    deliverySlot: deliverySlotEnum.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.deliveryOption === "SCHEDULED") {
      if (!val.deliveryDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryDate"], message: "Pick a delivery date" });
      }
      if (!val.deliverySlot) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliverySlot"], message: "Pick a delivery slot" });
      }
    }
  });

export const checkoutSchema = recipientSchema
  .merge(giftSchema)
  .merge(
    z.object({
      deliveryOption: deliveryOptionEnum,
      deliveryDate: z.string().optional(),
      deliverySlot: deliverySlotEnum.optional(),
      paymentMethod: paymentMethodEnum,
      productId: z.string().min(1),
      quantity: z.number().int().min(1).max(10),
      cityId: z.string().min(1),
      idempotencyKey: z.string().min(10),
      displayedTotal: z.number().optional(), // used to detect price drift; recalculated server-side regardless
    })
  )
  .superRefine((val, ctx) => {
    if (val.deliveryOption === "SCHEDULED") {
      if (!val.deliveryDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryDate"], message: "Pick a delivery date" });
      }
      if (!val.deliverySlot) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliverySlot"], message: "Pick a delivery slot" });
      }
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  description: z.string().trim().min(1, "Add a short description"),
  categoryId: z.string().min(1, "Choose a category"),
  price: z
    .number({ invalid_type_error: "Enter a price" })
    .finite()
    .gt(0, "Price must be greater than zero")
    .multipleOf(0.01, "Max two decimal places"),
  imageUrl: z.string().trim().min(1, "Add an image URL"),
  isFeatured: z.boolean().optional().default(false),
  isAvailable: z.boolean().optional().default(true),
});

export const storeProfileSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  address: z.string().trim().min(1),
  coverImage: z.string().trim().min(1),
  isOpen: z.boolean(),
  openTime: z.string().trim().min(1),
  closeTime: z.string().trim().min(1),
});

export const reasonRequiredSchema = z.object({
  reason: z.string().trim().min(3, "Please provide a reason (min 3 characters)"),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordIdentifierSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number"),
});
export const resetPasswordSchema = z
  .object({
    otp: z.string().trim().min(4, "Enter the OTP sent to you"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    retypePassword: z.string(),
  })
  .refine((v) => v.newPassword === v.retypePassword, { message: "Passwords do not match", path: ["retypePassword"] });

export const ORDER_STATUS_VALUES = [
  "ORDER_PLACED",
  "STORE_ACCEPTED",
  "PREPARING_GIFT",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "REJECTED",
] as const;

export const adminOverrideSchema = z.object({
  targetStatus: z.enum(ORDER_STATUS_VALUES),
  reason: z.string().trim().min(3, "Please provide a reason (min 3 characters)"),
});

export const addToCartSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(10),
});

export const cartCheckoutSchema = recipientSchema
  .merge(giftSchema)
  .merge(
    z.object({
      deliveryOption: deliveryOptionEnum,
      deliveryDate: z.string().optional(),
      deliverySlot: deliverySlotEnum.optional(),
      paymentMethod: paymentMethodEnum,
      cityId: z.string().min(1),
      idempotencyKey: z.string().min(10),
      displayedTotal: z.number().optional(), // used to detect price drift; recalculated server-side regardless
    })
  )
  .superRefine((val, ctx) => {
    if (val.deliveryOption === "SCHEDULED") {
      if (!val.deliveryDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryDate"], message: "Pick a delivery date" });
      }
      if (!val.deliverySlot) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliverySlot"], message: "Pick a delivery slot" });
      }
    }
  });
export type CartCheckoutInput = z.infer<typeof cartCheckoutSchema>;
