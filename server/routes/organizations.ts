import { Router } from "express";
import {
  authenticate,
  requireAccount,
  requireOrgAccess,
  requirePlatformAdmin,
} from "../auth";
import { prisma } from "../db";
import { writeAudit } from "../domain/events";
import { assertPermission, assertRole, ROLE_SETS } from "../domain/permissions";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import {
  addMembershipSchema,
  createOrganizationSchema,
  updateMembershipSchema,
  upsertSupplierProfileSchema,
  verifySupplierSchema,
} from "../validation";

export const organizationsRouter = Router();

organizationsRouter.use(authenticate);

organizationsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const { skip, take } = getPagination(req);
    const organizations = await prisma.organization.findMany({
      where: account.isPlatformAdmin
        ? undefined
        : { memberships: { some: { accountId: account.id, status: "ACTIVE" } } },
      include: { supplierProfile: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({ organizations });
  }),
);

organizationsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const input = createOrganizationSchema.parse(req.body);
    const account = requireAccount(req);
    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { ...input, displayName: input.displayName ?? input.legalName },
      });
      await tx.membership.create({
        data: {
          organizationId: created.id,
          accountId: account.id,
          role: "OWNER",
        },
      });
      return created;
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: organization.id,
      action: "ORGANIZATION_CREATED",
      resourceType: "Organization",
      resourceId: organization.id,
    });
    res.status(201).json({ organization });
  }),
);

organizationsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const context = await requireOrgAccess(req, routeParam(req.params.id));
    assertPermission(context, "organization.view");
    const organization = await prisma.organization.findUnique({
      where: { id: context.organizationId },
      include: {
        supplierProfile: true,
        _count: { select: { memberships: true, buyerRfqs: true, quotes: true } },
      },
    });
    res.json({ organization, role: context.role });
  }),
);

organizationsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const context = await requireOrgAccess(req, routeParam(req.params.id), ROLE_SETS.manageOrganization);
    assertPermission(context, "organization.manage");
    const input = createOrganizationSchema.partial().parse(req.body);
    const organization = await prisma.organization.update({
      where: { id: context.organizationId },
      data: input,
    });
    await writeAudit({
      actorAccountId: requireAccount(req).id,
      organizationId: organization.id,
      action: "ORGANIZATION_UPDATED",
      resourceType: "Organization",
      resourceId: organization.id,
      metadata: input,
    });
    res.json({ organization });
  }),
);

organizationsRouter.post(
  "/:id/members",
  asyncRoute(async (req, res) => {
    const context = await requireOrgAccess(req, routeParam(req.params.id), ROLE_SETS.manageMembers);
    assertPermission(context, "membership.manage");
    const input = addMembershipSchema.parse(req.body);
    const membership = await prisma.membership.create({
      data: { ...input, organizationId: context.organizationId },
    });
    await writeAudit({
      actorAccountId: requireAccount(req).id,
      organizationId: context.organizationId,
      action: "MEMBERSHIP_ADDED",
      resourceType: "Membership",
      resourceId: membership.id,
      metadata: input,
    });
    res.status(201).json({ membership });
  }),
);

organizationsRouter.patch(
  "/:id/members/:accountId",
  asyncRoute(async (req, res) => {
    const context = await requireOrgAccess(req, routeParam(req.params.id), ROLE_SETS.manageMembers);
    assertPermission(context, "membership.manage");
    const input = updateMembershipSchema.parse(req.body);
    if (input.role === undefined && input.status === undefined) {
      throw new ApiError(400, "لا توجد بيانات للتحديث", "VALIDATION_ERROR");
    }
    const membership = await prisma.membership.update({
      where: {
        organizationId_accountId: {
          organizationId: context.organizationId,
          accountId: routeParam(req.params.accountId),
        },
      },
      data: input,
    });
    res.json({ membership });
  }),
);

organizationsRouter.put(
  "/:id/supplier-profile",
  asyncRoute(async (req, res) => {
    const context = await requireOrgAccess(req, routeParam(req.params.id), ROLE_SETS.manageSupplierProfile);
    assertPermission(context, "supplierProfile.manage");
    if (context.organization.type !== "SUPPLIER") {
      throw new ApiError(400, "هذه المؤسسة ليست موردًا", "INVALID_ORGANIZATION_TYPE");
    }
    const input = upsertSupplierProfileSchema.parse(req.body);
    const profile = await prisma.supplierProfile.upsert({
      where: { organizationId: context.organizationId },
      create: {
        ...input,
        capabilities: input.capabilities as never,
        organizationId: context.organizationId,
      },
      update: { ...input, capabilities: input.capabilities as never },
    });
    res.json({ profile });
  }),
);

organizationsRouter.post(
  "/:id/verification",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const input = verifySupplierSchema.parse(req.body);
    const organization = await prisma.organization.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, type: true },
    });
    if (!organization || organization.type !== "SUPPLIER") {
      throw new ApiError(404, "المورد غير موجود", "NOT_FOUND");
    }
    const profile = await prisma.supplierProfile.upsert({
      where: { organizationId: organization.id },
      create: {
        organizationId: organization.id,
        verificationStatus: input.status,
      },
      update: { verificationStatus: input.status },
    });
    await writeAudit({
      actorAccountId: requireAccount(req).id,
      organizationId: organization.id,
      action: "SUPPLIER_VERIFICATION_CHANGED",
      resourceType: "SupplierProfile",
      resourceId: profile.organizationId,
      metadata: input,
    });
    res.json({ profile });
  }),
);

organizationsRouter.get(
  "/:id/audit",
  asyncRoute(async (req, res) => {
    const context = await requireOrgAccess(req, routeParam(req.params.id), ROLE_SETS.manageOrganization);
    assertRole(context, ROLE_SETS.manageOrganization);
    assertPermission(context, "organization.audit");
    const { skip, take } = getPagination(req);
    const events = await prisma.auditEvent.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({ events });
  }),
);
