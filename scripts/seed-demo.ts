import "dotenv/config";
import { PrismaClient, IndustrySchemaStatus, OrganizationType, VerificationStatus } from "@prisma/client";

import { industries, supplierProfiles } from "../src/data/b2bDemo";

const prisma = new PrismaClient();

function parseArabicNumber(value: string) {
  const normalized = value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const parsed = Number.parseInt(normalized.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function schemaForIndustry(industry: (typeof industries)[number]) {
  return {
    title: industry.label,
    description: industry.description,
    type: "object",
    properties: Object.fromEntries(industry.fields.map((field) => [
      field.id,
      {
        type: "string",
        title: field.label,
        ...(field.type === "choice" ? { enum: field.options ?? [] } : {}),
        ...(field.placeholder ? { description: field.placeholder } : {}),
      },
    ])),
    required: industry.fields.filter((field) => field.required).map((field) => field.id),
    ui: industry.fields,
  };
}

async function seedIndustries() {
  for (const industry of industries) {
    const record = await prisma.industry.upsert({
      where: { code: industry.id },
      create: { code: industry.id, nameAr: industry.label, active: true },
      update: { nameAr: industry.label, active: true },
    });
    const schemaJson = schemaForIndustry(industry);
    const existing = await prisma.industrySchemaVersion.findFirst({
      where: { industryId: record.id, version: 1 },
    });
    if (existing) {
      await prisma.industrySchemaVersion.update({
        where: { id: existing.id },
        data: {
          schemaJson,
          status: IndustrySchemaStatus.PUBLISHED,
          publishedAt: existing.publishedAt ?? new Date(),
        },
      });
    } else {
      await prisma.industrySchemaVersion.create({
        data: {
          industryId: record.id,
          version: 1,
          schemaJson,
          status: IndustrySchemaStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });
    }
  }
}

async function seedSuppliers() {
  const countryCodes: Record<string, string> = {
    السعودية: "SA",
    الإمارات: "AE",
    الأردن: "JO",
    الكويت: "KW",
  };

  for (const supplier of supplierProfiles) {
    const existing = await prisma.organization.findFirst({
      where: { type: OrganizationType.SUPPLIER, legalName: supplier.name },
    });
    const organization = existing ?? await prisma.organization.create({
      data: {
        type: OrganizationType.SUPPLIER,
        legalName: supplier.name,
        displayName: supplier.name,
        countryCode: countryCodes[supplier.country] ?? "SA",
      },
    });
    await prisma.supplierProfile.upsert({
      where: { organizationId: organization.id },
      create: {
        organizationId: organization.id,
        verificationStatus:
          supplier.verified ? VerificationStatus.APPROVED : VerificationStatus.SUBMITTED,
        capabilities: {
          category: supplier.category,
          specialties: supplier.specialties,
          responseRate: supplier.responseRate,
          score: supplier.score,
        },
        leadTimeDays: parseArabicNumber(supplier.leadTime),
        minOrderQuantity: parseArabicNumber(supplier.minOrder),
        website: null,
      },
      update: {
        verificationStatus:
          supplier.verified ? VerificationStatus.APPROVED : VerificationStatus.SUBMITTED,
        capabilities: {
          category: supplier.category,
          specialties: supplier.specialties,
          responseRate: supplier.responseRate,
          score: supplier.score,
        },
        leadTimeDays: parseArabicNumber(supplier.leadTime),
        minOrderQuantity: parseArabicNumber(supplier.minOrder),
      },
    });
  }
}

async function main() {
  await seedIndustries();
  await seedSuppliers();
  console.log(`Seeded ${industries.length} industries and ${supplierProfiles.length} supplier profiles.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
