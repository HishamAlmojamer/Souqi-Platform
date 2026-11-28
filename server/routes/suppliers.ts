import { Prisma } from "@prisma/client";
import { Router } from "express";

import { authenticate, requireAccount } from "../auth";
import { prisma } from "../db";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import { supplierQuerySchema } from "../validation";

export const suppliersRouter = Router();

suppliersRouter.use(authenticate);

suppliersRouter.get(
  "/suppliers",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const query = supplierQuerySchema.parse(req.query);
    const { skip, take } = getPagination(req);
    const verified = query.verifiedOnly === true;
    const profileFilter: Prisma.SupplierProfileWhereInput = {
      ...(verified
        ? { verificationStatus: { in: ["APPROVED", "AUDITED_SUPPLIER"] } }
        : { verificationStatus: { not: "REJECTED" } }),
      ...(query.minOrderQuantity ? { minOrderQuantity: { gte: query.minOrderQuantity } } : {}),
      ...(query.maxLeadTimeDays ? { leadTimeDays: { lte: query.maxLeadTimeDays } } : {}),
    };
    const organizations = await prisma.organization.findMany({
      where: {
        type: "SUPPLIER",
        status: "ACTIVE",
        supplierProfile: profileFilter,
        ...(query.q
          ? {
              OR: [
                { displayName: { contains: query.q, mode: "insensitive" } },
                { legalName: { contains: query.q, mode: "insensitive" } },
                { countryCode: { equals: query.q, mode: "insensitive" } },
                { products: { some: { title: { contains: query.q, mode: "insensitive" } } } },
              ],
            }
          : {}),
        ...(query.category || query.industryId
          ? {
              products: {
                some: {
                  status: "ACTIVE",
                  ...(query.category ? { category: { equals: query.category, mode: "insensitive" } } : {}),
                  ...(query.industryId ? { industryId: query.industryId } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        supplierProfile: true,
        products: {
          where: { status: "ACTIVE" },
          select: { id: true, title: true, category: true, leadTimeDays: true, minOrderQuantity: true },
          take: 5,
        },
        inspectionReports: {
          where: { status: "APPROVED" },
          select: { id: true, kind: true, issuer: true, reportNumber: true, expiresAt: true },
          take: 3,
        },
        _count: { select: { memberships: true, quotes: true } },
      },
      orderBy: { displayName: "asc" },
      skip,
      take,
    });
    res.json({ suppliers: organizations });
  }),
);

suppliersRouter.get(
  "/suppliers/:id",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const supplier = await prisma.organization.findFirst({
      where: { id: routeParam(req.params.id), type: "SUPPLIER", status: "ACTIVE" },
      include: {
        supplierProfile: true,
        products: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
        inspectionReports: {
          where: { status: "APPROVED" },
          orderBy: { issuedAt: "desc" },
        },
        _count: { select: { quotes: true, memberships: true } },
      },
    });
    if (!supplier) {
      throw new ApiError(404, "المورد غير موجود", "NOT_FOUND");
    }
    res.json({ supplier });
  }),
);
