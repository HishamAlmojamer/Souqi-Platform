import { z } from "zod";

const uuid = z.uuid();
const isoDate = z.iso.datetime();
const json = z.record(z.string(), z.unknown());
const currency = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase());

const accountTypeInput = z
  .union([
    z.enum(["BUYER", "SUPPLIER", "CUSTOMER", "MERCHANT"]),
    z.enum(["buyer", "supplier", "customer", "merchant"]),
  ])
  .transform((value) => value.toUpperCase() as "BUYER" | "SUPPLIER" | "CUSTOMER" | "MERCHANT");
const membershipRole = z.enum(["OWNER", "ADMIN", "MEMBER", "QUALITY"]);

function normalizeAccountType(
  value: z.infer<typeof accountTypeInput> | undefined,
): "BUYER" | "SUPPLIER" | undefined {
  if (value === "BUYER" || value === "CUSTOMER") return "BUYER";
  if (value === "SUPPLIER" || value === "MERCHANT") return "SUPPLIER";
  return undefined;
}

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    name: z.string().trim().min(2).max(120).optional(),
    companyName: z.string().trim().min(2).max(160),
    email: z.email().max(255),
    password: z.string().min(8).max(128),
    accountType: accountTypeInput.optional(),
    role: accountTypeInput.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.fullName && !value.name) {
      ctx.addIssue({
        code: "custom",
        path: ["fullName"],
        message: "الاسم مطلوب",
      });
    }
    if (!normalizeAccountType(value.accountType ?? value.role)) {
      ctx.addIssue({
        code: "custom",
        path: ["accountType"],
        message: "نوع الحساب مطلوب",
      });
    }
  })
  .transform((value) => ({
    fullName: (value.fullName ?? value.name ?? "").trim(),
    companyName: value.companyName.trim(),
    email: value.email.trim().toLowerCase(),
    password: value.password,
    accountType: normalizeAccountType(value.accountType ?? value.role)!,
  }));

export const adminCreateAccountSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    companyName: z.string().trim().min(2).max(160),
    email: z.email().max(255),
    password: z.string().min(8).max(128),
    accountType: accountTypeInput,
    isPlatformAdmin: z.boolean().default(false),
  })
  .transform((value) => ({
    fullName: value.fullName.trim(),
    companyName: value.companyName.trim(),
    email: value.email.trim().toLowerCase(),
    password: value.password,
    accountType: normalizeAccountType(value.accountType)!,
    isPlatformAdmin: value.isPlatformAdmin,
  }));

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(8).max(128),
});

export const createOrganizationSchema = z.object({
  type: z.enum(["BUYER", "SUPPLIER"]),
  legalName: z.string().trim().min(2).max(180),
  displayName: z.string().trim().min(2).max(180).optional(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
});

export const addMembershipSchema = z.object({
  accountId: uuid,
  role: membershipRole,
});

export const updateMembershipSchema = z.object({
  role: membershipRole.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const membershipStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const upsertSupplierProfileSchema = z.object({
  capabilities: json.optional(),
  minOrderQuantity: z.number().int().positive().optional().nullable(),
  leadTimeDays: z.number().int().positive().optional().nullable(),
  website: z.url().max(300).optional().nullable(),
});

export const verifySupplierSchema = z.object({
  status: z.enum([
    "DRAFT",
    "SUBMITTED",
    "IN_REVIEW",
    "APPROVED",
    "REJECTED",
    "SUSPENDED",
  ]),
  note: z.string().trim().max(500).optional(),
});

export const createIndustrySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  nameAr: z.string().trim().min(2).max(120),
  active: z.boolean().default(true),
});

export const createIndustrySchemaVersionSchema = z.object({
  version: z.number().int().positive(),
  schemaJson: json,
  publish: z.boolean().default(false),
});

export const rfqBaseSchema = z.object({
  buyerOrgId: uuid,
  industryId: uuid,
  schemaVersionId: uuid,
  title: z.string().trim().min(3).max(180),
  quantity: z.number().int().positive(),
  unit: z.string().trim().min(1).max(30),
  currency,
  destination: z.string().trim().min(2).max(180),
  targetDate: isoDate.optional().nullable(),
  requirements: json,
});

export const createRfqSchema = rfqBaseSchema;
export const updateRfqSchema = rfqBaseSchema.partial();

export const listRfqsQuerySchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"]).optional(),
  buyerOrgId: uuid.optional(),
  industryId: uuid.optional(),
  supplierOrgId: uuid.optional(),
});

export const rfqStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"]),
});

export const inviteSuppliersSchema = z.object({
  supplierOrgIds: z.array(uuid).min(1).max(50),
});

export const quoteLineSchema = z.object({
  name: z.string().trim().min(1).max(180),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
});

export const createQuoteSchema = z
  .object({
    rfqId: uuid,
    supplierOrgId: uuid,
    revision: z.number().int().positive(),
    currency,
    leadTimeDays: z.number().int().positive(),
    validUntil: isoDate,
    notes: z.string().trim().max(2000).optional().nullable(),
    lines: z.array(quoteLineSchema).min(1).max(200),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.validUntil).getTime() <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "تاريخ صلاحية العرض يجب أن يكون في المستقبل",
      });
    }
  });

export const quoteStatusSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "SUPERSEDED", "WITHDRAWN", "LOST"]),
});

export const awardSchema = z.object({
  quoteId: uuid,
  note: z.string().trim().max(1000).optional(),
});

export const poStatusSchema = z.object({
  status: z.enum(["ACTIVE", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

export const createSampleSchema = z.object({
  version: z.number().int().positive(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateSampleSchema = z.object({
  status: z.enum([
    "REQUESTED",
    "IN_PREPARATION",
    "SHIPPED",
    "RECEIVED",
    "REVISION_REQUESTED",
    "APPROVED",
    "REJECTED",
  ]),
  notes: z.string().trim().max(1000).optional().nullable(),
  shippedAt: isoDate.optional().nullable(),
  receivedAt: isoDate.optional().nullable(),
});

export const createMilestoneSchema = z.object({
  code: z.string().trim().min(1).max(60),
  sequence: z.number().int().positive(),
  plannedAt: isoDate.optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const updateMilestoneSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "DONE", "BLOCKED"]),
  completedAt: isoDate.optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const createEvidenceSchema = z.object({
  organizationId: uuid,
  purchaseOrderId: uuid.optional().nullable(),
  milestoneId: uuid.optional().nullable(),
  objectKey: z.string().trim().min(1).max(500),
  checksum: z.string().trim().min(8).max(128),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  classification: z.string().trim().min(1).max(80),
});

export const platformAdminSchema = z.object({
  isPlatformAdmin: z.boolean(),
});

export const organizationStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const membershipRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "QUALITY"]),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

export const addMemberByEmailSchema = z.object({
  email: z.email(),
  role: membershipRole,
});
