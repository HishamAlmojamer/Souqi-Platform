import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from './ApiFeedback';
import { AppHeader } from './AppHeader';
import { MotionPressable, ScreenEntrance, useEntranceStyle } from './motion';
import { colors, radii, shadows, spacing, withAlpha } from './palette';
import { containerStyle, useResponsive } from './responsive';
import { StatusPill } from './StatusPill';
import { fonts } from './typography';
import { formatNumber, RFQ_STATUS, statusInfo } from '@/data/api';
import { usePlatformOverview } from '@/hooks/usePlatformOverview';
import { useAuth } from '@/state/AuthContext';
import {
  dashboardCopy,
  permissionLabel,
  roleLabel,
  type PermissionKey,
} from '@/state/permissions';

type QuickAction = {
  label: string;
  detail: string;
  href: string;
  glyph: string;
  permission?: PermissionKey;
};

export function RoleDashboard() {
  const { isDesktop, isCompact, gutter } = useResponsive();
  const wide = isDesktop;
  const {
    account,
    role,
    isPlatformAdmin,
    memberships,
    activeOrganization,
    permissions,
    hasPermission,
    logout,
  } = useAuth();
  const { rfqs, metrics, activity, loading, error, refetch } = usePlatformOverview();

  const copy = dashboardCopy(role, account?.accountType);
  const accountType = account?.accountType;

  const quickActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [];
    if (isPlatformAdmin) {
      actions.push({ label: 'لوحة الإدارة', detail: 'الحسابات والمؤسسات والاعتماد', href: '/admin', glyph: '◈' });
    }
    if (hasPermission('rfq.create')) {
      actions.push({ label: 'طلب عروض جديد', detail: 'مواصفات ومتطلبات', href: '/rfq/new', glyph: '＋', permission: 'rfq.create' });
    }
    if (hasPermission('rfq.view') || hasPermission('purchaseOrder.view')) {
      actions.push({ label: 'مركز الطلبات', detail: 'العروض وأوامر الشراء', href: '/orders', glyph: '▤' });
    }
    if (hasPermission('milestone.manage') || hasPermission('purchaseOrder.view')) {
      actions.push({ label: 'لوحة التنفيذ', detail: 'المراحل والشحن', href: '/production', glyph: '◷' });
    }
    if (accountType === 'buyer' || hasPermission('supplierProfile.manage')) {
      actions.push({ label: 'دليل الموردين', detail: 'الملفات والاعتماد', href: '/suppliers', glyph: '◇' });
    }
    return actions;
  }, [accountType, hasPermission, isPlatformAdmin]);

  const visiblePermissions = permissions.filter((permission) => permission !== 'dashboard.view');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="dashboard" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={styles.content}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>{copy.kicker}</Text>
              <Text style={[styles.pageTitle, isCompact && styles.pageTitleCompact]}>{copy.title}</Text>
              <Text style={styles.pageDescription}>{copy.description}</Text>
              <View style={styles.identityRow}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{roleLabel(role)}</Text>
                </View>
                {activeOrganization ? (
                  <Text style={styles.organizationName}>{activeOrganization.displayName}</Text>
                ) : null}
                {account?.isPlatformAdmin ? (
                  <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>مدير منصة</Text></View>
                ) : null}
              </View>
            </View>
            <MotionPressable
              accessibilityRole="button"
              onPress={() => void logout()}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutText}>تسجيل الخروج</Text>
            </MotionPressable>
          </View>

          <View style={styles.membershipPanel}>
            <Text style={styles.panelTitle}>مساراتك في المنصة</Text>
            <Text style={styles.panelSubtitle}>تظهر لك اللوحة حسب أعلى دور لديك في المؤسسات النشطة.</Text>
            <View style={styles.membershipRow}>
              {memberships.length > 0 ? memberships.map((membership) => (
                <View key={membership.id} style={styles.membershipChip}>
                  <Text style={styles.membershipOrg}>{membership.organization.displayName}</Text>
                  <Text style={styles.membershipRole}>{roleLabel(membership.role)}</Text>
                </View>
              )) : (
                <Text style={styles.emptyInline}>لا توجد عضويات مؤسسية مرتبطة بهذا الحساب.</Text>
              )}
            </View>
          </View>

          <ApiFeedback loading={loading} error={error} onRetry={refetch} />

          <View style={styles.statsRow}>
            <MetricCard label="طلبات توريد مفتوحة" value={formatNumber(metrics.openRfqs).padStart(2, '0')} detail="من الخادم" accent="green" delay={40} />
            <MetricCard label="العروض الواردة" value={formatNumber(metrics.quoteCount).padStart(2, '0')} detail="للمقارنة والمراجعة" accent="amber" delay={85} />
            <MetricCard label="صلاحياتك الفعّالة" value={formatNumber(permissions.length).padStart(2, '0')} detail={`الدور: ${roleLabel(role)}`} accent="blue" delay={130} />
            <MetricCard label="عضوياتك النشطة" value={formatNumber(memberships.length).padStart(2, '0')} detail="مؤسسات مرتبطة بحسابك" accent="ink" delay={175} />
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>إجراءاتك المتاحة</Text>
                <Text style={styles.sectionSubTitle}>وصول مخصص حسب دورك وصلاحياتك.</Text>
              </View>
            </View>
            <View style={[styles.actionGrid, wide && styles.actionGridWide]}>
              {quickActions.map((action) => (
                <Link key={action.href + action.label} href={action.href as any} asChild>
                  <MotionPressable accessibilityRole="link" style={styles.actionCard} pressedStyle={styles.actionCardPressed} hoverStyle={styles.actionCardHover}>
                    <Text style={styles.actionGlyph}>{action.glyph}</Text>
                    <Text style={styles.actionLabel}>{action.label}</Text>
                    <Text style={styles.actionDetail}>{action.detail}</Text>
                  </MotionPressable>
                </Link>
              ))}
            </View>
          </View>

          <View style={[styles.lowerGrid, wide && styles.lowerGridWide]}>
            <View style={styles.lowerColumn}>
              <View style={styles.sectionBlockCompact}>
                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={styles.sectionTitle}>طلبات التوريد</Text>
                    <Text style={styles.sectionSubTitle}>صورة سريعة من البيانات المحفوظة في الخادم.</Text>
                  </View>
                  <Text style={styles.itemCount}>{formatNumber(rfqs.length)} طلبات</Text>
                </View>
                {rfqs.length > 0 ? rfqs.slice(0, 5).map((request) => {
                  const status = statusInfo(RFQ_STATUS, request.status);
                  return (
                    <Link
                      key={request.id}
                      href={{ pathname: '/rfq/[id]' as any, params: { id: request.id } } as any}
                      asChild
                    >
                      <MotionPressable accessibilityRole="link" style={styles.requestCard} pressedStyle={styles.requestCardPressed} hoverStyle={styles.requestCardHover}>
                        <View style={styles.requestTop}>
                          <Text style={styles.requestTitle}>{request.title}</Text>
                          <StatusPill label={status.label} tone={status.tone} small />
                        </View>
                        <Text style={styles.requestSummary} numberOfLines={2}>{request.destination}</Text>
                        <Text style={styles.requestMeta}>
                          {formatNumber(request.quantity)} {request.unit} · {formatNumber(request._count?.quotes ?? 0)} عروض
                        </Text>
                  </MotionPressable>
                    </Link>
                  );
                }) : (
                  <Text style={styles.emptyInline}>لا توجد طلبات مرتبطة بحسابك بعد.</Text>
                )}
              </View>
            </View>

            <View style={styles.lowerColumn}>
              <View style={styles.sectionBlockCompact}>
                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={styles.sectionTitle}>صلاحياتك</Text>
                    <Text style={styles.sectionSubTitle}>هذه الصلاحيات تتحكم فيما يظهر لك من إجراءات وبيانات.</Text>
                  </View>
                  <Text style={styles.itemCount}>{formatNumber(visiblePermissions.length)}</Text>
                </View>
                <View style={styles.permissionList}>
                  {visiblePermissions.map((permission) => (
                    <View key={permission} style={styles.permissionChip}>
                      <Text style={styles.permissionCheck}>✓</Text>
                      <Text style={styles.permissionText}>{permissionLabel(permission)}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sectionBlockCompact}>
                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={styles.sectionTitle}>آخر المستجدات</Text>
                    <Text style={styles.sectionSubTitle}>من الطلبات وأوامر الشراء.</Text>
                  </View>
                </View>
                {activity.length > 0 ? activity.map((item) => (
                  <View key={item.id} style={styles.activityItem}>
                    <View style={styles.activityMarker}><Text style={styles.activityMarkerText}>{item.kind === 'quote' ? '↗' : item.kind === 'sample' ? '◇' : '·'}</Text></View>
                    <View style={styles.activityCopy}>
                      <Text style={styles.activityTitle}>{item.title}</Text>
                      <Text style={styles.activityDetail}>{item.detail}</Text>
                    </View>
                    <Text style={styles.activityTime}>{item.time}</Text>
                  </View>
                )) : <Text style={styles.emptyInline}>لا توجد مستجدات مسجلة بعد.</Text>}
              </View>
            </View>
          </View>

          <Text style={styles.footer}>سوقي · لوحة مخصصة حسب دورك · الصلاحيات مطبقة من الخادم</Text>
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, detail, accent, delay = 0 }: { label: string; value: string; detail: string; accent: 'green' | 'amber' | 'blue' | 'ink'; delay?: number }) {
  const accentColor = accent === 'green' ? colors.green : accent === 'amber' ? colors.amber : accent === 'blue' ? colors.blue : colors.inkSoft;
  const entranceStyle = useEntranceStyle({ delay, duration: 300, translateY: 8 });
  return (
    <Animated.View style={[styles.metricCard, entranceStyle]}>
      <View style={styles.metricTop}>
        <View style={[styles.metricAccent, { backgroundColor: accentColor }]} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surfaceAlt },
  page: { paddingBottom: 30 },
  content: { ...containerStyle, paddingTop: spacing.xl + 4 },
  headingRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg },
  headingCopy: { flex: 1, minWidth: 240, alignItems: 'flex-end' },
  kicker: { color: colors.accentDark, fontFamily: fonts.semiBold, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' },
  pageTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 28, lineHeight: 38, marginTop: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  pageTitleCompact: { fontSize: 23, lineHeight: 32 },
  pageDescription: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 22, marginTop: spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  identityRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  roleBadge: { backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 1, borderRadius: radii.sm },
  roleBadgeText: { color: colors.primaryDark, fontFamily: fonts.semiBold, fontSize: 11, writingDirection: 'rtl' },
  organizationName: { color: colors.textSoft, fontFamily: fonts.medium, fontSize: 11, writingDirection: 'rtl' },
  adminBadge: { backgroundColor: colors.accentSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 1, borderRadius: radii.sm },
  adminBadgeText: { color: colors.accentDark, fontFamily: fonts.semiBold, fontSize: 10, writingDirection: 'rtl' },
  logoutButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  logoutButtonPressed: { backgroundColor: colors.stone },
  logoutText: { color: colors.textSoft, fontFamily: fonts.semiBold, fontSize: 11, writingDirection: 'rtl' },
  membershipPanel: {
    marginTop: spacing.xl - 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.soft,
  },
  panelTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, textAlign: 'right', writingDirection: 'rtl' },
  panelSubtitle: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, marginTop: spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  membershipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  membershipChip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'flex-end',
  },
  membershipOrg: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 11, writingDirection: 'rtl' },
  membershipRole: { color: colors.accentDark, fontFamily: fonts.medium, fontSize: 10, marginTop: 3, writingDirection: 'rtl' },
  emptyInline: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, writingDirection: 'rtl' },
  statsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  metricCard: {
    flexGrow: 1,
    flexBasis: 155,
    minHeight: 112,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.soft,
  },
  metricTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm - 1 },
  metricAccent: { width: 7, height: 7, borderRadius: 4 },
  metricLabel: { color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  metricValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 26, marginTop: spacing.md, textAlign: 'right' },
  metricDetail: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10, marginTop: spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  sectionBlock: { marginTop: spacing.xl },
  sectionBlockCompact: { marginTop: spacing.xl - 4 },
  sectionHeading: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, textAlign: 'right', writingDirection: 'rtl' },
  sectionSubTitle: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, marginTop: spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  itemCount: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, writingDirection: 'rtl' },
  actionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md },
  actionGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  actionCard: {
    flexGrow: 1,
    flexBasis: 170,
    minHeight: 108,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'flex-end',
    ...shadows.soft,
  },
  actionCardPressed: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  actionCardHover: { backgroundColor: withAlpha(colors.gold, 0.07), borderColor: withAlpha(colors.gold, 0.55) },
  actionGlyph: { color: colors.accentDark, fontFamily: fonts.bold, fontSize: 20 },
  actionLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 13, marginTop: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  actionDetail: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10, marginTop: spacing.sm - 2, textAlign: 'right', writingDirection: 'rtl' },
  lowerGrid: { marginTop: spacing.xl },
  lowerGridWide: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.lg },
  lowerColumn: { flex: 1, minWidth: 280 },
  requestCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  requestCardPressed: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  requestCardHover: { backgroundColor: withAlpha(colors.gold, 0.05), borderColor: withAlpha(colors.gold, 0.45) },
  requestTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  requestTitle: { flex: 1, minWidth: 0, color: colors.text, fontFamily: fonts.semiBold, fontSize: 13, textAlign: 'right', writingDirection: 'rtl' },
  requestSummary: { color: colors.textSoft, fontFamily: fonts.medium, fontSize: 11, lineHeight: 19, marginTop: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  requestMeta: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10, marginTop: spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  permissionList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  permissionChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm - 2,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  permissionCheck: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 10 },
  permissionText: { color: colors.textSoft, fontFamily: fonts.medium, fontSize: 10, writingDirection: 'rtl' },
  activityItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.primary, 0.08),
  },
  activityMarker: { width: 26, height: 26, borderRadius: radii.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  activityMarkerText: { color: colors.accentDark, fontFamily: fonts.bold, fontSize: 13 },
  activityCopy: { flex: 1, alignItems: 'flex-end' },
  activityTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  activityDetail: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10, marginTop: 3, textAlign: 'right', writingDirection: 'rtl' },
  activityTime: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9, writingDirection: 'rtl' },
  footer: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, marginTop: spacing.xl, textAlign: 'center', writingDirection: 'rtl' },
});
