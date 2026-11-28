import { Router } from "express";

import { authenticate, requireAccount, requireOrgAccess, requirePlatformAdmin } from "../auth";
import { prisma } from "../db";
import { writeAudit, writeOutbox } from "../domain/events";
import { assertPermission, ROLE_SETS } from "../domain/permissions";
import { assertTransition, INSPECTION_REPORT_TRANSITIONS } from "../domain/transitions";
import { ApiError, asyncRoute, routeParam } from "../http";
import { createInspectionReportSchema, inspectionStatusSchema } from "../validation";
import { assertOrganizationObjectKey } from "./products";

export const inspectionsRouter = Router();

inspectionsRouter.use(authenticate);

inspectionsRouter.get(
  "/suppliers/:id/inspection-reports",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const reports = await prisma.inspectionReport.findMany({
      where: {
        organizationId: routeParam(req.params.id),
        status: "APPROVED",
      },
      orderBy: { issuedAt: "desc" },
    });
    res.json({ reports });
  }),
);

inspectionsRouter.get(
  "/inspection-reports/:id",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const report = await prisma.inspectionReport.findUnique({
      where: { id: routeParam(req.params.id) },
      include: { organization: { select: { id: true, displayName: true } } },
    });
    if (!report) {
      throw new ApiError(404, "التقرير غير موجود", "NOT_FOUND");
    }
    res.json({ report });
  }),
);

inspectionsRouter.post(
  "/inspection-reports",
  asyncRoute(async (req, res) => {
    const input = createInspectionReportSchema.parse(req.body);
    const account = requireAccount(req);
    const context = await requireOrgAccess(req, input.organizationId, ROLE_SETS.manageInspection);
    assertPermission(context, "inspection.manage");
    if (context.organization.type !== "SUPPLIER") {
      throw new ApiError(400, "التقارير تُنشأ لمؤسسات الموردين فقط", "INVALID_ORGANIZATION_TYPE");
    }
    assertOrganizationObjectKey(input.objectKey, input.organizationId);

    const report = await prisma.inspectionReport.create({
      data: {
        ...input,
        summary: (input.summary ?? undefined) as never,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: input.organizationId,
      action: "INSPECTION_REPORT_CREATED",
      resourceType: "InspectionReport",
      resourceId: report.id,
    });
    res.status(201).json({ report });
  }),
);

inspectionsRouter.post(
  "/inspection-reports/:id/status",
  asyncRoute(async (req, res) => {
    const input = inspectionStatusSchema.parse(req.body);
    const account = requireAccount(req);
    const report = await prisma.inspectionReport.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, organizationId: true, status: true },
    });
    if (!report) {
      throw new ApiError(404, "التقرير غير موجود", "NOT_FOUND");
    }
    assertTransition(INSPECTION_REPORT_TRANSITIONS, report.status, input.status, "تقرير الفحص");

    if (input.status === "APPROVED" || input.status === "REJECTED") {
      requirePlatformAdmin(req);
      const context = await requireOrgAccess(req, report.organizationId);
      assertPermission(context, "inspection.review");
    } else {
      const context = await requireOrgAccess(req, report.organizationId, ROLE_SETS.manageInspection);
      assertPermission(context, "inspection.manage");
    }

    const updated = await prisma.inspectionReport.update({
      where: { id: report.id },
      data: {
        status: input.status,
        notes: input.notes,
        ...(input.status === "APPROVED" ? { reviewedAt: new Date(), verifiedByAccountId: account.id } : {}),
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: report.organizationId,
      action: "INSPECTION_REPORT_STATUS_CHANGED",
      resourceType: "InspectionReport",
      resourceId: report.id,
      metadata: { from: report.status, to: input.status, notes: input.notes },
    });
    await writeOutbox({
      aggregateType: "InspectionReport",
      aggregateId: report.id,
      eventType: `INSPECTION_${input.status}`,
      payload: { status: input.status, organizationId: report.organizationId },
    });
    res.json({ report: updated });
  }),
);

inspectionsRouter.get(
  "/admin/inspection-reports",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const reports = await prisma.inspectionReport.findMany({
      where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } },
      include: { organization: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ reports });
  }),
);
