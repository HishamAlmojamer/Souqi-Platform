import { Router } from "express";

import { authenticate, requireAccount } from "../auth";
import { prisma } from "../db";
import { asyncRoute, routeParam } from "../http";
import { notificationQuerySchema } from "../validation";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get(
  "/notifications",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const query = notificationQuerySchema.parse(req.query);
    const notifications = await prisma.notification.findMany({
      where: {
        accountId: account.id,
        ...(query.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const unreadCount = await prisma.notification.count({
      where: { accountId: account.id, readAt: null },
    });
    res.json({ notifications, unreadCount });
  }),
);

notificationsRouter.post(
  "/notifications/:id/read",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const notification = await prisma.notification.findFirst({
      where: { id: routeParam(req.params.id), accountId: account.id },
    });
    if (!notification) {
      res.json({ read: false });
      return;
    }
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
    res.json({ notification: updated });
  }),
);

notificationsRouter.post(
  "/notifications/read-all",
  asyncRoute(async (req, res) => {
    const account = requireAccount(req);
    const result = await prisma.notification.updateMany({
      where: { accountId: account.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ updated: result.count });
  }),
);
