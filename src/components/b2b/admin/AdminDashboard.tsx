import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../AppHeader';
import { colors } from '../palette';
import { fonts } from '../typography';
import {
  errorMessage,
  formatDate,
  formatNumber,
  useApiMutation,
  useApiQuery,
  type ApiSchemaVersion,
  type MutationRequest,
} from '@/data/api';
import { useAuth } from '@/state/AuthContext';
import {
  PERMISSION_KEYS,
  ROLE_LABELS,
  ROLE_PERMISSION_KEYS,
  permissionLabel,
  roleLabel,
  type AppRole,
} from '@/state/permissions';

type AdminTab =
  | 'overview'
  | 'accounts'
  | 'organizations'
  | 'members'
  | 'approvals'
  | 'industries'
  | 'audit'
  | 'events'
  | 'permissions';

type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'QUALITY';

type AdminOverview = {
  accounts: number;
  organizations: number;
  quotes: number;
  purchaseOrders: number;
  pendingSupplierVerifications: number;
  pendingEvents: number;
  rfqsByStatus: Record<string, number>;
};

type AdminAccount = {
  id: string;
  fullName: string;
  companyName: string;
  email: string;
  accountType: string;
  isPlatformAdmin: boolean;
  createdAt: string;
  role: AppRole | null;
  roleLabel: string | null;
  permissions: string[];
  memberships: {
    id: string;
    role: MembershipRole;
    status: string;
    organization: { id: string; displayName: string; type: string; status: string };
  }[];
};

type AdminOrganization = {
  id: string;
  legalName: string;
  displayName: string;
  type: string;
  status: string;
  countryCode: string | null;
  createdAt: string;
  supplierProfile: { verificationStatus: string } | null;
  _count: { memberships: number; buyerRfqs: number; quotes: number };
};

type AdminMember = {
  id: string;
  role: MembershipRole;
  status: string;
  createdAt: string;
  account: { id: string; fullName: string; email: string; accountType: string };
};

type AdminIndustry = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  code?: string | null;
  active: boolean;
  _count: { schemaVersions: number; rfqs: number };
  schemaVersions: { id: string; version: number; publishedAt: string | null }[];
};

type AuditEvent = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; fullName: string; email: string } | null;
};

type OutboxEvent = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  attempts: number;
  publishedAt: string | null;
  createdAt: string;
};

type PermissionsPayload = {
  permissions: string[];
  roles: { value: string; label: string }[];
};

type Feedback = { tone: 'success' | 'error'; text: string };

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'accounts', label: 'الحسابات' },
  { key: 'organizations', label: 'المؤسسات' },
  { key: 'members', label: 'الأعضاء' },
  { key: 'approvals', label: 'الاعتمادات' },
  { key: 'industries', label: 'القطاعات' },
  { key: 'audit', label: 'سجل التدقيق' },
  { key: 'events', label: 'الأحداث' },
  { key: 'permissions', label: 'الصلاحيات' },
];

const MEMBERSHIP_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'QUALITY'];
const VERIFICATION_STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  DRAFT: 'مسودة',
  SUBMITTED: 'مقدمة',
  IN_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  PUBLISHED: 'منشور',
  INACTIVE: 'غير نشط',
  OPEN: 'مفتوح',
  CLOSED: 'مغلق',
  AWARDED: 'مُرسى',
  IN_PROGRESS: 'قيد التنفيذ',
  COMPLETED: 'مكتمل',
};

const DEFAULT_SCHEMA = `{
  "title": "مواصفات القطاع",
  "type": "object",
  "properties": {},
  "required": [],
  "ui": []
}`;

const EMPTY_ACCOUNT_FORM = {
  fullName: '',
  companyName: '',
  email: '',
  password: '',
  accountType: 'BUYER' as 'BUYER' | 'SUPPLIER',
  isPlatformAdmin: false,
};

const EMPTY_ORGANIZATION_FORM = {
  legalName: '',
  displayName: '',
  type: 'BUYER' as 'BUYER' | 'SUPPLIER',
  countryCode: 'SA',
};

const EMPTY_INDUSTRY_FORM = { code: '', nameAr: '' };

function statusText(status: string | null | undefined) {
  if (!status) return '—';
  return STATUS_LABELS[status] ?? status;
}

function statusTone(status: string | null | undefined) {
  if (status === 'ACTIVE' || status === 'APPROVED' || status === 'PUBLISHED') return colors.green;
  if (status === 'SUSPENDED' || status === 'REJECTED' || status === 'INACTIVE') return colors.red;
  if (status === 'IN_REVIEW' || status === 'SUBMITTED' || status === 'DRAFT') return colors.goldDeep;
  return colors.muted;
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function RoleSelector({
  value,
  onChange,
}: {
  value: MembershipRole;
  onChange: (role: MembershipRole) => void;
}) {
  return (
    <View style={styles.selectorRow}>
      {MEMBERSHIP_ROLES.map((role) => (
        <Pressable
          key={role}
          accessibilityRole="button"
          accessibilityState={{ selected: value === role }}
          onPress={() => onChange(role)}
          style={({ pressed }) => [
            styles.selectorChip,
            value === role && styles.selectorChipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.selectorText, value === role && styles.selectorTextActive]}>
            {roleLabel(role)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function VerificationSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (status: string) => void;
}) {
  return (
    <View style={styles.selectorRow}>
      {VERIFICATION_STATUSES.map((status) => (
        <Pressable
          key={status}
          accessibilityRole="button"
          accessibilityState={{ selected: value === status }}
          onPress={() => onChange(status)}
          style={({ pressed }) => [
            styles.selectorChip,
            value === status && styles.selectorChipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.selectorText, value === status && styles.selectorTextActive]}>
            {statusText(status)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const { account, refresh } = useAuth();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [organizationForm, setOrganizationForm] = useState(EMPTY_ORGANIZATION_FORM);
  const [industryForm, setIndustryForm] = useState(EMPTY_INDUSTRY_FORM);
  const [schemaForm, setSchemaForm] = useState({ version: '1', publish: true, schemaJson: DEFAULT_SCHEMA });

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MembershipRole>('MEMBER');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [expandedIndustryId, setExpandedIndustryId] = useState('');

  const [accountSearch, setAccountSearch] = useState('');
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [organizationType, setOrganizationType] = useState<'ALL' | 'BUYER' | 'SUPPLIER'>('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditResource, setAuditResource] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<'ALL' | 'true' | 'false'>('ALL');

  const overviewQuery = useApiQuery<{ overview: AdminOverview }>('/api/admin/overview');
  const accountsQuery = useApiQuery<{ accounts: AdminAccount[] }>('/api/admin/accounts?pageSize=100');
  const organizationsQuery = useApiQuery<{ organizations: AdminOrganization[] }>(
    '/api/admin/organizations?pageSize=100',
  );
  const industriesQuery = useApiQuery<{ industries: AdminIndustry[] }>('/api/admin/industries?pageSize=100');
  const auditQuery = useApiQuery<{ events: AuditEvent[] }>(
    `/api/admin/audit?pageSize=100&action=${encodeURIComponent(auditSearch)}&resourceType=${encodeURIComponent(auditResource)}`,
  );
  const outboxQuery = useApiQuery<{ events: OutboxEvent[] }>(
    `/api/admin/outbox?pageSize=100&published=${eventFilter}&eventType=${encodeURIComponent(eventSearch)}`,
  );
  const permissionsQuery = useApiQuery<PermissionsPayload>('/api/permissions');

  const overview = overviewQuery.data?.overview ?? null;
  const accounts = accountsQuery.data?.accounts ?? [];
  const organizations = organizationsQuery.data?.organizations ?? [];
  const industries = industriesQuery.data?.industries ?? [];
  const auditEvents = auditQuery.data?.events ?? [];
  const outboxEvents = outboxQuery.data?.events ?? [];
  const roles = permissionsQuery.data?.roles ?? Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

  const activeOrganizationId = selectedOrganizationId || organizations[0]?.id || '';
  const membersQuery = useApiQuery<{ members: AdminMember[] }>(
    activeOrganizationId ? `/api/admin/organizations/${activeOrganizationId}/members` : null,
  );
  const members = membersQuery.data?.members ?? [];

  const schemaQuery = useApiQuery<{ versions: ApiSchemaVersion[] }>(
    expandedIndustryId ? `/api/industries/${expandedIndustryId}/schemas` : null,
  );
  const schemaVersions = schemaQuery.data?.versions ?? [];

  const mutation = useApiMutation<unknown>();

  const filteredAccounts = accounts.filter((item) => {
    const query = accountSearch.trim().toLowerCase();
    if (!query) return true;
    return `${item.fullName} ${item.email} ${item.companyName}`.toLowerCase().includes(query);
  });
  const filteredOrganizations = organizations.filter((item) => {
    const query = organizationSearch.trim().toLowerCase();
    if (organizationType !== 'ALL' && item.type !== organizationType) return false;
    if (!query) return true;
    return `${item.displayName} ${item.legalName}`.toLowerCase().includes(query);
  });
  const pendingOrganizations = organizations.filter((item) =>
    ['SUBMITTED', 'IN_REVIEW'].includes(item.supplierProfile?.verificationStatus ?? ''),
  );
  const selectedOrganization = organizations.find((item) => item.id === activeOrganizationId);

  const loading =
    (overviewQuery.isLoading && !overview) ||
    (accountsQuery.isLoading && accounts.length === 0) ||
    (organizationsQuery.isLoading && organizations.length === 0) ||
    (industriesQuery.isLoading && industries.length === 0);

  const loadError =
    overviewQuery.error ??
    accountsQuery.error ??
    organizationsQuery.error ??
    industriesQuery.error ??
    auditQuery.error ??
    outboxQuery.error ??
    permissionsQuery.error ??
    membersQuery.error ??
    schemaQuery.error;

  async function runAction(request: MutationRequest, successText: string) {
    setFeedback(null);
    try {
      await mutation.mutateAsync(request);
      setFeedback({ tone: 'success', text: successText });
      return true;
    } catch (actionError) {
      setFeedback({ tone: 'error', text: errorMessage(actionError) });
      return false;
    }
  }

  function reload() {
    void Promise.all([
      overviewQuery.refetch(),
      accountsQuery.refetch(),
      organizationsQuery.refetch(),
      industriesQuery.refetch(),
      auditQuery.refetch(),
      outboxQuery.refetch(),
      permissionsQuery.refetch(),
      membersQuery.refetch(),
      schemaQuery.refetch(),
    ]);
  }

  async function createAccount() {
    if (!accountForm.fullName.trim() || !accountForm.companyName.trim() || !accountForm.email.trim() || !accountForm.password) {
      setFeedback({ tone: 'error', text: 'أكمل الاسم والشركة والبريد وكلمة المرور أولًا.' });
      return;
    }
    const ok = await runAction(
      {
        path: '/api/admin/accounts',
        method: 'POST',
        body: {
          fullName: accountForm.fullName.trim(),
          companyName: accountForm.companyName.trim(),
          email: accountForm.email.trim(),
          password: accountForm.password,
          accountType: accountForm.accountType,
          isPlatformAdmin: accountForm.isPlatformAdmin,
        },
      },
      'تم إنشاء الحساب ومؤسسته المالكة.',
    );
    if (ok) setAccountForm({ ...EMPTY_ACCOUNT_FORM, accountType: accountForm.accountType });
  }

  async function toggleAdmin(target: AdminAccount) {
    const ok = await runAction(
      {
        path: `/api/admin/accounts/${target.id}/admin`,
        method: 'PATCH',
        body: { isPlatformAdmin: !target.isPlatformAdmin },
      },
      target.isPlatformAdmin ? 'تم إلغاء صلاحية مدير المنصة.' : 'تم تعيين مدير منصة جديد.',
    );
    if (ok && target.id === account?.id) void refresh();
  }

  async function createOrganization() {
    if (!organizationForm.legalName.trim() || !organizationForm.countryCode.trim()) {
      setFeedback({ tone: 'error', text: 'الاسم القانوني ورمز الدولة مطلوبان.' });
      return;
    }
    const ok = await runAction(
      {
        path: '/api/admin/organizations',
        method: 'POST',
        body: {
          type: organizationForm.type,
          legalName: organizationForm.legalName.trim(),
          displayName: organizationForm.displayName.trim() || organizationForm.legalName.trim(),
          countryCode: organizationForm.countryCode.trim().toUpperCase(),
        },
      },
      'تم إنشاء المؤسسة.',
    );
    if (ok) setOrganizationForm({ ...EMPTY_ORGANIZATION_FORM, type: organizationForm.type });
  }

  async function setOrganizationStatus(target: AdminOrganization) {
    const status = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await runAction(
      {
        path: `/api/admin/organizations/${target.id}/status`,
        method: 'PATCH',
        body: { status },
      },
      status === 'ACTIVE' ? 'تم تفعيل المؤسسة.' : 'تم تعليق المؤسسة.',
    );
  }

  async function setVerification(target: AdminOrganization, status: string) {
    await runAction(
      {
        path: `/api/admin/organizations/${target.id}/verification`,
        method: 'PATCH',
        body: { status },
      },
      `تم تحديث اعتماد ${target.displayName} إلى ${statusText(status)}.`,
    );
  }

  async function addMember() {
    if (!activeOrganizationId || !newMemberEmail.trim()) {
      setFeedback({ tone: 'error', text: 'اختر مؤسسة وأدخل بريد الحساب.' });
      return;
    }
    const ok = await runAction(
      {
        path: `/api/admin/organizations/${activeOrganizationId}/members`,
        method: 'POST',
        body: { email: newMemberEmail.trim(), role: newMemberRole },
      },
      'تمت إضافة العضو إلى المؤسسة.',
    );
    if (ok) setNewMemberEmail('');
  }

  async function changeMemberRole(target: AdminMember, role: MembershipRole) {
    await runAction(
      {
        path: `/api/admin/memberships/${target.id}/role`,
        method: 'PATCH',
        body: { role },
      },
      'تم تحديث دور العضو.',
    );
  }

  async function toggleMemberStatus(target: AdminMember) {
    const status = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await runAction(
      {
        path: `/api/admin/memberships/${target.id}/status`,
        method: 'PATCH',
        body: { status },
      },
      status === 'ACTIVE' ? 'تم تفعيل العضوية.' : 'تم تعطيل العضوية.',
    );
  }

  async function removeMember(target: AdminMember) {
    await runAction(
      { path: `/api/admin/memberships/${target.id}`, method: 'DELETE' },
      'تمت إزالة العضو من المؤسسة.',
    );
  }

  async function createIndustry() {
    if (!industryForm.code.trim() || !industryForm.nameAr.trim()) {
      setFeedback({ tone: 'error', text: 'رمز القطاع واسمه مطلوبان.' });
      return;
    }
    const ok = await runAction(
      {
        path: '/api/industries',
        method: 'POST',
        body: { code: industryForm.code.trim(), nameAr: industryForm.nameAr.trim(), active: true },
      },
      'تم إنشاء القطاع.',
    );
    if (ok) setIndustryForm(EMPTY_INDUSTRY_FORM);
  }

  async function createSchemaVersion() {
    if (!expandedIndustryId) {
      setFeedback({ tone: 'error', text: 'افتح قطاعًا أولًا لإضافة مخطط له.' });
      return;
    }
    let schemaJson: unknown;
    try {
      schemaJson = JSON.parse(schemaForm.schemaJson);
    } catch {
      setFeedback({ tone: 'error', text: 'صيغة JSON غير صالحة.' });
      return;
    }
    const version = Number(schemaForm.version);
    if (!Number.isInteger(version) || version <= 0) {
      setFeedback({ tone: 'error', text: 'رقم الإصدار يجب أن يكون عددًا صحيحًا موجبًا.' });
      return;
    }
    const ok = await runAction(
      {
        path: `/api/industries/${expandedIndustryId}/schemas`,
        method: 'POST',
        body: { version, schemaJson, publish: schemaForm.publish },
      },
      schemaForm.publish ? 'تم إنشاء المخطط ونشره.' : 'تم إنشاء المخطط كمسودة.',
    );
    if (ok) setSchemaForm((current) => ({ ...current, version: String(version + 1) }));
  }

  async function publishSchemaVersion(versionId: string) {
    await runAction(
      { path: `/api/schema-versions/${versionId}/publish`, method: 'POST' },
      'تم نشر إصدار المخطط.',
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="admin" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>إدارة المنصة</Text>
              <Text style={styles.pageTitle}>لوحة التحكم الإدارية</Text>
              <Text style={styles.pageDescription}>
                مركز تحكم واحد للحسابات والمؤسسات والعضويات والاعتمادات والقطاعات وسجل التدقيق.
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                onPress={reload}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>تحديث البيانات</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate('/dashboard' as any)}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              >
                <Text style={styles.backButtonText}>العودة إلى لوحتي</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.tabs}>
            {TABS.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === item.key }}
                onPress={() => setTab(item.key)}
                style={({ pressed }) => [
                  styles.tab,
                  tab === item.key && styles.tabActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {loading ? <Text style={styles.loadingText}>جارٍ تحميل بيانات المنصة…</Text> : null}
          {loadError ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage(loadError)}</Text> : null}
          {feedback ? (
            <Text
              accessibilityRole={feedback.tone === 'error' ? 'alert' : undefined}
              style={feedback.tone === 'error' ? styles.errorText : styles.noticeText}
            >
              {feedback.text}
            </Text>
          ) : null}

          {tab === 'overview' ? (
            <View>
              <View style={styles.metricGrid}>
                {(overview
                  ? [
                      { label: 'الحسابات', value: overview.accounts, detail: 'حسابات مسجلة' },
                      { label: 'المؤسسات', value: overview.organizations, detail: 'مشترون وموردون' },
                      { label: 'طلبات العرض', value: Object.values(overview.rfqsByStatus).reduce((sum, count) => sum + count, 0), detail: 'كل الحالات' },
                      { label: 'العروض', value: overview.quotes, detail: 'عروض مقدمة' },
                      { label: 'أوامر الشراء', value: overview.purchaseOrders, detail: 'أوامر صادرة' },
                      { label: 'اعتمادات معلقة', value: overview.pendingSupplierVerifications, detail: 'موردون بانتظار المراجعة' },
                      { label: 'أحداث غير منشورة', value: overview.pendingEvents, detail: 'قائمة انتظار الأحداث' },
                    ]
                  : []
                ).map((metric) => (
                  <View key={metric.label} style={styles.metricCard}>
                    <Text style={styles.metricValue}>{formatNumber(metric.value)}</Text>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                    <Text style={styles.metricDetail}>{metric.detail}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.overviewColumns}>
                <View style={styles.panel}>
                  <View style={styles.panelHeading}>
                    <Text style={styles.panelTitle}>حالة طلبات العرض</Text>
                    <Text style={styles.panelCount}>{Object.keys(overview?.rfqsByStatus ?? {}).length}</Text>
                  </View>
                  {overview && Object.keys(overview.rfqsByStatus).length ? (
                    <View style={styles.chipRow}>
                      {Object.entries(overview.rfqsByStatus).map(([status, count]) => (
                        <View key={status} style={styles.statusChip}>
                          <Text style={[styles.statusChipText, { color: statusTone(status) }]}>
                            {statusText(status)}: {count}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <EmptyState text="لا توجد طلبات عرض بعد." />
                  )}
                </View>

                <View style={styles.panel}>
                  <View style={styles.panelHeading}>
                    <Text style={styles.panelTitle}>اعتمادات تحتاج إجراء</Text>
                    <Text style={styles.panelCount}>{pendingOrganizations.length}</Text>
                  </View>
                  {pendingOrganizations.length ? (
                    pendingOrganizations.slice(0, 5).map((item) => (
                      <View key={item.id} style={styles.compactRow}>
                        <View style={styles.listCopy}>
                          <Text style={styles.itemTitle}>{item.displayName}</Text>
                          <Text style={[styles.itemMeta, { color: statusTone(item.supplierProfile?.verificationStatus) }]}>
                            {statusText(item.supplierProfile?.verificationStatus)}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setSelectedOrganizationId(item.id);
                            setTab('approvals');
                          }}
                          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.actionButtonText}>مراجعة</Text>
                        </Pressable>
                      </View>
                    ))
                  ) : (
                    <EmptyState text="لا توجد اعتمادات معلقة." />
                  )}
                </View>
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeading}>
                  <Text style={styles.panelTitle}>وصول سريع</Text>
                  <Text style={styles.panelCount}>{wide ? 'أدوات الإدارة' : ''}</Text>
                </View>
                <View style={styles.quickActions}>
                  {TABS.filter((item) => item.key !== 'overview').map((item) => (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      onPress={() => setTab(item.key)}
                      style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.quickButtonText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {tab === 'accounts' ? (
            <View>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>إنشاء حساب جديد</Text>
                <Text style={styles.panelSubtitle}>يُنشأ مع مؤسسة مالكة تلقائيًا ويمكن منحه صلاحية مدير المنصة.</Text>
                <View style={styles.formGrid}>
                  <TextInput
                    value={accountForm.fullName}
                    onChangeText={(text) => setAccountForm({ ...accountForm, fullName: text })}
                    placeholder="الاسم الكامل"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                  <TextInput
                    value={accountForm.companyName}
                    onChangeText={(text) => setAccountForm({ ...accountForm, companyName: text })}
                    placeholder="اسم الشركة"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                  <TextInput
                    value={accountForm.email}
                    onChangeText={(text) => setAccountForm({ ...accountForm, email: text })}
                    placeholder="البريد الإلكتروني"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                  />
                  <TextInput
                    value={accountForm.password}
                    onChangeText={(text) => setAccountForm({ ...accountForm, password: text })}
                    placeholder="كلمة المرور"
                    placeholderTextColor={colors.muted}
                    secureTextEntry
                    style={styles.input}
                  />
                  <View style={styles.selectorRow}>
                    {(['BUYER', 'SUPPLIER'] as const).map((type) => (
                      <Pressable
                        key={type}
                        accessibilityRole="button"
                        onPress={() => setAccountForm({ ...accountForm, accountType: type })}
                        style={[
                          styles.selectorChip,
                          accountForm.accountType === type && styles.selectorChipActive,
                        ]}
                      >
                        <Text style={[styles.selectorText, accountForm.accountType === type && styles.selectorTextActive]}>
                          {type === 'BUYER' ? 'مشتري' : 'مورد'}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ checked: accountForm.isPlatformAdmin }}
                      onPress={() => setAccountForm({ ...accountForm, isPlatformAdmin: !accountForm.isPlatformAdmin })}
                      style={[
                        styles.selectorChip,
                        accountForm.isPlatformAdmin && styles.selectorChipActive,
                      ]}
                    >
                      <Text style={[styles.selectorText, accountForm.isPlatformAdmin && styles.selectorTextActive]}>
                        {accountForm.isPlatformAdmin ? '✓ مدير منصة' : 'مدير منصة؟'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={mutation.isPending}
                  onPress={() => void createAccount()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryButtonText}>إنشاء الحساب</Text>
                </Pressable>
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeading}>
                  <Text style={styles.panelTitle}>الحسابات المسجلة</Text>
                  <Text style={styles.panelCount}>{filteredAccounts.length}</Text>
                </View>
                <TextInput
                  value={accountSearch}
                  onChangeText={setAccountSearch}
                  placeholder="بحث بالاسم أو البريد أو الشركة"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                {filteredAccounts.length ? (
                  filteredAccounts.map((item) => (
                    <View key={item.id} style={styles.listItem}>
                      <View style={styles.listCopy}>
                        <Text style={styles.itemTitle}>{item.fullName}</Text>
                        <Text style={styles.itemMeta}>{item.email} · {item.companyName}</Text>
                        <Text style={styles.itemMeta}>
                          {item.roleLabel ?? 'بدون دور'} · {item.permissions.length} صلاحية · {formatDate(item.createdAt)}
                        </Text>
                        <Text style={styles.itemMeta}>
                          {item.memberships.map((membership) =>
                            `${membership.organization.displayName} (${roleLabel(membership.role)})`,
                          ).join('، ') || 'لا توجد مؤسسات'}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void toggleAdmin(item)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          item.isPlatformAdmin && styles.actionButtonActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.actionButtonText, item.isPlatformAdmin && styles.actionButtonTextActive]}>
                          {item.isPlatformAdmin ? 'إلغاء Admin' : 'تعيين Admin'}
                        </Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <EmptyState text="لا توجد حسابات مطابقة." />
                )}
              </View>
            </View>
          ) : null}

          {tab === 'organizations' ? (
            <View>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>إنشاء مؤسسة</Text>
                <Text style={styles.panelSubtitle}>لإضافة أعضاء إلى المؤسسة استخدم تبويب الأعضاء بعد الإنشاء.</Text>
                <View style={styles.formGrid}>
                  <TextInput
                    value={organizationForm.legalName}
                    onChangeText={(text) => setOrganizationForm({ ...organizationForm, legalName: text })}
                    placeholder="الاسم القانوني"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                  <TextInput
                    value={organizationForm.displayName}
                    onChangeText={(text) => setOrganizationForm({ ...organizationForm, displayName: text })}
                    placeholder="الاسم المعروض"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                  <TextInput
                    value={organizationForm.countryCode}
                    onChangeText={(text) => setOrganizationForm({ ...organizationForm, countryCode: text })}
                    placeholder="رمز الدولة"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    maxLength={2}
                    style={styles.input}
                  />
                  <View style={styles.selectorRow}>
                    {(['BUYER', 'SUPPLIER'] as const).map((type) => (
                      <Pressable
                        key={type}
                        accessibilityRole="button"
                        onPress={() => setOrganizationForm({ ...organizationForm, type })}
                        style={[
                          styles.selectorChip,
                          organizationForm.type === type && styles.selectorChipActive,
                        ]}
                      >
                        <Text style={[styles.selectorText, organizationForm.type === type && styles.selectorTextActive]}>
                          {type === 'BUYER' ? 'مشتري' : 'مورد'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={mutation.isPending}
                  onPress={() => void createOrganization()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryButtonText}>إنشاء المؤسسة</Text>
                </Pressable>
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeading}>
                  <Text style={styles.panelTitle}>المؤسسات</Text>
                  <Text style={styles.panelCount}>{filteredOrganizations.length}</Text>
                </View>
                <View style={styles.filterRow}>
                  <TextInput
                    value={organizationSearch}
                    onChangeText={setOrganizationSearch}
                    placeholder="بحث باسم المؤسسة"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, styles.filterInput]}
                  />
                  {(['ALL', 'BUYER', 'SUPPLIER'] as const).map((type) => (
                    <Pressable
                      key={type}
                      accessibilityRole="button"
                      onPress={() => setOrganizationType(type)}
                      style={[
                        styles.selectorChip,
                        organizationType === type && styles.selectorChipActive,
                      ]}
                    >
                      <Text style={[styles.selectorText, organizationType === type && styles.selectorTextActive]}>
                        {type === 'ALL' ? 'الكل' : type === 'BUYER' ? 'مشترون' : 'موردون'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {filteredOrganizations.length ? (
                  filteredOrganizations.map((item) => (
                    <View key={item.id} style={styles.listItem}>
                      <View style={styles.listCopy}>
                        <Text style={styles.itemTitle}>{item.displayName}</Text>
                        <Text style={styles.itemMeta}>{item.legalName} · {statusText(item.type)} · {item.countryCode ?? '—'}</Text>
                        <Text style={styles.itemMeta}>
                          {item._count.memberships} أعضاء · {item._count.buyerRfqs} طلبات · {item._count.quotes} عروض
                        </Text>
                        <Text style={[styles.itemMeta, { color: statusTone(item.status) }]}>
                          الحالة: {statusText(item.status)}
                        </Text>
                        {item.type === 'SUPPLIER' ? (
                          <Text style={[styles.itemMeta, { color: statusTone(item.supplierProfile?.verificationStatus) }]}>
                            الاعتماد: {statusText(item.supplierProfile?.verificationStatus)}
                          </Text>
                        ) : null}
                        {item.type === 'SUPPLIER' ? (
                          <VerificationSelector
                            value={item.supplierProfile?.verificationStatus ?? 'DRAFT'}
                            onChange={(status) => void setVerification(item, status)}
                          />
                        ) : null}
                      </View>
                      <View style={styles.actionColumn}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void setOrganizationStatus(item)}
                          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.actionButtonText}>
                            {item.status === 'ACTIVE' ? 'تعليق' : 'تفعيل'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setSelectedOrganizationId(item.id);
                            setTab('members');
                          }}
                          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.actionButtonText}>الأعضاء</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                ) : (
                  <EmptyState text="لا توجد مؤسسات مطابقة." />
                )}
              </View>
            </View>
          ) : null}

          {tab === 'members' ? (
            <View style={styles.panel}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>أعضاء المؤسسة</Text>
                <Text style={styles.panelCount}>{members.length}</Text>
              </View>
              <Text style={styles.panelSubtitle}>
                {selectedOrganization?.displayName ?? 'اختر مؤسسة من تبويب المؤسسات'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orgPicker}>
                {organizations.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.id === activeOrganizationId }}
                    onPress={() => setSelectedOrganizationId(item.id)}
                    style={[
                      styles.selectorChip,
                      item.id === activeOrganizationId && styles.selectorChipActive,
                    ]}
                  >
                    <Text style={[styles.selectorText, item.id === activeOrganizationId && styles.selectorTextActive]}>
                      {item.displayName}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.addMemberRow}>
                <TextInput
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  placeholder="بريد الحساب المراد إضافته"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={mutation.isPending}
                  onPress={() => void addMember()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryButtonText}>إضافة عضو</Text>
                </Pressable>
              </View>
              <RoleSelector value={newMemberRole} onChange={setNewMemberRole} />
              {membersQuery.isLoading ? <Text style={styles.loadingText}>جارٍ تحميل الأعضاء…</Text> : null}
              {members.length ? (
                members.map((member) => (
                  <View key={member.id} style={styles.listItem}>
                    <View style={styles.listCopy}>
                      <Text style={styles.itemTitle}>{member.account.fullName}</Text>
                      <Text style={styles.itemMeta}>{member.account.email} · {statusText(member.account.accountType)}</Text>
                      <Text style={[styles.itemMeta, { color: statusTone(member.status) }]}>
                        {roleLabel(member.role)} · {statusText(member.status)} · {formatDate(member.createdAt)}
                      </Text>
                      <RoleSelector
                        value={member.role}
                        onChange={(role) => void changeMemberRole(member, role)}
                      />
                    </View>
                    <View style={styles.actionColumn}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void toggleMemberStatus(member)}
                        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.actionButtonText}>
                          {member.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void removeMember(member)}
                        style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.dangerButtonText}>إزالة</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState text={activeOrganizationId ? 'لا يوجد أعضاء في هذه المؤسسة.' : 'اختر مؤسسة لعرض أعضائها.'} />
              )}
            </View>
          ) : null}

          {tab === 'approvals' ? (
            <View style={styles.panel}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>اعتماد الموردين</Text>
                <Text style={styles.panelCount}>{pendingOrganizations.length}</Text>
              </View>
              {pendingOrganizations.length ? (
                pendingOrganizations.map((item) => (
                  <View key={item.id} style={styles.listItem}>
                    <View style={styles.listCopy}>
                      <Text style={styles.itemTitle}>{item.displayName}</Text>
                      <Text style={styles.itemMeta}>{item.legalName} · {item.countryCode ?? '—'}</Text>
                      <Text style={[styles.itemMeta, { color: statusTone(item.supplierProfile?.verificationStatus) }]}>
                        {statusText(item.supplierProfile?.verificationStatus)} · {formatDate(item.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.actionColumn}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void setVerification(item, 'APPROVED')}
                        style={({ pressed }) => [styles.approveButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.approveButtonText}>اعتماد</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void setVerification(item, 'REJECTED')}
                        style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.dangerButtonText}>رفض</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState text="لا توجد طلبات اعتماد معلقة." />
              )}
            </View>
          ) : null}

          {tab === 'industries' ? (
            <View>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>إضافة قطاع</Text>
                <Text style={styles.panelSubtitle}>الرمز يجب أن يكون لاتينيًا صغيرًا مثل industrial-supplies.</Text>
                <View style={styles.formGrid}>
                  <TextInput
                    value={industryForm.code}
                    onChangeText={(text) => setIndustryForm({ ...industryForm, code: text })}
                    placeholder="رمز القطاع"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <TextInput
                    value={industryForm.nameAr}
                    onChangeText={(text) => setIndustryForm({ ...industryForm, nameAr: text })}
                    placeholder="اسم القطاع"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={mutation.isPending}
                  onPress={() => void createIndustry()}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryButtonText}>إنشاء القطاع</Text>
                </Pressable>
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeading}>
                  <Text style={styles.panelTitle}>القطاعات ومخططاتها</Text>
                  <Text style={styles.panelCount}>{industries.length}</Text>
                </View>
                {industries.length ? (
                  industries.map((industry) => (
                    <View key={industry.id} style={styles.listItem}>
                      <View style={styles.listCopy}>
                        <Text style={styles.itemTitle}>{industry.nameAr}</Text>
                        <Text style={styles.itemMeta}>{industry.code ?? ''} · {statusText(industry.active ? 'ACTIVE' : 'SUSPENDED')}</Text>
                        <Text style={styles.itemMeta}>
                          {industry._count.schemaVersions} مخططات · {industry._count.rfqs} طلبات عرض
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setExpandedIndustryId(expandedIndustryId === industry.id ? '' : industry.id)}
                          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.actionButtonText}>
                            {expandedIndustryId === industry.id ? 'إخفاء المخططات' : 'إدارة المخططات'}
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.versionBox}>
                        <Text style={styles.versionTitle}>الإصدار المنشور</Text>
                        <Text style={styles.versionValue}>
                          {industry.schemaVersions[0] ? `v${industry.schemaVersions[0].version}` : '—'}
                        </Text>
                        <Text style={styles.itemMeta}>{formatDate(industry.schemaVersions[0]?.publishedAt)}</Text>
                      </View>
                      {expandedIndustryId === industry.id ? (
                        <View style={styles.schemaPanel}>
                          <Text style={styles.versionTitle}>إصدارات المخطط</Text>
                          {schemaQuery.isLoading ? <Text style={styles.loadingText}>جارٍ تحميل المخططات…</Text> : null}
                          {schemaVersions.length ? (
                            schemaVersions.map((version) => (
                              <View key={version.id} style={styles.compactRow}>
                                <View style={styles.listCopy}>
                                  <Text style={styles.itemTitle}>v{version.version} · {statusText(version.status)}</Text>
                                  <Text style={styles.itemMeta}>{formatDate(version.publishedAt)}</Text>
                                </View>
                                {version.status !== 'PUBLISHED' ? (
                                  <Pressable
                                    accessibilityRole="button"
                                    onPress={() => void publishSchemaVersion(version.id)}
                                    style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                                  >
                                    <Text style={styles.actionButtonText}>نشر</Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            ))
                          ) : (
                            <EmptyState text="لا توجد إصدارات لهذا القطاع." />
                          )}
                          <View style={styles.schemaForm}>
                            <TextInput
                              value={schemaForm.version}
                              onChangeText={(text) => setSchemaForm({ ...schemaForm, version: text })}
                              placeholder="رقم الإصدار"
                              placeholderTextColor={colors.muted}
                              keyboardType="number-pad"
                              style={styles.input}
                            />
                            <TextInput
                              value={schemaForm.schemaJson}
                              onChangeText={(text) => setSchemaForm({ ...schemaForm, schemaJson: text })}
                              placeholder="مخطط JSON"
                              placeholderTextColor={colors.muted}
                              multiline
                              numberOfLines={7}
                              style={styles.textArea}
                            />
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => setSchemaForm({ ...schemaForm, publish: !schemaForm.publish })}
                              style={({ pressed }) => [styles.selectorChip, pressed && styles.pressed]}
                            >
                              <Text style={styles.selectorText}>
                                {schemaForm.publish ? '✓ نشر فوري' : 'حفظ كمسودة'}
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              disabled={mutation.isPending}
                              onPress={() => void createSchemaVersion()}
                              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                            >
                              <Text style={styles.primaryButtonText}>إضافة إصدار المخطط</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <EmptyState text="لا توجد قطاعات بعد." />
                )}
              </View>
            </View>
          ) : null}

          {tab === 'audit' ? (
            <View style={styles.panel}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>سجل التدقيق</Text>
                <Text style={styles.panelCount}>{auditEvents.length}</Text>
              </View>
              <View style={styles.filterRow}>
                <TextInput
                  value={auditSearch}
                  onChangeText={setAuditSearch}
                  placeholder="بحث بالإجراء"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.filterInput]}
                />
                <TextInput
                  value={auditResource}
                  onChangeText={setAuditResource}
                  placeholder="بحث بال مورد"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.filterInput]}
                />
              </View>
              {auditQuery.isFetching ? <Text style={styles.loadingText}>جارٍ تحديث السجل…</Text> : null}
              {auditEvents.length ? (
                auditEvents.map((event) => (
                  <View key={event.id} style={styles.listItem}>
                    <View style={styles.listCopy}>
                      <Text style={styles.itemTitle}>{event.action}</Text>
                      <Text style={styles.itemMeta}>
                        {event.resourceType} · {event.resourceId ?? '—'} · {formatDate(event.createdAt)}
                      </Text>
                      <Text style={styles.itemMeta}>{event.actor?.fullName ?? 'النظام'} · {event.actor?.email ?? '—'}</Text>
                      {event.metadata ? <Text style={styles.jsonText}>{JSON.stringify(event.metadata)}</Text> : null}
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState text="لا توجد أحداث مطابقة." />
              )}
            </View>
          ) : null}

          {tab === 'events' ? (
            <View style={styles.panel}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>أحداث المنصة</Text>
                <Text style={styles.panelCount}>{outboxEvents.length}</Text>
              </View>
              <View style={styles.filterRow}>
                <TextInput
                  value={eventSearch}
                  onChangeText={setEventSearch}
                  placeholder="بحث بنوع الحدث"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.filterInput]}
                />
                {(['ALL', 'false', 'true'] as const).map((filter) => (
                  <Pressable
                    key={filter}
                    accessibilityRole="button"
                    onPress={() => setEventFilter(filter)}
                    style={[styles.selectorChip, eventFilter === filter && styles.selectorChipActive]}
                  >
                    <Text style={[styles.selectorText, eventFilter === filter && styles.selectorTextActive]}>
                      {filter === 'ALL' ? 'الكل' : filter === 'false' ? 'غير منشورة' : 'منشورة'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {outboxEvents.length ? (
                outboxEvents.map((event) => (
                  <View key={event.id} style={styles.listItem}>
                    <View style={styles.listCopy}>
                      <Text style={styles.itemTitle}>{event.eventType}</Text>
                      <Text style={styles.itemMeta}>
                        {event.aggregateType} · {event.aggregateId} · {formatDate(event.createdAt)}
                      </Text>
                      <Text style={[styles.itemMeta, { color: statusTone(event.publishedAt ? 'PUBLISHED' : 'DRAFT') }]}>
                        {event.publishedAt ? `منشور · ${formatDate(event.publishedAt)}` : 'بانتظار النشر'} · {event.attempts} محاولات
                      </Text>
                      <Text style={styles.jsonText}>{JSON.stringify(event.payload)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState text="لا توجد أحداث مطابقة." />
              )}
            </View>
          ) : null}

          {tab === 'permissions' ? (
            <View>
              <View style={styles.panel}>
                <View style={styles.panelHeading}>
                  <Text style={styles.panelTitle}>الأدوار والصلاحيات</Text>
                  <Text style={styles.panelCount}>{roles.length} أدوار</Text>
                </View>
                <View style={styles.chipRow}>
                  {roles.map((role) => (
                    <View key={role.value} style={styles.statusChip}>
                      <Text style={styles.statusChipText}>{role.label} · {role.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>مصفوفة الصلاحيات</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.table}>
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.tableHead]}>الصلاحية</Text>
                      {roles.map((role) => (
                        <Text key={role.value} style={[styles.tableCell, styles.tableHead]}>{role.label}</Text>
                      ))}
                    </View>
                    {PERMISSION_KEYS.map((key) => (
                      <View key={key} style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.tableLabel]}>{permissionLabel(key)}</Text>
                        {roles.map((role) => (
                          <Text
                            key={role.value}
                            style={[
                              styles.tableCell,
                              ROLE_PERMISSION_KEYS[role.value as AppRole]?.includes(key)
                                ? styles.tableAllowed
                                : styles.tableDenied,
                            ]}
                          >
                            {ROLE_PERMISSION_KEYS[role.value as AppRole]?.includes(key) ? '✓' : '—'}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          ) : null}

          <Text style={styles.footer}>سوقي · لوحة الإدارة · جميع التغييرات موثقة في سجل التدقيق</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 34, paddingHorizontal: 20 },
  content: { maxWidth: 1180, width: '100%', alignSelf: 'center', paddingTop: 28 },
  headingRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  headingCopy: { flex: 1, alignItems: 'flex-end' },
  kicker: { color: colors.goldDeep, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  pageTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 26, fontWeight: '900', marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  pageDescription: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 7, textAlign: 'right', writingDirection: 'rtl' },
  headerActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  backButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.paper, justifyContent: 'center' },
  secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.stone, justifyContent: 'center' },
  secondaryButtonText: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, writingDirection: 'rtl' },
  backButtonText: { color: colors.goldDeep, fontFamily: fonts.semiBold, fontSize: 11, writingDirection: 'rtl' },
  tabs: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginTop: 22 },
  tab: { minHeight: 40, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, justifyContent: 'center' },
  tabActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  pressed: { opacity: 0.78 },
  tabText: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 11, writingDirection: 'rtl' },
  tabTextActive: { color: colors.goldLight, fontFamily: fonts.semiBold },
  loadingText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 16, textAlign: 'right', writingDirection: 'rtl' },
  errorText: { color: colors.red, backgroundColor: colors.redLight, borderRadius: 8, padding: 11, fontFamily: fonts.medium, fontSize: 11, marginTop: 16, textAlign: 'right', writingDirection: 'rtl' },
  noticeText: { color: colors.green, backgroundColor: colors.greenLight, borderRadius: 8, padding: 11, fontFamily: fonts.medium, fontSize: 11, marginTop: 16, textAlign: 'right', writingDirection: 'rtl' },
  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 11, marginTop: 20 },
  metricCard: { flexGrow: 1, flexBasis: 150, minHeight: 118, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 15, alignItems: 'flex-end' },
  metricValue: { color: colors.greenDark, fontFamily: fonts.bold, fontSize: 28, fontWeight: '900' },
  metricLabel: { color: colors.ink, fontFamily: fonts.semiBold, fontSize: 11, marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  metricDetail: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  overviewColumns: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 14 },
  quickActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quickButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 8, backgroundColor: colors.greenLight, justifyContent: 'center' },
  quickButtonText: { color: colors.green, fontFamily: fonts.semiBold, fontSize: 10, writingDirection: 'rtl' },
  panel: { marginTop: 20, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 15, flexGrow: 1, flexBasis: 340 },
  panelHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  panelTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  panelSubtitle: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10, lineHeight: 17, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  panelCount: { color: colors.goldDeep, fontFamily: fonts.semiBold, fontSize: 11 },
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  statusChip: { backgroundColor: colors.stone, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7 },
  statusChipText: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 9, writingDirection: 'rtl' },
  emptyText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10, marginTop: 14, textAlign: 'right', writingDirection: 'rtl' },
  listItem: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#EEE8DD', paddingVertical: 13 },
  compactRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: '#EEE8DD', paddingTop: 10, marginTop: 8 },
  listCopy: { flex: 1, alignItems: 'flex-end' },
  itemTitle: { color: colors.ink, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  itemMeta: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9, lineHeight: 15, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  jsonText: { alignSelf: 'stretch', color: colors.inkSoft, backgroundColor: colors.stone, borderRadius: 6, fontFamily: fonts.medium, fontSize: 8, lineHeight: 13, marginTop: 6, padding: 8, textAlign: 'right', writingDirection: 'rtl' },
  actionColumn: { gap: 6 },
  actionButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.paper, justifyContent: 'center' },
  actionButtonActive: { backgroundColor: colors.goldLight },
  actionButtonText: { color: colors.goldDeep, fontFamily: fonts.semiBold, fontSize: 9, writingDirection: 'rtl' },
  actionButtonTextActive: { color: colors.ink },
  primaryButton: { minHeight: 42, alignSelf: 'flex-start', paddingHorizontal: 18, borderRadius: 8, backgroundColor: colors.greenDark, justifyContent: 'center', marginTop: 12 },
  primaryButtonText: { color: colors.goldLight, fontFamily: fonts.semiBold, fontSize: 11, writingDirection: 'rtl' },
  secondaryText: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 9 },
  approveButton: { minHeight: 34, paddingHorizontal: 13, borderRadius: 7, backgroundColor: colors.green, justifyContent: 'center' },
  approveButtonText: { color: colors.paper, fontFamily: fonts.semiBold, fontSize: 9, writingDirection: 'rtl' },
  dangerButton: { minHeight: 34, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.red, backgroundColor: colors.redLight, justifyContent: 'center' },
  dangerButtonText: { color: colors.red, fontFamily: fonts.semiBold, fontSize: 9, writingDirection: 'rtl' },
  input: { minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.cream, paddingHorizontal: 12, color: colors.ink, fontFamily: fonts.medium, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  textArea: { minHeight: 130, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.cream, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontFamily: fonts.medium, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  formGrid: { gap: 9, marginTop: 12 },
  filterRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterInput: { flexGrow: 1, flexBasis: 220 },
  selectorRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  selectorChip: { minHeight: 34, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.stone, justifyContent: 'center' },
  selectorChipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  selectorText: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 9, writingDirection: 'rtl' },
  selectorTextActive: { color: colors.goldLight, fontFamily: fonts.semiBold },
  addMemberRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  orgPicker: { flexDirection: 'row-reverse', gap: 7, paddingVertical: 8 },
  versionBox: { minWidth: 105, alignItems: 'flex-end', backgroundColor: colors.greenLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  versionTitle: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8, writingDirection: 'rtl' },
  versionValue: { color: colors.green, fontFamily: fonts.bold, fontSize: 16, marginTop: 3 },
  schemaPanel: { width: '100%', marginTop: 14, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12 },
  schemaForm: { gap: 9, marginTop: 12 },
  table: { minWidth: 720, marginTop: 8 },
  tableRow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: colors.line, minHeight: 36, alignItems: 'center' },
  tableCell: { flex: 1, paddingHorizontal: 8, fontFamily: fonts.medium, fontSize: 9, textAlign: 'center', writingDirection: 'rtl' },
  tableHead: { color: colors.goldDeep, fontFamily: fonts.semiBold },
  tableLabel: { color: colors.inkSoft, textAlign: 'right' },
  tableAllowed: { color: colors.green, fontFamily: fonts.bold, fontSize: 13 },
  tableDenied: { color: colors.muted },
  footer: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9, marginTop: 24, textAlign: 'center', writingDirection: 'rtl' },
});
