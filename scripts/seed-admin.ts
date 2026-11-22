import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const email = required("ADMIN_EMAIL").toLowerCase();
  const password = required("ADMIN_PASSWORD");
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }

  const fullName = process.env.ADMIN_NAME?.trim() || "مدير المنصة";
  const companyName = process.env.ADMIN_COMPANY?.trim() || "سوقي";
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.platformAccount.upsert({
      where: { email },
      create: {
        email,
        fullName,
        companyName,
        passwordHash,
        accountType: "BUYER",
        isPlatformAdmin: true,
      },
      update: {
        fullName,
        companyName,
        passwordHash,
        isPlatformAdmin: true,
      },
    });

    const existingMembership = await tx.membership.findFirst({
      where: { accountId: account.id, role: "OWNER", status: "ACTIVE" },
      include: { organization: true },
    });
    if (existingMembership) {
      return { account, organization: existingMembership.organization };
    }

    const organization = await tx.organization.create({
      data: {
        type: "BUYER",
        legalName: companyName,
        displayName: companyName,
        countryCode: "SA",
      },
    });
    await tx.membership.create({
      data: { organizationId: organization.id, accountId: account.id, role: "OWNER" },
    });
    return { account, organization };
  });

  await prisma.auditEvent.create({
    data: {
      actorAccountId: result.account.id,
      organizationId: result.organization.id,
      action: "PLATFORM_ADMIN_SEEDED",
      resourceType: "PlatformAccount",
      resourceId: result.account.id,
    },
  });

  console.log(`Platform admin ready: ${result.account.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
