import { Router } from "express";

import { authenticate, requireAccount, requireOrgAccess } from "../auth";
import { prisma } from "../db";
import { writeAudit, writeOutbox } from "../domain/events";
import { assertPermission, ROLE_SETS } from "../domain/permissions";
import { assertTransition, SHIPMENT_TRANSITIONS } from "../domain/transitions";
import { ApiError, asyncRoute, routeParam } from "../http";
import { createShipmentSchema, shipmentEventSchema } from "../validation";

export const shipmentsRouter = Router();

shipmentsRouter.use(authenticate);

async function organizationIds(accountId: string): Promise<string[]> {
  return (
    await prisma.membership.findMany({
      where: { accountId, status: "ACTIVE" },
      select: { organizationId: true },
    })
  ).map((membership) => membership.organizationId);
}

async function shipmentAccess(req: Parameters<typeof requireAccount>[0], shipmentId: string) {
  const account = requireAccount(req);
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      purchaseOrderId: true,
      organizationId: true,
      status: true,
      trackingNumber: true,
    },
  });
  if (!shipment) {
    throw new ApiError(404, "الشحنة غير موجودة", "NOT_FOUND");
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: shipment.purchaseOrderId },
    select: { buyerOrgId: true, supplierOrgId: true },
  });
  if (!po) {
    throw new ApiError(404, "أمر الشراء غير موجود", "NOT_FOUND");
  }
  const orgIds = await organizationIds(account.id);
  const allowed =
    account.isPlatformAdmin ||
    orgIds.includes(po.buyerOrgId) ||
    orgIds.includes(po.supplierOrgId) ||
    orgIds.includes(shipment.organizationId);
  if (!allowed) {
    throw new ApiError(403, "غير مسموح لك بعرض هذه الشحنة", "FORBIDDEN");
  }
  return { account, shipment, po, orgIds, isSupplier: orgIds.includes(po.supplierOrgId) };
}

shipmentsRouter.get(
  "/purchase-orders/:id/shipments",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const shipments = await prisma.shipment.findMany({
      where: { purchaseOrderId: routeParam(req.params.id) },
      include: { events: { orderBy: { occurredAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ shipments });
  }),
);

shipmentsRouter.post(
  "/purchase-orders/:id/shipments",
  asyncRoute(async (req, res) => {
    const input = createShipmentSchema.parse(req.body);
    const account = requireAccount(req);
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, supplierOrgId: true },
    });
    if (!po) {
      throw new ApiError(404, "أمر الشراء غير موجود", "NOT_FOUND");
    }
    const context = await requireOrgAccess(req, po.supplierOrgId, ROLE_SETS.manageShipment);
    assertPermission(context, "shipment.manage");
    const shipment = await prisma.shipment.create({
      data: {
        ...input,
        purchaseOrderId: po.id,
        organizationId: po.supplierOrgId,
        createdByAccountId: account.id,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: po.supplierOrgId,
      action: "SHIPMENT_CREATED",
      resourceType: "Shipment",
      resourceId: shipment.id,
    });
    res.status(201).json({ shipment });
  }),
);

shipmentsRouter.post(
  "/shipments/:id/events",
  asyncRoute(async (req, res) => {
    const input = shipmentEventSchema.parse(req.body);
    const { account, shipment, isSupplier } = await shipmentAccess(req, routeParam(req.params.id));
    if (!isSupplier && !account.isPlatformAdmin) {
      throw new ApiError(403, "تحديث الشحن من قبل المورد فقط", "FORBIDDEN");
    }
    assertTransition(SHIPMENT_TRANSITIONS, shipment.status, input.status, "الشحنة");
    const event = await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        status: input.status,
        occurredAt: new Date(input.occurredAt),
        location: input.location,
        note: input.note,
        idempotencyKey: input.idempotencyKey,
      },
    });
    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: input.status,
        ...(input.status === "PICKED_UP" ? { shippedAt: new Date(input.occurredAt) } : {}),
        ...(input.status === "DELIVERED" ? { deliveredAt: new Date(input.occurredAt) } : {}),
      },
    });
    await writeOutbox({
      aggregateType: "Shipment",
      aggregateId: shipment.id,
      eventType: `SHIPMENT_${input.status}`,
      payload: { status: input.status, trackingNumber: shipment.trackingNumber },
    });
    res.status(201).json({ event, shipment: updated });
  }),
);

shipmentsRouter.post(
  "/shipments/:id/deliver",
  asyncRoute(async (req, res) => {
    const { account, shipment, po } = await shipmentAccess(req, routeParam(req.params.id));
    const orgIds = (
      await prisma.membership.findMany({
        where: { accountId: account.id, status: "ACTIVE" },
        select: { organizationId: true },
      })
    ).map((membership) => membership.organizationId);
    if (!account.isPlatformAdmin && !orgIds.includes(po.buyerOrgId)) {
      throw new ApiError(403, "تأكيد التسليم من قبل المشتري فقط", "FORBIDDEN");
    }
    assertTransition(SHIPMENT_TRANSITIONS, shipment.status, "DELIVERED", "الشحنة");
    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        status: "DELIVERED",
        occurredAt: new Date(),
        source: "BUYER_CONFIRMATION",
        idempotencyKey: `delivery:${shipment.id}`,
      },
    });
    await writeOutbox({
      aggregateType: "Shipment",
      aggregateId: shipment.id,
      eventType: "SHIPMENT_DELIVERED",
      payload: { status: "DELIVERED" },
    });
    res.json({ shipment: updated });
  }),
);
