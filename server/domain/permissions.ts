import type { MembershipRole } from "@prisma/client";
import type { AccessContext } from "../auth";
import { ApiError } from "../http";

export const PERMISSION_KEYS = [
  "dashboard.view",
  "organization.view",
  "organization.manage",
  "membership.manage",
  "organization.audit",
  "supplierProfile.manage",
  "supplier.verification.review",
  "industry.manage",
  "industry.schema.manage",
  "rfq.view",
  "rfq.create",
  "rfq.manage",
  "rfq.publish",
  "rfq.invite",
  "rfq.award",
  "quote.view",
  "quote.create",
  "quote.manage",
  "purchaseOrder.view",
  "purchaseOrder.manage",
  "sample.manage",
  "milestone.manage",
  "evidence.upload",
  "product.view",
  "product.manage",
  "inspection.view",
  "inspection.manage",
  "inspection.review",
  "message.view",
  "message.send",
  "escrow.view",
  "escrow.manage",
  "escrow.release",
  "shipment.view",
  "shipment.manage",
  "notification.view",
  "platform.admin",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PlatformRole = MembershipRole | "PLATFORM_ADMIN";

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  group: string;
  description: string;
}

export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  { key: "dashboard.view", label: "عرض لوحة التحكم", group: "عام", description: "الوصول إلى مساحة العمل الخاصة بالدور" },
  { key: "organization.view", label: "عرض المؤسسة", group: "المؤسسة", description: "عرض بيانات المؤسسة والعضويات" },
  { key: "organization.manage", label: "إدارة بيانات المؤسسة", group: "المؤسسة", description: "تعديل بيانات المؤسسة" },
  { key: "membership.manage", label: "إدارة الأعضاء والأدوار", group: "المؤسسة", description: "إضافة عضو وتغيير دوره أو تعليقه" },
  { key: "organization.audit", label: "عرض سجل التدقيق", group: "المؤسسة", description: "مراجعة أحداث المؤسسة" },
  { key: "supplierProfile.manage", label: "إدارة ملف المورد", group: "الموردون", description: "تحديث القدرات وبيانات الاعتماد" },
  { key: "supplier.verification.review", label: "اعتماد الموردين", group: "الموردون", description: "مراجعة طلبات الاعتماد" },
  { key: "industry.manage", label: "إدارة القطاعات", group: "المنصة", description: "إنشاء القطاعات وتعديلها" },
  { key: "industry.schema.manage", label: "إدارة مخططات القطاعات", group: "المنصة", description: "إنشاء إصدارات المخططات ونشرها" },
  { key: "rfq.view", label: "عرض طلبات العرض", group: "طلبات العرض", description: "عرض الطلبات المرتبطة بالمؤسسة" },
  { key: "rfq.create", label: "إنشاء طلب عرض", group: "طلبات العرض", description: "إنشاء مسودة طلب عرض جديد" },
  { key: "rfq.manage", label: "تعديل طلب العرض", group: "طلبات العرض", description: "تعديل مسودة الطلب" },
  { key: "rfq.publish", label: "نشر أو إغلاق طلب العرض", group: "طلبات العرض", description: "تغيير حالة الطلب" },
  { key: "rfq.invite", label: "دعوة الموردين", group: "طلبات العرض", description: "دعوة الموردين المعتمدين" },
  { key: "rfq.award", label: "ترسية العرض", group: "طلبات العرض", description: "اختيار العرض وإنشاء أمر الشراء" },
  { key: "quote.view", label: "عرض العروض", group: "العروض", description: "عرض العروض المرتبطة" },
  { key: "quote.create", label: "تقديم عرض", group: "العروض", description: "إرسال عرض أو مراجعة جديدة" },
  { key: "quote.manage", label: "إدارة العرض", group: "العروض", description: "تعديل حالة العرض" },
  { key: "purchaseOrder.view", label: "عرض أوامر الشراء", group: "التنفيذ", description: "عرض أوامر الشراء المرتبطة" },
  { key: "purchaseOrder.manage", label: "إدارة أمر الشراء", group: "التنفيذ", description: "تغيير حالة أمر الشراء" },
  { key: "sample.manage", label: "إدارة العينات", group: "التنفيذ", description: "إنشاء العينات وتحديث حالتها" },
  { key: "milestone.manage", label: "إدارة مراحل الإنتاج", group: "التنفيذ", description: "إضافة المراحل وتحديث حالتها" },
  { key: "evidence.upload", label: "رفع الأدلة", group: "التنفيذ", description: "تسجيل ملفات الإثبات والجودة" },
  { key: "product.view", label: "عرض الكتالوج", group: "الكتالوج", description: "البحث في المنتجات والقدرات" },
  { key: "product.manage", label: "إدارة الكتالوج", group: "الكتالوج", description: "إضافة منتجات المصنع وتعديلها" },
  { key: "inspection.view", label: "عرض تقارير الفحص", group: "الجودة", description: "عرض تقارير التدقيق والفحص" },
  { key: "inspection.manage", label: "إدارة تقارير الفحص", group: "الجودة", description: "إضافة تقارير الفحص وتحديث حالتها" },
  { key: "inspection.review", label: "اعتماد تقارير الفحص", group: "الجودة", description: "مراجعة تقارير التدقيق من قبل المنصة" },
  { key: "message.view", label: "عرض المحادثات", group: "التفاوض", description: "عرض سلاسل المحادثة المرتبطة" },
  { key: "message.send", label: "إرسال الرسائل", group: "التفاوض", description: "إرسال الرسائل وعروض التفاوض" },
  { key: "escrow.view", label: "عرض الضمان", group: "الضمان", description: "عرض سجل الضمان التجريبي" },
  { key: "escrow.manage", label: "إدارة الضمان", group: "الضمان", description: "إنشاء الضمان وتسجيل الشروط" },
  { key: "escrow.release", label: "تحرير الضمان", group: "الضمان", description: "تحرير المبالغ بعد تحقق الشروط" },
  { key: "shipment.view", label: "عرض الشحن", group: "اللوجستيات", description: "عرض بيانات الشحن والتتبع" },
  { key: "shipment.manage", label: "إدارة الشحن", group: "اللوجستيات", description: "تسجيل الشحن وتحديث حالته" },
  { key: "notification.view", label: "عرض التنبيهات", group: "عام", description: "عرض تنبيهات الحساب" },
  { key: "platform.admin", label: "إدارة المنصة", group: "المنصة", description: "إدارة الحسابات والمؤسسات على مستوى المنصة" },
];

const ORGANIZATION_OWNER_PERMISSIONS: readonly PermissionKey[] = [
  "dashboard.view",
  "organization.view",
  "organization.manage",
  "membership.manage",
  "organization.audit",
  "supplierProfile.manage",
  "rfq.view",
  "rfq.create",
  "rfq.manage",
  "rfq.publish",
  "rfq.invite",
  "rfq.award",
  "quote.view",
  "quote.create",
  "quote.manage",
  "purchaseOrder.view",
  "purchaseOrder.manage",
  "sample.manage",
  "milestone.manage",
  "evidence.upload",
  "product.view",
  "product.manage",
  "inspection.view",
  "inspection.manage",
  "message.view",
  "message.send",
  "escrow.view",
  "escrow.manage",
  "escrow.release",
  "shipment.view",
  "shipment.manage",
  "notification.view",
];

export const ROLE_PERMISSIONS: Record<PlatformRole, readonly PermissionKey[]> = {
  PLATFORM_ADMIN: PERMISSION_KEYS,
  OWNER: ORGANIZATION_OWNER_PERMISSIONS,
  ADMIN: ORGANIZATION_OWNER_PERMISSIONS,
  MEMBER: [
    "dashboard.view",
    "organization.view",
    "rfq.view",
    "rfq.create",
    "rfq.manage",
    "rfq.invite",
    "quote.view",
    "quote.create",
    "quote.manage",
    "purchaseOrder.view",
    "purchaseOrder.manage",
    "sample.manage",
    "milestone.manage",
    "evidence.upload",
    "product.view",
    "inspection.view",
    "message.view",
    "message.send",
    "escrow.view",
    "shipment.view",
    "shipment.manage",
    "notification.view",
  ],
  QUALITY: [
    "dashboard.view",
    "organization.view",
    "supplierProfile.manage",
    "rfq.view",
    "quote.view",
    "purchaseOrder.view",
    "sample.manage",
    "milestone.manage",
    "evidence.upload",
    "product.view",
    "inspection.view",
    "inspection.manage",
    "message.view",
    "message.send",
    "escrow.view",
    "shipment.view",
    "notification.view",
  ],
};

export const ROLE_LABELS: Record<PlatformRole, string> = {
  PLATFORM_ADMIN: "مدير المنصة",
  OWNER: "المالك",
  ADMIN: "مدير المؤسسة",
  MEMBER: "عضو",
  QUALITY: "مسؤول الجودة",
};

const ROLE_RANK: Record<PlatformRole, number> = {
  QUALITY: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
  PLATFORM_ADMIN: 5,
};

export function permissionsForRole(role: PlatformRole): readonly PermissionKey[] {
  return ROLE_PERMISSIONS[role];
}

export function highestRole(roles: readonly PlatformRole[]): PlatformRole | null {
  return roles.reduce<PlatformRole | null>((highest, role) => {
    if (!highest || ROLE_RANK[role] > ROLE_RANK[highest]) return role;
    return highest;
  }, null);
}

export function hasPermission(
  context: Pick<AccessContext, "role" | "isPlatformAdmin">,
  permission: PermissionKey,
): boolean {
  const role: PlatformRole = context.isPlatformAdmin ? "PLATFORM_ADMIN" : context.role;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(
  context: Pick<AccessContext, "role" | "isPlatformAdmin">,
  permission: PermissionKey,
): void {
  if (!hasPermission(context, permission)) {
    throw new ApiError(403, "لا تملك الصلاحية المطلوبة لهذا الإجراء", "FORBIDDEN");
  }
}

export const ROLE_SETS = {
  manageOrganization: ["OWNER", "ADMIN"],
  manageMembers: ["OWNER", "ADMIN"],
  manageSupplierProfile: ["OWNER", "ADMIN", "QUALITY"],
  verifySupplier: ["OWNER", "ADMIN"],
  manageSchema: ["OWNER", "ADMIN"],
  createRfq: ["OWNER", "ADMIN", "MEMBER"],
  inviteSupplier: ["OWNER", "ADMIN", "MEMBER"],
  submitQuote: ["OWNER", "ADMIN", "MEMBER"],
  awardQuote: ["OWNER", "ADMIN"],
  manageProduction: ["OWNER", "ADMIN", "MEMBER", "QUALITY"],
  uploadEvidence: ["OWNER", "ADMIN", "MEMBER", "QUALITY"],
  manageProduct: ["OWNER", "ADMIN"],
  manageInspection: ["OWNER", "ADMIN", "QUALITY"],
  useMessaging: ["OWNER", "ADMIN", "MEMBER", "QUALITY"],
  manageEscrow: ["OWNER", "ADMIN"],
  manageShipment: ["OWNER", "ADMIN", "MEMBER", "QUALITY"],
} as const satisfies Record<string, readonly MembershipRole[]>;

export function hasRole(
  context: Pick<AccessContext, "role" | "isPlatformAdmin">,
  roles: readonly MembershipRole[],
): boolean {
  return context.isPlatformAdmin || roles.includes(context.role);
}

export function assertRole(
  context: Pick<AccessContext, "role" | "isPlatformAdmin">,
  roles: readonly MembershipRole[],
): void {
  if (!hasRole(context, roles)) {
    throw new ApiError(403, "دورك لا يسمح بهذا الإجراء", "FORBIDDEN");
  }
}
