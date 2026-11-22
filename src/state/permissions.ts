export const PERMISSION_KEYS = [
  'dashboard.view',
  'organization.view',
  'organization.manage',
  'membership.manage',
  'organization.audit',
  'supplierProfile.manage',
  'supplier.verification.review',
  'industry.manage',
  'industry.schema.manage',
  'rfq.view',
  'rfq.create',
  'rfq.manage',
  'rfq.publish',
  'rfq.invite',
  'rfq.award',
  'quote.view',
  'quote.create',
  'quote.manage',
  'purchaseOrder.view',
  'purchaseOrder.manage',
  'sample.manage',
  'milestone.manage',
  'evidence.upload',
  'platform.admin',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type AppRole = 'PLATFORM_ADMIN' | 'OWNER' | 'ADMIN' | 'MEMBER' | 'QUALITY';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard.view': 'عرض لوحة التحكم',
  'organization.view': 'عرض المؤسسة',
  'organization.manage': 'إدارة بيانات المؤسسة',
  'membership.manage': 'إدارة الأعضاء والأدوار',
  'organization.audit': 'عرض سجل التدقيق',
  'supplierProfile.manage': 'إدارة ملف المورد',
  'supplier.verification.review': 'اعتماد الموردين',
  'industry.manage': 'إدارة القطاعات',
  'industry.schema.manage': 'إدارة مخططات القطاعات',
  'rfq.view': 'عرض طلبات العرض',
  'rfq.create': 'إنشاء طلب عرض',
  'rfq.manage': 'تعديل طلب العرض',
  'rfq.publish': 'نشر أو إغلاق طلب العرض',
  'rfq.invite': 'دعوة الموردين',
  'rfq.award': 'ترسية العرض',
  'quote.view': 'عرض العروض',
  'quote.create': 'تقديم عرض',
  'quote.manage': 'إدارة العرض',
  'purchaseOrder.view': 'عرض أوامر الشراء',
  'purchaseOrder.manage': 'إدارة أمر الشراء',
  'sample.manage': 'إدارة العينات',
  'milestone.manage': 'إدارة مراحل الإنتاج',
  'evidence.upload': 'رفع الأدلة',
  'platform.admin': 'إدارة المنصة',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  PLATFORM_ADMIN: 'مدير المنصة',
  OWNER: 'المالك',
  ADMIN: 'مدير المؤسسة',
  MEMBER: 'عضو',
  QUALITY: 'مسؤول الجودة',
};

const ORGANIZATION_OWNER_PERMISSIONS: PermissionKey[] = [
  'dashboard.view',
  'organization.view',
  'organization.manage',
  'membership.manage',
  'organization.audit',
  'supplierProfile.manage',
  'rfq.view',
  'rfq.create',
  'rfq.manage',
  'rfq.publish',
  'rfq.invite',
  'rfq.award',
  'quote.view',
  'quote.create',
  'quote.manage',
  'purchaseOrder.view',
  'purchaseOrder.manage',
  'sample.manage',
  'milestone.manage',
  'evidence.upload',
];

export const ROLE_PERMISSION_KEYS: Record<AppRole, PermissionKey[]> = {
  PLATFORM_ADMIN: [...PERMISSION_KEYS],
  OWNER: ORGANIZATION_OWNER_PERMISSIONS,
  ADMIN: ORGANIZATION_OWNER_PERMISSIONS,
  MEMBER: [
    'dashboard.view',
    'organization.view',
    'rfq.view',
    'rfq.create',
    'rfq.manage',
    'rfq.invite',
    'quote.view',
    'quote.create',
    'quote.manage',
    'purchaseOrder.view',
    'purchaseOrder.manage',
    'sample.manage',
    'milestone.manage',
    'evidence.upload',
  ],
  QUALITY: [
    'dashboard.view',
    'organization.view',
    'supplierProfile.manage',
    'rfq.view',
    'quote.view',
    'purchaseOrder.view',
    'sample.manage',
    'milestone.manage',
    'evidence.upload',
  ],
};

const ROLE_RANK: Record<AppRole, number> = {
  QUALITY: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
  PLATFORM_ADMIN: 5,
};

export function highestRole(roles: readonly AppRole[]): AppRole | null {
  return roles.reduce<AppRole | null>((highest, role) => {
    if (!highest || ROLE_RANK[role] > ROLE_RANK[highest]) return role;
    return highest;
  }, null);
}

export function permissionLabel(permission: string) {
  return PERMISSION_LABELS[permission as PermissionKey] ?? permission;
}

export function roleLabel(role: string | null | undefined) {
  return role ? ROLE_LABELS[role as AppRole] ?? role : 'غير محدد';
}

export function dashboardCopy(role: AppRole | null, accountType: 'buyer' | 'supplier' | undefined) {
  if (role === 'PLATFORM_ADMIN') {
    return {
      kicker: 'لوحة مدير المنصة',
      title: 'نظرة شاملة على سوقي',
      description: 'تابع الحسابات والمؤسسات واعتماد الموردين ومؤشرات التشغيل من مكان واحد.',
    };
  }
  if (role === 'QUALITY') {
    return {
      kicker: 'لوحة الجودة',
      title: 'الجودة والامتثال تحت السيطرة',
      description: 'تابع العينات ومراحل الإنتاج وملفات الإثبات المرتبطة بأوامر الشراء.',
    };
  }
  if (accountType === 'supplier') {
    return {
      kicker: 'لوحة المورد',
      title: 'مساحة عمل المصنع',
      description: 'تابع الدعوات والعروض وأوامر الشراء ومراحل التنفيذ لعملائك.',
    };
  }
  return {
    kicker: 'لوحة المشتري',
    title: 'مساحة عمل فريق التوريد',
    description: 'تابع طلبات العرض والعروض الواردة ومراحل التصنيع لطلباتك.',
  };
}
