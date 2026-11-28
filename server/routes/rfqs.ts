import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { authenticate, requireAccount, requireOrgAccess } from "../auth";
import { prisma } from "../db";
import { writeAudit, writeOutbox } from "../domain/events";
import { assertPermission, assertRole, ROLE_SETS } from "../domain/permissions";
import { validateRequirements } from "../domain/rules";
import { assertTransition, RFQ_TRANSITIONS } from "../domain/transitions";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import {
  createRfqAttachmentSchema,
  createRfqSchema,
  inviteSuppliersSchema,
  listRfqsQuerySchema,
  rfqStatusSchema,
  updateRfqSchema,
} from "../validation";

export const rfqsRouter = Router();

rfqsRouter.use(authenticate);

rfqsRouter.get(
  "/rfqs",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const query = listRfqsQuerySchema.parse(req.query);
    const { skip, take } = getPagination(req);
    if (!account.isPlatformAdmin && query.buyerOrgId) {
      await requireOrgAccess(req, query.buyerOrgId, ROLE_SETS.createRfq);
    }
    if (!account.isPlatformAdmin && query.supplierOrgId) {
      await requireOrgAccess(req, query.supplierOrgId);
    }
    const myOrgIds = account.isPlatformAdmin
      ? []
      : (
          await prisma.membership.findMany({
            where: { accountId: account.id, status: "ACTIVE" },
            select: { organizationId: true },
          })
        ).map((membership) => membership.organizationId);

    const rfqs = await prisma.rfq.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.buyerOrgId ? { buyerOrgId: query.buyerOrgId } : {}),
        ...(query.industryId ? { industryId: query.industryId } : {}),
        ...(query.supplierOrgId
          ? { invitations: { some: { supplierOrgId: query.supplierOrgId } } }
          : account.isPlatformAdmin
            ? {}
            : {
                OR: [
                  { buyerOrgId: { in: myOrgIds } },
                  {
                    status: "PUBLISHED",
                    invitations: { some: { supplierOrgId: { in: myOrgIds } } },
                  },
                ],
              }),
      },
      include: {
        buyerOrganization: {
          select: { id: true, displayName: true, legalName: true },
        },
        industry: { select: { id: true, code: true, nameAr: true } },
        _count: { select: { invitations: true, quotes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({ rfqs });
  }),
);

rfqsRouter.post(
  "/rfqs",
  asyncRoute(async (req, res) => {
    const input = createRfqSchema.parse(req.body);
    const account = requireAccount(req);
    const context = await requireOrgAccess(req, input.buyerOrgId, ROLE_SETS.createRfq);
    assertPermission(context, "rfq.create");
    if (context.organization.type !== "BUYER") {
      throw new ApiError(400, "طلبات العرض تُنشأ من مؤسسة مشترٍ", "INVALID_ORGANIZATION_TYPE");
    }
    if (input.currency.length !== 3) {
      throw new ApiError(400, "رمز العملة يجب أن يكون 3 أحرف", "VALIDATION_ERROR");
    }

    const schemaVersion = await prisma.industrySchemaVersion.findUnique({
      where: { id: input.schemaVersionId },
      select: {
        id: true,
        industryId: true,
        status: true,
        schemaJson: true,
      },
    });
    if (
      !schemaVersion ||
      schemaVersion.status !== "PUBLISHED" ||
      schemaVersion.industryId !== input.industryId
    ) {
      throw new ApiError(400, "إصدار المخطط غير صالح", "INVALID_SCHEMA_VERSION");
    }
    validateRequirements(schemaVersion.schemaJson, input.requirements);

    const rfq = await prisma.rfq.create({
      data: {
        ...input,
        requirements: input.requirements as never,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        createdByAccountId: account.id,
      } as Prisma.RfqUncheckedCreateInput,
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: input.buyerOrgId,
      action: "RFQ_CREATED",
      resourceType: "RFQ",
      resourceId: rfq.id,
    });
    res.status(201).json({ rfq });
  }),
);

rfqsRouter.get(
  "/rfqs/:id",
  asyncRoute(async (req, res) => {
    const rfq = await prisma.rfq.findUnique({
      where: { id: routeParam(req.params.id) },
      include: {
        buyerOrganization: true,
        industry: true,
        schemaVersion: true,
        invitations: {
          include: {
            supplierOrg: {
              select: { id: true, displayName: true, legalName: true },
            },
          },
        },
        quotes: {
          select: {
            id: true,
            supplierOrgId: true,
            revision: true,
            status: true,
            currency: true,
            leadTimeDays: true,
            submittedAt: true,
          },
        },
        attachments: true,
      },
    });
    if (!rfq) {
      throw new ApiError(404, "طلب العرض غير موجود", "NOT_FOUND");
    }
    const account = requireAccount(req);
    if (!account.isPlatformAdmin) {
      const myOrgIds = (
        await prisma.membership.findMany({
          where: { accountId: account.id, status: "ACTIVE" },
          select: { organizationId: true },
        })
      ).map((membership) => membership.organizationId);
      const canView =
        myOrgIds.includes(rfq.buyerOrgId) ||
        rfq.invitations.some((invitation) => myOrgIds.includes(invitation.supplierOrgId));
      if (!canView) {
        throw new ApiError(403, "غير مسموح لك بعرض هذا الطلب", "FORBIDDEN");
      }
    }
    res.json({ rfq });
  }),
);

rfqsRouter.patch(
  "/rfqs/:id",
  asyncRoute(async (req, res) => {
    const input = updateRfqSchema.parse(req.body);
    const current = await prisma.rfq.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { status: true, buyerOrgId: true },
    });
    if (!current) {
      throw new ApiError(404, "طلب العرض غير موجود", "NOT_FOUND");
    }
    if (current.status !== "DRAFT") {
      throw new ApiError(409, "يمكن تعديل المسودة فقط", "RFQ_NOT_EDITABLE");
    }
    const context = await requireOrgAccess(req, current.buyerOrgId, ROLE_SETS.createRfq);
    assertPermission(context, "rfq.manage");

    if (input.schemaVersionId || input.industryId || input.requirements) {
      const schemaVersionId =
        input.schemaVersionId ??
        (
          await prisma.rfq.findUniqueOrThrow({
            where: { id: routeParam(req.params.id) },
            select: { schemaVersionId: true },
          })
        ).schemaVersionId;
      const schemaVersion = await prisma.industrySchemaVersion.findUnique({
        where: { id: schemaVersionId },
      });
      if (
        !schemaVersion ||
        schemaVersion.status !== "PUBLISHED" ||
        (input.industryId && schemaVersion.industryId !== input.industryId)
      ) {
        throw new ApiError(400, "إصدار المخطط غير صالح", "INVALID_SCHEMA_VERSION");
      }
      const requirements =
        input.requirements ??
        (
          await prisma.rfq.findUniqueOrThrow({
            where: { id: routeParam(req.params.id) },
            select: { requirements: true },
          })
        ).requirements;
      validateRequirements(schemaVersion.schemaJson, requirements);
    }

    const rfq = await prisma.rfq.update({
      where: { id: routeParam(req.params.id) },
      data: {
        ...input,
        requirements: input.requirements as never,
        targetDate:
          input.targetDate === undefined
            ? undefined
            : input.targetDate
              ? new Date(input.targetDate)
              : null,
      } as Prisma.RfqUncheckedUpdateInput,
    });
    res.json({ rfq });
  }),
);

rfqsRouter.post(
  "/rfqs/:id/status",
  asyncRoute(async (req, res) => {
    const input = rfqStatusSchema.parse(req.body);
    const account = requireAccount(req);
    const rfq = await prisma.rfq.findUnique({
      where: { id: routeParam(req.params.id) },
      include: { schemaVersion: true },
    });
    if (!rfq) {
      throw new ApiError(404, "طلب العرض غير موجود", "NOT_FOUND");
    }
    assertTransition(RFQ_TRANSITIONS, rfq.status, input.status, "طلب العرض");
    const context = await requireOrgAccess(req, rfq.buyerOrgId, ROLE_SETS.manageOrganization);
    if (input.status === "PUBLISHED") {
      validateRequirements(rfq.schemaVersion.schemaJson, rfq.requirements);
    }

    const updated = await prisma.rfq.update({
      where: { id: rfq.id },
      data: {
        status: input.status,
        ...(input.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
        ...(input.status === "CLOSED" ? { closedAt: new Date() } : {}),
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: rfq.buyerOrgId,
      action: "RFQ_STATUS_CHANGED",
      resourceType: "RFQ",
      resourceId: rfq.id,
      metadata: { from: rfq.status, to: input.status },
    });
    await writeOutbox({
      aggregateType: "RFQ",
      aggregateId: rfq.id,
      eventType: `RFQ_${input.status}`,
      payload: { status: input.status, buyerOrgId: rfq.buyerOrgId },
    });
    assertRole(context, ROLE_SETS.manageOrganization);
    assertPermission(context, "rfq.publish");
    res.json({ rfq: updated });
  }),
);

rfqsRouter.post(
  "/rfqs/:id/invitations",
  asyncRoute(async (req, res) => {
    const input = inviteSuppliersSchema.parse(req.body);
    const account = requireAccount(req);
    const rfq = await prisma.rfq.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, buyerOrgId: true, status: true },
    });
    if (!rfq || rfq.status !== "PUBLISHED") {
      throw new ApiError(409, "يمكن دعوة الموردين لطلب عرض منشور فقط", "RFQ_NOT_PUBLISHED");
    }
    const context = await requireOrgAccess(req, rfq.buyerOrgId, ROLE_SETS.inviteSupplier);
    assertPermission(context, "rfq.invite");

    const suppliers = await prisma.organization.findMany({
      where: { id: { in: input.supplierOrgIds }, type: "SUPPLIER" },
      select: {
        id: true,
        supplierProfile: { select: { verificationStatus: true } },
      },
    });
    if (
      suppliers.length !== input.supplierOrgIds.length ||
      suppliers.some((supplier) => supplier.supplierProfile?.verificationStatus !== "APPROVED")
    ) {
      throw new ApiError(400, "يجب أن تكون جميع المؤسسات موردين معتمدين", "INVALID_SUPPLIERS");
    }

    await prisma.rfqInvitation.createMany({
      data: input.supplierOrgIds.map((supplierOrgId) => ({
        rfqId: rfq.id,
        supplierOrgId,
      })),
      skipDuplicates: true,
    });
    for (const supplierOrgId of input.supplierOrgIds) {
      await writeOutbox({
        aggregateType: "RFQInvitation",
        aggregateId: `${rfq.id}:${supplierOrgId}`,
        eventType: "RFQ_INVITATION_SENT",
        payload: { rfqId: rfq.id, supplierOrgId },
      });
    }
    await writeAudit({
      actorAccountId: account.id,
      organizationId: rfq.buyerOrgId,
      action: "RFQ_SUPPLIERS_INVITED",
      resourceType: "RFQ",
      resourceId: rfq.id,
      metadata: { supplierOrgIds: input.supplierOrgIds },
    });
    res.status(201).json({ invited: input.supplierOrgIds.length });
  }),
);

rfqsRouter.get(
  "/rfqs/:id/invitations",
  asyncRoute(async (req, res) => {
    const rfq = await prisma.rfq.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, buyerOrgId: true },
    });
    if (!rfq) {
      throw new ApiError(404, "طلب العرض غير موجود", "NOT_FOUND");
    }
    const context = await requireOrgAccess(req, rfq.buyerOrgId, ROLE_SETS.createRfq);
    assertPermission(context, "rfq.view");
    const invitations = await prisma.rfqInvitation.findMany({
      where: { rfqId: rfq.id },
      include: {
        supplierOrg: {
          select: { id: true, displayName: true, legalName: true, countryCode: true },
        },
      },
      orderBy: { sentAt: "desc" },
    });
    res.json({ invitations });
  }),
);

rfqsRouter.get(
  "/supplier-invitations",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const orgIds = (
      await prisma.membership.findMany({
        where: { accountId: account.id, status: "ACTIVE" },
        select: { organizationId: true },
      })
    ).map((membership) => membership.organizationId);
    const invitations = await prisma.rfqInvitation.findMany({
      where: { supplierOrgId: { in: orgIds } },
      include: {
        rfq: {
          select: {
            id: true,
            title: true,
            status: true,
            quantity: true,
            unit: true,
            currency: true,
            destination: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });
    res.json({ invitations });
  }),
);

async function rfqAttachmentAccess(req: Parameters<typeof requireAccount>[0], rfqId: string) {
  const account = requireAccount(req);
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    select: {
      id: true,
      buyerOrgId: true,
      status: true,
      invitations: { select: { supplierOrgId: true } },
    },
  });
  if (!rfq) {
    throw new ApiError(404, "طلب العرض غير موجود", "NOT_FOUND");
  }
  const myOrgIds = account.isPlatformAdmin
    ? []
    : (
        await prisma.membership.findMany({
          where: { accountId: account.id, status: "ACTIVE" },
          select: { organizationId: true },
        })
      ).map((membership) => membership.organizationId);
  const canView =
    account.isPlatformAdmin ||
    myOrgIds.includes(rfq.buyerOrgId) ||
    rfq.invitations.some((invitation) => myOrgIds.includes(invitation.supplierOrgId));
  if (!canView) {
    throw new ApiError(403, "غير مسموح لك بعرض مرفقات هذا الطلب", "FORBIDDEN");
  }
  return { account, rfq, myOrgIds };
}

rfqsRouter.get(
  "/rfqs/:id/attachments",
  asyncRoute(async (req, res) => {
    const { rfq } = await rfqAttachmentAccess(req, routeParam(req.params.id));
    const attachments = await prisma.rfqAttachment.findMany({
      where: { rfqId: rfq.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ attachments });
  }),
);

rfqsRouter.post(
  "/rfqs/:id/attachments",
  asyncRoute(async (req, res) => {
    const input = createRfqAttachmentSchema.parse(req.body);
    const { account, rfq, myOrgIds } = await rfqAttachmentAccess(req, routeParam(req.params.id));
    if (rfq.status !== "DRAFT") {
      throw new ApiError(409, "يمكن إضافة المرفقات للمسودة فقط", "RFQ_NOT_EDITABLE");
    }
    if (!account.isPlatformAdmin && !myOrgIds.includes(rfq.buyerOrgId)) {
      throw new ApiError(403, "فقط صاحب الطلب يمكنه إضافة المرفقات", "FORBIDDEN");
    }
    const organizationId = account.isPlatformAdmin ? rfq.buyerOrgId : myOrgIds[0];
    if (!input.objectKey.startsWith(`${organizationId}/`)) {
      throw new ApiError(400, "مفتاح الملف يجب أن يبدأ بمعرّف المؤسسة", "INVALID_OBJECT_KEY");
    }
    const attachment = await prisma.rfqAttachment.create({
      data: {
        ...input,
        rfqId: rfq.id,
        organizationId,
        uploadedByAccountId: account.id,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId,
      action: "RFQ_ATTACHMENT_ADDED",
      resourceType: "RfqAttachment",
      resourceId: attachment.id,
    });
    res.status(201).json({ attachment });
  }),
);

rfqsRouter.delete(
  "/rfqs/:id/attachments/:attachmentId",
  asyncRoute(async (req, res) => {
    const { account, rfq, myOrgIds } = await rfqAttachmentAccess(req, routeParam(req.params.id));
    if (rfq.status !== "DRAFT") {
      throw new ApiError(409, "يمكن حذف المرفقات من المسودة فقط", "RFQ_NOT_EDITABLE");
    }
    if (!account.isPlatformAdmin && !myOrgIds.includes(rfq.buyerOrgId)) {
      throw new ApiError(403, "فقط صاحب الطلب يمكنه حذف المرفقات", "FORBIDDEN");
    }
    const attachment = await prisma.rfqAttachment.findFirst({
      where: { id: routeParam(req.params.attachmentId), rfqId: rfq.id },
    });
    if (!attachment) {
      throw new ApiError(404, "المرفق غير موجود", "NOT_FOUND");
    }
    await prisma.rfqAttachment.delete({ where: { id: attachment.id } });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: attachment.organizationId,
      action: "RFQ_ATTACHMENT_REMOVED",
      resourceType: "RfqAttachment",
      resourceId: attachment.id,
    });
    res.json({ removed: true });
  }),
);
