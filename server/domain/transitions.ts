import type {
  MilestoneStatus,
  PurchaseOrderStatus,
  QuoteStatus,
  RFQStatus,
  SampleStatus,
} from "@prisma/client";
import { ApiError } from "../http";

type TransitionMap<T extends string> = Record<T, readonly T[]>;

export const RFQ_TRANSITIONS: TransitionMap<RFQStatus> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

export const QUOTE_TRANSITIONS: TransitionMap<QuoteStatus> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["SUPERSEDED", "WITHDRAWN", "LOST"],
  SUPERSEDED: [],
  WITHDRAWN: [],
  LOST: [],
};

export const PURCHASE_ORDER_TRANSITIONS: TransitionMap<PurchaseOrderStatus> = {
  ACTIVE: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const SAMPLE_TRANSITIONS: TransitionMap<SampleStatus> = {
  REQUESTED: ["IN_PREPARATION", "REJECTED"],
  IN_PREPARATION: ["SHIPPED", "REJECTED"],
  SHIPPED: ["RECEIVED", "REVISION_REQUESTED"],
  RECEIVED: ["APPROVED", "REVISION_REQUESTED", "REJECTED"],
  REVISION_REQUESTED: ["IN_PREPARATION", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export const MILESTONE_TRANSITIONS: TransitionMap<MilestoneStatus> = {
  PENDING: ["ACTIVE", "BLOCKED"],
  ACTIVE: ["DONE", "BLOCKED"],
  BLOCKED: ["ACTIVE"],
  DONE: [],
};

export function assertTransition<T extends string>(
  map: TransitionMap<T>,
  from: T,
  to: T,
  label: string,
): void {
  if (!map[from]?.includes(to)) {
    throw new ApiError(
      409,
      `لا يمكن تغيير حالة ${label} من ${from} إلى ${to}`,
      "INVALID_TRANSITION",
    );
  }
}
