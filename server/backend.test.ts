import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AccessContext } from "./auth";
import {
  assertPermission,
  assertRole,
  hasPermission,
  hasRole,
  highestRole,
  PERMISSION_KEYS,
  permissionsForRole,
  ROLE_SETS,
} from "./domain/permissions";
import { validateRequirements } from "./domain/rules";
import {
  ESCROW_CONDITION_TRANSITIONS,
  ESCROW_HOLD_TRANSITIONS,
  INSPECTION_REPORT_TRANSITIONS,
  MESSAGE_THREAD_TRANSITIONS,
  MILESTONE_TRANSITIONS,
  PRODUCT_TRANSITIONS,
  QUOTE_TRANSITIONS,
  RFQ_TRANSITIONS,
  SAMPLE_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  assertTransition,
} from "./domain/transitions";
import { ApiError } from "./http";
import {
  adminCreateAccountSchema,
  createEscrowSchema,
  createQuoteSchema,
  createRfqAttachmentSchema,
  createShipmentSchema,
  escrowReleaseSchema,
  inspectionStatusSchema,
  membershipStatusSchema,
  messageThreadStatusSchema,
  registerSchema,
  sendMessageSchema,
  shipmentEventSchema,
} from "./validation";

function context(role: AccessContext["role"], isPlatformAdmin = false): AccessContext {
  return {
    organizationId: "org",
    role,
    isPlatformAdmin,
    organization: {
      id: "org",
      type: "BUYER",
      status: "ACTIVE",
      legalName: "Org",
      displayName: "Org",
      countryCode: "SA",
    },
  };
}

describe("status transitions", () => {
  it("allows publishing a draft RFQ", () => {
    assert.doesNotThrow(() =>
      assertTransition(RFQ_TRANSITIONS, "DRAFT", "PUBLISHED", "RFQ"),
    );
  });

  it("rejects reopening a closed RFQ", () => {
    assert.throws(
      () => assertTransition(RFQ_TRANSITIONS, "CLOSED", "PUBLISHED", "RFQ"),
      (error: unknown) => error instanceof ApiError && error.status === 409,
    );
  });

  it("allows superseding a submitted quote", () => {
    assert.doesNotThrow(() =>
      assertTransition(QUOTE_TRANSITIONS, "SUBMITTED", "SUPERSEDED", "quote"),
    );
  });

  it("allows shipping a prepared sample but not approving it directly", () => {
    assert.doesNotThrow(() =>
      assertTransition(SAMPLE_TRANSITIONS, "IN_PREPARATION", "SHIPPED", "sample"),
    );
    assert.throws(() =>
      assertTransition(SAMPLE_TRANSITIONS, "IN_PREPARATION", "APPROVED", "sample"),
    );
  });

  it("blocks done milestones from changing status", () => {
    assert.throws(() =>
      assertTransition(MILESTONE_TRANSITIONS, "DONE", "ACTIVE", "milestone"),
    );
  });
});

describe("role checks", () => {
  it("grants members limited access", () => {
    assert.equal(hasRole(context("MEMBER"), ROLE_SETS.createRfq), true);
    assert.equal(hasRole(context("MEMBER"), ROLE_SETS.awardQuote), false);
    assert.throws(() => assertRole(context("MEMBER"), ROLE_SETS.awardQuote));
  });

  it("grants admins full access", () => {
    assert.equal(hasRole(context("OWNER"), ROLE_SETS.verifySupplier), true);
    assert.equal(hasRole(context("MEMBER", true), ROLE_SETS.verifySupplier), true);
  });
});

describe("permission matrix", () => {
  it("grants platform admins every catalog permission", () => {
    for (const permission of PERMISSION_KEYS) {
      assert.equal(hasPermission(context("MEMBER", true), permission), true);
    }
  });

  it("keeps award and verification away from members", () => {
    assert.equal(hasPermission(context("MEMBER"), "rfq.create"), true);
    assert.equal(hasPermission(context("MEMBER"), "rfq.award"), false);
    assert.equal(hasPermission(context("MEMBER"), "supplier.verification.review"), false);
    assert.throws(() => assertPermission(context("MEMBER"), "rfq.award"));
  });

  it("lets quality roles manage evidence but not create RFQs", () => {
    assert.equal(hasPermission(context("QUALITY"), "evidence.upload"), true);
    assert.equal(hasPermission(context("QUALITY"), "milestone.manage"), true);
    assert.equal(hasPermission(context("QUALITY"), "rfq.create"), false);
  });

  it("resolves the highest role across memberships", () => {
    assert.equal(highestRole(["MEMBER", "OWNER", "QUALITY"]), "OWNER");
    assert.equal(permissionsForRole("PLATFORM_ADMIN").length, PERMISSION_KEYS.length);
  });
});

describe("requirements validation", () => {
  const schema = {
    required: ["material"],
    properties: {
      material: { type: "string" },
      quantity: { type: "integer" },
    },
    sections: [
      {
        key: "certificates",
        required: ["iso"],
        properties: { iso: { type: "boolean" } },
      },
    ],
  };

  it("accepts payloads matching the schema", () => {
    assert.doesNotThrow(() =>
      validateRequirements(schema, {
        material: "steel",
        quantity: 10,
        certificates: { iso: true },
      }),
    );
  });

  it("rejects missing required fields", () => {
    assert.throws(
      () => validateRequirements(schema, { quantity: 10 }),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });

  it("rejects wrong field types", () => {
    assert.throws(() =>
      validateRequirements(schema, { material: "steel", quantity: "many" }),
    );
  });

  it("validates nested sections", () => {
    assert.throws(() =>
      validateRequirements(schema, {
        material: "steel",
        certificates: { iso: "yes" },
      }),
    );
  });
});

describe("request validation", () => {
  it("normalizes lowercase account types from the mobile client", () => {
    const parsed = registerSchema.parse({
      name: "Test User",
      companyName: "Test Co",
      email: "Test@Example.com",
      password: "password123",
      accountType: "buyer",
    });
    assert.equal(parsed.accountType, "BUYER");
    assert.equal(parsed.email, "test@example.com");
  });

  it("maps merchant to supplier", () => {
    const parsed = registerSchema.parse({
      fullName: "Test User",
      companyName: "Test Co",
      email: "test@example.com",
      password: "password123",
      role: "merchant",
    });
    assert.equal(parsed.accountType, "SUPPLIER");
  });

  it("normalizes admin-created accounts", () => {
    const parsed = adminCreateAccountSchema.parse({
      fullName: " Admin User ",
      companyName: " Admin Co ",
      email: "Admin@Example.com",
      password: "password123",
      accountType: "supplier",
      isPlatformAdmin: true,
    });
    assert.equal(parsed.accountType, "SUPPLIER");
    assert.equal(parsed.email, "admin@example.com");
    assert.equal(parsed.fullName, "Admin User");
    assert.equal(parsed.isPlatformAdmin, true);
  });

  it("requires a membership status", () => {
    assert.throws(() => membershipStatusSchema.parse({}));
    assert.deepEqual(membershipStatusSchema.parse({ status: "INACTIVE" }), {
      status: "INACTIVE",
    });
  });

  it("rejects expired quotes", () => {
    assert.throws(() =>
      createQuoteSchema.parse({
        rfqId: "0f4b2c3a-6e3c-4f0b-8e2e-8f0c9a1b2c3d",
        supplierOrgId: "1f4b2c3a-6e3c-4f0b-8e2e-8f0c9a1b2c3d",
        revision: 1,
        currency: "SAR",
        leadTimeDays: 10,
        validUntil: "2020-01-01T00:00:00.000Z",
        lines: [{ name: "Part", quantity: 2, unitPriceCents: 1000 }],
      }),
    );
  });

  it("accepts structured RFQ commercial fields", () => {
    const parsed = createQuoteSchema.parse({
      rfqId: "0f4b2c3a-6e3c-4f0b-8e2e-8f0c9a1b2c3d",
      supplierOrgId: "1f4b2c3a-6e3c-4f0b-8e2e-8f0c9a1b2c3d",
      revision: 1,
      currency: "SAR",
      leadTimeDays: 10,
      validUntil: "2030-01-01T00:00:00.000Z",
      lines: [{ name: "Part", quantity: 2, unitPriceCents: 1000 }],
    });
    assert.equal(parsed.lines[0].unitPriceCents, 1000);
  });

  it("validates RFQ attachment metadata", () => {
    const parsed = createRfqAttachmentSchema.parse({
      label: "CAD drawing",
      objectKey: "org/rfq/design.dwg",
      checksum: "sha256-abcdef123456",
      mimeType: "application/vnd.autocad.dwg",
      sizeBytes: 2048,
      classification: "CAD",
    });
    assert.equal(parsed.confidentiality, "INVITED_SUPPLIERS");
  });

  it("validates negotiation offer cards and thread status", () => {
    const message = sendMessageSchema.parse({
      body: "Our best offer",
      idempotencyKey: "offer-2026-001",
      offer: {
        title: "Bulk order",
        quantity: 1000,
        unitPriceCents: 2500,
        leadTimeDays: 21,
        incoterm: "FOB",
        currency: "SAR",
      },
    });
    assert.equal(message.offer?.incoterm, "FOB");
    assert.doesNotThrow(() => messageThreadStatusSchema.parse({ status: "CLOSED" }));
  });

  it("requires escrow condition percentages to total 100", () => {
    const parsed = createEscrowSchema.parse({
      amountCents: 100000,
      currency: "SAR",
      idempotencyKey: "escrow-2026-001",
      conditions: [
        { kind: "SAMPLE_APPROVED", title: "Sample approval", percentage: 40 },
        { kind: "SHIPMENT_DELIVERED", title: "Delivery", percentage: 60 },
      ],
    });
    assert.equal(parsed.conditions.length, 2);
    assert.throws(() => escrowReleaseSchema.parse({ status: "PARTIAL_RELEASED", idempotencyKey: "x" }));
  });

  it("validates shipment tracking events", () => {
    const shipment = createShipmentSchema.parse({
      carrier: "DHL",
      trackingNumber: "ABC123",
      documentObjectKey: "org/shipment/abc123/bol.pdf",
    });
    assert.equal(shipment.carrier, "DHL");
    assert.doesNotThrow(() => shipmentEventSchema.parse({
      status: "IN_TRANSIT",
      occurredAt: "2026-11-29T00:00:00.000Z",
      idempotencyKey: "event-2026-001",
    }));
  });

  it("validates inspection review transitions", () => {
    assert.doesNotThrow(() => inspectionStatusSchema.parse({ status: "APPROVED" }));
    assert.throws(() => inspectionStatusSchema.parse({ status: "PENDING" }));
  });
});

describe("lifecycle transitions", () => {
  it("moves samples through the negotiated quote-to-approval path", () => {
    assert.doesNotThrow(() => assertTransition(SAMPLE_TRANSITIONS, "REQUESTED", "QUOTED", "sample"));
    assert.doesNotThrow(() => assertTransition(SAMPLE_TRANSITIONS, "QUOTED", "PAID", "sample"));
    assert.doesNotThrow(() => assertTransition(SAMPLE_TRANSITIONS, "PAID", "IN_PRODUCTION", "sample"));
    assert.doesNotThrow(() => assertTransition(SAMPLE_TRANSITIONS, "SHIPPED", "DELIVERED", "sample"));
    assert.throws(() => assertTransition(SAMPLE_TRANSITIONS, "QUOTED", "SHIPPED", "sample"));
  });

  it("enforces production milestone order", () => {
    assert.doesNotThrow(() => assertTransition(MILESTONE_TRANSITIONS, "PENDING", "RAW_MATERIALS_READY", "milestone"));
    assert.doesNotThrow(() => assertTransition(MILESTONE_TRANSITIONS, "RAW_MATERIALS_READY", "IN_PRODUCTION", "milestone"));
    assert.throws(() => assertTransition(MILESTONE_TRANSITIONS, "PENDING", "READY_TO_SHIP", "milestone"));
  });

  it("enforces escrow funding before release", () => {
    assert.doesNotThrow(() => assertTransition(ESCROW_HOLD_TRANSITIONS, "AWAITING_PAYMENT", "FUNDS_HELD_IN_ESCROW", "escrow"));
    assert.throws(() => assertTransition(ESCROW_HOLD_TRANSITIONS, "AWAITING_PAYMENT", "COMPLETED", "escrow"));
    assert.doesNotThrow(() => assertTransition(ESCROW_CONDITION_TRANSITIONS, "PENDING", "MET", "condition"));
    assert.throws(() => assertTransition(ESCROW_CONDITION_TRANSITIONS, "MET", "PENDING", "condition"));
  });

  it("enforces inspection and catalog review gates", () => {
    assert.doesNotThrow(() => assertTransition(INSPECTION_REPORT_TRANSITIONS, "SUBMITTED", "IN_REVIEW", "report"));
    assert.doesNotThrow(() => assertTransition(INSPECTION_REPORT_TRANSITIONS, "IN_REVIEW", "APPROVED", "report"));
    assert.throws(() => assertTransition(INSPECTION_REPORT_TRANSITIONS, "DRAFT", "APPROVED", "report"));
    assert.doesNotThrow(() => assertTransition(PRODUCT_TRANSITIONS, "DRAFT", "ACTIVE", "product"));
  });

  it("enforces messaging and shipping lifecycles", () => {
    assert.doesNotThrow(() => assertTransition(MESSAGE_THREAD_TRANSITIONS, "OPEN", "CLOSED", "thread"));
    assert.throws(() => assertTransition(MESSAGE_THREAD_TRANSITIONS, "CLOSED", "OPEN", "thread"));
    assert.doesNotThrow(() => assertTransition(SHIPMENT_TRANSITIONS, "CREATED", "PICKED_UP", "shipment"));
    assert.doesNotThrow(() => assertTransition(SHIPMENT_TRANSITIONS, "PICKED_UP", "IN_TRANSIT", "shipment"));
    assert.throws(() => assertTransition(SHIPMENT_TRANSITIONS, "CREATED", "DELIVERED", "shipment"));
  });
});

describe("lifecycle permissions", () => {
  it("keeps escrow release and inspection approval away from members", () => {
    assert.equal(hasPermission(context("MEMBER"), "escrow.release"), false);
    assert.equal(hasPermission(context("MEMBER"), "inspection.review"), false);
    assert.equal(hasPermission(context("MEMBER"), "message.send"), true);
  });

  it("grants quality roles inspection and messaging access", () => {
    assert.equal(hasPermission(context("QUALITY"), "inspection.manage"), true);
    assert.equal(hasPermission(context("QUALITY"), "message.send"), true);
    assert.equal(hasPermission(context("QUALITY"), "escrow.release"), false);
  });

  it("grants owners escrow and shipment control", () => {
    assert.equal(hasPermission(context("OWNER"), "escrow.release"), true);
    assert.equal(hasPermission(context("OWNER"), "shipment.manage"), true);
    assert.equal(hasPermission(context("OWNER"), "product.manage"), true);
  });
});
