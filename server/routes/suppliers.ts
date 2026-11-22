import { Router } from "express";

import { authenticate, requireAccount } from "../auth";
import { prisma } from "../db";
import { asyncRoute, getPagination } from "../http";

export const suppliersRouter = Router();

suppliersRouter.use(authenticate);

suppliersRouter.get(
  "/suppliers",
  asyncRoute(async (req, res) => {
    requireAccount(req);
    const { skip, take } = getPagination(req);
    const organizations = await prisma.organization.findMany({
      where: {
        type: "SUPPLIER",
        status: "ACTIVE",
        supplierProfile: { verificationStatus: "APPROVED" },
      },
      include: {
        supplierProfile: true,
        _count: { select: { memberships: true, quotes: true } },
      },
      orderBy: { displayName: "asc" },
      skip,
      take,
    });
    res.json({ suppliers: organizations });
  }),
);
