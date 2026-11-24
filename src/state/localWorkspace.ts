import AsyncStorage from '@react-native-async-storage/async-storage';

import { industries as demoIndustries, supplierProfiles } from '@/data/b2bDemo';
import type {
  ApiEvidence,
  ApiIndustry,
  ApiMilestone,
  ApiNotification,
  ApiOrganization,
  ApiPurchaseOrder,
  ApiQuote,
  ApiRfq,
  ApiRfqInvitation,
  ApiSample,
  ApiSchemaVersion,
  ApiSupplier,
} from '@/data/api';

export type WorkspaceAccount = {
  id: string;
  fullName: string;
  companyName: string;
  accountType: 'buyer' | 'supplier';
  email: string;
};

type Workspace = {
  version: 1;
  industries: ApiIndustry[];
  schemaVersions: ApiSchemaVersion[];
  suppliers: ApiSupplier[];
  rfqs: ApiRfq[];
  quotes: ApiQuote[];
  invitations: ApiRfqInvitation[];
  purchaseOrders: ApiPurchaseOrder[];
  notifications: ApiNotification[];
};

type Body = Record<string, unknown>;

const STORAGE_PREFIX = 'souqi.workspace.v1:';

function stableUuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function makeId() {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  const values = new Uint8Array(16);
  globalCrypto.getRandomValues(values);
  const hex = Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function storageKey(account: WorkspaceAccount) {
  return `${STORAGE_PREFIX}${account.id}`;
}

export function workspaceOrganizationFor(account: WorkspaceAccount): ApiOrganization {
  const hex = account.id.replace(/[^a-f0-9]/gi, '').slice(0, 12).padEnd(12, '0');
  return {
    id: `10000000-0000-4000-8000-${hex}`,
    type: account.accountType === 'supplier' ? 'SUPPLIER' : 'BUYER',
    legalName: account.companyName,
    displayName: account.companyName,
    countryCode: 'SA',
    status: 'ACTIVE',
  };
}

function demoRequirements(index: number): Record<string, unknown> {
  return Object.fromEntries(demoIndustries[index].fields.map((field) => [
    field.id,
    field.type === 'choice' ? field.options?.[0] ?? '' : `عينة ${field.label}`,
  ]));
}

function createSeedWorkspace(account: WorkspaceAccount): Workspace {
  const now = nowIso();
  const organization = workspaceOrganizationFor(account);
  const industries: ApiIndustry[] = demoIndustries.map((industry, index) => ({
    id: stableUuid(100 + index),
    code: industry.id,
    nameAr: industry.label,
    active: true,
  }));
  const schemaVersions: ApiSchemaVersion[] = demoIndustries.map((industry, index) => ({
    id: stableUuid(200 + index),
    industryId: industries[index].id,
    version: 1,
    schemaJson: {
      ui: industry.fields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder,
        options: field.options,
      })),
    },
    status: 'PUBLISHED',
    publishedAt: now,
  }));
  const suppliers: ApiSupplier[] = supplierProfiles.map((profile, index) => ({
    id: stableUuid(500 + index),
    type: 'SUPPLIER',
    legalName: profile.name,
    displayName: profile.name,
    countryCode: profile.country === 'السعودية' ? 'SA' : profile.country === 'الإمارات' ? 'AE' : 'JO',
    status: 'ACTIVE',
    supplierProfile: {
      organizationId: stableUuid(500 + index),
      verificationStatus: profile.verified ? 'APPROVED' : 'IN_REVIEW',
      capabilities: {
        category: profile.category,
        specialties: profile.specialties,
        score: profile.score,
        responseRate: profile.responseRate,
      },
      minOrderQuantity: Number(profile.minOrder.replace(/[^0-9]/g, '')) || 1000,
      leadTimeDays: Number(profile.leadTime.replace(/[^0-9]/g, '')) || 14,
      website: null,
    },
    _count: { memberships: 2, quotes: index + 1 },
  }));
  const publishedRfqId = stableUuid(300);
  const draftRfqId = stableUuid(301);
  const closedRfqId = stableUuid(302);
  const rfqs: ApiRfq[] = [
    {
      id: publishedRfqId,
      buyerOrgId: organization.id,
      industryId: industries[0].id,
      schemaVersionId: schemaVersions[0].id,
      status: 'PUBLISHED',
      title: 'قمصان قطنية لعلامة نواة',
      quantity: 2400,
      unit: 'قطعة',
      currency: 'SAR',
      destination: 'الرياض، السعودية',
      targetDate: now,
      requirements: demoRequirements(0),
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      industry: industries[0],
      buyerOrganization: organization,
      schemaVersion: schemaVersions[0],
      _count: { invitations: 3, quotes: 1 },
    },
    {
      id: closedRfqId,
      buyerOrgId: organization.id,
      industryId: industries[1].id,
      schemaVersionId: schemaVersions[1].id,
      status: 'CLOSED',
      title: 'علب شحن من كرتون معاد تدويره',
      quantity: 8000,
      unit: 'علبة',
      currency: 'SAR',
      destination: 'جدة، السعودية',
      targetDate: null,
      requirements: demoRequirements(1),
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      industry: industries[1],
      buyerOrganization: organization,
      schemaVersion: schemaVersions[1],
      _count: { invitations: 2, quotes: 2 },
    },
    {
      id: draftRfqId,
      buyerOrgId: organization.id,
      industryId: industries[2].id,
      schemaVersionId: schemaVersions[2].id,
      status: 'DRAFT',
      title: 'خليط تمر وقهوة مختصة',
      quantity: 1200,
      unit: 'عبوة',
      currency: 'SAR',
      destination: 'الدمام، السعودية',
      targetDate: null,
      requirements: demoRequirements(2),
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      industry: industries[2],
      buyerOrganization: organization,
      schemaVersion: schemaVersions[2],
      _count: { invitations: 0, quotes: 0 },
    },
  ];
  const invitations: ApiRfqInvitation[] = suppliers.slice(0, 3).map((supplier, index) => ({
    id: stableUuid(600 + index),
    rfqId: publishedRfqId,
    supplierOrgId: supplier.id,
    status: index === 0 ? 'ACCEPTED' : 'PENDING',
    sentAt: now,
    respondedAt: index === 0 ? now : null,
    supplierOrg: {
      id: supplier.id,
      displayName: supplier.displayName,
      legalName: supplier.legalName,
      countryCode: supplier.countryCode,
    },
    rfq: {
      id: publishedRfqId,
      title: rfqs[0].title,
      status: 'PUBLISHED',
      quantity: rfqs[0].quantity,
      unit: rfqs[0].unit,
      currency: rfqs[0].currency,
      destination: rfqs[0].destination,
      publishedAt: now,
    },
  }));
  if (account.accountType === 'supplier' && !suppliers.some((supplier) => supplier.id === organization.id)) {
    const currentSupplier: ApiSupplier = {
      ...organization,
      supplierProfile: {
        organizationId: organization.id,
        verificationStatus: 'APPROVED',
        capabilities: {
          category: 'تصنيع عام',
          specialties: ['توريد', 'تصنيع'],
          score: 88,
          responseRate: '92%',
        },
        minOrderQuantity: 500,
        leadTimeDays: 12,
        website: null,
      },
      _count: { memberships: 1, quotes: 0 },
    };
    suppliers.unshift(currentSupplier);
    invitations.unshift({
      id: stableUuid(615),
      rfqId: publishedRfqId,
      supplierOrgId: organization.id,
      status: 'PENDING',
      sentAt: now,
      respondedAt: null,
      supplierOrg: {
        id: organization.id,
        displayName: organization.displayName,
        legalName: organization.legalName,
        countryCode: organization.countryCode,
      },
      rfq: {
        id: publishedRfqId,
        title: rfqs[0].title,
        status: 'PUBLISHED',
        quantity: rfqs[0].quantity,
        unit: rfqs[0].unit,
        currency: rfqs[0].currency,
        destination: rfqs[0].destination,
        publishedAt: now,
      },
    });
  }
  const quotes: ApiQuote[] = [
    {
      id: stableUuid(400),
      rfqId: publishedRfqId,
      supplierOrgId: suppliers[0].id,
      revision: 1,
      status: 'SUBMITTED',
      currency: 'SAR',
      leadTimeDays: 12,
      submittedAt: now,
      supplierOrg: { id: suppliers[0].id, displayName: suppliers[0].displayName, legalName: suppliers[0].legalName },
      notes: 'خامة قطن عضوي مع عينة لونية قبل الإنتاج.',
      validUntil: now,
      createdAt: now,
      lines: [
        {
          id: stableUuid(410),
          quoteId: stableUuid(400),
          name: 'قميص قطني عضوي',
          quantity: 2400,
          unitPriceCents: '18000',
          totalPriceCents: '43200000',
        },
      ],
      rfq: { id: publishedRfqId, title: rfqs[0].title, buyerOrgId: organization.id, status: 'PUBLISHED' },
    },
  ];
  const poId = stableUuid(700);
  const purchaseOrders: ApiPurchaseOrder[] = [
    {
      id: poId,
      rfqId: closedRfqId,
      quoteId: stableUuid(401),
      buyerOrgId: organization.id,
      supplierOrgId: suppliers[1].id,
      status: 'IN_PROGRESS',
      agreedTermsSnapshot: {
        title: rfqs[1].title,
        quantity: rfqs[1].quantity,
        unit: rfqs[1].unit,
        currency: rfqs[1].currency,
        requirements: rfqs[1].requirements,
        quote: { revision: 2, leadTimeDays: 9, notes: 'طباعة لون واحد على العلبة.' },
      },
      createdAt: now,
      updatedAt: now,
      buyerOrganization: { id: organization.id, displayName: organization.displayName },
      supplierOrg: { id: suppliers[1].id, displayName: suppliers[1].displayName },
      rfq: { id: closedRfqId, title: rfqs[1].title, quantity: 8000, unit: 'علبة' },
      quote: { id: stableUuid(401), revision: 2, leadTimeDays: 9 },
      samples: [
        {
          id: stableUuid(710),
          purchaseOrderId: poId,
          version: 1,
          status: 'SHIPPED',
          notes: 'عينة طباعة أولى',
          shippedAt: now,
          receivedAt: null,
          decidedAt: null,
          createdAt: now,
        },
      ],
      milestones: [
        {
          id: stableUuid(720),
          purchaseOrderId: poId,
          code: 'تحضير الخامة',
          sequence: 1,
          status: 'DONE',
          plannedAt: now,
          completedAt: now,
          note: null,
        },
        {
          id: stableUuid(721),
          purchaseOrderId: poId,
          code: 'الطباعة والتجميع',
          sequence: 2,
          status: 'ACTIVE',
          plannedAt: now,
          completedAt: null,
          note: 'جارٍ تجهيز الدفعة الأولى.',
        },
      ],
      evidenceFiles: [
        {
          id: stableUuid(730),
          purchaseOrderId: poId,
          milestoneId: stableUuid(720),
          objectKey: `${suppliers[1].id}/material-certificate.pdf`,
          classification: 'شهادة خامة',
          scanStatus: 'CLEAN',
          createdAt: now,
          mimeType: 'application/pdf',
          sizeBytes: 248000,
        },
      ],
    },
  ];
  const notifications: ApiNotification[] = [
    {
      id: stableUuid(800),
      title: 'عرض جديد على طلبك',
      body: `${suppliers[0].displayName} قدّم عرضًا لطلب ${rfqs[0].title}.`,
      createdAt: now,
      read: false,
      href: `/rfq/${publishedRfqId}`,
      kind: 'quote',
    },
    {
      id: stableUuid(801),
      title: 'دعوة لطلب توريد',
      body: `طلب ${rfqs[0].title} متاح لمراجعة العرض.`,
      createdAt: now,
      read: false,
      href: `/supplier/rfqs/${publishedRfqId}`,
      kind: 'invitation',
    },
    {
      id: stableUuid(802),
      title: 'تحديث في أمر الشراء',
      body: `المرحلة الحالية لأمر ${rfqs[1].title} قيد التنفيذ.`,
      createdAt: now,
      read: true,
      href: `/orders/${poId}`,
      kind: 'order',
    },
  ];

  return {
    version: 1,
    industries,
    schemaVersions,
    suppliers,
    rfqs,
    quotes,
    invitations,
    purchaseOrders,
    notifications,
  };
}

async function readWorkspace(account: WorkspaceAccount): Promise<Workspace> {
  const raw = await AsyncStorage.getItem(storageKey(account));
  if (raw) {
    try {
      const value = JSON.parse(raw) as Workspace;
      if (value.version === 1 && Array.isArray(value.rfqs) && Array.isArray(value.notifications)) {
        return value;
      }
    } catch {
      void 0;
    }
  }
  const seeded = createSeedWorkspace(account);
  await AsyncStorage.setItem(storageKey(account), JSON.stringify(seeded));
  return seeded;
}

async function writeWorkspace(workspace: Workspace, account: WorkspaceAccount) {
  await AsyncStorage.setItem(storageKey(account), JSON.stringify(workspace));
}

function stringValue(body: Body, key: string, fallback = '') {
  const value = body[key];
  return typeof value === 'string' ? value : fallback;
}

function numberValue(body: Body, key: string, fallback = 0) {
  const value = body[key];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arrayValue(body: Body, key: string): unknown[] {
  const value = body[key];
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): Body {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Body : {};
}

function notify(workspace: Workspace, notification: Omit<ApiNotification, 'id' | 'createdAt' | 'read'>) {
  workspace.notifications.unshift({
    ...notification,
    id: makeId(),
    createdAt: nowIso(),
    read: false,
  });
}

function decorateRfq(workspace: Workspace, rfq: ApiRfq): ApiRfq {
  const invitations = workspace.invitations.filter((item) => item.rfqId === rfq.id);
  const quotes = workspace.quotes.filter((item) => item.rfqId === rfq.id);
  return {
    ...rfq,
    invitations,
    quotes: quotes.map((quote) => ({
      id: quote.id,
      rfqId: quote.rfqId,
      supplierOrgId: quote.supplierOrgId,
      revision: quote.revision,
      status: quote.status,
      currency: quote.currency,
      leadTimeDays: quote.leadTimeDays,
      submittedAt: quote.submittedAt,
      supplierOrg: quote.supplierOrg,
    })),
    _count: { invitations: invitations.length, quotes: quotes.length },
  };
}

function decorateOrder(workspace: Workspace, order: ApiPurchaseOrder): ApiPurchaseOrder {
  return {
    ...order,
    samples: workspace.purchaseOrders.find((item) => item.id === order.id)?.samples ?? [],
    milestones: workspace.purchaseOrders.find((item) => item.id === order.id)?.milestones ?? [],
    evidenceFiles: workspace.purchaseOrders.find((item) => item.id === order.id)?.evidenceFiles ?? [],
  };
}

function routeMatch(path: string, pattern: RegExp) {
  const match = path.match(pattern);
  return match?.[1] ?? null;
}

async function handleGet(account: WorkspaceAccount, path: string, organization: ApiOrganization) {
  const workspace = await readWorkspace(account);
  if (path === '/api/industries') return { industries: workspace.industries };
  if (path === '/api/suppliers') return { suppliers: workspace.suppliers };
  if (path === '/api/rfqs') {
    return { rfqs: workspace.rfqs.map((rfq) => decorateRfq(workspace, rfq)) };
  }
  if (path === '/api/purchase-orders') {
    return { purchaseOrders: workspace.purchaseOrders.map((order) => decorateOrder(workspace, order)) };
  }
  if (path === '/api/notifications') {
    return {
      notifications: workspace.notifications,
      unreadCount: workspace.notifications.filter((item) => !item.read).length,
    };
  }
  if (path === '/api/supplier-invitations') {
    return {
      invitations: workspace.invitations
        .filter((invitation) => invitation.supplierOrgId === organization.id)
        .map((invitation) => ({
          ...invitation,
          rfq: workspace.rfqs.find((rfq) => rfq.id === invitation.rfqId) ?? null,
        })),
    };
  }
  const schemaId = routeMatch(path, /^\/api\/schema-versions\/([^/]+)$/);
  if (schemaId) {
    return { version: workspace.schemaVersions.find((item) => item.id === schemaId) ?? null };
  }
  const industryId = routeMatch(path, /^\/api\/industries\/([^/]+)\/schemas$/);
  if (industryId) {
    return { versions: workspace.schemaVersions.filter((item) => item.industryId === industryId) };
  }
  const rfqId = routeMatch(path, /^\/api\/rfqs\/([^/]+)$/);
  if (rfqId) {
    const rfq = workspace.rfqs.find((item) => item.id === rfqId);
    return { rfq: rfq ? decorateRfq(workspace, rfq) : null };
  }
  const quotesRfqId = routeMatch(path, /^\/api\/rfqs\/([^/]+)\/quotes$/);
  if (quotesRfqId) {
    return { quotes: workspace.quotes.filter((quote) => quote.rfqId === quotesRfqId) };
  }
  const invitationsRfqId = routeMatch(path, /^\/api\/rfqs\/([^/]+)\/invitations$/);
  if (invitationsRfqId) {
    return { invitations: workspace.invitations.filter((item) => item.rfqId === invitationsRfqId) };
  }
  const orderId = routeMatch(path, /^\/api\/purchase-orders\/([^/]+)$/);
  if (orderId) {
    const order = workspace.purchaseOrders.find((item) => item.id === orderId);
    return { purchaseOrder: order ? decorateOrder(workspace, order) : null };
  }
  return null;
}

async function handleMutation(account: WorkspaceAccount, path: string, method: string, body: Body, organization: ApiOrganization) {
  const workspace = await readWorkspace(account);
  if (path === '/api/rfqs' && method === 'POST') {
    const now = nowIso();
    const rfq: ApiRfq = {
      id: makeId(),
      buyerOrgId: organization.id,
      industryId: stringValue(body, 'industryId'),
      schemaVersionId: stringValue(body, 'schemaVersionId'),
      status: 'DRAFT',
      title: stringValue(body, 'title', 'طلب توريد جديد'),
      quantity: numberValue(body, 'quantity', 1),
      unit: stringValue(body, 'unit', 'قطعة'),
      currency: stringValue(body, 'currency', 'SAR').toUpperCase(),
      destination: stringValue(body, 'destination'),
      targetDate: stringValue(body, 'targetDate') || null,
      requirements: recordValue(body.requirements),
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      buyerOrganization: organization,
      industry: workspace.industries.find((item) => item.id === stringValue(body, 'industryId')) ?? null,
      schemaVersion: workspace.schemaVersions.find((item) => item.id === stringValue(body, 'schemaVersionId')) ?? null,
      _count: { invitations: 0, quotes: 0 },
    };
    workspace.rfqs.unshift(rfq);
    notify(workspace, {
      title: 'تم حفظ مسودة الطلب',
      body: `أُنشئت مسودة ${rfq.title} ويمكنك تعديلها قبل النشر.`,
      href: `/rfq/${rfq.id}`,
      kind: 'rfq',
    });
    await writeWorkspace(workspace, account);
    return { rfq };
  }

  const editId = routeMatch(path, /^\/api\/rfqs\/([^/]+)$/);
  if (editId && method === 'PATCH') {
    const rfq = workspace.rfqs.find((item) => item.id === editId);
    if (!rfq) return { rfq: null };
    const nextTitle = stringValue(body, 'title', rfq.title);
    Object.assign(rfq, {
      industryId: stringValue(body, 'industryId', rfq.industryId),
      schemaVersionId: stringValue(body, 'schemaVersionId', rfq.schemaVersionId),
      title: nextTitle,
      quantity: numberValue(body, 'quantity', rfq.quantity),
      unit: stringValue(body, 'unit', rfq.unit),
      currency: stringValue(body, 'currency', rfq.currency).toUpperCase(),
      destination: stringValue(body, 'destination', rfq.destination),
      targetDate: stringValue(body, 'targetDate') || null,
      requirements: body.requirements ? recordValue(body.requirements) : rfq.requirements,
      industry: workspace.industries.find((item) => item.id === rfq.industryId) ?? null,
      schemaVersion: workspace.schemaVersions.find((item) => item.id === rfq.schemaVersionId) ?? null,
      updatedAt: nowIso(),
    });
    await writeWorkspace(workspace, account);
    return { rfq: decorateRfq(workspace, rfq) };
  }

  const statusId = routeMatch(path, /^\/api\/rfqs\/([^/]+)\/status$/);
  if (statusId && method === 'POST') {
    const rfq = workspace.rfqs.find((item) => item.id === statusId);
    if (!rfq) return { rfq: null };
    const status = stringValue(body, 'status') as ApiRfq['status'];
    rfq.status = status;
    rfq.updatedAt = nowIso();
    if (status === 'PUBLISHED') rfq.publishedAt = nowIso();
    if (status === 'CLOSED') rfq.updatedAt = nowIso();
    notify(workspace, {
      title: status === 'PUBLISHED' ? 'تم نشر طلب التوريد' : 'تم تحديث حالة الطلب',
      body: `${rfq.title} · ${status === 'PUBLISHED' ? 'أصبح متاحًا لاستقبال العروض' : status}`,
      href: `/rfq/${rfq.id}`,
      kind: 'rfq',
    });
    await writeWorkspace(workspace, account);
    return { rfq: decorateRfq(workspace, rfq) };
  }

  const inviteId = routeMatch(path, /^\/api\/rfqs\/([^/]+)\/invitations$/);
  if (inviteId && method === 'POST') {
    const rfq = workspace.rfqs.find((item) => item.id === inviteId);
    if (!rfq) return { invited: 0 };
    const ids = arrayValue(body, 'supplierOrgIds').map(String);
    for (const supplierOrgId of ids) {
      if (workspace.invitations.some((item) => item.rfqId === rfq.id && item.supplierOrgId === supplierOrgId)) continue;
      workspace.invitations.unshift({
        id: makeId(),
        rfqId: rfq.id,
        supplierOrgId,
        status: 'PENDING',
        sentAt: nowIso(),
        respondedAt: null,
        supplierOrg: workspace.suppliers.find((item) => item.id === supplierOrgId)
          ? {
              id: supplierOrgId,
              displayName: workspace.suppliers.find((item) => item.id === supplierOrgId)!.displayName,
              legalName: workspace.suppliers.find((item) => item.id === supplierOrgId)!.legalName,
              countryCode: workspace.suppliers.find((item) => item.id === supplierOrgId)!.countryCode,
            }
          : null,
        rfq,
      });
    }
    notify(workspace, {
      title: 'تم إرسال الدعوات',
      body: `أُرسلت ${ids.length} دعوة لطلب ${rfq.title}.`,
      href: `/rfq/${rfq.id}`,
      kind: 'invitation',
    });
    await writeWorkspace(workspace, account);
    return { invited: ids.length };
  }

  if (path === '/api/quotes' && method === 'POST') {
    const now = nowIso();
    const rfqId = stringValue(body, 'rfqId');
    const supplierOrgId = stringValue(body, 'supplierOrgId');
    const lines = arrayValue(body, 'lines').map((raw) => {
      const line = recordValue(raw);
      const quantity = numberValue(line, 'quantity', 1);
      const unitPriceCents = numberValue(line, 'unitPriceCents', 0);
      return {
        id: makeId(),
        quoteId: '',
        name: stringValue(line, 'name', 'بند'),
        quantity,
        unitPriceCents: String(unitPriceCents),
        totalPriceCents: String(unitPriceCents * quantity),
      };
    });
    const quote: ApiQuote = {
      id: makeId(),
      rfqId,
      supplierOrgId,
      revision: numberValue(body, 'revision', 1),
      status: 'SUBMITTED',
      currency: stringValue(body, 'currency', 'SAR').toUpperCase(),
      leadTimeDays: numberValue(body, 'leadTimeDays', 1),
      submittedAt: now,
      supplierOrg: workspace.suppliers.find((item) => item.id === supplierOrgId)
        ? {
            id: supplierOrgId,
            displayName: workspace.suppliers.find((item) => item.id === supplierOrgId)!.displayName,
            legalName: workspace.suppliers.find((item) => item.id === supplierOrgId)!.legalName,
          }
        : null,
      notes: stringValue(body, 'notes') || null,
      validUntil: stringValue(body, 'validUntil', now),
      createdAt: now,
      lines: lines.map((line) => ({ ...line, quoteId: '' })),
      rfq: workspace.rfqs.find((item) => item.id === rfqId)
        ? {
            id: rfqId,
            title: workspace.rfqs.find((item) => item.id === rfqId)!.title,
            buyerOrgId: workspace.rfqs.find((item) => item.id === rfqId)!.buyerOrgId,
            status: workspace.rfqs.find((item) => item.id === rfqId)!.status,
          }
        : undefined,
    };
    quote.lines = quote.lines.map((line) => ({ ...line, quoteId: quote.id }));
    workspace.quotes.unshift(quote);
    const invitation = workspace.invitations.find((item) => item.rfqId === rfqId && item.supplierOrgId === supplierOrgId);
    if (invitation) {
      invitation.status = 'ACCEPTED';
      invitation.respondedAt = now;
    }
    notify(workspace, {
      title: 'تم تقديم العرض',
      body: `وصل عرض جديد بمراجعة ${quote.revision} لطلب ${quote.rfq?.title ?? ''}.`,
      href: `/rfq/${rfqId}`,
      kind: 'quote',
    });
    await writeWorkspace(workspace, account);
    return { quote };
  }

  const awardId = routeMatch(path, /^\/api\/rfqs\/([^/]+)\/award$/);
  if (awardId && method === 'POST') {
    const rfq = workspace.rfqs.find((item) => item.id === awardId);
    const quote = workspace.quotes.find((item) => item.id === stringValue(body, 'quoteId'));
    if (!rfq || !quote) return { purchaseOrder: null };
    const now = nowIso();
    const purchaseOrder: ApiPurchaseOrder = {
      id: makeId(),
      rfqId: rfq.id,
      quoteId: quote.id,
      buyerOrgId: rfq.buyerOrgId,
      supplierOrgId: quote.supplierOrgId,
      status: 'ACTIVE',
      agreedTermsSnapshot: {
        title: rfq.title,
        quantity: rfq.quantity,
        unit: rfq.unit,
        currency: rfq.currency,
        requirements: rfq.requirements,
        quote: {
          revision: quote.revision,
          leadTimeDays: quote.leadTimeDays,
          notes: quote.notes,
          lines: quote.lines,
        },
      },
      createdAt: now,
      updatedAt: now,
      buyerOrganization: { id: rfq.buyerOrgId, displayName: rfq.buyerOrganization?.displayName ?? '' },
      supplierOrg: { id: quote.supplierOrgId, displayName: quote.supplierOrg?.displayName ?? '' },
      rfq: { id: rfq.id, title: rfq.title, quantity: rfq.quantity, unit: rfq.unit },
      quote: { id: quote.id, revision: quote.revision, leadTimeDays: quote.leadTimeDays },
      samples: [],
      milestones: [],
      evidenceFiles: [],
    };
    workspace.purchaseOrders.unshift(purchaseOrder);
    rfq.status = 'CLOSED';
    rfq.updatedAt = now;
    for (const item of workspace.quotes) {
      if (item.rfqId === rfq.id && item.id !== quote.id) item.status = 'LOST';
    }
    notify(workspace, {
      title: 'تم ترسية العرض',
      body: `أُنشئ أمر الشراء ${purchaseOrder.id.slice(0, 8)} لطلب ${rfq.title}.`,
      href: `/orders/${purchaseOrder.id}`,
      kind: 'order',
    });
    await writeWorkspace(workspace, account);
    return { purchaseOrder };
  }

  const sampleOrderId = routeMatch(path, /^\/api\/purchase-orders\/([^/]+)\/samples$/);
  if (sampleOrderId && method === 'POST') {
    const order = workspace.purchaseOrders.find((item) => item.id === sampleOrderId);
    if (!order) return { sample: null };
    const sample: ApiSample = {
      id: makeId(),
      purchaseOrderId: order.id,
      version: numberValue(body, 'version', (order.samples?.length ?? 0) + 1),
      status: 'REQUESTED',
      notes: stringValue(body, 'notes') || null,
      shippedAt: null,
      receivedAt: null,
      decidedAt: null,
      createdAt: nowIso(),
    };
    order.samples = [sample, ...(order.samples ?? [])];
    await writeWorkspace(workspace, account);
    return { sample };
  }

  const sampleStatusId = routeMatch(path, /^\/api\/samples\/([^/]+)\/status$/);
  if (sampleStatusId && method === 'POST') {
    for (const order of workspace.purchaseOrders) {
      const sample = order.samples?.find((item) => item.id === sampleStatusId);
      if (!sample) continue;
      sample.status = stringValue(body, 'status', sample.status);
      if (sample.status === 'SHIPPED') sample.shippedAt = stringValue(body, 'shippedAt', nowIso());
      if (sample.status === 'RECEIVED') sample.receivedAt = stringValue(body, 'receivedAt', nowIso());
      if (sample.status === 'APPROVED' || sample.status === 'REJECTED') sample.decidedAt = nowIso();
      if (stringValue(body, 'notes')) sample.notes = stringValue(body, 'notes');
      notify(workspace, {
        title: 'تحديث حالة العينة',
        body: `أصبحت العينة ${sample.version} ${sample.status}.`,
        href: `/orders/${order.id}`,
        kind: 'sample',
      });
      await writeWorkspace(workspace, account);
      return { sample };
    }
    return { sample: null };
  }

  const milestoneOrderId = routeMatch(path, /^\/api\/purchase-orders\/([^/]+)\/milestones$/);
  if (milestoneOrderId && method === 'POST') {
    const order = workspace.purchaseOrders.find((item) => item.id === milestoneOrderId);
    if (!order) return { milestone: null };
    const milestone: ApiMilestone = {
      id: makeId(),
      purchaseOrderId: order.id,
      code: stringValue(body, 'code', 'مرحلة جديدة'),
      sequence: numberValue(body, 'sequence', (order.milestones?.length ?? 0) + 1),
      status: 'PENDING',
      plannedAt: stringValue(body, 'plannedAt') || null,
      completedAt: null,
      note: stringValue(body, 'note') || null,
    };
    order.milestones = [...(order.milestones ?? []), milestone];
    await writeWorkspace(workspace, account);
    return { milestone };
  }

  const milestoneStatusId = routeMatch(path, /^\/api\/milestones\/([^/]+)\/status$/);
  if (milestoneStatusId && method === 'POST') {
    for (const order of workspace.purchaseOrders) {
      const milestone = order.milestones?.find((item) => item.id === milestoneStatusId);
      if (!milestone) continue;
      milestone.status = stringValue(body, 'status', milestone.status) as ApiMilestone['status'];
      if (milestone.status === 'DONE') milestone.completedAt = nowIso();
      if (stringValue(body, 'note')) milestone.note = stringValue(body, 'note');
      notify(workspace, {
        title: 'تحديث مرحلة الإنتاج',
        body: `${milestone.code} · ${milestone.status}`,
        href: `/orders/${order.id}`,
        kind: 'order',
      });
      await writeWorkspace(workspace, account);
      return { milestone };
    }
    return { milestone: null };
  }

  if (path === '/api/evidence' && method === 'POST') {
    const orderId = stringValue(body, 'purchaseOrderId') || null;
    const order = workspace.purchaseOrders.find((item) => item.id === orderId);
    if (!order) return { evidence: null };
    const rawObjectKey = stringValue(body, 'objectKey', 'evidence.txt');
    const evidence: ApiEvidence = {
      id: makeId(),
      purchaseOrderId: orderId,
      milestoneId: stringValue(body, 'milestoneId') || null,
      objectKey: rawObjectKey.startsWith(`${organization.id}/`) ? rawObjectKey : `${organization.id}/${rawObjectKey}`,
      classification: stringValue(body, 'classification', 'أدلة الجودة'),
      scanStatus: 'CLEAN',
      createdAt: nowIso(),
      mimeType: stringValue(body, 'mimeType', 'text/plain'),
      sizeBytes: numberValue(body, 'sizeBytes', 1),
    };
    order.evidenceFiles = [evidence, ...(order.evidenceFiles ?? [])];
    notify(workspace, {
      title: 'تم تسجيل دليل جديد',
      body: `${evidence.classification} · ${evidence.objectKey.split('/').pop()}`,
      href: `/orders/${order.id}`,
      kind: 'order',
    });
    await writeWorkspace(workspace, account);
    return { evidence };
  }

  const notificationId = routeMatch(path, /^\/api\/notifications\/([^/]+)$/);
  if (notificationId && method === 'PATCH') {
    const notification = workspace.notifications.find((item) => item.id === notificationId);
    if (notification) notification.read = true;
    await writeWorkspace(workspace, account);
    return { notification: notification ?? null };
  }

  if (path === '/api/notifications/read-all' && method === 'POST') {
    workspace.notifications = workspace.notifications.map((item) => ({ ...item, read: true }));
    await writeWorkspace(workspace, account);
    return {
      notifications: workspace.notifications,
      unreadCount: 0,
    };
  }

  return null;
}

export async function handleLocalWorkspaceRequest(
  account: WorkspaceAccount | null,
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown> | null> {
  if (!account) return null;
  const clean = path.split('?')[0].replace(/\/$/, '') || '/';
  const method = (init?.method ?? 'GET').toUpperCase();
  let body: Body = {};
  if (typeof init?.body === 'string') {
    try {
      body = JSON.parse(init.body) as Body;
    } catch {
      body = {};
    }
  } else if (init?.body && typeof init.body === 'object') {
    body = init.body as unknown as Body;
  }
  const organization = workspaceOrganizationFor(account);
  if (method === 'GET') return handleGet(account, clean, organization);
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    return handleMutation(account, clean, method, body, organization);
  }
  return null;
}
