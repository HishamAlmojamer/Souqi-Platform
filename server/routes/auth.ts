import bcrypt from "bcryptjs";
import { Router } from "express";
import {
  authenticate,
  issueSession,
  requireAccount,
  revokeSession,
  rotateSession,
} from "../auth";
import { prisma } from "../db";
import { writeAudit } from "../domain/events";
import {
  highestRole,
  permissionsForRole,
  type PlatformRole,
} from "../domain/permissions";
import { ApiError, asyncRoute } from "../http";
import { loginSchema, refreshTokenSchema, registerSchema } from "../validation";

export const authRouter = Router();

function toClientAccount(account: {
  id: string;
  fullName: string;
  companyName: string;
  email: string;
  accountType: "BUYER" | "SUPPLIER";
  createdAt: Date;
}) {
  return {
    id: account.id,
    fullName: account.fullName,
    companyName: account.companyName,
    email: account.email,
    accountType: account.accountType.toLowerCase() as "buyer" | "supplier",
    createdAt: account.createdAt.toISOString(),
  };
}

authRouter.post(
  "/register",
  asyncRoute(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const existing = await prisma.platformAccount.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError(409, "البريد الإلكتروني مستخدم بالفعل", "EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.platformAccount.create({
        data: {
          fullName: input.fullName,
          companyName: input.companyName,
          email: input.email,
          passwordHash,
          accountType: input.accountType,
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
        data: {
          organizationId: organization.id,
          accountId: account.id,
          role: "OWNER",
        },
      });
      return { account, organization };
    });

    await writeAudit({
      actorAccountId: result.account.id,
      organizationId: result.organization.id,
      action: "ACCOUNT_REGISTERED",
      resourceType: "PlatformAccount",
      resourceId: result.account.id,
    });

    const session = await issueSession(result.account);
    res.status(201).json({
      ...session,
      account: toClientAccount(result.account),
      organization: result.organization,
    });
  }),
);

authRouter.post(
  "/login",
  asyncRoute(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const account = await prisma.platformAccount.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!account || !(await bcrypt.compare(input.password, account.passwordHash))) {
      throw new ApiError(401, "بيانات الدخول غير صالحة", "INVALID_CREDENTIALS");
    }

    const session = await issueSession(account);
    res.json({ ...session, account: toClientAccount(account) });
  }),
);

authRouter.post(
  "/refresh",
  asyncRoute(async (req, res) => {
    const input = refreshTokenSchema.parse(req.body);
    const session = await rotateSession(input.refreshToken);
    res.json({
      token: session.token,
      refreshToken: session.refreshToken,
      account: toClientAccount(session.account),
    });
  }),
);

authRouter.post(
  "/logout",
  asyncRoute(async (req, res) => {
    const input = refreshTokenSchema.parse(req.body);
    await revokeSession(input.refreshToken);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  authenticate,
  asyncRoute(async (req, res) => {
    const auth = requireAccount(req);
    const account = await prisma.platformAccount.findUnique({
      where: { id: auth.id },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        email: true,
        accountType: true,
        createdAt: true,
        isPlatformAdmin: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            role: true,
            status: true,
            organization: {
              select: {
                id: true,
                type: true,
                legalName: true,
                displayName: true,
                countryCode: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!account) {
      throw new ApiError(401, "الحساب غير موجود", "UNAUTHORIZED");
    }

    const roles: PlatformRole[] = account.isPlatformAdmin
      ? ["PLATFORM_ADMIN"]
      : account.memberships.map((membership) => membership.role);
    const role = highestRole(roles) ?? "MEMBER";
    const permissions = [...new Set(roles.flatMap((item) => permissionsForRole(item)))];

    res.json({
      account: {
        ...toClientAccount(account),
        isPlatformAdmin: account.isPlatformAdmin,
      },
      role,
      permissions,
      memberships: account.memberships.map((membership) => ({
        id: membership.id,
        organizationId: membership.organization.id,
        role: membership.role,
        status: membership.status,
        organization: membership.organization,
        permissions: permissionsForRole(membership.role),
      })),
      organizations: account.memberships.map((membership) => ({
        ...membership.organization,
        role: membership.role,
      })),
    });
  }),
);
