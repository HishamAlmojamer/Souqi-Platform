import { Prisma, PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export function isKnownPrismaError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
