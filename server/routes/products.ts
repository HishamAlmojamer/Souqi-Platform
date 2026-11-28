import { Router } from "express";

import { authenticate, requireAccount, requireOrgAccess } from "../auth";
import { prisma } from "../db";
import { writeAudit } from "../domain/events";
import { assertPermission, ROLE_SETS } from "../domain/permissions";
import { assertTransition, PRODUCT_TRANSITIONS } from "../domain/transitions";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import { createProductSchema, productQuerySchema, productStatusSchema } from "../validation";

export const productsRouter = Router();

productsRouter.use(authenticate);

function assertObjectKey(objectKey: string, organizationId: string): void {
  if (!objectKey.startsWith(`${organizationId}/`)) {
    throw new ApiError(400, "مفتاح الملف يجب أن يبدأ بمعرّف المؤسسة", "INVALID_OBJECT_KEY");
  }
}

productsRouter.get(
  "/products",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const query = productQuerySchema.parse(req.query);
    const { skip, take } = getPagination(req);
    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } },
                { category: { contains: query.q, mode: "insensitive" } },
                { sku: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(query.category ? { category: { equals: query.category, mode: "insensitive" } } : {}),
        ...(query.industryId ? { industryId: query.industryId } : {}),
        ...(query.supplierOrgId ? { supplierOrgId: query.supplierOrgId } : {}),
        ...(query.minOrderQuantity ? { minOrderQuantity: { gte: query.minOrderQuantity } } : {}),
        ...(query.maxLeadTimeDays ? { leadTimeDays: { lte: query.maxLeadTimeDays } } : {}),
        ...(query.verifiedOnly
          ? {
              supplierOrg: {
                supplierProfile: { verificationStatus: { in: ["APPROVED", "AUDITED_SUPPLIER"] } },
              },
            }
          : {}),
      },
      include: {
        supplierOrg: {
          select: {
            id: true,
            displayName: true,
            legalName: true,
            countryCode: true,
            supplierProfile: {
              select: { verificationStatus: true, minOrderQuantity: true, leadTimeDays: true, capabilities: true },
            },
          },
        },
        industry: { select: { id: true, code: true, nameAr: true } },
        media: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({ products });
  }),
);

productsRouter.get(
  "/products/:id",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const product = await prisma.product.findUnique({
      where: { id: routeParam(req.params.id) },
      include: {
        supplierOrg: {
          select: {
            id: true,
            displayName: true,
            legalName: true,
            countryCode: true,
            supplierProfile: true,
          },
        },
        industry: true,
        media: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!product) {
      throw new ApiError(404, "المنتج غير موجود", "NOT_FOUND");
    }
    res.json({ product });
  }),
);

productsRouter.post(
  "/products",
  asyncRoute(async (req, res) => {
    const input = createProductSchema.parse(req.body);
    const account = requireAccount(req);
    const context = await requireOrgAccess(req, input.supplierOrgId, ROLE_SETS.manageProduct);
    assertPermission(context, "product.manage");
    if (context.organization.type !== "SUPPLIER") {
      throw new ApiError(400, "المنتجات تُنشأ من مؤسسة مورد فقط", "INVALID_ORGANIZATION_TYPE");
    }
    const industry = await prisma.industry.findUnique({ where: { id: input.industryId } });
    if (!industry?.active) {
      throw new ApiError(400, "القطاع غير متاح", "INVALID_INDUSTRY");
    }

    const product = await prisma.product.create({
      data: {
        ...input,
        countryCode: input.countryCode ?? context.organization.countryCode,
        specifications: input.specifications as never,
        certifications: input.certifications,
        createdByAccountId: account.id,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: input.supplierOrgId,
      action: "PRODUCT_CREATED",
      resourceType: "Product",
      resourceId: product.id,
    });
    res.status(201).json({ product });
  }),
);

productsRouter.post(
  "/products/:id/status",
  asyncRoute(async (req, res) => {
    const input = productStatusSchema.parse(req.body);
    const account = requireAccount(req);
    const product = await prisma.product.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true, supplierOrgId: true, status: true },
    });
    if (!product) {
      throw new ApiError(404, "المنتج غير موجود", "NOT_FOUND");
    }
    assertTransition(PRODUCT_TRANSITIONS, product.status, input.status, "المنتج");
    const context = await requireOrgAccess(req, product.supplierOrgId, ROLE_SETS.manageProduct);
    assertPermission(context, "product.manage");
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { status: input.status },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: product.supplierOrgId,
      action: "PRODUCT_STATUS_CHANGED",
      resourceType: "Product",
      resourceId: product.id,
      metadata: { from: product.status, to: input.status },
    });
    res.json({ product: updated });
  }),
);

export function assertOrganizationObjectKey(objectKey: string, organizationId: string): void {
  assertObjectKey(objectKey, organizationId);
}
