import type { MembershipRole, OrganizationStatus, OrganizationType } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config";
import { prisma } from "./db";
import { ApiError, asyncRoute } from "./http";

const secretKey = new TextEncoder().encode(config.jwtSecret);

export interface AuthAccount {
  id: string;
  accountType: "BUYER" | "SUPPLIER";
  isPlatformAdmin: boolean;
}

export interface OrganizationContext {
  id: string;
  type: OrganizationType;
  status: OrganizationStatus;
  legalName: string;
  displayName: string;
  countryCode: string;
}

export interface AccessContext {
  organizationId: string;
  role: MembershipRole;
  organization: OrganizationContext;
  isPlatformAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      account?: AuthAccount;
    }
  }
}

export async function issueToken(account: AuthAccount): Promise<string> {
  return new SignJWT({
    accountType: account.accountType,
    isPlatformAdmin: account.isPlatformAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(account.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey);
}

const refreshTokenTtlMs = 30 * 24 * 60 * 60 * 1000;

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueSession(account: AuthAccount) {
  const token = await issueToken(account);
  const refreshToken = randomBytes(32).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      accountId: account.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTokenTtlMs),
    },
  });
  return { token, refreshToken };
}

export async function rotateSession(refreshToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
  });
  if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(401, "جلسة غير صالحة أو منتهية", "UNAUTHORIZED");
  }

  const account = await prisma.platformAccount.findUnique({
    where: { id: stored.accountId },
    select: {
      id: true,
      fullName: true,
      companyName: true,
      email: true,
      accountType: true,
      isPlatformAdmin: true,
      createdAt: true,
    },
  });
  if (!account) {
    throw new ApiError(401, "الحساب غير موجود", "UNAUTHORIZED");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  const session = await issueSession(account);
  return { ...session, account };
}

export async function revokeSession(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const authenticate: RequestHandler = asyncRoute(async (req, _res, next) => {
  const authorization = req.header("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    throw new ApiError(401, "مطلوب تسجيل الدخول", "UNAUTHORIZED");
  }

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (!payload.sub) {
      throw new Error("Missing subject");
    }

    const account = await prisma.platformAccount.findUnique({
      where: { id: payload.sub },
      select: { id: true, accountType: true, isPlatformAdmin: true },
    });
    if (!account) {
      throw new Error("Unknown account");
    }

    req.account = account;
    next();
  } catch {
    throw new ApiError(401, "جلسة غير صالحة أو منتهية", "UNAUTHORIZED");
  }
});

export function requireAccount(req: { account?: AuthAccount }): AuthAccount {
  if (!req.account) {
    throw new ApiError(401, "مطلوب تسجيل الدخول", "UNAUTHORIZED");
  }
  return req.account;
}

export function requirePlatformAdmin(req: { account?: AuthAccount }): AuthAccount {
  const account = requireAccount(req);
  if (!account.isPlatformAdmin) {
    throw new ApiError(403, "غير مسموح لك بهذا الإجراء", "FORBIDDEN");
  }
  return account;
}

export async function requireOrgAccess(
  req: { account?: AuthAccount },
  organizationId: string,
  allowedRoles?: readonly MembershipRole[],
): Promise<AccessContext> {
  const account = requireAccount(req);
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      type: true,
      status: true,
      legalName: true,
      displayName: true,
      countryCode: true,
    },
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new ApiError(404, "المؤسسة غير موجودة أو غير نشطة", "NOT_FOUND");
  }

  if (account.isPlatformAdmin) {
    return {
      organizationId,
      role: "ADMIN",
      organization,
      isPlatformAdmin: true,
    };
  }

  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_accountId: { organizationId, accountId: account.id },
    },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new ApiError(403, "لست عضوًا في هذه المؤسسة", "FORBIDDEN");
  }
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new ApiError(403, "دورك لا يسمح بهذا الإجراء", "FORBIDDEN");
  }

  return {
    organizationId,
    role: membership.role,
    organization,
    isPlatformAdmin: false,
  };
}
