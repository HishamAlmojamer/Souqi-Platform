import { Router } from "express";
import { authenticate, requireAccount, requireOrgAccess } from "../auth";
import { prisma } from "../db";
import { writeAudit, writeOutbox } from "../domain/events";
import { assertPermission, ROLE_SETS } from "../domain/permissions";
import {
  assertTransition,
  MILESTONE_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS,
  SAMPLE_TRANSITIONS,
} from "../domain/transitions";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import {
  createEvidenceSchema,
  createMilestoneSchema,
  createSampleSchema,
  poStatusSchema,
  updateMilestoneSchema,
  updateSampleSchema,
} from "../validation";

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.use(authenticate);

async function getPo(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: {
      id: true,
      buyerOrgId: true,
      supplierOrgId: true,
      status: true,
    },
  });
  if (!po) {
    throw new ApiError(404, "أمر الشراء غير موجود", "NOT_FOUND");
  }
  return po;
}

purchaseOrdersRouter.get(
  "/purchase-orders",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const { skip, take } = getPagination(req);
    const myOrgIds = account.isPlatformAdmin
      ? []
      : (
          await prisma.membership.findMany({
            where: { accountId: account.id, status: "ACTIVE" },
            select: { organizationId: true },
          })
        ).map((membership) => membership.organizationId);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(account.isPlatformAdmin
          ? {}
          : {
              OR: [
                { buyerOrgId: { in: myOrgIds } },
                { supplierOrgId: { in: myOrgIds } },
              ],
            }),
      },
      include: {
        buyerOrganization: { select: { id: true, displayName: true } },
        supplierOrg: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({ purchaseOrders });
  }),
);

purchaseOrdersRouter.get(
  "/purchase-orders/:id",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: routeParam(req.params.id) },
      include: {
        rfq: { select: { id: true, title: true, quantity: true, unit: true } },
        quote: { select: { id: true, revision: true, leadTimeDays: true } },
        buyerOrganization: { select: { id: true, displayName: true } },
        supplierOrg: { select: { id: true, displayName: true } },
        samples: { orderBy: { version: "desc" } },
        milestones: { orderBy: { sequence: "asc" } },
        evidenceFiles: {
          select: {
            id: true,
            objectKey: true,
            classification: true,
            scanStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!po) {
      throw new ApiError(404, "أمر الشراء غير موجود", "NOT_FOUND");
    }
    if (!account.isPlatformAdmin) {
      const myOrgIds = (
        await prisma.membership.findMany({
          where: { accountId: account.id, status: "ACTIVE" },
          select: { organizationId: true },
        })
      ).map((membership) => membership.organizationId);
      if (!myOrgIds.includes(po.buyerOrgId) && !myOrgIds.includes(po.supplierOrgId)) {
        throw new ApiError(403, "غير مسموح لك بعرض هذا الأمر", "FORBIDDEN");
      }
    }
    res.json({ purchaseOrder: po });
  }),
);

purchaseOrdersRouter.patch(
  "/purchase-orders/:id/status",
  asyncRoute(async (req, res) => {
    const input = poStatusSchema.parse(req.body);
    const account = requireAccount(req);
    const current = await prisma.purchaseOrder.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, buyerOrgId: true, supplierOrgId: true, status: true },
    });
    if (!current) {
      throw new ApiError(404, "أمر الشراء غير موجود", "NOT_FOUND");
    }
    assertTransition(PURCHASE_ORDER_TRANSITIONS, current.status, input.status, "أمر الشراء");
    const context = await requireOrgAccess(req, current.buyerOrgId, ROLE_SETS.manageProduction);
    assertPermission(context, "purchaseOrder.manage");
    const updated = await prisma.purchaseOrder.update({
      where: { id: current.id },
      data: { status: input.status },
    });
    await writeAudit({
      actorAccountId: account.id,
      action: "PURCHASE_ORDER_STATUS_CHANGED",
      resourceType: "PurchaseOrder",
      resourceId: current.id,
      metadata: { from: current.status, to: input.status },
    });
    await writeOutbox({
      aggregateType: "PurchaseOrder",
      aggregateId: current.id,
      eventType: `PURCHASE_ORDER_${input.status}`,
      payload: { status: input.status },
    });
    res.json({ purchaseOrder: updated });
  }),
);

purchaseOrdersRouter.post(
  "/purchase-orders/:id/samples",
  asyncRoute(async (req, res) => {
    const input = createSampleSchema.parse(req.body);
    const account = requireAccount(req);
    const po = await getPo(routeParam(req.params.id));
    const supplierContext = await requireOrgAccess(
      req,
      po.supplierOrgId,
      ROLE_SETS.manageProduction,
    );
    assertPermission(supplierContext, "sample.manage");
    if (supplierContext.organizationId !== po.supplierOrgId) {
      throw new ApiError(403, "فقط المورد يمكنه إضافة عينات", "FORBIDDEN");
    }
    const sample = await prisma.sample.create({
      data: {
        purchaseOrderId: po.id,
        version: input.version,
        status: "REQUESTED",
        notes: input.notes ?? null,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: po.supplierOrgId,
      action: "SAMPLE_CREATED",
      resourceType: "Sample",
      resourceId: sample.id,
      metadata: { version: sample.version },
    });
    res.status(201).json({ sample });
  }),
);

purchaseOrdersRouter.post(
  "/samples/:id/status",
  asyncRoute(async (req, res) => {
    const input = updateSampleSchema.parse(req.body);
    const account = requireAccount(req);
    const sample = await prisma.sample.findUnique({
      where: { id: routeParam(req.params.id) },
      include: {
        purchaseOrder: {
          select: { id: true, buyerOrgId: true, supplierOrgId: true },
        },
      },
    });
    if (!sample) {
      throw new ApiError(404, "العينة غير موجودة", "NOT_FOUND");
    }
    assertTransition(SAMPLE_TRANSITIONS, sample.status, input.status, "العينة");

    const supplierStatuses = ["IN_PREPARATION", "SHIPPED"];
    const buyerStatuses = ["RECEIVED", "REVISION_REQUESTED", "APPROVED", "REJECTED"];
    if (supplierStatuses.includes(input.status)) {
      const context = await requireOrgAccess(
        req,
        sample.purchaseOrder.supplierOrgId,
        ROLE_SETS.manageProduction,
      );
      assertPermission(context, "sample.manage");
      if (context.organizationId !== sample.purchaseOrder.supplierOrgId) {
        throw new ApiError(403, "غير مسموح لك بهذا الإجراء", "FORBIDDEN");
      }
    } else if (buyerStatuses.includes(input.status)) {
      const context = await requireOrgAccess(
        req,
        sample.purchaseOrder.buyerOrgId,
        ROLE_SETS.manageProduction,
      );
      assertPermission(context, "sample.manage");
      if (context.organizationId !== sample.purchaseOrder.buyerOrgId) {
        throw new ApiError(403, "غير مسموح لك بهذا الإجراء", "FORBIDDEN");
      }
    } else {
      throw new ApiError(400, "حالة العينة غير مدعومة", "VALIDATION_ERROR");
    }

    const updated = await prisma.sample.update({
      where: { id: sample.id },
      data: {
        status: input.status,
        notes: input.notes ?? undefined,
        shippedAt:
          input.shippedAt && input.status === "SHIPPED"
            ? new Date(input.shippedAt)
            : undefined,
        receivedAt:
          input.receivedAt && input.status === "RECEIVED"
            ? new Date(input.receivedAt)
            : undefined,
        decidedAt:
          input.status === "APPROVED" || input.status === "REJECTED"
            ? new Date()
            : undefined,
        decidedByAccountId:
          input.status === "APPROVED" || input.status === "REJECTED"
            ? account.id
            : undefined,
      },
    });
    await writeOutbox({
      aggregateType: "Sample",
      aggregateId: sample.id,
      eventType: `SAMPLE_${input.status}`,
      payload: { purchaseOrderId: sample.purchaseOrderId, status: input.status },
    });
    res.json({ sample: updated });
  }),
);

purchaseOrdersRouter.post(
  "/purchase-orders/:id/milestones",
  asyncRoute(async (req, res) => {
    const input = createMilestoneSchema.parse(req.body);
    const account = requireAccount(req);
    const current = await prisma.purchaseOrder.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, supplierOrgId: true },
    });
    if (!current) {
      throw new ApiError(404, "أمر الشراء غير موجود", "NOT_FOUND");
    }
    const context = await requireOrgAccess(
      req,
      current.supplierOrgId,
      ROLE_SETS.manageProduction,
    );
    assertPermission(context, "milestone.manage");
    if (context.organizationId !== current.supplierOrgId) {
      throw new ApiError(403, "فقط المورد يمكنه إضافة مراحل الإنتاج", "FORBIDDEN");
    }
    const milestone = await prisma.productionMilestone.create({
      data: {
        purchaseOrderId: current.id,
        code: input.code,
        sequence: input.sequence,
        plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
        note: input.note ?? null,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: current.supplierOrgId,
      action: "MILESTONE_CREATED",
      resourceType: "ProductionMilestone",
      resourceId: milestone.id,
      metadata: { code: milestone.code },
    });
    res.status(201).json({ milestone });
  }),
);

purchaseOrdersRouter.post(
  "/milestones/:id/status",
  asyncRoute(async (req, res) => {
    const input = updateMilestoneSchema.parse(req.body);
    const milestone = await prisma.productionMilestone.findUnique({
      where: { id: routeParam(req.params.id) },
      include: {
        purchaseOrder: { select: { supplierOrgId: true } },
      },
    });
    if (!milestone) {
      throw new ApiError(404, "المرحلة غير موجودة", "NOT_FOUND");
    }
    assertTransition(MILESTONE_TRANSITIONS, milestone.status, input.status, "المرحلة");
    const context = await requireOrgAccess(
      req,
      milestone.purchaseOrder.supplierOrgId,
      ROLE_SETS.manageProduction,
    );
    assertPermission(context, "milestone.manage");
    if (context.organizationId !== milestone.purchaseOrder.supplierOrgId) {
      throw new ApiError(403, "غير مسموح لك بهذا الإجراء", "FORBIDDEN");
    }
    const updated = await prisma.productionMilestone.update({
      where: { id: milestone.id },
      data: {
        status: input.status,
        completedAt:
          input.completedAt && input.status === "DONE"
            ? new Date(input.completedAt)
            : input.status === "DONE"
              ? new Date()
              : undefined,
        note: input.note ?? undefined,
      },
    });
    await writeOutbox({
      aggregateType: "ProductionMilestone",
      aggregateId: milestone.id,
      eventType: `MILESTONE_${input.status}`,
      payload: { status: input.status },
    });
    res.json({ milestone: updated });
  }),
);

purchaseOrdersRouter.post(
  "/evidence",
  asyncRoute(async (req, res) => {
    const input = createEvidenceSchema.parse(req.body);
    const account = requireAccount(req);
    const context = await requireOrgAccess(
      req,
      input.organizationId,
      ROLE_SETS.uploadEvidence,
    );
    assertPermission(context, "evidence.upload");
    if (!input.objectKey.startsWith(`${context.organizationId}/`)) {
      throw new ApiError(400, "مفتاح الملف يجب أن يبدأ بمعرّف المؤسسة", "INVALID_OBJECT_KEY");
    }
    if (input.purchaseOrderId) {
      const po = await getPo(input.purchaseOrderId);
      if (po.buyerOrgId !== context.organizationId && po.supplierOrgId !== context.organizationId) {
        throw new ApiError(404, "أمر الشراء غير موجود", "NOT_FOUND");
      }
    }
    if (input.milestoneId) {
      const milestone = await prisma.productionMilestone.findUnique({
        where: { id: input.milestoneId },
        include: { purchaseOrder: true },
      });
      if (
        !milestone ||
        milestone.purchaseOrder.buyerOrgId !== context.organizationId &&
          milestone.purchaseOrder.supplierOrgId !== context.organizationId
      ) {
        throw new ApiError(404, "المرحلة غير موجودة", "NOT_FOUND");
      }
      if (input.purchaseOrderId && milestone.purchaseOrderId !== input.purchaseOrderId) {
        throw new ApiError(400, "المرحلة لا تتبع أمر الشراء المحدد", "INVALID_MILESTONE");
      }
    }

    const evidence = await prisma.evidenceFile.create({
      data: {
        organizationId: context.organizationId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        milestoneId: input.milestoneId ?? null,
        objectKey: input.objectKey,
        checksum: input.checksum,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        classification: input.classification,
        uploadedByAccountId: account.id,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: context.organizationId,
      action: "EVIDENCE_REGISTERED",
      resourceType: "EvidenceFile",
      resourceId: evidence.id,
      metadata: { objectKey: evidence.objectKey },
    });
    res.status(201).json({ evidence });
  }),
);
