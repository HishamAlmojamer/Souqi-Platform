import { Prisma } from "@prisma/client";
import { Router } from "express";
import { authenticate, requireAccount, requireOrgAccess } from "../auth";
import { prisma } from "../db";
import { writeAudit, writeOutbox } from "../domain/events";
import { assertPermission, ROLE_SETS } from "../domain/permissions";
import { assertTransition, QUOTE_TRANSITIONS } from "../domain/transitions";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import { awardSchema, createQuoteSchema, quoteStatusSchema } from "../validation";

export const quotesRouter = Router();

quotesRouter.use(authenticate);

type QuoteWithLines = Prisma.QuoteGetPayload<{ include: { lines: true } }>;

function serializeQuote(quote: QuoteWithLines) {
  return {
    ...quote,
    lines: quote.lines.map((line) => ({
      ...line,
      unitPriceCents: line.unitPriceCents.toString(),
      totalPriceCents: line.totalPriceCents.toString(),
    })),
  };
}

quotesRouter.get(
  "/rfqs/:id/quotes",
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
    const rfq = await prisma.rfq.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { buyerOrgId: true, status: true },
    });
    if (!rfq) {
      throw new ApiError(404, "طلب العرض غير موجود", "NOT_FOUND");
    }
    if (!account.isPlatformAdmin && !myOrgIds.includes(rfq.buyerOrgId)) {
      const invited = await prisma.rfqInvitation.findFirst({
        where: { rfqId: routeParam(req.params.id), supplierOrgId: { in: myOrgIds } },
        select: { id: true },
      });
      if (!invited) {
        throw new ApiError(403, "غير مسموح لك بعرض عروض هذا الطلب", "FORBIDDEN");
      }
    }

    const quotes = await prisma.quote.findMany({
      where: {
        rfqId: routeParam(req.params.id),
        ...(account.isPlatformAdmin ||
        myOrgIds.includes(rfq.buyerOrgId)
          ? {}
          : { supplierOrgId: { in: myOrgIds } }),
      },
      include: { lines: true, supplierOrg: { select: { id: true, displayName: true } } },
      orderBy: { submittedAt: "desc" },
      skip,
      take,
    });
    res.json({ quotes: quotes.map(serializeQuote) });
  }),
);

quotesRouter.post(
  "/quotes",
  asyncRoute(async (req, res) => {
    const input = createQuoteSchema.parse(req.body);
    const account = requireAccount(req);
    const context = await requireOrgAccess(req, input.supplierOrgId, ROLE_SETS.submitQuote);
    assertPermission(context, "quote.create");
    if (context.organization.type !== "SUPPLIER") {
      throw new ApiError(400, "العروض تُنشأ من مؤسسة مورد فقط", "INVALID_ORGANIZATION_TYPE");
    }
    const profile = await prisma.supplierProfile.findUnique({
      where: { organizationId: input.supplierOrgId },
      select: { verificationStatus: true },
    });
    if (profile?.verificationStatus !== "APPROVED") {
      throw new ApiError(403, "المورد غير معتمد", "SUPPLIER_NOT_APPROVED");
    }

    const rfq = await prisma.rfq.findUnique({
      where: { id: input.rfqId },
      select: { id: true, status: true, buyerOrgId: true },
    });
    if (!rfq || rfq.status !== "PUBLISHED") {
      throw new ApiError(409, "يمكن تقديم العرض لطلب عرض منشور فقط", "RFQ_NOT_PUBLISHED");
    }
    const invitation = await prisma.rfqInvitation.findUnique({
      where: {
        rfqId_supplierOrgId: {
          rfqId: input.rfqId,
          supplierOrgId: input.supplierOrgId,
        },
      },
      select: { id: true, status: true },
    });
    if (!invitation || invitation.status !== "PENDING") {
      throw new ApiError(403, "لم تتلقَّ دعوة صالحة لهذا الطلب", "NOT_INVITED");
    }

    const quote = await prisma.$transaction(async (tx) => {
      const previous = await tx.quote.findUnique({
        where: {
          rfqId_supplierOrgId_revision: {
            rfqId: input.rfqId,
            supplierOrgId: input.supplierOrgId,
            revision: input.revision,
          },
        },
        select: { id: true },
      });
      if (previous) {
        throw new ApiError(409, "رقم المراجعة مستخدم بالفعل", "REVISION_EXISTS");
      }
      if (input.revision > 1) {
        await tx.quote.updateMany({
          where: {
            rfqId: input.rfqId,
            supplierOrgId: input.supplierOrgId,
            revision: input.revision - 1,
            status: "SUBMITTED",
          },
          data: { status: "SUPERSEDED" },
        });
      }
      return tx.quote.create({
        data: {
          rfqId: input.rfqId,
          supplierOrgId: input.supplierOrgId,
          revision: input.revision,
          currency: input.currency,
          leadTimeDays: input.leadTimeDays,
          validUntil: new Date(input.validUntil),
          notes: input.notes ?? null,
          lines: {
            create: input.lines.map((line) => ({
              name: line.name,
              quantity: line.quantity,
              unitPriceCents: BigInt(line.unitPriceCents),
              totalPriceCents: BigInt(line.unitPriceCents * line.quantity),
            })),
          },
        },
        include: { lines: true },
      });
    });
    await prisma.rfqInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: input.supplierOrgId,
      action: "QUOTE_CREATED",
      resourceType: "Quote",
      resourceId: quote.id,
      metadata: { rfqId: input.rfqId, revision: input.revision },
    });
    await writeOutbox({
      aggregateType: "Quote",
      aggregateId: quote.id,
      eventType: "QUOTE_SUBMITTED",
      payload: { rfqId: input.rfqId, supplierOrgId: input.supplierOrgId },
    });
    res.status(201).json({ quote: serializeQuote(quote) });
  }),
);

quotesRouter.get(
  "/quotes/:id",
  asyncRoute(async (req, res) => {
    const quote = await prisma.quote.findUnique({
      where: { id: routeParam(req.params.id) },
      include: {
        lines: true,
        supplierOrg: { select: { id: true, displayName: true, legalName: true } },
        rfq: { select: { id: true, title: true, buyerOrgId: true, status: true } },
      },
    });
    if (!quote) {
      throw new ApiError(404, "العرض غير موجود", "NOT_FOUND");
    }
    const account = requireAccount(req);
    if (!account.isPlatformAdmin) {
      const myOrgIds = (
        await prisma.membership.findMany({
          where: { accountId: account.id, status: "ACTIVE" },
          select: { organizationId: true },
        })
      ).map((membership) => membership.organizationId);
      if (
        !myOrgIds.includes(quote.rfq.buyerOrgId) &&
        !myOrgIds.includes(quote.supplierOrgId)
      ) {
        throw new ApiError(403, "غير مسموح لك بعرض هذا العرض", "FORBIDDEN");
      }
    }
    res.json({ quote: serializeQuote(quote) });
  }),
);

quotesRouter.post(
  "/quotes/:id/status",
  asyncRoute(async (req, res) => {
    const input = quoteStatusSchema.parse(req.body);
    const account = requireAccount(req);
    const quote = await prisma.quote.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, supplierOrgId: true, status: true },
    });
    if (!quote) {
      throw new ApiError(404, "العرض غير موجود", "NOT_FOUND");
    }
    assertTransition(QUOTE_TRANSITIONS, quote.status, input.status, "العرض");
    const context = await requireOrgAccess(req, quote.supplierOrgId, ROLE_SETS.submitQuote);
    assertPermission(context, "quote.manage");
    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: { status: input.status },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: quote.supplierOrgId,
      action: "QUOTE_STATUS_CHANGED",
      resourceType: "Quote",
      resourceId: quote.id,
      metadata: { from: quote.status, to: input.status },
    });
    res.json({ quote: updated });
  }),
);

quotesRouter.post(
  "/rfqs/:id/award",
  asyncRoute(async (req, res) => {
    const input = awardSchema.parse(req.body);
    const account = requireAccount(req);
    const rfq = await prisma.rfq.findUnique({
      where: { id: routeParam(req.params.id) },
      select: {
        id: true,
        buyerOrgId: true,
        status: true,
        requirements: true,
        title: true,
        quantity: true,
        unit: true,
        currency: true,
      },
    });
    if (!rfq || rfq.status !== "PUBLISHED") {
      throw new ApiError(409, "يمكن ترسية طلب عرض منشور فقط", "RFQ_NOT_PUBLISHED");
    }
    const context = await requireOrgAccess(req, rfq.buyerOrgId, ROLE_SETS.awardQuote);
    assertPermission(context, "rfq.award");
    const quote = await prisma.quote.findUnique({
      where: { id: input.quoteId },
      include: { lines: true },
    });
    if (!quote || quote.rfqId !== rfq.id || quote.status !== "SUBMITTED") {
      throw new ApiError(409, "العرض غير صالح للترسية", "QUOTE_NOT_AWARDED");
    }

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          rfqId: rfq.id,
          quoteId: quote.id,
          buyerOrgId: rfq.buyerOrgId,
          supplierOrgId: quote.supplierOrgId,
          status: "ACTIVE",
          createdByAccountId: account.id,
          agreedTermsSnapshot: {
            title: rfq.title,
            quantity: rfq.quantity,
            unit: rfq.unit,
            currency: rfq.currency,
            requirements: rfq.requirements,
            quote: {
              revision: quote.revision,
              leadTimeDays: quote.leadTimeDays,
              validUntil: quote.validUntil,
              notes: quote.notes,
              lines: quote.lines.map((line) => ({
                name: line.name,
                quantity: line.quantity,
                unitPriceCents: line.unitPriceCents.toString(),
                totalPriceCents: line.totalPriceCents.toString(),
              })),
            },
            note: input.note ?? null,
          } as never,
        },
      });
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: "SUBMITTED" },
      });
      await tx.quote.updateMany({
        where: {
          rfqId: rfq.id,
          id: { not: quote.id },
          status: "SUBMITTED",
        },
        data: { status: "LOST" },
      });
      await tx.rfq.update({
        where: { id: rfq.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      return created;
    });

    await writeAudit({
      actorAccountId: account.id,
      organizationId: rfq.buyerOrgId,
      action: "QUOTE_AWARDED",
      resourceType: "PurchaseOrder",
      resourceId: purchaseOrder.id,
      metadata: { rfqId: rfq.id, quoteId: quote.id },
    });
    await writeOutbox({
      aggregateType: "PurchaseOrder",
      aggregateId: purchaseOrder.id,
      eventType: "PURCHASE_ORDER_CREATED",
      payload: { rfqId: rfq.id, quoteId: quote.id },
    });
    res.status(201).json({ purchaseOrder });
  }),
);
