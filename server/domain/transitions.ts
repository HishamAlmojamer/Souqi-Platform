import type {
  EscrowConditionStatus,
  EscrowHoldStatus,
  InspectionReportStatus,
  MessageThreadStatus,
  MilestoneStatus,
  ProductStatus,
  PurchaseOrderStatus,
  QuoteStatus,
  RFQStatus,
  SampleStatus,
  ShipmentStatus,
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
  REQUESTED: ["QUOTED", "IN_PREPARATION", "REJECTED"],
  QUOTED: ["PAID", "REJECTED"],
  PAID: ["IN_PRODUCTION", "REJECTED"],
  IN_PRODUCTION: ["IN_PREPARATION", "SHIPPED", "REJECTED"],
  IN_PREPARATION: ["SHIPPED", "REJECTED"],
  SHIPPED: ["DELIVERED", "RECEIVED", "REVISION_REQUESTED"],
  DELIVERED: ["APPROVED", "REVISION_NEEDED", "REJECTED"],
  RECEIVED: ["APPROVED", "REVISION_REQUESTED", "REVISION_NEEDED", "REJECTED"],
  REVISION_REQUESTED: ["IN_PREPARATION", "REJECTED"],
  REVISION_NEEDED: ["IN_PRODUCTION", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export const MILESTONE_TRANSITIONS: TransitionMap<MilestoneStatus> = {
  PENDING: ["RAW_MATERIALS_READY", "ACTIVE", "BLOCKED"],
  RAW_MATERIALS_READY: ["IN_PRODUCTION", "BLOCKED"],
  IN_PRODUCTION: ["ACTIVE", "QUALITY_CHECK", "BLOCKED"],
  ACTIVE: ["QUALITY_CHECK", "DONE", "BLOCKED"],
  QUALITY_CHECK: ["PACKAGING", "DONE", "BLOCKED"],
  PACKAGING: ["READY_TO_SHIP", "DONE", "BLOCKED"],
  READY_TO_SHIP: ["DONE", "BLOCKED"],
  BLOCKED: ["RAW_MATERIALS_READY", "IN_PRODUCTION", "ACTIVE", "QUALITY_CHECK", "PACKAGING", "READY_TO_SHIP"],
  DONE: [],
};

export const PRODUCT_TRANSITIONS: TransitionMap<ProductStatus> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export const INSPECTION_REPORT_TRANSITIONS: TransitionMap<InspectionReportStatus> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["EXPIRED"],
  REJECTED: [],
  EXPIRED: [],
};

export const MESSAGE_THREAD_TRANSITIONS: TransitionMap<MessageThreadStatus> = {
  OPEN: ["CLOSED", "ARCHIVED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const ESCROW_HOLD_TRANSITIONS: TransitionMap<EscrowHoldStatus> = {
  AWAITING_PAYMENT: ["FUNDS_HELD_IN_ESCROW", "CANCELLED"],
  FUNDS_HELD_IN_ESCROW: ["PARTIAL_RELEASED", "COMPLETED", "DISPUTED", "REFUNDED"],
  PARTIAL_RELEASED: ["PARTIAL_RELEASED", "COMPLETED", "DISPUTED"],
  COMPLETED: [],
  DISPUTED: ["COMPLETED", "REFUNDED"],
  REFUNDED: [],
  CANCELLED: [],
};

export const ESCROW_CONDITION_TRANSITIONS: TransitionMap<EscrowConditionStatus> = {
  PENDING: ["MET", "WAIVED"],
  MET: [],
  WAIVED: [],
};

export const SHIPMENT_TRANSITIONS: TransitionMap<ShipmentStatus> = {
  CREATED: ["PICKED_UP", "EXCEPTION"],
  PICKED_UP: ["IN_TRANSIT", "EXCEPTION"],
  IN_TRANSIT: ["DELIVERED", "EXCEPTION"],
  EXCEPTION: ["IN_TRANSIT", "DELIVERED"],
  DELIVERED: [],
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
