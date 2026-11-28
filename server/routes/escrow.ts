import { Router } from "express";

import { authenticate, requireAccount, requireOrgAccess } from "../auth";
import { prisma } from "../db";
import { writeAudit, writeOutbox } from "../domain/events";
import { assertPermission, ROLE_SETS } from "../domain/permissions";
import {
  assertTransition,
  ESCROW_CONDITION_TRANSITIONS,
  ESCROW_HOLD_TRANSITIONS,
} from "../domain/transitions";
import { ApiError, asyncRoute, routeParam } from "../http";
import { createEscrowSchema, escrowConditionSchema, escrowReleaseSchema } from "../validation";

export const escrowRouter = Router();

escrowRouter.use(authenticate);

function assertDemoMode(): void {
  if ((process.env.ESCROW_MODE ?? "DEMO").toUpperCase() !== "DEMO") {
    throw new ApiError(409, "الوضع المالي غير تجريبي؛ الدفع الحقيقي غير مفعّل", "ESCROW_MODE_UNSUPPORTED");
  }
}

async function escrowAccess(req: Parameters<typeof requireAccount>[0], holdId: string) {
  const account = requireAccount(req);
  const hold = await prisma.escrowHold.findUnique({
    where: { id: holdId },
    select: {
      id: true,
      purchaseOrderId: true,
      buyerOrgId: true,
      supplierOrgId: true,
      status: true,
      amountCents: true,
      currency: true,
    },
  });
  if (!hold) {
    throw new ApiError(404, "الضمان غير موجود", "NOT_FOUND");
  }
  const orgIds = account.isPlatformAdmin
    ? [hold.buyerOrgId, hold.supplierOrgId]
    : (
        await prisma.membership.findMany({
          where: { accountId: account.id, status: "ACTIVE" },
          select: { organizationId: true },
        })
      ).map((membership) => membership.organizationId);
  const allowed =
    account.isPlatformAdmin ||
    orgIds.includes(hold.buyerOrgId) ||
    orgIds.includes(hold.supplierOrgId);
  if (!allowed) {
    throw new ApiError(403, "غير مسموح لك بعرض هذا الضمان", "FORBIDDEN");
  }
  return { account, hold, orgIds, isBuyer: orgIds.includes(hold.buyerOrgId) };
}

escrowRouter.get(
  "/purchase-orders/:id/escrow",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const holds = await prisma.escrowHold.findMany({
      where: { purchaseOrderId: routeParam(req.params.id) },
      include: { conditions: true, ledger: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    if (holds.length === 0) {
      res.json({ hold: null, holds: [] });
      return;
    }
    const { hold } = await escrowAccess(req, holds[0].id);
    void hold;
    res.json({ hold: holds[0], holds });
  }),
);

escrowRouter.post(
  "/purchase-orders/:id/escrow",
  asyncRoute(async (req, res) => {
    assertDemoMode();
    const input = createEscrowSchema.parse(req.body);
    const account = requireAccount(req);
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, buyerOrgId: true, supplierOrgId: true, agreedTermsSnapshot: true },
    });
    if (!po) {
      throw new ApiError(404, "أمر الشراء غير موجود", "NOT_FOUND");
    }
    const context = await requireOrgAccess(req, po.buyerOrgId, ROLE_SETS.manageEscrow);
    assertPermission(context, "escrow.manage");
    const total = input.conditions.reduce((sum, condition) => sum + condition.percentage, 0);
    if (total !== 100) {
      throw new ApiError(400, "مجموع نسب الشروط يجب أن يساوي 100", "INVALID_CONDITIONS");
    }
    const existing = await prisma.escrowHold.findUnique({ where: { purchaseOrderId: po.id } });
    if (existing) {
      res.json({ hold: existing, duplicate: true });
      return;
    }

    const hold = await prisma.escrowHold.create({
      data: {
        purchaseOrderId: po.id,
        buyerOrgId: po.buyerOrgId,
        supplierOrgId: po.supplierOrgId,
        amountCents: BigInt(input.amountCents),
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        createdByAccountId: account.id,
        mode: "DEMO",
        conditions: {
          create: input.conditions.map((condition) => ({
            kind: condition.kind,
            title: condition.title,
            percentage: condition.percentage,
            description: condition.description,
          })),
        },
      },
      include: { conditions: true },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: po.buyerOrgId,
      action: "ESCROW_HOLD_CREATED",
      resourceType: "EscrowHold",
      resourceId: hold.id,
      metadata: { amountCents: input.amountCents.toString(), terms: po.agreedTermsSnapshot },
    });
    res.status(201).json({ hold });
  }),
);

escrowRouter.post(
  "/escrow/:id/fund",
  asyncRoute(async (req, res) => {
    assertDemoMode();
    const { account, hold } = await escrowAccess(req, routeParam(req.params.id));
    assertTransition(ESCROW_HOLD_TRANSITIONS, hold.status, "FUNDS_HELD_IN_ESCROW", "الضمان");
    const updated = await prisma.escrowHold.update({
      where: { id: hold.id },
      data: { status: "FUNDS_HELD_IN_ESCROW", fundedAt: new Date() },
    });
    await prisma.escrowLedgerEntry.create({
      data: {
        escrowHoldId: hold.id,
        type: "HOLD_CREATED",
        amountCents: hold.amountCents,
        balanceAfterCents: hold.amountCents,
        currency: hold.currency,
        idempotencyKey: `fund:${hold.id}`,
        actorAccountId: account.id,
      },
    });
    await writeOutbox({
      aggregateType: "EscrowHold",
      aggregateId: hold.id,
      eventType: "ESCROW_FUNDED",
      payload: { status: "FUNDS_HELD_IN_ESCROW" },
    });
    res.json({ hold: updated });
  }),
);

escrowRouter.post(
  "/escrow/:id/conditions/:conditionId/met",
  asyncRoute(async (req, res) => {
    assertDemoMode();
    const input = escrowConditionSchema.parse(req.body);
    const { account, hold } = await escrowAccess(req, routeParam(req.params.id));
    const condition = await prisma.escrowCondition.findFirst({
      where: { id: routeParam(req.params.conditionId), escrowHoldId: hold.id },
    });
    if (!condition) {
      throw new ApiError(404, "الشرط غير موجود", "NOT_FOUND");
    }
    assertTransition(ESCROW_CONDITION_TRANSITIONS, condition.status, "MET", "شرط الضمان");
    const updated = await prisma.escrowCondition.update({
      where: { id: condition.id },
      data: { status: "MET", metAt: new Date(), metByAccountId: account.id },
    });
    await prisma.escrowLedgerEntry.create({
      data: {
        escrowHoldId: hold.id,
        type: "CONDITION_MET",
        amountCents: 0n,
        balanceAfterCents: hold.amountCents,
        currency: hold.currency,
        idempotencyKey: input.idempotencyKey,
        actorAccountId: account.id,
        metadata: { conditionId: condition.id },
      },
    });
    res.json({ condition: updated });
  }),
);

escrowRouter.post(
  "/escrow/:id/release",
  asyncRoute(async (req, res) => {
    assertDemoMode();
    const input = escrowReleaseSchema.parse(req.body);
    const { account, hold } = await escrowAccess(req, routeParam(req.params.id));
    assertTransition(ESCROW_HOLD_TRANSITIONS, hold.status, input.status, "الضمان");
    const conditions = await prisma.escrowCondition.findMany({ where: { escrowHoldId: hold.id } });
    const pending = conditions.filter((condition) => condition.status === "PENDING");

    if (input.status === "COMPLETED" && pending.length > 0) {
      throw new ApiError(409, "لا يمكن التحرير قبل تحقق جميع الشروط", "ESCROW_CONDITIONS_PENDING");
    }
    if (input.status === "REFUNDED" && !account.isPlatformAdmin) {
      throw new ApiError(403, "الاسترداد من قبل مدير المنصة فقط", "FORBIDDEN");
    }
    if (input.status === "COMPLETED") {
      const context = await requireOrgAccess(req, hold.buyerOrgId, ROLE_SETS.manageEscrow);
      assertPermission(context, "escrow.release");
    }

    const updated = await prisma.escrowHold.update({
      where: { id: hold.id },
      data: {
        status: input.status,
        releasedAt: input.status === "COMPLETED" ? new Date() : undefined,
      },
    });
    await prisma.escrowLedgerEntry.create({
      data: {
        escrowHoldId: hold.id,
        type: input.status === "COMPLETED" ? "RELEASED" : input.status === "REFUNDED" ? "REFUNDED" : "DISPUTED",
        amountCents: input.status === "COMPLETED" ? hold.amountCents : 0n,
        balanceAfterCents: input.status === "COMPLETED" ? 0n : hold.amountCents,
        currency: hold.currency,
        idempotencyKey: input.idempotencyKey,
        actorAccountId: account.id,
      },
    });
    await writeOutbox({
      aggregateType: "EscrowHold",
      aggregateId: hold.id,
      eventType: `ESCROW_${input.status}`,
      payload: { status: input.status },
    });
    res.json({ hold: updated });
  }),
);

escrowRouter.get(
  "/escrow/:id/ledger",
  asyncRoute(async (req, res) => {
    const { hold } = await escrowAccess(req, routeParam(req.params.id));
    const ledger = await prisma.escrowLedgerEntry.findMany({
      where: { escrowHoldId: hold.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({ ledger });
  }),
);
