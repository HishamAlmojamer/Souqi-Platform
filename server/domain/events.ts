import { Prisma } from "@prisma/client";
import { prisma } from "../db";

type JsonValue = Prisma.InputJsonValue;

function asJson(value: unknown): JsonValue {
  return value as JsonValue;
}

export async function writeAudit(input: {
  actorAccountId?: string | null;
  organizationId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: unknown;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorAccountId: input.actorAccountId ?? null,
      organizationId: input.organizationId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata === undefined ? undefined : asJson(input.metadata),
    },
  });
}

export async function writeOutbox(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
}): Promise<void> {
  await prisma.outboxEvent.create({
    data: {
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: asJson(input.payload),
    },
  });
}
