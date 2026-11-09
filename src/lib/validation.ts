import { z } from "zod";

const phone = z
  .string()
  .trim()
  .regex(/^(\+?63|0)9\d{9}$/, "Enter a valid PH mobile number, e.g. 09171234567.");

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    phone,
    password,
    confirmPassword: z.string(),
    terms: z.literal(true, { error: "Please accept the pickup terms to continue." }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const signInSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

const decimalField = (label: string, { min = 0, allowZero = false } = {}) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .refine((n) => Number.isFinite(n), `${label} must be a number.`)
    .refine((n) => (allowZero ? n >= min : n > min), `${label} must be greater than ${min}.`)
    .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, `${label} supports up to 3 decimals.`);

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name.").max(80),
  localName: z.string().trim().max(60).optional().or(z.literal("")),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,20}$/, "Use 3–20 letters, numbers or dashes."),
  description: z.string().trim().min(10, "Write at least a short description.").max(600),
  category: z.enum(["PRIME_CUTS", "RIBS_AND_BONES", "GROUND", "SPECIALTY", "FAT"]),
  unit: z.enum(["KG", "PIECE"]),
  price: decimalField("Price"),
  lowStockThreshold: decimalField("Low-stock level", { allowZero: true }),
  minOrderQty: decimalField("Minimum order"),
  qtyStep: decimalField("Quantity step"),
  imageUrl: z
    .union([z.url(), z.string().regex(/^\/[\w\-./]+$/)], { error: "Use a full https:// link or a site path like /products/pork-belly.jpg." })
    .optional()
    .or(z.literal("")),
});

export const stockMovementSchema = z.object({
  productId: z.string().min(1, "Choose a product."),
  quantity: decimalField("Quantity"),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

export const countCorrectionSchema = z.object({
  productId: z.string().min(1),
  countedQty: decimalField("Counted quantity", { allowZero: true }),
  reason: z.string().trim().min(3, "Explain why the count changed.").max(200),
});

export const returnSchema = stockMovementSchema.extend({
  orderNumber: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
});

export const workerSchema = z.object({
  name: z.string().trim().min(2, "Enter the worker's full name.").max(80),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  phone,
  password,
});

export const workerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  maxActiveOrders: z.coerce
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour).");

export const settingsSchema = z
  .object({
    shopName: z.string().trim().min(2).max(60),
    openTime: hm,
    closeTime: hm,
    slotMinutes: z.coerce.number().int().refine((n) => [30, 60, 90, 120].includes(n), "Choose 30, 60, 90 or 120 minutes."),
    slotCapacity: z.coerce.number().int().min(1).max(100),
    leadTimeMinutes: z.coerce.number().int().min(0).max(24 * 60),
    advanceDays: z.coerce.number().int().min(1).max(14),
    maxActiveOrdersPerWorker: z.coerce.number().int().min(1).max(30),
  })
  .refine((v) => v.openTime < v.closeTime, {
    path: ["closeTime"],
    message: "Closing time must be after opening time.",
  });

export const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().positive().max(500),
      }),
    )
    .min(1, "Your cart is empty.")
    .max(30),
  pickupAt: z.iso.datetime({ error: "Choose a pickup time." }),
  notes: z.string().trim().max(300).optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  phone,
});

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
