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

const incoterm = z.enum(["EXW", "FOB", "CIF", "DDP"]);

export const rfqBaseSchema = z.object({
  buyerOrgId: uuid,
  industryId: uuid,
  schemaVersionId: uuid,
  title: z.string().trim().min(3).max(180),
  category: z.string().trim().min(2).max(80).optional().nullable(),
  quantity: z.number().int().positive(),
  unit: z.string().trim().min(1).max(30),
  currency,
  targetUnitPriceCents: z.number().int().positive().optional().nullable(),
  incoterm: incoterm.optional().nullable(),
  brandingRequirements: z.string().trim().max(2000).optional().nullable(),
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
    "QUOTED",
    "PAID",
    "IN_PRODUCTION",
    "IN_PREPARATION",
    "SHIPPED",
    "DELIVERED",
    "RECEIVED",
    "REVISION_REQUESTED",
    "REVISION_NEEDED",
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
  status: z.enum([
    "PENDING",
    "RAW_MATERIALS_READY",
    "IN_PRODUCTION",
    "ACTIVE",
    "QUALITY_CHECK",
    "PACKAGING",
    "READY_TO_SHIP",
    "DONE",
    "BLOCKED",
  ]),
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

const queryBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

const artifactFields = {
  objectKey: z.string().trim().min(1).max(500),
  checksum: z.string().trim().min(8).max(128),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
};

export const productQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  industryId: uuid.optional(),
  supplierOrgId: uuid.optional(),
  minOrderQuantity: z.coerce.number().int().positive().optional(),
  maxLeadTimeDays: z.coerce.number().int().positive().optional(),
  verifiedOnly: queryBoolean.optional(),
});

export const createProductSchema = z.object({
  supplierOrgId: uuid,
  industryId: uuid,
  sku: z.string().trim().max(80).optional().nullable(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(3).max(4000),
  category: z.string().trim().min(2).max(80),
  source: z.enum(["CATALOG", "CUSTOM", "RFQ"]).default("CATALOG"),
  specifications: json,
  unit: z.string().trim().min(1).max(30),
  currency,
  minOrderQuantity: z.number().int().positive().optional().nullable(),
  leadTimeDays: z.number().int().positive().optional().nullable(),
  productionCapacity: z.number().int().positive().optional().nullable(),
  certifications: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  priceCents: z.number().int().positive().optional().nullable(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .optional()
    .nullable(),
});

export const productStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]),
});

export const createRfqAttachmentSchema = z
  .object({
    label: z.string().trim().min(1).max(180),
    ...artifactFields,
    classification: z.enum(["DESIGN", "CAD", "PDF_SPEC", "IMAGE", "BRAND_GUIDE", "TECHNICAL_SHEET", "OTHER"]),
    confidentiality: z.enum(["INTERNAL", "INVITED_SUPPLIERS", "PUBLIC"]).default("INVITED_SUPPLIERS"),
  });

export const supplierQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  industryId: uuid.optional(),
  category: z.string().trim().max(80).optional(),
  minOrderQuantity: z.coerce.number().int().positive().optional(),
  maxLeadTimeDays: z.coerce.number().int().positive().optional(),
  verifiedOnly: queryBoolean.optional(),
});

export const createInspectionReportSchema = z
  .object({
    organizationId: uuid,
    kind: z.enum(["FACTORY_AUDIT", "PRE_SHIPMENT", "SAMPLE", "LABORATORY", "DOCUMENT"]),
    issuer: z.string().trim().min(2).max(180),
    reportNumber: z.string().trim().max(80).optional().nullable(),
    ...artifactFields,
    scope: z.string().trim().max(500).optional().nullable(),
    summary: json.optional().nullable(),
    score: z.number().int().min(0).max(100).optional().nullable(),
    issuedAt: isoDate.optional().nullable(),
    expiresAt: isoDate.optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  });

export const inspectionStatusSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "EXPIRED"]),
  notes: z.string().trim().max(1000).optional(),
});

export const createMessageThreadSchema = z.object({
  type: z.enum(["PRODUCT", "RFQ", "QUOTE", "PURCHASE_ORDER", "SAMPLE", "INSPECTION", "ESCROW", "SHIPMENT", "SUPPORT"]),
  subject: z.string().trim().min(2).max(180),
  organizationId: uuid,
  participantOrgIds: z.array(uuid).min(1).max(20),
  rfqId: uuid.optional(),
  quoteId: uuid.optional(),
  purchaseOrderId: uuid.optional(),
  sampleId: uuid.optional(),
  escrowHoldId: uuid.optional(),
  shipmentId: uuid.optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  idempotencyKey: z.string().trim().min(8).max(120),
  offer: z
    .object({
      title: z.string().trim().min(2).max(180),
      quantity: z.number().int().positive(),
      unitPriceCents: z.number().int().positive(),
      leadTimeDays: z.number().int().positive(),
      incoterm,
      currency,
      notes: z.string().trim().max(1000).optional(),
    })
    .optional(),
});

export const messageQuerySchema = z.object({
  after: isoDate.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const messageThreadStatusSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "ARCHIVED"]),
});

export const createEscrowSchema = z.object({
  amountCents: z.number().int().positive(),
  currency,
  idempotencyKey: z.string().trim().min(8).max(120),
  conditions: z
    .array(
      z.object({
        kind: z.enum([
          "PRODUCTION_STARTED",
          "SAMPLE_APPROVED",
          "INSPECTION_APPROVED",
          "MILESTONE_DONE",
          "SHIPMENT_DELIVERED",
          "DOCUMENT_APPROVED",
          "MANUAL",
        ]),
        title: z.string().trim().min(2).max(180),
        percentage: z.number().int().positive().max(100),
        description: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(10),
});

export const escrowConditionSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const escrowReleaseSchema = z.object({
  status: z.enum(["COMPLETED", "DISPUTED", "REFUNDED"]),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const createShipmentSchema = z.object({
  carrier: z.string().trim().min(2).max(120).optional().nullable(),
  trackingNumber: z.string().trim().max(120).optional().nullable(),
  origin: z.string().trim().max(180).optional().nullable(),
  destination: z.string().trim().max(180).optional().nullable(),
  documentObjectKey: z.string().trim().max(500).optional().nullable(),
});

export const shipmentEventSchema = z.object({
  status: z.enum(["CREATED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "EXCEPTION"]),
  occurredAt: isoDate,
  location: z.string().trim().max(180).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const notificationQuerySchema = z.object({
  unreadOnly: queryBoolean.optional(),
});
