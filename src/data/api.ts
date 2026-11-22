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
};

export type ApiSupplier = ApiOrganization & {
  supplierProfile: ApiSupplierProfile | null;
  _count?: { memberships?: number; quotes?: number };
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
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  industry?: ApiIndustry | null;
  buyerOrganization?: Pick<ApiOrganization, 'id' | 'displayName' | 'legalName'> | null;
  schemaVersion?: ApiSchemaVersion | null;
  quotes?: ApiQuoteSummary[];
  invitations?: unknown[];
  _count?: { invitations?: number; quotes?: number };
};

export type ApiQuoteSummary = {
  id: string;
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
  evidenceFiles?: unknown[];
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

export function useApiQuery<T>(path: string | null, staleTime = 30_000) {
  const { apiFetch, token } = useAuth();
  return useQuery<T, Error>({
    queryKey: ['api', path, Boolean(token)],
    queryFn: () => apiFetch<T>(path as string),
    enabled: Boolean(path && token),
    staleTime,
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
  ACTIVE: { label: 'جارٍ', tone: 'blue' },
  DONE: { label: 'مكتمل', tone: 'green' },
  BLOCKED: { label: 'متوقف', tone: 'amber' },
};

export const SAMPLE_STATUS: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: 'مطلوبة', tone: 'muted' },
  IN_PREPARATION: { label: 'قيد التجهيز', tone: 'blue' },
  SHIPPED: { label: 'تم الشحن', tone: 'blue' },
  RECEIVED: { label: 'تم الاستلام', tone: 'amber' },
  REVISION_REQUESTED: { label: 'مطلوب تعديل', tone: 'amber' },
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
