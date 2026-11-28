import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/state/AuthContext';

export type Tone = 'green' | 'amber' | 'blue' | 'muted';

export type ApiIndustry = {
  id: string;
  code: string;
  nameAr: string;
  active: boolean;
};

export type ApiSchemaVersion = {
  id: string;
  industryId: string;
  version: number;
  schemaJson: unknown;
  status: string;
  publishedAt: string | null;
};

export type ApiOrganization = {
  id: string;
  type: 'BUYER' | 'SUPPLIER';
  legalName: string;
  displayName: string;
  countryCode: string;
  status: string;
  supplierProfile?: ApiSupplierProfile | null;
};

export type ApiSupplierProfile = {
  organizationId: string;
  verificationStatus: string;
  capabilities: unknown;
  minOrderQuantity: number | null;
  leadTimeDays: number | null;
  website: string | null;
  licenseNumber?: string | null;
  floorAreaSqm?: number | null;
  productionLines?: number | null;
  rdStaffCount?: number | null;
  annualCapacity?: string | null;
  certifications?: string[];
};

export type ApiSupplier = ApiOrganization & {
  supplierProfile: ApiSupplierProfile | null;
  products?: ApiProduct[];
  inspectionReports?: ApiInspectionReport[];
  _count?: { memberships?: number; quotes?: number };
};

export type ApiProductMedia = {
  id: string;
  productId: string;
  objectKey: string;
  kind: 'IMAGE' | 'VIDEO' | 'CAD' | 'PDF';
  caption: string | null;
  sortOrder: number;
  mimeType: string | null;
  createdAt: string;
};

export type ApiProduct = {
  id: string;
  supplierOrgId: string;
  industryId: string | null;
  sku: string | null;
  title: string;
  description: string;
  category: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  source: 'CATALOG' | 'CUSTOM' | 'RFQ';
  priceCents: string | null;
  currency: string;
  minOrderQuantity: number;
  leadTimeDays: number | null;
  certifications: string[];
  customizationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  supplierOrg?: Pick<ApiOrganization, 'id' | 'displayName' | 'legalName' | 'countryCode'> & {
    supplierProfile?: Pick<ApiSupplierProfile, 'verificationStatus' | 'minOrderQuantity' | 'leadTimeDays' | 'capabilities'> | null;
  } | null;
  media?: ApiProductMedia[];
};

export type ApiInspectionReport = {
  id: string;
  organizationId: string;
  kind: 'FACTORY_AUDIT' | 'PRE_SHIPMENT' | 'SAMPLE' | 'LABORATORY' | 'DOCUMENT';
  status: 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  issuer: string;
  reportNumber: string | null;
  scope: string | null;
  summary: unknown;
  score: number | null;
  objectKey: string;
  checksum: string;
  mimeType: string;
  sizeBytes: number;
  issuedAt: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
  organization?: Pick<ApiOrganization, 'id' | 'displayName'> | null;
};

export type ApiRfqAttachment = {
  id: string;
  rfqId: string;
  organizationId: string;
  objectKey: string;
  label: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  classification: string;
  confidentiality: string;
  scanStatus: 'PENDING' | 'CLEAN' | 'INFECTED';
  createdAt: string;
};

export type SupplierCapabilities = {
  category: string;
  specialties: string[];
  score: number | null;
  responseRate: string | null;
};

export type ApiRfq = {
  id: string;
  buyerOrgId: string;
  industryId: string;
  schemaVersionId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
  title: string;
  quantity: number;
  unit: string;
  currency: string;
  destination: string;
  targetDate: string | null;
  requirements: Record<string, unknown>;
  category?: string | null;
  targetUnitPriceCents?: string | null;
  incoterm?: 'EXW' | 'FOB' | 'CIF' | 'DDP' | null;
  brandingRequirements?: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  industry?: ApiIndustry | null;
  buyerOrganization?: Pick<ApiOrganization, 'id' | 'displayName' | 'legalName'> | null;
  schemaVersion?: ApiSchemaVersion | null;
  quotes?: ApiQuoteSummary[];
  invitations?: ApiRfqInvitation[];
  attachments?: ApiRfqAttachment[];
  _count?: { invitations?: number; quotes?: number; attachments?: number };
};

export type ApiQuoteSummary = {
  id: string;
  rfqId: string;
  supplierOrgId: string;
  revision: number;
  status: string;
  currency: string;
  leadTimeDays: number;
  submittedAt: string | null;
  supplierOrg?: Pick<ApiOrganization, 'id' | 'displayName'> | null;
};

export type ApiQuoteLine = {
  id: string;
  quoteId: string;
  name: string;
  quantity: number;
  unitPriceCents: string;
  totalPriceCents: string;
};

export type ApiRfqInvitation = {
  id: string;
  rfqId: string;
  supplierOrgId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  sentAt: string;
  respondedAt: string | null;
  supplierOrg?: Pick<ApiOrganization, 'id' | 'displayName' | 'legalName' | 'countryCode'> | null;
  rfq?: Pick<ApiRfq, 'id' | 'title' | 'status' | 'quantity' | 'unit' | 'currency' | 'destination' | 'publishedAt'> | null;
};

export type ApiEvidence = {
  id: string;
  purchaseOrderId: string | null;
  milestoneId: string | null;
  objectKey: string;
  classification: string;
  scanStatus: string;
  createdAt: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export type ApiNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  read: boolean;
  href: string | null;
  kind: string;
};

export type ApiMessageThread = {
  id: string;
  organizationId: string;
  participantOrgIds: string[];
  type: 'PRODUCT' | 'RFQ' | 'QUOTE' | 'PURCHASE_ORDER' | 'SAMPLE' | 'INSPECTION' | 'ESCROW' | 'SHIPMENT' | 'SUPPORT';
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  subject: string;
  rfqId: string | null;
  quoteId: string | null;
  purchaseOrderId: string | null;
  sampleId: string | null;
  inspectionReportId: string | null;
  escrowHoldId: string | null;
  shipmentId: string | null;
  lastMessageAt: string;
  createdAt: string;
  messages?: ApiMessage[];
  _count?: { messages: number };
};

export type ApiOfferCard = {
  title: string;
  quantity: number;
  unitPriceCents: number;
  leadTimeDays: number;
  incoterm: 'EXW' | 'FOB' | 'CIF' | 'DDP';
  currency: string;
  notes?: string;
};

export type ApiMessage = {
  id: string;
  threadId: string;
  senderAccountId: string;
  senderOrgId: string;
  body: string;
  offerJson: ApiOfferCard | null;
  idempotencyKey: string | null;
  editedAt: string | null;
  createdAt: string;
  sender?: { id: string; fullName: string; companyName: string | null } | null;
};

export type ApiEscrowCondition = {
  id: string;
  escrowHoldId: string;
  kind: 'PRODUCTION_STARTED' | 'SAMPLE_APPROVED' | 'INSPECTION_APPROVED' | 'MILESTONE_DONE' | 'SHIPMENT_DELIVERED' | 'DOCUMENT_APPROVED' | 'MANUAL';
  title: string;
  description: string | null;
  percentage: number;
  status: 'PENDING' | 'MET' | 'WAIVED';
  metAt: string | null;
  createdAt: string;
};

export type ApiEscrowHold = {
  id: string;
  purchaseOrderId: string;
  buyerOrgId: string;
  supplierOrgId: string;
  amountCents: string;
  currency: string;
  status: 'AWAITING_PAYMENT' | 'FUNDS_HELD_IN_ESCROW' | 'PARTIAL_RELEASED' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED' | 'CANCELLED';
  mode: 'DEMO' | 'LIVE';
  fundedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  conditions?: ApiEscrowCondition[];
  ledger?: ApiEscrowLedgerEntry[];
};

export type ApiEscrowLedgerEntry = {
  id: string;
  escrowHoldId: string;
  type: string;
  amountCents: string;
  balanceAfterCents: string;
  currency: string;
  idempotencyKey: string;
  actorAccountId: string | null;
  createdAt: string;
};

export type ApiShipmentEvent = {
  id: string;
  shipmentId: string;
  status: string;
  occurredAt: string;
  location: string | null;
  note: string | null;
  source: string;
  createdAt: string;
};

export type ApiShipment = {
  id: string;
  purchaseOrderId: string;
  organizationId: string;
  carrier: string | null;
  trackingNumber: string | null;
  origin: string | null;
  destination: string | null;
  status: 'CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'EXCEPTION';
  documentObjectKey: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  events?: ApiShipmentEvent[];
};

export type ApiQuote = ApiQuoteSummary & {
  notes: string | null;
  validUntil: string;
  createdAt: string;
  lines: ApiQuoteLine[];
  supplierOrg?: Pick<ApiOrganization, 'id' | 'displayName' | 'legalName'> | null;
  rfq?: { id: string; title: string; buyerOrgId: string; status: string };
};

export type ApiPurchaseOrder = {
  id: string;
  rfqId: string;
  quoteId: string;
  buyerOrgId: string;
  supplierOrgId: string;
  status: 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  agreedTermsSnapshot: unknown;
  createdAt: string;
  updatedAt: string;
  buyerOrganization?: Pick<ApiOrganization, 'id' | 'displayName'> | null;
  supplierOrg?: Pick<ApiOrganization, 'id' | 'displayName'> | null;
  rfq?: { id: string; title: string; quantity: number; unit: string } | null;
  quote?: { id: string; revision: number; leadTimeDays: number } | null;
  samples?: ApiSample[];
  milestones?: ApiMilestone[];
  evidenceFiles?: ApiEvidence[];
};

export type ApiSample = {
  id: string;
  purchaseOrderId: string;
  version: number;
  status: string;
  notes: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type ApiMilestone = {
  id: string;
  purchaseOrderId: string;
  code: string;
  sequence: number;
  status: 'PENDING' | 'ACTIVE' | 'DONE' | 'BLOCKED';
  plannedAt: string | null;
  completedAt: string | null;
  note: string | null;
};

export type ApiActivity = {
  id: string;
  time: string;
  title: string;
  detail: string;
  kind: 'quote' | 'sample' | 'production' | 'rfq';
};

export type SchemaField = {
  id: string;
  label: string;
  required: boolean;
  type: 'text' | 'choice' | 'number';
  placeholder?: string;
  options?: string[];
};

export type MutationRequest = {
  path: string;
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
};

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
}

export function supplierCapabilities(profile: ApiSupplierProfile | null | undefined): SupplierCapabilities {
  const value = asRecord(profile?.capabilities);
  return {
    category: typeof value.category === 'string' ? value.category : 'غير محدد',
    specialties: Array.isArray(value.specialties) ? value.specialties.map(String) : [],
    score: typeof value.score === 'number' && Number.isFinite(value.score) ? value.score : null,
    responseRate: typeof value.responseRate === 'string' ? value.responseRate : null,
  };
}

export function useApiQuery<T>(path: string | null, staleTime = 30_000, refetchInterval: number | false = false) {
  const { apiFetch, token } = useAuth();
  return useQuery<T, Error>({
    queryKey: ['api', path, Boolean(token)],
    queryFn: () => apiFetch<T>(path as string),
    enabled: Boolean(path && token),
    staleTime,
    refetchInterval,
    retry: 1,
  });
}

export function useApiMutation<TResult = unknown>() {
  const { apiFetch } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, MutationRequest>({
    mutationFn: ({ path, method = 'POST', body }) => apiFetch<TResult>(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api'] });
    },
  });
}

const numberFormatter = new Intl.NumberFormat('ar-SA');
const dateFormatter = new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' });

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatMoney(cents: string | number | undefined, currency: string) {
  const amount = Number(cents ?? 0) / 100;
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency }).format(amount);
  } catch {
    return `${numberFormatter.format(amount)} ${currency}`;
  }
}

export const RFQ_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'مسودة', tone: 'muted' },
  PUBLISHED: { label: 'منشور', tone: 'green' },
  CLOSED: { label: 'مغلق', tone: 'blue' },
  CANCELLED: { label: 'ملغي', tone: 'muted' },
};

export const PO_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'نشط', tone: 'green' },
  IN_PROGRESS: { label: 'قيد التنفيذ', tone: 'blue' },
  COMPLETED: { label: 'مكتمل', tone: 'green' },
  CANCELLED: { label: 'ملغي', tone: 'muted' },
};

export const MILESTONE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'لم يبدأ', tone: 'muted' },
  RAW_MATERIALS_READY: { label: 'المواد الخام جاهزة', tone: 'blue' },
  IN_PRODUCTION: { label: 'قيد الإنتاج', tone: 'blue' },
  ACTIVE: { label: 'جارٍ', tone: 'blue' },
  QUALITY_CHECK: { label: 'فحص الجودة', tone: 'amber' },
  PACKAGING: { label: 'التغليف', tone: 'amber' },
  READY_TO_SHIP: { label: 'جاهز للشحن', tone: 'green' },
  DONE: { label: 'مكتمل', tone: 'green' },
  BLOCKED: { label: 'متوقف', tone: 'amber' },
};

export const VERIFICATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  UNVERIFIED: { label: 'غير موثق', tone: 'muted' },
  DRAFT: { label: 'مسودة', tone: 'muted' },
  SUBMITTED: { label: 'قيد الاستلام', tone: 'blue' },
  IN_REVIEW: { label: 'قيد المراجعة', tone: 'amber' },
  PENDING_AUDIT: { label: 'بانتظار التدقيق', tone: 'amber' },
  APPROVED: { label: 'معتمد', tone: 'green' },
  AUDITED_SUPPLIER: { label: 'مصنع مدقق', tone: 'green' },
  REJECTED: { label: 'مرفوض', tone: 'amber' },
  SUSPENDED: { label: 'معلّق', tone: 'muted' },
};

export const ESCROW_STATUS: Record<string, { label: string; tone: Tone }> = {
  AWAITING_PAYMENT: { label: 'بانتظار التمويل', tone: 'amber' },
  FUNDS_HELD_IN_ESCROW: { label: 'المبلغ محجوز', tone: 'green' },
  PARTIAL_RELEASED: { label: 'تحرير جزئي', tone: 'blue' },
  COMPLETED: { label: 'مكتمل', tone: 'green' },
  DISPUTED: { label: 'نزاع', tone: 'amber' },
  REFUNDED: { label: 'مسترد', tone: 'muted' },
  CANCELLED: { label: 'ملغي', tone: 'muted' },
};

export const SHIPMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  CREATED: { label: 'تم الإنشاء', tone: 'muted' },
  PICKED_UP: { label: 'تم الاستلام', tone: 'blue' },
  IN_TRANSIT: { label: 'في الطريق', tone: 'blue' },
  DELIVERED: { label: 'تم التسليم', tone: 'green' },
  EXCEPTION: { label: 'استثناء', tone: 'amber' },
};

export const INSPECTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'مسودة', tone: 'muted' },
  SUBMITTED: { label: 'مقدّم', tone: 'blue' },
  IN_REVIEW: { label: 'قيد المراجعة', tone: 'amber' },
  APPROVED: { label: 'معتمد', tone: 'green' },
  REJECTED: { label: 'مرفوض', tone: 'amber' },
  EXPIRED: { label: 'منتهي', tone: 'muted' },
};

export const PRODUCT_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'مسودة', tone: 'muted' },
  ACTIVE: { label: 'نشط', tone: 'green' },
  PAUSED: { label: 'موقوف', tone: 'amber' },
  ARCHIVED: { label: 'مؤرشف', tone: 'muted' },
};

export const SAMPLE_STATUS: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: 'مطلوبة', tone: 'muted' },
  QUOTED: { label: 'تم تسعيرها', tone: 'blue' },
  PAID: { label: 'مدفوعة', tone: 'green' },
  IN_PRODUCTION: { label: 'قيد الإنتاج', tone: 'blue' },
  IN_PREPARATION: { label: 'قيد التجهيز', tone: 'blue' },
  SHIPPED: { label: 'تم الشحن', tone: 'blue' },
  DELIVERED: { label: 'تم التسليم', tone: 'green' },
  RECEIVED: { label: 'تم الاستلام', tone: 'amber' },
  REVISION_REQUESTED: { label: 'مطلوب تعديل', tone: 'amber' },
  REVISION_NEEDED: { label: 'يحتاج تعديل', tone: 'amber' },
  APPROVED: { label: 'معتمدة', tone: 'green' },
  REJECTED: { label: 'مرفوضة', tone: 'muted' },
};

export function statusInfo(map: Record<string, { label: string; tone: Tone }>, status: string) {
  return map[status] ?? { label: status, tone: 'muted' as Tone };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function schemaFields(schemaJson: unknown): SchemaField[] {
  const schema = asRecord(schemaJson);
  if (Array.isArray(schema.ui)) {
    return schema.ui.flatMap((item) => {
      const field = asRecord(item);
      if (typeof field.id !== 'string') return [];
      const type = field.type === 'choice' ? 'choice' : field.type === 'number' ? 'number' : 'text';
      return [{
        id: field.id,
        label: typeof field.label === 'string' ? field.label : field.id,
        required: field.required === true,
        type,
        ...(typeof field.placeholder === 'string' ? { placeholder: field.placeholder } : {}),
        ...(Array.isArray(field.options) ? { options: field.options.map(String) } : {}),
      }];
    });
  }

  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
  return Object.entries(asRecord(schema.properties)).map(([key, raw]) => {
    const field = asRecord(raw);
    const options = Array.isArray(field.enum) ? field.enum.map(String) : undefined;
    const type = options?.length ? 'choice' : field.type === 'number' || field.type === 'integer' ? 'number' : 'text';
    return {
      id: key,
      label: typeof field.title === 'string' ? field.title : key,
      required: required.includes(key),
      type,
      ...(typeof field.description === 'string' ? { placeholder: field.description } : {}),
      ...(options?.length ? { options } : {}),
    };
  });
}

export function activityFromData(
  rfqs: ApiRfq[],
  purchaseOrders: ApiPurchaseOrder[],
): ApiActivity[] {
  const items: ApiActivity[] = rfqs.map((rfq) => ({
    id: `rfq-${rfq.id}`,
    time: rfq.publishedAt ?? rfq.createdAt,
    title: rfq.status === 'DRAFT' ? 'مسودة طلب توريد جديدة' : 'تم تحديث طلب توريد',
    detail: rfq.title,
    kind: 'rfq',
  }));

  for (const order of purchaseOrders) {
    items.push({
      id: `po-${order.id}`,
      time: order.createdAt,
      title: 'أمر توريد جديد',
      detail: order.rfq?.title ?? order.id,
      kind: 'production',
    });
    for (const sample of order.samples ?? []) {
      items.push({
        id: `sample-${sample.id}`,
        time: sample.decidedAt ?? sample.receivedAt ?? sample.createdAt,
        title: 'حالة العينة',
        detail: `${order.rfq?.title ?? order.id} · ${statusInfo(SAMPLE_STATUS, sample.status).label}`,
        kind: 'sample',
      });
    }
  }

  return items
    .filter((item) => !Number.isNaN(new Date(item.time).getTime()))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6)
    .map((item) => ({
      ...item,
      time: new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short' }).format(new Date(item.time)),
    }));
}
