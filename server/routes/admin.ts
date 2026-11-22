import bcrypt from "bcryptjs";
import { Router } from "express";
import { authenticate, requirePlatformAdmin } from "../auth";
import { prisma } from "../db";
import { writeAudit } from "../domain/events";
import {
  highestRole,
  PERMISSION_CATALOG,
  permissionsForRole,
  ROLE_LABELS,
  type PlatformRole,
} from "../domain/permissions";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import {
  adminCreateAccountSchema,
  addMemberByEmailSchema,
  createOrganizationSchema,
  membershipRoleSchema,
  membershipStatusSchema,
  organizationStatusSchema,
  platformAdminSchema,
  verifySupplierSchema,
} from "../validation";

export const adminRouter = Router();

adminRouter.get(
  "/permissions",
  authenticate,
  asyncRoute(async (_req, res) => {
    res.json({
      permissions: PERMISSION_CATALOG,
      roles: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
    });
  }),
);

adminRouter.use("/admin", authenticate);

adminRouter.get(
  "/admin/overview",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const [accounts, organizations, rfqGroups, quotes, purchaseOrders, pendingSuppliers, pendingEvents] =
      await Promise.all([
        prisma.platformAccount.count(),
        prisma.organization.count(),
        prisma.rfq.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.quote.count(),
        prisma.purchaseOrder.count(),
        prisma.supplierProfile.count({
          where: { verificationStatus: { in: ["SUBMITTED", "IN_REVIEW"] } },
        }),
        prisma.outboxEvent.count({ where: { publishedAt: null } }),
      ]);
    res.json({
      overview: {
        accounts,
        organizations,
        quotes,
        purchaseOrders,
        pendingSupplierVerifications: pendingSuppliers,
        pendingEvents,
        rfqsByStatus: Object.fromEntries(
          rfqGroups.map((group) => [group.status, group._count._all]),
        ),
      },
    });
  }),
);

adminRouter.get(
  "/admin/accounts",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const { skip, take } = getPagination(req);
    const accounts = await prisma.platformAccount.findMany({
      select: {
        id: true,
        fullName: true,
        companyName: true,
        email: true,
        accountType: true,
        isPlatformAdmin: true,
        createdAt: true,
        memberships: {
          select: {
            id: true,
            role: true,
            status: true,
            organization: {
              select: { id: true, displayName: true, type: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({
      accounts: accounts.map((account) => {
        const roles: PlatformRole[] = account.isPlatformAdmin
          ? ["PLATFORM_ADMIN"]
          : account.memberships.map((membership) => membership.role);
        const role = highestRole(roles);
        return {
          ...account,
          role,
          roleLabel: role ? ROLE_LABELS[role] : null,
          permissions: role ? permissionsForRole(role) : [],
        };
      }),
    });
  }),
);

adminRouter.post(
  "/admin/accounts",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const input = adminCreateAccountSchema.parse(req.body);
    const existing = await prisma.platformAccount.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError(409, "البريد الإلكتروني مستخدم بالفعل", "EMAIL_ALREADY_EXISTS");
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.platformAccount.create({
        data: {
          fullName: input.fullName,
          companyName: input.companyName,
          email: input.email,
          passwordHash,
          accountType: input.accountType,
          isPlatformAdmin: input.isPlatformAdmin,
        },
      });
      const organization = await tx.organization.create({
        data: {
          type: input.accountType,
          legalName: input.companyName,
          displayName: input.companyName,
          countryCode: "SA",
        },
      });
      await tx.membership.create({
        data: { organizationId: organization.id, accountId: created.id, role: "OWNER" },
      });
      return created;
    });
    await writeAudit({
      actorAccountId: actor.id,
      action: "ACCOUNT_CREATED_BY_ADMIN",
      resourceType: "PlatformAccount",
      resourceId: account.id,
      metadata: {
        email: account.email,
        accountType: account.accountType,
        isPlatformAdmin: account.isPlatformAdmin,
      },
    });
    res.status(201).json({
      account: {
        id: account.id,
        fullName: account.fullName,
        companyName: account.companyName,
        email: account.email,
        accountType: account.accountType,
        isPlatformAdmin: account.isPlatformAdmin,
        createdAt: account.createdAt,
      },
    });
  }),
);

adminRouter.patch(
  "/admin/accounts/:id/admin",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const input = platformAdminSchema.parse(req.body);
    const accountId = routeParam(req.params.id);
    const account = await prisma.platformAccount.findUnique({
      where: { id: accountId },
      select: { id: true, isPlatformAdmin: true },
    });
    if (!account) {
      throw new ApiError(404, "الحساب غير موجود", "NOT_FOUND");
    }
    if (account.isPlatformAdmin && !input.isPlatformAdmin) {
      const adminCount = await prisma.platformAccount.count({
        where: { isPlatformAdmin: true },
      });
      if (adminCount <= 1) {
        throw new ApiError(409, "يجب أن يبقى مدير منصة واحد على الأقل", "LAST_ADMIN");
      }
    }
    const updated = await prisma.platformAccount.update({
      where: { id: accountId },
      data: { isPlatformAdmin: input.isPlatformAdmin },
      select: {
        id: true,
        fullName: true,
        email: true,
        isPlatformAdmin: true,
      },
    });
    await writeAudit({
      actorAccountId: actor.id,
      action: "PLATFORM_ADMIN_CHANGED",
      resourceType: "PlatformAccount",
      resourceId: accountId,
      metadata: input,
    });
    res.json({ account: updated });
  }),
);

adminRouter.patch(
  "/admin/memberships/:id/role",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const input = membershipRoleSchema.parse(req.body);
    const membershipId = routeParam(req.params.id);
    const membership = await prisma.membership.update({
      where: { id: membershipId },
      data: { role: input.role },
    });
    await writeAudit({
      actorAccountId: actor.id,
      organizationId: membership.organizationId,
      action: "MEMBERSHIP_ROLE_CHANGED",
      resourceType: "Membership",
      resourceId: membership.id,
      metadata: input,
    });
    res.json({ membership });
  }),
);

adminRouter.patch(
  "/admin/memberships/:id/status",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const input = membershipStatusSchema.parse(req.body);
    const membershipId = routeParam(req.params.id);
    const membership = await prisma.membership.update({
      where: { id: membershipId },
      data: { status: input.status },
    });
    await writeAudit({
      actorAccountId: actor.id,
      organizationId: membership.organizationId,
      action: "MEMBERSHIP_STATUS_CHANGED",
      resourceType: "Membership",
      resourceId: membership.id,
      metadata: input,
    });
    res.json({ membership });
  }),
);

adminRouter.delete(
  "/admin/memberships/:id",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const membershipId = routeParam(req.params.id);
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      select: { id: true, role: true, status: true, organizationId: true, accountId: true },
    });
    if (!membership) {
      throw new ApiError(404, "العضوية غير موجودة", "NOT_FOUND");
    }
    if (membership.role === "OWNER" && membership.status === "ACTIVE") {
      const owners = await prisma.membership.count({
        where: { organizationId: membership.organizationId, role: "OWNER", status: "ACTIVE" },
      });
      if (owners <= 1) {
        throw new ApiError(409, "يجب أن تبقى هناك عضوية مالك نشطة واحدة على الأقل", "LAST_OWNER");
      }
    }
    await prisma.membership.delete({ where: { id: membershipId } });
    await writeAudit({
      actorAccountId: actor.id,
      organizationId: membership.organizationId,
      action: "MEMBERSHIP_REMOVED_BY_ADMIN",
      resourceType: "Membership",
      resourceId: membership.id,
      metadata: { accountId: membership.accountId, role: membership.role },
    });
    res.json({ membership: { id: membership.id } });
  }),
);

adminRouter.get(
  "/admin/organizations",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const { skip, take } = getPagination(req);
    const organizations = await prisma.organization.findMany({
      include: {
        supplierProfile: { select: { verificationStatus: true } },
        _count: { select: { memberships: true, buyerRfqs: true, quotes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({ organizations });
  }),
);

adminRouter.post(
  "/admin/organizations",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const input = createOrganizationSchema.parse(req.body);
    const organization = await prisma.organization.create({
      data: { ...input, displayName: input.displayName ?? input.legalName },
    });
    await writeAudit({
      actorAccountId: actor.id,
      organizationId: organization.id,
      action: "ORGANIZATION_CREATED_BY_ADMIN",
      resourceType: "Organization",
      resourceId: organization.id,
      metadata: input,
    });
    res.status(201).json({ organization });
  }),
);

adminRouter.patch(
  "/admin/organizations/:id/status",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const input = organizationStatusSchema.parse(req.body);
    const organizationId = routeParam(req.params.id);
    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: { status: input.status },
      select: { id: true, displayName: true, status: true },
    });
    await writeAudit({
      actorAccountId: actor.id,
      organizationId,
      action: "ORGANIZATION_STATUS_CHANGED",
      resourceType: "Organization",
      resourceId: organizationId,
      metadata: input,
    });
    res.json({ organization });
  }),
);

adminRouter.get(
  "/admin/organizations/:id/members",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const organizationId = routeParam(req.params.id);
    const members = await prisma.membership.findMany({
      where: { organizationId },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        account: {
          select: { id: true, fullName: true, email: true, accountType: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ members });
  }),
);

adminRouter.post(
  "/admin/organizations/:id/members",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const input = addMemberByEmailSchema.parse(req.body);
    const organizationId = routeParam(req.params.id);
    const account = await prisma.platformAccount.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true, fullName: true },
    });
    if (!account) {
      throw new ApiError(404, "الحساب غير موجود", "ACCOUNT_NOT_FOUND");
    }
    const membership = await prisma.membership.create({
      data: { organizationId, accountId: account.id, role: input.role },
    });
    await writeAudit({
      actorAccountId: actor.id,
      organizationId,
      action: "MEMBERSHIP_ADDED_BY_ADMIN",
      resourceType: "Membership",
      resourceId: membership.id,
      metadata: { accountId: account.id, role: input.role },
    });
    res.status(201).json({ membership, account });
  }),
);

adminRouter.patch(
  "/admin/organizations/:id/verification",
  asyncRoute(async (req, res) => {
    const actor = requirePlatformAdmin(req);
    const input = verifySupplierSchema.parse(req.body);
    const organizationId = routeParam(req.params.id);
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { type: true },
    });
    if (!organization || organization.type !== "SUPPLIER") {
      throw new ApiError(404, "المورد غير موجود", "NOT_FOUND");
    }
    const profile = await prisma.supplierProfile.upsert({
      where: { organizationId },
      create: { organizationId, verificationStatus: input.status },
      update: { verificationStatus: input.status },
    });
    await writeAudit({
      actorAccountId: actor.id,
      organizationId,
      action: "SUPPLIER_VERIFICATION_CHANGED",
      resourceType: "SupplierProfile",
      resourceId: profile.organizationId,
      metadata: input,
    });
    res.json({ profile });
  }),
);

adminRouter.get(
  "/admin/industries",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const industries = await prisma.industry.findMany({
      include: {
        _count: { select: { schemaVersions: true, rfqs: true } },
        schemaVersions: {
          where: { status: "PUBLISHED" },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true, publishedAt: true },
        },
      },
      orderBy: { nameAr: "asc" },
    });
    res.json({ industries });
  }),
);

adminRouter.get(
  "/admin/audit",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const { skip, take } = getPagination(req);
    const action = String(req.query.action ?? "").trim();
    const resourceType = String(req.query.resourceType ?? "").trim();
    const actorId = String(req.query.actorId ?? "").trim();
    const events = await prisma.auditEvent.findMany({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(resourceType ? { resourceType: { contains: resourceType } } : {}),
        ...(actorId ? { actorAccountId: actorId } : {}),
      },
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({ events });
  }),
);

adminRouter.get(
  "/admin/outbox",
  asyncRoute(async (req, res) => {
    requirePlatformAdmin(req);
    const { skip, take } = getPagination(req);
    const published = String(req.query.published ?? "").trim();
    const eventType = String(req.query.eventType ?? "").trim();
    const events = await prisma.outboxEvent.findMany({
      where: {
        ...(published === "true" ? { publishedAt: { not: null } } : {}),
        ...(published === "false" ? { publishedAt: null } : {}),
        ...(eventType ? { eventType: { contains: eventType } } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({ events });
  }),
);
