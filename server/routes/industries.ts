import { Router } from "express";
import { authenticate, requirePlatformAdmin } from "../auth";
import { prisma } from "../db";
import { writeAudit } from "../domain/events";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import {
  createIndustrySchema,
  createIndustrySchemaVersionSchema,
} from "../validation";

export const industriesRouter = Router();

industriesRouter.get(
  "/industries",
  asyncRoute(async (req, res) => {
    const { skip, take } = getPagination(req);
    const industries = await prisma.industry.findMany({
      where: { active: true },
      orderBy: { nameAr: "asc" },
      skip,
      take,
    });
    res.json({ industries });
  }),
);

industriesRouter.post(
  "/industries",
  authenticate,
  asyncRoute(async (req, res) => {
    const account = requirePlatformAdmin(req);
    const input = createIndustrySchema.parse(req.body);
    const industry = await prisma.industry.create({ data: input });
    await writeAudit({
      actorAccountId: account.id,
      action: "INDUSTRY_CREATED",
      resourceType: "Industry",
      resourceId: industry.id,
      metadata: input,
    });
    res.status(201).json({ industry });
  }),
);

industriesRouter.get(
  "/industries/:id/schemas",
  asyncRoute(async (req, res) => {
    const versions = await prisma.industrySchemaVersion.findMany({
      where: { industryId: routeParam(req.params.id) },
      orderBy: { version: "desc" },
    });
    res.json({ versions });
  }),
);

industriesRouter.post(
  "/industries/:id/schemas",
  authenticate,
  asyncRoute(async (req, res) => {
    const account = requirePlatformAdmin(req);
    const input = createIndustrySchemaVersionSchema.parse(req.body);
    const industry = await prisma.industry.findUnique({
      where: { id: routeParam(req.params.id) },
      select: { id: true },
    });
    if (!industry) {
      throw new ApiError(404, "القطاع غير موجود", "NOT_FOUND");
    }
    const version = await prisma.industrySchemaVersion.create({
      data: {
        industryId: industry.id,
        version: input.version,
        schemaJson: input.schemaJson as never,
        status: input.publish ? "PUBLISHED" : "DRAFT",
        publishedAt: input.publish ? new Date() : null,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      action: "SCHEMA_VERSION_CREATED",
      resourceType: "IndustrySchemaVersion",
      resourceId: version.id,
      metadata: { industryId: industry.id, version: version.version },
    });
    res.status(201).json({ version });
  }),
);

industriesRouter.get(
  "/schema-versions/:id",
  asyncRoute(async (req, res) => {
    const version = await prisma.industrySchemaVersion.findUnique({
      where: { id: routeParam(req.params.id) },
      include: { industry: true },
    });
    if (!version) {
      throw new ApiError(404, "إصدار المخطط غير موجود", "NOT_FOUND");
    }
    res.json({ version });
  }),
);

industriesRouter.post(
  "/schema-versions/:id/publish",
  authenticate,
  asyncRoute(async (req, res) => {
    const account = requirePlatformAdmin(req);
    const version = await prisma.industrySchemaVersion.update({
      where: { id: routeParam(req.params.id) },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await writeAudit({
      actorAccountId: account.id,
      action: "SCHEMA_VERSION_PUBLISHED",
      resourceType: "IndustrySchemaVersion",
      resourceId: version.id,
    });
    res.json({ version });
  }),
);
