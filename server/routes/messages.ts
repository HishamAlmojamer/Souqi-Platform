import { Router } from "express";

import { authenticate, requireAccount, requireOrgAccess } from "../auth";
import { prisma } from "../db";
import { writeAudit, writeNotification, writeOutbox } from "../domain/events";
import { assertPermission, ROLE_SETS } from "../domain/permissions";
import { assertTransition, MESSAGE_THREAD_TRANSITIONS } from "../domain/transitions";
import { ApiError, asyncRoute, getPagination, routeParam } from "../http";
import {
  createMessageThreadSchema,
  messageQuerySchema,
  messageThreadStatusSchema,
  sendMessageSchema,
} from "../validation";

export const messagesRouter = Router();

messagesRouter.use(authenticate);

async function organizationIds(accountId: string): Promise<string[]> {
  return (
    await prisma.membership.findMany({
      where: { accountId, status: "ACTIVE" },
      select: { organizationId: true },
    })
  ).map((membership) => membership.organizationId);
}

async function assertThreadAccess(req: Parameters<typeof requireAccount>[0], threadId: string) {
  const account = requireAccount(req);
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      organizationId: true,
      participantOrgIds: true,
      status: true,
      rfqId: true,
    },
  });
  if (!thread) {
    throw new ApiError(404, "المحادثة غير موجودة", "NOT_FOUND");
  }
  const orgIds = await organizationIds(account.id);
  const allowed =
    account.isPlatformAdmin ||
    orgIds.some((id) => id === thread.organizationId || thread.participantOrgIds.includes(id));
  if (!allowed) {
    throw new ApiError(403, "غير مسموح لك بعرض هذه المحادثة", "FORBIDDEN");
  }
  return { account, thread, orgIds };
}

messagesRouter.get(
  "/message-threads",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const { skip, take } = getPagination(req);
    const orgIds = await organizationIds(account.id);
    const threads = await prisma.messageThread.findMany({
      where: account.isPlatformAdmin
        ? {}
        : {
            OR: [
              { organizationId: { in: orgIds } },
              { participantOrgIds: { hasSome: orgIds } },
            ],
          },
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
      skip,
      take,
    });
    res.json({ threads });
  }),
);

messagesRouter.post(
  "/message-threads",
  asyncRoute(async (req, res) => {
    const input = createMessageThreadSchema.parse(req.body);
    const account = requireAccount(req);
    const context = await requireOrgAccess(req, input.organizationId, ROLE_SETS.useMessaging);
    assertPermission(context, "message.view");
    if (!input.participantOrgIds.includes(input.organizationId)) {
      input.participantOrgIds.push(input.organizationId);
    }
    const thread = await prisma.messageThread.create({
      data: {
        ...input,
        participantOrgIds: input.participantOrgIds,
        rfqId: input.rfqId ?? null,
        quoteId: input.quoteId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        sampleId: input.sampleId ?? null,
        escrowHoldId: input.escrowHoldId ?? null,
        shipmentId: input.shipmentId ?? null,
      },
    });
    await writeAudit({
      actorAccountId: account.id,
      organizationId: input.organizationId,
      action: "MESSAGE_THREAD_CREATED",
      resourceType: "MessageThread",
      resourceId: thread.id,
    });
    res.status(201).json({ thread });
  }),
);

messagesRouter.get(
  "/message-threads/:id/messages",
  asyncRoute(async (req, res) => {
    const { thread } = await assertThreadAccess(req, routeParam(req.params.id));
    const query = messageQuerySchema.parse(req.query);
    const messages = await prisma.message.findMany({
      where: {
        threadId: thread.id,
        ...(query.after ? { createdAt: { gt: new Date(query.after) } } : {}),
      },
      include: { sender: { select: { id: true, fullName: true, companyName: true } } },
      orderBy: { createdAt: "asc" },
      take: query.limit ?? 50,
    });
    const reads = await prisma.messageRead.findMany({
      where: { threadId: thread.id },
      select: { accountId: true, messageId: true },
    });
    res.json({ messages, reads });
  }),
);

messagesRouter.post(
  "/message-threads/:id/messages",
  asyncRoute(async (req, res) => {
    const input = sendMessageSchema.parse(req.body);
    const { account, thread, orgIds } = await assertThreadAccess(req, routeParam(req.params.id));
    if (thread.status !== "OPEN") {
      throw new ApiError(409, "المحادثة مغلقة", "THREAD_CLOSED");
    }
    if (!account.isPlatformAdmin && !orgIds.includes(thread.organizationId) && !thread.participantOrgIds.some((id) => orgIds.includes(id))) {
      throw new ApiError(403, "لست طرفًا في هذه المحادثة", "FORBIDDEN");
    }
    const senderOrgId = orgIds.find((id) => id === thread.organizationId || thread.participantOrgIds.includes(id));
    if (!senderOrgId) {
      throw new ApiError(403, "لم يتم العثور على مؤسسة مرسلة صالحة", "FORBIDDEN");
    }
    const context = await requireOrgAccess(req, senderOrgId, ROLE_SETS.useMessaging);
    assertPermission(context, "message.send");

    const existing = await prisma.message.findUnique({
      where: { threadId_idempotencyKey: { threadId: thread.id, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      res.json({ message: existing, duplicate: true });
      return;
    }

    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderAccountId: account.id,
        senderOrgId,
        body: input.body,
        offerJson: input.offer ?? undefined,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });
    await writeOutbox({
      aggregateType: "MessageThread",
      aggregateId: thread.id,
      eventType: "MESSAGE_SENT",
      payload: { messageId: message.id, offer: input.offer ?? null },
    });
    const recipients = await prisma.membership.findMany({
      where: {
        organizationId: { in: thread.participantOrgIds.filter((id) => id !== senderOrgId) },
        status: "ACTIVE",
      },
      select: { accountId: true },
    });
    for (const recipient of recipients) {
      await writeNotification({
        accountId: recipient.accountId,
        organizationId: senderOrgId,
        kind: "message",
        title: input.offer ? "عرض تفاوضي جديد" : "رسالة جديدة",
        body: input.body.slice(0, 180),
        href: thread.rfqId ? `/rfq/${thread.rfqId}/messages` : "/workspace",
        dedupeKey: `message:${message.id}:${recipient.accountId}`,
      });
    }
    res.status(201).json({ message });
  }),
);

messagesRouter.post(
  "/message-threads/:id/read",
  asyncRoute(async (req, res) => {
    const { account, thread } = await assertThreadAccess(req, routeParam(req.params.id));
    await prisma.messageRead.upsert({
      where: { threadId_accountId: { threadId: thread.id, accountId: account.id } },
      update: { readAt: new Date() },
      create: { threadId: thread.id, accountId: account.id },
    });
    res.json({ read: true });
  }),
);

messagesRouter.post(
  "/message-threads/:id/status",
  asyncRoute(async (req, res) => {
    const input = messageThreadStatusSchema.parse(req.body);
    const { account, thread } = await assertThreadAccess(req, routeParam(req.params.id));
    const status = input.status;
    assertTransition(MESSAGE_THREAD_TRANSITIONS, thread.status, status, "المحادثة");
    await prisma.messageThread.update({ where: { id: thread.id }, data: { status } });
    await writeAudit({
      actorAccountId: account.id,
      action: "MESSAGE_THREAD_STATUS_CHANGED",
      resourceType: "MessageThread",
      resourceId: thread.id,
      metadata: { status },
    });
    res.json({ status });
  }),
);
